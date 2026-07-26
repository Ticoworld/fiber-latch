# FiberLatch Access Reusable Package Design

## 1. Purpose
This document defines the smallest reusable Node package that lets a host application validate trusted access-receipt claims, sign receipts, verify received receipts, evaluate bindings, and atomically redeem access through host-owned persistence.

The package is intended for the paid-resource example required by the grant. It is not hosted infrastructure, a payment product, or a general web framework.

## 2. Design Constraints
- Local library, not hosted infrastructure.
- Node-focused and framework-independent.
- No Fastify dependency.
- No Prisma dependency.
- No SQLite dependency.
- No Fiber RPC dependency during receipt verification or redemption.
- No payment creation or routing.
- No payment settlement.
- No dashboard.
- No CLI.
- No React SDK.
- No checkout interface.
- No browser-wallet integration.
- No hidden network calls.
- Host owns final access enforcement.
- Host owns trusted issuer, audience, and key configuration.
- Host owns persistent replay, revocation, and exhaustion state.
- The package supplies safe cryptographic and policy rules.
- The existing backend remains a reference implementation and migration source.

## 3. Current Repository Baseline
The current repository is a backend-first CommonJS application that builds from `src` into `dist` with TypeScript targeting ES2022. Its runtime dependencies currently include `jose`, `zod`, `fastify`, and `@prisma/client`; the reusable package should keep only the cryptography and validation dependencies it needs.

The current code already proves the receipt shape, JOSE signing and verification path, host-side payment and policy orchestration, persistent storage, and the JWKS publication route. The package design should be extracted from that baseline rather than copied as a backend-shaped library.

The baseline also shows two important trust paths:
- the default generated-key path creates an Ed25519 key pair at runtime
- the configured private-JWK path currently imports trusted key material through generic EdDSA handling

That baseline is the source of truth for current behavior, but it is not yet the reusable package boundary.

## 4. Package Responsibility Boundary

| Capability | Package | Host application | Payment/Fiber tooling |
| ---------- | ------- | ---------------- | --------------------- |
| Payment creation | No | No | Yes |
| Payment verification | No | Uses the verification result | Yes |
| Payment-to-intent correlation | Carries trusted correlation metadata only | Yes | Yes |
| Claim construction | Validates and canonicalises trusted inputs | Prepares trusted inputs | No |
| Receipt signing | Yes | Loads trusted key material and calls the signer | No |
| Receipt verification | Yes | Supplies trusted verification keys and config | No |
| Issuer/audience checks | Yes | Supplies trusted expected values | No |
| Claim validation | Yes | Supplies trusted inputs | No |
| Subject/resource/policy/intent binding | Evaluates verified claims against expected host context | Supplies expected context | No |
| Receipt persistence | No | Yes | No |
| Revocation | No | Yes | No |
| Exhaustion | No | Yes | No |
| Atomic redemption | Orchestrates the trusted consumption boundary | Implements the atomic store adapter | No |
| Final access decision | No | Yes | No |
| Protected-resource response | No | Yes | No |

Payment must already be trusted before receipt issuance. `payment_ref` is correlation metadata, not payment proof. Signing does not prove correct payment verification. Cryptographic verification does not itself grant access. The host owns the database and the final access decision. The package must not require Fiber RPC during redemption.

## 5. Proposed Repository Location
`packages/access` is the recommended location.

This is the smallest clean location because it keeps the backend as the reference application, supports future npm packaging, isolates the package build and tests, and fits a normal workspace layout without forcing a second repository. `package/access` is less conventional, and a separate repository would split history and increase migration cost.

The directory does not exist yet. Workspace and configuration changes happen during implementation, not in this design task.

Repository isolation rules:

- `packages/access` will have its own package manifest.
- It will have its own isolated TypeScript build configuration.
- It will have package-specific tests and consumer fixtures.
- The root repository should use npm workspaces when implementation begins.
- The repository should retain one root lockfile.
- A separate package-level lockfile should not be committed unless a proven tooling limitation requires it.
- The reusable package must not depend on the backend root package.
- The backend reference application may depend on the reusable package.
- Dependency direction must remain one-way: `backend -> reusable access package`.
- The package must not import backend files through relative paths, TypeScript path aliases, or monorepo-only shortcuts.
- Package tests must prove that it works through its published entrypoint, not through backend internals.
- Workspace and root configuration changes happen only when package implementation begins.

## 6. Runtime and Module Compatibility

The package runtime and distribution model is frozen as:

