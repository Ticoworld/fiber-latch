# API Contract

FiberLatch exposes a small public API. The contract is intentionally narrow.

## `POST /v1/access-intents`

Create an access intent for a resource and subject.

Request body:
- `resource`
  - `key` string
  - `type` one of `CONTENT`, `FILE`, `API`
- `subject`
  - `type` one of `END_USER`, `SERVICE_ACCOUNT`
  - `id` string
- `paymentRef` optional string
- `idempotencyKey` optional string

Response:
- `accessIntent`
  - `id`
  - `policyId`
  - `status`
  - `resource`
  - `subject`
  - `paymentRef`
  - `verifiedAt`
  - `receiptIssuedAt`
  - `expiresAt`
  - `createdAt`
  - `updatedAt`
  - `accessReceipt`

Behavior:
- If `idempotencyKey` already exists, the existing intent is returned.
- In fake mode, a paid fake payment can immediately yield a receipt.
- In real mode, receipt issuance is deferred to reconciliation.
- In real Fiber mode, `paymentRef` should contain the Fiber `payment_hash` to verify.

## `GET /v1/access-intents/:id`

Fetch one access intent by id.

Response:
- `accessIntent` with the same shape as creation response

Behavior:
- Returns `404` when the intent does not exist.

## `POST /v1/receipts/verify`

Verify a signed receipt token.

Request body:
- `receiptToken` string

Response:
- `receiptVerification`
  - `verified`
  - `accessReceiptId`
  - `accessIntentId`
  - `jti`
  - `receiptStatus`
  - `resource`
  - `subject`
  - `issuedAt`
  - `exp`
  - `verifiedAt`
  - `reason`

Behavior:
- Verifies the JWT signature and claims first.
- Then checks the persisted receipt record.
- Expired or inactive receipts are rejected.

## `POST /v1/receipts/redeem`

Redeem a receipt for a resource and subject.

Request body:
- `receiptToken` string
- `resource`
  - `key`
  - `type`
- `subject`
  - `type`
  - `id`

Response:
- `redemption`
  - `status`
  - `accessGranted`
  - `accessReceiptId`
  - `accessIntentId`
  - `jti`
  - `receiptStatus`
  - `resource`
  - `subject`
  - `redemptionCount`
  - `maxRedemptions`
  - `redeemedAt`
  - `reason`

Behavior:
- Verifies signature and claims.
- Checks time bounds and persisted receipt state.
- Atomically increments redemption count.
- Marks the receipt exhausted when max redemptions is reached.

## `GET /.well-known/jwks.json`

Expose the public signing key for access receipt verification.

Response:
- `keys` array with one or more JWK entries

Behavior:
- Returns the public key material for the current local signing setup.
