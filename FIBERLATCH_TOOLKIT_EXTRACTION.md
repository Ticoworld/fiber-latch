# FIBERLATCH TOOLKIT EXTRACTION AUDIT

Date: October 8, 2026. Evidence-based product extraction review; no implementation or release.

## 1. Executive verdict

**There is one real reusable next layer: an optional PostgreSQL implementation of `AccessReceiptStore`, with an explicit receipt-state schema contract. Build it narrower than a general entitlement lifecycle toolkit.**

Both integrations independently implement the same security-sensitive transition: locate persisted receipt authority by JTI, compare signed authority, reject revoked/expired/exhausted state, atomically increment a bounded counter, and return the core's typed outcomes. This is stronger evidence than the superficial similarity of their payment-to-entitlement workflows.

General-purpose issuance, payment fulfillment, receipt-delivery routes, authentication adapters, renewal, and a `createFiberLatch()` facade are not justified by these two integrations. A generic create-or-get primitive might eventually help, but these implementations do not establish a common business identity, conflict-validation rule, or transaction boundary sufficient to recommend it now. Revocation enforcement repeats; an operational revocation helper does not repeat in both.

**Keep `@fiberlatch/access` at 0.1.1.** Its existing contract supports the proposed component without changing its runtime, claim format, exports, or dependencies. No package name is approved by this report. `@fiberlatch/postgres` is only a possible label for a future optional component.

**POSTGRES ADAPTER VERDICT: BUILD, BUT NARROWER THAN EXPECTED.**

**Final PM classification: B. ONE NARROW REUSABLE COMPONENT JUSTIFIED.** This is an extraction of production persistence mechanics, not FiberLatch V2.

### Evidence baseline and limits

The resumed audit inspected `git status`, unstaged and staged diffs, current code, schemas, routes, tests, package metadata, and adoption documentation. All three working trees were initially clean; no unfinished report existed. Their checked-out HEADs matched the requested evidence:

| Repository | Branch | Inspected HEAD |
| --- | --- | --- |
| FiberLatch | `master` | `1438c2ddc4b584fc68756618697df30ef53493bf` |
| FiberFlow | `fiberlatch-integration` | `96a96e26c7c3aeac9fcef486073586f88c3c6986` |
| Reference app | `master` | `25b6b9b95703b9c789de58b1c78430cf44f08a21` |

The user's handoff records real PostgreSQL concurrency acceptance for FiberFlow, with actual Fiber settlement blocked by upstream availability. It also records completed local real-provider acceptance for the reference app: GitHub OAuth, Stripe TEST Checkout, verified webhook, Neon PostgreSQL, one entitlement, three uses, fourth HTTP 409 `receipt_exhausted`, and retrieval preserving JTI/expiry/quota. Those completed outcomes are accepted as supplied evidence, not claimed as rerun observations.

The checked-in FiberFlow test uses `AtomicTestStore` in memory; it is not the recorded PostgreSQL acceptance harness. The reference app has an actual PostgreSQL integration harness but fixture Stripe sessions and mostly fixture principals. Its browser acceptance uses real Better Auth cookies with fixture provider fulfillment. These distinctions matter. This audit inspected tests rather than executing them or connecting to databases/providers. No credentials were read; no upstream infrastructure work was reopened.

Evidence references below use these repository-relative roots:

- **C:** `C:\Users\timot\Desktop\2026\CKB\fiber-latch`; core references start at `packages/access/`.
- **F:** `C:\Users\timot\Desktop\2026\CKB\fiberflow`; integration references start at `examples/store/`.
- **R:** `C:\Users\timot\Desktop\2026\CKB\fiberlatch-reference`.

Line ranges identify inspected source spans; function names are the durable locator. Categories: **A** existing access core; **B** repeated reusable infrastructure; **C** app-specific; **D** provider/framework-specific; **E** accidental implementation complexity. Some spans contain more than one responsibility and are split accordingly.

## 2. Current FiberLatch boundary

FiberLatch starts **after the host already trusts a payment or permission decision**. It makes a scoped, subject-bound, time-bounded receipt and orchestrates safe limited redemption through trusted state. It does not establish payment trust or authenticate a caller. A valid receipt is one input to the host's final access decision.

The current package already owns:

| Responsibility | Actual implementation | Category |
| --- | --- | --- |
| Canonical claim construction; `iat <= nbf < exp`; single-use versus multi-use/limit consistency | C `packages/access/src/receipt-claims.ts:39-114`, `buildAccessReceiptClaims` | A |
| Trusted Ed25519 JWK validation/import and bounded configuration | C `packages/access/src/ed25519-jwk.ts`, `importTrustedPrivateKey`, `importTrustedPublicKey` | A |
| Receipt signing, without generating new authority/times | C `packages/access/src/receipt-signer.ts:20-42`, `createAccessReceiptSigner` | A |
| Signature, header, key, issuer, audience, required claims, JWT expiry/not-before checks | C `packages/access/src/receipt-verifier.ts:251-335`, `verifyToken`, `createAccessReceiptVerifier` | A |
| Trusted expected subject/resource/policy/intent and optional limit equality | C `packages/access/src/receipt-bindings.ts:75-113`, `evaluateAccessReceiptBindings` | A |
| Verify -> bind -> one store call; typed results; fail closed on invalid results/errors | C `packages/access/src/redeem-access-receipt.ts:120-228`, `redeemAccessReceipt` | A |
| Atomic consumption command and outcome contract | C `packages/access/src/access-receipt-store.ts:3-75` | A, contract only |

`AccessReceiptStore` has **one method: `consume`**. It does not include create, lookup, revoke, status, or receipt delivery. `redeemAccessReceipt` builds a command containing JTI, issuer, subject, audience, intent, resource, policy, grant type, maximum, expiry, trusted execution time, and optional expected maximum. It does not itself store or increment anything. It has no built-in retry.

Important precision: the consumption command does **not** carry signed `iat`, `nbf`, or `payment_ref`. The adapter can compare every authority field in that command and enforce persisted not-before, but cannot promise comparison of all thirteen signed claims without a different contract. JWT time verification remains core-owned. Payment references remain opaque host references, not proof.

Core `packages/access/package.json:2-3` is `@fiberlatch/access@0.1.1`; both integration manifests pin that version. Its production dependencies are `jose` and `zod`, not a database, payment SDK, or auth framework. Existing `packages/access/README.md` already documents idempotent issuance and the three-use lifecycle; the adoption commit improves guidance rather than adding a persistence adapter. Historical root-backend/Prisma/Fiber material is not the published package API and is not a reason to extract payment machinery.

## 3. FiberFlow integration decomposition

The relevant integration is the store example, not the entire FiberFlow payment platform.

