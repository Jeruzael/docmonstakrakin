# DMK-196 Formal Requirement Sign-Off UX Verification Evidence

## Document Control

- **WorkItem:** DMK-196
- **WBS Path:** 13.06.10
- **Title:** Batch 2 — Formal Requirement Sign-Off UX
- **Canonical Status:** `VERIFICATION_PENDING`
- **Closure Transition:** APPROVED / APPLIED
- **Closure Receipt:** `docs/07_verification/dmk-196-closure-transition-receipt.json`
- **Baseline Master Commit:** `970c6cdbef21c3cc4cd9701c180d849b9ea69e41`
- **Branch:** `dmk-196-formal-requirement-signoff-ux`
- **Verification Timestamp:** 2026-10-05T03:43:00Z
- **Canonical Acceptance Criterion:** "Remove direct Approve Requirement UX; replace with Request Sign-Off"
- **Verification Method:** Sign-off request workflow test
- **PR #25 State:** READY FOR HUMAN REVIEW (`draft = false`, mergeable = clean)
- **Merge Status:** PENDING (awaiting explicit human approval)
- **Post-Merge Verification:** OUTSTANDING

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
6. Historical implementation pass was executed while DMK-196 was `IN_PROGRESS`. Following explicit human approval of closure transition receipt `docs/07_verification/dmk-196-closure-transition-receipt.json`, canonical WBS status was transitioned from `IN_PROGRESS` to `VERIFICATION_PENDING` with zero drift. Pull request merge and post-merge verification remain outstanding.

---

## 2. Acceptance Criteria Evaluation

| Criterion / Behavior | Old Implementation | DMK-196 Implementation | Evidence Taxonomy | Verification Status |
|---|---|---|---|---|
| Direct Approve Button in Drawer | `<button onClick={() => handleStatusChange(..., 'APPROVED')}> Approve Requirement</button>` present | Completely removed from drawer | Source & Playwright UI | **PASS** (Scenario A) |
| UI Direct 'APPROVED' Mutation Calls | Direct call to `handleStatusChange(..., 'APPROVED')` | No call to `handleStatusChange` with `'APPROVED'` exists | Source Invariant | **PASS** (Scenario B) |
| Drawer Request Sign-Off Exposure | None in drawer (only list had RequestSignoff) | `<RequestSignoff />` rendered in drawer for non-APPROVED requirements | Playwright UI Interaction | **PASS** (Scenario C) |
| Target Entity Type Binding | N/A | Binds `targetEntityType: 'REQUIREMENT'` | Playwright UI & Intercept | **PASS** (Scenario D) |
| Target Entity ID Binding | N/A | Binds exact requirement ID (`REQ-101`) | Playwright UI & Intercept | **PASS** (Scenario E) |
| Governed Approval Creation | Bypassed / Rejected | Dispatches `/api/projects/:id/approvals`, creates PENDING request with required roles & audit log | Real Backend Integration (`registerSignoffRoutes`) | **PASS** (Scenario F) |
| User Feedback & Inbox Surfacing | N/A | UI renders status text confirming request is in Approval Inbox | Playwright UI Interaction | **PASS** (Scenario G) |
| Duplicate Request Handling | N/A | Re-requesting unchanged target deduplicates to existing PENDING approval | Real Backend Integration (`registerSignoffRoutes`) | **PASS** (Scenario H) |
| Server Defense-in-Depth | HTTP 403 on direct status POST | Retained intact (`server.ts:607`); returns HTTP 403 | Authoritative Integration (`testRequirementStatusSync.ts`) & Mock Server | **PASS** (Scenario I) |
| State Immutability on Direct POST | Status not modified | Canonical and runtime state remain unchanged upon direct approval rejection | Authoritative Integration (`testRequirementStatusSync.ts`) | **PASS** (Scenario J) |
| Unauthorized Request Surfacing | N/A | UI displays error in `role="status"` element | Playwright UI Interaction | **PASS** (Scenario K) |
| Non-Approval Transitions | Mark Under Review, Defer, Reject | All non-approval actions remain fully functional in drawer | Playwright UI Interaction | **PASS** (Scenario L) |
| List Request Sign-Off Regression | `<RequestSignoff />` in list row | List button remains functional and intact | Playwright UI Interaction | **PASS** (Scenario M) |
| ADR Approval Semantics Boundary | `ArchitectureView.tsx` | Untouched; ADR approval workflows unmodified | Scope Isolation (Git Diff) | **PASS** (Scenario N [Scope Isolation]) |
| Reviewer Provisioning Boundary | `server/proposals/` | Untouched; reviewer identities and quorum policies unmodified | Scope Isolation (Git Diff & Policy Route) | **PASS** (Scenario O [Scope Isolation]) |

### 2.1 Evidence Map & Verification Taxonomy

To ensure claims do not exceed executable test evidence, the 15 verification scenarios are divided into strict categories:

#### A. Behavioral Verification (13 Scenarios)
1. **Source Code Invariants (Scenarios A & B):**
   - AST / regex validation of `src/components/RequirementsView.tsx` confirming removal of direct `Approve Requirement` text and absence of any `handleStatusChange(..., 'APPROVED')` invocation.
2. **Real Backend Integration (Scenarios F & H):**
   - Executed against real Express `registerSignoffRoutes` handler.
   - Scenario F configures a real scrypt-verified reviewer in `DMK_HUMAN_REVIEWERS`, authenticates via `POST /api/governance/session`, captures `dmk_reviewer` cookie, and dispatches authenticated `POST /api/projects/:id/approvals`. Asserts HTTP 201, `APV-` ID prefix, targetDigest matches the production SHA-256 digest of the exact requirement object/snapshot, store mutation (`approvals.length === 1`), and `APPROVAL_REQUESTED` audit event with actor, timestamp, and entity details.
   - Scenario H tests duplicate-pending deduplication by re-submitting an identical approval request, asserting HTTP 201 returns existing approval ID without duplicate creation, state version increment, or duplicate audit events.
