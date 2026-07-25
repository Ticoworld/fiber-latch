# FiberLatch Access Receipt Format

## 1. Document status

This document proposes the FiberLatch Access receipt format.
It records the current backend baseline without claiming that the frozen signing and verification specification is complete.
It does not claim that the package or the full grant work is complete.
It does not change payment routing, storage ownership, or final access enforcement.
The signing and verification specification, the expiration and replay specification, and the package implementation remain deferred.

## 2. What the receipt is

A FiberLatch Access receipt is a signed JWT that represents access granted after a trusted payment result.
It is not proof of payment.
It is not a standalone authorization system.
The host application remains responsible for payment trust, persistence, and final enforcement.

## 3. Current signing and verification baseline

The current backend signs receipts using `EdDSA`.
The current verifier restricts accepted algorithms to `EdDSA`.
The current verifier validates the configured issuer and audience.
The current implementation uses zero clock tolerance.
The current verifier validates the custom claim shape using Zod.
The signing and verification specification will define the frozen signing and verification rules.

Current repository symbols that define this baseline:

- `src/domain/receipt-claims.ts::AccessReceiptClaims`
- `src/domain/receipt-claims.ts::AccessReceiptSignInput`
- `src/domain/receipt-claims.ts::buildAccessReceiptClaims`
- `src/integrations/receipts/jwt-access-receipt-signer.ts::ClaimsSchema`
- `src/integrations/receipts/jwt-access-receipt-signer.ts::createJwtAccessReceiptSigner`
- `src/integrations/receipts/jwt-access-receipt-signer.ts::verify`

## 4. Canonical claim shape

The current format has no optional claim members. `payment_ref` is a required claim member whose value may be null.

| Field | Type | Required? | Nullable? | Current supplier | Current validation | Semantic meaning | Compatibility note |
| ----- | ---- | --------- | --------- | ---------------- | ------------------ | ---------------- | ------------------ |
| `iss` | string | Yes | No | Backend runtime issuer configuration | Non-empty string in Zod; jwtVerify checks the configured issuer | Issuer identifier for the receipt | Claim name unchanged |
| `sub` | string | Yes | No | Host/backend access subject identifier | Non-empty string in Zod; jwtVerify checks the subject | Subject identifier only; subject type lives outside the token | Claim name unchanged |
| `aud` | string | Yes | No | Backend runtime audience configuration | Non-empty string in Zod; jwtVerify checks the configured audience | Intended audience for verification | Claim name unchanged |
| `iat` | integer seconds | Yes | No | Receipt issuance process | Integer in Zod; buildAccessReceiptClaims floors Date values to seconds | Issuance time | Unix seconds, unchanged claim name |
| `nbf` | integer seconds | Yes | No | Receipt issuance process | Integer in Zod; buildAccessReceiptClaims floors Date values to seconds | Earliest time the receipt may be accepted | Current backend sets `nbf` equal to `iat` |
| `exp` | integer seconds | Yes | No | Receipt issuance process using the policy TTL | Integer in Zod; buildAccessReceiptClaims floors Date values to seconds; jwtVerify checks expiration | Time after which the receipt must not be accepted | Current backend derives it from the policy TTL |
| `jti` | string | Yes | No | Receipt issuance process, currently generated as a UUID | Non-empty string in Zod; stored unique in the database | Unique receipt identifier used for persistence and replay tracking | Claim name unchanged |
| `intent_id` | string | Yes | No | Existing access intent | Non-empty string in Zod; matched against the stored receipt and intent | Binds the receipt to the access intent that caused issuance | Claim name unchanged |
| `resource_id` | string | Yes | No | Resource key associated with the selected policy | Non-empty string in Zod; matched against the stored receipt and resource | Binds the receipt to the resource key | Claim name unchanged |
| `policy_id` | string | Yes | No | Selected policy record | Non-empty string in Zod; matched against the stored receipt and policy | Binds the receipt to the access policy record | Claim name unchanged |
| `payment_ref` | string or null | Yes | Yes | Verified host/backend payment correlation value, or null | String or null in Zod; current verifier normalises missing values to null before parsing | Opaque payment correlation handle, not proof of payment | Do not rely on it alone |
| `grant_type` | string | Yes | No | Currently derived by the backend issuance path | Non-empty string in Zod; current service emits only `single_redemption` or `multi_redemption` | Categorical redemption class | Schema does not enforce the enum yet |
| `max_redemptions` | positive integer | Yes | No | Selected access policy | Positive integer in Zod; compared against stored receipt state | Numeric redemption limit | Authoritative limit |

