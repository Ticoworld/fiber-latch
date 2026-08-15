# FiberLatch Access paid-resource example

This complete runnable native-HTTP integration example shows how an app can use
`@fiberlatch/access` to protect one paid resource:

1. the app confirms a demo payment in server-side test data
2. the app creates trusted single-use receipt claims
3. FiberLatch signs the receipt
4. the client uses the receipt to request the protected article
5. FiberLatch checks the receipt against the expected user and resource
6. the app's store records one use as one atomic operation
7. the app serves the protected article
8. reusing the same receipt is denied

The example is deliberately small and uses only Node's built-in modules plus
the workspace `@fiberlatch/access` package.

For the supported external package installation path and a minimal
package-root API walkthrough, see
[`packages/access/README.md`](../../packages/access/README.md). This example
is the full executable learning path, including the server-side payment demo,
receipt store, protected-resource boundary, replay denial, and single-process
concurrency proof.

## What this does not demonstrate

It does not perform real payment verification, call Fiber RPC, provide a
production database, protect multiple processes, persist state across restarts,
provide a frontend, or host a public service. The payment fixture is a clear
stand-in for a real host integration, not proof of a live payment.

## Architecture

`POST /receipt` accepts only the identifier `demo-payment-001`. The server
looks that identifier up in its private server-side record for a payment the
app already trusts. It does not
accept client-supplied payment details or allow a client to mark a payment as
verified.

After the fixture is accepted, the host builds claims for `demo-user`,
`demo-intent-001`, `premium-article`, and `single-use-access`. The package
signer and verifier use an Ed25519 key pair generated in memory at startup.
The private JWK is never written or logged.

`GET /resource` reads `Authorization: Bearer <receipt>`. The host supplies the
expected binding context to `redeemAccessReceipt`. Only a successful package
result produces the protected article. Verification, binding, consumption, and
system failures return generic denial responses.

The demonstration store retains only trusted receipt authority and app state:
receipt identity, signed authority, expiry, revocation, redemption count, and
exhaustion. It never stores the raw receipt token.

## Prerequisites and commands

Use Node.js `>=22.12.0` from the repository root.

```sh
npm ci
npm run test:access:example
npm run demo:access:example
npm run verify:access:example
```

`npm run verify:access:example` builds the access package, runs the example
tests and demo, installs a packed copy of `@fiberlatch/access` into a temporary
clean consumer, reruns the tests and demo there, and removes the temporary
directory and tarball.

The automated demo prints:

```text
payment fixture accepted
receipt issued
first protected access allowed
second use denied
demo passed
```

The receipt itself and all signing keys remain out of the demo output.

## Manual HTTP flow

Start the example server in one terminal:

```sh
node examples/paid-resource/src/server.mjs
```

The server prints its actual listening URL and port on startup. Substitute
that URL for `PORT` in the curl examples below.

Request a receipt using the server-side demo record:

```sh
curl -s -X POST http://127.0.0.1:PORT/receipt \
  -H "content-type: application/json" \
  -d '{"payment_fixture_id":"demo-payment-001"}'
```

Use the returned receipt in the protected request. Replace `<receipt>` with
the value returned by the previous command; no private key is involved:

```sh
curl -i http://127.0.0.1:PORT/resource \
  -H "Authorization: Bearer <receipt>"
```

The first request returns the premium article. Repeating it with the same
receipt returns a generic `403` denial without the article.

## Limitations and host replacement points

- Replace `verifyPaymentFixture` with the host's trusted payment-verification
  integration. The host must establish payment trust before issuing claims;
  `payment_ref` is a reference to the payment record, not payment proof.
- Replace `DemoAccessReceiptStore` with a durable app-owned store that checks
  and updates use as one atomic operation for production use. Its process-local
  memory disappears on restart and does not protect replay across multiple
  server processes.
- Methods whose names end in `ForTest` are demonstration test affordances, not
  a recommendation for a production store API.
- The example's synchronous check-and-update transition proves the atomic
  semantic boundary only within one Node process. The concurrency test shows
  that two simultaneous single-use attempts produce one success and one denial.
- The host remains responsible for the final protected-resource decision and
  for keeping denial responses free of receipt, claim, key, and store details.

The example has no production-readiness, mainnet, hosting, or formal-audit
claim.