- Source language: TypeScript
- Source module semantics: native ESM
- Published implementation: one ESM build
- Primary consumption: ESM import
- Supported compatibility consumption: CommonJS `require` on supported Node versions
- Browser support: excluded
- Public entrypoints: one root entrypoint

The package must not maintain separate ESM and CommonJS source implementations. It must not produce two independently maintained runtime implementations.

Minimum Node version: `22.12.0`

Initial verified Node release lines: Node 22 and Node 24

Node 22 is in Maintenance LTS.
Node 24 is in Active LTS.
Node 20 is outside the initial support policy.

This minimum is required because CommonJS compatibility depends on supported Node `require(esm)` behavior. The package must not claim support for every `Node >=22` version, and it must not claim Node 20 support. Node 26 is not part of the initial verified matrix while it remains a Current release.

The public entrypoint must not use top-level await. Both of these consumer forms must resolve to the same ESM implementation:

```ts
import {
  createAccessReceiptVerifier,
  redeemAccessReceipt,
} from "<package>";
```

```js
const {
  createAccessReceiptVerifier,
  redeemAccessReceipt,
} = require("<package>");
```

Expected future package metadata:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "engines": {
    "node": ">=22.12.0"
  }
}
```

The package exposes one root entrypoint only. Internal subpaths are not public exports. TypeScript should use a NodeNext-compatible or equivalent modern Node module-resolution strategy, emit JavaScript and declaration files, and keep one public declaration entrypoint. Relative source imports must follow valid Node ESM resolution. The package build must not rely on the backend root TypeScript configuration by accident. The packed artifact must be inspected before delivery.

Consumers use the root export only, never source-path imports.

Exact output filenames may change only if equivalent behavior is proven.

## 7. Runtime Dependency Budget

| Dependency | Runtime? | Purpose |
| ---------- | -------- | ------- |
| `jose` | Yes | Maintained JOSE cryptography for signing, verification, and header handling |
| `zod` | Yes | Package-owned schema validation for trusted claims, sanitised verified output, binding inputs, and result shaping |

The reusable package targets the maintained `jose` v6 major. `jose` is an ESM dependency, remains a normal runtime dependency, and must not be copied or reimplemented. It must not be bundled merely to hide compatibility issues. The package must verify compatibility against the selected v6 version before delivery. The backend may remain on its current JOSE version until backend integration work begins.

`zod` also remains a normal runtime dependency. Consumers should not be forced to provide or align their own Zod instance. Zod schemas must not become the primary public API. Public results should use ordinary TypeScript types and package-owned result objects. The selected Zod major should be pinned intentionally during implementation.

Excluded runtime dependencies include Fastify, Prisma, database clients, Fiber SDK or RPC clients, HTTP clients, logging frameworks, environment loaders, UI libraries, and any other backend-only infrastructure dependency.

## 8. Public API Surface

The initial public API stays deliberately small:

| Export | Purpose | Trusted and untrusted inputs | Result | Failures | I/O boundary | Security responsibility |
| ------ | ------- | ---------------------------- | ------ | -------- | ------------ | ----------------------- |
| `buildAccessReceiptClaims` | Build a canonical trusted claim object from host-provided facts | Trusted runtime, policy, payment-correlation, and binding inputs; no token input | Canonical claim object | Throws a package-owned validation error for invalid trusted input, missing or invalid trusted inputs, empty required fields, invalid time ordering, inconsistent grant fields | Pure | Trusted claim construction before signing |
| `createAccessReceiptSigner` | Create a signer bound to trusted private key material | Trusted private `OKP` JWK and trusted config; no untrusted token input | Signer function or object | Throws a package-owned configuration error for invalid key material, metadata, or header policy | Pure after construction | Trusted key use and protected-header construction |
| `createAccessReceiptVerifier` | Create a verifier for untrusted compact receipts | Untrusted token input plus trusted issuer, audience, and public keys | Sanitised verified claims | Throws a package-owned configuration error for invalid trusted keys, issuer, audience, limits, or token-size policy | Pure | Cryptographic verification and claim sanitisation |
| `evaluateAccessReceiptBindings` | Compare verified claims against host expected bindings | Sanitised verified claims plus trusted expected subject, resource, policy, intent, and optional redemption policy | Binding evaluation result | Typed binding denial for mismatch or missing required expected context; expected denials are returned, not thrown | Pure | Host-context authorisation precheck |
| `redeemAccessReceipt` | Orchestrate verification, binding evaluation, and atomic host consumption | Receipt token, expected host context, trusted verification material, trusted store adapter | Typed redemption outcome with separate verification, binding, consumption, and system phases | Verification denial, binding denial, consumption denial, or system failure; expected denials are returned as typed results | Host-owned I/O through the adapter | Host-owned persistent authority and atomic redemption |
| `AccessReceiptStore` | Type-only contract for the atomic trusted store boundary | Narrow trusted consumption command and trusted host context | Typed consume outcome | Missing record, revoked receipt, exhausted receipt, conflict, persistence failure | Host-owned I/O | Authoritative persistence and replay protection |

`AccessReceiptStore` is a TypeScript type-only public contract, not a runtime class. The package ships no HTTP handlers, no Prisma models, and no backend repository types. `redeemAccessReceipt` returns a typed package outcome with distinct verification, binding, consumption, and system phases, but never serves the protected resource itself. The host remains responsible for the final response.

Failure policy:

- `buildAccessReceiptClaims` throws a package-owned validation error when trusted input is invalid.
- `createAccessReceiptSigner` throws a package-owned configuration error when signer key material or metadata is invalid.
- `createAccessReceiptVerifier` throws a package-owned configuration error when trusted keys, issuer, audience, limits, or other trusted settings are invalid.
- Raw Zod or JOSE errors do not become the public error contract.
- Errors must not contain private keys, full tokens, or sensitive configuration.
- `evaluateAccessReceiptBindings` and `redeemAccessReceipt` return typed results for expected denials.
- Unexpected internal or persistence failures are reported separately as system failures.
- Framework-specific exception classes and HTTP responses remain host-owned.

## 9. Receipt Signing Boundary
The approved portable profile is:

- Algorithm: `EdDSA`
- Key type: `OKP`
- Curve: `Ed25519`
- Protected `typ`: `JWT`
- `kid`: required and checked against trusted key identity

The signer accepts already-loaded trusted private JWK material. For the initial package, the recommended input is a private `OKP` JWK with `crv: "Ed25519"`, a required non-empty `kid`, and the private component present. Environment-variable loading remains host-owned and is not part of the package boundary. PKCS8 and SPKI convenience support is not required for the initial grant package.

The signer factory rejects at construction time:

- missing key input
- non-object input
- `kty` other than `OKP`
- `crv` other than `Ed25519`
- missing or empty `kid`
- missing or empty public component `x`
- missing or empty private component `d`
- malformed JWK values
- unsupported key operations where relevant
- private key material that cannot be imported for `EdDSA`
- caller-supplied algorithm configuration other than the fixed package policy

The signer uses the fixed `EdDSA` algorithm, emits `typ: JWT`, emits the trusted non-empty `kid`, never exposes the private JWK through return values or errors, and fails during construction rather than failing later on the first signing attempt where practical. Do not add PKCS8, PEM, or raw-key support.

The signer validates the complete trusted claim object before signing. That includes:

- non-empty required strings
- required `payment_ref` member with explicit `null` permitted
- positive integer `max_redemptions`
- consistent `grant_type`
- `iat <= nbf < exp`
- trusted issuer and audience inputs
- trusted key type and curve

The signer must not accept a caller-controlled algorithm, must not create unsigned receipts, and must not log private key material or full tokens. Receipt signing does not prove payment verification and does not grant access by itself.

Configured non-Ed25519 EdDSA keys are outside the portable profile and require migration or explicit handling during implementation.

## 10. Receipt Verification Boundary
Token input is untrusted. Verification proceeds as a safe parse-and-verify pipeline:

The verifier factory accepts one or more trusted public JWKs. Each trusted key must be an `OKP` JWK with `crv: "Ed25519"`, a required non-empty `kid`, and a public component `x`. The verifier factory rejects:

- missing key collection
- empty key collection
- non-array or otherwise malformed collection
- non-object key entries
- `kty` other than `OKP`
- `crv` other than `Ed25519`
- missing or empty `kid`
- duplicate `kid` values
- missing or empty public component `x`
- any verifier JWK containing private material such as `d`
- malformed JWK values
- keys that cannot be imported for EdDSA verification
- empty issuer
- empty audience
- invalid token-size or clock-tolerance configuration

Each trusted `kid` must identify exactly one trusted public key. Duplicate `kid` values make verifier construction invalid. Token `kid` may select only from this already validated trusted collection. An unknown or missing token `kid` denies verification. No token-controlled key insertion or remote retrieval occurs. Verifier configuration fails before the verifier is returned. Do not expose JOSE key objects as the required public configuration format.

- enforce token-size and basic-format limits before trust is applied
- enforce protected header policy for `alg`, `typ`, and `kid`
- reject `alg: none`
- fail closed on unsupported algorithms
- use only host-trusted Ed25519 public keys
- do not trust token-controlled `jku`, `jwk`, `x5u`, `x5c`, or other remote key-discovery headers
- verify the signature
- validate trusted issuer and audience values from host configuration
- validate the operational time interval `nbf <= current_time < exp`
- validate the structural time order `iat <= nbf < exp`
- validate all claims and cross-field invariants
- strip unknown payload claims from the verified output
- return only sanitised core claims
- keep verification offline, with no database or network access

`typ` is not trusted merely because it is decoded, and `kid` is not trusted merely because it is present. The verifier must enforce them against trusted policy and trusted key identity.

Cryptographic verification and host authorisation remain separate. A valid signature is necessary but not sufficient for access.

## 11. Binding Evaluation
Binding evaluation is a pure comparison step that uses already-verified claims and host-provided expected context.

The initial package requires expected values for:

- `sub`
- `resource_id`
- `policy_id`
- `intent_id`

The comparisons use exact string equality. `max_redemptions` may also be supplied as trusted policy context and compared exactly when the host wants that check. The initial API must not silently skip any of the four core binding checks. Mismatch returns a typed denial. No database or network access occurs.

`payment_ref` is correlation metadata, not proof of payment. Binding success does not itself grant access.

## 12. Persistent-State Adapter
The signed receipt must not replace the host's persisted authority. The host store remains authoritative for:

- receipt existence
- active or revoked state
- current redemption count
- exhaustion
- persisted redemption limit
- persisted receipt identity and bindings
- atomic state transition
- concurrency protection

The package-to-store request should be a narrow trusted consumption command. It may contain only:

- receipt identity: `jti`
- signed authority: `iss`, `sub`, `aud`, `intent_id`, `resource_id`, `policy_id`, `grant_type`, `max_redemptions`, `exp`
- trusted execution context: trusted current time
- the expected host redemption limit, when the host supplied one during binding evaluation

It must not contain:

- the raw token as authority
- unverified payload values
- unknown custom claims
- client-supplied redemption limits
- payment-verification assumptions
- Prisma operations
- SQL statements
- database transaction objects

The atomic command compares the narrow trusted command against persisted trusted receipt state. At minimum it compares:

- `jti`
- `iss`
- `sub`
- `aud`
- `intent_id`
- `resource_id`
- `policy_id`
- `grant_type`
- `max_redemptions`
- `exp`

Any mismatch among the verified signed authority, the expected host context, and the persisted receipt authority denies access. The token's `max_redemptions` is never the sole authoritative limit.

The package should expose one authoritative atomic consumption operation rather than a public read-then-update flow. Exact TypeScript syntax can remain small and implementation-defined, but the semantic contract is one atomic trusted transition.

The adapter should distinguish these conceptual outcomes:

- consumed successfully with uses remaining
- consumed successfully and now exhausted
- receipt authority missing
- receipt revoked
- receipt already exhausted
- receipt expired
- signed or persisted authority mismatch
- state changed during concurrency
- persistence or system failure

Process-local memory is suitable only for demonstrations, not production replay protection.

## 13. Atomic Redemption Flow
The package-level orchestration sequence is:

1. Receive the serialised receipt and the expected host context.
2. Verify and sanitise the receipt.
3. Evaluate pure bindings.
4. Call one host-provided atomic consumption operation.
5. Receive a typed success or denial result.
6. Return a safe result to the host.
7. Let the host decide whether and how to serve the protected resource.

No Fiber RPC occurs. No payment verification occurs. No network call is introduced by the package. The adapter may perform host-owned database I/O. At most `max_redemptions` attempts succeed. Persistence failure denies access. Uncertain client retries are not automatically idempotent without host request identity.

## 14. Result and Error Model
The package should use a small typed outcome model that separates:

- successful redemption with capacity remaining
- successful redemption that is now exhausted
- verification denial
- binding denial
- consumption denial
- system failure

The public conceptual union may use these phase markers:

- `phase: "verification"`
- `phase: "binding"`
- `phase: "consumption"`
- `phase: "system"`

The public conceptual union may resemble:

- `success`
- `verification_denied`
- `binding_denied`
- `consumption_denied`
- `system_failure`

Verification denial never returns unverified claims as trusted output. Binding denial may reference only sanitised verified receipt identity and safe host context. Consumption denial may reflect missing, revoked, exhausted, expired, authority mismatch, or concurrency outcomes without exposing sensitive persisted details unnecessarily. System failures deny access. Do not freeze HTTP status codes. Do not freeze framework-specific exceptions. Do not return unverified claims as trusted output. Do not expose private keys, full tokens, or sensitive configuration in errors.

## 15. Security Defaults
The package should default to:

- Ed25519 trusted keys only
- non-empty trusted issuer and audience
- zero clock tolerance
- future tolerance only if it is trusted, explicit, and bounded
- no token-controlled key retrieval
- no `alg: none`
- no unsupported critical headers
- bounded token size
- unknown payload claims stripped from verified output
- missing `payment_ref` denied
- structural and cross-field validation
- fail-closed persistence behavior
- no secret logging
- no custom cryptography
- no network calls in pure verification
- no payment-network calls in redemption

The exact token byte limit is deferred until it is measured, but the bound must be fixed before release.

## 16. Package-Internal Modules
A small internal module layout is enough:

- `claims` for claim types and canonicalisation
- `keys` for trusted JWK validation and key derivation
- `signing` for protected-header construction and signing
- `verification` for compact token parsing, JOSE verification, and sanitisation
- `bindings` for claim-to-context comparison
- `redemption` for orchestration around verification, bindings, and the store
- `results` or `errors` for shared typed outcomes and internal diagnostics

These modules remain internal. They should not become public subpath exports, and they should not replicate the backend directory structure.

## 17. Current-Code Extraction Map

| Current source | Reusable concept | Extract directly? | Required correction before extraction |
| -------------- | ---------------- | ----------------- | ------------------------------------- |
| `src/core/index.ts` | Backend internal export barrel | No | Keep backend-only; create a deliberate package root entrypoint with only the approved public API |
| `src/domain/receipt-claims.ts` | Claim schema and canonical claim builder | Partially | Require a present `payment_ref` member with explicit `null` allowed, enforce `iat <= nbf < exp`, enforce `grant_type` and `max_redemptions` consistency, and keep issuer/audience as trusted inputs |
| `src/domain/redemption-policy.ts` | Pure denial and exhaustion helper | Partially | Extend from backend-only state checks to verified claims plus host bindings and persisted authority; keep it as a helper, not a final grant decision |
| `src/integrations/receipts/access-receipt-signer.ts` | Signer factory boundary | Yes, conceptually | Enforce Ed25519 private JWK validation, required `kid`, protected `typ: JWT`, and full claim validation before signing |
| `src/integrations/receipts/jwt-access-receipt-signer.ts` | JOSE implementation details | Conceptually, not literally | Enforce `typ` and `kid`, use host-trusted public keys only, reject dangerous headers, strip unknown claims, and map errors safely |
| `src/services/fiber-latch-service.ts` | Backend orchestration | No | Keep it as the reference backend; replace backend-specific repository, payment, and Fiber wiring with the package boundary |
| `src/repositories/access-receipt-repository.ts` | Persistent authority semantics | No | Convert the semantics into an abstract host store contract with atomic consume behavior and no Prisma or SQLite coupling |

Do not copy backend-specific state checks into the package core.

`src/core/index.ts` stays backend-only; the package root entrypoint is designed independently from the backend barrel.

## 18. Paid-Resource Integration Flow
The host-side integration sequence is framework-neutral:

1. The host verifies payment with its chosen payment tooling.
2. The host constructs trusted receipt claims from runtime, policy, binding, and payment-correlation facts.
3. The package signs the claims and the host returns the receipt.
4. A protected request arrives carrying the receipt.
5. The package verifies the receipt and returns sanitised claims.
6. The package evaluates the bindings against host context.
7. The host atomically consumes access through its storage adapter.
8. The host serves or denies the protected resource.

`payment_ref` remains correlation metadata, not payment proof. No Fiber RPC is required in the package path.

## 19. Testing Strategy
The package needs its own tests, and the backend tests remain only prior evidence.

The consumer fixtures should use the built or packed package, not source aliases, direct `src` imports, monorepo-only TypeScript paths, or test-only module mocks:

```ts
import {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
} from "<packed package>";
```

```js
const {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
} = require("<packed package>");
```

| Layer | Current backend evidence | Package tests to add | Timing |
| ----- | ------------------------ | -------------------- | ------ |
| Claim validation | Existing backend tests for receipt claims and redemption edge cases | Pure claim-validation tests for required fields, non-empty strings, required `payment_ref`, time ordering, and grant consistency | First implementation step after the skeleton |
| Signing | Existing backend signing path coverage | Signing tests for protected header construction, key validation, and claim validation before signing | Alongside signer implementation |
| Verification | Existing backend verification and hardening coverage | Verification tests for `alg`, `typ`, `kid`, issuer, audience, time, sanitisation, and safe denial mapping | Alongside verifier implementation |
| Protected headers | Indirect backend coverage | Explicit tests for `alg`, `typ`, `kid`, `crit`, `jku`, `jwk`, `x5u`, and `x5c` handling | Alongside verification tests |
| Binding evaluation | Existing subject and resource mismatch coverage | Pure binding tests for subject, resource, policy, intent, and optional redemption-limit comparison | Alongside binding implementation |
| Persistent-state adapter | Existing backend repository behavior | Adapter contract tests for authority comparison, revocation, exhaustion, concurrency, and failure handling | Before backend integration |
| Atomic redemption | Existing backend redemption behavior | Concurrent final-redemption tests and persistence-failure tests | Before backend integration |
| Package distribution | None | External ESM consumer fixture, external CommonJS consumer fixture, external TypeScript consumer type-check, declaration-resolution test, export-resolution test, `npm pack` contents inspection, and clean installation into a temporary consumer project | After package build exists |

The existing 57 backend tests across 8 files are valuable prior evidence, but they do not prove package-distribution compatibility.

The package-distribution tests should use the built or packed package, not source aliases, direct `src` imports, monorepo-only TypeScript paths, or test-only module mocks. The external fixtures should run on Node 22 and Node 24 in both ESM and CommonJS forms.

## 20. Implementation Sequence
The implementation order should stay paired with tests:

1. Package skeleton, ESM export model, and real ESM/CommonJS consumer tests.
2. Claim schema and types, with claim-validation tests.
3. Ed25519 JWK validation and key-policy tests.
4. Signing implementation and signing tests.
5. Verification implementation and header, time, and claim tests.
6. Binding evaluation and binding tests.
7. Atomic store contract and adapter contract tests.
8. Redemption orchestration, concurrency, and failure tests.
9. Backend reference integration and migration tests.
10. Paid-resource example.
11. Package usage documentation.
12. Final packed-package and supported-runtime verification.

Most package tests should not wait until after implementation is finished.

## 21. Compatibility and Migration
The package is designed to stay compatible with the current receipt payload shape while narrowing the trusted profile.

- No receipt payload claim is added, removed, or renamed.
- Current generated Ed25519 receipts are structurally compatible with the portable profile.
- Current `typ` and `kid` output aligns with the proposed profile, with future `kid` enforcement checked against trusted key identity.
- Configured non-Ed25519 trusted keys may need migration or explicit handling.
- Current backend behavior still leaves `typ`, `kid`, missing `payment_ref`, full `iat <= nbf < exp` enforcement, and trusted issuer or audience hardening to the package boundary.
- Missing `payment_ref` receipts may fail under the stricter package.
- Receipts with invalid time or grant-field relationships may fail under the stricter package.
- Ephemeral keys cannot verify receipts across restart.
- The existing backend can be adapted incrementally to consume the package.
- Historical live proof remains prior foundation.
- Package implementation does not yet exist.

No compatibility is claimed for unknown external receipts or non-Ed25519 configured receipts.

## 22. Explicit Non-Goals
- Hosted verification.
- Payment processing.
- Fiber payment creation.
- Fiber RPC client.
- Database implementation.
- Prisma adapter shipped as core.
- Framework middleware as core.
- CLI.
- Dashboard.
- React SDK.
- Browser SDK.
- Checkout.
- Remote JWKS discovery.
- Certificate infrastructure.
- Key-management service.
- Formal security audit.
- Mainnet-production guarantee.

## 23. Decisions Still Deferred
Only non-blocking decisions remain open:

- Final npm publication name.
- Registry publication timing.
- Exact token-size byte limit after measurement.
- Optional framework adapters.
- Additional package documentation format.

These are not deferred:

- Package responsibility boundary.
- Repository location.
- Node and module target.
- Dependency budget.
- Primary public API.
- Trusted-key policy.
- Binding boundary.
- Persistent-state adapter semantics.
- Atomic redemption flow.
- Result model.
- Implementation sequence.
