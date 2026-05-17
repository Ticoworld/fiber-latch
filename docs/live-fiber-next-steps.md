# Live Fiber Next Steps

Required env vars for a live test:
- `FIBER_CLIENT_MODE=real`
- `FIBER_NETWORK=testnet`
- `FIBER_RPC_URL`
- `FIBER_RPC_AUTH_TOKEN` if the endpoint requires auth
- `FIBER_MANUAL_PAYMENT_REF` for verification mode
- `FIBER_MANUAL_AMOUNT_SATS` for invoice creation mode
- `FIBER_MANUAL_MEMO` when creating an invoice

Live test commands:
- verify an existing payment reference:
  - `FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=... FIBER_MANUAL_PAYMENT_REF=... npm run fiber:testnet:verify`
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
- a response that matches the adapter assumptions well enough to verify or create a payment signal
- a resulting receipt lifecycle that can be traced without leaking secrets

What would not count as proof:
- a fake adapter run
- a local-only demo run
- a run that never reaches the real Fiber endpoint
