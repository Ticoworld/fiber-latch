# FiberLatch Access

FiberLatch Access is a small, framework-independent Node.js package for
access receipts after a host application has already established payment or
business trust. It validates claims, signs and verifies Ed25519 receipts,
checks that they match the expected user and resource, and uses your app's
store to record and limit receipt use safely.

It does not determine whether a payment happened. Your app establishes payment
trust before issuance and makes the final decision about serving a resource.

## Install

Install the published package from npm:

~~~sh
npm install @fiberlatch/access
~~~

Runtime requirements:

- Node.js `>=22.12.0`.
- Native ESM is the primary module format.
- Supported CommonJS use relies on Node's `require(esm)` behavior.
- There is no browser runtime.
- The package is open-source under ISC.

## 60-second mental model

FiberLatch Access has two moments. Issuance happens only after your app trusts
its payment or business decision. Access happens later when your app receives
the receipt and checks it against trusted request context.

~~~text
your app trusts a payment or permission decision
            |
            v
create and sign receipt
            |
            v
client presents receipt later
            |
            v
check receipt and expected user/resource/rules
            |
            v
record one use safely in your app's store -> serve or deny
~~~

The signed receipt is not payment proof. `payment_ref` is a reference that can
link the receipt to a payment record, not payment proof. `jti` alone does not
prevent replay.

## Quick start (ESM)

The following is a standalone demonstration of the complete package flow. It
generates an Ed25519 key pair only to keep this example self-contained. A
production host should load its trusted signing and verification keys from its
own secure configuration rather than generating them per request.

Save this as `index.mjs` in a project that installed the package, then run
`node index.mjs`:

~~~js
import { webcrypto } from "node:crypto";

import {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
  evaluateAccessReceiptBindings,
  redeemAccessReceipt,
} from "@fiberlatch/access";

const now = Math.floor(Date.now() / 1000);
const issuer = "https://access.example.test";
const audience = "protected-api";

// Demo-only key setup. Production hosts load long-lived trusted keys.
const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
);
const privateJwk = {
  ...(await webcrypto.subtle.exportKey("jwk", privateKey)),
  alg: "EdDSA",
  kid: "adopter-demo-key",
};
const publicJwk = {
  ...(await webcrypto.subtle.exportKey("jwk", publicKey)),
  alg: "EdDSA",
  kid: "adopter-demo-key",
};

// The host has already trusted this payment or business decision.
const claims = buildAccessReceiptClaims({
  iss: issuer,
  sub: "user-42",
  aud: audience,
  iat: now,
  nbf: now,
  exp: now + 300,
  jti: "receipt-42",
  intent_id: "intent-42",
  resource_id: "course/module-1",
  policy_id: "single-access-v1",
  payment_ref: "host-payment-42",
  grant_type: "single_redemption",
  max_redemptions: 1,
});

const signer = await createAccessReceiptSigner({ privateKey: privateJwk });
const token = await signer(claims);
const verifier = await createAccessReceiptVerifier({
  publicKeys: [publicJwk],
  issuer,
  audience,
});
const verifiedClaims = await verifier(token);

const expected = {
  sub: "user-42",
  resource_id: "course/module-1",
  policy_id: "single-access-v1",
  intent_id: "intent-42",
};

// Demo-only memory. A real host must use trusted atomic storage.
const consumedJtis = new Set();
const store = {
  async consume(command) {
    if (consumedJtis.has(command.jti)) {
      return { outcome: "receipt_exhausted" };
    }
    consumedJtis.add(command.jti);
    return { outcome: "consumed", exhausted: true };
  },
};

const first = await redeemAccessReceipt({
  token,
  expected,
  verifier,
  store,
  current_time: now,
});
const replay = await redeemAccessReceipt({
  token,
  expected,
  verifier,
  store,
  current_time: now,
});

console.log({ first, replay });
// first:  { status: "success", exhausted: true }
// replay: { status: "consumption_denied", phase: "consumption", reason: "receipt_exhausted" }
~~~

