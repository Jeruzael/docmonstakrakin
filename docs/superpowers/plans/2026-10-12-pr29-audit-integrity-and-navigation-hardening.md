# PR #29 Final Audit Integrity and Navigation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct exact audit-event identity validation, reject stale project-list metadata prior to normalization, preserve audit freshness across project navigation, and remove the test-only global `window.__dmkTriggerProjectReload` using the existing TopBar project selector.

**Architecture:** Implement pure helpers for audit event acknowledgment validation (`validateAuditAcknowledgment`, `reconcileAuditLedger`) and project-list reconciliation (`reconcileProjectList`). In `App.tsx`, scope audit status and outstanding acknowledgments per-project, preserve unconfirmed audit state across project switches and same-project re-selections, and guard snapshot replacement. Replace test hook in `TopBar.tsx` and integration tests with authentic user dropdown interactions.

**Tech Stack:** React 19, TypeScript, Vite, Playwright-based test harness, Node.js 22.

**Spec:** Execution Directive for PR #29 Final Audit Integrity and Navigation Hardening (`docs/superpowers/plans/2026-10-12-pr29-audit-integrity-and-navigation-hardening.md`).

## Global Constraints
- Target branch: `fix/controlled-doc-project-version-sync` on isolated worktree `C:\Users\HomePC\dev\docmonstakrakin-version-sync`.
- Base commit: `7196ec4840e8b89d672b61b383beebe148141b7c` (`origin/master`).
- Do NOT merge PR #29.
- Do NOT modify PR #28 (`dmk-197-post-merge-governance-reconciliation`).
- Do NOT alter canonical WBS status (`DMK-197` remains strictly `VERIFICATION_PENDING`).
- Zero tokens or credentials printed, logged, or committed.
- Production code must not contain test-only global hooks (`window.__dmkTriggerProjectReload` removed).
- Do not synthesize audit events locally.

## Review Focus
1. Exact audit validation rejecting mismatched fields: target, path, digests, action, timestamp, or duplicate event IDs.
2. Stale project-list metadata not normalized or accepted when `incomingVersion < confirmedVersion`.
3. Same-project re-selection not resetting pending or failed audit state to `CURRENT`.
4. A -> B -> A navigation preserving Project A's outstanding audit acknowledgment and restoring unconfirmed state without cross-project leakage.
5. Project snapshot `data.audit` not overwriting `auditLogs` if it omits required outstanding save events.

---

### Task 1: Strict Audit Event Validation Helper & Unit Tests

**Files:**
- Create/Modify: `src/utils/auditValidation.ts`
- Test: `scripts/testControlledDocVersionSync.ts` (or focused unit tests)

**Interfaces:**
- Produces:
  ```typescript
  export interface ExpectedAuditAcknowledgment {
    auditEventId: string;
    documentId: string;
    path: string;
    previousSha256: string;
    newSha256: string;
    timestamp: string;
    stateVersion: number;
  }

  export function validateAuditAcknowledgment(
    event: unknown,
    expected: ExpectedAuditAcknowledgment
  ): boolean;

  export function reconcileAuditEvents(
    events: unknown[],
    outstandingAcks: ExpectedAuditAcknowledgment[]
  ): {
    valid: boolean;
    reason?: string;
    satisfiedAckIds: string[];
  };
  ```

- [ ] **Step 1: Write unit tests for `validateAuditAcknowledgment` and `reconcileAuditEvents`**
  - Verify exact match passes.
  - Verify mismatched target fails.
  - Verify mismatched path fails.
  - Verify mismatched previousSha256 fails.
  - Verify mismatched newSha256 fails.
  - Verify mismatched action (not exactly `DOCUMENT_UPDATED`) fails.
  - Verify mismatched timestamp fails.
  - Verify missing/malformed details object fails.
  - Verify duplicate event ID in audit list fails.
  - Verify missing outstanding acknowledgment fails.

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement `validateAuditAcknowledgment` and `reconcileAuditEvents` in `src/utils/auditValidation.ts`**

- [ ] **Step 4: Run tests to verify all pass**

---

### Task 2: Project-List Stale Metadata Reconciliation Helper & Unit Tests

