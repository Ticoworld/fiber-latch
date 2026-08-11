# FiberLatch Access

## What is this?

FiberLatch Access is a small, framework-independent Node.js package for
access receipts after a host application has already established payment or
business trust. It validates claims, signs and verifies Ed25519 receipts,
evaluates host bindings, and orchestrates one redemption through a
host-owned store.

It does not establish payment trust. The host decides whether a payment is
trusted before issuance and whether a successfully redeemed receipt is enough
to serve a resource.

## Distribution and runtime

- The repository is public and the source and package are open-source under
  ISC.
- The `0.1.0` release is prepared for public distribution through npm.
- Once that release is published, the normal adopter path is
  `npm install @fiberlatch/access`.
- Minimum Node.js version: `>=22.12.0`.
- The package is native ESM.
- Supported CommonJS use relies on Node's `require(esm)` behavior.
- There is no browser runtime.
- The repository checkout remains the source, contributor, and reviewer path.

## Install from npm

For the `0.1.0` public release, install the package from npm:

~~~sh
npm install @fiberlatch/access
~~~

This is the normal external-adopter path once the release is published. The
consumer resolves `@fiberlatch/access` from its own `node_modules`; no
workspace linking or source import is required.

## Build and install from source

Use this secondary path for source review, contributor work, reproducing the
packaged artifact, and local pre-publication verification.

Run these commands from a fresh public checkout:

~~~sh
git clone https://github.com/Ticoworld/fiber-latch.git
cd fiber-latch
npm ci
npm run build:access
npm pack --workspace @fiberlatch/access
~~~

With the release-preparation manifest, npm reports
`fiberlatch-access-0.1.0.tgz` and writes that tarball to the current working
directory, which is the repository root in the commands above. The package
inside the artifact is `@fiberlatch/access@0.1.0`.

Create a clean consumer outside the checkout and install the generated file:

~~~sh
mkdir ../fiberlatch-consumer
cd ../fiberlatch-consumer
npm init -y
npm pkg set type=module
npm install ../fiber-latch/fiberlatch-access-0.1.0.tgz
~~~

The relative path assumes the default `fiber-latch` clone directory. If the
checkout has another name or location, adjust only that local tarball path.
This clean-consumer flow does not use workspace linking, source imports, or
registry publication.

## Runtime API and operation order

The package-root API comprises these runtime operations and type-only
contracts:

| Export | Responsibility |
| --- | --- |
| `buildAccessReceiptClaims` | Validate and return canonical receipt claims. |
| `createAccessReceiptSigner` | Create an Ed25519 signer from trusted private-key configuration. |
| `createAccessReceiptVerifier` | Create a verifier from trusted public keys, issuer, and audience. |
| `evaluateAccessReceiptBindings` | Compare verified claims with trusted host subject, resource, policy, intent, and optional redemption-limit context. |
| `redeemAccessReceipt` | Verify a token, evaluate bindings, and call the host store's atomic `consume` operation. |
| `AccessReceiptStore` and related types | Define the host-owned store boundary; no production adapter is shipped. |

The package-root type surface also includes `AccessReceiptJwk`,
`AccessReceiptSignerConfiguration`, `AccessReceiptVerifierConfiguration`,
`AccessReceiptClaims`, `BuildAccessReceiptClaimsInput`,
`AccessReceiptExpectedBindings`, `AccessReceiptConsumeCommand`,
`AccessReceiptConsumeResult`, `RedeemAccessReceiptInput`,
`AccessReceiptRedemptionResult`, and
`AccessReceiptConsumptionDenialReason`.

### Issuance side

The host:

1. establishes trusted payment or business authorization
2. determines the subject, resource, policy, and intent
3. builds canonical claims with `buildAccessReceiptClaims`
4. signs those claims with a signer created by `createAccessReceiptSigner`

### Access side

The host:

1. receives a bearer receipt
2. creates or reuses a verifier with trusted configuration
3. defines expected bindings from trusted request and application context
4. supplies its authoritative `AccessReceiptStore`
5. calls `redeemAccessReceipt`
6. makes the final serve-or-deny decision

FiberLatch Access does not verify payment, call Fiber RPC, persist receipts,
revoke receipts, or make the final HTTP/application access decision.
`payment_ref` is correlation metadata, not payment proof. A signed receipt
alone is not sufficient authorization to serve a resource, and `jti` alone
does not prevent replay.

## Minimal ESM walkthrough

