# DOCMONSTAKRAKIN — DMK-197 Technical Verification Evidence

**WorkItem:** DMK-197  
**WBS Path:** `13.06.11`  
**Parent:** `EPIC-13`  
**Title:** Approval Inbox & Canonical Quorum Synchronization  
**Canonical Acceptance Criterion:** Distinct Security Officer and Lead Architect human identities required for quorum  
**Base Master SHA:** `7e45da9b0d4d8553745e5b7c25597eb48c94d6af` (merge commit of PR #26)  
**Base Master CI Run:** `37909221729` (Attempt 1: Quality & Build PASS, Controlled Docs PASS, Complete Regression PASS)  
**Branch:** `dmk-197-approval-inbox-quorum`  
**Canonical WBS Status:** `IN_PROGRESS` (Strictly retained; no forward lifecycle transition in WBS)  
**Human Governance Status:** `PENDING_SIGNOFF`  
**Active Reconciliation Blockers:** 11 (Historical 9 + DMK-208 + DMK-196)  
**Live Reconciliation:** BLOCKED / NOT AUTHORIZED / NOT EXECUTED  

---

## 1. Executive Summary

This verification record establishes the technical implementation and verification evidence for work item **DMK-197** (*Approval Inbox & Canonical Quorum Synchronization*).

DMK-197 enforces that formal sign-off on canonical proposed artifacts (Requirements, ADRs, Risks, and eligible Security Overrides) requires a dual-role quorum comprised of distinct human identities for **Security Officer** and **Lead Architect**.

In accordance with explicit governance instructions:
1. DMK-197 WBS status remains strictly `IN_PROGRESS` throughout this pass; no transition to `VERIFICATION_PENDING` or `VERIFIED` has been applied to `docs/00_control/MASTER_WBS.yaml` or `MASTER_WBS.md`.
2. Human Governance remains strictly `PENDING_SIGNOFF`; `human_approved_by` remains absent.
3. Active reconciliation blockers remain strictly at 11.
4. Live reconciliation remains BLOCKED, NOT AUTHORIZED, and NOT EXECUTED.
5. Work stops at the **DMK-197 Implementation Review Gate** pending human operator review.

---

## 2. Architecture & Policy Enforcement

### 2.1 Authoritative Server Quorum Evaluator (`server/proposals/quorum.ts`)
The server defines `evaluateQuorum(item: ApprovalItem, currentTargetDigest?: string): QuorumEvaluation`, enforcing:
- **Required Roles:** `['Security Officer', 'Lead Architect']`.
- **Distinct Human Identities:** A single human identity possessing both roles (`REV-DUAL-01`) cannot satisfy both slots. The second decision attempt is rejected with HTTP 409.
- **Valid Signatures:** Only signatures with `decision === 'APPROVED'`, non-empty `identityId`, `roleSource === 'LOCAL_SERVER_ROSTER'`, matching a required role, and `policyVersion === 'LOCAL_SESSION_V1'` count toward quorum.
- **Stale Digests:** If the canonical target artifact is mutated after sign-off initiation, `currentTargetDigest !== item.targetDigest` evaluates to `STALE`, preventing quorum ratification.
- **Rejection Termination:** A single authorized human rejection transitions the request status to `REJECTED`, requiring a meaningful justification note.

### 2.2 Hardened Sign-Off Routes (`server/proposals/signoff.ts`)
- **Request Creation (`POST /api/projects/:id/approvals`):**
  - Authenticated session check via `requireHuman`.
  - Rejection of agent identities (`actorType === 'AGENT'`) with HTTP 403.
  - Rejection of release promotion and Gate 7 ceremonies with HTTP 422 (explaining dedicated ceremonies).
  - Validation of Security Overrides: expired overrides (HTTP 422), unacknowledged risks (HTTP 422), and attempts to override Gate 7 or release (HTTP 403) are strictly denied.
  - Deduplication: checks `projectId`, `targetEntityType`, `targetEntityId`, `targetDigest`, `policyVersion`, and `status === 'PENDING'` without duplicate audit events or stateVersion increments.
- **Decision Submission (`POST /api/projects/:id/approvals/:apvId/decide`):**
  - Caller-supplied identity claims (`approver`, `role`, `reviewerName`, `reviewerRole`, `authorizedRole`, `actorType === 'AGENT'`) in the request body are rejected with HTTP 403 before any item lookup.
  - Requires `humanConfirmed === true` (HTTP 403 if omitted/false).
  - Server assigns reviewer role based on unsatisfied required roles matching authenticated session roles.
  - Enforces distinct human identity check (HTTP 409 if identity has already signed).
  - Rejection without comment rejected with HTTP 422.
  - Upon quorum ratification:
    - Requirement transitions to `APPROVED`.
    - ADR transitions to `ACCEPTED`.
    - Eligible Security Override transitions to `APPROVED` and records `authorizedBy`.
    - Risk schema and treatment remain unmutated (no invalid `status` property added).
  - Atomic audit log generation (`GOVERNANCE_SIGNATURE`) and project `stateVersion` increments only on valid state change; failed decisions cause zero mutations.

### 2.3 Approval Inbox UI (`src/components/ApprovalsView.tsx`)
- Replaces naive length check with authoritative dual-role quorum status.
- Renders dual-role status pills on approval cards: `Security Officer: ✓ RATIFIED` / `Lead Architect: ⏳ PENDING`.
- Renders detailed inspector breakdown: satisfied roles, pending roles, distinct human identities rule, and active session identity banner.
- Excludes `GATE_TRANSITION` and `RELEASE_SIGNOFF` from creation modal dropdown.
- Requires explicit Target Entity ID without silent fallback.

---

## 3. Verification Test Matrix

| Test Suite | File | Command | Scope | Result |
|---|---|---|---|---|
| **DMK-197 Quorum Suite** | `scripts/testDmk197Quorum.ts` | `npm run test:dmk-197` | Scenarios 1–30 (Canonical acceptance criteria) | **30/30 PASS** |
| **DMK-197 Inbox UI Suite** | `scripts/testDmk197ApprovalInboxUi.ts` | `npm run test:dmk-197:ui` | Playwright UI tests UI-1 through UI-8 | **8/8 PASS** |
| **DMK-196 Historical Suite** | `scripts/testRequirementSignoff.ts` | `npm run test:req-signoff` | Scenarios A–O (PR #25 pinned historical range) | **15/15 PASS** |
| **Requirement Sync Suite** | `scripts/testRequirementStatusSync.ts` | `npm run test:req-sync` | Tests A–L (Direct APPROVED prevention) | **12/12 PASS** |
| **Closure Verifier Suite** | `scripts/verifyDmk196Closure.ts` | `npm run verify:dmk-196-closure` | DMK-196 closure receipt verification | **18/18 PASS** |
| **Post-Merge Candidate Suite** | `scripts/verifyDmk196PostMergeCandidate.ts` | `npm run verify:dmk-196-post-merge` | DMK-196 post-merge candidate verification | **38/38 PASS** |
| **Status Audit Verifier Suite** | `scripts/verifyDmk208StatusAudit.ts` | `npm run verify:dmk-208-status-audit` | DMK-208 status audit receipt verification | **56/56 PASS** |
| **Projects Workspace UI** | `scripts/testProjectsWorkspaceUi.ts` | `npm run test:projects-workspace:ui` | Workspace lifecycle and reconciliation UI | **14/14 PASS** |
| **Self WorkItem Reconciliation** | `scripts/testSelfWorkItemReconciliation.ts` | `npm run test:self-work-sync` | Reconciliation engine invariants | **90/90 PASS** |
| **WBS Check** | `scripts/verifyWbsSync.ts` | `npm run wbs:check` | Canonical WBS structure and integrity | **PASS (0 drift)** |
| **Type Check & Lint** | `tsc --noEmit` | `npm run lint` | Full codebase TypeScript compilation | **PASS (0 errors)** |
| **Production Build** | `vite build && esbuild` | `npm run build` | Frontend and backend build | **PASS (0 errors)** |
| **Controlled Docs Suite** | `scripts/testControlledDocsSuite.ts` | `npm run test:controlled-docs` | Controlled documents integrity | **PASS** |
| **Complete Regression** | `scripts/runAllTests.ts` | `npm run test:complete` | Full system regression suite | **49/49 suites PASS, 1107/1107 assertions PASS** |

---

## 4. Controlled Docs Audit & Governance Checkpoint

The living project state document (`docs/00_control/PROJECT_STATE.md`, `DOC-CTRL-002`) was updated through an authenticated Controlled Documents API transaction:
- **AuditEventId:** `AUD-MV0U3OP0-LETG`
- **DocumentId:** `DOC-CTRL-002`
- **Previous SHA-256:** `8310b0f2deb5828939a885a883534d161146a73802d9e0f188ddabb764fcc95e`
- **New SHA-256:** `bf1571aec60eb74c46fbafa52457f8a473142fb3a8d0ed8f6cfefa1953bc6a00`
- **Project stateVersion:** 98 -> 100
- **Audit Count:** 104 -> 106
- **Reverse Audit Chain:** 106 / 106 entries valid (`REVERSE_CHRONOLOGICAL`)
- **Byte Invariant:** `desiredSha256 == governedSha256 == finalSha256` confirmed. Zero direct manual edits were made outside the Controlled Docs transaction.

---

## 5. Next Action & Review Gate

This PR is submitted in **DRAFT** status to allow operator inspection.

**Current Next Actions:**
1. Await human operator review of this implementation on PR HEAD.
2. Verify GitHub Actions PR CI runs clean across all jobs (`Quality & Build`, `Controlled Docs`, `Complete Regression`).
3. Maintain DMK-197 canonical WBS status as `IN_PROGRESS`.
4. Maintain Human Governance as `PENDING_SIGNOFF`.
5. Maintain active reconciliation blockers at strictly 11.
6. Await explicit human instruction before executing any closure transition or merge recommendation.