## 5. Grant type and redemption limit

`max_redemptions` is the authoritative numeric redemption limit.
`grant_type` is the corresponding categorical representation.

Proposed format invariant:

- `grant_type = "single_redemption"` when `max_redemptions = 1`
- `grant_type = "multi_redemption"` when `max_redemptions > 1`

A receipt whose two fields contradict this relationship is structurally invalid under the proposed format.
The current backend issuance path already derives `grant_type` from `max_redemptions`.
The current Zod claim schema does not independently enforce the relationship.
Implementing and testing that cross-field validation remains future work.
The expiration and replay specification will define redemption lifecycle, state transitions, expiry and replay enforcement, not the meaning of these fields.

## 6. Time fields

`iat`, `nbf`, and `exp` are integer Unix timestamps in seconds.

- `iat`: when the receipt was issued
- `nbf`: earliest time the receipt may be accepted
- `exp`: time after which the receipt must not be accepted

The current backend sets `nbf` equal to `iat`.
The proposed structural ordering is `iat <= nbf < exp`, which is compatible with current construction because `iat = nbf`.
This document does not freeze clock tolerance, exact equality-boundary handling, verifier error mapping, or expiry-state transition details.

## 7. Canonical illustrative claim set

The following JSON object is illustrative, non-sensitive, not a real payment, not a signed JWT, and not proof of Fiber payment.
The timestamps are ordered correctly: `iat = nbf < exp`.

```json
{
  "iss": "https://access.example.test",
  "sub": "user_42",
  "aud": "protected-api",
  "iat": 1785000000,
  "nbf": 1785000000,
  "exp": 1785003600,
  "jti": "6bb2b5ce-8768-4bbb-86f5-8610c994972d",
  "intent_id": "intent_01",
  "resource_id": "course/module-1",
  "policy_id": "policy_single_access_v1",
  "payment_ref": "payment_ref_opaque_01",
  "grant_type": "single_redemption",
  "max_redemptions": 1
}
```

## 8. Unknown claims and extensibility

The current verifier uses a non-strict Zod object.
Unrecognised claims are currently stripped during parsing.
They are not currently rejected solely because they are unknown.
Unknown claims are not part of the proposed core receipt format.
Consumers must not rely on unknown claims for security-critical decisions.
Whether the final package rejects, strips, or permits namespaced extensions remains a later design and implementation decision.
Any extension mechanism must have size limits and must not carry secrets or sensitive policy data.

## 9. Privacy and data minimisation

Receipts must not contain:

- private keys
- signing secrets
- passwords
- bearer credentials
- unnecessary personal information
- complete payment records
- raw Fiber RPC responses
- sensitive access-policy contents
- database authorisation state
- receipt redemption history

Identifiers should be opaque where practical.
The receipt should include only information required for access verification.
`payment_ref` should be an opaque or privacy-preserving correlation value where practical.
Possession of `payment_ref` alone is not proof of payment.
The host must verify payment before receipt issuance.

## 10. Fiber `custom_records`

Fiber `custom_records` are not required by the FiberLatch Access receipt format.
The current receipt format does not depend on them.
They may later be documented as optional correlation metadata in a Fiber integration example.
They must not be treated as the sole authority for access.
Their use remains deferred.
Secrets, personal information, and full receipt tokens must never be placed there.

## 11. Compatibility notes

The proposed receipt format preserves the existing claim names.
It introduces no new required claim.
It does not rename or remove current claims.
Existing receipts remain structurally understandable.
The historical live proof is not modified.
The proposed cross-field consistency rule formalises current issuance behavior but is not yet independently schema-enforced.
Any future receipt version field remains deferred.

## 12. Deferred decisions

The expiration and replay specification remains responsible for expiry enforcement, atomic redemption, replay-state transitions, concurrency behavior, persistent-store design, and exact exhaustion transitions.

The signing and verification specification remains responsible for the frozen algorithm policy, key generation rules, key rotation, JWKS lifecycle, final clock tolerance, and the final verifier error taxonomy.

The package implementation remains responsible for the package API, package directory, exports, module format, Node support, and registry publication.
