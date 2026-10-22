# Local MVP verification session candidate — 2026-10-22

Candidate branch: `codex/local-mvp-verification-20261022`, based on `d503323aad1002f7325ba3a45faf4bee261686a9`. The previous campaign-governance branch remains preserved. The parent authorized a local signed checkpoint after focused correction checks; no push, PR, real reviewer credentials, configured person aliases, or production evidence is part of this candidate.

## Accepted scope and design

Implement a local verification/evidence-review workflow for the authenticated human reviewer boundary already used by governance. A draft binds a project, exact WorkItem digest and acceptance criteria, commit SHA, build revision, environment, authenticated author, per-criterion results, and bounded inline evidence. The author can replace a draft's content before submission. Submission freezes a canonical SHA-256 bundle; all changes afterward require a new session and fresh decisions. `APPROVE`, `REJECT`, and `REQUIRE_REMEDIATION` record exact-digest decisions. Rejection/remediation require reasons. Two distinct locally asserted reviewer persons, separate from the submitter, must cover Security Officer and Lead Architect.

The implementation reuses `LOCAL_SESSION_V1`, `REQUIRED_QUORUM_ROLES`, `evaluateQuorum`, the existing authenticated `ReviewerIdentity`, and the project snapshot transaction middleware. It does not modify task lifecycle/WBS, grant release approval, activate auth/agents, read a repository or arbitrary filesystem path, execute commands, or fetch URLs. Draft/build/environment and producer claims remain human assertions.

## Identity and trust limits

Existing `DMK_HUMAN_REVIEWERS` rows can additionally contain an operator-controlled `personId`, validated exactly against `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`. Whitespace is rejected. Every new route first calls the supplied shared `requireHuman`; verification also requires an exact authenticated account/name/kind/roles match to the server roster and an unambiguous account ID across that roster. A missing person alias denies verification (403). Multiple accounts may share one person alias; those accounts cannot count twice, review that person's own submission, or satisfy both roles. All routes still require an existing Security Officer or Lead Architect human role, including draft authoring and reading.

`personId` is a **LOCAL_ROSTER_ASSERTION**, not proof of real-world human independence. Decisions additionally record explicit human-review and independence attestations. Neither account separation nor these attestations establish cryptographically authenticated producer evidence. The operator must establish actual independence separately. Roster setup diagnostics are implemented by the reviewer-setup candidate, not this change.

Every review projection returns `trust: LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION` and `trustedProductionEvidence: false`. SHA-256 binds submitted bytes; it does not establish who produced those bytes or their truth. The snapshot is an operator-controlled local persistence boundary, not an independently signed evidence ledger. A hostile operator who can rewrite the entire snapshot/roster remains outside this local trust model.

## Integration owned by the parent

1. Add `import {registerVerificationRoutes} from './server/verification/routes.ts'` to `server.ts`, and call `registerVerificationRoutes(app, store, reviewerAuth.requireHuman)` after existing reviewer identity and project snapshot persistence installation. Mutation handlers fail closed (503) if the snapshot transaction boundary is absent.
2. Explicitly register these six project-scoped routes in the fail-closed API policy as `SPECIALIZED_REVIEWER`; no legacy unscoped routes are added:

   | Method | Path |
   | --- | --- |
   | GET | `/api/projects/:id/verification-sessions` |
   | POST | `/api/projects/:id/verification-sessions` |
   | GET | `/api/projects/:id/verification-sessions/:sessionId` |
   | PATCH | `/api/projects/:id/verification-sessions/:sessionId` |
   | POST | `/api/projects/:id/verification-sessions/:sessionId/submit` |
   | POST | `/api/projects/:id/verification-sessions/:sessionId/decisions` |

3. Mount `VerificationPanel` in the project Evidence view with `{projectId, workItems, onChanged?}` and key it by project ID plus reviewer-session revision. `onChanged(projectId, stateVersion)` fires only after a successful acknowledgement has a safe integer version exactly one greater than the posted expected version; the parent may advance its confirmed version floor without certifying a fresh snapshot. The panel uses the server-returned version for CAS, shows loading/empty/error/unknown-outcome states, and disables mutation until reload after stale/authorization/persistence failures. Lists contain summaries; selecting or editing a session fetches its separate detail. Generation/project guards and explicit cancellation prevent late old-project responses from replacing current state. Reload clears all personal confirmations, selection/edit state, decision reason, and unsaved entry fields. Actual returned principals replace the displayed identity; an unexpected identity change requires reload/fresh review. Server authorization remains enforced on every operation.
4. Dashboard/release consumers may import `projectVerificationEvidence` from `server/verification/service.ts` and call `projectVerificationEvidence(store, projectId, {workItemId, commitSha, buildRevision, environment})`. The caller must supply the exact currently evaluated build tuple; do not derive the current build by trusting the submitted bundle itself. The helper returns `{reviews, eligibleSessionIds, trust, trustedProductionEvidence:false}` without mutation. It recomputes the full current WorkItem/criteria digest, submitted bundle digest, inline byte hashes/provenance, exact build tuple, required role policy, independent person/account constraints, and quorum. Eligible local attestations must not be promoted to production producer authority or release approval.

