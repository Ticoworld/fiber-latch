# Demo Proof

This demo proves the local FiberLatch receipt lifecycle end to end using the fake Fiber adapter and local SQLite.

What the demo proves:
- an access intent can be created locally
- the fake Fiber adapter can report a paid state
- the reconciliation worker can issue exactly one signed receipt
- the receipt can be verified through the public verification route
- the receipt can be redeemed once
- a second redemption is rejected
- the JWKS and receipt-signing path still work in the same flow

Timing note:
- the demo prints the receipt state as `ISSUED` immediately after issuance
- after the first redemption, the stored receipt becomes exhausted and `active` becomes `false`
- the demo summary shows both moments so the lifecycle is explicit

What is real:
- Fastify route handling
- Prisma persistence
- signed JWT receipt issuance
- JWKS publication
- receipt verification
- redemption enforcement
- reconciliation worker behavior

What is fake:
- the Fiber payment source
- the Fiber status signal
- the local payment success in the demo

What remains unproven:
- production readiness
- mainnet readiness
- routing for large payment amounts

Honest claim:
FiberLatch proves its local receipt lifecycle end to end.
FiberLatch also proves a full testnet path: a live paid Fiber `payment_hash` was verified through Fiber v0.8.1 RPC, converted into a signed access receipt, verified, redeemed once, and rejected on second redemption.
This is testnet-only proof. See `scripts/demo-live-paid-issuance.ts` and the tagged commit `fiberlatch-live-paid-proof`.
