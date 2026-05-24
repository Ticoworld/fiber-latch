# Phase 2D Report: Public Fiber Node Proof Attempt

Date: 2026-05-24

Scope: proof work only. No product features, UI, dashboard, checkout, POS, creator tooling, merchant tooling, receipt-signing changes, redemption changes, or public API expansion were added.

## Endpoints Tested

- `http://18.162.235.225:8227`
- `http://18.163.221.211:8227`

Official references checked:

- Fiber public-node guide: https://www.fiber.world/docs/quick-start/connect-nodes
- Fiber public nodes manual: https://github.com/nervosnetwork/fiber/blob/develop/docs/public-nodes.md
- Fiber RPC reference: https://github.com/nervosnetwork/fiber/blob/develop/crates/fiber-lib/src/rpc/README.md

## Commands Run

- `git status --short`
- `git log --oneline -5`
- inspected:
  - `scripts/fiber-testnet-verify.ts`
  - `src/integrations/fiber/real-fiber-client.ts`
  - `src/integrations/fiber/fiber-status-mapper.ts`
  - `src/config/runtime.ts`
  - `src/config/fiber-client.ts`
  - `docs/live-fiber-next-steps.md`
  - `docs/live-fiber-verification-blocker.md`
- JSON-RPC `node_info` against both public nodes using Node `fetch`
- JSON-RPC `new_invoice` against `http://18.163.221.211:8227`
- JSON-RPC `get_invoice` against `http://18.163.221.211:8227` using the in-memory `payment_hash` from invoice creation
- adapter-level in-memory proof using `createRealFiberClient().createInvoice()` and `verifyPayment()` against `http://18.163.221.211:8227`
- `npm test`
- `npm run build`
- `npm run demo:local-access`

## Sanitized Outputs

`node_info` on `http://18.162.235.225:8227`:

```json
{
  "httpStatus": 200,
  "version": "0.8.1",
  "commit_hash": "b560023 2026-04-16",
  "node_name": "CkbaNode-1",
  "pubkey": "02b6d4e3...302be71",
  "channel_count": "0xf",
  "pending_channel_count": "0x0",
  "peers_count": "0xa"
}
```

`node_info` on `http://18.163.221.211:8227`:

```json
{
  "httpStatus": 200,
  "version": "0.8.1",
  "commit_hash": "b560023 2026-04-16",
  "node_name": "CkbaNode-2",
  "pubkey": "0291a657...912fcc",
  "channel_count": "0xc",
  "pending_channel_count": "0x0",
  "peers_count": "0x8"
}
```

Direct `new_invoice` plus `get_invoice` on `http://18.163.221.211:8227`:

```json
{
  "createInvoice": {
    "httpStatus": 200,
    "hasError": false,
    "invoiceAddress": "fibt11pms3...spuu70pm",
    "paymentHash": "0x69983f79...8aa14080",
    "invoiceCurrency": "Fibt",
    "invoiceAmount": "0x1",
    "hasInvoiceObject": true
  },
  "getInvoice": {
    "httpStatus": 200,
    "hasError": false,
    "status": "Open",
    "invoiceAddress": "fibt11pms3...spuu70pm",
    "paymentHash": "0x69983f79...8aa14080",
    "invoiceCurrency": "Fibt",
    "invoiceAmount": "0x1"
  },
  "mapperExpectation": {
    "normalizedState": "payment_pending",
    "shouldIssueReceipt": false
  }
}
```

Adapter-level proof against `http://18.163.221.211:8227`:

```json
{
  "adapterCreateInvoice": {
    "invoiceAddress": "fibt11pmqn...gq885vrl",
    "paymentHash": "0x88d42331...283907b1",
    "invoiceStatus": "UNKNOWN",
    "rawStatus": null
  },
  "adapterVerifyPayment": {
    "paymentHash": "0x88d42331...283907b1",
    "verified": false,
    "invoiceStatus": "UNPAID",
    "rawStatus": "Open",
    "invoiceAddress": "fibt11pmqn...gq885vrl",
    "settledAt": null,
    "lastUpdatedAt": null,
    "failedError": null,
    "fee": null
  }
}
```

## RPC Reachability Result

Both documented public testnet RPC endpoints were reachable over JSON-RPC and returned HTTP 200 for `node_info`.

The first PowerShell `Invoke-WebRequest` attempts failed locally with `Object reference not set to an instance of an object`; Node `fetch` confirmed this was a PowerShell/client issue, not a public-node reachability issue.

