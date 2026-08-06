# FiberLatch

FiberLatch is a backend-only reference project for turning a trusted payment
result into access to a protected resource. The repository now contains two
deliberately separate layers.

## Start with the grant review path

The reviewer-first entry point is [`QUICKSTART.md`](QUICKSTART.md). The
complete local acceptance path is:

```sh
npm ci
npm run verify:access:grant
```

This verifies the backend regression and build, the private `@fiberlatch/access`
package, its packed consumers, and the paid-resource example. The package is
not published to npm. It is built and packed locally so verification can cross
the package boundary in a clean consumer.

### Repository structure

| Layer | Contents | Status and boundary |
| --- | --- | --- |
| Historical FiberLatch backend foundation | Existing Fastify/Prisma backend, prior backend routes and demos, and the prior live paid Fiber testnet proof | Prior work; not funded again by this grant |
| FiberLatch Access grant delivery | Reusable Node package at [`packages/access`](packages/access), package-root API, paid-resource example at [`examples/paid-resource`](examples/paid-resource), specifications under [`docs`](docs), and reviewer evidence | Grant-funded access-control layer; private and unpublished |

### Current grant status

| Deliverable | Current status |
| --- | --- |
| D1 — scope and design | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D2 — receipt format | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D3 — expiration and replay rules | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D4 — signing and verification rules | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D5 — Node package | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D6 — paid-resource example | IMPLEMENTED — INDEPENDENTLY REVIEWED |
| D7 — documentation and final report | VERIFIED COMPLETE |

The complete delivery is ready for its public Nervos Talk completion report
and reviewer assessment.

Reviewer-first links:

- [`docs/fiberlatch-access-final-report.md`](docs/fiberlatch-access-final-report.md)
- [`docs/fiberlatch-access-verification.md`](docs/fiberlatch-access-verification.md)
- [`packages/access/README.md`](packages/access/README.md)
- [`examples/paid-resource/README.md`](examples/paid-resource/README.md)
- [`docs/fiberlatch-access-grant-ledger.md`](docs/fiberlatch-access-grant-ledger.md)
- [Approved proposal](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414)
- [Weeks 1–2 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/4?u=ticoworld)

## FiberLatch Access grant delivery

FiberLatch Access is a small, framework-independent Node package for the
application access boundary after a host has established payment trust. Its
package-root API builds claims, signs and verifies Ed25519 receipts, evaluates
bindings, and orchestrates redemption through a host-owned atomic store.

The grant package has these deliberate limits:

- It is private and has not been published to npm.
- It requires Node `>=22.12.0`.
- It is native ESM; supported CommonJS use relies on Node `require(esm)`.
- It has no browser support.
- It ships no production database adapter.
- Receipt verification and redemption make no Fiber RPC call.
- It does not perform payment verification, payment creation, or payment
  settlement.
- It makes no production, mainnet, or formal-audit claim.

The paid-resource example uses a server-owned payment fixture to demonstrate
the host boundary. That fixture is not a real Fiber payment.

## Historical FiberLatch backend foundation

The original FiberLatch backend remains in the repository as prior foundation:

- Fastify HTTP routes and Prisma persistence
- the historical local and fake-Fiber demos
- the prior live paid Fiber testnet proof
- the backend's signed-receipt and one-time-redemption reference flow

The live proof remains useful historical evidence: a real paid Fiber testnet
`payment_hash` was verified through Fiber v0.8.1 RPC, converted into a signed
receipt, redeemed once, and denied on reuse. It is not counted as grant-funded
package implementation, and it does not establish production or mainnet
readiness.

See the separately labelled [historical backend path](QUICKSTART.md#2-historical-fiberlatch-backend-path)
in the quickstart for its environment, test, demo, and live-proof instructions.
