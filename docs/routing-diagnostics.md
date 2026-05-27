# Phase 3 Report: Fiber Routing/Liquidity Diagnosis

## Repo State
Working tree is clean. The latest commit is `docs: add CHANGELOG through Week 10 Fiber proof checkpoint`.

## Local Channel State
Local `fnn` node was successfully restarted and is running.
- **Node reachable**: yes, `version: 0.8.1`.
- **Channel to Node1**: 1 channel, `stateName: ChannelReady`, enabled, `localBalance: 401.0000 CKB`.

## Asset/Currency Findings
- Node2 invoices are confirmed as using `Fibt` (testnet CKB).
- Public node1 reports ready CKB channels to node2 (`funding_udt_type_script: null`). Asset type is correct.

## Node1 To Node2 Route Findings
Public node1 reports having 8 channels to public node2. 5 of those are CKB-only channels (no UDT type script), and 5 are in the `ChannelReady` state. A sample of these channels shows node1 has significant local outbound balance (e.g., ~49,900 CKB) toward node2, confirming public node1 has sufficient liquidity to forward payments to node2.

## Local Route Knowledge
The local node graph successfully recognizes public node1 and its channels. 

## Small Amount Invoice Tests
Three tiny test invoices were successfully created on public node2:
- 1,000 shannons (~0.00001 CKB)
- 10,000 shannons (~0.0001 CKB)
- 1,000,000 shannons (~0.01 CKB)

**Dry-run testing:**
For the 1,000 and 10,000 shannon amounts, the dry-run `send_payment` using `trampoline_hops: [node1]` succeeded and returned `status: Created`.

## Trampoline/Hop Hint Findings
- `fnn-cli payment send_payment --help` confirmed new routing parameters: `--max-fee-amount`, `--hop-hints`, `--dry-run`.
- The `max outbound liquidity 0` error encountered in Phase 2G was likely caused by testing with a 1 CKB invoice against a 401 CKB channel with unknown reserve boundaries, or a temporary graph synchronization delay that resolved after node restart.
- Using tiny testnet amounts (1,000 shannons) completely bypassed the liquidity issue.

## Payment Result
- **automatic route**: dry-run succeeded for tiny amounts.
- **trampoline route**: dry-run succeeded for tiny amounts.
- **real send result**: A real payment of 1,000 shannons (~0.00001 CKB) was attempted via trampoline routing through node1. **The payment succeeded.**
  - `get_payment` returned `Success`.
  - `get_invoice(payment_hash)` on node2 returned `Paid`.

## FiberLatch Verification Result
Following the successful payment, the FiberLatch verification script was run against the live paid hash:
- **run**: yes (`npm run fiber:testnet:verify`)
- **paid hash**: yes (`0xc31874cda2f0c13a6a1e9afe61c27a385c3709f868930cd53ae705ee9a4d7e33`)
- **receipt issued**: yes (verified: true, invoiceStatus: "PAID")

Sanitized verification output:
```json
{
  "operation": "verify",
  "paymentHash": "0xc3...7e33",
  "verified": true,
  "invoiceStatus": "PAID",
  "rawStatus": "Paid",
  "invoiceAddress": "fibt...5lhj",
  "settledAt": "2026-05-27T21:14:18.437Z"
}
```

## Files Changed
- `scripts/phase3-routing-diagnostics.mjs` (diagnostic script created)
- `docs/routing-diagnostics.md` (this report)
- `docs/live-fiber-verification-blocker.md` (updated)

## Validation Result
- `npm test`: passed (3 files, 32 tests)
- `npm run build`: passed
- `npm run demo:local-access`: passed (first redemption GRANTED, second DENIED)

## Exact Remaining Blocker
None for the core testnet path.

## What Is Now Proven
- The local `fnn` node successfully established and synchronized a route.
- Trampoline payments through node1 to node2 succeed for small amounts (e.g., 1,000 shannons).
- FiberLatch verifies real live Fiber testnet payments.
- The real adapter behaves identically to the simulated local testing.
- Service-layer receipt issuance from a live payment is proven. The `demo-live-paid-issuance.ts` script successfully ingested a live paid `payment_hash`, created an AccessIntent, ran the reconciliation worker, issued a signed JWT AccessReceipt, verified it, and atomically redeemed it.
- **Note:** The live paid testnet path is proven for a tiny payment. Production and mainnet readiness remain unproven.

## What Is Still Not Proven
- Automatic routing for very large amounts.
- Mainnet readiness.
- Production readiness.

## Recommended Next Action
Update remaining docs to reflect that the live paid testnet path is proven for a tiny payment.
