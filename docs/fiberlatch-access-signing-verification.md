# FiberLatch Access Signing and Verification Rules

## 1. Purpose

This document defines how FiberLatch Access receipts are signed and cryptographically verified.
It separates cryptographic verification from host authorization and keeps the package boundary out of scope.
It does not define package exports, storage adapters, HTTP response bodies, or the eventual package API.
Receipt verification alone does not grant access.

## 2. Responsibility boundary

The host controls payment trust, receipt issuance, persistent redemption state, and final access enforcement.
The verifier checks cryptographic validity, issuer, audience, time validity, and approved claim structure.
Persistent revocation, exhaustion, replay protection, and subject or resource binding remain host-owned.
Ordinary receipt verification and redemption do not require Fiber RPC.
The verifier must not become a payment verifier or a payment-routing SDK.

## 3. Current implementation baseline

The current backend behaves as a compact signed JWT/JWS system:

- receipts are emitted as compact serialized JWT strings
- the protected header currently sets `alg: "EdDSA"`, `typ: "JWT"`, and `kid`
- the current verifier uses the loaded public key material directly and does not fetch remote keys
- verification restricts accepted algorithms to `EdDSA`
- verification validates the configured issuer and audience
- verification uses zero clock tolerance
- the claim payload is validated with a non-strict Zod object
- unknown claims are stripped from the parsed result rather than rejected
- JOSE failures collapse into coarse application reasons such as `RECEIPT_EXPIRED`, `RECEIPT_CLAIMS_INVALID`, and `INVALID_RECEIPT_TOKEN`
- the current JWKS route publishes public material only
- no token-controlled key URL or remote trust bootstrap exists in the current baseline

## 4. Current algorithm and key behavior

The JOSE algorithm identifier is currently `EdDSA`.
When no configured private JWK is provided, the runtime generates an `Ed25519` key pair.
The configured private-JWK path currently imports trusted key material using generic `EdDSA`.
Under the current implementation and dependency behavior, that configured path is not independently restricted to `Ed25519`.
The current repository therefore does not prove that every configured signing key uses the same curve.

The portable profile frozen by this document is:

```text
JOSE algorithm: EdDSA
Required key type: OKP
Required curve: Ed25519
```

New signing keys conforming to this specification must use `Ed25519`.
Verification keys conforming to this specification must use `Ed25519`.
Implementations must validate the trusted key type and curve.
A token header must not broaden the trusted algorithm or key policy.
Configured keys using another EdDSA curve are outside the portable profile.
The existing configured-JWK path must later be narrowed or explicitly handled during implementation.
There is no evidence in the repository proving that every historical configured receipt used `Ed25519`.
Do not claim compatibility for unknown externally generated or non-Ed25519 receipts.
Existing receipts produced by the current default generated-key path use `Ed25519`.

## 5. Protected header policy

The protected header is decoded as untrusted input and then checked against trusted policy.
The current signer emits `alg`, `typ`, and `kid`.
The current verifier explicitly enforces `alg` but does not explicitly require or compare `typ` or `kid`.
A missing or different `typ` may currently pass if all enforced checks succeed.
A mismatched `kid` may currently verify when the signature is valid under the configured public key.

| Header | Current emission | Current enforcement | Proposed rule | Verdict |
| ------ | ---------------- | ------------------- | ------------- | ------- |
| `alg` | Always emitted as `EdDSA` | Explicitly enforced by `jwtVerify(... algorithms: ["EdDSA"])` | `EdDSA` only; `none` denied; token header must not broaden policy | Current baseline aligned |
| `typ` | Always emitted as `JWT` | Not explicitly checked | Must be present and equal to `JWT` | Future implementation and test work |
| `kid` | Always emitted from trusted key material | Not used for key selection or comparison | Must be present, non-empty, and checked against trusted key identity | Future implementation and test work |

Unsupported critical headers must fail closed.
Token-controlled `jwk`, `jku`, `x5u`, `x5c`, or similar headers must not trigger arbitrary key retrieval or broaden trust.

## 6. Key ownership and deployment baseline

The issuer controls the private signing key.
Private keys must never appear in receipts, logs, or client responses.
The current JWKS route publishes public material only.
The no-JWK runtime path generates a fresh `Ed25519` key pair.
That generated key is ephemeral unless the host persists and reloads trusted key material.
Restarting with a newly generated key can make previously issued receipts unverifiable.
This generated path is suitable only for development, demonstrations, or explicitly ephemeral deployments.
Stable deployments require securely persisted trusted signing material.

## 7. Signing requirements

The signer boundary must accept only a fully constructed, trusted receipt-claim object.
Security-critical values must come from trusted host, runtime, database, policy, and payment-verification state.
The current service issuance path constructs claims from those trusted inputs and currently derives `grant_type` from `maxRedemptions`.
`createJwtAccessReceiptSigner.sign()` itself does not independently validate every structural and cross-field invariant before signing.

The proposed signer contract MUST:

