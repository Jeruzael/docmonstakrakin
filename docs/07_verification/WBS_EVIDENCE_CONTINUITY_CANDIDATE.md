# WBS historical/current verification candidate — 2026-10-20

Status: bounded verifier code/test candidate for independent security/governance review. `mayApply: false` on every result. This document records implementation evidence; it grants no application or trust authority.

## Baseline and authorization

The human operator explicitly authorized implementation, testing, documentation and draft publication of the existing 15-path verifier proposal. The executing agent verified remote `master` at `fd2f6e4e1320ad949adee4cb33a51ab612a1cd4e` before editing and created `codex/wbs-historical-forward-verifier` from it. PR #34 remains open and unapplied at `5912185a005df3e0469dd46392d7d0dbb0378b68`. PR #52 remains a separate unchanged archival draft at `89b1527f75dfdd69a3e49bda752b64d4edd70a54`.

PR #50 was already human approved at exact `07b108eeb8f72636b96269503e36617d24122c4d` by `jianzhihuoxin` at `2026-10-20T04:50:30Z` and merged by `Jeruzael` at `04:56:06Z`. Its merge is the baseline above; [post-merge workflow 39372189347](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39372189347) passed all three jobs. This candidate does not invent a separate prior merge authorization or replace earlier closure evidence. The original 29 S2-A portfolio files remain historical feasibility/governance evidence, not application authorization acceptance.

## Verification boundary

