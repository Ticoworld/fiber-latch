# FiberLatch Access Grant Ledger

This ledger separates prior FiberLatch foundation from grant delivery, records
blockers, and prevents unreviewed work from being counted as complete.

Current status: D1-D7 are VERIFIED COMPLETE. Technical, product, and
documentation delivery for the approved grant scope is complete. The final
public Nervos completion post has not yet been submitted; it is the next
administrative action. The first public npm release was `0.1.0`; the final
polish release is `@fiberlatch/access@0.1.1`.

| ID | Approved deliverable | Prior foundation | Grant-specific artifact required | Current grant status | Evidence | Blocker or open decision | Next action |
| -- | -------------------- | ---------------- | -------------------------------- | -------------------- | -------- | ------------------------ | ----------- |
| D1 | FiberLatch Access scope and design | Existing backend docs, repository evidence, and the historical proof | `docs/fiberlatch-access-scope.md` and any later design notes that freeze the scope boundary | VERIFIED COMPLETE | `docs/fiberlatch-access-scope.md`; commit `b28cc1b0722b531fee8d1efaec24ce5c3ba9143e`; independent review `APPROVE`; `npm test` passed (57 tests across 8 files); `npm run build` passed | None | Delivered; retain scope evidence in the final report |
| D2 | Proposed access receipt format | Current receipt claim implementation in `src/domain/receipt-claims.ts` and signing code | `docs/fiberlatch-access-receipt-format.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-receipt-format.md`; commit `b606abbdff759f3bafef53280225b4b4f7962a96`; technical review completed; hygiene verification passed | None | Delivered; retain receipt-format evidence in the final report |
| D3 | Expiration and replay-protection rules | `src/domain/redemption-policy.ts`, `src/repositories/access-receipt-repository.ts`, and `src/services/fiber-latch-service.ts` | `docs/fiberlatch-access-expiration-replay.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-expiration-replay.md`; commit `556bed351d4c8b7dbc0ce13306564905e2613e11`; independent technical and public-hygiene review completed; `npm test` passed (57 tests across 8 files); `npm run build` passed | None | Delivered; retain expiration and replay evidence in the final report |
| D4 | Signing and verification rules | `src/integrations/receipts/jwt-access-receipt-signer.ts` and `src/config/signing-key.ts` | `docs/fiberlatch-access-signing-verification.md` | VERIFIED COMPLETE | `docs/fiberlatch-access-signing-verification.md`; `9215d264bbd434a3f85df0b2bd836d5efada3b46`; independent security and public-hygiene review completed; `npm test`: 57 tests across 8 files passed; `npm run build`: passed | None | Delivered; retain signing and verification evidence in the final report |
| D5 | Lightweight Node.js access receipt package | `src/core/index.ts`, the existing backend service, and the current build/test setup | `packages/access` and `docs/fiberlatch-access-package-design.md` | VERIFIED COMPLETE | Package design commit `8dadae65319dd20cf57c67ab60801e11748293da`; final package API and redemption commit `f7e5b7b72f3bec285bd09e2dd4d710fd2811238e`; release source commit `cac78216a803b5e287fa5c92ad0270226caf35e1`; 235 package tests; `publint` passed; ATTW passed; packed ESM/CommonJS/TypeScript consumers passed; final Node 22/24 CI and registry-only consumer verification passed | None; `@fiberlatch/access@0.1.1` is publicly distributed through npm, remains Node-only, and has no production adapter | Retain package-boundary and release evidence in the final report |
| D6 | Paid-resource example | `scripts/demo-local-access.ts`, `scripts/demo-protected-resource.ts`, and the historical demo docs | `examples/paid-resource` and its packed acceptance script | VERIFIED COMPLETE | Commit `e06ad183f25fd35ea7570914ad38bf695940d6f3`; 12 example tests; automated first-use/replay demo; packed paid-resource acceptance; exactly-one-of-two single-process concurrency proof; final Node 22/24 CI; independent focused integration review: APPROVE / READY TO COMMIT | Demonstration payment fixture is not a Fiber payment; example has no production store or hosted service | Delivered; retain example evidence in the final report |
| D7 | Documentation and final report | `README.md`, `QUICKSTART.md`, `CHANGELOG.md`, and the current docs set | Reviewer verification guide, final report, updated repository documentation, and evidence ledger | VERIFIED COMPLETE | Final package source commit `cac78216a803b5e287fa5c92ad0270226caf35e1`; public `@fiberlatch/access@0.1.1`; master CI run [32457825277](https://github.com/Ticoworld/fiber-latch/actions/runs/32457825277) and grant-branch CI run [32457829076](https://github.com/Ticoworld/fiber-latch/actions/runs/32457829076) both passed Node 22/24, backend tests/build, access-package verification, and paid-resource verification; 57 backend tests, 235 access-package tests, and 12 example tests; final registry-only consumer verification passed ESM, CommonJS, TypeScript, signing, verification, trusted bindings, first redemption, and replay denial | Final public Nervos completion post has not been submitted | Submit the final Nervos Talk completion report; no further package work is planned |

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

## Starting Verified Baseline (pre-grant)

This section records the verified repository state at the beginning of grant
implementation. It is historical evidence, not the current repository state.

- starting branch: `master`
- starting SHA: `544e2f64f1aac3ee54bbe66f3f40ca61055e2142`
- working tree: clean
- tests: 57 passing across 8 files
- TypeScript build: passing
- local-access demo: passing
- protected-resource demo: passing
- live proof: not rerun
- package state at start: backend service only
- standalone access package at start: none existed

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

## Initial Grant Task Sequence (historical)

This sequence records the initial grant plan. D1-D7 above are now verified
complete; these entries are historical sequencing notes, not current pending
package tasks.

1. Review and approve the scope freeze.
2. Specify the receipt format.
3. Specify signing, verification, and time semantics.
4. Specify replay-protection and atomic redemption requirements.
5. Add tests that prove unresolved design-critical behaviour.
6. Design the package boundary after the underlying contracts are settled.