| Source / function | Actual responsibility | Classification |
| --- | --- | --- |
| F `lib/fiberflow.ts:131-169`, `verifyFiberFlowWebhook` | HMAC signature/timestamp verification of raw body | D; trust decision remains C |
| F `lib/private-api-policy.ts:6-31`, `isPrivateApiOrder`, `matchesPaidInvoiceForOrder`, `canRetrievePrivateApiReceipt` | Identify eligible product, match paid invoice/payment hash, require paid owner for retrieval | C/D |
| F `app/api/webhooks/fiberflow/route.ts:13-73`, `POST` | Verify, decode, find order, interpret event, mark paid, issue when product qualifies | C/D |
| F `lib/commerce/index.ts:684-713`, `markOrderPaid`, `markOrderStatus` | Order status and paid timestamp; avoid overwriting paid order with expired/cancelled | C |
| F `lib/private-api-access.ts:44-86`, `parseJwk`, `getRuntime` | Environment loading, cached signer/verifier composition, matching key IDs | C/D configuration; A imported factories; cache style E |
| F `lib/private-api-access.ts:88-115`, `claimsFromEntitlement`, signing wrappers | Persisted row -> canonical claims -> existing signer | B concept; A validation/signing; row mapping D; wrapper layering E |
| F `lib/private-api-access.ts:117-197`, `issuePrivateApiEntitlement` | Eligible paid order checks; propose UUID/time/claims; insert once; recover winner; sign persisted row | C authority; B create-once mechanics; D Drizzle/host schema |
| F `lib/db/schema.ts:171-208`, `accessEntitlements` | Durable authority, JTI, count, revocation/exhaustion booleans; unique host key and JTI | B receipt-state data; C order/user relationships; D schema representation |
| F `lib/private-api-access.ts:199-217`, `getPrivateApiEntitlementForOrder` | Order/user/payment/resource-qualified lookup | C ownership and lookup identity; B durable-read concept |
| F `app/api/access/receipt/route.ts:10-51`, `GET` | Session and paid-owner checks; retrieve/sign; no-store delivery; no entitlement creation | C/D |
| F `lib/private-api-access.ts:219-286`, `consume` | Conditional bounded update and denial diagnosis | B semantics; D SQL construction |
| F `lib/private-api-access.ts:288-333`, `redeemPrivateApiReceiptForOrder` | Verify once, find JTI, enforce subject, select expected context, call core with verified claims | C integration context; A orchestration |
| F `lib/session.ts`, `getSession`; `lib/auth.ts` | Better Auth session and email/password authentication | D; C account/session ownership |
| F `app/api/private-api/route.ts:11-44`, `GET` | Parse bearer, authenticate, redeem, return resource only on success; generic denial | C/D |
| F `lib/private-api-constants.ts` | Resource/product/policy, three uses, one-hour lifetime | C |

### Full lifecycle

1. **Trusted event:** webhook signature validation precedes interpretation. `matchesPaidInvoiceForOrder` requires event type `invoice.paid`, status `paid`, matching local invoice ID and payment hash. The host establishes the authority; FiberLatch does not verify Fiber settlement.
2. **Host fulfillment:** `markOrderPaid` returns a paid order; product eligibility is checked before `issuePrivateApiEntitlement`. Order marking and entitlement insertion are separate operations, not one enclosing transaction. Failure can leave a paid order without an entitlement; a later duplicate delivery can recover. No generic library can infer that recovery policy from a paid status alone.
3. **Create/lookup and identity:** issuance proposes claims, a `randomUUID()` JTI, app-clock timestamps, and a one-hour three-use grant. It attempts an insert before doing an existing-row lookup. Uniqueness is `(order_id, payment_ref, resource_id)` plus unique JTI. `ON CONFLICT DO NOTHING` returns either a new row or no row; the latter recovers by the business key. Only the durable winner is signed. New proposals on duplicates do not replace the winner's JTI, expiry, or count.
4. **Conflict behavior:** recovery does not explicitly compare every recovered authority field to the newly proposed authority. Broad `onConflictDoNothing()` may also suppress a conflict unrelated to the intended host key; failure to recover then throws. This is materially less strict than reference fulfillment's existing-authority validation. `privateApiEntitlementKey` in policy code is used by the test; production uniqueness comes from the database composite index, not that concatenated string.
5. **Receipt delivery:** authenticated owner must have a paid eligible order, payment hash, and existing matching entitlement. It reconstructs claims from the stored row and re-signs. Retrieval does not insert, reset, or extend a grant; it can return an exhausted/revoked/expired row's receipt if the paid-order checks pass. It is not renewal.
6. **Protected request:** authenticate session separately from bearer token. Verify token, locate persisted JTI, check row subject, supply route resource/policy and persisted intent/maximum as expected bindings. `redeemAccessReceipt` invokes `consume` only after binding succeeds.
7. **Atomic transition:** one Drizzle `UPDATE ... RETURNING` matches JTI and every command signed-authority field, requires not revoked/not exhausted, count below maximum, and `exp > command.current_time`. It increments count and sets stored exhaustion in that update. PostgreSQL serializes competing updates; no read-then-write allowance check grants success.
8. **Denial diagnosis:** zero-row update leads to a read by JTI: missing, mismatch, revoked, expired, exhausted, else concurrency conflict. This read explains denial; it never grants access. It may describe later state rather than the exact failed-update instant.
9. **Revocation/expiry:** persisted `revoked` is enforced, but no production revocation function/route was found. Expiry uses host command time here, not a database clock, and persisted not-before is not checked by this SQL. Both integrations use the core verifier for JWT expiry/not-before. FiberFlow's consumer does not independently test `expected_max_redemptions`; current call composition binds the maximum before consume. A reusable adapter must implement the full command contract rather than copy that omission.
10. **Response:** successful final use returns protected JSON with `exhausted: true`; subsequent consumption is denied. Missing bearer is 401, core system failure is 503, other redemption denials collapse to 403 `access_denied`. Some pre-core verifier errors are collapsed to verification denial and pre-core DB errors can escape the wrapper. Those are host implementation choices, not additional package result semantics.

The checked-in test `test/private-api-integration.test.ts` verifies signatures, policy, bindings, exhaustion and revocation using `AtomicTestStore:37-79`. Its issuance test at 167-189 simulates a stable-key race with a Map. Its final-slot test at 366-387 is in-memory. Preserve the separate real-PostgreSQL proof supplied in the handoff; do not mislabel these tests as that proof.

## 4. Reference app integration decomposition

