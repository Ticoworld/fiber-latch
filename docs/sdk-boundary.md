# SDK/Core Boundary

This document records the current Phase 4 SDK/core boundary decision for FiberLatch.

No SDK extraction is approved yet. The backend remains the reference implementation.

## Current proven boundary

FiberLatch has proven a narrow live Fiber testnet flow:

- a paid Fiber `payment_hash` is provided to FiberLatch
- Fiber status is normalized to a paid state
- a signed access receipt is issued
- the receipt can be verified
- the receipt can be redeemed once
- duplicate redemption is denied

This is testnet-only and reference implementation only. It is not a production or mainnet readiness claim.

## Why SDK/core is being considered

Yukang's feedback was that the signed receipt model makes sense, and that the application boundary of paid Fiber payment to signed access receipt to one-time redemption is useful.

The current backend is still valuable as a reference implementation because it shows persistence, reconciliation, receipt issuance, verification, and redemption working together.

For third-party apps, the reusable core may be more useful as an SDK or library than as a standalone backend service. An app may already have its own backend, database, resource model, user model, and HTTP API. In that case, FiberLatch should be easy to copy, embed, or adapt without forcing the app to adopt FiberLatch's backend shape.

## Reusable core candidates

The following logic is a candidate for future SDK/core extraction:

- Fiber status normalization
- Fiber verification result shape
- real Fiber RPC response parsing and status handling
- receipt claim shape
- receipt signing and verifying interface
- pure receipt claim generation
- redemption decision rules
- typed receipt failure reasons

These candidates should be extracted only after the current behavior is hardened with focused tests.

## Backend reference implementation candidates

The following logic should stay in the backend reference implementation:

- Fastify routes
- Prisma schema and repositories
- EventLog writes
- reconciliation worker scheduling
- local and live demo scripts
- runtime environment loading
- HTTP response shaping
- atomic DB redemption implementation

The atomic DB redemption path is important as reference behavior, but the future SDK should not require Prisma or a specific database.

## Current coupling risks

`FiberLatchService` currently mixes several responsibilities:

- Prisma transactions
- Fiber RPC verification
- receipt signing
- event log writes
- state transitions
- HTTP-facing DTO shaping

This makes the service useful as an integrated backend reference, but too coupled to extract directly as an SDK.

Known coupling risks:

- the status mapper imports Prisma status types
- the JWT signer imports backend signing key config
- Fiber network calls happen inside DB transactions in some paths

Before extraction, the core types should be decoupled from Prisma, signing should depend on SDK-shaped key inputs, and network calls inside DB transactions should be hardened or moved out.

## Possible SDK API shape

These are example shapes only. They are not an implementation plan and do not create a package boundary yet.

```ts
const payment = await verifyFiberPayment({
  paymentHash,
  fiberClient,
});
```

```ts
const claims = createAccessReceiptClaims({
  issuer,
  audience,
  subjectId,
  intentId,
  resourceId,
  policyId,
  paymentRef,
  issuedAt,
  notBefore,
  expiresAt,
  grantType,
  maxRedemptions,
});
```

```ts
const signed = await signAccessReceipt({
  claims,
  signer,
});
```

```ts
const verification = await verifyAccessReceipt({
  token,
  verifier,
  expectedIssuer,
  expectedAudience,
});
```

```ts
const decision = checkRedemptionPolicy({
  claims,
  receiptRecord,
  requestedResource,
  requestedSubject,
  now,
});
```

The SDK should prefer pure functions and narrow interfaces. It should not own persistence, HTTP routing, background scheduling, or app-specific access policy storage.

## custom_records findings

Fiber `custom_records` may be useful as optional correlation metadata. They are not required for the proven flow because FiberLatch already maps a paid `payment_hash` to an access intent and receipt.

Possible optional fields:

- resource ID or resource key
- access intent ID
- idempotency key
- app namespace and version
- app-specific non-sensitive claim
- optional hash of intent or policy data

`custom_records` should remain optional. Third-party apps may create payments outside FiberLatch and may already have their own correlation model.

## What must not go in custom_records

Do not put the following in Fiber `custom_records`:

- secrets
- private keys
- private user data
- full receipt JWTs
- sensitive access policy data
- raw authorization decisions
- anything required as the sole proof of access

The signed receipt and the app's own storage should remain the authoritative access boundary.

## Rough edges before extraction

The following should be hardened before SDK extraction:

- resource mismatch tests
- subject mismatch tests
- revoked receipt tests
- `maxRedemptions > 1` tests
- invalid receipt error typing
- Fiber RPC timeout and abort behavior
- avoiding network calls inside DB transactions
- signing key setup docs
- key rotation and JWKS notes
- decoupling core status types from Prisma
- deciding whether raw Fiber RPC responses should be stored

## Next recommended steps

Recommended order:

1. Add access-control edge-case tests first.
2. Extract pure helpers after the tested behavior is clear.
3. Consider a package boundary only after the helpers are stable.
4. Keep the backend as the reference implementation.

FiberLatch should remain narrow: verified Fiber payment state to signed access receipt to verification and redemption for a specific resource and subject.
