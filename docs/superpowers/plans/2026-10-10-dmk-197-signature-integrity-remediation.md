# DMK-197 Final Signature Integrity Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict stored-signature provenance and canonical role-occupancy validation for DMK-197, verify with deterministic regression tests under TDD, and rebaseline the closure-transition candidate.

**Architecture:** Export a canonical signature validation helper (`validateStoredSignatures`) from `server/proposals/quorum.ts` that enforces exact role provenance, non-empty identityId, trusted `roleSource === 'LOCAL_SERVER_ROSTER'`, distinct human identities, distinct satisfied roles, and no inconsistent rejection signatures in pending requests. Integrate this validator into `POST /api/projects/:id/approvals/:apvId/decide` in `server/proposals/signoff.ts` before processing decisions, failing closed with HTTP 409 and zero state/audit/target mutations whenever stored records are malformed or inconsistent.

**Tech Stack:** TypeScript, Node.js, Express, Vitest/Node assert, Playwright

**Spec:** Section 2, 3, 4 of user request `DOCMONSTAKRAKIN — DMK-197 Final Signature Integrity Remediation`

## Global Constraints
- DMK-197 canonical WBS status must remain strictly `IN_PROGRESS` (zero WBS drift).
- Proposed closure candidate target status remains `VERIFICATION_PENDING`.
- Human governance remains `PENDING_SIGNOFF` (`human_approved_by` absent).
- Reconciliation blockers remain strictly at 11; live reconciliation remains BLOCKED / NOT EXECUTED.
- Gate 7 and release promotion remain untouched (`v0.1.0-rc1 / NOT PROMOTED`).
- PR #27 remains OPEN / DRAFT / UNMERGED.
- Halts strictly at the DMK-197 Closure-Transition Human Decision Gate.

## Review Focus
1. Stored signature with missing `identityId` returns HTTP 409 fail-closed without mutating state, audit log, or canonical targets.
2. Stored signature with missing or forged `roleSource` returns HTTP 409 fail-closed without mutating state, audit log, or canonical targets.
3. Stored signature with duplicate identity across roles or duplicate approval for the same role returns HTTP 409 fail-closed.
4. Pending request with stored rejection signature returns HTTP 409 fail-closed.
5. Invalid signature in stored record cannot occupy role: legitimate reviewer attempting decision fails closed with HTTP 409 (requiring fresh request), not HTTP 403 slot-occupied.

---

### Task 1: Negative Regression Test Scenarios in `scripts/testDmk197Quorum.ts` (RED Phase)

**Files:**
- Modify: `scripts/testDmk197Quorum.ts`

- [ ] **Step 1: Write Scenarios 54–63 in `scripts/testDmk197Quorum.ts`**
  - Scenario 54: Missing `identityId` in stored signature returns HTTP 409 fail-closed
  - Scenario 55: Empty/whitespace `identityId` in stored signature returns HTTP 409 fail-closed
  - Scenario 56: Missing `roleSource` in stored signature returns HTTP 409 fail-closed
  - Scenario 57: Invalid `roleSource` in stored signature returns HTTP 409 fail-closed
  - Scenario 58: Unknown governance role in stored signature returns HTTP 409 fail-closed
  - Scenario 59: Duplicate identity across roles in stored signatures returns HTTP 409 fail-closed
  - Scenario 60: Duplicate approval signatures for same role returns HTTP 409 fail-closed
  - Scenario 61: Invalid Security Officer signature cannot occupy slot: legitimate Security Officer decision fails closed with HTTP 409 (not HTTP 403)
  - Scenario 62: Pending request containing inconsistent rejection signature returns HTTP 409 fail-closed
  - Scenario 63: Legitimate two-human approval workflow (Security Officer + Lead Architect) succeeds and ratifies quorum
- [ ] **Step 2: Run `npm run test:dmk-197` and verify tests fail (RED)**
  - Expected: Failure on new negative validation scenarios

---

### Task 2: Implement Canonical Signature Validation in `server/proposals/quorum.ts` and `server/proposals/signoff.ts` (GREEN Phase)

**Files:**
- Modify: `server/proposals/quorum.ts`
- Modify: `server/proposals/signoff.ts`