| Source / function | Actual responsibility | Classification |
| --- | --- | --- |
| R `src/core/auth.ts:7-16`, `createAuthentication`; `src/server/auth.ts:9-12`, `authenticatedPrincipal` | GitHub OAuth, Better Auth sessions, identity | D; C ownership |
| R `src/core/purchases.ts:14-53`, `pendingPurchase`, `startCheckout` | Pending purchase/request-key recovery, Stripe Checkout initiation and attachment | C/D |
| R `src/core/stripe.ts:18-41`, `verifyStripeEvent`, `validateCheckoutAuthority` | Raw signature, test-only event, paid Session, metadata/reference, mode, quantity, amount, currency, card checks | D/C |
| R `src/core/stripe.ts:53-77`, `createStripeGateway` | Provider API, Price checks, provider idempotency, Session retrieval | D |
| R `src/core/http.ts:81-89`, webhook action | Verify event, initialize receipt configuration, retrieve Session, match ID, fulfill | C/D |
| R `src/core/fulfillment.ts:13-56`, `fulfillPurchase` | Purchase lock, business/event validation, create/recover durable authority, verify recovered authority, update paid/event records together | C transaction/authority; B persistence concepts; D SQL |
| R `src/core/database.ts:3-14`, `transaction` | Checked-out `pg` client; BEGIN/COMMIT/ROLLBACK/release | D general infrastructure, not FiberLatch-specific |
| R `src/db/schema.ts:43-57`; `migrations/0001_initial.sql`, `entitlements` | Immutable receipt authority, one entitlement per purchase, bounded count, revocation timestamp | B receipt-state data; C auth/purchase references and fixed-three checks; D schema |
| R `src/core/receipts.ts:13-18`, `claimsFromEntitlement` | Row projection and numeric conversion through core claim validation | B concept; D mapping; A builder |
| R `src/core/receipts.ts:20-32`, `createReceiptRuntime` | Signer/verifier configuration and signed probe verification | C setup; A imported crypto; E composition |
| R `src/core/receipts.ts:34-44`, `entitlementView` | Current count/remaining and revoked/expired/exhausted status display | C presentation; reusable mechanics only partly repeated |
| R `src/core/entitlements.ts:11-20`, `ownedEntitlement`, `retrieveReceipt` | Authenticated-subject-qualified read; reconstruct/sign same stored authority | C lookup authorization; B read/re-sign concept; A signing |
| R `src/core/entitlements.ts:22-55`, `createPostgresStore` | Conditional update, typed denial diagnosis, returned-row callback | B consume mechanics; D SQL; C callback/presentation need |
| R `src/core/entitlements.ts:57-76`, `profileWithEntitlement` | Validate JSON; owned lookup; redeem and inspect in host transaction; map result/status | C action and transaction; A imported orchestration |
| R `src/core/entitlements.ts:78-91`, `revokeEntitlement`, `workbenchState` | Idempotent revocation timestamp; purchase-history/status display | C administration and UI; D queries |
| R `src/core/http.ts:64-110`, `createApi`; `src/app/api/**/route.ts` | Session/origin/operator checks, bearer/body parsing, final HTTP behavior and Next.js routing | C/D |
| R `src/core/json-profile.ts`, `validatePayload`, `inspectPayload`; `src/core/policy.ts` | Protected JSON action, input budgets, resource/policy/three-use/24-hour choice | C |
| R `src/server/db.ts`; `src/db/migrate.ts` | Pool/Drizzle setup; explicit checksum-tracked migrations | D/C operational setup |

### Full lifecycle

1. **Authentication/checkout:** GitHub/Better Auth establishes user identity. `pendingPurchase` uses an advisory lock per subject to recover a created purchase and a server-generated checkout request key. Stripe gets a stable Checkout idempotency key. This is pre-entitlement purchase logic, not generic FiberLatch issuance.
2. **Trusted payment:** webhook verifies raw signed bytes and test-mode/event type, retrieves Session authority with line items, confirms Session ID, then calls fulfillment. `validateCheckoutAuthority` rejects unpaid/wrong-mode/incorrect business data. Stored expected Price/amount/currency and payment/session associations are checked under the purchase lock. The host decides that this is a qualifying paid purchase.
3. **Lookup/create/JTI:** `SELECT purchases ... FOR UPDATE` serializes fulfillment for that purchase. Read entitlement by `purchase_id`; only if absent generate `randomUUID()` JTI and persisted DB-clock timestamps. `UNIQUE(purchase_id)` is a second barrier. Grant is three uses over 24 hours. JTI is also the entitlement primary key, unlike FiberFlow's separate row ID.
4. **Duplicates/concurrent events:** repeated same or different Stripe event IDs recover the existing purchase entitlement. Event association is checked, and recovered canonical authority is checked against issuer, audience, user, intent, resource, policy, payment reference, grant, limit, lifetime and `nbf = iat`. Paid purchase and processed event ledger are committed with entitlement creation. A late failure rolls all of them back. Nothing refreshes authority/count on duplicate delivery.
5. **Delivery:** webhook persists without signing a customer receipt. Authenticated/origin-checked receipt POST later loads by JTI and subject, reconstructs all claims, and signs using core. Retrieval intentionally permits inspection of revoked/exhausted/expired grants; it changes no durable state.
6. **Protected request:** session/origin/bearer/body checks precede protected execution. JSON validation precedes consumption. `profileWithEntitlement` opens a host transaction, reads owned entitlement, and supplies subject from authentication, resource/policy/fixed limit from policy, and intent from stored purchase. It calls core with a store bound to that transaction client.
7. **Atomic consume:** single `UPDATE ... RETURNING` compares all command authority and optional expected maximum; requires non-revocation, persisted not-before reached, expiry after both host command time and database `clock_timestamp()`, and count below maximum. Increment and authoritative check happen together. Successful row is captured for the returned entitlement view.
8. **Exhaustion/concurrency:** exhaustion is derived from count rather than stored separately. Last allowed use succeeds with `exhausted: true`; later attempts cannot increment. A zero-row update only classifies denial, with a fresh database-clock check for expiry.
9. **Action/response:** successful deterministic inspection occurs in the same transaction before commit. Error paths throw/roll back where appropriate. The transaction ends before HTTP output is delivered. Fourth exhausted use is 409 `receipt_exhausted`, verification denial 401, other redemption denial 403, system failure 503. This app intentionally exposes more lifecycle detail than FiberFlow.
10. **Revoke/status:** operator-only route updates `revoked_at = COALESCE(revoked_at, now())`; it does not reset quota or expiry. `entitlementView` derives booleans and prioritizes revoked, then expired, then exhausted, then active. `workbenchState` joins purchase history and performs further entitlement reads. Those presentation/query choices do not imply a cross-app status API.

