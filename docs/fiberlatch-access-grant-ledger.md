# FiberLatch Access Grant Ledger

This ledger separates prior FiberLatch foundation from grant delivery, tracks blockers, and prevents unreviewed work from being counted as complete.

| ID | Approved deliverable | Prior foundation | Grant-specific artifact required | Current grant status | Evidence | Blocker or open decision | Next action |
| -- | -------------------- | ---------------- | -------------------------------- | -------------------- | -------- | ------------------------ | ----------- |
| D1 | FiberLatch Access scope and design | Existing backend docs, repository evidence, and the historical proof | `docs/fiberlatch-access-scope.md` and any later design notes that freeze the scope boundary | VERIFIED COMPLETE | `docs/fiberlatch-access-scope.md`; commit `b28cc1b0722b531fee8d1efaec24ce5c3ba9143e`; independent review `APPROVE`; `npm test` passed (57 tests across 8 files); `npm run build` passed | None | D2: specify the proposed access receipt format |
| D2 | Proposed access receipt format | Current receipt claim implementation in `src/domain/receipt-claims.ts` and signing code | A versioned receipt-format specification | NOT STARTED | Baseline audit only; no grant-specific format artifact yet | Exact claim requirements and schema version are still open | Draft the receipt-format specification |
| D3 | Expiration and replay-protection rules | `src/domain/redemption-policy.ts`, `src/repositories/access-receipt-repository.ts`, and `src/services/fiber-latch-service.ts` | A versioned rules document plus tests or demonstrations for denial, exhaustion, and atomic redemption | NOT STARTED | Baseline audit only; no grant-specific rules artifact yet | Exact time semantics and replay model are still open | Specify the time and replay rules |
| D4 | Signing and verification rules | `src/integrations/receipts/jwt-access-receipt-signer.ts` and `src/config/signing-key.ts` | A versioned signing and verification specification | NOT STARTED | Baseline audit only; no grant-specific rules artifact yet | Algorithm, key handling, and tolerance decisions are still open | Draft signing and verification rules |
| D5 | Lightweight Node.js access receipt package | `src/core/index.ts`, the existing backend service, and the current build/test setup | An installable package boundary with a public API and release-ready documentation | NOT STARTED | Baseline audit only; no standalone package artifact yet | Package name, module format, and directory structure are still open | Design the package boundary after the core contracts are settled |
| D6 | Paid-resource example | `scripts/demo-local-access.ts`, `scripts/demo-protected-resource.ts`, and the historical demo docs | A grant-specific paid-resource example that consumes the approved package boundary | NOT STARTED | Baseline demos only; no grant-specific example yet | The package boundary is not yet defined | Build the example after the package contracts exist |
| D7 | Documentation and final report | `README.md`, `QUICKSTART.md`, `CHANGELOG.md`, and the current docs set | Grant-specific documentation and a final report that map evidence to the approved deliverables | NOT STARTED | Existing documentation only; no grant-specific final report yet | Documentation must wait for the approved scope and package contracts | Write documentation after the implementation evidence exists |

## Evidence rules

Acceptable evidence:

- commit SHA
- tagged release
- versioned documentation
- test command and output
- reproducible demo command and output
- fixture consumer result
- final report mapping
- public progress-update link

Unacceptable evidence:

- an agent saying it works
- a plan
- a filename without inspection
- historical test output presented as current
- undocumented local behaviour
- an uncommitted claim with no diff
- prior backend functionality counted as a new package deliverable

## Current verified baseline

This is the baseline before grant implementation.

- starting branch: `master`
- starting SHA: `544e2f64f1aac3ee54bbe66f3f40ca61055e2142`
- working tree: clean
- tests: 57 passing across 8 files
- TypeScript build: passing
- local-access demo: passing
- protected-resource demo: passing
- live proof: not rerun
- current package: still a backend service
- standalone access package: none exists

## Known project-wide constraints

- six-week approved scope
- $3,000 approved request
- hosting cost of $0
- payment expected after delivery and review
- no production claim
- no mainnet claim
- no formal audit claim
- no hidden scope expansion
- preserve the historical proof
- every public update must link to real evidence

## Immediate task sequence

1. Review and approve the scope freeze.
2. Specify the receipt format.
3. Specify signing, verification, and time semantics.
4. Specify replay-protection and atomic redemption requirements.
5. Add tests that prove unresolved design-critical behaviour.
6. Design the package boundary after the underlying contracts are settled.
