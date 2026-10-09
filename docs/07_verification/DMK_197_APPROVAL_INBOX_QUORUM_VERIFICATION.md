# DOCMONSTAKRAKIN — DMK-197 Technical Verification Evidence

**WorkItem:** DMK-197  
**WBS Path:** `13.06.11`  
**Parent:** `EPIC-13`  
**Title:** Approval Inbox & Canonical Quorum Synchronization  
**Canonical Acceptance Criterion:** Distinct Security Officer and Lead Architect human identities required for quorum  
**Base Master SHA:** `7e45da9b0d4d8553745e5b7c25597eb48c94d6af` (merge commit of PR #26)  
**Base Master CI Run:** `37909221729` (Attempt 1: Quality & Build PASS, Controlled Docs PASS, Complete Regression PASS)  
**Baseline PR HEAD:** `2f7cc14708ed9a0d72b85d616bc61d654324b8a3`  
**Branch:** `dmk-197-approval-inbox-quorum`  
**Canonical WBS Status:** `IN_PROGRESS` (Strictly retained; zero forward lifecycle drift in WBS)  
**Human Governance Status:** `PENDING_SIGNOFF`  
**Active Reconciliation Blockers:** 11 (Historical 9: DMK-156, DMK-157, DMK-158, DMK-159, DMK-165, DMK-187, DMK-188, DMK-189, DMK-190 + DMK-208 + DMK-196)  
**Live Reconciliation:** BLOCKED / NOT AUTHORIZED / NOT EXECUTED  

---

## 1. Executive Summary

This verification record establishes the technical implementation, integrity hardening, and verification evidence for work item **DMK-197** (*Approval Inbox & Canonical Quorum Synchronization*).

DMK-197 enforces that formal sign-off on canonical proposed artifacts (Requirements, ADRs, Risks, and eligible Security Overrides) requires a dual-role quorum comprised of distinct human identities for **Security Officer** and **Lead Architect**.

In accordance with explicit governance instructions:
1. DMK-197 WBS status remains strictly `IN_PROGRESS` throughout this pass; no transition to `VERIFICATION_PENDING` or `VERIFIED` has been applied to `docs/00_control/MASTER_WBS.yaml` or `MASTER_WBS.md`.
2. Human Governance remains strictly `PENDING_SIGNOFF`; `human_approved_by` remains absent.
3. Active reconciliation blockers remain strictly at 11 (Historical 9 + DMK-208 + DMK-196).
4. Live reconciliation remains BLOCKED, NOT AUTHORIZED, and NOT EXECUTED.
5. Work stops at the **DMK-197 Implementation Review Gate** pending human operator review.

---

## 2. Architecture & Policy Enforcement

### 2.1 Authoritative Server Quorum Evaluator (`server/proposals/quorum.ts`)
The server defines `evaluateQuorum(item: ApprovalItem, currentTargetDigest?: string): QuorumEvaluation`, enforcing:
- **Canonical Policy Version:** Strictly requires `policyVersion === 'LOCAL_SESSION_V1'`. Any missing, empty, or legacy version fails closed with `status = 'INVALID'`, `hasQuorum = false`.
- **Exact Required Roles:** Strictly requires `requiredRoles` to be an array of length 2 matching `['Security Officer', 'Lead Architect']`. Shortened, duplicated, missing, unknown, or extra roles fail closed with `status = 'INVALID'`.
- **Strict Target Digest:** Non-empty 64-character hex lowercase SHA-256 string `targetDigest` required (`/^[a-f0-9]{64}$/`). If missing, malformed, or non-hex, evaluates to `status = 'INVALID'`.
- **Strict Signature Provenance:** Signatures count toward quorum if and only if:
  - `decision === 'APPROVED'`
  - Non-empty string `identityId`
  - Exact `roleSource === 'LOCAL_SERVER_ROSTER'`
  - Role matches an unsatisfied required role
- **Distinct Human Identities:** A single human identity possessing both roles (`REV-DUAL-01`) cannot satisfy both slots. The second decision attempt is rejected with HTTP 409.
- **Stale Digests & Post-Ratification Digest:**
  - For pending requests, if the canonical target artifact is mutated after sign-off initiation, `currentTargetDigest !== item.targetDigest` evaluates to `STALE`, preventing quorum ratification.
  - If the target artifact no longer exists (`currentTargetDigest === null`), evaluates to `status = 'STALE'`, `hasQuorum = false`, `reason = 'Canonical approval target no longer exists'`.
  - For ratified requests (`item.status === 'APPROVED'`), `evaluateQuorum` verifies against `item.postRatificationDigest || item.targetDigest`, ensuring legitimate approved artifacts are not falsely marked `STALE` when their status mutation updates their hash.
- **Rejection Termination:** A single authorized human rejection transitions the request status to `REJECTED`, requiring a meaningful justification note.

### 2.2 Hardened Sign-Off Routes (`server/proposals/signoff.ts`)
- **Request Creation (`POST /api/projects/:id/approvals`):**
  - Authenticated session check via `requireHuman`.
  - Rejection of agent identities (`actorType === 'AGENT'`) with HTTP 403.
  - Rejection of release promotion and Gate 7 ceremonies with HTTP 422 or HTTP 403 (explaining dedicated ceremonies; protected-control detection normalizes against alternative spellings).
  - Validation of Security Overrides via shared `validateOverrideEligibility`: expired overrides (HTTP 422), unacknowledged risks (HTTP 422), and attempts to override Gate 7 or release (HTTP 403) are strictly denied.
  - Deduplication: checks `projectId`, `targetEntityType`, `targetEntityId`, `targetDigest`, `policyVersion`, and `status === 'PENDING'`. Returns HTTP 201 with the existing approval record without duplicate audit events or stateVersion increments.
  - Persistence: transactional writes to `.local/project-state.json` via `installProjectPersistence`.
- **Authoritative Quorum Projection (`GET /api/projects/:id/approvals`):**
  - Projects server-derived read-only `quorum` object (`status`, `hasQuorum`, `satisfiedRoles`, `pendingRoles`, `reason`) using `evaluateQuorum`.
  - Distinguishes missing canonical targets (`STALE`, fail-closed) and unsupported target types (`INVALID`, fail-closed).
  - Zero mutation of approvals, targets, stateVersion, or audit logs during projection.
- **Decision Submission (`POST /api/projects/:id/approvals/:apvId/decide`):**
  - Caller-supplied identity claims (`approver`, `role`, `reviewerName`, `reviewerRole`, `authorizedRole`, `actorType === 'AGENT'`) in the request body are rejected with HTTP 403 before any item lookup.
  - Requires `humanConfirmed === true` (HTTP 403 if omitted/false).
  - Request Pre-validation before mutation: rejects malformed stored requests (`policyVersion !== 'LOCAL_SESSION_V1'`, invalid `requiredRoles`, missing or malformed `targetDigest`, missing target entity, mismatched target digest, or ineligible/tampered override) with HTTP 409 or HTTP 403 fail-closed without mutating state, incrementing stateVersion, or adding audit events.
  - Security Override Re-validation: verifies override has not expired between signatures or been disavowed or mutated to target a protected gate.
  - Distinct Human Identity Check: HTTP 409 if identity has already signed.
  - Rejection without comment rejected with HTTP 422.
  - Upon quorum ratification:
    - Requirement transitions to `APPROVED`.
    - ADR transitions to `ACCEPTED`.
    - Eligible Security Override transitions to `APPROVED` and records `authorizedBy`.
    - Risk schema and treatment remain unmutated (no invalid `status` property added).
    - Post-ratification digest is recorded in `item.postRatificationDigest = digest(target)`.
  - Atomic audit log generation (`APPROVAL_REQUESTED` on creation, `GOVERNANCE_SIGNATURE` on decisions) and project `stateVersion` increments only on valid state change; failed decisions cause zero mutations.

### 2.3 Approval Inbox UI (`src/components/ApprovalsView.tsx`)
- Consumes authoritative server-derived `item.quorum` projection.
- Renders dual-role status pills on approval cards: `Security Officer: ✓ RATIFIED` / `Lead Architect: ⏳ PENDING`.
- Visual cues for invalid or stale requests:
  - `INVALID POLICY` red badge and warning pill; decision action buttons suppressed.
  - `STALE TARGET` amber badge and warning pill; decision action buttons suppressed.
- Centralized Guarded Approval Fetch & Project-Switch Isolation:
  - Implements single guarded fetch `fetchApprovalsForProject(targetProjectId, preserveSelection)` with `activeProjectIdRef`, `requestGenerationRef`, and `AbortController`.
  - Validates active project ID and request generation after `response.json()` resolves; discards late responses from switched projects.
  - On `project.id` change, clears `selectedItem`, resets `error`, closes decision & request modals, resets confirmation, and clears approval list.
  - In-flight decision and request submissions reject execution if active project switches in transit.
- Excludes `GATE_TRANSITION` and `RELEASE_SIGNOFF` from creation modal dropdown.
- Requires explicit Target Entity ID without silent fallback.

---

## 3. Targeted Integrity Remediation Pass

Following implementation review, a targeted remediation pass was executed to resolve security and verification gaps:
- **Correction A:** Canonical Quorum Policy & Roles Hardening in `server/proposals/quorum.ts` (enforces `LOCAL_SESSION_V1`, exact roles `['Security Officer', 'Lead Architect']`).
- **Correction B:** Strict Signature Provenance in `server/proposals/quorum.ts` (enforces `identityId`, `roleSource === 'LOCAL_SERVER_ROSTER'`, `decision === 'APPROVED'`).
- **Correction C:** Rejection of Malformed Requests Before Mutation in `server/proposals/signoff.ts` (HTTP 409 fail-closed).
- **Correction D:** Server-Authoritative Derived Quorum Projection in UI & API (`GET /api/projects/:id/approvals`, `ApprovalsView.tsx`).
- **Correction E:** Decision-Time Security Override Eligibility Revalidation in `server/proposals/signoff.ts`.
- **Correction F:** Approval Inbox Project-Switch Isolation in `src/components/ApprovalsView.tsx`.
- **Correction G:** Real Persistence Integration Verification in `scripts/testDmk197Persistence.ts` (`.local/project-state.json`, restart recovery and failed write rollback).

---

## 4. Final Security & Integrity Corrections Pass

A final security hardening pass resolved three critical boundary findings identified during independent review:

### 4.1 Protected Gate 7 Naming Bypass Hardening
- **Implementation:** In `server/proposals/signoff.ts`, centralized `isProtectedGateOrRelease(controlCandidate)` normalizes control strings against:
  - Gate 7 regex: `/(?:^|[^a-zA-Z0-9])gate[\s\-_#/:.]*0*7(?!\d)/i`
  - Release regex: `/(?:^|[^a-zA-Z0-9])release(?:$|[^a-zA-Z0-9])/i`
- **Enforcement:** Applied both at request creation and revalidated at decision time before signature recording.
- **Verification:** Exercised in `testDmk197Quorum.ts` Scenario 44:
  - Fails closed on all spelling variants: `Gate 7`, `gate 7`, `GATE-7`, `Gate7`, `GATE_7`, `GATE-07`, `gate #7` (HTTP 403, 0 approvals, no audit or stateVersion mutation).
  - Permits unrelated controls like `Gate 70` (HTTP 201).
  - Decision-time override mutation targeting Gate 7 is rejected fail-closed (HTTP 403).

### 4.2 Strict SHA-256 Target Digest Validation & Missing-Target Projection
- **Target Digest Validation:** In `server/proposals/quorum.ts`, requires `targetDigest` and `postRatificationDigest` (if present) to match `/^[a-f0-9]{64}$/`. Missing, empty, short, long, non-hex, whitespace, and placeholder strings evaluate to `status = 'INVALID'`, `hasQuorum = false` (Scenario 35).
- **Missing Target Fail-Closed:** When canonical approval target entity no longer exists, `GET /api/projects/:id/approvals` projects `status = 'STALE'`, `hasQuorum = false`, `reason = 'Canonical approval target no longer exists'` (Scenario 45).
- **Unsupported Target Type:** Unsupported target entity types project `status = 'INVALID'`, `hasQuorum = false` (Scenario 45).
- **Zero-Mutation Projection Invariant:** Authoritative GET projection never mutates stateVersion, audit entries, or approvals.
- **Post-Ratification Compatibility:** Ratified targets verify against `postRatificationDigest || targetDigest`, preserving valid post-approval states while rejecting downstream tampering (Scenario 43).

### 4.3 Centralized Guarded Fetch & Deterministic UI Network Race Tests
- **Centralized Fetch Guard:** In `src/components/ApprovalsView.tsx`, unified all fetches (`fetchApprovalsForProject`) under `activeProjectIdRef`, `requestGenerationRef`, and `AbortController`.
- **Validation After Parse:** Project ID and generation matching are strictly checked *after* `response.json()` resolves, guaranteeing delayed payloads from switched projects are discarded.
- **Deterministic Race Tests:** In `scripts/testDmk197ApprovalInboxUi.ts`:
  - `UI-13` (Scenario A): Delayed initial fetch response from switched project is discarded.
  - `UI-14` (Scenario B): Delayed manual refresh response from switched project is discarded.
  - `UI-15` (Scenario C): Stale decision response does not affect switched project.

---

## 5. Verification Test Matrix

| Test Suite | File | Command | Scope | Result |
|---|---|---|---|---|
| **DMK-197 Quorum Suite** | `scripts/testDmk197Quorum.ts` | `npm run test:dmk-197` | Scenarios 1–46 (Quorum invariants & security hardening) | **46/46 PASS** |
| **DMK-197 Inbox UI Suite** | `scripts/testDmk197ApprovalInboxUi.ts` | `npm run test:dmk-197:ui` | Playwright UI tests UI-1 through UI-15 | **15/15 PASS** |
| **DMK-197 Persistence Suite** | `scripts/testDmk197Persistence.ts` | `npm run test:dmk-197:persistence` | Real `.local/project-state.json` restart recovery & write rollback | **2/2 PASS** |
| **DMK-196 Historical Suite** | `scripts/testRequirementSignoff.ts` | `npm run test:req-signoff` | Scenarios A–O (PR #25 pinned historical range) | **15/15 PASS** |
| **Requirement Sync Suite** | `scripts/testRequirementStatusSync.ts` | `npm run test:req-sync` | Tests A–L (Direct APPROVED prevention) | **12/12 PASS** |
| **Closure Verifier Suite** | `scripts/verifyDmk196Closure.ts` | `npm run verify:dmk-196-closure` | DMK-196 closure receipt verification | **18/18 PASS** |
| **Post-Merge Candidate Suite** | `scripts/verifyDmk196PostMergeCandidate.ts` | `npm run verify:dmk-196-post-merge` | DMK-196 post-merge candidate verification | **38/38 PASS** |
| **Status Audit Verifier Suite** | `scripts/verifyDmk208StatusAudit.ts` | `npm run verify:dmk-208-status-audit` | DMK-208 status audit receipt verification | **56/56 PASS** |
| **Projects Workspace UI** | `scripts/testProjectsWorkspaceUi.ts` | `npm run test:projects-workspace:ui` | Workspace lifecycle and reconciliation UI | **14/14 PASS** |
| **Self WorkItem Reconciliation** | `scripts/testSelfWorkItemReconciliation.ts` | `npm run test:self-work-sync` | Reconciliation engine invariants | **90/90 PASS** |
| **WBS Check** | `scripts/renderWbs.ts --check` | `npm run wbs:check` | Canonical WBS structure and integrity | **PASS (0 drift)** |
| **Type Check & Lint** | `tsc --noEmit` | `npm run lint` | Full codebase TypeScript compilation | **PASS (0 errors)** |
| **Production Build** | `vite build && esbuild` | `npm run build` | Frontend and backend build | **PASS (0 errors)** |
| **Controlled Docs Suite** | `scripts/testControlledDocs.ts` | `npm run test:controlled-docs` | Controlled documents integrity | **PASS** |
| **Complete Regression** | `scripts/runCompleteRegression.ts` | `npm run test:complete` | Full system regression suite | **50/50 suites PASS, 1132/1132 assertions PASS** |

---

## 6. Controlled Docs Audit & Governance Checkpoint

The living project state document (`docs/00_control/PROJECT_STATE.md`, `DOC-CTRL-002`) was updated through an authenticated Controlled Documents API transaction:
- **AuditEventId:** `AUD-MV10RW3R-UURY`
- **DocumentId:** `DOC-CTRL-002`
- **Previous SHA-256:** `2a373352e5b94ff18704fb0851e295cd35ae7f15c6e3507a9914167b866bf185`
- **New SHA-256:** `c13bf85943dc9c1c91fb062c4731ee817828be1e03107754bcdf509c280ac671`
- **Project stateVersion:** 101 -> 102
- **Audit Count:** 107 -> 108
- **Reverse Audit Chain:** 108 / 108 entries valid (`REVERSE_CHRONOLOGICAL`)
- **Byte Invariant:** `desiredSha256 == governedSha256 == finalSha256` confirmed. Zero direct manual edits were made outside the Controlled Docs transaction.

---

## 7. Next Action & Review Gate

This PR remains in **DRAFT** status on branch `dmk-197-approval-inbox-quorum` awaiting human operator inspection.

**Current Next Actions:**
1. Human-review the corrected PR #27 exact HEAD.
2. Verify fresh full CI.
3. Review the updated security and implementation evidence.
4. Decide whether DMK-197 may transition from `IN_PROGRESS` to `VERIFICATION_PENDING`.
5. Do not apply a lifecycle transition without separate explicit authorization.
6. Keep PR #27 unmerged.
7. Keep reconciliation blocked at 11.

