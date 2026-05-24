# FiberLatch Quickstart

FiberLatch is a backend-only service that turns a verified payment signal into a signed access receipt for a specific resource and subject.

What this repo proves locally:
- persisted access intents
- signed JWT/JWS access receipts
- JWKS publication
- atomic redemption
- fake Fiber-driven reconciliation
- local end-to-end demo flow

What this repo does not prove yet:
- live Fiber testnet verification
- receipt issuance from a live paid Fiber payment

## Install

```bash
npm install
```

## Env Setup

Create a local `.env` from the example:

```bash
Copy-Item .env.example .env
```

Minimum local settings:
- `DATABASE_URL=file:./dev.db`
- `FIBER_CLIENT_MODE=fake`
- `FIBER_NETWORK=testnet`

If you want to review the live-test path later, also set:
- `FIBER_RPC_URL`
- `FIBER_RPC_AUTH_TOKEN` if your Fiber endpoint or proxy requires it
- `FIBER_MANUAL_PAYMENT_HASH` for live verification by Fiber `payment_hash`
- `FIBER_MANUAL_PAYMENT_REF` only as a legacy alias for the same `payment_hash`

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Local Demo

```bash
npm run demo:local-access
```

Expected demo summary:
- one access intent is created locally
- the reconciliation worker issues exactly one signed receipt
- receipt verification succeeds
- first redemption is granted
- second redemption is denied
- the stored receipt becomes exhausted after the first redemption

## Live Fiber Blocker

Live Fiber testnet verification is still blocked until a real public-node payment reaches `Paid`.
Public Fiber testnet RPC contact is proven, and the real adapter is aligned to official Fiber v0.8.1 RPC shape, but that is not paid proof.

Current payment blocker:
- local `fnn` v0.8.1 runs with a funded testnet account
- the local channel to public node1 reached `ChannelReady`
- public node2 invoice creation and `get_invoice(payment_hash)` work
- automatic `send_payment` failed with `PathFind error: no path found`
- `send_payment` with `trampoline_hops` through node1 failed with `max outbound liquidity 0`
- node2 invoices remained `Open`

See:
- [`docs/live-fiber-verification-blocker.md`](docs/live-fiber-verification-blocker.md)
- [`docs/live-fiber-next-steps.md`](docs/live-fiber-next-steps.md)
