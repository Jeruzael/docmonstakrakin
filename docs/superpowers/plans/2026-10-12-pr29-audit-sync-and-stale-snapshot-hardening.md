# PR #29 Final State Synchronization Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a successful Controlled Documents save synchronizes both the project's displayed version and its authoritative audit records, reject stale project snapshots as a whole, harden race conditions, and expand regression test coverage.

**Architecture:** Extend `App.tsx` with an authoritative audit ledger refresh handler upon server-confirmed saves, adding freshness state (`CURRENT` | `REFRESHING` | `REFRESH_FAILED`) surfaced in `EvidenceView.tsx`. Guard `fetchProjectData` and `fetchProjects` to reject stale snapshots (`stateVersion < confirmedVersion`) as a whole rather than promoting them via `Math.max`. Upgrade integration tests in `scripts/testControlledDocVersionSync.ts` with real network race assertions for stale snapshot rejection and comprehensive audit synchronization scenarios.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, Node.js assert.

**Spec:** Directives from User Request (`# DOCMONSTAKRAKIN — PR #29 Final State Synchronization Hardening`, Phases 1–10).

## Global Constraints

- Do not create another pull request; targeted corrections must be pushed to PR #29 (`fix/controlled-doc-project-version-sync`).
- Do not merge PR #29.
- Pull Request #28 must remain completely untouched, draft, open, and unmerged.
- Canonical DMK-197 WBS status must remain strictly `VERIFICATION_PENDING`.
- Zero token exposure: All GitHub operations must use dynamic Git credential helper (`git credential fill`) in memory; never write, log, or print tokens.
- Never synthesize or fabricate audit records locally; the authoritative server audit endpoint (`GET /api/projects/:id/audit`) must supply the actual events.
- Never promote a stale project snapshot: if `incomingProject.stateVersion < confirmedVersionsRef.current[projectId]`, reject the entire snapshot.
- Project isolation: saves and audit events on Project A must never leak into or modify Project B.

## Review Focus

- Audit refresh race when user switches projects immediately after saving.
- Consecutive saves race where earlier save's audit response arrives after later save's response.
- Audit endpoint returning 200 with an audit array that does NOT yet include the acknowledged `auditEventId`.
- Audit endpoint failure (500/timeout) must preserve server-confirmed version and save banner, while displaying a recoverable warning in `EvidenceView`.
- Stale snapshot rejection preserving last accepted data and offering a safe, bounded retry.

---

### Task 1: Audit Freshness State & UI Presentation in `EvidenceView.tsx`

**Files:**
- Modify: `src/components/EvidenceView.tsx`

**Interfaces:**
- Consumes: `EvidenceViewProps.auditSyncStatus`, `EvidenceViewProps.onRetryAuditRefresh`, `EvidenceViewProps.auditSyncError`.
- Produces: Visual indicators for audit synchronization status (`REFRESHING`, `REFRESH_FAILED`, `CURRENT`) and retry action button.

- [ ] **Step 1: Write failing component test in `scripts/testControlledDocsViewComponent.ts` or standalone test**
  - Verify `EvidenceView` displays audit warning banner with retry button on `REFRESH_FAILED`.
  - Verify `EvidenceView` displays loading indicator on `REFRESHING`.

- [ ] **Step 2: Update `EvidenceViewProps` interface in `src/components/EvidenceView.tsx`**
  - Add `auditSyncStatus?: 'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED';`
  - Add `auditSyncError?: string;`
  - Add `onRetryAuditRefresh?: () => void;`

- [ ] **Step 3: Render audit synchronization state in `EvidenceView.tsx`**
  - In `tab === 'AUDIT'`, render:
    - `auditSyncStatus === 'REFRESH_FAILED'`: Alert banner with `data-testid="audit-sync-warning"` displaying error and `data-testid="btn-retry-audit-sync"`.
    - `auditSyncStatus === 'REFRESHING'`: Notice banner with `data-testid="audit-sync-refreshing"`.
    - Distinct status badge in the header or tab showing synchronization state.

- [ ] **Step 4: Verify test passes and `npm run lint` passes**

---

### Task 2: Audit Ledger Synchronization & Race Safety in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `handleControlledDocumentCommitted(projectId, saveResponse: DocumentSaveResponse)`.
- Produces: `auditLogs` state refresh, `auditSyncStatus`, `auditSyncError`, `handleRetryAuditRefresh`.