R `tests/integration.test.ts` supplies actual SQL/HTTP fixtures for repeated-event preservation (159-172), 24 concurrent fulfillments (174-179), late rollback/retry (180-189), ownership/retrieval/revocation (191-209, 232-239), three-plus-one exhaustion (240-254), and 32 concurrent final-slot requests (255-262). These call the actual application consumer, not an in-memory substitute. Its `scripts/test-postgres.ts` can start isolated real PostgreSQL. The user separately records completed real-provider/Neon acceptance; none needs restarting for this audit.

## 5. Cross-implementation comparison

Entries describe inspected implementation, not an assumed full feature set. Evidence locators refer to functions decomposed above.

| Capability / burden | FiberFlow | Reference app | Already in access core? | Host-specific? | Reusable candidate? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Stable entitlement identity | Order + payment + resource unique tuple; separate row ID | Unique purchase; JTI primary key | No business identity | Yes, cardinality/key meaning C | Pattern B; no common helper now | F schema:171-208 / issuance:155-194; R schema:43-57 / fulfillment:17-42 |
| JTI generation | UUID proposed on each issuance attempt | UUID generated only when missing under purchase lock | Accepts JTI; does not generate | Host decides when to create | No separate UUID tool | F issuance:138-153; R fulfillment:32-40 |
| JTI persistence | Unique JTI on durable row, recover winner | Primary-key JTI reused | No | Physical storage D; identity C | B data contract; host insert remains | F schema / issuance:176-196; R schema / fulfillment |
| Duplicate-event idempotency | Unique intended-grant key; event ID not used for entitlement dedupe | Unique purchase plus event ledger; same/different event IDs reuse | No | Yes, provider events and business key | Mechanism repeats; generic event helper not justified | F webhook:38-54 / issuance; R fulfillment:27-53 / tests:159-172 |
| Concurrent duplicate issuance | Conflict-safe insert and winner read | Purchase row lock and unique purchase entitlement | No | Transaction/key choice differs | B invariant; defer create-or-get API | F issuance:155-194; R fulfillment:17-42 / tests:174-189 |
| Durable entitlement record | Full authority + count + two flags | Full authority + count + revocation timestamp | No | Order/auth foreign keys and fixed-three schema C | B neutral receipt-state shape | F schema:171-208; R schema:43-57 / migration |
| Claim authority persistence | All canonical fields projected from stored row | All canonical fields, numeric conversions | Validates claims, no storage | Row naming/types D | B schema contract; no new claim validator | F claimsFromEntitlement:88-104; R receipts:5-18 |
| Receipt retrieval | Paid owner/product/order/payment/resource read | Subject/JTI read; return lifecycle view | No route or lookup | Yes C/D | B read pattern; no universal retrieval authorization | F receipt route; R ownedEntitlement / HTTP receipt |
| Receipt re-signing | Sign stored claims | Sign stored claims | Yes, signer already does this | Lookup/delivery C; row map D | Reuse A; no separate re-sign API | F signEntitlement:106-109; R retrieveReceipt:17-20 |
| Revocation state | Boolean enforced; no production writer found | Timestamp enforced; operator writer exists | Typed denial only | Who/why/revoke authorization C | B consumption enforcement; writer not repeated | F consume:238,277; R store:28,48 / revoke:78-82 / HTTP:104-107 |
| Expiry enforcement | JWT verification plus host-time SQL comparison | JWT verification plus host and DB-clock SQL checks | Yes JWT; no durable decision | Lifetime/clock policy host-configured | B authoritative SQL enforcement; clock semantics must be explicit | C verifier:264-271; F consume:241,278-280; R store:28-30,49-50 |
| Not-before enforcement | JWT verifier; no persisted SQL guard | JWT verifier and persisted not-before SQL guard | Yes JWT | Desired persistence guard differs | Optional stronger store guard using row; no full signed-nbf comparison | F consume; R store:28; C command:3-23 |
| Redemption count | Integer starts at zero, SQL increment | Integer starts at zero, SQL increment/check constraint | Contract only | Storage D | Strong B | F schema:193 / consume:223; R schema:51,55 / store:25 |
| Atomic consume | Conditional UPDATE RETURNING | Conditional UPDATE RETURNING in host transaction | Orchestrates one store call; no SQL | DB-specific D, semantics generic B | Strongest B; Postgres-specific implementation | F consume:219-286; R createPostgresStore:22-55 |
| Final-slot concurrency | Conditional bounded update; handoff PG proof; checked-in test is memory | Conditional bounded update; actual PG test 32 contenders | No concurrency primitive | PostgreSQL execution D | Strong B; new adapter requires its own proof | F consume / test:366-387; R store / tests:255-262 |
| Authority mismatch checking | Command fields compared in UPDATE and diagnostic read; expected maximum not independently checked | Same plus optional expected maximum in both paths | Signed-to-expected binding yes; persisted equality no | Business issuance validation C; store equality B | B exact command comparison | C command/redeem; F consume:228-237,263-275; R store:26-33,41-46 |
| Exhaustion | Persisted flag plus count | Derived from count | Typed last-use/success/denial shape | Flag choice E/D | B bounded-count semantics; avoid redundant flag | F consume:224,239-240,281; R store:30,36,51 |
| Authenticated subject binding | Session user -> row ownership -> expected subject | Session user -> owned lookup -> expected subject | Equality yes; authentication no | Identity C/D | Use A; host must supply trusted subject | F session / redemption:315-324; R server/auth / profile:60-64 |
| Resource binding | Route constant and stored authority | Route constant and stored authority | Yes A | Resource meaning C | No new helper | F redemption:324 / consume:233; R profile:63 / store:27; C bindings |
| Policy binding | Route policy constant and persisted policy | Same | Yes A | Business-policy meaning C | No new helper | F redemption:325 / consume:234; R profile:63 / store:27; C bindings |
| Intent binding | Persisted entitlement intent after owner lookup | Persisted purchase ID after owned lookup | Equality yes A | Which intent qualifies C | No generic intent resolver | F redemption:326; R profile:63; C bindings |
| HTTP result mapping | Generic 403 for redemption denials; system 503 | 409 exhausted, 401 verification, 403 other, 503 failure with view | Typed results, no HTTP | Yes C/D; intentionally differs | No universal mapper | F protected route:27-43; R profile:65-74 / safeRoute |
| Payment verification | HMAC and invoice/order/hash/status matching | Stripe raw signature and fetched/stored Checkout authority | No | Yes C/D | Must remain outside | F fiberflow / policy / webhook; R stripe / fulfillment / HTTP webhook |
| Authentication | Better Auth email/password and sessions | GitHub OAuth/Better Auth sessions | No | Yes C/D | Must remain outside | F auth/session; R core/auth / server/auth |
| Protected-resource business action | Private JSON response after success | Input-limited deterministic JSON inspection | No | Yes C | Must remain outside | F private-api route; R json-profile / profileWithEntitlement |

