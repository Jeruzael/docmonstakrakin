# DMK-196 Formal Requirement Sign-Off UX Verification Evidence

## Document Control

- **WorkItem:** DMK-196
- **WBS Path:** 13.06.10
- **Title:** Batch 2 — Formal Requirement Sign-Off UX
- **Canonical Status:** `IN_PROGRESS` (Not marked VERIFIED; Human Governance sign-off pending)
- **Baseline Master Commit:** `970c6cdbef21c3cc4cd9701c180d849b9ea69e41`
- **Branch:** `dmk-196-formal-requirement-signoff-ux`
- **Verification Timestamp:** 2026-10-05T03:43:00Z
- **Canonical Acceptance Criterion:** "Remove direct Approve Requirement UX; replace with Request Sign-Off"
- **Verification Method:** Sign-off request workflow test

---

## 1. Executive Summary

This report records formal, deterministic automated verification evidence for work item **DMK-196 (Formal Requirement Sign-Off UX)**.
Prior to this implementation, the requirements drawer in `src/components/RequirementsView.tsx` exposed an obsolete direct `Approve Requirement` button that called `handleStatusChange(activeDrawerReq.id, 'APPROVED')`. While the backend (`server.ts:607`) already enforced HTTP 403 defense-in-depth, direct approval UI remained inconsistent with governed multi-role human approval.

In this work item:
1. Direct `Approve Requirement` button and direct UI transition calls to `'APPROVED'` were completely removed from `src/components/RequirementsView.tsx`.
2. Governed `<RequestSignoff />` component was wired in the requirement drawer for all non-`APPROVED` requirements, binding `targetEntityType="REQUIREMENT"`, `targetEntityId={activeDrawerReq.id}`, and `requestedBy={project.owner}`.
3. Backend HTTP 403 fail-closed rejection on direct `status: 'APPROVED'` mutations remains strictly preserved in `server.ts:607`.
4. Dedicated regression test suite `scripts/testRequirementSignoff.ts` covering Scenarios A through O was created, added to `package.json` as `test:req-signoff`, and verified.
5. Existing UI test `scripts/testProjectsWorkspaceUi.ts` (test A2) was updated to assert the absence of the direct button and presence of governed `<RequestSignoff />`.
6. Canonical WBS status remains `IN_PROGRESS` with zero drift.

---

## 2. Acceptance Criteria Evaluation

| Criterion / Behavior | Old Implementation | DMK-196 Implementation | Verification Status |
|---|---|---|---|
| Direct Approve Button in Drawer | `<button onClick={() => handleStatusChange(..., 'APPROVED')}> Approve Requirement</button>` present | Completely removed from drawer | **PASS** (Scenario A) |
| UI Direct 'APPROVED' Mutation Calls | Direct call to `handleStatusChange(..., 'APPROVED')` | No call to `handleStatusChange` with `'APPROVED'` exists | **PASS** (Scenario B) |
| Drawer Request Sign-Off Exposure | None in drawer (only list had RequestSignoff) | `<RequestSignoff />` rendered in drawer for non-APPROVED requirements | **PASS** (Scenario C) |
| Target Entity Type Binding | N/A | Binds `targetEntityType: 'REQUIREMENT'` | **PASS** (Scenario D) |
| Target Entity ID Binding | N/A | Binds exact requirement ID (`REQ-101`) | **PASS** (Scenario E) |
| Governed Approval Creation | Bypassed / Rejected | Dispatches `/api/projects/:id/approvals`, creates PENDING request with required roles & audit log | **PASS** (Scenario F) |
| User Feedback & Inbox Surfacing | N/A | UI renders status text confirming request is in Approval Inbox | **PASS** (Scenario G) |
| Duplicate Request Handling | N/A | Re-requesting unchanged target deduplicates to existing PENDING approval | **PASS** (Scenario H) |
| Server Defense-in-Depth | HTTP 403 on direct status POST | Retained intact (`server.ts:607`); returns HTTP 403 | **PASS** (Scenario I) |
| State Immutability on Direct POST | Status not modified | Canonical and runtime state remain unchanged upon direct approval rejection | **PASS** (Scenario J) |
| Unauthorized Request Surfacing | N/A | UI displays error in `role="status"` element | **PASS** (Scenario K) |
| Non-Approval Transitions | Mark Under Review, Defer, Reject | All non-approval actions remain fully functional in drawer | **PASS** (Scenario L) |
| List Request Sign-Off Regression | `<RequestSignoff />` in list row | List button remains functional and intact | **PASS** (Scenario M) |
| ADR Approval Semantics Boundary | `ArchitectureView.tsx` | Untouched; ADR approval workflows unmodified | **PASS** (Scenario N) |
| Reviewer Provisioning Boundary | `server/proposals/` | Untouched; reviewer identities and quorum policies unmodified | **PASS** (Scenario O) |

