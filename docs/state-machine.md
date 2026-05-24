# State Machine

FiberLatch uses a narrow state machine for access intents and access receipts.

## Access intent states

- `PENDING_VERIFICATION`
  - the intent exists
  - Fiber verification has not resolved to paid yet
- `VERIFIED`
  - payment verification succeeded
  - the intent is eligible for receipt issuance
- `RECEIPT_ISSUED`
  - a signed receipt exists for the intent
- `REJECTED`
  - payment failed or was canceled
- `EXPIRED`
  - the intent timed out or the payment became invalid

### Intent transitions

- `PENDING_VERIFICATION` -> `VERIFIED`
- `PENDING_VERIFICATION` -> `REJECTED`
- `PENDING_VERIFICATION` -> `EXPIRED`
- `VERIFIED` -> `RECEIPT_ISSUED`
- `VERIFIED` -> `EXPIRED`
- `RECEIPT_ISSUED` -> `EXPIRED`
- `REJECTED` and `EXPIRED` are terminal

## Access receipt states

- `ISSUED`
  - the receipt is active and redeemable
- `EXHAUSTED`
  - the receipt reached its redemption limit
- `REVOKED`
  - reserved for future revocation workflows
- `EXPIRED`
  - the receipt passed its validity window

### Receipt transitions

- `ISSUED` -> `EXHAUSTED`
- `ISSUED` -> `REVOKED`
- `ISSUED` -> `EXPIRED`
- `EXHAUSTED`, `REVOKED`, and `EXPIRED` are terminal

## Reconciliation worker behavior

- scans intents that are open or need follow-up
- asks the Fiber adapter for status
- normalizes raw Fiber status into internal state
- updates intent status
- issues exactly one receipt when a paid status is confirmed
- appends audit events for transitions
- can be run repeatedly without duplicating receipts

## Fiber v0.8.1 status normalization

- invoice `Open` -> `PENDING_VERIFICATION`
- invoice `Received` -> `PENDING_VERIFICATION`
- invoice `Paid` -> `VERIFIED`
- invoice `Expired` -> `EXPIRED`
- invoice `Cancelled` -> `REJECTED`
- payment `Created` -> `PENDING_VERIFICATION`
- payment `Inflight` -> `PENDING_VERIFICATION`
- payment `Success` -> `VERIFIED`
- payment `Failed` -> `REJECTED`
- unknown or ambiguous status -> `PENDING_VERIFICATION`
- unknown or ambiguous status never issues a receipt

## Duplicate protection

- `idempotencyKey` prevents duplicate intent creation
- the receipt table is constrained to one receipt per access intent
- issuance is guarded by a unique receipt path and a retry-safe lookup
- reconciliation is safe to rerun after partial progress

## Redemption rules

- the JWT signature must verify
- the receipt must exist in storage
- the receipt must be active
- the receipt must be within its validity window
- the request resource and subject must match the receipt claims
- redemption increments the stored count atomically
- when the count reaches `maxRedemptions`, the receipt becomes exhausted
- a second redemption of an exhausted receipt is rejected

## Demo timing note

The local demo proves two different moments:
- immediately after issuance, the stored receipt is `ISSUED`
- after one successful redemption, the stored receipt becomes exhausted and `active` becomes `false`

That timing is intentional and should not be collapsed into one state.
