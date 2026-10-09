# DMK-197 Closure-Transition Review Evidence

## Document Control

- **WorkItem:** DMK-197
- **WBS Path:** `13.06.11`
- **Parent:** `EPIC-13`
- **Title:** Batch 3 — Approval Inbox & Canonical Quorum Synchronization
- **Canonical Status:** `IN_PROGRESS` (Strictly retained; zero drift in canonical WBS)
- **Proposed Lifecycle Transition:** `IN_PROGRESS → VERIFICATION_PENDING`
- **Closure Transition State:** PROPOSED CANDIDATE ONLY (Not applied; awaiting human operator decision)
- **Closure Candidate File:** `docs/07_verification/dmk-197-closure-transition-candidate.json`
- **Candidate Digest (SHA-256):** `c1ee902a80de1f1676c09fdaa18980b55abe10040710602f4bc9bcd14ce88627`
- **Pull Request:** #27 (`dmk-197-approval-inbox-quorum`)
- **Frozen Implementation HEAD:** `234c85b88ce042ce3019c7a8b463ac2e22b8ae86`
- **Base Master SHA:** `7e45da9b0d4d8553745e5b7c25597eb48c94d6af` (PR #26 merge commit)
- **Frozen Implementation CI Run:** `37946050979` (Attempt 1: Quality & Build PASS, Controlled Docs PASS, Complete Regression PASS)
- **Pre-Closure Canonical WBS SHA-256:** `c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087`
- **Proposed WBS Delta Preview Digest (SHA-256):** `49c1ea1426a583999c2422b3460933134f84f6e7405feca7145c40dc5f9b4d41`
- **Canonical Acceptance Criterion:** "Distinct Security Officer and Lead Architect human identities required for quorum"
- **Human Governance Status:** `PENDING_SIGNOFF`
- **Active Reconciliation Blockers:** 11 (Historical 9: DMK-156, DMK-157, DMK-158, DMK-159, DMK-165, DMK-187, DMK-188, DMK-189, DMK-190 + DMK-208 + DMK-196)
- **Live Reconciliation:** BLOCKED / NOT AUTHORIZED / NOT EXECUTED
- **PR #27 Status:** OPEN / DRAFT / UNMERGED

---

## 1. Executive Summary & Authorization Scope

This document provides formal, deterministic, and independently verifiable closure-transition evidence for **DMK-197** (*Approval Inbox & Canonical Quorum Synchronization*).

The human operator authorized **candidate preparation only** (`IN_PROGRESS → VERIFICATION_PENDING`). This authorization is strictly bounded:
1. **Zero WBS Drift:** `docs/00_control/MASTER_WBS.yaml` and `docs/00_control/MASTER_WBS.md` remain completely unmodified on disk. Canonical status remains strictly `IN_PROGRESS`.
2. **No Applied Receipt:** No `dmk-197-closure-transition-receipt.json` has been created or recorded. No human approval has been fabricated (`human_approved_by` remains absent; `humanDecisionStatus: "PENDING"`).
3. **Not Technically Verified:** DMK-197 is NOT marked `VERIFIED`.
4. **No PR Merge:** PR #27 remains OPEN, DRAFT, and UNMERGED.
5. **No Reconciliation:** Active reconciliation blockers remain strictly at 11; live reconciliation remains BLOCKED, NOT AUTHORIZED, and NOT EXECUTED.
6. **No Release Mutation:** Gate 7 and release promotion remain untouched (`v0.1.0-rc1 / NOT PROMOTED`).
7. **Strict Stop:** Execution strictly halts at the **DMK-197 Closure-Transition Human Decision Gate**.

---

## 2. Technical Implementation & Integrity Invariants

The implementation frozen at commit `234c85b88ce042ce3019c7a8b463ac2e22b8ae86` satisfies all functional requirements and integrity hardening criteria:

### 2.1 Authoritative Server Quorum Evaluator (`server/proposals/quorum.ts`)
- **Canonical Policy Version:** Enforces `policyVersion === 'LOCAL_SESSION_V1'`. Malformed or legacy versions fail closed (`INVALID`, `hasQuorum = false`).
- **Exact Required Roles:** Requires exactly two roles: `['Security Officer', 'Lead Architect']`. Extra, missing, or altered roles fail closed.
- **Strict Target Digest:** Rejects missing or non-SHA256 hex strings fail-closed.
- **Strict Signature Provenance:** Signatures count only if `decision === 'APPROVED'`, `identityId` is non-empty, and `roleSource === 'LOCAL_SERVER_ROSTER'`.
- **Distinct Human Identities:** A single human identity possessing dual roles (`REV-DUAL-01`) cannot satisfy both quorum slots (HTTP 409).
- **Target Freshness & Mutation Handling:**
  - Pending requests fail closed if canonical target mutated (`STALE`) or deleted (`currentTargetDigest === null`).
  - Ratified requests (`APPROVED`) verify against `postRatificationDigest || targetDigest`, avoiding false stale classification upon status mutation.
- **Single-Rejection Termination:** A valid human rejection immediately terminates the request (`REJECTED`) and requires a justification note.

### 2.2 Hardened Sign-Off Routes (`server/proposals/signoff.ts`)
- **Request Creation (`POST /api/projects/:id/approvals`):**
  - Authenticated human session enforced via `requireHuman`. Agent callers (`actorType === 'AGENT'`) are rejected (HTTP 403).
  - Protected controls (Gate 7 and release ceremonies) are strictly rejected from generic sign-off routes (HTTP 403 / 422), normalized against alternative spellings.
  - Security Override validation rejects expired overrides, unacknowledged risks, or protected control overrides.
  - Idempotent deduplication preserves audit logs and stateVersion on duplicate submissions.
  - Atomic persistence to disk via `installProjectPersistence`.
- **Decision Submission (`POST /api/projects/:id/approvals/:apvId/decide`):**
  - Caller-supplied identity claims in request body rejected with HTTP 403.
  - `humanConfirmed === true` required.
  - Pre-validation rejects malformed stored requests fail-closed without mutating project state or audit log.
  - Atomic transition of ratified artifacts (Requirement → `APPROVED`, ADR → `ACCEPTED`, Override → `APPROVED` with `authorizedBy`). Risk records maintain schema integrity without illegal status fields.

### 2.3 Approval Inbox UI (`src/components/ApprovalsView.tsx`)
- Projects authoritative server-evaluated quorum statuses.
- Enforces distinct human signers and renders required roles.
- Race-condition and project-switch safe: cleans up inflight controller state and resets submission flags upon switching projects.

---

## 3. Verification Evidence & Regression Matrix

All verification checks execute fail-closed and pass cleanly:

| Suite / Verification Check | Command | Checks / Scenarios | Status | Evidence Log |
|---|---|---|---|---|
| DMK-197 Core Quorum Suite | `npm run test:dmk-197` | 46 / 46 checks | **PASS** | `scripts/testDmk197Quorum.ts` |
| DMK-197 Approval Inbox UI Suite | `npm run test:dmk-197:ui` | 18 / 18 checks | **PASS** | `scripts/testDmk197ApprovalInboxUi.ts` |
| DMK-197 Persistence Suite | `npm run test:dmk-197:persistence` | 2 / 2 checks | **PASS** | `scripts/testDmk197Persistence.ts` |
| Requirement Sign-Off Suite | `npm run test:req-signoff` | 15 / 15 checks | **PASS** | `scripts/testRequirementSignoff.ts` |
| Requirement Status Sync Suite | `npm run test:req-sync` | 12 / 12 checks | **PASS** | `scripts/testRequirementStatusSync.ts` |
| Projects Workspace UI Suite | `npm run test:projects-workspace:ui` | 14 / 14 checks | **PASS** | `scripts/testProjectsWorkspaceUi.ts` |
| DMK-197 Closure Candidate Verifier | `npm run verify:dmk-197-closure-candidate` | 20 Invariants | **PASS** | `scripts/verifyDmk197ClosureCandidate.ts` |
| DMK-197 Candidate Regression Suite | `npm run test:dmk-197-closure-candidate` | 19 Scenarios | **PASS** | `scripts/testDmk197ClosureCandidate.ts` |
| Historical DMK-196 Closure Verifier | `npm run verify:dmk-196-closure` | 18 Invariants | **PASS** | `scripts/verifyDmk196Closure.ts` |
| Historical DMK-196 Post-Merge Verifier | `npm run verify:dmk-196-post-merge` | 38 Invariants | **PASS** | `scripts/verifyDmk196PostMergeCandidate.ts` |
| Historical DMK-208 Status Audit Verifier | `npm run verify:dmk-208-status-audit` | 56 Invariants | **PASS** | `scripts/verifyDmk208StatusAudit.ts` |
| Self Work-Item Reconciliation Test | `npm run test:self-work-sync` | 90 / 90 checks | **PASS** | `scripts/testSelfWorkItemReconciliation.ts` |
| Canonical WBS Drift Check | `npm run wbs:check` | 0 drift | **PASS** | `scripts/renderWbs.ts --check` |
| Complete Regression Suite | `npm run test:complete` | 51 suites / 1154 checks | **PASS** | `runtime/rc-regression/results.json` |

---

## 4. Historical Verifier Compatibility Analysis

Historical verifiers in the repository enforce strict invariants on canonical WBS state:
- `scripts/verifyDmk196Closure.ts` (line 199) asserts `dmk197.status === 'IN_PROGRESS'`.
- `scripts/verifyDmk196PostMergeCandidate.ts` (line 590) asserts `dmk197.status === 'IN_PROGRESS'`.
- `scripts/verifyDmk208StatusAudit.ts` (line 567) checks `canonicalItem.status === item.candidateStatus`, where DMK-197 is `IN_PROGRESS` in `dmk-208-status-audit-candidate.json`.

### Compatibility Status in Current Pass:
Because this pass prepares the candidate document with **zero WBS drift** (`MASTER_WBS.yaml` status remains `IN_PROGRESS`), all historical verifiers continue to pass cleanly without any modification.

### Future Guardrail (Separately Authorized Application Pass):
When the human operator authorizes applying the closure transition:
1. An immutable applied closure receipt `docs/07_verification/dmk-197-closure-transition-receipt.json` will be generated.
2. Historical verifiers will be updated with an explicit receipt-bound exception: allowing DMK-197 to be `VERIFICATION_PENDING` only if a valid, uncorrupted, and cryptographically verified DMK-197 closure receipt is present on disk.
3. No premature edits to historical verifiers are permitted prior to receipt creation.

---

## 5. Proposed Canonical WBS Delta Preview (Read-Only)

The following proposed change is provided for inspection only. Canonical WBS files remain untouched on disk:

```diff
--- a/docs/00_control/MASTER_WBS.yaml
+++ b/docs/00_control/MASTER_WBS.yaml
@@ -262,3 +262,5 @@
-    status: "IN_PROGRESS"
+    status: "VERIFICATION_PENDING"
     dependencies: ["DMK-196"]
     requirements: ["REQ-GOV-QUORUM-001"]
     architecture_links: ["CMP-01", "CMP-04"]
     security_controls: ["SEC-CTRL-020"]
     acceptance_criteria:
       - "Distinct Security Officer and Lead Architect human identities required for quorum"
     verification_method: "Quorum verification test"
-    evidence: []
+    evidence:
+      - "docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md"
+      - "docs/07_verification/dmk-197-closure-transition-candidate.json"
```

**Proposed Delta Preview Digest (SHA-256):**  
`49c1ea1426a583999c2422b3460933134f84f6e7405feca7145c40dc5f9b4d41`

---

## 6. Human Decision Options

Execution stops at the **DMK-197 Closure-Transition Human Decision Gate**. The human operator may choose from the following options:

1. **Option 1: APPROVE**  
   Authorize application of the DMK-197 closure transition (`IN_PROGRESS → VERIFICATION_PENDING`).  
   Requires creating `docs/07_verification/dmk-197-closure-transition-receipt.json`, updating canonical WBS, updating historical verifiers with receipt-bound exceptions, and executing Controlled Docs save for `PROJECT_STATE.md`.

2. **Option 2: REJECT**  
   Decline the closure transition candidate. DMK-197 remains `IN_PROGRESS` and the candidate proposal is archived or deleted.

3. **Option 3: REQUIRE_REMEDIATION**  
   Request specific additional tests, hardening, or UI adjustments prior to formal lifecycle transition consideration.