`wbsEvidenceContinuity.ts` separates the independently pinned historical view from actual current canonical bytes. The historical anchor is `docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml`, exact raw SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`. It retains the original 27 EPIC-13 items. No newline normalization, receipt rewriting or replacement expected hashes occurs.

The DMK-196 closure/post-merge, DMK-197 closure and DMK-208 audit adapters run their original assertions against historical bytes. DMK-208 earlier modes resolve exact immutable Git blobs with separately fixed byte pins: PRE_APPLY `c662202de6551eb90871212f16ae8b7c1b58f4d7` / `ccb743020873462180bc6f05f7241e1096c3e4ce8e331e8dca8229a31da2b425`; POST_APPLY `4207e1a14dc9d073f2fad3a37b832f225417c967` / `d1b7787116b6483ef5e61d74beed9a8e1e7165f826f36eee192beac565aeb72c`; POST_CLOSURE `bfb5dd386eda0ac6d48adf4bfcfdec8042f9868f` / `dfedba8e16bf7e41ae3a4df9d9ba81920821a6e850a053cb1386f369a51c8fbe`. The pre-apply pin is the receipt's actual pre-apply branch, not its older master base (whose bytes differ). Missing Git objects or mismatched bytes deny. The terminal 53050b92 snapshot is not substituted for an earlier receipt pre-state. Existing explicit simulation/custom inputs remain historical test inputs; they cannot replace the actual current filesystem WBS gate.

The pure continuity function returns `historicalValid`, `currentForwardChainValid`, overall `valid`, `mode`, raw historical/current/ledger digests, historical/current scope counts and errors. Legacy success/CLI exit zero requires both historical assertions and current continuity. DMK-208 retains its throwing failure contract and attaches separate results to the error. Its historical summary remains 27; an authenticated synthetic two-addition chain reports current scope 29 separately.

If current raw bytes equal the anchor, the ordinary historical checks can pass. If they differ, no historical success, force mode, skipped candidate digest check, signed preview, GitHub review or SSH commit signature can substitute for a complete applied successor chain. Default CLI operation has no trusted forward provider and denies changed WBS.

## Applied chain and authority contract

The verifier reuses existing v2 receipt normalization/signature domains, additive semantic checks and the unchanged strict ledger format. The preflight parser is exported without relaxing it. Every ordered link must bind exact before/after bytes, the complete approved addition definitions, semantic intent/receipt hashes, retained raw receipt hash, canonical ledger prefix, receipt ID, policy pin, reviewed repository/PR/base/HEAD/tree and independently authenticated applied commit/tree/time.

The existing Security Officer and Lead Architect roles require distinct human principals and Ed25519 keys. Root metadata and every existing item's complete value remain unchanged; added items must exactly match the signed definitions and begin PROPOSED. A valid count alone grants nothing. Each consumed receipt occurs once in the canonical ledger; prior authoritative ledger prefixes establish historical issuance, while the existing new-receipt preflight still rejects consumed IDs. Repeated read-only audit does not consume evidence.

The separate trusted acquisition callback is a host contract, not authentication of an arbitrary JavaScript object. It must independently authenticate protected Git objects and ancestry, exact retained WBS/ledger/receipt bytes, actual application provenance, ratified policy epochs, signer enrollment, current revocation adjudication and trusted time/freshness floors. PR JSON, caller booleans and signed intent are not legitimate sources. Policy epochs cannot move backwards or change policy within an epoch; a new epoch requires changed signed policy digest/version. Every historical application must have adjudication at the current revocation checkpoint. Signed validity/key periods are checked at authenticated application time; valid expired-now historical evidence grants no fresh authority. Ambiguous compromise/revocation cases must be withheld by the provider and therefore deny.

No production adapter, enrollment, policy ratification, new signed schema, ledger location, clock service or apply/consume engine is installed. Synthetic callback fixtures prove the verifier contract only. The candidate conservatively requires terminal protected master commit/tree to equal the last authenticated application commit/tree. Later unrelated descendant commits therefore deny until a separately reviewed adapter/contract carries authenticated applied-versus-terminal ancestry evidence. A full Git history and available Git executable are required for the three earlier DMK-208 views; absent objects fail closed. The 60-second authority freshness interval is a bounded candidate constraint, not a newly ratified operational policy.

## Changed-file inventory

Exactly 15 paths are authorized and included:

- New shared boundary and tests: `scripts/wbsEvidenceContinuity.ts`, `scripts/testWbsEvidenceContinuity.ts`.
- Parser export and its contract test: `scripts/planWbsRegistrationTransaction.ts`, `scripts/testPlanWbsRegistrationTransaction.ts`.
- Historical/current adapters and existing tests: `scripts/verifyDmk196Closure.ts`, `scripts/testDmk196Closure.ts`, `scripts/verifyDmk196PostMergeCandidate.ts`, `scripts/testDmk196PostMergeCandidate.ts`, `scripts/verifyDmk197Closure.ts`, `scripts/testDmk197Closure.ts`, `scripts/verifyDmk208StatusAudit.ts`, `scripts/testStatusAuditReceipt.ts`.
- This evidence document and additive `docs/00_control/PROJECT_STATE.md`, `docs/00_control/LAST_HANDOFF.md` entries.

Canonical YAML/Markdown, original receipts/snapshot/candidate digests/timestamps, the original 29-file portfolio, runtime, server implementation, v2 trust verifier, legacy v1 forward bridge, package manifests/lockfiles and workflows are outside the diff. Current npm/Bun source-map-js 1.2.2 is unchanged.

## Validation and retained failures

Tests use a disposable clone, synthetic credentials and freshly generated in-memory Ed25519 fixture keys. No live service or operator-state preparation occurs. Original failing RED logs are retained outside source, together with focused/full command logs and SHA-256 manifests. The first RED established the missing boundary; further RED checks established missing adapter separation, stale application revocation acceptance and incorrect earlier-view selection. The corresponding assertions now guard the implementation.

The first integration pass also exposed an old positive DMK-197 fixture missing the newly required pinned snapshot. The fixture now includes that original snapshot; its original positive assertion and receipt checks remain. TypeScript caught a fixture's widened `kind` string and it was narrowed to the existing HUMAN literal. These failures are preserved rather than represented as passing first attempts.

An initial full run and an intermediate run are retained as preliminary failures. Updating a test during the first run invalidated it as final evidence; overlapping disposable UI runs also collided on port 5173. The intermediate earlier-view pin incorrectly used the master base instead of the receipt's actual pre-apply branch, and correctly failed the fixed digest check. Final acceptance used frozen code, the corrected existing branch provenance and one sequential runner. No historical assertion was relaxed to obtain a pass.

Final Windows validation (Node 22.21.1, synthetic CI runtime, network API key empty):

| Command / contract | Observed result |
| --- | --- |
| `npm ci`, unchanged lockfile | 316 packages installed; 317 audited; zero audit vulnerabilities reported at this capture |
| `npm run wbs:check`, `npm run lint`, `npm run build` | All exit 0 |
| Four existing `verify:dmk-*` commands | DMK-196 closure/post-merge, DMK-197 closure and DMK-208 audit all exit 0 on unchanged current historical baseline |
| `npm run test:complete` | 68/68 suites; 1,726 observed named check outputs; zero failed/skipped |
| New continuity suite | 46/46 checks, including missing historical Git objects, historical tamper, exact one/multiple applied chains, expired-now historical signatures, signed-but-unapplied intent, stale authority/revocation, altered signed item sets, duplicate/replayed ledger, raw JSON/receipt mismatch, invalid humans/signatures and Git identities |
| Existing changed contracts | DMK-196 closure 19; post-merge 39; DMK-197 closure 27; DMK-208 audit 60; transaction preflight 27, all pass |
| Security compatibility | Perimeter 51; human quorum 86; AZ-08 lifecycle 105; source-map dependency 36, all pass within complete regression |
| Separate controlled-document run | 40/40 core + 29/29 additional + 11/11 focused; no synthetic baseline snapshot mutation |
| Preservation | Exactly 15 changed paths; 44 protected portfolio/receipt/snapshot/WBS/dependency/verifier files match Git baseline byte for byte; both previous summary bodies retained byte for byte |

Counts are runner-observed named outputs, not a claim of 1,726 independent security properties. Controlled-document counts overlap complete regression and are not added to it. Windows child tests received process-local native Windows PowerShell module paths; no machine policy was changed. Fresh read-only agent review found no remaining concrete draft-publication blocker after current revocation, diagnostic digests, earlier snapshots and rollback corrections. This is code review, not human governance approval.

Retained complete report `accepted/complete-results.json` SHA-256: `8483baf86f149e1aa326b8ac2dac7ea24846ce0d95eac0e89865d9ea16f6b163`. Separate `accepted/controlled-final.log` SHA-256: `8ad365bb5b94594fb92a766bd3df91691aaf494f7216b0413c45b7d06be3f1ef`. Managed external `artifacts/r8` retains RED/preliminary/final logs, source-preservation manifest, baseline GitHub evidence, runner and reviewer dispositions. Reproduce in a disposable full-history clone with `npm ci`, `npm run ci:prepare`, the quality commands, `npm run test:complete` and `npm run test:controlled-docs`; the complete runner discovers the new suite without workflow/package changes.

Candidate commit identity, GitHub signature verification, exact-head Linux workflow URLs and the review-request event are recorded in the draft PR publication record to avoid a self-referential commit or changing the reviewed HEAD merely to insert its own SHA. A review request is not human approval.

## Remaining risks and human gate

The historical DMK-197 procedural/timestamp qualification remains unresolved; technical historical validity does not retroactively cure it. General principal/action/resource authorization remains incomplete, and the ordinary status endpoint remains unauthenticated. This candidate neither closes nor registers DMK-209–214. Proposed sequencing remains DMK-210 → DMK-211 → DMK-212 → DMK-209, without declaring any task completed.

Independent `jianzhihuoxin` security/governance review must inspect the exact signed candidate, as-of/revocation and ledger-audit semantics, all three CI jobs and the documented acquisition limitations. A request, agent code review and passing CI are separate from actual human approval. The next decision is whether to approve this verifier-only draft for a later explicit operator merge. Production trust/enrollment/adapter design, atomic application and exact PR #34 registration each need separate authorization; S2-A identity store, session/CSRF, transport, bootstrap/recovery, acceptance budgets and implementation remain separate decisions.

Rollback is ordinary reversion of this 15-path candidate after a separate human decision only while canonical WBS remains the pinned 53050b92 baseline. If any later authorized successor exists, halt for a separately reviewed compatibility rollback; never restore an older WBS or delete retained ledger/receipts to make legacy checks pass. This candidate performs no WBS/ledger/credential migration. Retain 14 privileged-route denials, human-only quorum, disabled live agents, Gate 7 unexecuted and release unpromoted. No automatic merge.