## 6. Repeated integration burdens, ranked

1. **Very strong: authoritative PostgreSQL consumption.** Ten command authority comparisons (JTI plus nine authority fields), immutable maximum/expiry, revocation, count bound, increment, last-use result, zero-row denial. This is nearly the same state machine expressed once in Drizzle and once in parameterized SQL. Highest security value to remove from host code.
2. **Strong: durable receipt-state shape.** Both store canonical claims, stable JTI, count and revocation. Business linkage, flags, numeric types and constraints differ. A neutral schema belongs with the consumer so hosts do not invent the authoritative fields independently. That does not justify absorbing purchase/order tables or automatic migrations.
3. **Strong invariant, weaker abstraction: create once and recover original authority.** Same intended grant must not receive a new allowance after a duplicate. Mechanisms and conflict validation differ substantially. Document/test the invariant, but keep business dedupe and fulfillment transactions host-owned for the first extraction.
4. **Repeated but small: reconstruct and sign persisted claims.** Both use the existing builder/signer. Most repetition is column renaming and numeric conversion. A standard row shape helps, but a new receipt lifecycle API mostly relocates a tiny projection.
5. **Partial: retrieval/status/revocation operations.** Ownership-qualified reads repeat; their authorization and addressing do not. Count-based exhaustion repeats, but a complete status view and revocation writer occur only in the reference app. Do not pretend that all lifecycle CRUD is independently proven.
6. **Weak/no extraction: composition and result handling.** Cached runtimes, wrapper functions, environment parsing, UI joins and HTTP denial mapping are small or divergent. These are not evidence for an umbrella SDK.

Repeated *concept* does not automatically mean repeated *portable implementation*. A PostgreSQL component is provider-specific infrastructure by design (D implementation, B semantics); that is acceptable as an optional component, not as a new dependency of the core.

## 7. PostgreSQL adapter verdict

**BUILD, BUT NARROWER THAN EXPECTED.** Build only the authoritative receipt-state consumption implementation and its explicit schema contract. Do not build a payment entitlement manager.

### What can be standardized

| Concern | Safe adapter responsibility | Required boundary |
| --- | --- | --- |
| Existence | Find authoritative row by stable JTI; missing is denial | Never implicitly insert from a bearer token |
| Persisted authority | Compare every signed-authority field supplied in `AccessReceiptConsumeCommand` | No claims about comparing absent `iat`/`nbf`/payment reference |
| Revocation | Deny when stored state is revoked | Host chooses who/why/when to revoke and performs authorized write |
| Expiry | Guard increment using persisted/signed equal expiry and trusted time; explicitly define DB clock safeguard | Lifetime/clock provisioning remains host-owned; guard must survive lock waits |
| Not-before | Enforce stored not-before before increment, in addition to core JWT verification | Command has no signed nbf; use current outcomes without inventing a new core denial type |
| Maximum/count | Immutable positive bounded maximum, count starts at zero, enforce `0 <= count <= maximum` | Host chooses 1, 3, 10, 100, etc.; no fixed-three application check |
| Exhaustion | Derive from returned count; final consumption is success with exhausted true | Do not deny the last allowed use; do not maintain a second exhaustion flag |
| Atomic increment | Conditional bounded UPDATE RETURNING, with all checks in authorization transition | A prior read is not authorization; zero rows never means success |
| Concurrent final slot | At most one committed success when one use remains | Demonstrate against actual PostgreSQL with multiple connections/processes |
| Typed store outcomes | Existing consumed/denial/system-failure vocabulary | Diagnostic read may reflect newer state, never retroactively grant |

The current contract is sufficient. A future adapter must honor `expected_max_redemptions` independently, unlike FiberFlow's local consumer. This is equality, not permission to enlarge or rewrite persisted allowance. Both supplied maximum and optional expected maximum must match durable authority.

Stored not-before denial needs a documented mapping under 0.1.1: an unreached authoritative validity window must deny without increment; with no `receipt_not_yet_valid` store outcome, reserve `authority_mismatch` for this case and document it. Usually the verifier rejects first. Do not misdescribe it as expiry or routinely use concurrency conflict for a time condition. A different public reason would require later core API work and is outside the first scope.

### What cannot be standardized safely

The adapter cannot choose one entitlement per purchase versus per order/payment/resource, verify provider events, resolve application users, authorize receipt retrieval/revocation, determine pricing/renewal, decide protected work, or know whether fulfillment and business writes should commit together. It cannot promise exactly-once external action or successful HTTP delivery. It cannot infer valid claim authority from receipt syntax or from `payment_ref`.

### Compatibility cost must be explicit

FiberFlow uses Neon HTTP through Drizzle (`lib/db/index.ts`); the reference uses `pg` SQL with checked-out transaction clients (`src/server/db.ts`, `src/core/database.ts`). Do not mistake shared PostgreSQL for shared JavaScript database/transaction APIs.

The smallest prospective store accepts a host-provided parameterized-query executor returning rows; a `pg` client and a Neon SQL call can each supply that small bridge. All calls for a transaction-bound instance must execute on the same host-controlled transaction connection. It does not create pools, release clients, BEGIN/COMMIT, or retry consumption. For pool/HTTP use, each update is independently committed according to that executor. Neon HTTP use must not be advertised as supporting interactive host transactions through this bridge.

A fixed neutral table contract is preferable to arbitrary ORM expressions, dozens of column mappings, flag adapters, or introspection. Existing apps would need explicit schema adoption and host linkage/migration work; this is **not** a drop-in replacement for either current table. If that adoption cost exceeds the reduction, kill the component or remain with existing documented patterns. No migration is authorized by this audit.

## 8. Lifecycle helper verdicts

These verdicts are independent; recognizing a repeated pattern does not approve its API.

