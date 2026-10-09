# @fiberlatch/postgres-store

A PostgreSQL AccessReceiptStore for FiberLatch bounded receipt redemption.

Use this companion to `@fiberlatch/access` when your application already trusts
an entitlement and needs PostgreSQL to enforce its remaining uses. It compares
persisted authority, checks revocation and validity, and atomically consumes one
use. The final allowed use succeeds; further uses are denied as exhausted.

Use another store if your authoritative state is outside PostgreSQL or cannot
meet the schema and query-executor contract below. This package is not a general
access-control system. It does not trust payments, authenticate callers, issue
entitlements, deliver receipts, or decide the final protected response.

## Install

The `0.1.0` candidate is not published yet. After an approved public release:

```sh
npm install @fiberlatch/access@0.1.1 @fiberlatch/postgres-store@0.1.0
```

For local review, install the packed `.tgz` instead of the second package name.
Node.js **22.12.0 or later** is required, matching the access package. The module
is ESM, with synchronous `require()` supported on those Node versions. Use modern
TypeScript with `NodeNext` resolution (or your application's bundler resolution).
The SQL uses PostgreSQL's `MATERIALIZED` CTE syntax available from PostgreSQL 12;
run a PostgreSQL version maintained by your database provider. Acceptance covers
the recorded Neon server and integration executors, not every PostgreSQL release.

The store has no runtime driver dependency. Install/configure `pg`, Neon, or
another compatible executor in the host when needed. `@fiberlatch/access@0.1.1`
is the sole peer dependency and owns claims, crypto, bindings, redemption
orchestration, and typed outcomes.

## Case A: a new application

Apply the shipped `sql/001_access_receipts.sql` explicitly through your host
migration process. The factory never creates or migrates anything. The SQL path
is exported so a migration tool can locate the file without private deep imports:

```js
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL(import.meta.resolve(
  '@fiberlatch/postgres-store/sql/001_access_receipts.sql',
)), 'utf8');
// In your explicit migration, using a host-owned migration client:
await migrationClient.query(schema);
```

Resolve/read this file as a resource; do not import it as JavaScript or apply it
automatically at application startup. It intentionally fails if the relation
already exists; inspect/adapt an existing schema instead of replacing it.

The fixed relation is **`public.access_receipts`**. Its primary key is a nonempty
text JTI. Issuer (`iss`), subject (`sub`), audience (`aud`), intent/resource/policy,
and grant type are canonical authority. Maximum/count and `iat`/`nbf`/`exp` use
`bigint`, limited to JavaScript's safe-integer domain; claim times are Unix
seconds, not milliseconds. `payment_ref` is nullable and opaque. `revoked_at` is
a nullable `timestamptz`; any non-null value means revoked.

Checks enforce nonempty identifiers, `iat <= nbf < exp`, single/multi grant-limit
consistency, and `0 <= redemption_count <= max_redemptions`. Negative canonical
times are allowed; trusted execution time must be nonnegative. The JTI primary
key supplies the lookup index used by consume; no additional index is required
for that path. Exhaustion is derived from count, not stored as a second flag.

Your application persists trusted canonical authority once, with count zero,
before signing it. Keep that authority immutable through ordinary redemption.
JTI uniqueness does not deduplicate a purchase or event: choose and enforce your
own intended-grant uniqueness and business linkage. Duplicate fulfillment or
receipt retrieval must preserve JTI, validity, allowance and count.

When reading `bigint` fields with a driver that returns strings, validate/convert
them into safe integer numbers before passing claims to the access builder.
Consumption itself does not convert counters to JavaScript numbers.

## Query executor

```ts
import { createPostgresAccessReceiptStore, type PostgresQueryExecutor }
  from '@fiberlatch/postgres-store';

const query: PostgresQueryExecutor = (sql, parameters) =>
  hostPool.query(sql, [...parameters]);
const store = createPostgresAccessReceiptStore(query);
```

`hostPool` belongs to your application. The public type is:

```ts
type PostgresQueryExecutor = (
  sql: string,
  parameters: readonly (string | number | null)[],
) => Promise<{ readonly rows: readonly unknown[] }>;
```

Execute the supplied SQL **once**, unchanged, with positional `$1` parameters
bound separately. Strings, exact safe-integer numbers, and null are the only
parameter types. Do not interpolate values, split/rewrite the statement, add
transaction commands, or retry it. Return object rows with PostgreSQL boolean
and null values preserved; do not return array-mode rows or stringify booleans.
Reject the promise on execution/transport errors instead of manufacturing a
denial or empty result. The store validates the response and fails closed.

`pg` pool/transaction-client queries already return `{ rows }`. Neon HTTP returns
the row array by default, so the host's bridge wraps it:

```js
const store = createPostgresAccessReceiptStore(async (sql, parameters) => ({
  rows: await hostNeonQuery.query(sql, [...parameters]),
}));
```

This is query wiring, not a Neon/Drizzle adapter. The same existing Neon HTTP
client can remain the host's Drizzle client. The package owns no database URL,
pool, client, connection release, transaction, timeout, or retry policy. An HTTP
executor does not acquire interactive transaction support through this bridge.

## Minimal bounded-redemption example

Assume the host has already trusted and persisted a three-use entitlement with
count zero in the adopted relation. `trustedPersistedClaims` is the host's safely
normalized original authority; keys and authenticated expected context are also
host-owned. This example adds no issuance, payment or authentication helper:

```js
import { buildAccessReceiptClaims, createAccessReceiptSigner,
  createAccessReceiptVerifier, redeemAccessReceipt } from '@fiberlatch/access';
import { createPostgresAccessReceiptStore } from '@fiberlatch/postgres-store';

const claims = buildAccessReceiptClaims(trustedPersistedClaims);
const signer = await createAccessReceiptSigner({ privateKey: hostPrivateJwk });
const verifier = await createAccessReceiptVerifier({
  publicKeys: [hostPublicJwk], issuer: claims.iss, audience: claims.aud,
});
const token = await signer(claims);
const store = createPostgresAccessReceiptStore(
  (sql, parameters) => hostPool.query(sql, [...parameters]),
);
const expected = {
  sub: authenticatedSubject, resource_id: resourceForThisOperation,
  policy_id: policyForThisOperation, intent_id: ownedIntent,
  max_redemptions: 3,
};

for (let use = 1; use <= 4; use++) {
  const result = await redeemAccessReceipt({
    token, verifier, expected, store, current_time: Math.floor(Date.now() / 1000),
  });
  console.log(result);
}
// Uses 1/2: { status: 'success', exhausted: false }
// Use 3:    { status: 'success', exhausted: true }
// Use 4:    { status: 'consumption_denied', phase: 'consumption',
//             reason: 'receipt_exhausted' }
```

The host chooses expected context independently of the presented bearer token
and returns protected data only after success and any required commit. Only the
factory and `PostgresQueryExecutor` type are exported from the JS/type entry;
the result/command/store types remain the public access package's types.

## Transactions, concurrency and failures

The store executes one atomic statement. A materialized CTE locks the JTI row
before authority/state/time checks; a guarded update increments the same row and
returns a PostgreSQL boolean indicating exhaustion. In read-committed execution,
one remaining use admits exactly one committed contender. Other valid contenders
are denied as exhausted. A zero-row update never authorizes use; the statement
returns a denial or conflict instead.

For a host transaction, bind the executor to the **same checked-out transaction
client**, not a pool that can choose another connection:

```js
const store = createPostgresAccessReceiptStore(
  (sql, parameters) => transactionClient.query(sql, [...parameters]),
);
// Host: BEGIN -> redeem -> protected DB work -> COMMIT, or ROLLBACK on failure.
// Do not report transactional success until the host's COMMIT succeeds.
```

The host begins/commits/rolls back and releases its client. Keep the transaction
short; consumption holds the row lock until it ends. Rollback also undoes the
use. Repeatable-read/serializable conflicts may return `system_failure`; the host
must resolve the transaction outcome without automatically replaying consume.
PostgreSQL rollback cannot undo an external side effect or an already delivered
response.

In autocommit, a successful query commits its use before returning. A lost or
malformed response may instead return `system_failure` **after a use committed**.
Do not retry ambiguous consumption or assume a failed response refunded it. This
package does not guarantee exactly-once protected-action execution or delivery.
Invalid commands, unknown results and database errors fail closed as
`system_failure`; raw database errors are not exposed in the store result.

## Revocation and validity

An authorized host can set `revoked_at` without resetting count or allowance:

```sql
UPDATE public.access_receipts SET revoked_at = clock_timestamp() WHERE jti = $1;
```

Bind the JTI separately and authorize this write in the host. An existing-table
view may have a read-only revocation expression; in that case write the original
revocation field. Revocation committed while a contender waits on the row is
enforced when it acquires the lock. It does not undo an earlier committed use.

Both trusted host execution time and PostgreSQL `clock_timestamp()` must be
inside persisted `[nbf, exp)`. Database time is checked after acquiring the row
lock, including a lock-only wait across expiry. A stale host clock cannot extend
expiry; an advanced host clock cannot bypass stored not-before. No tolerance is
added. In access 0.1.1 there is no store not-yet-valid outcome, so persisted
not-before denial is `authority_mismatch`. JWT verification may deny first, so
not every expired request reaches the store or returns `receipt_expired`.

## Case B: an existing entitlement table

Keep one authoritative row and counter. A small explicit, automatically updatable
view can alias an existing table into the fixed contract, for example:

```sql
CREATE VIEW public.access_receipts AS
SELECT jti, issuer AS iss, subject_id AS sub, audience AS aud,
  intent_id, resource_id, policy_id, grant_type, max_redemptions, redemption_count,
  issued_at_seconds AS iat, not_before_seconds AS nbf, expires_at_seconds AS exp,
  payment_ref, revoked_at
FROM public.entitlements;
```

This is an illustrative projection, not an application-specific migration shipped
by the package. Verify the underlying JTI is unique/indexed, all required authority
is non-null with compatible types, validity/grant/count checks hold, count is
updatable, and row locks/updates reach exactly the original entitlement. Preserve
your business constraints and links. Test the migration with existing rows and
exercise consumption through the view before adopting it.

A boolean revocation column can be projected as a read-only nullable timestamp:

```sql
CASE WHEN revoked THEN TIMESTAMPTZ '1970-01-01 00:00:00+00'
     ELSE NULL END AS revoked_at
```

The non-null sentinel represents revoked state, not historical time. If your
table retains an `exhausted` flag, derive it from the original counter or maintain
it atomically as derived metadata, as FiberFlow did with a small host trigger.
The store never uses that flag. Do not create copied entitlement rows, shadow
counters, duplicate revocation state, or two authorities that can drift.

The reference app proved a column-alias view with a `pg` transaction client;
FiberFlow proved an updatable projection with boolean revocation and a Neon HTTP
executor. Their business schemas and migrations stay in those applications.
See PostgreSQL's [updatable view rules](https://www.postgresql.org/docs/current/sql-createview.html#SQL-CREATEVIEW-UPDATABLE-VIEWS)
when designing a different projection.

## Security boundary

The store compares JTI lookup plus issuer, subject, audience, intent, resource,
policy, grant type, maximum, expiry and optional expected maximum. The unchanged
access command does **not** contain signed `iat`, `nbf`, or `payment_ref`, so this
store cannot compare those signed fields. It enforces persisted not-before and
relies on the access verifier for signed JWT validation. Always use
`redeemAccessReceipt` with trusted verification and authenticated expected context;
the store is not a token verifier or an authentication decision.

All command values are parameterized; SQL identifiers are fixed, not constructed
from request input. The host must protect the authoritative relation, migration
definitions, canonical authority and database role privileges. Database constraints
bound the stored count; package command validation rejects unsafe integers. A
valid signature alone cannot prevent replay without authoritative consumption.

The host owns payment/permission trust, identity/authentication, business models,
fulfillment/create-once decisions, JTI generation, signing keys, receipt lookup
and delivery, expected context, database operation, transaction/retry decisions,
revocation authorization, renewal/refunds, the protected action and HTTP response.
This package supplies no lifecycle manager, payment/auth helper, ORM/framework
adapter, automatic migration, or automatic consumption retry.

## Maintainer checks

From the repository root:

```sh
npm run check --workspace @fiberlatch/postgres-store
npm run build --workspace @fiberlatch/postgres-store
npm test --workspace @fiberlatch/postgres-store
# Optional minimal packed-consumer proof against the dedicated test Neon DB:
npm run test:distribution:neon --workspace @fiberlatch/postgres-store
# Full existing database acceptance, when runtime/SQL behavior changes:
npm run test:neon --workspace @fiberlatch/postgres-store
npm run test:access
```

Packing rebuilds compiled files. Distribution verification installs the actual
archive outside the workspace, checks exports/types and cleans its own temporary
directory. The optional database check loads only the repository's dedicated
`.env.local` URL, never prints it, and deletes only its unique fixture receipt.
The prior standalone and application proofs remain recorded in repository audit
documents; they are not shipped in the consumer tarball.
