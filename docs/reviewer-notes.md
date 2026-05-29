# Reviewer Notes

Start here:
- [`QUICKSTART.md`](../QUICKSTART.md)
- [`README.md`](../README.md)
- [`docs/api-contract.md`](api-contract.md)
- [`docs/state-machine.md`](state-machine.md)
- [`docs/demo-proof.md`](demo-proof.md)

What is proven:
- the local receipt lifecycle works end to end
- access intents persist
- signed receipts are issued and verified
- JWKS is served
- redemption is atomic
- duplicate redemption is rejected
- reconciliation can issue a single receipt from the fake Fiber path

What is aligned but not live-proven:
- the real Fiber adapter matches the official Fiber v0.8.1 RPC method names, params shape, and status vocabulary

What is simulated:
- Fiber payment resolution
- paid/unpaid/failed/expired status signals
- the local demo payment success path

What live Fiber proof achieved:
- a real Fiber testnet endpoint was reached
- a real paid Fiber `payment_hash` was verified
- a sanitized live verification run was completed
- testnet-only proof is now complete

Why this does not overlap Spindle, checkout, POS, or creator tooling:
- FiberLatch does not sell anything
- FiberLatch does not collect payment at checkout
- FiberLatch does not manage merchant operations
- FiberLatch does not expose creator workflows
- FiberLatch only verifies payment state and issues access receipts for a specific resource and subject