Save the following as `index.mjs` in the external consumer and run
`node index.mjs`. The expected bindings are trusted host context; do not
derive them from an untrusted bearer token.

~~~js
import { webcrypto } from "node:crypto";

import {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
  redeemAccessReceipt,
} from "@fiberlatch/access";

const now = Math.floor(Date.now() / 1000);
const issuer = "https://access.example.test";
const audience = "protected-api";
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

// This is only a small in-memory demonstration. A real store must enforce
// authoritative expiry, authority, revocation, limits, and atomicity.
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

console.log(verifiedClaims.jti); // receipt-42
console.log(first); // { status: "success", exhausted: true }
console.log(replay); // consumption_denied: receipt_exhausted
~~~

The paid-resource example contains the complete demonstration store,
concurrency behavior, HTTP boundary, and tests:
[`examples/paid-resource`](../../examples/paid-resource).

## Handling redemption results

`redeemAccessReceipt` returns a typed result. Expected authorization denials
are results, not application crashes:

| Status | Meaning and normal host action |
| --- | --- |
| `success` | The store consumed access; the host may still apply its final resource decision. |
| `verification_denied` | The receipt was not trusted, for example because it was malformed, expired, or had an invalid signature, issuer, or audience. Deny access. |
| `binding_denied` | The verified claims do not match the host's expected subject, resource, policy, intent, or limit. Deny access. |
| `consumption_denied` | The host store denied consumption. Deny access and inspect the typed reason internally if needed. |
| `system_failure` | The host cannot safely conclude that authorization succeeded. Fail closed and handle or log the failure internally. |

Consumption denial reasons are `receipt_missing`, `receipt_revoked`,
`receipt_exhausted`, `receipt_expired`, `authority_mismatch`, and
`concurrency_conflict`. A concurrency conflict must never be treated as
success. The library does not promise a retry policy; the host decides whether
and how a retry is safe. Do not expose cryptographic, store, or internal
details directly to an HTTP client.

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

## Errors during setup

These errors are for the host developer during construction or issuance. They
are not a replacement for redemption results:

| Error | Trigger | Details |
| --- | --- | --- |
| `AccessReceiptValidationError` | `buildAccessReceiptClaims` or signing receives malformed or inconsistent trusted claims input. | Throws with structured `issues` containing paths and developer-facing reasons. |
| `AccessReceiptConfigurationError` | Signer or verifier receives invalid trusted key, issuer, audience, or option configuration. | Throws or rejects during setup with structured `issues`; correct configuration rather than exposing them to clients. |
| `AccessReceiptVerificationError` | The verifier rejects an untrusted receipt. | Intentionally generic; cryptographic and internal verification details are not exposed. `redeemAccessReceipt` maps it to `verification_denied`. |

## Host responsibilities

The host owns payment verification and trust, user or subject identity,
resource meaning, policy meaning, intent meaning, trusted signer and verifier
configuration, persistence, revocation, authoritative redemption counts,
atomic consume semantics, and the final HTTP or application access decision.

FiberLatch Access owns receipt claim validation, receipt signing, receipt
verification, binding evaluation, and redemption orchestration against the
host-owned store. The included in-memory store shape is demonstration-only:
process-local memory is not distributed production replay protection. Replay
protection requires authoritative persistent state and an atomic consumption
transition.

## CommonJS

On Node.js `>=22.12.0`, supported CommonJS use is the package-root form:

~~~js
const access = require("@fiberlatch/access");
~~~

This relies on Node's documented `require(esm)` behavior. Older Node releases
are not supported, and source-file or subpath imports are not supported.

## Complete integration example

Use [`examples/paid-resource/README.md`](../../examples/paid-resource/README.md)
for the full runnable integration example. Its payment fixture is host-owned
demo data, not Fiber payment proof; issuance occurs only after the host trusts
that fixture. It demonstrates protected-resource redemption, first-use
success, replay denial, a process-local store, and the limits of a
single-process concurrency proof.

No production database adapter, hosted service, payment SDK, Fiber RPC path,
browser runtime, mainnet-readiness claim, production-readiness claim, or
formal security-audit claim is included.

Further reviewer material:

- [`docs/fiberlatch-access-verification.md`](../../docs/fiberlatch-access-verification.md)
- [`docs/fiberlatch-access-final-report.md`](../../docs/fiberlatch-access-final-report.md)
- [`docs/fiberlatch-access-grant-ledger.md`](../../docs/fiberlatch-access-grant-ledger.md)
