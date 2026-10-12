# Controlled Document Project Version Synchronization Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the active project `stateVersion` in `App.tsx` and the `TopBar` immediately upon a successful server-acknowledged Controlled Documents save without requiring a browser refresh, while preserving project isolation, error boundaries, and unmount prevention.

**Architecture:** Add an optional, typed `onSaveCommitted` callback to `ControlledDocsView` invoked only on validated server-confirmed save responses. Connect this callback to a new `handleControlledDocumentCommitted` handler in `App.tsx` that updates `currentProject` and `projects` while applying monotonic `Math.max` guards, active project matching, and background fetch race protections.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, Node.js assert.

**Spec:** Directives from User Request (Phases 1-10 of `DOCMONSTAKRAKIN — Controlled Document Project Version Synchronization Fix`).

## Global Constraints

- Never use `window.location.reload()` to update the version indicator.
- Never increment the project version locally; strictly use the server-returned `stateVersion`.
- Never call the successful save callback on HTTP 401/403, HTTP 409, validation errors, timeouts, or unconfirmed requests.
- Never emit multiple successful-save events for one acknowledged transaction.
- A failure inside the parent UI callback must never cause an already committed server transaction to be treated as a failed save.
- Project isolation: saves completing for Project A after switching to Project B must never update Project B's active version, change selection, or unmount Project B's view.
- Monotonic version rule: `nextVersion = Math.max(previousVersion, confirmedServerVersion)` — stale background project loads must never downgrade the displayed version.
- Avoid full project reload (`fetchProjectData`) that sets `projectLoading: true` when merely synchronizing stateVersion, to prevent unmounting the Controlled Documents editor or erasing its success banner.

## Review Focus

- Project switching race: user switches projects while save request is in flight.
- Background snapshot race: `fetchProjectData` returns a stale snapshot with an older `stateVersion` after a newer save has already committed.
- Refresh failure isolation: save succeeds on server, but subsequent document content refresh fails. TopBar must still show the new version, alongside the refresh warning.
- Non-integer or negative `stateVersion` rejection in the App callback.
- Exception in parent callback must not prevent `setSaveSuccess` banner or post-save canonical refresh from executing.

---

### Task 1: TDD Red Phase — Integration & Component Regression Tests

**Files:**
- Create: `scripts/testControlledDocVersionSync.ts`
- Modify: `scripts/testControlledDocsViewComponent.ts`

**Interfaces:**
- Consumes: `ControlledDocsViewProps.onSaveCommitted`, `App`, `TopBar`.
- Produces: 12-scenario integration regression suite discovered by `scripts/runCompleteRegression.ts`.

- [ ] **Step 1: Write failing integration test covering Scenarios 1–12 in `scripts/testControlledDocVersionSync.ts`**
  - Implement full Playwright harness with Vite dev server testing real `App` and `TopBar`.
  - Cover Scenario 1: Starting v120, server save returns v121 -> TopBar displays `v121` without page reload.
  - Cover Scenario 2: Save-success banner and project selector/TopBar display the same confirmed version.
  - Cover Scenario 3: No component remount; editor state and success banner stay intact.
  - Cover Scenario 4: Failed save (500) does not advance version.
  - Cover Scenario 5: Signed-out save (401/403) does not advance version.
  - Cover Scenario 6: Stale document (409) does not advance version.
  - Cover Scenario 7: Timeout does not advance version until confirmed.
  - Cover Scenario 8: Project switching: save on Project A completing after switch to Project B preserves Project B's selection and version.
  - Cover Scenario 9: Stale background snapshot cannot downgrade a confirmed higher `stateVersion`.
  - Cover Scenario 10: Consecutive saves advance version monotonically (120 -> 121 -> 122).
  - Cover Scenario 11: Refresh failure preserves confirmed TopBar version and shows refresh warning.
  - Cover Scenario 12: Audit consistency: saved audit event ID and version match response.

- [ ] **Step 2: Add component-level tests for `onSaveCommitted` to `scripts/testControlledDocsViewComponent.ts`**
  - Verify `onSaveCommitted` called with `(projectId, saveResp)` on success.
  - Verify `onSaveCommitted` NOT called on 401/403, 409, or timeout.
  - Verify callback exception does not break `setSaveSuccess` or post-save refresh.

- [ ] **Step 3: Run test suites and verify RED (failure on missing callback / stale TopBar)**
  - Run: `npx tsx scripts/testControlledDocVersionSync.ts`
  - Expected: FAIL because `ControlledDocsView` does not yet notify `App` and TopBar stays at v120.

---

### Task 2: Component Implementation — Add `onSaveCommitted` to `ControlledDocsView.tsx`

**Files:**
- Modify: `src/components/ControlledDocsView.tsx`

**Interfaces:**
- Consumes: `DocumentSaveResponse`, `api.requestSave`.
- Produces: `onSaveCommitted?: (projectId: string, result: DocumentSaveResponse) => void` in `ControlledDocsViewProps`.

