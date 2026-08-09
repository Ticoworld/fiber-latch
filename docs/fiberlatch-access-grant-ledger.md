# FiberLatch Access Grant Ledger

This ledger separates prior FiberLatch foundation from grant delivery, tracks blockers, and prevents unreviewed work from being counted as complete.

Current chronology: D1-D6 are VERIFIED COMPLETE and the Weeks 3-4
implementation milestone is complete. D7 is IN PROGRESS - FINAL WEEKS 5-6
VERIFICATION PENDING. Existing D7 commits, CI runs, tests, and review notes are
early/pre-final evidence; they do not represent final grant closure.

| ID | Approved deliverable | Prior foundation | Grant-specific artifact required | Current grant status | Evidence | Blocker or open decision | Next action |
| -- | -------------------- | ---------------- | -------------------------------- | -------------------- | -------- | ------------------------ | ----------- |
| D1 | FiberLatch Access scope and design | Existing backend docs, repository evidence, and the historical proof | `docs/fiberlatch-access-scope.md` and any later design notes that freeze the scope boundary | VERIFIED COMPLETE | `docs/fiberlatch-access-scope.md`; commit `b28cc1b0722b531fee8d1efaec24ce5c3ba9143e`; independent review `APPROVE`; `npm test` passed (57 tests across 8 files); `npm run build` passed | None | D2: specify the proposed access receipt format |
| D2 | Proposed access receipt format | Current receipt claim implementation in `src/domain/receipt-claims.ts` and signing code | `docs/fiberlatch-access-receipt-format.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-receipt-format.md`; commit `b606abbdff759f3bafef53280225b4b4f7962a96`; technical review completed; hygiene verification passed | None | Specify the expiration and replay rules |
| D3 | Expiration and replay-protection rules | `src/domain/redemption-policy.ts`, `src/repositories/access-receipt-repository.ts`, and `src/services/fiber-latch-service.ts` | `docs/fiberlatch-access-expiration-replay.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-expiration-replay.md`; commit `556bed351d4c8b7dbc0ce13306564905e2613e11`; independent technical and public-hygiene review completed; `npm test` passed (57 tests across 8 files); `npm run build` passed | None | Next grant task: specify the signing and verification specification |
| D4 | Signing and verification rules | `src/integrations/receipts/jwt-access-receipt-signer.ts` and `src/config/signing-key.ts` | `docs/fiberlatch-access-signing-verification.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-signing-verification.md`; `9215d264bbd434a3f85df0b2bd836d5efada3b46`; independent security and public-hygiene review completed; `npm test`: 57 tests across 8 files passed; `npm run build`: passed | None | Next task: reusable package design |
| D5 | Lightweight Node.js access receipt package | `src/core/index.ts`, the existing backend service, and the current build/test setup | `packages/access` and `docs/fiberlatch-access-package-design.md` | VERIFIED COMPLETE | Package design commit `8dadae65319dd20cf57c67ab60801e11748293da`; final package API and redemption commit `f7e5b7b72f3bec285bd09e2dd4d710fd2811238e`; 235 package tests; `publint` passed; ATTW passed; packed ESM/CommonJS/TypeScript consumers passed; Node 22/24 CI run `31078601378`; independent package and redemption reviews approved | None; the package remains private, unpublished, and without a production adapter | D6 verified complete; retain package-boundary evidence in the final report |
| D6 | Paid-resource example | `scripts/demo-local-access.ts`, `scripts/demo-protected-resource.ts`, and the historical demo docs | `examples/paid-resource` and its packed acceptance script | VERIFIED COMPLETE | Commit `e06ad183f25fd35ea7570914ad38bf695940d6f3`; 12 example tests; automated first-use/replay demo; packed paid-resource acceptance; exactly-one-of-two single-process concurrency proof; Node 22/24 CI run `31093114518`; independent focused integration review: APPROVE / READY TO COMMIT | Demonstration payment fixture is not a Fiber payment; example has no production store or hosted service | Complete Weeks 5-6 D7 validation and final acceptance |
| D7 | Documentation and final report | `README.md`, `QUICKSTART.md`, `CHANGELOG.md`, and the current docs set | Reviewer verification guide, final report, updated repository documentation, and evidence ledger | IN PROGRESS - FINAL WEEKS 5-6 VERIFICATION PENDING | Early/pre-final evidence: commit `8bbe2ef2e0f35dc3f8e1cc3fb7503e5398a52bb3`; `access-package` run `31102086459`; Node 22 passed; Node 24 passed; backend validation passed; access-package verification passed; paid-resource verification passed; 304 tests passed; zero skipped or todo tests; independent grant-wide review recorded as APPROVE for the pre-final baseline | Weeks 5-6 external-developer usability, installability, documentation cleanup, final acceptance, and completion reporting remain | Complete Weeks 5-6 developer-usability and installability validation; tighten documentation where evidence requires; perform final grant-wide acceptance; then publish the final Nervos Talk completion report |

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
