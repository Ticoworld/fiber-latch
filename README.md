# FiberLatch

FiberLatch is a backend-only service that turns a payment verification signal into a signed access receipt for unlocking content, files, or API access.

Current proof status:
- Local access receipt lifecycle is proven end to end.
- Real Fiber adapter behavior is aligned to official Fiber v0.8.1 RPC shape.
- Public Fiber testnet RPC contact, invoice creation, and `get_invoice(payment_hash)` are proven.
- Local `fnn` v0.8.1 runs with a funded testnet account and a `ChannelReady` channel to public node1.
- A real public-node payment attempt was made; automatic routing failed with `no path found`, and trampoline routing through node1 failed with `max outbound liquidity 0`.
- Live Fiber testnet verification is not proven yet.
- Receipt issuance from a live paid Fiber payment is not proven yet.

Start here:
- [`QUICKSTART.md`](QUICKSTART.md)
- [`docs/reviewer-notes.md`](docs/reviewer-notes.md)
- [`docs/live-fiber-next-steps.md`](docs/live-fiber-next-steps.md)

What FiberLatch is:
- backend-only
- single-tenant
- testnet-first
- persistence-backed
- signed-receipt oriented

What FiberLatch is not:
- a checkout UI
- a creator platform
- a POS
- a merchant dashboard
- subscriptions
- refunds
- a generic payment gateway
- a raw Fiber RPC wrapper
- Spindle

Public routes:
- `GET /health`
- `POST /v1/access-intents`
- `GET /v1/access-intents/:id`
- `POST /v1/receipts/verify`
- `POST /v1/receipts/redeem`
- `GET /.well-known/jwks.json`

Local demo:
- `npm run demo:local-access`

Validation:
- `npm test`
- `npm run build`

Live Fiber blocker:
- [`docs/live-fiber-verification-blocker.md`](docs/live-fiber-verification-blocker.md)

Proof note:
- The local demo proves the receipt lifecycle using the fake Fiber adapter.
- The real Fiber adapter is aligned to Fiber v0.8.1 request and status shapes.
- Public-node invoice creation does not prove settlement.
- It does not prove live paid Fiber testnet verification.