- [ ] **Step 1: Add audit synchronization refs and state to `src/App.tsx`**
  - `const [auditSyncStatus, setAuditSyncStatus] = useState<'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED'>('CURRENT');`
  - `const [auditSyncError, setAuditSyncError] = useState<string>('');`
  - `const auditRefreshSeqRef = useRef<Record<string, number>>({});`
  - `const pendingAuditEventRef = useRef<Record<string, { eventId: string; docId: string; path: string; version: number; newSha256: string }>>({});`

- [ ] **Step 2: Implement `performAuditRefresh` and `handleRetryAuditRefresh`**
  - Implement `performAuditRefresh(projectId: string, seq: number)`:
    - Calls `GET /api/projects/:id/audit`.
    - Validates response format: Array, correct project context.
    - Validates presence of pending `auditEventId`, action `DOCUMENT_UPDATED`, and target match.
    - Applies race checks: `seq === auditRefreshSeqRef.current[projectId]` and `selectedProjectRef.current === projectId`.
    - On success: updates `auditLogs`, sets `auditSyncStatus = 'CURRENT'`.
    - On failure or missing event: sets `auditSyncStatus = 'REFRESH_FAILED'`, sets `auditSyncError = 'Document save succeeded, but the audit ledger has not finished synchronizing. Refresh audit records to confirm the latest event.'` without erasing existing audit records.

- [ ] **Step 3: Invoke audit refresh in `handleControlledDocumentCommitted`**
  - Update `pendingAuditEventRef.current[projectId]`.
  - Increment sequence `auditRefreshSeqRef.current[projectId]`.
  - If `selectedProjectRef.current === projectId`, set `setAuditSyncStatus('REFRESHING')`.
  - Trigger `performAuditRefresh(projectId, seq)`.

- [ ] **Step 4: Pass audit state to `<EvidenceView>` in `src/App.tsx`**
  - Pass `auditSyncStatus`, `auditSyncError`, `onRetryAuditRefresh={handleRetryAuditRefresh}`.
  - Reset audit sync status to `CURRENT` on project switch in `handleSelectProject`.

---

### Task 3: Stale Project Snapshot Rejection in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `loader.current.load(...)`, `confirmedVersionsRef`.
- Produces: Rejection of any incoming snapshot with `incomingProject.stateVersion < confirmedVersion`.

- [ ] **Step 1: Update `fetchProjectData` in `src/App.tsx`**
  - In `onCommit: data =>`:
    - Compare `data.project.stateVersion ?? 0` against `confirmedVersionsRef.current[data.project.id] ?? 0`.
    - If `incomingVersion < confirmed`:
      - Reject snapshot as a whole.
      - Do NOT update `currentProject`, `questions`, `requirements`, `risks`, `workItems`, `evidence`, `audit`, etc.
      - Set `projectLoading = false`.
      - Trigger bounded retry if `retryCount < 2`.
      - If retries exhausted, set `staleSnapshotWarning` alert.
    - If `incomingVersion >= confirmed`:
      - Apply full fresh snapshot.
      - Clear `staleSnapshotWarning`.

- [ ] **Step 2: Guard `fetchProjects` against stale metadata**
  - In `fetchProjects`:
    - If a project entry in `readProjectList()` has `stateVersion < confirmed`:
      - Preserve previously accepted metadata from existing state rather than overwriting with stale data.

- [ ] **Step 3: Render `staleSnapshotWarning` in `App.tsx`**
  - Display alert with `data-testid="stale-snapshot-warning"` and retry button when stale snapshot persists.

---

### Task 4: Repair Scenario 9 in `scripts/testControlledDocVersionSync.ts`

**Files:**
- Modify: `scripts/testControlledDocVersionSync.ts`

**Interfaces:**
- Consumes: `createHarness`, `getProjectAFetchCount`, deferred response promise.
- Produces: Proof of genuine network request and rejection of stale project payload.

- [ ] **Step 1: Update `createHarness` to track project fetch counts and support response holding**
  - Track `projectAFetchCount`.
  - Expose `getProjectAFetchCount: () => projectAFetchCount`.
  - Expose `holdProjectAResponse(promise)`.

