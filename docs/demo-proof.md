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

What remains blocked:
- live Fiber testnet proof
- a real Fiber testnet endpoint
- a real paid Fiber `payment_hash`
- any endpoint-specific auth requirements, if applicable

Honest claim:
FiberLatch can prove its local receipt lifecycle end to end.
FiberLatch also has a Fiber v0.8.1-aligned real adapter contract.

Blocked claim:
FiberLatch verifies real Fiber testnet payments.

Next proof needed:
Run `scripts/fiber-testnet-verify.ts` against a real Fiber testnet endpoint with a real paid `payment_hash` and record the sanitized result.
