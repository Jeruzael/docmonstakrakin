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
- **Candidate Digest (SHA-256):** `0b51dce158c989a437e3ad1776ec3388ada8a556558e3a668393452f5c98cbf7`
- **Superseded Candidate Digest:** `4f808143eb07c2770df238fc4f641de75896bba389f39f99cdc8bb9d92791ad8`
- **Superseded Prior Candidate Digests:** `b6c3aa4874f05813767e12015cda4ffa1996684c48be30defcd210e65296f0d7`, `36e8d05f6d70644966808c5436fbe9d22de4f418d41537d9b0e8e48ee243f891`, `5c7664aeacb9151ce37426571bbb8be4c0498499b87dae39de380b47b96457ec`, `c1ee902a80de1f1676c09fdaa18980b55abe10040710602f4bc9bcd14ce88627`
- **Pull Request:** #27 (`dmk-197-approval-inbox-quorum`)
- **Frozen Implementation HEAD:** `dab159041b9b2616c42d2654598d0949e5778d85`
- **Base Master SHA:** `7e45da9b0d4d8553745e5b7c25597eb48c94d6af` (PR #26 merge commit)
- **Frozen Implementation CI Run:** `38150032624` (Attempt 1: Quality & Build PASS, Controlled Docs PASS, Complete Regression PASS)
- **Pre-Closure Canonical WBS SHA-256:** `c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087`
- **Proposed WBS Delta Preview Digest (SHA-256):** `49c1ea1426a583999c2422b3460933134f84f6e7405feca7145c40dc5f9b4d41`
- **Canonical Acceptance Criterion:** "Distinct Security Officer and Lead Architect human identities required for quorum"
- **Human Governance Status:** `PENDING_SIGNOFF`
- **Active Reconciliation Blockers:** 11 (Historical 9: DMK-156, DMK-157, DMK-158, DMK-159, DMK-165, DMK-187, DMK-188, DMK-189, DMK-190 + DMK-208 + DMK-196)
- **Live Reconciliation:** BLOCKED / NOT AUTHORIZED / NOT EXECUTED
- **PR #27 Status:** OPEN / DRAFT / UNMERGED

---

## 1. Executive Summary & Authorization Scope

This document provides formal, deterministic, and independently verifiable closure-transition evidence for **DMK-197** (*Approval Inbox & Canonical Quorum Synchronization*), superseding the previous closure candidate following targeted remediation.

The human operator authorized **candidate preparation only** (`IN_PROGRESS → VERIFICATION_PENDING`). This authorization is strictly bounded:
1. **Zero WBS Drift:** `docs/00_control/MASTER_WBS.yaml` and `docs/00_control/MASTER_WBS.md` remain completely unmodified on disk. Canonical status remains strictly `IN_PROGRESS`.
2. **No Applied Receipt:** No `dmk-197-closure-transition-receipt.json` has been created or recorded. No human approval has been fabricated (`human_approved_by` remains absent; `humanDecisionStatus: "PENDING"`).
3. **Not Technically Verified:** DMK-197 is NOT marked `VERIFIED`.
4. **No PR Merge:** PR #27 remains OPEN, DRAFT, and UNMERGED.
5. **No Reconciliation:** Active reconciliation blockers remain strictly at 11; live reconciliation remains BLOCKED, NOT AUTHORIZED, and NOT EXECUTED.
6. **No Release Mutation:** Gate 7 and release promotion remain untouched (`v0.1.0-rc1 / NOT PROMOTED`).
7. **Strict Stop:** Execution strictly halts at the **DMK-197 Closure-Transition Human Decision Gate**.

---

## 2. Technical Implementation & Targeted Remediation Hardening

The implementation frozen at commit `dab159041b9b2616c42d2654598d0949e5778d85` satisfies the reviewed functional requirements and incorporates the operator-directed integrity remediations:

### 2.1 Correction A (P1 - Security): Approval Inbox Read Authorization
- **Server Enforcement (`server/proposals/signoff.ts`):** `GET /api/projects/:id/approvals` strictly enforces human session authorization via `requireHuman`. Non-authenticated callers receive HTTP 401; non-governance identities receive HTTP 403. Nonexistent projects return HTTP 404 for authorized reviewers.
- **Zero Mutation Guarantee:** Reads are verified non-mutating: zero `stateVersion` bumps and zero audit log entries across successful and failed read calls.
- **UI Graceful Degradation (`src/components/ApprovalsView.tsx`):** Unauthenticated (401) and forbidden (403) states render dedicated security notice cards with session re-check capability and clean project-switch state resetting.
- **Project Loader Resilience (`src/data/projectWorkspace.ts`):** `createProjectLoader` safely treats 401/403 responses on `/approvals` as an empty collection for general workspace loading, preserving full project readability for unauthenticated viewers without failing project load.

### 2.2 Correction B (P2 - Robustness): Malformed Stored Approval Records
- **Decision Pre-Validation (`server/proposals/signoff.ts`):** `POST /api/projects/:id/approvals/:apvId/decide` validates that `item.approvalsCollected` is an array and each signature is a valid object containing non-empty `role`, valid `decision` (`APPROVED` or `REJECTED`), non-empty `identityId`, and string `roleSource`. Rejects malformed records with HTTP 409 fail-closed without mutating state, audit log, or canonical targets.
- **Quorum Evaluator Safeguard (`server/proposals/quorum.ts`):** `evaluateQuorum` safely skips null or non-object signature entries during rejection scanning and verification loops.

### 2.3 Correction C (P2 - Test Coverage): Premature Closure Receipt Regression
- **Isolated Workspace Test (`scripts/testDmk197ClosureCandidate.ts` Scenario 19):** Constructs an isolated temporary workspace, injects a synthetic `dmk-197-closure-transition-receipt.json`, executes `verifyDmk197ClosureCandidate({ workspaceRoot: tempDir })`, asserts fail-closed rejection identifying premature receipt creation, removes the temporary workspace, and verifies real repository disk and canonical WBS remain untouched.

### 2.4 Authoritative Server Quorum Evaluator (`server/proposals/quorum.ts`)
- **Canonical Policy Version:** Enforces `policyVersion === 'LOCAL_SESSION_V1'`. Malformed or legacy versions fail closed (`INVALID`, `hasQuorum = false`).
- **Exact Required Roles:** Requires exactly two roles: `['Security Officer', 'Lead Architect']`. Extra, missing, or altered roles fail closed.
- **Strict Target Digest:** Rejects missing or non-SHA256 hex strings fail-closed.
- **Strict Signature Provenance:** Signatures count only if `decision === 'APPROVED'`, `identityId` is non-empty, and `roleSource === 'LOCAL_SERVER_ROSTER'`.
- **Distinct Human Identities:** A single human identity possessing dual roles (`REV-DUAL-01`) cannot satisfy both quorum slots (HTTP 409).
- **Target Freshness & Mutation Handling:**
  - Pending requests fail closed if canonical target mutated (`STALE`) or deleted (`currentTargetDigest === null`).
  - Ratified requests (`APPROVED`) verify against `postRatificationDigest || targetDigest`, avoiding false stale classification upon status mutation.
- **Single-Rejection Termination:** A valid human rejection immediately terminates the request (`REJECTED`) and requires a justification note.

### 2.5 Correction D (P1 - Governance Integrity): Final Signature Integrity Remediation
- **Strict Stored Signature Provenance (`server/proposals/signoff.ts`):** Pre-validates all stored signatures on pending requests via `validateStoredSignatures(item.approvalsCollected)` in `server/proposals/quorum.ts` before processing decisions. Enforces non-null objects, canonical roles (`Security Officer` / `Lead Architect`), non-empty `identityId`, exact `roleSource === 'LOCAL_SERVER_ROSTER'`, valid decision (`APPROVED` or `REJECTED`), fail-closed on inconsistent rejection signatures in `PENDING` requests, duplicate signer identities, duplicate satisfied-role signatures, and invalid signatures attempting to occupy quorum slots. Returns HTTP 409 fail-closed without mutating state, audit logs, `stateVersion`, or canonical targets.
- **Synchronized Decision-Time Role Occupancy (`server/proposals/quorum.ts`):** Synchronized decision-time role occupancy with canonical quorum validation rules via shared helper `validateStoredSignatures` in `server/proposals/quorum.ts`. `alreadySatisfiedRoles` is populated strictly from `sigValidation.satisfiedRoles` rather than raw unvalidated `item.approvalsCollected.filter(a => a.decision === 'APPROVED')`.
- **Deterministic Negative Scenarios (`scripts/testDmk197Quorum.ts`):** Added 10 deterministic regression scenarios (Scenarios 54–63) covering missing/empty `identityId`, missing/invalid `roleSource`, unknown roles, duplicate identities across roles, duplicate approvals for same role, invalid Security Officer signature followed by legitimate decision (HTTP 409 fail-closed, not HTTP 403 slot-occupied), pending request containing rejection signatures, valid dual-human approval workflow ratification, and non-mutation invariance.

### 2.6 Correction E (P1 - Governed Recovery): Approval Recovery & Deduplication Remediation
- **Corrupted Pending Approval Deduplication (`server/proposals/signoff.ts`):** `POST /api/projects/:id/approvals` validates existing pending approvals against canonical schema (`LOCAL_SESSION_V1`, exact roles `['Security Officer', 'Lead Architect']`, valid 64-char hex `targetDigest`, `validateStoredSignatures`). Returns existing approval (HTTP 201) on healthy requests without audit mutation; returns HTTP 409 (`code: 'REISSUE_REQUIRED'`) on corrupted pending requests; returns HTTP 409 on multiple conflicting active requests or target digest mismatch.
- **Governed Reissue Endpoint (`server/proposals/signoff.ts`):** `POST /api/projects/:id/approvals/:apvId/reissue` authenticates session human reviewer (`requireHuman`), rejects agent claims (HTTP 403), enforces `humanConfirmed === true` and non-empty justification (HTTP 422), verifies corruption and matching target digest, atomically transitions original to terminal `SUPERSEDED`, creates fresh `PENDING` replacement with 0 signatures, bumps `stateVersion`, records audit event `APPROVAL_REISSUED`, and supports idempotent retry.
- **Approval Inbox Recovery UX (`src/components/ApprovalsView.tsx`):** Displays `REISSUE REQUIRED` state for corrupted approvals, preserves historical evidence explanation notice, renders `Reissue Sign-Off` modal requiring confirmation and justification, and enforces project-switch isolation. Displays `SUPERSEDED` records as non-actionable historical items.
- **20 Deterministic Regression Scenarios:** Added across `scripts/testDmk197Quorum.ts` (Scenarios 64–80; 80/80 total), `scripts/testDmk197Persistence.ts` (PERSIST-3; 3/3 total), and `scripts/testDmk197ApprovalInboxUi.ts` (UI-21, UI-22, UI-23; 23/23 total).

### 2.7 Correction F (P1 - Robustness & Integrity): Recovery UI & Canonical Type Corrections
- **Server-Authoritative Malformed-Signature Projection (`server/proposals/quorum.ts` & `server/proposals/signoff.ts`):** `evaluateQuorum` evaluates stored signatures on pending approvals via `validateStoredSignatures`. Corrupted stored signatures on pending approvals return `status = 'INVALID'`, `hasQuorum = false`, `satisfiedRoles = []`. In `GET /api/projects/:id/approvals`, projects server-derived non-persisted `reissueRequired: true` and `reissueReason` for corrupted pending items when their canonical targets exist and are fresh (`item.targetDigest === currentTargetDigest`). Healthy pending requests, stale/missing targets, and historical completed records retain `reissueRequired = false`.
- **Approval Inbox Recovery UX (`src/components/ApprovalsView.tsx`):** Unified `isReissue` checks using authoritative `reissueRequired` projection across approval list cards, card actions, inspector badges, inspector decision buttons, and corruption banners. Normal decision buttons (`Approve`, `Reject`) are suppressed for corrupted items, exposing `Reissue Sign-Off` quick actions and modal. Maintains strict project-switch isolation and historical evidence notices.
- **Canonical Replacement Approval Type & Integrity Mapping (`server/proposals/signoff.ts`):** Authoritatively maps target entities to canonical approval types (`REQUIREMENT` -> `REQUIREMENT_BASELINE`, `ADR` -> `ADR_SIGN_OFF`, `RISK` -> `RISK_ACCEPTANCE`, `OVERRIDE` -> `SECURITY_OVERRIDE`). Deduplication (`POST /api/projects/:id/approvals`) detects mismatched `type` as corrupted and returns HTTP 409 `REISSUE_REQUIRED`. Governed reissue (`POST /api/projects/:id/approvals/:apvId/reissue`) assigns canonical type `spec[1]` to the replacement approval while preserving original corrupted record unmutated.
- **Deterministic Regression Scenarios:** Added Scenarios 81 and 82 in `scripts/testDmk197Quorum.ts` (82/82 total) and Playwright UI scenario UI-24 in `scripts/testDmk197ApprovalInboxUi.ts` (24/24 total).

### 2.8 Correction G (P1 - Governance Integrity): Final Governance Consistency Remediation
- **Decision-Time Canonical Approval Type Validation (`server/proposals/signoff.ts`):** `POST /api/projects/:id/approvals/:apvId/decide` resolves canonical target mapping (`mapping[item.targetEntityType]`), rejects unsupported target entity types (HTTP 409 `REISSUE_REQUIRED`), and verifies `item.type === spec[1]`. Rejects mismatches with HTTP 409 `REISSUE_REQUIRED` without appending signatures, changing status, mutating targets, incrementing `stateVersion`, or creating audit events.
- **Governed Reissue Eligibility & Pending Ratification Metadata Policy Synchronized (`server/proposals/quorum.ts` & `server/proposals/signoff.ts`):** `evaluateQuorum` enforces that for `item.status === 'PENDING'`, `postRatificationDigest` must NOT exist (`status = 'INVALID'`). In `POST .../decide`, reject if `item.status === 'PENDING' && item.postRatificationDigest !== undefined` with HTTP 409 `REISSUE_REQUIRED`. Deduplication checks `prior.postRatificationDigest === undefined`. In `GET /api/projects/:id/approvals`, project `reissueRequired: true` strictly when canonical target exists and is fresh (`currentTargetDigest === item.targetDigest`), supported target type, eligible override, no conflicting active pending approvals, item is pending, un-superseded, and corrupted. Stale/missing targets and conflicting approvals project `reissueRequired: false`.
- **Remove Unsafe UI Recovery Fallback (`src/components/ApprovalsView.tsx`):** Rely strictly on authoritative `item.status === 'PENDING' && Boolean(item.reissueRequired ?? q.reissueRequired)` for displaying `Reissue Sign-Off`. Removed `q.status === 'INVALID'` fallback from enabling reissue. Normal decision buttons (`Approve`, `Reject`) are suppressed for invalid/stale/reissue-required items.
- **Deterministic Regression Scenarios:** Added Scenarios 83–86 in `scripts/testDmk197Quorum.ts` (86/86 total) and Playwright UI scenario UI-25 in `scripts/testDmk197ApprovalInboxUi.ts` (25/25 total):
  - Scenario 83: Direct decision endpoint rejects mismatched canonical approval type with zero or one existing valid signature; HTTP 409 and zero mutation
  - Scenario 84: Pending approval containing unexpected `postRatificationDigest` is invalid; decision and deduplication fail closed; governed reissue succeeds
  - Scenario 85: Corrupted pending approval referencing a stale canonical target cannot be reissued
  - Scenario 86: Corrupted pending approval with conflicting active pending requests cannot be reissued
  - Scenario UI-25: Ineligible invalid approval renders policy warning, suppresses decision buttons, and does not render `Reissue Sign-Off` button

---

## 3. Verification Evidence & Regression Matrix

All verification checks execute fail-closed and pass cleanly:

| Suite / Verification Check | Command | Checks / Scenarios | Status | Evidence Log |
|---|---|---|---|---|
| DMK-197 Core Quorum Suite | `npm run test:dmk-197` | 86 / 86 checks | **PASS** | `scripts/testDmk197Quorum.ts` |
| DMK-197 Approval Inbox UI Suite | `npm run test:dmk-197:ui` | 25 / 25 checks | **PASS** | `scripts/testDmk197ApprovalInboxUi.ts` |
| DMK-197 Persistence Suite | `npm run test:dmk-197:persistence` | 3 / 3 checks | **PASS** | `scripts/testDmk197Persistence.ts` |
| Requirement Sign-Off Suite | `npm run test:req-signoff` | 15 / 15 checks | **PASS** | `scripts/testRequirementSignoff.ts` |
| Requirement Status Sync Suite | `npm run test:req-sync` | 12 / 12 checks | **PASS** | `scripts/testRequirementStatusSync.ts` |
| Projects Workspace UI Suite | `npm run test:projects-workspace:ui` | 14 / 14 checks | **PASS** | `scripts/testProjectsWorkspaceUi.ts` |
| DMK-197 Closure Candidate Verifier | `npm run verify:dmk-197-closure-candidate` | 21 Invariants | **PASS** | `scripts/verifyDmk197ClosureCandidate.ts` |
| DMK-197 Candidate Regression Suite | `npm run test:dmk-197-closure-candidate` | 20 Scenarios | **PASS** | `scripts/testDmk197ClosureCandidate.ts` |
| Historical DMK-196 Closure Verifier | `npm run verify:dmk-196-closure` | 18 Invariants | **PASS** | `scripts/verifyDmk196Closure.ts` |
| Historical DMK-196 Post-Merge Verifier | `npm run verify:dmk-196-post-merge` | 38 Invariants | **PASS** | `scripts/verifyDmk196PostMergeCandidate.ts` |
| Historical DMK-208 Status Audit Verifier | `npm run verify:dmk-208-status-audit` | 56 Invariants | **PASS** | `scripts/verifyDmk208StatusAudit.ts` |
| Self Work-Item Reconciliation Test | `npm run test:self-work-sync` | 90 / 90 checks | **PASS** | `scripts/testSelfWorkItemReconciliation.ts` |
| Controlled Docs Matrix Suite | `npm run test:controlled-docs` | 87 / 87 checks | **PASS** | `scripts/testControlledDocs.ts` |
| Canonical WBS Drift Check | `npm run wbs:check` | 0 drift | **PASS** | `scripts/renderWbs.ts --check` |
| Complete Regression Suite | `npm run test:complete` | 51 suites / 1203 checks | **PASS** | `runtime/rc-regression/results.json` |

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