## API payloads

Every mutation additionally requires `expectedReviewer: {identityId, personId}` matching the actual authenticated principal. This is optimistic actor binding, never client-supplied authority. A mismatch returns 409 with the actual current `identity` before changing project state; missing binding returns 422. This prevents confirmations made while observing one reviewer from being silently attributed to a different signed-in reviewer.

Draft POST: `{expectedReviewer, expectedStateVersion, workItemId, commitSha, buildRevision, environment, criterionResults, evidence}`. PATCH replaces the full draft content with the same payload except `workItemId`; only its exact author can edit. Commit SHA is lowercase 40- or 64-character hex; build/environment are nonempty bounded exact strings. A session's task binding cannot be changed.

Each criterion result is `{criterionIndex, result: PASS|FAIL|NOT_RUN, notes, evidenceIds}`. Every criterion must appear exactly once; references must resolve within the bundle. Every PASS needs referenced evidence. Approval requires every criterion to PASS with at least one inline evidence reference.

Evidence input is `{id, kind: MANUAL|LOG|SCREENSHOT|REFERENCE, encoding: UTF8|BASE64, content, sha256}`. The server independently checks SHA-256 over exact UTF-8 bytes or decoded screenshot bytes. There are 1–8 records, max 64 KiB per text record, 128 KiB decoded PNG/JPEG screenshot, 2 KiB reference text, 256 KiB total. Screenshots use canonical base64 and PNG/JPEG magic checks; this is not image authenticity or full image format validation. References are hashed strings labeled `UNVERIFIED_REFERENCE`, displayed as text, never opened/fetched, and cannot alone satisfy a PASS approval. Inline records are labeled `HUMAN_ATTESTED_INLINE`.

Submit POST: `{expectedReviewer, expectedStateVersion, humanAttested:true}`. Submission rechecks draft bytes/metadata and current task criteria before freezing.

Decision POST: `{expectedReviewer, expectedStateVersion, submittedDigest, commitSha, buildRevision, environment, decision: APPROVE|REJECT|REQUIRE_REMEDIATION, role, reason?, humanAttested:true, independenceAttested:true}`. Roles must belong to the authenticated principal and exact required policy. Granting identity/person/provenance fields supplied by clients are rejected as unknown fields; only the explicit expected-reviewer comparison is accepted. Closed decisions are immutable; a rejected/remediation session needs a new session. Every successful mutation increments project stateVersion and emits a chained audit event; the snapshot middleware rolls back sessions, audit, and project version on persistence failure.

GET list returns `{sessions, reviews, archives, stateVersion, identity, requiredRoles}`. `sessions` contains `VerificationSessionSummary` values with IDs/status, exact build tuple, author claim, timestamps, digest/counts and retained-byte counts; it excludes criterion notes and all draft/submitted attachment content. `archives` contains byte-free untrusted archive summaries. Detail/mutations return `{session, review, stateVersion, identity, requiredRoles}`. Errors use `{error}` with the authenticated identity additionally returned on actor mismatch. Failed validation or CAS never silently persists changes.

## Retention admission and imported history

`server/verification/retention.ts` sets conservative engineering admission limits for this local JSON implementation: 100 active-plus-archived sessions per storage project, 500 across projects, 1 MiB compact JSON per session, 8 MiB retained verification JSON per storage project, and 32 MiB across projects. There may be at most 100 archive batches in total. Retained byte accounting includes draft/submitted duplication, criteria, notes, decision/principal metadata, inline evidence, and archive wrapper overhead. These are engineering bounds, not production-capacity claims.

Every draft create/edit, submission and decision checks the complete proposed session before mutation. Active sessions and archives share the same count/byte budgets. Excess input returns explicit 413 `VERIFICATION_STORAGE_LIMIT` without truncating, deleting, or partially storing records. A draft within its initial byte budget may need smaller evidence/notes before submission because both draft and submitted bytes are retained. Existing snapshots remain untouched; older snapshots over these new bounds fail list/mutation admission with an explicit error and require a separately reviewed recovery/archive decision. Known detail IDs remain readable. There is no automatic migration, pruning, or privileged recovery route.

`ProjectStore.verificationArchives` is `Record<string, VerificationArchive[]>`, separate from active `verificationSessions`. The following pure helpers are exported from `server/verification/service.ts`:

- `cloneVerificationArchive(sessions, sourceProjectId)` validates strict known schema, project/task snapshot bindings, exact evidence/bundle hashes, timestamps, local principal provenance, decisions and canonical quorum, and returns a detached archive tagged `UNTRUSTED_IMPORTED_HISTORY`, `activeReviewAuthority:false`, `trustedProductionEvidence:false`. Historical validation deliberately does not require the current WorkItem to remain unchanged.
- `assertVerificationArchiveRetention(archiveBatches)` validates/recounts tagged batches and their aggregate history limits.
- `verificationArchiveSummary(archive)` returns only the tag, source-project identifier, schema/count/byte fields and false authority flags.

`assertVerificationStoreRetention(proposedStore)` is exported from `server/verification/retention.ts` for parent package-import admission before state mutation. It enforces the shared active/archive budget, using the storage project dictionary key for project accounting. Parent package integration must validate each history batch's source project against the package, preserve only detached tagged archives, clear active verification sessions on import, then check the entire proposed store before committing. Optional portable `knowledge.verificationHistory` integration is parent-owned. Imported local roster claims never transfer active review authority, even when their preserved historical status says APPROVED. The active evidence helper reads only `verificationSessions` and never `verificationArchives`.

## Verification evidence

Portable runtime used: `C:/Users/HomePC/AppData/Local/Temp/dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578/node.exe` with the existing linked dependency runtime; no dependency installation.

- Initial server RED: `scripts/testVerificationWorkflow.ts` failed with `AssertionError: Verification routes must exist` before implementation.
- Additional behavioral RED: submission of a draft whose inline content changed after creation returned 200 instead of expected 422. Submission now recomputes exact byte digests and rejects this input.
- Initial GREEN: **66 workflow checks passed**. Independent review then reproduced unbounded retained session growth and inherited personal confirmations. New RED cases covered missing expected reviewer (201 instead of 422), a 101st project session (201 instead of 413), active-plus-archived budget bypass, missing summary detail fetch, and lost acknowledgement project/version arguments. Final portable node `node_modules/tsx/dist/cli.mjs scripts/testVerificationWorkflow.ts` — **94 checks passed**, including preservation of every prior record and persisted byte on capacity rejection. Real Express, real existing authenticated roster sessions, snapshot middleware, and owned OS-temp fixtures exercise authentication/agents, missing person bindings, CAS, spoofing, project isolation, bounds/hashes/provenance, immutable submission, stale criteria/build/commit/environment, self/duplicate-person decisions, role policy, reject/remediate, reference-only denial, restart hydration, stored tampering, and persistence rollback for draft create/edit/submit/decision.
- `scripts/testVerificationArchive.ts` — **13 checks passed**, including malformed/forged histories, aggregate limits, current-task-independent historical validation, detached cloning, and imported APPROVED history contributing no active admission.
- `scripts/testVerificationPanelState.ts` — **6 scenarios passed** against the actual component's handlers using an in-memory hook adapter: summary/detail fetch, fresh personal confirmation after reload, actual success/error identity consumption, callback project/version floor, and malformed/unsafe/non-successor acknowledgement rejection. The adapter does not validate real React/browser scheduling.
- `node_modules/typescript/bin/tsc --noEmit --pretty false` — exit 0 after the server and panel candidate were present.
- `git diff --check` — exit 0.
- UI RED: `scripts/testVerificationPanelUi.ts` failed with `AssertionError: VerificationPanel must exist` before panel implementation, before browser startup.
- The browser candidate is authored but **has not been run** here, per the parent serialization requirement. Parent should run portable node `node_modules/tsx/dist/cli.mjs scripts/testVerificationPanelUi.ts`. It uses a standalone Vite/React fixture and controlled API boundary to exercise create/submit/remediation, exact decision contract, self-review visibility, error recovery, stale CAS, ignored-abort project races, and a mobile width check. Full/browser/native-heavy suites are reserved for the parent.

## Candidate inventory

- `src/verificationTypes.ts`
- `server/verification/identity.ts`
- `server/verification/errors.ts`
- `server/verification/retention.ts`
- `server/verification/service.ts`
- `server/verification/routes.ts`
- `server/projectStore.ts` — only verification type imports and the two active/archive collection fields
- `src/components/VerificationPanel.tsx`
- `scripts/testVerificationWorkflow.ts`
- `scripts/testVerificationPanelUi.ts`
- `scripts/testVerificationArchive.ts`
- `scripts/testVerificationPanelState.ts`
- `scripts/fixtures/verification-panel.html`
- `scripts/fixtures/verificationPanelUiHarness.tsx`
- this verification note

`server.ts`, API policy, EvidenceView, App, shared `types.ts`, release evaluator, canonical WBS, receipts, and existing auth implementation remain for parent integration. No code or document here asserts that a real reviewer approved anything.