| Candidate | Repeated in both? | Generic / provider-independent? | Database-independent? | Safe to standardize and real reduction? | Verdict / authority risk |
| --- | --- | --- | --- | --- | --- |
| `createOrGetEntitlement()` | Yes as outcome; mechanisms differ | Only after caller supplies trusted canonical grant and exact intended-grant identity | An interface could be, implementation is not | Potentially substantial, but must handle host transactions and compare conflicts; callbacks can leave nearly all work host-side | **DEFER.** No common key/cardinality/recovered-authority semantics. A generic method must never derive trust or renew on conflict |
| `getEntitlement()` | Yes as owned lookup concept | Bare row read is generic; retrieval eligibility is not | Repository abstraction possible, mostly delegates query | Little reduction; both require different ownership/paid-product qualifications | **NO standalone first helper.** Host read against documented receipt-state shape; do not equate lookup with authorization |
| `issueReceipt()` | Both build/sign; webhook signing timing differs | Core signer is already generic | Yes for pure signing; no for create/persist/sign lifecycle | Pure version duplicates core; lifecycle version imports create/commit policy | **REUSE CORE.** Persist winner, then sign; no new wrapper API |
| `retrieveReceipt()` | Yes read/project/sign, with different routes/checks | Pure reconstruction/signing yes; delivery/ownership not universally generic | Projection can be; reads depend on persistence | Saves a few projection lines while all meaningful route checks remain | **DEFER/KEEP HOST-SIDE.** Standard schema plus existing signer addresses useful part |
| `revokeEntitlement()` | Enforcement yes; writer only R | Opaque JTI state write is mechanically generic; revocation authority is not | Only via another repository interface | No independently repeated writer to justify lifecycle API now | **NOT YET JUSTIFIED.** Store enforces persisted revocation; operator/refund policy stays outside |
| `getEntitlementStatus()` | Count/exhaustion yes; complete status function only R | Primitive facts generic; precedence/presentation/clock needs differ | Pure function possible if caller supplies row/time | Small; F stores exhausted while R derives it; R view can label future-nbf grants active | **NOT YET JUSTIFIED.** Do not turn display state into authorization |

`createOrGetEntitlement` is the most plausible later helper. Before approving it, prove a caller-supplied opaque intended-grant key, immutable trusted grant input, winner/conflict verification, transaction participation, and useful code removal in both integration styles. Database independence obtained by asking hosts to implement those same operations is not progress.

Generic UUID generation is already `node:crypto.randomUUID()`. Re-signing is already the existing signer. Do not publish thin utilities around either just to enlarge the toolkit.

## 9. API ergonomics verdict

**No new composition API in the first extraction.** Both integrations construct signer/verifier once and call the existing redemption function. R caches those dependencies in `src/server/api.ts`; F caches a runtime promise. Those lifetimes and deployment configuration are host choices.

| Proposed concept | Evidence / real benefit | Verdict |
| --- | --- | --- |
| `createFiberLatch({...})` | Could bundle two factories and a store, but both apps still need different lookup, policy, session, transaction and response handling. Separate signing and verification services need different key privileges | Not justified now. It risks bundling private keys into resource services and hiding where trust/transactions live |
| `fixedUses(3)` | Both supply `multi_redemption` + 3; builder already validates consistency. No observed repeated algorithm beyond two fields | Do not implement. Could be a later tiny convenience only if repeated grant-shape mistakes are demonstrated; no evidence for a new product layer |
| `singleUse()` | Core supports it and F memory concurrency test uses it; neither production integration issues a single-use grant | Not justified by these integrations. Existing `{ grant_type: 'single_redemption', max_redemptions: 1 }` suffices |

There is no evidence that the claim builder is the dominant integration burden. Persistence correctness is. Scope/subject/intent/time/key inputs should remain visible; an API cannot infer them from a payment payload safely.

## 10. Proposed minimum toolkit

One optional component beside the existing core, with two inseparable parts rather than multiple lifecycle packages:

```text
host trust + business fulfillment + authenticated context
                 |
                 v
@fiberlatch/access 0.1.1          optional PostgreSQL receipt-state store
claims / sign / verify / bind --> AccessReceiptStore.consume
typed redemption result <------ authoritative bounded transition
                 |
                 v
host commits intended work and chooses final response
```

### Prospective `createPostgresAccessReceiptStore(...)`

- **Purpose/responsibility:** implement existing `consume(command)` over authoritative receipt rows; compare command authority; enforce state/time/count; record one bounded use; return existing typed outcome. Constructor inputs are trusted query executor and explicit table/schema location, not payment/auth SDKs or arbitrary callbacks that decide authority.
- **Why FiberLatch:** this is the precise core persistence contract independently implemented in F `consume:219-286` and R `createPostgresStore:22-55`. A maintained implementation removes repeated access-critical SQL without taking the business trust decision.
- **Host-owned:** database provisioning/credentials/pools, transaction boundaries and rollback, pre-trusted grant insertion, intended-grant uniqueness, reads/delivery, authorized revocation, signing key operations, principal/policy selection, resource action, final HTTP decision.
- **Dependencies:** existing access types/API compatibility and PostgreSQL protocol through a caller-supplied query executor. A normalized executor can avoid introducing a mandatory ORM, `pg` runtime, Neon package, provider SDK, or crypto implementation. Exact executor typing/module packaging requires implementation review; it is not established by this audit.
- **Major risks:** wrong query executor/connection behavior, ambiguous SQL identifier handling, schema adoption cost, numeric conversion, diagnostic races, clock checks after lock waits, errors after consumption, and authorization code mistakenly treating transaction-local success as committed success.
- **Breaking change:** none to access 0.1.1. Opt-in host schema/connection adoption can be invasive and must not be advertised otherwise. Existing hosts can retain custom stores.
- **Core modification:** none. No new consume fields, counts in result, or denial taxonomy required for first scope.

### Companion documented receipt-state contract

- **Purpose:** a neutral durable row shape for immutable canonical authority plus `redemption_count` and `revoked_at`, with unique/primary JTI and generic validity/grant/count constraints. Use persisted `nbf` for additional validity guard and store all claims needed for host reconstruction. `payment_ref` must permit null for nonpayment permission grants. Subject/intent/resource/policy are opaque identifiers, without mandatory payment/account foreign keys.
- **Evidence:** both existing tables store that authority/state, but F order relationships and R purchase/fixed-three/auth checks are app-specific. All command equality fields must have defined SQL types and driver conversions.
- **Host-owned:** intended-entitlement identity must have a separate host-selected unique constraint/link; primary JTI alone does not deduplicate trusted events. Host applies explicit SQL migration, persists canonical claims once, and preserves JTI/times/maximum/count on retrieval/duplicates. Issuance and business linkage should use one authority record, avoiding unsynchronized shadow counters.
- **Dependencies/risks:** PostgreSQL DDL only; risk of unbounded schema compatibility demands and destructive adoption. A safe numeric domain for times/counts and single/multi consistency must be explicit; supporting 3/10/100 does not mean unlimited integer sizes.
- **Breaking/core change:** no access change, no automatic migration, no framework-generated schema, no new runtime lifecycle helper. Treat this as part of the single store component, not a second independently approved toolkit module.

These are prospective design boundaries, not implemented APIs. Package naming, publication and migration remain out of scope.

## 11. MUST REMAIN HOST-OWNED

