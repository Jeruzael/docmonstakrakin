# Batch A v2 — mechanism verification and human review

Stage A implemented on 2026-09-23T15:32:56.586Z. **Historical reconciliation has NOT been applied.** The live snapshot, historical bootstrap evidence, original pristine verifier, WBS, DMK-195+, unrelated projects and Gate 7 remain unchanged. No Git commands ran; branch/head/worktree metadata are unverified.

## Exact read-only live proposal

Project: PRJ-DOCMONSTAKRAKIN. Snapshot stateVersion: **19 → 20** if subsequently authorized. The current named actor is a review placeholder, not an authenticated human or an approval. Regenerate a named-operator proposal before the historical ceremony and review that exact digest.

- Reviewed snapshot SHA-256: `2f19134a0a5fd5ccc5aea7d4d9592174c3864a1e7dc4b02c76709c13b4b942c9`
- Plan SHA-256: `49de18c785aadb58793188fd0a379cc7baa72096ed931e439bb24e1c78f0056a`
- Candidate snapshot SHA-256: `fec8c4462fab48b75276e36e6b9fe81c73b93d47d55ef073f279ec8c36f23519`
- Bound WBS/evidence files: 34 (exact raw-byte digests in the JSON plan).
- Disk mutation count of the evaluator: **0**. The candidate was projected and verified only in memory; no candidate snapshot was saved.
- Separate artifacts written: this human review, [exact JSON plan](batch-a-reconciliation-dry-run.json), and [verification results](batch-a-reconciliation-verification.json). These are new reconciliation evidence, not replacements for bootstrap evidence.

| Field (self-project only) | Before | Proposed after |
|---|---|---|
| DMK-192.status | READY | VERIFIED |
| DMK-192.updatedAt | 2026-09-19T00:00:00.000Z | 2026-09-23T15:32:56.586Z |
| DMK-193.status | IN_PROGRESS | VERIFIED |
| DMK-193.updatedAt | 2026-09-23T09:39:46.474Z | 2026-09-23T15:32:56.586Z |
| DMK-194.status | BACKLOG | VERIFICATION |
| DMK-194.updatedAt | 2026-09-19T00:00:00.000Z | 2026-09-23T15:32:56.586Z |
| Project.stateVersion | 19 | 20 |
| Audit ledger | Existing events | Prepend exactly one WORK_ITEMS_RECONCILED event |

The exact new audit object, its ID, actor, timestamp, reason, previous hash, state hash and changes are included in the JSON plan. Prior audit objects remain equal. No checklist, evidence link, requirement, approval, lifecycle, release or Gate 7 field changes. Every other project and collection, including unknown fields, is preserved by complete candidate comparison. The snapshot is serialized as indented JSON on apply.

## Bounded mapping

The repository WBS has a wider scope than the runtime subset. It is never overwritten from runtime state. DMK-187–190 have additional visible historical drift; they are deliberately outside the three-item apply boundary.

| WBS ID | Runtime WorkItem ID | Current runtime | WBS | Translated status | Apply boundary |
|---|---|---|---|---|---|
| DMK-187 | DMK-187 | VERIFICATION | VERIFIED | VERIFIED | Observe only; no change |
| DMK-188 | DMK-188 | VERIFICATION | VERIFIED | VERIFIED | Observe only; no change |
| DMK-189 | DMK-189 | VERIFICATION | VERIFIED | VERIFIED | Observe only; no change |
| DMK-190 | DMK-190 | VERIFICATION | VERIFIED | VERIFIED | Observe only; no change |
| DMK-191 | DMK-191 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |
| DMK-192 | DMK-192 | READY | VERIFIED | VERIFIED | Eligible for this review |
| DMK-193 | DMK-193 | IN_PROGRESS | VERIFIED | VERIFIED | Eligible for this review |
| DMK-194 | DMK-194 | BACKLOG | VERIFICATION_PENDING | VERIFICATION | Eligible for this review |
| DMK-195 | DMK-195 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |
| DMK-196 | DMK-196 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |
| DMK-197 | DMK-197 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |
| DMK-198 | DMK-198 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |
| DMK-199 | DMK-199 | BACKLOG | BACKLOG | BACKLOG | Observe only; no change |

Status mapping is explicit: BACKLOG→BACKLOG, READY→READY, IN_PROGRESS→IN_PROGRESS, VERIFICATION_PENDING→VERIFICATION, VERIFIED→VERIFIED only with retained evidence for an eligible transition. Unknown statuses, missing or duplicate IDs fail closed. Observe-only rows are not proposals to grant VERIFIED.

## Evidence and transaction controls

DMK-192: **PASS** — retained dry-run review and manifest-validation report match the pinned reviewed artifacts; canonical WBS evidence links and human-review provenance are present; current pure manifest integrity validation passes.

DMK-193: **PASS** — retained execution review and machine report match the reviewed evidence and semantic invariants, including manifest binding, isolated project creation, unchanged unrelated-state hashes, audit validity, zero approvals and unexecuted Gate 7. The report's published hash is `066c07a79c2e9588fb162e82a4560b23b9c098e5564064ea44c180cbcdad95c0` for LF text. The retained file is CRLF: this validator checks that published digest explicitly and separately binds its exact raw bytes. No existing expected hash or evidence file was rewritten.

