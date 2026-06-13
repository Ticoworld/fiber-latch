# FiberLatch Quickstart

FiberLatch is a backend-only service that turns a verified payment signal into a signed access receipt for a specific resource and subject.

What this repo proves locally:
- persisted access intents
- signed JWT/JWS access receipts
- JWKS publication
- atomic redemption
- fake Fiber-driven reconciliation
- local end-to-end demo flow

What this repo proves from a live Fiber testnet payment:
- live paid Fiber payment_hash verified through Fiber v0.8.1 RPC
- signed access receipt issued from a live paid signal
- receipt verified, redeemed once, and rejected on second redemption
- tagged at `fiberlatch-live-paid-proof`

This is testnet-only proof. Production and mainnet readiness are not proven.

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

## Live Fiber Proof

Live paid Fiber testnet verification is proven. See the tagged commit `fiberlatch-live-paid-proof`.

What was done:
- local `fnn` v0.8.1 ran with a funded testnet account and a `ChannelReady` channel to public node1
- a tiny testnet payment (1,000 shannons) was routed through public node1 to a public node2 invoice via trampoline
- the node2 invoice reached `Paid`
- `demo-live-paid-issuance.ts` ingested the paid `payment_hash`, created an `AccessIntent`, issued a signed `AccessReceipt`, verified it, and confirmed second redemption is denied

To rerun a fresh live proof, you need:
- a local `fnn` node with a funded testnet account
- a live `ChannelReady` channel to public node1
- a fresh node2 invoice paid via trampoline
- `FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=<node2 url> FIBER_MANUAL_PAYMENT_HASH=<paid hash> npm run demo:live-paid-issuance`

See:
- [`docs/live-fiber-verification-blocker.md`](docs/live-fiber-verification-blocker.md)