- [ ] **Step 2: Rewrite Scenario 9**
  - Load Project A at v120.
  - Save returning v121.
  - Confirm TopBar shows v121.
  - Record baseline fetch count.
  - Trigger genuine project fetch via application action / TopBar selection.
  - Assert that `getProjectAFetchCount() > baseline` (fails if no request issued).
  - Return stale snapshot with `stateVersion: 120` and modified description `'STALE OUTDATED DESCRIPTION'`.
  - Verify application rejects stale snapshot and does not adopt `'STALE OUTDATED DESCRIPTION'`.
  - Verify TopBar remains `v121`.
  - Deliver authoritative snapshot with `stateVersion: 121` and verify recovery.

---

### Task 5: Expand Integration Tests for Audit Synchronization (Cases A–J)

**Files:**
- Modify: `scripts/testControlledDocVersionSync.ts`

**Interfaces:**
- Produces: Scenarios 13–19 covering Cases A through J.

- [ ] **Step 1: Implement Scenario 13 (Case A — Successful Audit Refresh)**
  - Save returning 121 and `AUD-SYNC-TEST-001`.
  - Audit endpoint returns array containing `AUD-SYNC-TEST-001`.
  - Navigate to Evidence & Audit tab.
  - Assert `AUD-SYNC-TEST-001` rendered in audit table without browser refresh.
  - Assert audit status is `CURRENT`.

- [ ] **Step 2: Implement Scenario 14 (Case B — Delayed Audit Refresh)**
  - Hold audit endpoint response.
  - Verify save-success banner remains visible.
  - Verify audit view shows `[data-testid="audit-sync-refreshing"]`.
  - Release response; verify status becomes `CURRENT` and event is displayed.

- [ ] **Step 3: Implement Scenario 15 (Case C — Failed Audit Refresh)**
  - Audit endpoint returns HTTP 500.
  - Assert TopBar remains v121 and save banner remains visible.
  - Assert existing audit events are preserved.
  - Assert `[data-testid="audit-sync-warning"]` is displayed.
  - Click `[data-testid="btn-retry-audit-sync"]` with healthy endpoint and verify recovery.

- [ ] **Step 4: Implement Scenario 16 (Case D — Audit Response Missing Event)**
  - Audit endpoint returns HTTP 200 but omitting `AUD-SYNC-TEST-001`.
  - Assert audit status shows warning, not marked current.

- [ ] **Step 5: Implement Scenario 17 (Case E — Project Switching Isolation)**
  - Save on Project A; switch to Project B while audit refresh is in flight.
  - Verify Project A audit event is not injected into Project B.
  - Verify Project B version and selection remain untouched.

- [ ] **Step 6: Implement Scenario 18 (Case F — Out-of-Order Audit Responses)**
  - Consecutive saves: Save 1 (121, `AUD-1`), Save 2 (122, `AUD-2`).
  - Resolve Save 2 first, then deliver delayed Save 1 response.
  - Verify newer audit list (with `AUD-2`) is preserved.

- [ ] **Step 7: Implement Scenario 19 (Case I & J — Negative Outcomes & No Duplication)**
  - Verify 401/403/409/timeout do not trigger audit synchronization.
  - Verify audit list contains zero duplicated or synthetic events.

---

### Task 6: Full Verification, Commit, Push & CI Validation

**Files:**
- Staged: Modified implementation and test files.

- [ ] **Step 1: Run focused test suites**
  - `npx tsx scripts/testControlledDocVersionSync.ts`
  - `npx tsx scripts/testControlledDocsViewComponent.ts`
  - `npx tsx scripts/testProjectsWorkspaceUi.ts`

- [ ] **Step 2: Run complete regression matrix and quality checks**
  - `npm run test:controlled-docs`
  - `npm run wbs:check`
  - `npm run lint`
  - `npm run build`
  - `npm run test:complete`
  - `git diff --check`

- [ ] **Step 3: Commit and Push to `fix/controlled-doc-project-version-sync`**
  - `git commit -m "fix(ui): synchronize audit state and reject stale project snapshots"`
  - `git push origin fix/controlled-doc-project-version-sync`

- [ ] **Step 4: Verify GitHub Actions CI on PR #29**
  - Monitor CI run for new HEAD.
  - Confirm `Quality & Build`, `Controlled Docs`, and `Complete Regression` all pass.

- [ ] **Step 5: Deliver Final Report and Halt at Review Gate**
  - Deliver structured report per Phase 10 directives.
  - Halt at PR #29 review gate.
