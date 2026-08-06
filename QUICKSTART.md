# FiberLatch Quickstart

Use the first path to review the completed FiberLatch Access grant delivery.
The historical backend path is kept separate so prior foundation is not
mistaken for grant-funded package work.

## 1. FiberLatch Access grant review path

### Supported environment

- Node.js `>=22.12.0`
- npm with workspace support
- native ESM for the access package
- supported CommonJS consumers through Node `require(esm)`
- no browser runtime

From the repository root, run the clean-install acceptance:

```sh
npm ci
npm run verify:access:grant
```

`verify:access:grant` runs the backend Prisma generation, backend tests and
build, package tests/build/distribution checks, and the paid-resource example
including packed acceptance. It intentionally does not include `npm ci`; the
clean installation remains an explicit reviewer step.

Expected evidence from the current committed baseline:

- 235 `@fiberlatch/access` package tests
- 57 historical backend tests
- 12 paid-resource example tests
- package build
- `publint` package validation
- ATTW type-entry validation
- packed ESM consumer
- packed CommonJS consumer
- packed TypeScript consumer
- packed paid-resource acceptance
- first access succeeds
- replay of the same receipt is denied

The checks prove behaviour and distribution boundaries without promising any
particular number of npm installation packages.

### Focused commands

```sh
npm run test:access
npm run verify:access:package
npm run test:access:example
npm run demo:access:example
npm run verify:access:example
```

The package is private and unpublished. The distribution checks build and pack
it locally, then exercise clean consumers from the generated tarball.

The paid-resource example accepts a server-owned demonstration fixture. It is
not a real Fiber payment and does not call Fiber RPC. Its automated flow issues
one receipt, grants the first protected request, and denies replay.

For the complete operational walkthrough, see
[`docs/fiberlatch-access-verification.md`](docs/fiberlatch-access-verification.md).

## 2. Historical FiberLatch backend path

This path covers the existing Fastify/Prisma backend foundation. It is retained
for context and regression evidence; it is not the grant package installation
path.

### Install and local environment

```sh
npm ci
npm run prisma:generate
```

Create a local `.env` from the example and use the fake adapter for local work:

```powershell
Copy-Item .env.example .env
```

Minimum local settings:

- `DATABASE_URL=file:./dev.db`
- `FIBER_CLIENT_MODE=fake`
- `FIBER_NETWORK=testnet`

### Backend regression and demos

```sh
npm test
npm run build
npm run demo:local-access
npm run demo:protected-resource
```

The local demo creates an intent, issues a signed receipt, grants the first
redemption, and denies the second. The fake Fiber adapter is only a local test
fixture; it does not represent a real Fiber payment.

### Historical live Fiber proof

The prior live proof is testnet-only historical evidence. It used a local
Fiber v0.8.1 node, a funded testnet account, a ready channel, a real tiny
testnet payment, and `payment_hash` verification through Fiber RPC.

To rerun that proof, a reviewer must provide a fresh, externally funded setup:

- a local `fnn` v0.8.1 node with a funded testnet account
- a live `ChannelReady` channel to a public node
- a fresh public invoice that has actually been paid
- `FIBER_CLIENT_MODE=real`
- `FIBER_NETWORK=testnet`
- `FIBER_RPC_URL=<node url>`
- `FIBER_MANUAL_PAYMENT_HASH=<paid hash>`

Then run:

```sh
FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=<node url> FIBER_MANUAL_PAYMENT_HASH=<paid hash> npm run demo:live-paid-issuance
```

See [`docs/live-fiber-verification-blocker.md`](docs/live-fiber-verification-blocker.md)
for the historical proof boundary and remaining limits. Do not treat this
backend proof as the paid-resource example's payment evidence.
