# PostgreSQL companion release-readiness audit

Date: October 9, 2026. Candidate changes are uncommitted for PM review.
Branch: `feat/postgres-access-receipt-store`.
Audited HEAD: `5897d30a80fa538f09a4e3b4efc20f83e1d8dd8e`.

## Decision and scope

The implementation is technically ready for a final publication review. Do one
more review before publication; this audit does not authorize or perform a
release. No consumption semantics, source, neutral SQL, access-package files,
or application integration files changed.

Recommended name: **`@fiberlatch/postgres-store`**. Recommended initial version:
**`0.1.0`**, independent of `@fiberlatch/access@0.1.1`. The candidate metadata now
uses these values. `@fiberlatch/postgres` is shorter but suggests a broader
database toolkit. The `-store` suffix identifies the AccessReceiptStore role
and leaves wider PostgreSQL capabilities out of its promise. An internal-only
name is no longer necessary to describe this separately proven component,
although publication still awaits review. Registry lookups returned no public
entry for either proposed name; that does not reserve a name or prove publisher
permissions.

The only JS export remains `createPostgresAccessReceiptStore(query)`. The only
companion public type remains `PostgresQueryExecutor`. No repeated integration
pain justifies a new API. An explicit SQL resource subpath lets the host locate
the shipped migration without private deep imports; it is not a JS entry point.

The source imports only public access types. It has no internal imports, test
coupling, runtime dependencies, ORM, driver, framework, or environment access.
Its sole peer dependency is exactly `@fiberlatch/access@0.1.1`; the clean runtime
install also contains that peer's declared `jose@6.2.3` and `zod@4.4.3`.
Development tools/driver are explicitly declared: TypeScript, tsx, Node/pg
types, and pg. Node engine remains `>=22.12.0`, matching access. The consumer
checks ran on Node 22.14.0, npm 11.7.0 and TypeScript 5.9.3.

## Governing implementation evidence

These completed proofs are retained, not repeated by this metadata/docs audit:

| Proof | Recorded result |
| --- | --- |
| Standalone, `fdc5177` and packaging `5897d30` | 36/36 Neon cases; 2/2 strengthened lock-wait checks; limits 1/3/10/100; 24 final-slot contenders, 1 success and 23 exhausted; counts bounded |
| Reference app, `1396022130ae8971dddace83b71633b130d2b5a1` | Store 34 to 3 lines; custom consumption SQL removed; 32 contenders, 1 success/31 exhausted, final 3/3 |
| FiberFlow, `b8b87d81c3dc4efef0937be5ea9c87d0d8f924e2` | Consume 68 to 1 factory line; 3 bridge lines; 30 DDL lines; net 33 fewer production lines; 12 tests; 9 Neon cases; 24 contenders, 1 success/23 exhausted, final 3/3 |

The extraction audit `FIBERLATCH_TOOLKIT_EXTRACTION.md` governs the boundary:
core owns signed claims, verification, binding, orchestration and outcomes;
this companion owns the atomic persisted bounded-consumption transition;
the host owns trust, identity, issuance, business idempotency, receipt delivery,
database operation, transactions, revocation authorization and protected work.
Neither frozen application was reopened or changed.

## Executor and SQL findings

The existing executor type is sufficient. It accepts SQL plus readonly bound
string/number/null parameters and returns a promise of object rows. Execute the
statement unchanged once, preserve boolean/null results, and reject on database
errors. The package owns no pool/client, credentials, transaction commands,
connection release or retries. A host transaction must use its same checked-out
client; HTTP execution does not become an interactive transaction. Unknown or
malformed results and errors fail closed. A lost response can follow commit;
failure does not imply rollback and must not cause automatic consume replay.

The fixed `public.access_receipts` contract is neutral and sufficient. JTI is the
primary lookup key; authority strings are nonempty/non-null; grant/maximum,
safe-integer epoch seconds, validity ordering and bounded count have checks.
Revocation is any non-null timestamp; exhaustion is derived from count. There
are no purchase/payment/user foreign keys or lifecycle helpers. No additional
index is needed for JTI consumption.

The one statement materializes the lock before wall-clock decisions, compares
all authority supplied by the access command, then updates/returns exhaustion
atomically. Missing/denied/zero-update paths cannot report consumed. Signed
`iat`, `nbf` and `payment_ref` are absent from that command and cannot be compared
by the store; persisted `nbf` is enforced and JWT verification remains core-owned.
Both host and database time must satisfy persisted validity. Not-before uses the
unchanged `authority_mismatch` outcome in access 0.1.1. READ COMMITTED concurrency
is proven; stronger isolation may produce a fail-closed serialization error.