3. **Defense-in-Depth & Immutability (Scenarios I & J):**
   - Verified against `server.ts:607` fail-closed 403 defense. Authoritatively proven in `scripts/testRequirementStatusSync.ts` (12/12 passing against live server) and mirrored in `scripts/testRequirementSignoff.ts`.
4. **End-to-End Browser UI Flow (Scenarios C, D, E, G, K, L, M):**
   - Executed via Playwright Chromium against live Vite preview.
   - Tests drawer opening, `<RequestSignoff />` presence, request payload binding (`REQUIREMENT` / `REQ-101`), success status banner ("in Approval Inbox"), simulated auth failure rendering, and drawer non-approval button operations (`Mark Under Review`). Also confirms list-level Request Sign-Off remains intact.

#### B. Scope-Isolation Verification (2 Scenarios)
1. **ADR Approval Scope Isolation (Scenario N):**
   - Git diff inspection against base master (`970c6cdbef21c3cc4cd9701c180d849b9ea69e41...HEAD`) asserting `src/components/ArchitectureView.tsx` is completely untouched by this PR.
2. **Quorum & Identity Provisioning Scope Isolation (Scenario O):**
   - Git diff inspection asserting `server/proposals/signoff.ts`, `server/proposals/identity.ts`, and `src/components/ApprovalsView.tsx` are completely untouched by this PR.
   - Route verification querying `GET /api/projects/:id/governance-policy` to assert production quorum roles (`['Security Officer', 'Lead Architect']`) are intact.


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
7. `scripts/verifyDmk196Closure.ts`:
   - Dedicated closure transition verifier exporting `validateDmk196ClosureReceipt` pure validator and asserting canonical WBS state. Hardened to validate immutable receipt authority provenance (`decisionAuthority`, `decisionSource`, `appliedAt`).
8. `scripts/testDmk196Closure.ts`:
   - Regression suite covering 18 negative & boundary scenarios (A through R) for DMK-196 closure, including receipt authority and timestamp tampering.
9. `scripts/verifyDmk208StatusAudit.ts`:
   - Historical verifier hardened to strictly require exact `candidateStatus` for transitioned items, special-casing DMK-196 forward transition to `VERIFICATION_PENDING` only through verified closure receipt provenance.
10. `scripts/testStatusAuditReceipt.ts`:
    - Strengthened with 49 scenarios (A through AW) verifying historical modes and rejecting unauthorized forward drift for DMK-197 and DMK-198.

---

## 4. Test Execution Matrix

| Test Command | Exit Code | Checks Passed | Description |
|---|---|---|---|
| `npm run test:req-signoff` | 0 | 15 / 15 | Dedicated DMK-196 sign-off workflow regression suite |
| `npm run test:req-sync` | 0 | 12 / 12 | Requirement canonical state sync & backend 403 test |
| `npm run test:projects-workspace:ui` | 0 | 14 / 14 | Projects Workspace Playwright UI suite |
| `npm run verify:dmk-196-closure` | 0 | 1 / 1 (PASS) | Dedicated DMK-196 closure transition verifier |
| `npx tsx scripts/testDmk196Closure.ts` | 0 | 18 / 18 | DMK-196 closure negative and boundary test suite (Scenarios A–R) |
| `npm run verify:dmk-208-status-audit` | 0 | 1 / 1 (PASS) | Historical DMK-208 status audit candidate verifier |
| `npx tsx scripts/testStatusAuditReceipt.ts` | 0 | 49 / 49 | Historical status audit & closure receipt test suite (Scenarios A–AW) |
| `npm run wbs:check` | 0 | Zero drift | Canonical WBS integrity and markdown projection check |
| `npm run lint` | 0 | Clean | TypeScript typechecking across repository (`tsc --noEmit`) |
| `npm run build` | 0 | Clean | Production Vite & esbuild bundle compilation |
| `npm run test:controlled-docs` | 0 | 40/40 Core, 29/29 Security, 11/11 Subsystems | Controlled documents integrity suite |
| `npm run test:complete` | 0 | 46 / 46 suites (1024 assertions) | Complete automated regression test suite |

---

## 5. Scope & Governance Boundaries

- **DMK-196 Canonical Status:** `VERIFICATION_PENDING` (Authorized and applied via `dmk-196-closure-transition-receipt.json`).
- **PR #25 Merge:** PENDING explicit human approval at the merge gate; NOT merged.
- **Post-Merge Verification:** OUTSTANDING until PR #25 is merged to master.
- **DMK-197 Boundary:** `IN_PROGRESS` (Implementation untouched in this PR; unauthorized forward drift strictly rejected).
- **DMK-198 Boundary:** `IN_PROGRESS` (Implementation untouched in this PR; unauthorized forward drift strictly rejected).
- **DMK-206 / DMK-207 Boundary:** Not started; remain in `BACKLOG`.
- **Reconciliation Boundary:** Zero live reconciliation executed (`DMK_WBS_SYNC_EXECUTE` disabled); runtime WorkItems remain untouched; total reconciliation blockers remain 10 (9 historical + 1 DMK-208).
- **Release / Gate 7 Boundary:** Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`; release remains `v0.1.0-rc1 / NOT PROMOTED`.