**Files:**
- Create/Modify: `src/utils/projectListReconciliation.ts`
- Test: `scripts/testControlledDocVersionSync.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ProjectListReconciliationResult {
    acceptedProjects: Project[];
    staleProjects: Project[];
  }

  export function reconcileProjectList(
    incomingProjects: Project[],
    previouslyAcceptedProjects: Project[],
    confirmedVersions: Record<string, number>
  ): ProjectListReconciliationResult;
  ```

- [ ] **Step 1: Write unit tests for `reconcileProjectList`**
  - Verify fresh project with `stateVersion >= confirmed` is accepted directly.
  - Verify stale project (`incomingVersion < confirmed`) is NOT normalized by bumping version.
  - Verify previously accepted project is preserved with its original metadata when incoming is stale.
  - Verify project with no previous object is held out of accepted list when incoming is stale.

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement `reconcileProjectList` in `src/utils/projectListReconciliation.ts`**

- [ ] **Step 4: Run tests to verify all pass**

---

### Task 3: App.tsx & TopBar.tsx Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Add project-scoped state in `src/App.tsx`**
  - Maintain `projectAuditRecordsRef: Record<string, AuditEvent[]>`
  - Maintain `outstandingAuditAcksRef: Record<string, ExpectedAuditAcknowledgment[]>`
  - Maintain `projectAuditStatusRef: Record<string, 'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED'>`
  - Maintain `projectAuditErrorRef: Record<string, string>`
  - Update `performAuditRefresh` to use `reconcileAuditEvents`.
  - Update `handleControlledDocumentCommitted` to append to `outstandingAuditAcksRef.current[projectId]`.
  - Update `handleSelectProject` to preserve existing project's audit status when re-selecting, and restore target project's status on project switches.
  - Update `fetchProjectData` to validate `data.audit` against outstanding acknowledgments before replacing audit logs.
  - Update `fetchProjects` to use `reconcileProjectList`.
  - Remove `window.__dmkTriggerProjectReload` and its `useEffect`.

- [ ] **Step 2: Update `src/components/TopBar.tsx`**
  - Add `data-testid={`project-option-${p.id}`}` to project item buttons in dropdown.
  - Add `data-testid="project-selector-dropdown-trigger"` to the dropdown button.

---

### Task 4: Integration Tests in `scripts/testControlledDocVersionSync.ts`

**Files:**
- Modify: `scripts/testControlledDocVersionSync.ts`

- [ ] **Step 1: Implement Test A (Exact Audit Identity & 8 Negative Fixtures)**
- [ ] **Step 2: Implement Test B (Project List Staleness & Reconciliation)**
- [ ] **Step 3: Implement Test C (Same-Project Re-selection via TopBar)**
- [ ] **Step 4: Implement Test D (A -> B -> A Navigation & Isolation)**
- [ ] **Step 5: Repair Scenario 9 / Test E (Genuine Deferred Project Response via TopBar Selector)**
- [ ] **Step 6: Implement Test F (Multiple Outstanding Saves & Out-of-Order Responses)**
- [ ] **Step 7: Verify Test G (Negative Save Outcomes preserved)**
- [ ] **Step 8: Run full version sync suite and verify all pass**

---

### Task 5: Verification Matrix, Push, CI & Review Gate

**Files:**
- Run verification commands and update PR description / task artifact.

- [ ] **Step 1: Run complete local verification matrix**
  - `npx tsx scripts/testControlledDocVersionSync.ts`
  - `npx tsx scripts/testControlledDocsViewComponent.ts`
  - `npx tsx scripts/testProjectsWorkspaceUi.ts`
  - `npm run test:controlled-docs`
  - `npm run wbs:check`
  - `npm run lint`
  - `npm run build`
  - `npm run test:complete`
  - `git diff --check`
- [ ] **Step 2: Commit and push to `fix/controlled-doc-project-version-sync`**
- [ ] **Step 3: Monitor GitHub Actions CI run to completion**
- [ ] **Step 4: Update PR #29 description via GitHub API in memory**
- [ ] **Step 5: Generate final delivery report and halt at Review Gate**