- [ ] **Step 3: Implement `validateStoredSignatures` in `server/proposals/quorum.ts`**
  - Enforce non-null object, valid decision (`APPROVED` | `REJECTED`), canonical role in `requiredRoles`, non-empty trimmed `identityId`, exact `roleSource === 'LOCAL_SERVER_ROSTER'`.
  - Reject rejection signatures in `isPending` items.
  - Reject duplicate signer identities and duplicate role approvals.
  - Return `{ valid, error, satisfiedRoles, usedIdentities }`.
- [ ] **Step 4: Integrate `validateStoredSignatures` into `server/proposals/signoff.ts`**
  - Pre-validate `item.approvalsCollected` using `validateStoredSignatures`.
  - On failure, return HTTP 409 with clear error message, without mutating store/stateVersion/auditLogs/target.
  - Determine `alreadySatisfiedRoles` from `sigValidation.satisfiedRoles`.
  - Check `alreadySigned` against `sigValidation.usedIdentities`.
- [ ] **Step 5: Run `npm run test:dmk-197` and verify all 63 scenarios pass (GREEN)**
  - Expected: 63 / 63 PASS

---

### Task 3: Local Verification Suite & Regression Run

**Files:**
- None (execution of test suites)

- [ ] **Step 6: Run local verification suites**
  - `npm run test:dmk-197`
  - `npm run test:dmk-197:ui`
  - `npm run test:dmk-197:persistence`
  - `npm run test:req-signoff`
  - `npm run test:req-sync`
  - `npm run test:projects-workspace:ui`
  - `npm run wbs:check`
  - `npm run lint`
  - `npm run build`
  - `npm run test:controlled-docs`
  - `npm run test:complete`

---

### Task 4: Commit, Push & Verify Implementation CI

**Files:**
- Commit implementation changes and test additions: `server/proposals/quorum.ts`, `server/proposals/signoff.ts`, `scripts/testDmk197Quorum.ts`

- [ ] **Step 7: Commit implementation changes and push to `origin/dmk-197-approval-inbox-quorum`**
  - Commit message: `fix(dmk-197): enforce strict stored signature provenance and canonical role occupancy`
- [ ] **Step 8: Monitor GitHub Actions CI on implementation HEAD until green**
  - Record implementation HEAD SHA, CI run ID, attempt, and job conclusions.

---

### Task 5: Rebaseline Closure Candidate, Update Verification Evidence & Controlled Docs

**Files:**
- Modify: `docs/07_verification/dmk-197-closure-transition-candidate.json`
- Modify: `scripts/verifyDmk197ClosureCandidate.ts`
- Modify: `scripts/testDmk197ClosureCandidate.ts`
- Modify: `docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md`
- Modify: `docs/07_verification/DMK_197_CLOSURE_TRANSITION_REVIEW.md`
- Governed save: `docs/00_control/PROJECT_STATE.md` (`DOC-CTRL-002`)

- [ ] **Step 9: Update candidate JSON with new implementation HEAD and CI run ID**
  - Preserve `supersededCandidateDigest: '5c7664aeacb9151ce37426571bbb8be4c0498499b87dae39de380b47b96457ec'`
  - Compute new deterministic candidate digest.
- [ ] **Step 10: Update verifiers and test suites**
  - Update `scripts/verifyDmk197ClosureCandidate.ts` with new SHA, run ID, and candidate digest.
  - Update `scripts/testDmk197ClosureCandidate.ts`.
- [ ] **Step 11: Execute Controlled Docs save for `PROJECT_STATE.md` (`DOC-CTRL-002`)**
  - Record audit event ID, SHA-256 byte invariant, stateVersion bump, audit count bump.
- [ ] **Step 12: Update verification reports**
  - Synchronize `DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md` and `DMK_197_CLOSURE_TRANSITION_REVIEW.md`.
- [ ] **Step 13: Run final verification checks**
  - `verify:dmk-197-closure-candidate`
  - `test:dmk-197-closure-candidate`
  - `verify:dmk-196-closure`
  - `verify:dmk-196-post-merge`
  - `verify:dmk-208-status-audit`
  - `wbs:check`
  - `test:complete`
- [ ] **Step 14: Commit review baseline, push, update PR #27 description, and monitor review CI**
  - Commit message: `docs(dmk-197): record rebaselined closure-transition candidate and review evidence`
  - Push to remote
  - Update PR #27 description
  - Monitor GitHub CI on review HEAD

---

### Task 6: Final 14-Point Report & Halt at Human Decision Gate

- [ ] **Step 15: Present comprehensive 14-point report and halt strictly at the DMK-197 Closure-Transition Human Decision Gate.**
