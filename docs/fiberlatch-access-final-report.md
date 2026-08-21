# FiberLatch Access Final Delivery Report

## Final status - 21 August 2026

Technical, product, and documentation delivery for the approved FiberLatch
Access grant scope is complete. This report records the final delivery,
verification evidence, and limitations. The public Nervos completion post has
not yet been submitted; it is the next administrative action.

## 1. Executive summary

FiberLatch Access delivered four written specifications, a reusable Node
package, a paid-resource example, and reviewer documentation and evidence. The
first public npm release was `@fiberlatch/access@0.1.0`; the final polish
release is `@fiberlatch/access@0.1.1`.

The package is a focused access-control boundary after a host establishes
payment trust. It constructs claims, signs and verifies Ed25519 receipts,
checks host bindings, and records redemption through an app-owned atomic store.
The paid-resource example demonstrates first-use success and replay denial from
server-side demo payment data.

The implementation, package/example work, public distribution, external
registry verification, documentation reconciliation, and final acceptance
have evidence for the approved scope.

Grant facts: $3,000, six weeks, $0 hosting cost, and one solo developer. The
final package is publicly distributed as `@fiberlatch/access@0.1.1`. No hosted
service was created.

## 2. Approved grant scope

The approved outcome was a small open-source Node.js access-control package,
one paid-resource example, and documentation that another developer can
understand, install, test, run, and adapt without copying the full FiberLatch
backend.

The scope covers receipt format, expiration, replay requirements, signing,
verification, claim construction, receipt matching, typed outcomes, app storage
requirements, valid redemption, denial of invalid or reused
receipts, and setup/security/limitation documentation.

The scope excludes payment processing, a payment SDK, a hosted service, a
database adapter, a dashboard, a CLI, frontend/browser support, production or
mainnet readiness, formal security audit, and long-term maintenance.

## 3. Prior foundation versus grant-funded work

The historical FiberLatch foundation is the existing Fastify/Prisma backend,
its routes and demos, its fake-Fiber regression path, and the earlier live paid
Fiber testnet proof. That proof verified a real paid testnet payment_hash
through Fiber v0.8.1 RPC, issued a signed receipt, redeemed once, and denied
reuse. It remains historical evidence and was not funded again by this grant.

The grant-funded delivery is the independent package boundary at
packages/access, the paid-resource example at examples/paid-resource, the
scope, receipt, expiration/replay, and signing/verification specifications,
and the reviewer documentation and evidence mapping in this report. The
package does not require the backend's Fastify, Prisma,
SQLite, routes, or environment-loading behaviour.

## 4. Delivery timeline

| Period | Delivery |
| --- | --- |
| Weeks 1–2 | Scope, receipt format, expiration/replay, signing/verification, package design, and ledger were specified. |
| Weeks 3–4 | Package claim construction, signing, verification, receipt matching, store contract, and redemption were implemented and tested. |
| Weeks 3–4 / Paid-resource example | The paid-resource example and packed acceptance flow were added. |
| Weeks 5–6 / Documentation and final report | Published the package, refreshed adopter-facing documentation, validated packed and registry-installed consumers, reconciled historical records, completed omission/red-team cleanup, finalized the 0.1.1 patch release, and recorded final evidence. |

## 5. Deliverable status table