Case A explicitly applies the shipped neutral schema. Case B explicitly maps an
existing authoritative entitlement through an updatable view with compatible
types, unique JTI and original constraints. Boolean revocation can be a read-only
projection; host writes go to its original state. A retained exhausted flag must
be derived or atomically maintained. Copied rows, shadow counters and duplicated
revocation authority are excluded. Existing application DDL is not shipped.

## Candidate changes

- README replaced the internal proof narrative with installation, schema,
  executor, tiny signed-redemption example, transactions, concurrency, validity,
  revocation, safe existing-table adoption and explicit host/security boundaries.
- Metadata now identifies the candidate, ISC license/repository/keywords,
  intentional exports, exact file allowlist and side-effect status. `prepack`
  rebuilds JS/declarations. Existing SQL/source/TypeScript settings are unchanged.
- ISC license added, matching the repository's access package.
- Root lockfile only updates the workspace identity/metadata and declares the
  companion's already-used development tools; existing dependency versions did
  not change.
- A small distribution verification script and three consumer fixtures verify
  the actual archive outside the monorepo. The old complete database acceptance
  harness is unchanged and available as `test:neon`; default `test` requires no DB.

## Current verification

| Check | Result |
| --- | --- |
| Companion source plus existing Neon test-harness typecheck | PASS |
| Companion build, including pack-time rebuild | PASS |
| Existing access regressions | 235/235 PASS in 7 files |
| Strict publint | PASS |
| ATTW, actual JS entry / ESM profile | PASS; SQL resource and older Node16 CJS model handled separately below |
| Clean tarball runtime install | PASS; archive extraction, no workspace symlink, only declared runtime graph |
| ESM / synchronous CommonJS import | PASS |
| SQL resource resolution/read and private deep-import rejection | PASS |
| Consumer-owned TypeScript, ESM and CommonJS NodeNext | PASS, including pg bridge and access-store compatibility |
| Packed consumer, dedicated Neon PostgreSQL 18.6 | PASS; signed receipt uses 1/2/3 allowed, use 4 exhausted, count remains 3 |
| Disposable consumer and unique DB fixture cleanup | PASS |
| Source, SQL and access diff against audited HEAD | No changes |

`npm run test:distribution:neon --workspace @fiberlatch/postgres-store` ran the
complete default distribution verification plus the minimal database smoke.
It did not migrate, truncate, or rerun the 36-case/concurrency proof. It used only
the repository's dedicated `.env.local` URL, passed in memory to the consumer;
no credentials were printed or copied into files. Cleanup deletes only its
random fixture JTI and its own checked temporary directory outside the repo.

The type analyzer's automatic discovery treated the exported `.sql` resource as
JavaScript and reported no resolution. Analyze only the actual JS entry with
`attw --pack packages/postgres-store --profile esm-only --entrypoints .`.
The SQL resource is intentionally read via `import.meta.resolve`/filesystem and
tested that way. ATTW's older Node16 CJS model cannot model Node22 synchronous
ESM require; actual Node22 runtime and modern NodeNext consumer tests cover it.

Actual tar inspection found exactly: `package.json`, `README.md`, `LICENSE`,
`dist/index.js`, `dist/index.d.ts`, `sql/001_access_receipts.sql`.
Archive SHA256: `e6b384a30a6c0674e07e80c4f4dcc9b1c2275d2471e102c544d17f26d2cf2aaa`.
No environment files, credentials, source maps, research, test files, audit/proof
reports, local archives or other workspace files were included. The disposable
archive was removed with its consumer after verification.

## Release decision

| Question | Answer |
| --- | --- |
| Technically ready for publication? | Yes, subject to final review; no semantic defect found |
| Package boundary clear? | Yes; one PostgreSQL AccessReceiptStore |
| Package name clear? | Yes; recommend the candidate `@fiberlatch/postgres-store` |
| README sufficient? | Yes; adoption and failure boundaries are explicit |
| SQL adoption story sufficient? | Yes; direct neutral schema or one-authority compatibility view |
| Tarball clean? | Yes, six allowlisted files inspected |
| Clean consumer works? | Yes, imports/types and real PostgreSQL-backed signed redemption |
| Remaining technical blockers? | None found; public publisher/scope permissions were not exercised |
| First public version? | `0.1.0`; access remains `0.1.1` |
| Publish now? | No; final PM review of diff, name/version, and release account/provenance first |

Security review found fixed identifiers and bound values; complete command
authority comparison, revocation/expiry/not-before/expected-maximum enforcement,
safe integers and bounded counters, fail-closed result parsing and database
errors, and no internal retries/transaction ownership. These guarantees require
the documented authoritative schema/view and an honest host executor. This is
not generic access control or exactly-once fulfillment.

**PASS — READY FOR FINAL PUBLICATION REVIEW**
