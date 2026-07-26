# FiberLatch Access Expiration and Replay Rules

## 1. Purpose

This document defines when a FiberLatch Access receipt is valid, how it is consumed, and how replay protection is enforced by a host application.
It specifies portable lifecycle rules for redemption.
It does not define signing policy, key management, package API shape, or host-specific storage schema.

## 2. Responsibility boundary

FiberLatch Access defines the expiration and replay rules.
The host application owns persistent redemption state.
The host application performs final access enforcement.
A signed receipt alone does not provide replay protection.
`jti` identifies a receipt but does not by itself prevent reuse.
The persistent state transition must be atomic.
Payment verification and payment routing remain outside this specification.
Fiber RPC must not be required during ordinary receipt redemption.
The receipt package may describe the rules, but it must not own the authoritative redemption store.

## 3. Current implementation baseline

The current backend already establishes a practical baseline for these rules:

- receipt claims carry `iat`, `nbf`, and `exp` as integer Unix timestamps in seconds
- receipt issuance currently sets `nbf` equal to `iat`
- the verifier checks signature validity, issuer, audience, and claim shape before redemption proceeds
- persisted receipt state tracks `status`, `active`, `redemptionCount`, `maxRedemptions`, `issuedAt`, `nbf`, `exp`, `redeemedAt`, `exhaustedAt`, and `revokedAt`
- redemption uses the stored receipt identity and a persisted compare-and-swap style update to prevent over-redemption
- expired, revoked, exhausted, missing, malformed, and binding-mismatched receipts are denied
- ordinary redemption does not require Fiber RPC
- payment verification still occurs before receipt issuance, and the current backend still performs that work inside its issuance/reconciliation transaction path, which remains an implementation concern
- the current verifier uses zero clock tolerance, but this specification does not freeze that choice

Current behavior that still needs dedicated proof:

- exact acceptance at the `nbf` boundary
- exact denial at the `exp` boundary
- concurrent final-redemption attempts
- persistence-failure handling
- retry behavior after an uncertain client response

## 4. Time model

Receipt time fields are integer Unix timestamps in seconds:

- `iat`: issuance time
- `nbf`: earliest valid time
- `exp`: expiration time

The proposed validity interval is:

```text
nbf <= current_time < exp
```

Therefore:

- before `nbf`: not yet valid
- exactly at `nbf`: valid
- immediately before `exp`: valid
- exactly at `exp`: expired
- after `exp`: expired

The receipt timestamps must also satisfy:

```text
iat <= nbf < exp
```

The current backend sets `iat = nbf`.

This specification does not freeze clock tolerance.
If a host chooses to use clock tolerance, that choice must be documented and tested separately.

## 5. Receipt validity interval

A receipt is redeemable only while all of the following are true:

- the receipt is cryptographically valid
- the current time falls within the half-open interval `nbf <= current_time < exp`
- the persisted receipt record exists
- the receipt has not been revoked
- the receipt has not been exhausted
- the receipt bindings match the redemption request and host context

The time interval alone is not sufficient.
The receipt may still be denied while inside the interval if the persistent state shows revocation, exhaustion, or a binding mismatch.

The current backend treats a receipt as expired when current time is at or after `exp`.
That behavior is consistent with the half-open interval above.
The exact at-boundary behavior should be covered by dedicated boundary tests in the implementation that consumes this specification.

## 6. Redemption state model

FiberLatch Access uses a minimal conceptual state model for redemption:

| Conceptual state | Meaning | Redeemable? |
| ---------------- | ------- | ----------- |
| active | The receipt is time-valid, not revoked, and below its redemption limit | Yes |
| exhausted | The receipt has consumed all allowed redemptions | No |
| revoked | The host has withdrawn authority for the receipt | No |
| expired | The current time is outside the validity interval, or expiry has already been recorded | No |