- [ ] **Step 1: Update `ControlledDocsViewProps` interface**
  - Add `onSaveCommitted?: (projectId: string, result: DocumentSaveResponse) => void;` to `ControlledDocsViewProps`.

- [ ] **Step 2: Update `handleConfirmSave` in `ControlledDocsView.tsx`**
  - In `handleConfirmSave`, after `setSaveSuccess(saveResp)` and `setIsSaving(false)`:
    - Validate `saveResp && saveResp.success && typeof saveResp.stateVersion === 'number' && Number.isInteger(saveResp.stateVersion) && saveResp.stateVersion >= 0`.
    - If valid and `onSaveCommitted` is provided, invoke `onSaveCommitted(projectId, saveResp)` inside a `try / catch` block to isolate parent errors from the component's save lifecycle.

- [ ] **Step 3: Run component tests to verify green**
  - Run: `npx tsx scripts/testControlledDocsViewComponent.ts`
  - Expected: PASS

---

### Task 3: Application Synchronization — Implement Handler in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ControlledDocsView.onSaveCommitted`.
- Produces: Authoritative `currentProject` and `projects` version updates with monotonic guards.

- [ ] **Step 1: Add `confirmedVersionsRef` and `handleControlledDocumentCommitted` to `src/App.tsx`**
  - Add `const confirmedVersionsRef = useRef<Record<string, number>>({});` to track latest confirmed server version per project.
  - Implement `handleControlledDocumentCommitted(projectId: string, saveResponse: DocumentSaveResponse)`:
    - Validate `projectId` matches string and `saveResponse` is successful with a non-negative integer `stateVersion`.
    - Update `confirmedVersionsRef.current[projectId] = Math.max(confirmedVersionsRef.current[projectId] ?? 0, saveResponse.stateVersion)`.
    - If `selectedProjectRef.current === projectId`:
      - Update `setCurrentProject(prev => prev && prev.id === projectId ? { ...prev, stateVersion: Math.max(prev.stateVersion ?? 0, saveResponse.stateVersion) } : prev)`.
    - Update `setProjects(prevProjects => prevProjects.map(p => p.id === projectId ? { ...p, stateVersion: Math.max(p.stateVersion ?? 0, saveResponse.stateVersion) } : p))`.

- [ ] **Step 2: Guard `fetchProjectData` against downgrading `stateVersion`**
  - In `fetchProjectData`, within `onCommit`:
    - Ensure `data.project.stateVersion` is merged with `Math.max(data.project.stateVersion ?? 0, confirmedVersionsRef.current[data.project.id] ?? 0)` before setting `currentProject` and updating `projects`.

- [ ] **Step 3: Connect `onSaveCommitted` prop to `ControlledDocsView` in `App.tsx`**
  - In `App.tsx` line ~666 where `<ControlledDocsView>` is rendered, pass `onSaveCommitted={handleControlledDocumentCommitted}`.

- [ ] **Step 4: Run integration test and verify GREEN**
  - Run: `npx tsx scripts/testControlledDocVersionSync.ts`
  - Expected: PASS all 12 scenarios.

---

### Task 4: Full Regression Matrix & Build Verification

**Files:**
- Test all suites.

- [ ] **Step 1: Run focused suites**
  - `npx tsx scripts/testControlledDocsViewComponent.ts`
  - `npx tsx scripts/testProjectsWorkspaceUi.ts`
  - `npx tsx scripts/testControlledDocVersionSync.ts`
  - `npm run test:controlled-docs`
  - `npm run lint`
  - `npm run build`

- [ ] **Step 2: Run complete regression**
  - `npm run wbs:check`
  - `npm run test:complete`
  - `git diff --check`
  - Record exact suite count and assertion totals.

---

### Task 5: Commit, Push, Draft PR Creation & CI Verification

**Files:**
- Commit changes.

- [ ] **Step 1: Review git diff**
  - Ensure only scoped files (`src/components/ControlledDocsView.tsx`, `src/App.tsx`, `scripts/testControlledDocsViewComponent.ts`, `scripts/testControlledDocVersionSync.ts`, plan) are staged.

- [ ] **Step 2: Commit to `fix/controlled-doc-project-version-sync`**
  - Commit message: `fix(ui): synchronize project version after controlled document save`

- [ ] **Step 3: Push to origin and open Draft PR**
  - Push branch to `origin/fix/controlled-doc-project-version-sync`.
  - Open new draft PR targeting `master` via GitHub API.

- [ ] **Step 4: Verify GitHub Actions CI**
  - Monitor CI run on the new PR commit.
  - Verify all jobs pass.

- [ ] **Step 5: Deliver final report and halt at review gate**
  - Deliver comprehensive report following Phase 10 guidelines.
  - Halt at review gate.
