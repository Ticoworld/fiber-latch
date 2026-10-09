# Standalone PostgreSQL store acceptance

Date: October 8, 2026.
Branch: `feat/postgres-access-receipt-store`.
Verdict: **PASS — POSTGRES STORE PROVEN**.

The real database was the new Neon PostgreSQL database supplied by this
repository's `.env.local` DATABASE_URL. The connection value was never printed.
`SELECT 1` passed before implementation and again before the explicit migration.
`sql/001_access_receipts.sql` was applied explicitly and created
`public.access_receipts`; the store never creates or migrates tables.

## Recorded verification

| Check | Result |
| --- | --- |
| Real-Neon acceptance harness | 36/36 cases passed |
| Focused final lock-wait tests | 2/2 passed |
| Component TypeScript build | Passed |
| Source and acceptance-harness type check | Passed |
| Existing access regression suite | 235/235 tests, 7/7 files passed |
| Changes to `packages/access` compared with HEAD | None; remains 0.1.1 |
| Existing npm lockfile entries changed | None; only new workspace/test dependencies added |

The focused rerun verifies the final expiry fixture: both connections and the
waiter's transaction are ready before the deadline is installed. The harness
observes `pg_stat_activity.wait_event_type = 'Lock'` while expiry is still in
the future, holds the lock until database time reaches expiry, then releases it.
The lock holder does not update the row during that transaction. Consumption
returns `receipt_expired`, and the count stays zero. A separate waiting contender
sees revocation committed by the holder and returns `receipt_revoked` without
incrementing.

## Required limits and denials

Limits 1, 3, 10, and 100 passed every allowed use. Each final use returned
`consumed` with `exhausted: true`; the next use returned `receipt_exhausted`.

Missing JTI, every command authority field, expected-maximum mismatch, revocation,
host/database expiry, persisted not-before, and pre-existing exhaustion all
denied without changing the count. Not-before denial uses `authority_mismatch`,
the existing 0.1.1 vocabulary. Matching expected maximum and exact not-before
host-time equality were admitted. A SQL-like JTI remained a parameter and did
not broaden lookup.

## Concurrent final-slot results

Each run began with exactly one use remaining and used 24 independently acquired
`pg` pool clients, firing all statements concurrently through the actual store.
There was no application mutex, shared in-memory counter, or automatic retry.

| Maximum | Initial count | Attempts | Consumed | Exhaustion denials | Final count |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 24 | 1 | 23 | 1 |
| 10 | 9 | 24 | 1 | 23 | 10 |
| 100 | 99 | 24 | 1 | 23 | 100 |

Each winner returned `exhausted: true`. Counts equaled their maximum; the schema
constraint also rejected a direct attempted write above the maximum. A final use
at `Number.MAX_SAFE_INTEGER` remained exact and the following use was denied.

## Transactions and failure handling

Pool/autocommit and a caller-owned transaction client both passed. A transaction
consumption remained invisible outside the transaction, rollback restored the
available use, and a later host commit persisted exhaustion.

A real SQL error and a real repeatable-read serialization failure returned
`system_failure` after exactly one executor call. The failed transaction remained
aborted until the host rolled it back. Lost or malformed responses injected after
real committed consumption also failed closed with one execution; the persisted
use remained consumed, and the next request was denied. No consumption was retried.

Unsafe/invalid commands were rejected without a database query. Database checks
rejected duplicate JTI, invalid strings, invalid grant/limit combinations,
negative/overflowing counts, unsafe numeric authority, and invalid validity order.

## Final scope

Only this run's explicit fixture JTIs were deleted during cleanup. The neutral
table remains in the new database. The component is private and unpublished;
there was no access release, lifecycle API, deployment, or application integration.
FiberFlow and fiberlatch-reference were not modified or connected to. No Docker
was used. Credentials, transactions, trusted issuance, authentication, fulfillment,
business idempotency and the final resource action remain host responsibilities.

This proof covers `pg` over Neon. Other query bridges or Neon HTTP transaction
behavior have not been tested. Integration/adoption measurements remain deferred
to the user's separately approved next step.