The conceptual state model is separate from the database representation.
The current backend represents state with implementation fields such as `status`, `active`, `redemptionCount`, `maxRedemptions`, `redeemedAt`, `exhaustedAt`, and `revokedAt`.
This specification does not require those exact field names, but the host must preserve equivalent meaning.

Authorisation rule:

- A revoked receipt must never be accepted.
- Revocation denies access even when unused redemption capacity remains.
- An expired receipt must never be accepted.
- A receipt that is both revoked and expired is denied.

These rules determine whether access may be granted; they do not require a specific public error label to win.

Current backend behavior:

- The current backend checks receipt expiration before its persisted revocation or exhaustion state in the redemption path.
- Therefore, a receipt that is both revoked and expired may currently be classified as `EXPIRED`.
- The current backend does not guarantee that `REVOKED` is reported before `EXPIRED`.
- This does not permit access because both outcomes are denial.

Public error precedence:

- This specification does not require a public `REVOKED` error to take precedence over `EXPIRED`.
- Public responses may use a safe generic denial or one safe failure category.
- Internal diagnostics may retain the available expiry, revocation, and persisted-state information.
- Final public error taxonomy and verifier error mapping remain deferred to the signing, verification, and package-interface work.

If more than one denial condition is true, the public response may remain a safe generic denial while internal diagnostics retain a specific classification.

Recommended internal precedence for classification:

1. malformed or unverifiable receipt
2. missing persistent record
3. revoked
4. expired
5. exhausted
6. binding mismatch
7. persistence failure
8. concurrent state conflict

This precedence is for internal reasoning and diagnostics.
It does not require a specific public error string or response body.

## 7. Atomic redemption rules

An implementation that follows this specification MUST:

1. verify the receipt cryptographically before granting access
2. compare the receipt bindings against the redemption request and host context
3. load persistent receipt state using the stable receipt identity, including `jti`
4. check revocation and exhaustion against persistent state
5. evaluate the current time as part of the authoritative redemption decision
6. update the redemption counter atomically
7. succeed only when the atomic state transition succeeds
8. mark the receipt exhausted atomically when the limit is reached
9. deny any later attempt after exhaustion
10. prevent concurrent attempts from producing more successful redemptions than `max_redemptions`

A read-then-write sequence by itself is not sufficient.
An in-memory counter by itself is not sufficient.
The portable rule is the atomic state transition, not a specific database primitive.

## 8. Replay and duplicate-attempt behaviour

This specification distinguishes four cases:

- permitted repeated use of a multi-redemption receipt
- replay beyond the permitted redemption count
- concurrent duplicate attempts
- transport retries after an uncertain client response

The rules are:

- a one-redemption receipt permits one successful atomic consumption
- a multi-redemption receipt permits no more than `max_redemptions` successful consumptions
- repeated possession of the same signed token does not create new authority
- concurrent requests share the same atomic counter and must not exceed the limit
- a request that arrives after exhaustion is denied

Retry uncertainty must be handled honestly.
Because the current receipt does not include a redemption-request identifier, a client retry after losing the response cannot automatically be treated as idempotent without additional host-level information.

Request-level idempotency is therefore a separate host or package-interface design decision.
This document does not invent a new receipt claim for that purpose.

## 9. Revocation and exhaustion

Revocation is persistent host-owned state associated with the receipt or the authority record behind it.
Revocation overrides any unused redemption capacity.
A revoked receipt must be denied.
Revocation must participate in the authoritative atomic decision.
Deleting local client data does not revoke a receipt.
Changing the JWT string does not revoke an already issued valid receipt.
Revocation must not depend solely on an in-memory process.

Exhaustion is different from revocation.
An exhausted receipt has consumed all allowed redemptions, while a revoked receipt has been withdrawn by the host.
Both states are denial states, but they arise from different host decisions.

## 10. Failure categories

Implementations and tests should be able to classify at least these failure categories:

- malformed receipt
- invalid signature or unsupported verification result
- not yet valid
- expired
- binding mismatch
- missing persistent receipt record
- revoked
- exhausted
- concurrent state conflict
- persistence failure

Public handling and internal handling may differ.
Public responses should stay safe and should not reveal more state than the host intends to disclose.
Internal diagnostics may retain the specific category for logs, metrics, and debugging.

This specification does not freeze an error class hierarchy or an exact API response body.

## 11. Persistence and concurrency requirements

The host storage mechanism MUST be able to:

- find receipt state by a stable receipt identity
- retain redemption count or equivalent remaining capacity
- retain revocation state
- make the check-and-consume operation atomic
- prevent successful consumption above the allowed limit
- remain correct across multiple application processes
- preserve state across restarts
- distinguish missing state from revoked or exhausted state when internal logic needs that distinction

Process-local memory alone is insufficient for production replay protection.

The current repository uses Prisma with SQLite for the reference backend and tests.
That stack is not required by this specification.
Any durable atomic store that satisfies the requirements is acceptable.

## 12. External-call and transaction boundary

The authoritative redemption path must not depend on Fiber RPC during normal redemption.
Payment verification belongs before receipt issuance.
Cryptographic parsing that does not require network access should generally happen before opening a database transaction.
The authoritative state checks and the counter update belong inside the atomic operation.
Do not hold a database transaction open while waiting for external services.

The current backend still performs Fiber payment verification inside its issuance/reconciliation transaction path.
That is a known implementation concern rather than a portable contract of this specification.

## 13. Acceptance matrix

| Scenario | Expected result | Current status |
| -------- | --------------- | -------------- |
| Current time before `nbf` | Deny as not yet valid | Implemented by current time checks; dedicated boundary test still needed |
| Current time exactly at `nbf` | Eligible for redemption | Required future boundary test |
| Current time before `exp` | Eligible if all other checks pass | Verified by existing successful redemption behavior |
| Current time exactly at `exp` | Deny as expired | Implemented by current expiry checks; dedicated boundary test still needed |
| One-redemption receipt, first valid use | Succeed and exhaust | Verified by existing tests |
| One-redemption receipt, later use | Deny as exhausted | Verified by existing tests |
| Multi-redemption receipt below limit | Succeed and increment atomically | Verified by existing tests |
| Multi-redemption receipt on final allowed use | Succeed and exhaust | Verified by existing tests |
| Multi-redemption receipt above limit | Deny | Verified by existing tests |
| Two concurrent final-redemption attempts | At most one succeeds | Required future test |
| Revoked receipt with capacity remaining | Deny | Verified by existing tests; if the same receipt is also expired, current classification may be `EXPIRED` |
| Valid signature but wrong resource | Deny | Verified by existing tests |
| Valid token but missing persistent record | Deny | Verified by existing tests |
| Persistence operation fails | Deny without granting access | Required future test |
| Client retries after an unknown response | Not automatically idempotent without host-level request identity | Required future design and test coverage |

The matrix documents both the intended rule and the current verification state.
Scenarios listed as required future coverage are not yet fully proven by the existing test suite.

## 14. Compatibility

This specification adds no receipt claim.
It removes no receipt claim.
The existing `jti` and `max_redemptions` fields support the proposed rules.
The historical live proof remains valid evidence of prior behavior.
This specification formalizes portable lifecycle requirements without invalidating prior proof.
Implementation gaps in the current backend do not invalidate the prior proof.
Implementation and test changes are handled separately.
This document does not claim that a reusable package already exists.
This document does not claim that Fiber has become a universal standard.

## 15. Deferred implementation decisions

The following remain outside this specification:

- signing algorithm policy
- key generation and storage
- key rotation and JWKS
- final verifier error classes
- npm package API
- storage adapter method names
- package module format
- Node version support
- registry publication
- hosted infrastructure
- request-idempotency API shape

These decisions belong to later work.
This document does not begin them.