1. reject missing fields
2. reject invalid types
3. reject empty required identifiers
4. reject missing `payment_ref`
5. reject contradictory grant fields
6. reject invalid time ordering
7. reject caller-controlled algorithms
8. reject unsigned tokens
9. reject private-key logging or full-token logging
10. return a signed receipt or a signing failure without granting access

This signer-boundary validation remains future implementation and test work.

## 8. Verification requirements

The verifier MUST:

1. accept the serialized receipt as untrusted input
2. enforce size and basic format limits before expensive processing where practical
3. parse the protected header without trusting its values
4. enforce the trusted algorithm and header policy
5. select only explicitly trusted verification material
6. verify the cryptographic signature
7. validate issuer and audience
8. validate `nbf` and `exp` against the verifier clock
9. validate the complete receipt claim structure
10. validate cross-field invariants
11. return verified, sanitized core claims only after all required checks pass
12. not grant access merely because cryptographic verification succeeded
13. pass verified claims to host binding and persistent-state enforcement
14. fail closed on malformed input, verification failure, or internal verification errors

The current backend `/v1/receipts/verify` flow performs additional persisted-record and state checks after cryptographic verification.
Persistent existence, binding, revocation, exhaustion, and replay checks are host authorization, not pure JOSE verification.

## 9. Issuer and audience validation

`iss` and `aud` are required receipt claims and remain single strings in this format.
The expected issuer and audience must come from trusted configuration.
Both configured values must be non-empty.
Token claims must never define their own expected issuer or audience.
Matching is exact unless a later format explicitly defines otherwise.
Audience checking is security-relevant, not decorative.
Cross-service use must be prevented by expected-audience validation.

The current implementation already passes trusted issuer and audience values into verification and rejects mismatches.
Current runtime configuration loading does not independently reject every empty configured expected issuer or audience value.
Startup or verifier construction must fail closed when trusted configuration is empty or invalid.

## 10. Claim and time validation

Every core claim from the receipt format must be validated.

| Claim or invariant | Current behavior | Proposed rule | Existing proof | Verdict |
| ------------------ | ---------------- | ------------- | -------------- | ------- |
| `iss` | Non-empty string in Zod; `jwtVerify` checks configured issuer | Required non-empty string with exact issuer match from trusted config | Wrong-issuer denial exists | Current baseline aligned |
| `sub` | Non-empty string in Zod; compared against stored receipt and request context | Required non-empty string | Subject-binding checks exist | Current baseline aligned |
| `aud` | Non-empty string in Zod; `jwtVerify` checks configured audience | Required non-empty string with exact audience match from trusted config | No direct wrong-audience repo test | Baseline aligned; coverage gap |
| `iat` | Integer in Zod; derived from issuance time | Required integer Unix second | Claim-shape tests prove mapping only | Future implementation and test work |
| `nbf` | Integer in Zod; derived from issuance time | Required integer Unix second | Boundary behavior not directly proven in repo | Future implementation and test work |
| `exp` | Integer in Zod; `jwtVerify` checks expiration | Required integer Unix second | Expired-receipt tests exist | Baseline aligned; boundary gap remains |
| `jti` | Non-empty string in Zod; stored unique in the database | Required non-empty string | Not-found and redemption-path tests use `jti` | Current baseline aligned |
| `intent_id` | Non-empty string in Zod; compared against stored receipt and intent | Required non-empty string | Binding tests cover intent/resource flow indirectly | Current baseline aligned |
| `resource_id` | Non-empty string in Zod; compared against stored receipt and request context | Required non-empty string | Resource-binding tests exist | Current baseline aligned |
| `policy_id` | Non-empty string in Zod; compared against stored receipt and policy | Required non-empty string | No direct repo test | Baseline aligned; coverage gap |
| `payment_ref` | Current verifier normalizes `payload.payment_ref ?? null` | Member must be present; value may be string or `null` | No direct repo test | Important implementation gap |
| `grant_type` | Non-empty string in Zod; current service emits consistent values | Required non-empty string and must match redemption limit | No direct repo test | Important implementation gap |
| `max_redemptions` | Positive integer in Zod; compared against stored receipt state | Required positive integer | Multi-redemption path proves nominal use only | Baseline aligned; coverage gap |
| `grant_type` / `max_redemptions` | Current service constructs consistent values; signer/verifier do not independently enforce the relationship | `single_redemption` when `max_redemptions = 1`; `multi_redemption` when `max_redemptions > 1` | No direct repo test | Important implementation gap |
| `iat <= nbf < exp` | Current signer and verifier do not independently enforce the full ordering; JOSE only enforces operational `nbf` and `exp` checks | Both signing and verification must reject violations of `iat <= nbf < exp` | No direct repo test | Important implementation gap |

The current implementation can currently accept a token whose `iat` is greater than `nbf` if the other enforced checks succeed.
Operational validity remains `nbf <= current_time < exp`.

## 11. Unknown claims and extensions

