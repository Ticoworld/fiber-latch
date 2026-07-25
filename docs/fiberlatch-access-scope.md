# FiberLatch Access Scope Freeze

## 1. Document status

This document freezes the approved FiberLatch Access grant boundary.
It is the Week 1-2 scope deliverable.
It does not claim that the Node.js package has been built.
It does not claim that all Week 1-2 work is complete.
It does not claim production readiness, mainnet readiness, formal audit status, or standardisation.
The existing FiberLatch backend remains prior work and a reference implementation.

## 2. Problem being solved

Fiber payment tooling can confirm that payment happened, but an application still needs to determine:

- what was purchased
- what resource becomes accessible
- which user or service account receives access
- when access begins
- when access expires
- how many times access may be redeemed
- how an invalid, expired, or reused receipt is rejected

FiberLatch Access addresses this application-level access boundary after payment.
It does not perform payment routing or settlement.

## 3. Approved outcome

The intended grant outcome is a small open-source Node.js access-receipt package, one paid-resource example, and documentation that another developer can install, understand, test, and adapt without copying the entire FiberLatch backend.
This document does not describe that outcome as already delivered.

## 4. In-scope responsibilities

The grant-approved access responsibilities are:

- defining the access receipt format
- defining expiration behaviour
- defining replay-protection requirements
- defining signing rules
- defining verification rules
- creating access receipt claims
- signing access receipts
- verifying access receipts
- binding receipts to a subject
- binding receipts to a resource
- binding receipts to an access policy
- evaluating time validity
- exposing typed validation or denial results
- defining the persistence requirement for redemption
- demonstrating first valid redemption
- demonstrating denial of invalid, expired, or reused access
- providing setup, usage, security, and limitation documentation

This scope does not add advanced features that were not promised by the approved grant.

## 5. Responsibility boundaries

Persistent atomic state is required for replay protection.
JWT signature verification alone is not replay protection.
The reference backend demonstrates one implementation, but package consumers must not be required to use its HTTP routes, database models, or environment-loading behaviour.

| Responsibility | Fiber/payment tooling | FiberLatch Access | Host application | Reference backend |
| -------------- | --------------------- | ----------------- | ---------------- | ----------------- |
| payment creation | Primary: creates or requests the payment flow and returns payment evidence | No responsibility | May supply the purchase intent that payment is for | Historical proof only |
| payment routing | Primary: routes the payment through Fiber | No responsibility | No direct responsibility | Historical proof only |
| payment settlement | Primary: completes settlement on the payment side | No responsibility | Consumes the settled result | Historical proof only |
| trustworthy payment verification | Supplies the raw payment result or status | Consumes a trusted result only; does not decide trust from an arbitrary client reference | Primary: decides that the payment result is trustworthy before access is issued | Historical reference path only |
| payment-to-access-intent correlation | No responsibility | Uses the correlation result | Primary: correlates the payment to the intended access grant | Historical proof only |
| users and service accounts | No responsibility | Binds receipt claims to the supplied subject identifiers | Primary: owns identities and service-account records | Historical proof only |
| protected resources | No responsibility | Binds receipts to the resource identifier | Primary: owns protected resources | Historical proof only |
| access policies | No responsibility | Binds receipts to the policy identifier and evaluates the policy reference | Primary: owns policy persistence and policy meaning | Historical proof only |
| receipt claims | No responsibility | Primary: defines and builds the claims | Supplies the business context for claims | Historical proof only |
| receipt signing | No responsibility | Primary: signs access receipts | Supplies keys or key material policy | Historical proof only |
| receipt verification | No responsibility | Primary: verifies access receipts | Consumes verified receipt results | Historical proof only |
| expiration checks | No responsibility | Primary: evaluates receipt time validity | Enforces final access consequences | Historical proof only |
| resource and subject checks | No responsibility | Primary: compares receipt claims to the supplied subject and resource context | Supplies the subject and resource context | Historical proof only |
| redemption persistence | No responsibility | Defines the requirement and uses the redemption result | Primary: persists redemption state | Historical proof only |
| atomic replay protection | No responsibility | Defines the atomic requirement and evaluates the outcome | Primary: performs or hosts the atomic state transition | Historical proof only |
| HTTP routes | No responsibility | Not required for the package | May expose application-specific routes | Primary for the current backend implementation |
| environment loading | No responsibility | Not required for the package | Primary: owns environment loading and secret selection | Historical proof only |
| database schema | No responsibility | Not required for the package | Primary: owns schema and storage layout | Historical example only; package consumers do not need this schema |
| event logs | No responsibility | May emit or surface structured outcomes, but does not own storage | Primary: owns any event-log storage it wants | Historical example only; package consumers do not need the backend logging shape |
| final resource enforcement | No responsibility | Not sufficient by itself | Primary: enforces access to the protected resource | Historical proof only |
| demonstration and integration guidance | Primary: provides package guidance and the paid-resource example | Primary: documents how to use the access package | Uses the guidance to integrate the package | Historical proof only |