| Concern | Boundary and evidence |
| --- | --- |
| Payment verification and interpretation | F webhook/HMAC/invoice matching; R Stripe raw signature/Session checks. FiberLatch accepts only a host-trusted grant |
| Fiber invoice/settlement verification | F decides which invoice/hash/status corresponds to the order; no Fiber RPC or infrastructure work belongs in adapter |
| Stripe webhook verification | R `verifyStripeEvent`/gateway/fulfillment; no Stripe dependency in FiberLatch |
| Authentication and user/session management | F Better Auth email/password; R GitHub OAuth/Better Auth. Receipt subject never establishes authenticated caller |
| Pricing, quantity, eligible products | F private API product eligibility; R Price/amount/currency/card policy. Library cannot infer allowance from money |
| Resource and business-policy meaning | Hosts choose opaque identifiers, route action, maximum and lifetime; core checks equality, not policy meaning |
| Intended grant identity and business idempotency | F order/payment/resource versus R purchase. Host must prevent new-JTI duplicate grants |
| Protected resource and input validation | F private response; R JSON validation/inspection. Library does not execute it |
| Final allow/deny and HTTP result mapping | Host may deny despite successful receipt checks; F generic 403 and R detailed 409 illustrate nonuniform output |
| Subscription billing | Neither integration implements it; no repeated evidence, no billing ownership |
| Renewal, refund, chargeback and cancellation rules | Duplicate delivery/retrieval must not renew; only an explicit newly trusted host decision can grant new allowance |
| Payment provider SDKs | Stay in integration projects, including FiberFlow HTTP and Stripe SDK |
| Revocation authorization/reason | R operator IDs; F lacks production writer. Toolkit may enforce state, never decide revocation entitlement |
| Database operation and transaction scope | Host provisions/migrates/binds clients, manages commits/backups/retention and user/order relations |
| Key generation, custody, trust distribution and rotation | Core validates/uses supplied trusted keys; host controls them and old-key retention |
| Delivery retries and external side effects | A committed use can outlive a lost response; no generic consume refund/retry or exactly-once business action |

This optional component would move implementation of selected database mechanics into FiberLatch. Ownership of the database, authoritative inputs and business decisions remains with the application.

## 12. Estimated integration reduction

Counts are physical source lines at the inspected commits, including imports/blanks/wrapping. They are evidence bounds, not a promise of net deletions. Drizzle's formatting inflates F relative to R's compact SQL. No security conclusion depends on total LOC.

| Measured area | FiberFlow | Reference app | Interpretation |
| --- | --- | --- | --- |
| Primary entitlement integration | `private-api-access.ts`: 333 lines | `entitlements.ts` 91 + `receipts.ts` 46 + `fulfillment.ts` 56 = 193 lines | Includes host logic/configuration; not all removable |
| Related policy/transaction files | Policy 39 + constants 7; not counted as portable | Transaction 14; policy 15; not counted as portable | General plumbing/app decisions, not automatic extraction |
| Entitlement table definition | Schema lines 171-208: 38 | Schema lines 43-57: 15; migration SQL has equivalent table | Shared data concepts, different constraints/format |
| Atomic consumer implementation | Lines 219-286: 68 | Lines 22-55: 34 | **102 directly measured lines** of repeated consume/diagnose functions |
| Issuance workflow | Lines 117-197: 81 | Fulfillment lines 13-56: 44 | Contains most host business authority and transaction semantics; not approved deletion |
| Row -> canonical claims | Lines 88-104: 17 | Receipts lines 13-18: 6 | Only 23 measured projection lines; much smaller than consumer/persistence |
| Retrieval | Query lines 199-217: 19 plus receipt route 51 | Owned/read/sign lines 11-20: 10 plus HTTP receipt action | Authorization/delivery stays; only bare storage/projection mechanics comparable |

There are two independent implementations of the same bounded UPDATE/state-diagnosis logic. Ten signed command fields include JTI lookup plus nine authority fields; R additionally honors optional expected maximum. They both independently maintain count/expiry/revocation and reconstruct stable claim authority. They do not duplicate the core's signature or binding implementation; they import it.

**Defensible first target:** replace most of those 102 consumer lines with store construction/connection bridging, likely leaving roughly 5-15 integration lines per app plus host reads for any returned state. Conditional on feasible schema adoption, that suggests about **70-90 source lines of consumption mechanics across both apps**, not 300-500 lines of entitlement workflow. This is a prospective estimate, not a measured refactor. A query bridge, migration, canonical row mapping and R's success-state handling can lower or eliminate the net LOC saving.

R's existing `onConsumed` callback returns the updated row for UI. The core result exposes only `exhausted`, not counts. The narrow adapter need not reproduce callback semantics: the host can query committed/transaction-local state for a view, but a later concurrent count can differ from the exact consume snapshot. If preserving an exact returned-row view requires substantial extra plumbing, count that against adoption savings rather than expanding core by assumption.

The value is deleting repeated **security-critical equality/update/error code**, not pretending purchase trust, receipt routing, authentication, or deterministic inspection disappear. Host issuance remains approximately 81/44 lines in these measured spans; no credible further reduction is established by this audit.

## 13. Risks and failure modes