Apply requires a saved plan, exact plan digest confirmation, explicit project confirmation and local execution environment authorization. It rereads WBS/evidence, recomputes the candidate, obtains the shared exclusive snapshot writer lock, checks reviewed snapshot bytes and rechecks inputs immediately before rename. State changes and audit share one atomic snapshot write. Identical retries and fresh no-change proposals write nothing. A stale server rejects mutations until restarted. Concurrent mutating HTTP requests receive retryable 409 responses to prevent shared rollback state.

Stop all writers before a future historical apply, including servers running older code. The lock coordinates current application writers; it cannot constrain an administrator directly editing files. Crash locks fail closed and require deliberate recovery. The CLI is a trusted local operator tool, not a new governance or remote authentication path.

The separate verifier proves the whole before/after transformation and ledger validity. Disposable tests confirm pristine initialization still passes the original verifier and legitimate reconciliation fails its original strict initialization comparison. The pristine verifier has not been weakened.

## Verification routes

| Route | Result | Evidence / scope |
|---|---|---|
| npm run test:reconciliation | PASS | 13 reconciliation tests + 4 real HTTP tests; disposable state only |
| Separate post-bootstrap CLI verifier | PASS | Disposable before/after + exact plan; negative preservation tests |
| Mutation-free live dry-run + in-memory projection verifier | PASS | Three eligible changes, exact plan above; zero live writes |
| WorkItem browser failure/success regression | PASS | Rejected status/checklist retain canonical values and show error; successful refresh retains drawer |
| npm run test:projects-workspace:ui | PASS | 10 grouped browser cases, executed within npm test and complete regression |
| npm run test:projects-workspace | PASS | 14 checks including actual HTTP project isolation |
| npm test | PASS | 147 observed named checks in a fresh no-Git copy |
| npm run qa | PASS | 11 control-plane checks in a fresh no-Git copy |
| npm run lint | PASS | TypeScript noEmit |
| npm run build | PASS | Existing large frontend chunk warning remains (748.27 kB) |
| npm run wbs:check | PASS | Existing full WBS projection stays consistent |
| npm run test:bootstrap:contract | PASS | 19 checks in fresh copy |
| npm run test:bootstrap:manifest | PASS | 28 references, 24 pinned documents, 4 unpinned living documents, 4 evidence hashes |
| npm run test:bootstrap:executor | PASS | 16 checks in fresh copy |
| npm run test:bootstrap:execution-verifier | PASS | 20 checks in fresh copy |
| npm run test:complete (allowed suites) | FAIL | 26/28 suites pass; 353 named checks pass, 2 fail |
| scripts/testEnvironmentFixtures.ts | BLOCKED | Calls Git; quarantined only in disposable complete-run copy |
| Protected-file and live-state integrity | PASS | 107 existing files unchanged, including all 4 live-state/secret files; no new live files |
| Historical live reconciliation apply | NOT RUN | Explicitly withheld for human review |
| Live post-apply verifier | NOT RUN | No live apply occurred |
| Human UI / reconciliation acceptance | NOT RUN | Pending human review; no Gate 7 approval inferred |
| Git inspection / mutation routes | BLOCKED | Current no-Git restriction preserved |

The two complete-run failures are scripts/testSelfBootstrapExecutionVerifier.ts and scripts/testSelfBootstrapExecutor.ts. Earlier CryptoDemon integration tests overwrite the pinned fixture-evidence JSON inside that disposable copy. The same two failures were recorded by the preceding DMK-194 baseline/remediation runs. Fresh standalone bootstrap routes pass. No pinned digest was regenerated to hide the failure. Full regression is **not** reported green.

Raw route outputs: runtime/batch-a/*.log; suite-level output: runtime/batch-a/complete-evidence/results.json. The complete runner executed 28 allowed suites; one additional Git-creating suite was blocked, not silently counted as passed.

## Changed implementation

- server/reconciliation/canonicalReconciliation.ts: bounded projection, evidence rules, pure dry-run, guarded apply and post-bootstrap verification.
- server/projectPersistence.ts: exclusive snapshot writer, compare-and-swap and stale-server/overlapping-transaction protection.
- server.ts, src/App.tsx, src/components/WorkView.tsx: validated WorkItem updates, persistence/audit/versioning, visible rejection and canonical drawer values.
- scripts/reconcileCanonicalState.ts and scripts/verifyCanonicalReconciliation.ts: explicit administrative and read-only verification commands.
- scripts/testCanonicalReconciliation.ts, scripts/testWorkItemUpdates.ts, scripts/testProjectsWorkspaceUi.ts and scripts/fixtures/projectsWorkspaceUiServer.ts: disposable mechanism, server restart and browser regressions.
- scripts/runBatchAVerification.mjs and package.json: isolated verification routes and CLI entrypoints. No dependency changes.
- docs/00_control/BATCH_A_RECONCILIATION_IMPLEMENTATION.md: ownership/scope and operator protocol; this report and its two JSON artifacts: separate evidence.

Ownership: user-authorized Batch A Stage A, implemented by Codex. A stable WBS ID still needs human allocation; none was invented and DMK-194/195+ were not reassigned. **Stop here for human review.** No Batch B work, historical apply, release progression, bootstrap rewrite or Git operation is authorized by this report.