Important distinctions:

- FiberLatch Access must not treat arbitrary client-provided payment references as proof of payment.
- The host application owns final enforcement.
- Persistent atomic state is required for replay protection.
- JWT signature verification alone is not replay protection.
- The reference backend demonstrates one implementation, but package consumers must not be required to adopt its stack.

## 6. Explicit non-goals

Approved exclusions:

- hosted service
- payment SDK
- dashboard
- CLI
- React SDK
- checkout product
- payment gateway
- production readiness
- mainnet readiness
- security audit
- long-term hosted maintenance

Additional narrow-boundary exclusions:

- POS
- merchant platform
- general Fiber RPC wrapper
- subscription management
- refund handling
- multi-tenant operator platform
- user-management product
- frontend application requirement

This scope does not exclude strong tests, secure defaults, clear errors, documentation, or reusable package boundaries.

## 7. Relationship to previous FiberLatch work

| Existing prior foundation | How the grant may use it | What the grant must newly deliver |
| ------------------------- | ------------------------ | --------------------------------- |
| backend reference implementation | Preserve it as the reference baseline and reuse it for evidence and comparison | A reusable access-control package boundary that does not require the backend stack |
| Fiber v0.8.1 testnet proof | Preserve it as historical evidence of the original live payment flow | Do not rerun or recreate the historical live proof as a substitute for grant delivery |
| current receipt claim implementation | Use it as a factual starting point for the proposed receipt format | A reviewed and documented receipt format suitable for the reusable package |
| JWT signing and verification | Use it as implementation evidence for the signing and verification rules | A reusable signing and verification specification that is not tied to the backend service |
| atomic one-time redemption | Use it as foundation evidence for replay-protection design | A clearly specified persistence and redemption contract for the package boundary |
| duplicate redemption denial | Use it as foundation evidence for deny-on-reuse behaviour | A documented denial model that the reusable package can expose to adopters |
| protected-resource demo | Use it as a baseline example of access gating | A paid-resource example that is explicitly part of the grant deliverable set |
| internal `src/core` barrel | Use it as evidence of existing internal organisation | Do not treat it as an independently installable package |
| existing tests and documentation | Use them as baseline evidence and review material | New grant-specific evidence that maps to the approved deliverables |

Prior work is evidence and foundation.
Prior work is not automatically a completed grant deliverable.
The grant must turn the reusable access-control idea into a clearly specified and independently usable developer package.
The historical live proof must be preserved.
The grant must not claim that it recreated the historical proof.

## 8. Seven approved deliverables

| Deliverable | Required result | Minimum review evidence |
| ----------- | --------------- | ----------------------- |
| FiberLatch Access scope and design | A frozen boundary and design summary that separates payment responsibilities from access responsibilities | Versioned scope/design document reviewed against the approved grant boundary |
| Proposed access receipt format | A documented receipt claim shape and lifecycle suitable for reuse | Versioned receipt-format document and tests or examples that inspect the claims |
| Expiration and replay-protection rules | Defined time validity and atomic anti-reuse requirements | Versioned rules document plus tests or demonstrations showing denial and exhaustion behaviour |
| Signing and verification rules | Defined signing algorithm and verification constraints | Versioned signing/verification document plus test output covering valid and invalid tokens |
| Lightweight Node.js access receipt package | An installable package that other developers can consume without the full backend | Package artifact, build output, and reviewable test evidence for the public API |
| Paid-resource example | A runnable example that consumes the package in a realistic access flow | Reproducible example command and output tied to the package boundary |
| Documentation and final report | Usage, security, limitations, and delivery evidence that map back to the approved scope | Reviewable documentation set and a final report linking evidence to each deliverable |

## 9. Scope acceptance criteria

This scope freeze is acceptable only if:

- access and payment responsibilities are clearly separated
- host ownership is explicit
- previous work and grant work are separated
- all seven approved deliverables are represented
- every explicit exclusion is preserved
- the backend remains a reference implementation
- no package implementation is falsely claimed
- no detailed package API is prematurely frozen
- no receipt-format or lifecycle decision is invented in this task
- all open technical decisions remain visible for later tasks

## 10. Decisions deliberately deferred

This task does not decide:

- final package name
- package directory structure
- public function names
- ESM or CommonJS packaging
- minimum Node.js version
- npm publication
- final licence
- receipt schema version
- exact claim requirements
- clock-tolerance value
- exact `nbf` and `exp` boundaries
- final typed error taxonomy
- final redemption-store interface
- final payment-reference representation
- `custom_records` usage
- support for Fiber versions beyond the historical v0.8.1 proof

These decisions must be settled by later Week 1-2 specification tasks using evidence and tests.
