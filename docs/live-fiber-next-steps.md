# Live Fiber Next Steps

Required env vars for a live test:
- `FIBER_CLIENT_MODE=real`
- `FIBER_NETWORK=testnet`
- `FIBER_RPC_URL`
- `FIBER_RPC_AUTH_TOKEN` if the endpoint or proxy requires auth
- `FIBER_MANUAL_PAYMENT_HASH` for verification mode
- `FIBER_MANUAL_PAYMENT_REF` only as a legacy alias, and only when it contains the same Fiber `payment_hash`
- `FIBER_MANUAL_AMOUNT_SATS` for invoice creation mode
- `FIBER_MANUAL_MEMO` when creating an invoice

Live test commands:
- verify an existing paid Fiber `payment_hash`:
  - `FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=... FIBER_MANUAL_PAYMENT_HASH=... npm run fiber:testnet:verify`
- create a test invoice:
  - `FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=... FIBER_MANUAL_AMOUNT_SATS=... FIBER_MANUAL_MEMO="FiberLatch live test" npm run fiber:testnet:verify`

Expected safe failure modes:
- missing env vars cause an immediate explicit error
- both manual operation envs set at once causes a refusal
- no raw auth token or private key is printed
- unknown Fiber statuses do not issue receipts
- network or auth failures stop the run without exposing secrets

What would count as proof:
- a sanitized run against a real Fiber testnet endpoint
- a response that succeeds against the Fiber v0.8.1-aligned adapter contract
- a resulting receipt lifecycle that can be traced without leaking secrets

What would not count as proof:
- a fake adapter run
- a local-only demo run
- a run that never reaches the real Fiber endpoint
- adapter alignment without a real paid `payment_hash`
