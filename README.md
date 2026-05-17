# FiberLatch

FiberLatch is a backend-only service that turns a payment verification signal into a signed access receipt for unlocking content, files, or API access.

Current proof status:
- Local access receipt lifecycle is proven end to end.
- Live Fiber testnet verification is not proven yet.

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
- It does not prove live Fiber testnet verification.
