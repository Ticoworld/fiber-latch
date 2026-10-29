# Historical FiberLatch service status

29 October 2026. Historical service network retirement.

## Operational status

The historical Fastify/Prisma service under `src/` is **not approved for operational
paid-resource authorization**. Its network-serving path is retired. It remains
historical/reference material for receipt lifecycle tests and demonstrations.

The service accepts caller-selected payment references, subjects and resources.
Its Fiber adapter checks payment status without independently establishing:

- which authenticated purchaser owns the intended purchase;
- whether the expected amount and asset were paid to the intended recipient;
- whether the payment/invoice belongs to that purchase and resource;
- whether the resulting entitlement is the one authorized purchase allocation.

There are existing uniqueness, signature, binding and redemption protections.
They do not supply the missing payment-to-purchase authorization. Available
review evidence did not establish an exposed deployment or live exploit.
Absence of deployment evidence is not proof that no deployment or private
consumer exists.

## Maintained packages are a separate boundary

`@fiberlatch/access@0.1.1` supplies receipt claims, signing, verification, trusted
expected-binding checks and redemption orchestration. The optional
`@fiberlatch/postgres-store@0.1.0` supplies atomic consumption of persisted authority.
Neither includes the legacy HTTP routes or Fiber adapter.

Before signing paid access, the integrating host must authenticate the purchaser,
establish trustworthy payment evidence, validate amount/asset and intended
purchase, and bind payment to subject, resource, policy, intent and one durable
entitlement. The host also owns key configuration, issuance idempotency, persistent
authority and the final resource decision. `payment_ref` is correlation metadata,
not payment proof. A signature does not synchronize quotas across independent
stores. See the [package guide](../packages/access/README.md).

This retirement changes no published package version, receipt format, export or
FiberFlow/FiberGate integration contract. It is not a finding that those receipt
packages contain the legacy payment-authorization defect.

## What this correction does

- Root `npm run dev` and `npm start` refuse server startup with a nonzero exit
  before application configuration, signing keys, Prisma or Fiber RPC are loaded.
  Both run a dependency-free refusal script, so they cannot execute a stale
  pre-retirement build and `dev` does not leave a watcher running.
- The historical `buildApp` uses an HTTP server whose `listen` operation always
  refuses. Fastify promise/callback listening and direct `app.server.listen`
  cannot bind a socket through that implementation, in fake or real mode.
- There is no environment variable, constructor option or command to opt back
  into network serving. `HOST`, `PORT` and `FIBER_CLIENT_MODE` do not enable it.
- The original route/service logic remains available through Fastify `inject`
  for controlled tests/demos. It is **still unsafe as an operational issuer**.
  Directly calling `FiberLatchService`, rehosting its handlers, replacing the
  server or reverting the patch does not acquire payment authorization.

This retires network exposure through the shipped entry point and app; it is
not a sandbox around historical source or a fix to its purchase-validation logic.
It does not stop an already-running process, invalidate an older built artifact,
revoke receipts, or change a deployment until an owner takes operational action.
An already-built pre-retirement `dist/server.js` must not be invoked directly; normal
`npm run build` produces the retired entry point. Old tags/checkouts remain
historical evidence, not alternate deployment instructions.

## Historical evidence and reproduction

Existing historical backend tests still run against isolated SQLite and Fastify
injection. Existing demos also use injection; they never require `listen`:

```sh
npm run prisma:generate
npm test
npm run demo:local-access
npm run demo:protected-resource
```

The local demos use synthetic payment status and disposable SQLite. Run them
only as controlled historical reproductions; do not substitute a real payment
or entitlement database. They do not demonstrate the missing purchase checks.

The preserved `fiberlatch-live-paid-proof` tag and original completion/acceptance
records remain unchanged. `demo:live-paid-issuance` is retained as an explicit
in-process historical testnet reproduction with its existing externally supplied
testnet prerequisites; it was not rerun for remediation. No new payment is needed
to validate retirement. See [demo proof](demo-proof.md) and
[historical testnet evidence](live-fiber-verification-blocker.md).

## Conditions for any maintained operational reuse

Do not restore the listener or add an “enable legacy” flag as the correction.
An identified maintained consumer needs an independently reviewed host-side
authorization boundary before both initial and reconciliation issuance:

1. Authenticate the purchaser or authorized internal principal; derive subject
   from trusted identity and check ownership of a server-owned purchase.
2. Resolve resource, policy, allowance, validity and price from trusted purchase
   state. Do not accept these decisions from the payment reference or request.
3. Store the intended invoice/canonical payment identity and recipient, exact
   expected integer amount, asset and network against that purchase. Validate
   trusted settlement evidence against all of them; outgoing-payment success,
   `Received`, missing/mismatched hashes and ambiguous statuses are insufficient.
4. Atomically allocate the purchase once and persist one authoritative entitlement;
   canonical payment/invoice and purchase uniqueness must prevent unauthorized
   reassignment. Scope idempotency to owner/purchase and compare retry bodies.
5. Apply the same checks during reconciliation; honor purchase/intent deadlines
   and active policy. Require owner-only retrieval and trusted request bindings
   at redemption. Retries must not refresh JTI, expiry or quota.

These are conditions on a specific maintained host, not a proposal for a new
payment platform or a change to the frozen receipt packages. No such operational
reuse or authorization implementation is part of this patch.

## Exposure and remaining uncertainty

The review found no primary-repository deployment configuration, no GitHub
deployment records, and no named current integration invoking the legacy endpoint.
The inspected FiberFlow and FiberGate integrations import the published packages;
the Stripe Reference application imports access plus its recorded internal
PostgreSQL adapter predecessor. These are bounded observations, not a complete
inventory of private clients or cloud infrastructure.

If active paid-resource use is identified, this is an immediate PM security
decision: the owner must contain unsafe issuance, identify running/old builds and
assess affected grants against trusted purchase records. Publishing a warning
or local patch alone does not contain that service. No live database or deployment
has been changed by this work.

This legacy-only correction does not release new npm versions or repair purchase
authorization. Owner-controlled deployments and private consumers still need to
be inventoried before operational exposure can be represented as resolved.
