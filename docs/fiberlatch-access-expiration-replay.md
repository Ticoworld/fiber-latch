# FiberLatch Access Expiration and Replay Rules

## Purpose

These rules describe when a receipt may be redeemed and how your app prevents
reuse. A signed receipt alone does not stop replay. Your app must keep trusted
receipt state and record each use safely.

FiberLatch Access verifies the receipt, checks trusted bindings, and calls one
host-owned `AccessReceiptStore.consume` operation. The package does not ship a
database adapter or own your receipt records.

## Time validity

Receipt times are integer Unix seconds. The claim format requires:

```text
iat <= nbf < exp
```

The intended validity interval is half-open:

```text
nbf <= current time < exp
```

With its default zero clock tolerance, the verifier rejects receipts before
`nbf` and at or after `exp`. Its configuration can allow a tolerance from zero
to 60 seconds, which adjusts those cryptographic time checks; your app should
choose a value appropriate for its clocks and document it.

The store receives the trusted `current_time` supplied to
`redeemAccessReceipt`. It must independently deny use at or after the
receipt's `exp`. This gives the app an authoritative expiry decision alongside
cryptographic time verification.

## Redemption rules

`single_redemption` receipts always have `max_redemptions: 1`. A valid first
consume operation may succeed and returns `exhausted: true`. A later attempt
must be denied as `receipt_exhausted`.

`multi_redemption` receipts have `max_redemptions` greater than one. Each
successful consume operation records one use. The operation reports
`exhausted: true` when it consumes the final allowed use, and every later use
must be denied.

Before calling the store, `redeemAccessReceipt`:

1. verifies the bearer receipt;
2. compares it with expected subject, resource, policy, intent, and optional
   redemption limit supplied independently by your app; and
3. passes verified authority and the trusted current time to the store.

The package returns `verification_denied` or `binding_denied` before a failed
receipt reaches the store. It returns `consumption_denied` for a normal store
denial and `system_failure` when it cannot safely determine that a use was
recorded.

## AccessReceiptStore

`AccessReceiptStore` is your app's contract for one atomic consumption
transition:

```ts
const store: AccessReceiptStore = {
  async consume(command) {
    // Check and update trusted receipt state as one operation.
    return { outcome: "receipt_missing" };
  },
};
```

The command includes the verified `jti`, issuer, subject, audience, intent,
resource, policy, grant type, maximum redemptions, expiry, trusted current
time, and an optional expected maximum-redemptions limit. Your store must use
that information with its persisted state to decide whether it can record a
use.

The store can return:

- `consumed` with whether the receipt is now exhausted;
- `receipt_missing`, `receipt_revoked`, `receipt_exhausted`, or
  `receipt_expired`;
- `authority_mismatch` when trusted state does not match verified authority;
- `concurrency_conflict` when another operation changed the state first; or
- `system_failure` when it cannot complete or safely determine the result.

Your app must treat every result other than `consumed` as a denial. It must
also fail closed if the store throws or returns an unrecognized result; the
package maps those cases to `system_failure`.

## Atomicity and concurrency

Checking a receipt and later writing its new redemption count in a separate
operation is unsafe. Two requests can both observe remaining capacity and both
grant access. The check, expiry/revocation/exhaustion decision, and update of
the redemption count must happen as one atomic operation in your trusted
store.

The paid-resource example demonstrates this contract in one process: two
concurrent attempts using the same single-use receipt produce exactly one
success and one denial. Its in-memory store is demonstration-only. It is not
distributed replay protection, does not persist across restarts, and is not a
production database implementation.

A real application must provide durable storage and an atomic primitive that
remains correct across its application processes.

## Revocation and final access

Revocation, receipt existence, persisted authority, redemption count, and
exhaustion belong to your app's trusted state. A revoked receipt must be
denied, even if it has unused capacity. A missing receipt must also be denied.

FiberLatch Access does not verify payments, make Fiber RPC calls during normal
redemption, persist receipts, revoke them, or decide whether the protected
resource should finally be served. Your app owns those decisions.