## Invoice Creation Result

`new_invoice` succeeded on `http://18.163.221.211:8227` using official v0.8.1 shape:

- method: `new_invoice`
- params: array containing one object
- fields: `amount`, `currency`, `description`, `expiry`
- amount: `0x1`
- currency: `Fibt`

This created unpaid invoices only. No payment was attempted or claimed.

## payment_hash Result

`payment_hash` was returned nested under `invoice.data.payment_hash`. The direct result did not need a top-level `payment_hash`.

FiberLatch's current real adapter already handles this nested location through `readPaymentHash()`.

## get_invoice Result

`get_invoice` succeeded on the same public node using the in-memory `payment_hash`.

- status: `Open`
- normalized FiberLatch mapper state: `payment_pending`
- FiberLatch receipt issuance: `false`
- FiberLatch adapter verification result: `verified: false`, `invoiceStatus: "UNPAID"`, `rawStatus: "Open"`

## Paid Verification Result

Paid was not reached.

No real paid payment was made. No real paid `payment_hash` was verified. No FiberLatch receipt issuance was driven by a paid Fiber result.

## Local Validation Result

- `npm test`: passed, 3 test files, 32 tests
- `npm run build`: passed
- `npm run demo:local-access`: passed, first redemption `GRANTED`, second redemption `DENIED`

## Mapper/Adapter Findings

- The public nodes report Fiber `0.8.1`, matching the adapter target.
- The official-shaped `new_invoice` call works without `payment_preimage` or `hash_algorithm`.
- The invoice response shape includes `invoice_address` and nested `invoice.data.payment_hash`; the adapter already supports that.
- `get_invoice` returns `status: "Open"` for an unpaid invoice.
- `mapFiberRawStatus("Open")` correctly maps to pending/unpaid and does not issue receipts.
- No core adapter contract mismatch was found.

## Files Changed

- `docs/live-fiber-attempt.md`
- `docs/live-fiber-verification-blocker.md`

## What Is Now Proven

- The documented public Fiber testnet RPC endpoints are reachable from this workspace.
- Public nodes respond to official JSON-RPC `node_info`.
- A public node accepts official v0.8.1-shaped `new_invoice` with `amount`, `currency`, `description`, and `expiry`.
- A public node returns an encoded invoice and nested `payment_hash`.
- A public node accepts `get_invoice(payment_hash)` for the created invoice.
- FiberLatch's real adapter can create an invoice and query it on a public Fiber testnet node.
- FiberLatch correctly refuses receipt issuance for `Open`.

## What Is Still Not Proven

- FiberLatch has not verified a real paid Fiber payment.
- FiberLatch has not issued a signed access receipt as a consequence of a real paid Fiber payment.
- Public-node reachability does not prove payer-side routing, channel readiness, liquidity, or settlement.
- No safe public-node-only payment path was proven.

## Exact Remaining Blocker

The remaining blocker is a real paid Fiber testnet `payment_hash` from a payment that can be safely made and then verified by FiberLatch, with the paid result driving FiberLatch receipt issuance.

Official docs indicate actual payment requires a payer node/wallet path with channel setup, `ChannelReady`/`CHANNEL_READY`, route availability, and sufficient liquidity. This workspace has not established or funded a local Fiber payer node/channel, so paid verification must stop here.

## Safe Week 10 Wording

FiberLatch has a backend-only signed receipt lifecycle and a Fiber v0.8.1-aligned adapter. In Phase 2D, it reached official public Fiber testnet nodes, created unpaid public-node invoices, queried them by `payment_hash`, and correctly refused receipt issuance while the invoice status was `Open`.

## Claims Still Forbidden

- FiberLatch verifies real Fiber payments.
- FiberLatch has completed a paid Fiber testnet payment.
- FiberLatch issues receipts from live paid Fiber payments.
- FiberLatch is production-ready for Fiber payment verification.
- Public-node invoice creation proves paid settlement.

## Final PM Recommendation

CONDITIONAL GO for the next proof step only.

Next step should be a paid-payment proof with a real Fiber payer setup: local/test wallet or node, documented channel setup, `ChannelReady`/`CHANNEL_READY`, sufficient liquidity, actual payment, then FiberLatch verification of the resulting paid `payment_hash`. Do not broaden product scope until that proof exists.