---

## 3. Files Modified

1. `src/components/RequirementsView.tsx`:
   - Removed direct `Approve Requirement` button from drawer governance section.
   - Removed unused `Check` lucide icon import.
   - Inserted `<RequestSignoff />` component in drawer for `project && activeDrawerReq.status !== 'APPROVED'`.
   - Added `id="requirement-drawer"` to drawer element for clear accessibility and test scoping.
2. `package.json`:
   - Added `"test:req-signoff": "tsx scripts/testRequirementSignoff.ts"`.
3. `scripts/testRequirementSignoff.ts`:
   - Added comprehensive 15-scenario regression test suite covering Scenarios A through O.
4. `scripts/testProjectsWorkspaceUi.ts`:
   - Updated test A2 to assert absence of `Approve Requirement` button, presence of `REQUEST SIGN-OFF`, and verify rejection handling via `Mark Under Review`.
5. `docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md`:
   - This verification evidence document.
6. `docs/00_control/PROJECT_STATE.md`:
   - Governed update via Controlled Docs API (`DOC-CTRL-002`).

---

## 4. Test Execution Matrix

| Test Command | Exit Code | Checks Passed | Description |
|---|---|---|---|
| `npm.cmd run test:req-signoff` | 0 | 15 / 15 | Dedicated DMK-196 sign-off workflow regression suite |
| `npm.cmd run test:req-sync` | 0 | 12 / 12 | Requirement canonical state sync & backend 403 test |
| `npm.cmd run test:projects-workspace:ui` | 0 | 14 / 14 | Projects Workspace Playwright UI suite |
| `npm.cmd run wbs:check` | 0 | Zero drift | Canonical WBS integrity and markdown projection check |
| `npm.cmd run lint` | 0 | Clean | TypeScript typechecking across repository (`tsc --noEmit`) |
| `npm.cmd run build` | 0 | Clean | Production Vite & esbuild bundle compilation |
| `npm.cmd run test:controlled-docs` | 0 | 40/40 Core, 29/29 Security, 11/11 Subsystems | Controlled documents integrity suite |
| `npm.cmd run test:complete` | 0 | 45 / 45 suites (100%) | Complete automated regression test suite |

---

## 5. Scope & Governance Boundaries

- **DMK-196 Canonical Status:** Remains `IN_PROGRESS` throughout this pass. A transition to `VERIFICATION_PENDING` is recommended for explicit human approval upon PR review.
- **DMK-197 Boundary:** DMK-197 (Approval Inbox) implementation was NOT started or modified.
- **DMK-198 Boundary:** DMK-198 (Reviewer Identity & Provisioning) was NOT started or modified.
- **DMK-206 / DMK-207 Boundary:** Not started; remain in `BACKLOG`.
- **Reconciliation Boundary:** Zero live reconciliation executed (`DMK_WBS_SYNC_EXECUTE` disabled); runtime WorkItems remain untouched; total reconciliation blockers remain 10 (9 historical + 1 DMK-208).
- **Release / Gate 7 Boundary:** Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`; release remains `v0.1.0-rc1 / NOT PROMOTED`.
