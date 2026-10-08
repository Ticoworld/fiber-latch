# PostgreSQL AccessReceiptStore (internal proof)

One unpublished, private component implementing `AccessReceiptStore` from
`@fiberlatch/access@0.1.1`. The workspace name is an internal working label.
Its runtime has no database driver dependency; `pg` is used only by the explicit
migration command and real-Neon acceptance harness.

```ts
import { createPostgresAccessReceiptStore } from './src/index.js';

const store = createPostgresAccessReceiptStore(
  (sql, parameters) => hostPool.query(sql, [...parameters]),
);
// Pass store to the existing @fiberlatch/access redemption function.
```

The factory takes one `PostgresQueryExecutor`: `(sql, parameters) => Promise<{ rows }>`,
where parameters are strings, exact safe-integer numbers, or null. The executor
must execute the statement once, preserve PostgreSQL boolean/null result types,
and surface execution errors. It must not retry consumption. The only store
method is `consume(command)`; its result uses the existing access 0.1.1 vocabulary.

## Explicit schema

The fixed, schema-qualified table is `public.access_receipts`. Apply
`sql/001_access_receipts.sql` explicitly using a host migration process. The SQL
creates one table, with JTI primary key, canonical authority, bounded count, and
nullable revocation timestamp. There are no foreign keys or business/provider
tables. `payment_ref` is the nullable, opaque canonical claim; it establishes no
payment trust. `iat` and `payment_ref` support host claim reconstruction.

All times are integer Unix seconds. Times and counts use PostgreSQL `bigint`
within JavaScript's safe-integer domain. Negative canonical times are permitted;
trusted `current_time` must be nonnegative. Checks enforce `iat <= nbf < exp`,
grant/maximum consistency, and `0 <= redemption_count <= max_redemptions`.
No count is converted from PostgreSQL into a JavaScript number during consumption;
PostgreSQL returns the final-use comparison as a boolean.

The host must persist trusted canonical authority once and keep it unchanged:
JTI, issuer, subject, audience, intent/resource/policy, grant type, maximum,
iat/nbf/expiry, and payment reference. The store only increments the counter.
Authorized revocation and all issuance/read operations remain host SQL. JTI
uniqueness does not deduplicate a business event: the host still needs its own
intended-grant identity and uniqueness rules. Duplicate delivery must not reset
quota or timestamps. The table is the authoritative counter, not a shadow copy.

## Consumption and time

One parameterized statement locks the JTI row in a materialized CTE, evaluates
eligibility after the lock, and performs a guarded `UPDATE ... RETURNING`.
All command authority fields and optional expected maximum must equal persisted
values. The final valid use returns `{ outcome: 'consumed', exhausted: true }`;
later contenders return `receipt_exhausted`. The database count constraint also
prevents writes above the maximum.

Denial precedence is missing, authority mismatch, revoked, expired, persisted
not-before, exhausted. Both trusted host execution time and PostgreSQL wall-clock
time must be inside the persisted validity interval. A stale host clock cannot
extend expiry; an advanced host clock cannot bypass persisted not-before. The
database clock is checked after row-lock acquisition, including lock-only waits.
There is no clock tolerance.

Access 0.1.1 has no not-yet-valid store outcome, so persisted not-before denial
returns `authority_mismatch`. The command lacks signed `iat`, `nbf`, and
`payment_ref`; the store cannot compare those claims. Existing core verification
still validates the signed receipt. Invalid/unsafe commands, database exceptions,
or unknown result shapes fail closed as `system_failure`. No error is retried.

## Host transactions

The same executor can use a caller-owned transaction client:

```ts
const store = createPostgresAccessReceiptStore(
  (sql, parameters) => hostTransactionClient.query(sql, [...parameters]),
);
```

The host owns credentials, connections, pools, `BEGIN`/`COMMIT`/`ROLLBACK`, and
timeouts. In a transaction, `consumed` is provisional until the host commits.
Commit before reporting access; roll back failed transaction work. Keep
transactions short because other uses and revocation may wait on the receipt row.
In autocommit, a successful query has committed its use before returning. A lost
response can therefore report `system_failure` after consumption has committed.
Do not retry an ambiguous consumption or assume it refunds itself.

Authentication, payment/permission trust, intended entitlement creation,
fulfillment, signing, final resource actions and response mapping remain with the
host. Consumption does not guarantee exactly-once delivery or external actions.
At PostgreSQL repeatable-read/serializable isolation, conflicts may fail closed;
the host must resolve its transaction outcome without automatically retrying
consumption. Tested executor modes are `pg` pool/autocommit and a `pg` transaction
client over Neon PostgreSQL. Other drivers, Neon HTTP, and arbitrary bridges are
not claimed as tested.

## Reproduce this proof

From the repository root after `npm install`:

```powershell
npm run db:check --workspace fiberlatch-postgres-store-internal
# Once only, explicitly create the table in the new authorized database:
npm run db:apply --workspace fiberlatch-postgres-store-internal
npm run build --workspace fiberlatch-postgres-store-internal
npm run check --workspace fiberlatch-postgres-store-internal
npm test --workspace fiberlatch-postgres-store-internal
npm run test:access
```

The migration/test scripts read only this repository's `.env.local` DATABASE_URL;
they ignore ambient DATABASE_URL and other environment files, verify a Neon host
and certificate, and never print credentials or raw database errors. These scripts
are test tooling, not runtime store behavior. The acceptance harness expects the
table to exist, inserts unique fixture JTIs, and deletes only its own fixture rows.
It never migrates, drops or truncates the table. Reapplying the migration to an
existing table fails instead of silently accepting a different schema.

The harness exercises quotas 1/3/10/100, authority and state denials, separate
connection races for the final slot, actual lock-wait expiry/revocation, transaction
rollback/commit, serialization/SQL errors, response loss, schema constraints and
safe-integer boundaries. See `ACCEPTANCE.md` for the recorded run.