The example's expected bindings are trusted application context. Do not derive them
from the untrusted bearer receipt. The [paid-resource example](https://github.com/Ticoworld/fiber-latch/blob/master/examples/paid-resource/README.md)
contains the complete demonstration store, HTTP boundary, concurrency
behavior, and tests.

## Common tasks and API

All runtime functions are exported from the package root. The package also
exports the type-only contracts listed below.

| Export | What it does | Behavior |
| --- | --- | --- |
| `buildAccessReceiptClaims(input)` | Validates and returns canonical claims for issuance. | Synchronous; throws `AccessReceiptValidationError` for malformed or inconsistent claims. |
| `createAccessReceiptSigner({ privateKey })` | Imports trusted Ed25519 private-key configuration and creates a signer. | Async; rejects with `AccessReceiptConfigurationError` for invalid configuration. The returned signer is async and can reject `AccessReceiptValidationError` for invalid claims. |
| `createAccessReceiptVerifier({ publicKeys, issuer, audience, ... })` | Imports trusted Ed25519 public keys and configures verification. | Async; rejects with `AccessReceiptConfigurationError` for invalid configuration. |
| `evaluateAccessReceiptBindings(claims, expected)` | Checks verified claims against the expected subject, resource, policy, intent, and optional redemption limit. | Synchronous; returns `matched` or `binding_denied`. |
| `redeemAccessReceipt(input)` | Verifies a bearer receipt, evaluates bindings, and calls the host store's atomic `consume`. | Async; returns a typed result rather than throwing for normal denial or store failure. |

The verifier configuration requires a non-empty `publicKeys` array, `issuer`,
and `audience`. Optional `clockTolerance` is bounded to 60 seconds and
`maxTokenSize` is bounded to 256-16,384 bytes. Redemption input contains the
bearer `token`, trusted `expected` bindings, a verifier, a store, and a safe
non-negative integer `current_time` supplied by the host.

The package-root type surface includes `AccessReceiptJwk`,
`AccessReceiptSignerConfiguration`, `AccessReceiptVerifierConfiguration`,
`AccessReceiptClaims`, `BuildAccessReceiptClaimsInput`,
`AccessReceiptExpectedBindings`, `AccessReceiptConsumeCommand`,
`AccessReceiptConsumeResult`, `AccessReceiptStore`, `AccessReceiptSigner`,
`AccessReceiptVerifier`, `RedeemAccessReceiptInput`,
`AccessReceiptRedemptionResult`, `AccessReceiptValidationIssue`,
`AccessReceiptConfigurationIssue`, and
`AccessReceiptConsumptionDenialReason`.

### Issuance order

The host:

1. establishes trusted payment or business authorization
2. determines the subject, resource, policy, and intent
3. builds canonical claims with `buildAccessReceiptClaims`
4. signs those claims with a signer created by `createAccessReceiptSigner`

### Access order

The host:

1. receives a bearer receipt
2. creates or reuses a verifier with trusted configuration
3. defines expected bindings from trusted request and application context
4. supplies its `AccessReceiptStore` implementation
5. calls `redeemAccessReceipt`
6. makes the final serve-or-deny decision

After the verifier returns `verifiedClaims`, a direct binding check uses trusted
application context rather than receipt fields:

~~~js
const binding = evaluateAccessReceiptBindings(verifiedClaims, {
  sub: "user-42",
  resource_id: "course/module-1",
  policy_id: "single-access-v1",
  intent_id: "intent-42",
});

if (binding.status !== "matched") {
  // Deny access; this is not an application crash.
}
~~~

## Claims and issuance reference

`BuildAccessReceiptClaimsInput` requires these canonical fields:

| Claim | Type | Meaning |
| --- | --- | --- |
| `iss` | non-empty string | Trusted receipt issuer or authority identifier. |
| `sub` | non-empty string | Subject receiving access. |
| `aud` | non-empty string | Intended verifier or service audience. |
| `iat` | integer | Issuance time in Unix seconds. |
| `nbf` | integer | Not-before time in Unix seconds. |
| `exp` | integer | Expiration time in Unix seconds. |
| `jti` | non-empty string | Stable receipt identity used by host persistence. |
| `intent_id` | non-empty string | Host-defined access intent identifier. |
| `resource_id` | non-empty string | Host-defined protected resource identifier. |
| `policy_id` | non-empty string | Host-defined policy identifier. |
| `payment_ref` | string or `null` | Reference linking the receipt to a host payment record; never payment proof. |
| `grant_type` | `single_redemption` or `multi_redemption` | Declares the redemption model. |
| `max_redemptions` | positive integer | Maximum number of uses set by the host. |

The claim builder enforces `iat <= nbf < exp`. It also enforces
`single_redemption` with `max_redemptions: 1` and `multi_redemption` with a
value greater than `1`. It validates claim structure and relationships; the
verifier and host store perform time and redemption decisions against their
trusted application context.

## Handling redemption results

`redeemAccessReceipt` returns a typed result. Expected authorization denials
are results, not application crashes:

| Status | Meaning and normal host action |
| --- | --- |
| `success` | The store recorded one use and returns `exhausted: boolean`; the host may still apply its final resource decision. |
| `verification_denied` | The receipt was not trusted, for example because it was malformed, expired, or had an invalid signature, issuer, or audience. Deny access. |
| `binding_denied` | Verified claims do not match the host's expected subject, resource, policy, intent, or limit. Deny access. |
| `consumption_denied` | The host store denied consumption. Deny access and inspect the typed reason internally if needed. |
| `system_failure` | The host cannot safely conclude that authorization succeeded. Fail closed and handle or log the failure internally. |

Invalid redemption input, including an invalid `current_time`, a verifier or
store exception, or a malformed store result, becomes `system_failure`.

A framework-independent result-handling shape is:

~~~js
function accessDecision(result) {
  switch (result.status) {
    case "success":
      return "serve";
    case "verification_denied":
    case "binding_denied":
    case "consumption_denied":
      return "deny";
    case "system_failure":
      console.error("Access redemption failed internally.");
      return "deny";
  }
}
~~~

Return only the host's chosen generic access decision to an untrusted client.
Do not expose cryptographic, store, or internal verification details.

## Consumption denial reasons

`consumption_denied` includes one of these host-store reasons:

| Reason | Meaning |
| --- | --- |
| `receipt_missing` | Your trusted store has no receipt record for the receipt identity. |
| `receipt_revoked` | Your app has revoked the receipt. |
| `receipt_exhausted` | The receipt's use limit was already reached. |
| `receipt_expired` | Your store denied use at or after the trusted expiration time. |
| `authority_mismatch` | Signed, trusted-host, or persisted authority does not match. |
| `concurrency_conflict` | Trusted state changed and this attempt did not record a use. It is never success. |

The verifier may instead return `verification_denied` for an expired or
otherwise untrusted receipt before the store is called. The library does not
promise a retry policy; the host decides whether a retry is safe.

## Implementing AccessReceiptStore

`AccessReceiptStore` is the primary host implementation boundary:

~~~ts
import type { AccessReceiptStore } from "@fiberlatch/access";

const store: AccessReceiptStore = {
  async consume(command) {
    // Replace this placeholder with one atomic check-and-update operation.
    // Inspect command.jti, authority, expiry, and redemption policy in host state.
    return { outcome: "receipt_missing" };
  },
};
~~~

The host store is responsible for receipt existence, revocation, expiry,
authority, redemption count, exhaustion, and atomic consumption. The command
includes the verified `jti`, signed authority and bindings, grant type, maximum
redemptions, `exp`, trusted `current_time`, and an optional host
`expected_max_redemptions` limit.

`consume` returns `{ outcome: "consumed", exhausted: boolean }` when it grants
one use, one of the six denial outcomes listed above when it denies use, or
`{ outcome: "system_failure" }` when it cannot complete or confidently
determine the transition. Exceptions and unrecognized return shapes are mapped
to `system_failure` by `redeemAccessReceipt`.

The transition must compare trusted state and update redemption state as one
atomic operation. A read-then-write implementation is unsafe: two concurrent
requests can both observe an available receipt and both grant access. The
included in-memory store is demonstration-only and does not provide
multi-process or distributed replay protection.

## Errors during setup, issuance, and verification

These errors are for the host developer during construction or issuance. They
are not a replacement for redemption results:

| Error | Trigger | Handling |
| --- | --- | --- |
| `AccessReceiptValidationError` | `buildAccessReceiptClaims` or the returned signer receives malformed or inconsistent claims input. | Throws synchronously from the builder, or rejects from the async signer, with structured `issues` containing paths and reasons. Correct the host input. |
| `AccessReceiptConfigurationError` | Signer or verifier receives invalid trusted key, issuer, audience, or option configuration. | Throws or rejects during setup with structured `issues`. Correct configuration; do not expose it to clients. |
| `AccessReceiptVerificationError` | The verifier rejects an untrusted receipt. | Intentionally generic; cryptographic and internal details are hidden. `redeemAccessReceipt` maps it to `verification_denied`. |

`redeemAccessReceipt` normally returns a result even when its input is
malformed, the verifier or store throws, or the store returns an unrecognized
shape. Those cases become `system_failure` and must fail closed.

## Host responsibilities and common mistakes

The host owns payment verification and trust, user or subject identity,
resource meaning, policy meaning, intent meaning, trusted signer and verifier
configuration, storage, revocation, redemption counts, atomic consume
semantics, and the final HTTP or application access decision.

FiberLatch Access owns claim validation, receipt signing, receipt verification,
checking receipt bindings and safely recording use through your app's store.
It does not verify payments, call Fiber RPC during normal verification or
redemption, persist or revoke receipts, or make the final access decision.

Avoid these mistakes:

- Do not use `payment_ref` as payment proof.
- Do not derive trusted expected bindings from the bearer receipt itself.
- Do not treat a valid signature as final resource authorization.
- Do not rely on `jti` alone for replay protection.
- Do not implement `consume` as a non-atomic read followed by a write.
- Do not expose internal verification or store errors directly to clients.
- Do not treat `concurrency_conflict` as success.

## CommonJS

On Node.js `>=22.12.0`, supported CommonJS use is the package-root form:

~~~js
const access = require("@fiberlatch/access");

async function configureVerifier(config) {
  return access.createAccessReceiptVerifier(config);
}
~~~

This relies on Node's documented `require(esm)` behavior. Older Node releases
are not supported, and source-file or subpath imports are not supported.

## Complete integration example

Use the [paid-resource example](https://github.com/Ticoworld/fiber-latch/blob/master/examples/paid-resource/README.md)
for the full runnable native-HTTP integration example. Its payment fixture is
server-side demo data, not Fiber payment proof; issuance occurs only after the
host trusts that fixture. It demonstrates protected-resource redemption,
first-use success, replay denial, a process-local store, and the limits of a
single-process concurrency proof.

## Source, support, and license

Normal adopters should use npm. For source review or contributor work, use the
repository's existing package and example checks:

~~~sh
git clone https://github.com/Ticoworld/fiber-latch.git
cd fiber-latch
npm ci
npm run verify:access:package
npm run verify:access:example
~~~

The package source is under
[`packages/access`](https://github.com/Ticoworld/fiber-latch/tree/master/packages/access).
The [package verification guide](https://github.com/Ticoworld/fiber-latch/blob/master/docs/fiberlatch-access-verification.md)
contains the detailed packed-consumer checks for source review and maintainer
work.

Report product bugs or documentation issues through
[GitHub Issues](https://github.com/Ticoworld/fiber-latch/issues).

- [Source repository](https://github.com/Ticoworld/fiber-latch)
- [Paid-resource example](https://github.com/Ticoworld/fiber-latch/tree/master/examples/paid-resource)
- [GitHub Issues](https://github.com/Ticoworld/fiber-latch/issues)
- [ISC license](https://github.com/Ticoworld/fiber-latch/blob/master/packages/access/LICENSE)