1. **JTI uniqueness mistaken for business idempotency.** A new JTI per duplicate event still creates unlimited independent grants. Adapter correctness does not solve host intended-grant cardinality.
2. **Sign proposal rather than persisted winner.** FiberFlow correctly signs the recovered row, even after making a fresh proposal. Any helper that signs losing proposals or resets time/count silently enlarges authority.
3. **Conflict recovery without authority validation.** F recovers by business key with no full explicit conflict comparison; R performs stricter comparisons. A generalized issuance helper could normalize the weaker behavior. Do not copy either application's business validation into a universal rule without evidence.
4. **Consumption command is narrower than canonical claims.** It cannot compare signed payment reference/iat/nbf because those are absent. State that limit; do not demand or promise verification the current contract cannot perform.
5. **Expired-at-execution and lock waits.** F relies on host time; R adds DB time. A new store must explicitly test time boundaries and waiting contenders, not assume the timestamp captured before blocking still describes eligibility after acquiring a row. DB clock use must not accidentally extend expiry or weaken not-before.
6. **Redundant exhaustion state.** F's flag and count must stay synchronized. A canonical component should derive exhaustion from count; do not import a second mutable flag as universal state.
7. **Fail-open interpretation of zero-row updates.** A diagnostic read is not a second chance to approve. Race diagnosis can be stale; correct admission must not depend on it.
8. **Transaction-local consumed mistaken for committed success.** R requires rollback on failure and commits before output. Adapter must not own nested commit/release or obscure aborted transactions. SQL error must fail closed even when core catches the store exception.
9. **Commit or HTTP ambiguity.** A connection loss after commit may leave a use recorded with no client-visible success. Neither core nor adapter should automatically retry consumption. Receipt JTI is not a per-request idempotency key; exactly-once delivery requires a separate host design.
10. **External effects cannot roll back with PostgreSQL.** R's deterministic inspection is local; F's response is simple. These do not justify a generic execute-protected-action transaction API.
11. **Canonical schema adoption costs.** F and R have different foreign keys, identities, flag representation and drivers. An adapter that needs a shadow row plus complex sync can be more dangerous than either local store.
12. **Numeric/database validation gaps.** F schema lacks the explicit grant/count/time checks present in R; R's limit is fixed at three. A neutral schema must use generic constraints and safe driver conversion rather than blindly copy either. Core claim validation must still run before host insertion/signing.
13. **Display status mistaken for access authority.** R status precedence and lack of a future-not-before status show why a generic `active` label is insufficient. Time/revocation/count must be checked in the transition.
14. **Result taxonomy/HTTP coupling.** Expiry often fails verification before consumption, so no universal promise of `receipt_expired` or HTTP 409 for all invalid lifecycle states is valid. Application detail disclosure differs intentionally.
15. **Test confidence overstated.** F checked-in tests are memory-based. R tests use real SQL but fixture providers. A future shared adapter still needs its own database, executor and transaction verification; supplied acceptance of existing apps does not prove a new component.
16. **Convenience facade expands key privileges.** Signing and verification belong to different service roles in many hosts. A unified runtime with mandatory private key can spread unnecessary signing authority.

These are constraints on the extraction, not authorization to repair application code during this audit.

## 14. Kill criteria

| Candidate | Do not build / stop when |
| --- | --- |
| PostgreSQL consume adapter | Correctness requires paid-order/purchase/auth schema knowledge; query bridging recreates nearly all existing consumer logic; canonical adoption demands a second unsynchronized authority; both examples cannot preserve semantics without substantial custom SQL; schema/driver maintenance outweighs measured security-code removal; unknown execution outcomes require automatic retries; real-PG final-slot/revocation/expiry/rollback cases cannot be proven under the supported executor modes |
| Companion receipt-state contract | It mandates a payment provider, user FK, fixed resource/limit/lifetime, business dedupe key or implicit migration; claim/state conversion is ambiguous; count and exhaustion have two writable sources of truth; its types cannot safely represent supported core values |
| Later `createOrGetEntitlement` | Host still supplies conflict SQL/lock/identity/authority comparison equivalent to current code; helper owns payment trust or guesses event/business cardinality; it signs before durable outcome; duplicate recovery changes quota/time; cannot participate in host transaction |
| Lookup/retrieval/receipt helpers | Mostly call an injected host getter and existing signer; expose receipt authority without explicit ownership authorization; impose paid status/provider model; migration/mapper burden exceeds tiny projection reduction |
| Revocation helper | Still only one operational implementation; assumes who may revoke/refund; erases count or remints grant; requires auth/administrator provider dependency |
| Status helper | Display precedence differs, not-before/clock facts are incomplete, or callers treat a read-time `active` status as authorization; saves only a few lines without reducing dangerous logic |
| `createFiberLatch` facade | Requires signing key on verifier-only services, hides expected-context provenance, scopes transactions implicitly, or saves only factory wiring while all lifecycle code remains |
| `fixedUses` / `singleUse` | Only renames two validated core fields; no observed errors or repeated grant-building burden; introduces a policy language or new dependencies for cosmetic brevity |

Deferral is intentional. These criteria do not turn rejected helpers into an approved roadmap or justify building multiple packages first.

## 15. Scope freeze recommendation

The exact smallest first implementation to undertake **after this audit**, if the kill criteria permit, is:

1. One optional PostgreSQL store factory implementing the unchanged 0.1.1 `AccessReceiptStore.consume` contract against one documented neutral table shape, through a small caller-owned parameterized-query executor. Limit identifier configuration to explicitly trusted/validated schema/table names; no introspection or arbitrary ORM schema mapping.
2. One explicit companion SQL schema contract/example: immutable canonical claim authority, unique JTI, count, revocation timestamp, generic single/multi/limit/count/time checks. Host applies migrations and supplies its own business identity/linkage; no automatic table creation, FK to payment/auth models, JTI regeneration, renewal, or CRUD lifecycle service.
3. One atomic consumption transition with all command equality checks, expected-maximum equality, persisted validity/revocation/count guards, update-result exhaustion and fail-closed typed outcomes. No retries, key management, payment verification or final business action.
4. Prospective acceptance tests against actual PostgreSQL: limits 1/3/10/100; missing/mismatch/revoked/expired/not-before; optional expected maximum; final-slot contenders on multiple connections; lock-wait clock behavior; rollback and unknown/error outcomes; retrieval/deduplicated issuance preserving authority through host code. Tests must exercise actual shared adapter, not a Map. Verify pool/autocommit and transaction-client modes separately; a Neon query bridge's limitations must be tested/documented before claiming compatibility.
5. Demonstrate prospective migration effort in both integration styles and measure net removed authority/SQL logic, including host success-state views. If adoption preserves no meaningful reduction, stop instead of widening the API.

Exclude all lifecycle helpers, facades, use-grant conveniences, provider/framework adapters, subscription/renewal policy, hosted service, background workers and new access release from this first scope. No change to `@fiberlatch/access@0.1.1` is needed or recommended. No current integration needs modification to preserve its completed acceptance.

## 16. Final PM classification and plain-language boundary

**B. ONE NARROW REUSABLE COMPONENT JUSTIFIED.**

For a Node developer who already trusts a payment or permission event and wants to give someone 3, 10, or 100 uses, FiberLatch should handle validating and signing the scoped grant, verifying it later, checking it against the authenticated subject and host-supplied resource/policy/intent, and returning typed redemption results. An optional PostgreSQL store should also handle the difficult database mechanics: durable receipt-state shape, authority comparison, revocation/validity enforcement, counting uses, atomically admitting the last use, and denying exhausted grants across concurrent processes.

The developer should still own the trusted event, authentication, how that event maps to exactly one intended grant, the user's allowance and expiry, durable create-once fulfillment and its transaction, authorized receipt retrieval/revocation, resource meaning and execution, renewal/refund rules, database/key operation and final HTTP decision. They should persist the original authority once and sign/retrieve that same authority without replenishing it. They should not have to independently invent the bounded-consumption SQL every time they adopt FiberLatch.

That boundary supports one optional production persistence component while preserving the existing product and its explicit trust decisions. Keep the stable access package at 0.1.1; no broader toolkit or redesign is established by the available implementations.