| Deliverable | Artifact | Relevant commit | Verification evidence | Current status | Limitations |
| --- | --- | --- | --- | --- | --- |
| Scope and design | [fiberlatch-access-scope.md](fiberlatch-access-scope.md) | [b28cc1b](https://github.com/Ticoworld/fiber-latch/commit/b28cc1b0722b531fee8d1efaec24ce5c3ba9143e) | Versioned scope boundary; independent review approved | VERIFIED COMPLETE | Defines an access boundary, not payment settlement or final host enforcement |
| Receipt format | [fiberlatch-access-receipt-format.md](fiberlatch-access-receipt-format.md) | [b606abb](https://github.com/Ticoworld/fiber-latch/commit/b606abbdff759f3bafef53280225b4b4f7962a96) | Versioned claims and lifecycle shape; technical review and hygiene verification completed | VERIFIED COMPLETE | A receipt is not payment proof or standalone authorization |
| Expiration and replay | [fiberlatch-access-expiration-replay.md](fiberlatch-access-expiration-replay.md) | [556bed3](https://github.com/Ticoworld/fiber-latch/commit/556bed351d4c8b7dbc0ce13306564905e2613e11) | Versioned rules; independent technical/public-hygiene review; 57 backend tests and build passed | VERIFIED COMPLETE | Replay protection requires host-owned persistent atomic state |
| Signing and verification | [fiberlatch-access-signing-verification.md](fiberlatch-access-signing-verification.md) | [9215d26](https://github.com/Ticoworld/fiber-latch/commit/9215d264bbd434a3f85df0b2bd836d5efada3b46) | Versioned rules; independent security/public-hygiene review; 57 backend tests and build passed | VERIFIED COMPLETE | No formal security audit or remote key infrastructure is claimed |
| Node package | [packages/access](../packages/access), design doc | [cac7821](https://github.com/Ticoworld/fiber-latch/commit/cac78216a803b5e287fa5c92ad0270226caf35e1) | 235 package tests; build; publint; ATTW; packed ESM/CommonJS/TypeScript consumers; final Node 22/24 CI; clean registry-only ESM/CommonJS/TypeScript and functional consumer verification | VERIFIED COMPLETE | Publicly distributed as `@fiberlatch/access@0.1.1`, Node-only, and without a production database adapter |
| Paid-resource example | [examples/paid-resource](../examples/paid-resource) | [e06ad18](https://github.com/Ticoworld/fiber-latch/commit/e06ad183f25fd35ea7570914ad38bf695940d6f3) | 12 example tests; first-use/replay demo; packed acceptance; exactly-one-of-two single-process concurrency proof; Node 22/24 run 31093114518; independent focused integration review: APPROVE | VERIFIED COMPLETE | Fixture is not a Fiber payment; no durable multi-process store or hosted service |
| Documentation and final report | This report, [fiberlatch-access-verification.md](fiberlatch-access-verification.md), updated README/quickstart/changelog/ledger/package docs | Final closeout documentation update, based on release source commit [cac7821](https://github.com/Ticoworld/fiber-latch/commit/cac78216a803b5e287fa5c92ad0270226caf35e1) | Public npm distribution, adopter-facing README cleanup, documentation reconciliation, omission/red-team cleanup, final report, and registry-only verification recorded; final package source passed [master CI run 32457825277](https://github.com/Ticoworld/fiber-latch/actions/runs/32457825277) and [grant-branch CI run 32457829076](https://github.com/Ticoworld/fiber-latch/actions/runs/32457829076) | VERIFIED COMPLETE | The final public Nervos completion post is not yet submitted |

## 6. Scope and design

The scope document freezes the boundary between payment tooling, the host
application, FiberLatch Access, and the historical backend. It makes payment
trust, identity, protected resources, policy meaning, persistence, and final
enforcement host responsibilities. The package is not a payment SDK or
general Fiber RPC wrapper.

Artifact: [docs/fiberlatch-access-scope.md](fiberlatch-access-scope.md).
Evidence: commit b28cc1b0722b531fee8d1efaec24ce5c3ba9143e, versioned scope,
independent review approval, and baseline backend tests/build.
Limitation: this is the approved boundary and design, not a hosted payment
service or production guarantee.

## 7. Receipt format

The receipt format defines a signed JWT claim set with issuer, subject,
audience, integer time fields, receipt identity, intent/resource/policy
bindings, a payment-record reference, grant type, and redemption limit. The
format explicitly says payment_ref is a reference, not
payment proof, and preserves host responsibility for final authorization.

Artifact: [docs/fiberlatch-access-receipt-format.md](fiberlatch-access-receipt-format.md).
Evidence: commit b606abbdff759f3bafef53280225b4b4f7962a96, technical review, and
hygiene verification.
Limitation: the receipt is not standalone authorization and does not replace
host persistence.

## 8. Expiration and replay

The expiration and replay rules define time validity and the required atomic
redemption boundary. The app-owned state is trusted for existence, revocation, exhaustion,
redemption count, and persisted bindings. A jti identifies a receipt but does
not itself prevent reuse. Ordinary redemption does not require Fiber RPC.

Artifact: [docs/fiberlatch-access-expiration-replay.md](fiberlatch-access-expiration-replay.md).
Evidence: commit 556bed351d4c8b7dbc0ce13306564905e2613e11, independent technical
and public-hygiene review, and 57 backend tests/build evidence.
Limitation: distributed replay protection is not supplied by the package; the
host must implement the atomic persistent transition.

## 9. Signing and verification

The signing and verification rules constrain the cryptographic profile to Ed25519/EdDSA, trusted
issuer and audience, protected typ/kid handling, required claims, strict time
checks, safe denial, and no token-controlled key retrieval. Verification is
separate from binding, persistence, and final access enforcement.

Artifact: [docs/fiberlatch-access-signing-verification.md](fiberlatch-access-signing-verification.md).
Evidence: commit 9215d264bbd434a3f85df0b2bd836d5efada3b46, independent security
and public-hygiene review, and 57 backend tests/build evidence.
Limitation: no formal security audit, key-management service, or production
readiness is claimed.

## 10. Node package

The package at [packages/access](../packages/access) is deliberately
framework-independent and has no Fastify, Prisma, SQLite, or Fiber RPC
dependency. The package root exports the approved runtime API and type-only
contracts without exposing internal subpaths.

Artifact commits: package design 8dadae65319dd20cf57c67ab60801e11748293da;
final package API and redemption f7e5b7b72f3bec285bd09e2dd4d710fd2811238e;
final release source cac78216a803b5e287fa5c92ad0270226caf35e1.
Evidence: 235 package tests, package build, publint, ATTW, packed ESM,
CommonJS, and TypeScript consumers; final Node 22/24 CI; and clean external
registry verification of the immutable npm package.
Current distribution: `@fiberlatch/access@0.1.1` is publicly available through
npm. The 0.1.1 runtime JS, declarations, and source maps were byte-identical
to 0.1.0 before publication. Remaining limitations: it requires Node
>=22.12.0, is native ESM with supported require(esm), has no browser support,
and ships no production database adapter.
Registry state at closeout: `latest` is `0.1.1`; published versions are
`0.1.0` and `0.1.1`. The release source commit is
`cac78216a803b5e287fa5c92ad0270226caf35e1`.

## 11. Paid-resource example

The example at [examples/paid-resource](../examples/paid-resource) shows the
host integration boundary with server-side demo data. It keeps raw receipt
tokens out of the demonstration store, registers trusted authority, checks
bindings, atomically consumes one use, serves content once, and denies replay.

Artifact commit: e06ad183f25fd35ea7570914ad38bf695940d6f3.
Evidence: 12 tests, automated first-use/replay demonstration, packed
paid-resource acceptance, exactly-one-of-two single-process concurrency proof,
Node 22/24 CI run 31093114518, and an independent focused integration review
with result APPROVE / READY TO COMMIT.
Limitations: the payment fixture is not a Fiber payment; the store is an
in-memory demonstration, not durable multi-process replay protection; no
hosted service or production payment integration is included.

## 12. Documentation and final verification

The final closeout records include the reviewer verification guide, this final
report, the changelog, the grant ledger, and the reconciled package-design and
SDK-boundary records. The omission/red-team review corrected stale historical
planning statements without changing the package boundary or runtime.

Final Weeks 5-6 evidence includes the public npm distribution, adopter-facing
README cleanup, packed consumer validation, clean external registry
installability, formal specification reconciliation, final `0.1.1` patch
release, and final registry verification. The final package source commit
`cac78216a803b5e287fa5c92ad0270226caf35e1` passed [master CI run
32457825277](https://github.com/Ticoworld/fiber-latch/actions/runs/32457825277)
and [grant-branch CI run
32457829076](https://github.com/Ticoworld/fiber-latch/actions/runs/32457829076),
including Node 22 and Node 24, backend tests/build, access-package
verification, and paid-resource verification.

The separate registry-only consumer installed `@fiberlatch/access@0.1.1`
directly from npm and passed package-root ESM, CommonJS, and TypeScript checks;
claim construction, Ed25519 signing, verification, trusted bindings, first
redemption, and replay denial as `receipt_exhausted`. It used no workspace
files and confirmed that no repository-only development scripts were exposed
by the installed package.

## 13. Public API summary

The package-root runtime operations are:

- buildAccessReceiptClaims: validate and canonicalize receipt claims.
- createAccessReceiptSigner: configure a trusted Ed25519 private key and
  return a signer.
- createAccessReceiptVerifier: configure trusted Ed25519 public keys, issuer,
  and audience and return a verifier.
- evaluateAccessReceiptBindings: compare verified claims to trusted host
  subject/resource/policy/intent context and an optional redemption limit.
- redeemAccessReceipt: verify, evaluate bindings, and call one host-owned
  atomic consume operation.

The type-only AccessReceiptStore contract accepts a narrow trusted consume
command and returns typed outcomes for consumption, missing, revoked,
exhausted, expired, authority mismatch, concurrency conflict, or system
failure. It is a contract, not a shipped production adapter.

## 14. Host responsibility boundary

The host must establish payment trust, link payment to the intended access,
own users and policies, supply trusted bindings, keep receipt state in trusted
storage, implement atomic consumption, manage revocation and expiry state, and
make the final protected-resource decision. `payment_ref` is a reference only,
not payment proof. Package verification and redemption perform no Fiber RPC.

The architecture flow is:

~~~text
trusted host payment result
→ build claims
→ sign receipt
→ present receipt
→ verify
→ evaluate bindings
→ atomically consume through host store
→ serve or deny resource
~~~

## 15. Package-distribution proof

The final package is published to npm as `@fiberlatch/access@0.1.1`. The 0.1.1
patch refreshed the adopter README and removed repository-only development
scripts from the published manifest. Runtime JS, declarations, source maps,
public API, and dependencies remained unchanged from 0.1.0. The repository
builds it, runs package-level tests, runs publint and ATTW, and exercises
external ESM, CommonJS, and TypeScript consumers. The paid-resource acceptance
packs the package locally, installs that tarball into a copied clean consumer,
checks for source/distribution imports, and reruns the example tests and demo.

The final registry-only consumer independently installed the immutable 0.1.1
artifact from npm and complements the local packed-boundary proof.

## 16. Paid-resource proof

The example uses the identifier demo-payment-001 in private server-side demo
data. A client cannot mark an arbitrary payment as verified. Once the
fixture is accepted, the host builds and signs claims, registers trusted
authority, and uses the package to verify bindings and consume access.

The first protected request succeeds. A second request with the same receipt is
denied. Two simultaneous single-use attempts in the demonstration store yield
exactly one success and one denial within one process. None of these statements
turns the fixture into a Fiber payment or supplies distributed persistence.

## 17. Testing and CI evidence

The required local reviewer path is:

~~~sh
npm ci
npm run verify:access:grant
~~~

The final focused evidence is:

- 57 historical backend tests and backend build
- 235 access-package tests and package build
- publint and ATTW
- packed ESM/CommonJS/TypeScript consumer checks
- 12 paid-resource example tests
- automated example success/replay demonstration
- packed paid-resource acceptance
- registry-only external ESM/CommonJS/TypeScript and functional consumer checks

Final package release source: `cac78216a803b5e287fa5c92ad0270226caf35e1`.
Master CI run [32457825277](https://github.com/Ticoworld/fiber-latch/actions/runs/32457825277)
and grant-branch CI run [32457829076](https://github.com/Ticoworld/fiber-latch/actions/runs/32457829076)
both passed Node 22 and Node 24, backend tests/build, access-package
verification, and paid-resource verification.

## 18. Security properties

The delivered package and specifications provide these bounded properties:

- Ed25519 EdDSA signing and verification through the package boundary.
- Trusted issuer, audience, key identity, protected header, and required-claim
  checks.
- Expiration and not-before validation with bounded configuration.
- Bounded token input and safe verification denial.
- Unknown payload claims are not returned as trusted package claims.
- No token-controlled key retrieval, alg none, or payment-network call in
  ordinary verification/redemption.
- Binding checks cover subject, resource, policy, intent, and optional
  redemption-limit context.
- Redemption passes only verified authority to one host-owned atomic consume
  operation.
- Persistence or uncertain store failures deny access.
- Demonstration output does not print receipt tokens or signing keys.

These properties depend on the host supplying trusted context and a correct
trusted store. A signed receipt alone is not replay protection.

## 19. Known limitations

- No production database adapter is shipped.
- Process-local memory is not distributed replay protection.
- No payment implementation, Fiber RPC client, or hosted service is included
  in the package path.
- The paid-resource fixture is not a real Fiber payment.
- No browser support is included.
- No production-readiness or mainnet claim is made.
- No formal security audit is claimed.
- No long-term maintenance commitment is included.
- The host remains responsible for payment trust, persistence, concurrency,
  revocation, and final resource enforcement.

## 20. Deviations from proposal

No feature or scope expansion was added. The delivery follows the proposal's
seven deliverables and six-week structure, with hosting cost kept at $0.

The proposal describes an open-source package. This repository-distributed
package is ISC-licensed and is publicly available on npm as
`@fiberlatch/access@0.1.1`; the 0.1.1 publication is a distribution and
onboarding improvement, not a production-readiness claim. The example
uses clearly labelled server-side demo data to prove the access pattern; it
does not claim a new live Fiber payment and does not repeat the historical live
proof as grant work.

The proposal's exclusions remain intact: no hosted service, payment SDK,
dashboard, CLI, frontend, production/mainnet guarantee, formal security audit,
or long-term maintenance commitment.

## 21. Reproduction instructions

From a clean checkout of the reviewed branch:

~~~sh
npm ci
npm run verify:access:grant
npm run test:access
npm run test:access:example
npm run demo:access:example
npm run verify:access:package
npm run verify:access:example
git diff --check
~~~

The focused commands may repeat work from the final acceptance command. That
duplication is intentional for reviewer traceability. Do not run npm audit fix;
it is outside this review.

## 22. Repository evidence index

- [Root README](../README.md)
- [Reviewer quickstart](../QUICKSTART.md)
- [Reviewer verification guide](fiberlatch-access-verification.md)
- [Package README](../packages/access/README.md)
- [Paid-resource example README](../examples/paid-resource/README.md)
- [Grant ledger](fiberlatch-access-grant-ledger.md)
- [Scope and design](fiberlatch-access-scope.md)
- [Receipt format](fiberlatch-access-receipt-format.md)
- [Expiration and replay](fiberlatch-access-expiration-replay.md)
- [Signing and verification](fiberlatch-access-signing-verification.md)
- [Package design](fiberlatch-access-package-design.md)
- [Approved proposal](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414)
- [Weeks 1–2 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/4?u=ticoworld)
- [Node package CI run 31078601378](https://github.com/Ticoworld/fiber-latch/actions/runs/31078601378)
- [Paid-resource CI run 31093114518](https://github.com/Ticoworld/fiber-latch/actions/runs/31093114518)

## 23. Conclusion

FiberLatch Access now has a reviewable package boundary, reproducible local
packed-distribution proof, a public `@fiberlatch/access@0.1.1` release, a clean
registry-only external consumer verification, a focused paid-resource
demonstration, explicit security and host-responsibility limits, and an
evidence map for all seven approved deliverables. Technical and documentation
delivery is complete. The final public Nervos completion post has not yet been
submitted and is the next administrative action.