The current verifier uses a non-strict Zod object, so unknown claims are stripped during parsing.
That compatibility behavior may remain, but unknown claims must never become trusted security inputs.
The verified result must contain only sanitized core claims and trusted metadata.
Any future extension mechanism must be defined separately and must not weaken the core rules.

Unsupported critical headers must fail closed.
This specification forbids arbitrary token-controlled key retrieval through `jku`, `x5u`, `jwk`, `x5c`, or similar headers.

## 12. Verification result model

A successful result should contain verified and sanitized core claims.
It may also include trusted metadata needed by the host, such as the selected trusted key identity.
It must not contain private key material.
It must not expose unverified custom claims as trusted data.

A failed result must not return claims as trusted.
Public callers may receive a safe generic denial.
Internal diagnostics may retain a specific category.

## 13. Failure categories

Implementations and tests should be able to classify at least these conceptual categories:

- malformed token
- unsupported algorithm
- invalid signature
- untrusted or unusable key
- issuer mismatch
- audience mismatch
- not yet valid
- expired
- invalid claim structure
- cross-field invariant violation
- internal verification failure

The current implementation collapses JOSE failures into coarse application reasons rather than exposing a category for every one of these cases.
That is acceptable as a baseline, but several fine-grained categories still need dedicated test coverage.
Failure must never grant access.

## 14. Compatibility

No receipt payload claim is added, removed, or renamed.
Current repository-issued receipts emit `alg: EdDSA`, `typ: JWT`, and `kid`.
Future enforcement of `typ` and `kid` is compatible with tokens produced by the current signer, provided the trusted key identifier still matches.
The default generated-key path currently uses `Ed25519`.
The configured trusted-JWK path is currently broader and may require migration or explicit handling when the implementation is narrowed to the Ed25519 portable profile.
Ephemeral generated keys do not provide cross-restart receipt compatibility.
The historical live proof remains prior-work evidence.
Do not claim compatibility for unknown externally generated or non-Ed25519 receipts.

## 15. Acceptance matrix

| Scenario | Proposed rule | Current implementation support | Existing proof | Future work needed |
| -------- | ------------- | ------------------------------ | -------------- | ------------------ |
| Valid token | Accept when all checks pass | Yes | Existing tests prove the nominal valid path | No |
| Malformed token | Deny | Yes | Existing tests prove malformed-token denial | No |
| Unsigned token | Deny | Yes | No repo test | Yes |
| `alg: none` | Deny | Yes | No repo test | Yes |
| Unsupported algorithm | Deny | Yes | No repo test | Yes |
| Invalid signature | Deny | Yes | No repo test | Yes |
| Signature under untrusted key | Deny | Yes | No repo test | Yes |
| Wrong issuer | Deny | Yes | Existing tests prove issuer mismatch denial | No |
| Wrong audience | Deny | Yes | No repo test | Yes |
| Before `nbf` | Deny | Yes | No repo test | Yes |
| Exactly at `nbf` | Eligible | Yes | No repo test | Yes |
| Exactly at `exp` | Deny as expired | Yes | Expired-token tests exist | Boundary proof still needed |
| Missing `payment_ref` | Deny | No; currently normalized to `null` | No repo test | Yes |
| Missing or different `typ` | Deny | No; current verifier does not compare `typ` | No repo test | Yes |
| Missing or mismatched `kid` | Deny | No; current verifier does not use `kid` for selection or comparison | No repo test | Yes |
| Non-Ed25519 trusted key | Deny or explicitly handled outside the portable profile | Partial; default generated path is `Ed25519`, configured JWK path is broader | No repo test | Yes |
| Contradictory grant fields | Deny | No | No repo test | Yes |
| Contradictory time fields | Deny | No | No repo test | Yes |
| Empty configured issuer | Deny at startup or verifier construction | No; empty strings can flow through current config loading | No repo test | Yes |
| Empty configured audience | Deny at startup or verifier construction | No; empty strings can flow through current config loading | No repo test | Yes |
| Restart after ephemeral key regeneration | Previously issued receipts become unverifiable unless trusted key material is persisted and reloaded | Yes for the generated path; no cross-restart stability without persisted key material | No repo test | Yes |
| Unknown claim | Ignore or strip, but never trust it | Yes | Current schema strips unknown claims | Current behavior already aligned |
| Valid signature but wrong subject/resource/policy/intent | Cryptographic verification may succeed; host authorization must deny | Partial; subject and resource mismatches are proven, policy and intent mismatch still need direct coverage | Partial | Yes |
| Verification key cannot be loaded | Deny without granting access | Must fail closed | No repo test | Yes |

This matrix separates the proposed rule from the current implementation and the current evidence level.

## 16. Deferred implementation decisions

The following remain outside this specification:

- exact package function names
- TypeScript API shapes
- exports and module format
- Node version support
- storage adapter API
- HTTP response bodies
- hosted key service
- remote JWKS fetching
- certificate infrastructure
- package registry publication
- payment SDK functionality
- hosted verification service

These decisions belong to later work.
This document defines the security rules, not the eventual package surface.
