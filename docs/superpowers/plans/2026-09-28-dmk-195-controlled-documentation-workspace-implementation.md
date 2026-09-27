# DMK-195 Controlled Documentation Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved DMK-195 Controlled Documentation Workspace with
registered-only repository document access, secure read-only viewing, controlled
editing of two living documents, raw-byte integrity checks, journaled atomic
document transactions, audit persistence, and project-isolated UI.

**Spec:**
docs/superpowers/specs/2026-09-27-dmk-195-controlled-documentation-workspace-design.md

**Approved Design Baseline:**
5439dfbf6aacf4ffaf3c0ee1be25f3389e0b36ce

---

## 1. Global Constraints & Invariants

The implementation must preserve these approved architecture decisions without deviation:

1. **Sole Authoritative Registry:** `bootstrap/docmonstakrakin.self-bootstrap.json` (`documents[]`) is the sole authoritative repository-document registry for `PRJ-DOCMONSTAKRAKIN`.
2. **No Fallback Registry:** `store.documents` is NOT a fallback registry. External projects return an empty registry (`[]`).
3. **No Filesystem Auto-Discovery:** No scanning of the `docs/` filesystem for uncataloged files. Unregistered files remain completely invisible and return `HTTP 404 Not Found`.
4. **`LAST_HANDOFF.md` Excluded:** `docs/00_control/LAST_HANDOFF.md` remains unavailable unless separately registered in a future work item.
5. **Immutable Projections:** All `GENERATED_PROJECTION` documents are strictly `READ_ONLY` (saves rejected with `HTTP 403 Forbidden`).
6. **Immutable Reference Documents:** Hash-pinned `REFERENCE` documents are strictly `READ_ONLY` in DMK-195 v1.
7. **Strict Allowlist for Living Documents:** ONLY these two documents permit `CONTROLLED_EDIT`:
   - `DOC-CTRL-002`: `docs/00_control/PROJECT_STATE.md`
   - `DOC-CTRL-006`: `docs/00_control/TRACEABILITY_MATRIX.md`
8. **Planning Authority Protection:** `MASTER_WBS.yaml` (`DOC-CTRL-003`) and `MASTER_WBS.md` (`DOC-CTRL-004`) remain strictly `READ_ONLY` through the Docs workspace.
9. **Raw-Byte Integrity Semantics:** Pinned integrity checks compute SHA-256 over exact raw bytes on disk without newline normalization.
10. **EOL Style Preservation:** Living editable documents preserve their detected EOL convention (`LF` or `CRLF`). Mixed-EOL documents fail closed with `UNSUPPORTED_MIXED_LINE_ENDINGS`.
11. **Persistence Mode Classification:** `/diff` and `/validate` routes are classified as `READ_ONLY` pre-persistence; `/save` is classified as `MUTATING`.
12. **Single State Version Increment:** A successful document save increments `project.stateVersion` exactly once ($N \to N+1$).
13. **Human Governance Confirmation:** Document saves require `requireHuman()` session authorization and explicit `humanConfirmed === true` payload flag.
14. **Prohibited Client Identity Claims:** Any request supplying client identity fields (`actor`, `role`, `approver`, `reviewerName`, etc.) or headers is rejected immediately with `HTTP 400 Bad Request` (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`).
15. **Target-Sibling Candidate and Rollback Artifacts:** Candidate and rollback files are placed as hidden sibling files in `path.dirname(targetDocument)` to guarantee same-filesystem `fs.renameSync` atomicity.
16. **Transaction Journal Location:** Transaction journals reside under `.local/document-transactions/<operationId>.json`.
17. **Untrusted Journal Paths:** Journal paths stored on disk are NOT authorities during crash recovery. Target and sibling paths are re-derived strictly from `documentId` and the trusted bootstrap manifest registry.
18. **Safe Markdown Rendering:** Markdown is rendered using `react-markdown` with raw HTML interpretation disabled. No `dangerouslySetInnerHTML` or homemade HTML sanitizers.
19. **Preserved Dynamic Projections:** Existing `DocumentsView.tsx` functionality remains available under Tab 2 ("Dynamic Projections"). Gate 7 behavior and portable package export remain untouched.
20. **Governance Boundaries:** DMK-201 remains untouched (`VERIFICATION_PENDING`). Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`. No reconciliation or recovery applied.

---

## 2. Implementation Review Focus

The implementation and test suites must explicitly address the following five high-risk failure modes:

| Focus Area | Architecture Requirement | Concrete Risk | Owning Task & Test |
| :--- | :--- | :--- | :--- |
| **1. Pre-Persistence Classification** | Middleware evaluates `${req.baseUrl}${req.path}` before `next()` reaches route handlers. | Mounted Express routers strip mount prefixes from `req.path`. If tested against `req.path` alone, `/diff` and `/validate` match nothing, fall through to `MUTATING`, acquire writer locks, and rewrite `.local/project-state.json`. | **Task 2**: `testProjectPersistenceClassifier.ts` (Test AI, Test U, Test V). |
| **2. Cross-Domain Rollback** | Injected snapshot persistence failure triggers rollback hook to restore document from sibling `.rollback` file. | Document is replaced on disk, but `writeProjectSnapshotAtomic` fails. Without a rollback hook, the document is mutated on disk while the audit ledger and `stateVersion` remain unrecorded. | **Task 6**: `testControlledDocsTransaction.ts` (Test Y). |
| **3. Crash Recovery Security** | Startup recovery reads journal, re-derives filesystem paths from manifest registry, and ignores untrusted paths inside the journal JSON. | Server crashes after `fs.renameSync` (phase `DOCUMENT_REPLACED`) before snapshot commit. If journal paths are trusted, an attacker could point recovery to overwrite arbitrary system files. | **Task 7**: `testControlledDocsRecovery.ts` (Test Z, Test AN). |
| **4. Symlink Target Protection** | If a registered editable target itself is a symbolic link, writing must FAIL CLOSED. | An attacker replaces `docs/00_control/PROJECT_STATE.md` with a symlink targeting `/etc/shadow` or `.env`. Controlled writes through symlinks must be strictly prohibited. | **Task 4**: `testControlledDocsPersistence.ts` (Symlink Write Rejection). |
| **5. Byte-Level EOL Preservation** | Raw-byte hashing; detect LF/CRLF; preserve convention; reject mixed EOL. | Git on Windows or editors convert LF to CRLF, altering raw-byte SHA-256 and triggering spurious integrity drift or corrupting LF-only repositories. | **Task 4**: `testControlledDocsPersistence.ts` (Test AF, Test AG, Test AH). |

---

## 3. Commit Strategy

Implementation will proceed via small, focused commits corresponding to each task or tightly coupled pair:

1. `chore(dmk-195): transition WBS and runtime to IN_PROGRESS for dogfooding` (Task 1)
2. `feat(persistence): add pre-persistence classifier and lifecycle hooks` (Task 2)
3. `feat(docs): add controlled docs registry and domain types` (Task 3)
4. `feat(docs): add safe document filesystem primitives and EOL handling` (Task 4)
5. `feat(docs): add document validation and non-mutating line diff` (Task 5)
6. `feat(docs): implement journaled atomic document transaction` (Task 6)
7. `feat(docs): implement startup transaction recovery and path derivation` (Task 7)
8. `feat(docs): add controlled docs REST API and identity claim rejection` (Task 8)
9. `feat(ui): add controlled docs frontend client and types` (Task 9)
10. `feat(ui): implement controlled documentation workspace UI` (Task 10 & 11)
11. `test(docs): add comprehensive boundary and security regression suite` (Task 12)
12. `docs(dmk-195): record verification evidence and transition to VERIFICATION` (Task 13 & 14)

---

## 4. Task Decomposition

### Task 1 — Begin Controlled Dogfooding

**Description:**
Following human approval of this implementation plan, record the initial state baseline, transition DMK-195 from `BACKLOG` to `IN_PROGRESS` in the canonical WBS, synchronize generated markdown, and update runtime WorkItem state via the canonical HTTP API.

**Files:**
- Modify: `docs/00_control/MASTER_WBS.yaml`
- Modify: `docs/00_control/MASTER_WBS.md` (via `npm run wbs:render`)
- Test / Verify: `scripts/testDogfoodingBaseline.ts`

**Interfaces:**
- Consumes: Canonical WBS `docs/00_control/MASTER_WBS.yaml`, runtime API `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items`
- Produces: Updated WBS status `IN_PROGRESS`, updated runtime WorkItem status `IN_PROGRESS`, single `WORK_ITEM_UPDATED` audit event, incremented `stateVersion` ($N \to N+1$).

**Implementation Steps:**
- [ ] Record initial baseline:
  - WBS DMK-195 status: `BACKLOG`
  - Runtime DMK-195 status: `PROPOSED`
  - Project `stateVersion`: 30
  - Current `.local/project-state.json` SHA-256: `68b8252e9b3a98194e670eac3bf06b4a8260a17ee22eaad1f409a7f4a577ee82`
  - DMK-201 status: `VERIFICATION_PENDING`
- [ ] Edit `docs/00_control/MASTER_WBS.yaml`: change DMK-195 `status` from `BACKLOG` to `IN_PROGRESS`.
- [ ] Run `npm run wbs:render` to regenerate `docs/00_control/MASTER_WBS.md`.
- [ ] Run `npm run wbs:check` to verify zero WBS drift.
- [ ] Update runtime WorkItem state via `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items`:
  ```json
  {
    "id": "DMK-195",
    "status": "IN_PROGRESS"
  }
  ```
- [ ] Verify audit ledger contains exactly one new `WORK_ITEM_UPDATED` event and `project.stateVersion` increments exactly once ($30 \to 31$).
- [ ] Verify that DMK-201 and other historical WorkItems remain completely untouched.
- [ ] Note: This intentionally makes prior runtime snapshot hash bindings historical/stale. Do NOT apply DMK-201 reconciliation.
- [ ] Commit changes: `chore(dmk-195): transition WBS and runtime to IN_PROGRESS for dogfooding`.

---

### Task 2 — Persistence Middleware Extension

**Description:**
Extend `server/projectPersistence.ts` to support pre-persistence request classification using the fully qualified routed path `${req.baseUrl}${req.path}`. Add lifecycle hooks (`onCommit`, `onRollback`) and ensure `READ_ONLY` requests bypass transaction locks, snapshot cloning, and atomic snapshot writes.

**Files:**
- Modify: `server/projectPersistence.ts`
- Create / Test: `scripts/testProjectPersistenceClassifier.ts`

**Interfaces:**
- Consumes: Express `req`, `res`, `next`
- Produces:
  ```ts
  export type ProjectPersistenceMode = 'READ_ONLY' | 'MUTATING';
  export type ProjectPersistenceClassifier = (req: express.Request) => ProjectPersistenceMode;
  export function classifyProjectRequestMode(req: express.Request): ProjectPersistenceMode;
  ```
  `res.locals` extensions:
  ```ts
  res.locals.projectPersistenceMode?: ProjectPersistenceMode;
  res.locals.onPersistenceCommit?: () => Promise<void> | void;
  res.locals.onPersistenceRollback?: (error: unknown) => Promise<void> | void;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testProjectPersistenceClassifier.ts` asserting:
  - Mounted Express router with prefix `/api/projects` correctly classifies `/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff` as `READ_ONLY`.
  - Mounted Express router correctly classifies `/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate` as `READ_ONLY`.
  - All other POST/PUT/PATCH/DELETE requests classify as `MUTATING`.
  - `READ_ONLY` mode does not trigger `writeProjectSnapshotAtomic` or modify `.local/project-state.json`.
  - Injected persistence failure triggers `res.locals.onPersistenceRollback`.
- [ ] Run failing test and verify failure: `npx tsx scripts/testProjectPersistenceClassifier.ts`.
- [ ] Implement `classifyProjectRequestMode(req)` in `server/projectPersistence.ts` using `${req.baseUrl}${req.path}`:
  ```ts
  const routedPath = `${req.baseUrl}${req.path}`;
  if (/^\/api\/projects\/[^/]+\/docs\/[^/]+\/(diff|validate)$/.test(routedPath)) {
    return 'READ_ONLY';
  }
  ```
- [ ] Update `installProjectPersistence` to check `classifyProjectRequestMode(req)`. If `READ_ONLY`, immediately call `next()` without setting `transactionInFlight`, cloning state, or attaching snapshot commit interceptors.
- [ ] Add execution of `res.locals.onPersistenceCommit` after successful `writeProjectSnapshotAtomic` and `res.locals.onPersistenceRollback` upon persistence catch block.
- [ ] Run focused test: `npx tsx scripts/testProjectPersistenceClassifier.ts` (PASS).
- [ ] Run complete regression: `npm run qa`.
- [ ] Commit changes: `feat(persistence): add pre-persistence classifier and lifecycle hooks`.

---

### Task 3 — Controlled Document Registry & Types

**Description:**
Create `server/docs/controlledDocsRegistry.ts` reading `bootstrap/docmonstakrakin.self-bootstrap.json` as the sole authoritative repository document registry. Expose strongly typed document records and enforce project isolation.

**Files:**
- Create: `server/docs/controlledDocsRegistry.ts`
- Modify: `src/types.ts`
- Create / Test: `scripts/testControlledDocsRegistry.ts`

**Interfaces:**
- Consumes: `bootstrap/docmonstakrakin.self-bootstrap.json` (`documents[]`)
- Produces:
  ```ts
  export type ControlledDocumentKind = 'CONTROL' | 'PRODUCT' | 'REQUIREMENTS' | 'ARCHITECTURE' | 'SECURITY' | 'VERIFICATION' | 'OPERATIONS';
  export type ControlledDocumentAuthority = 'REFERENCE' | 'GENERATED_PROJECTION';
  export type ControlledDocumentEditability = 'READ_ONLY' | 'CONTROLLED_EDIT';
  export type ControlledDocumentFileType = 'MARKDOWN' | 'YAML' | 'JSON' | 'OTHER';

  export interface ControlledDocumentRecord {
    id: string;
    path: string;
    kind: ControlledDocumentKind;
    authority: ControlledDocumentAuthority;
    editability: ControlledDocumentEditability;
    fileType: ControlledDocumentFileType;
    title: string;
    description?: string;
    sha256Digest?: string;
    editableLivingDoc: boolean;
  }

  export function getControlledDocsRegistry(projectId: string): ControlledDocumentRecord[];
  export function findControlledDoc(projectId: string, documentId: string): ControlledDocumentRecord | null;
  export function isControlledEditAllowed(projectId: string, documentId: string): boolean;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsRegistry.ts` asserting:
  - Exactly 28 documents returned for `PRJ-DOCMONSTAKRAKIN` (Test A).
  - Authority correctly mapped for all 28 items (Test B).
  - Only `DOC-CTRL-002` and `DOC-CTRL-006` report `editability === 'CONTROLLED_EDIT'`.
  - `DOC-CTRL-003` (`MASTER_WBS.yaml`) reports `READ_ONLY`.
  - `DOC-CTRL-004` (`MASTER_WBS.md`) reports `READ_ONLY`.
  - External projects (e.g. `PRJ-ATLAS-01`) return empty array `[]` (Test I).
  - Unregistered documents return `null` (Test H, Test AD).
  - `LAST_HANDOFF.md` returns `null` (Test AE).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsRegistry.ts`.
- [ ] Implement `server/docs/controlledDocsRegistry.ts`:
  - Load manifest synchronously at module initialization.
  - Enrich items with `fileType` (`.md` -> MARKDOWN, `.yaml` -> YAML, `.json` -> JSON).
  - Derive `editability`: `CONTROLLED_EDIT` ONLY for `DOC-CTRL-002` and `DOC-CTRL-006` in `PRJ-DOCMONSTAKRAKIN`.
- [ ] Add domain types to `src/types.ts`.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsRegistry.ts` (PASS).
- [ ] Commit changes: `feat(docs): add controlled docs registry and domain types`.

---

### Task 4 — Safe Document Filesystem Primitives

**Description:**
Create `server/docs/controlledDocsPersistence.ts` to implement path boundary clamping within `docs/`, raw-byte SHA-256 calculation, line ending detection/preservation, symlink write rejection, and atomic same-directory replacement primitives.

**Files:**
- Create: `server/docs/controlledDocsPersistence.ts`
- Create / Test: `scripts/testControlledDocsPersistence.ts`

**Interfaces:**
- Consumes: Node.js `fs`, `path`, `crypto`, `server/security/pathBoundary.ts`, `ControlledDocumentRecord`
- Produces:
  ```ts
  export type DetectedEol = 'LF' | 'CRLF' | 'MIXED' | 'NONE';

  export interface DocumentFileReadResult {
    rawBytes: Buffer;
    rawSha256: string;
    content: string;
    eol: DetectedEol;
    sizeBytes: number;
    integrityStatus: 'MATCH' | 'CHANGED' | 'UNPINNED';
  }

  export function resolveDocumentDiskPath(docRecord: ControlledDocumentRecord, workspaceRoot?: string): { diskPath: string; dirPath: string };
  export function readDocumentDisk(docRecord: ControlledDocumentRecord, workspaceRoot?: string): DocumentFileReadResult;
  export function detectLineEndings(rawContent: string): DetectedEol;
  export function encodeDocumentBytes(content: string, targetEol: DetectedEol): Buffer;
  export function deriveSiblingCandidatePath(targetDiskPath: string, operationId: string): string;
  export function deriveSiblingRollbackPath(targetDiskPath: string, operationId: string): string;
  export function writeSiblingFileAtomic(siblingPath: string, bytes: Buffer): void;
  export function replaceDocumentSiblingAtomic(candidateSiblingPath: string, targetDiskPath: string): void;
  export function rollbackDocumentSiblingAtomic(rollbackSiblingPath: string, targetDiskPath: string): void;
  export function unlinkSiblingSafe(siblingPath: string): void;
  export function assertEditableTargetNotSymlink(diskPath: string): void;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsPersistence.ts` asserting:
  - Traversal attempts (`../`, `..\\`) fail closed (Test F).
  - Absolute path attempts fail closed (Test G).
  - Realpath verification ensures target remains within `docs/`.
  - Review Focus 4: Symlink target write rejection fails closed when target itself is a symlink (`assertEditableTargetNotSymlink`).
  - Raw-byte SHA-256 matches unnormalized disk bytes (Test AF).
  - Hash-pinned MATCH (Test C) and CHANGED (Test D).
  - Living docs report UNPINNED (Test E).
  - EOL detection: LF -> LF, CRLF -> CRLF (Test AG).
  - Mixed EOL fails closed with `UNSUPPORTED_MIXED_LINE_ENDINGS` (Test AH).
  - Candidate and rollback sibling paths reside in `path.dirname(targetDiskPath)` (Test AJ, Test AK).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsPersistence.ts`.
- [ ] Implement `server/docs/controlledDocsPersistence.ts`:
  - Enforce `path.resolve(workspaceRoot, docRecord.path)` containment in `path.resolve(workspaceRoot, 'docs')`.
  - Implement `assertEditableTargetNotSymlink`: check `fs.lstatSync(diskPath).isSymbolicLink()`; throw error if true.
  - Implement `detectLineEndings`: scan `\r\n` vs `\n`. If both present, return `'MIXED'`.
  - Implement `encodeDocumentBytes`: normalize newlines to target EOL and encode as UTF-8 buffer.
  - Implement atomic write with `fs.openSync`, `fs.writeSync`, `fs.fdatasyncSync`, `fs.closeSync`.
  - Implement `fs.renameSync` for forward replacement and rollback.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsPersistence.ts` (PASS).
- [ ] Commit changes: `feat(docs): add safe document filesystem primitives and EOL handling`.

---

### Task 5 — Validation & Diff

**Description:**
Create `server/docs/controlledDocsValidator.ts` to implement universal content validation (UTF-8, size limits, no null bytes), document-specific structural validation, and deterministic line diffing.

**Files:**
- Create: `server/docs/controlledDocsValidator.ts`
- Create / Test: `scripts/testControlledDocsValidator.ts`

**Interfaces:**
- Consumes: `ControlledDocumentRecord`, `rawBytes: Buffer`, `candidateContent: string`
- Produces:
  ```ts
  export interface DocumentValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
  }

  export interface DocumentDiffResult {
    originalSha256: string;
    candidateSha256: string;
    additions: number;
    deletions: number;
    changes: number;
    diffUnified: string;
  }

  export function validateUniversalConstraints(rawBytes: Buffer, content: string): DocumentValidationResult;
  export function validateDocumentContent(docRecord: ControlledDocumentRecord, rawBytes: Buffer, candidateContent: string): DocumentValidationResult;
  export function computeDocumentDiff(originalContent: string, candidateContent: string, originalSha256: string, candidateSha256: string): DocumentDiffResult;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsValidator.ts` asserting:
  - Rejects payloads exceeding 5MB or containing null bytes `\0`.
  - `DOC-CTRL-002` (`PROJECT_STATE.md`) requires top-level `# Project State` and governance sections referencing DMK-201, Gate 7, and Release Status (Test N).
  - `DOC-CTRL-006` (`TRACEABILITY_MATRIX.md`) validates Markdown table syntax `| ... |`.
  - Rejects edits to `DOC-CTRL-004` (Test J) and `DOC-CTRL-003` (Test K).
  - Line diff computes additions, deletions, modifications without disk mutations (Test M).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsValidator.ts`.
- [ ] Implement `server/docs/controlledDocsValidator.ts`:
  - Add UTF-8 decoding and null byte checks.
  - Implement structural regex checks for `PROJECT_STATE.md` and Markdown table parser for `TRACEABILITY_MATRIX.md`.
  - Implement unified diff generator comparing original and candidate lines.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsValidator.ts` (PASS).
- [ ] Commit changes: `feat(docs): add document validation and non-mutating line diff`.

---

### Task 6 — Cross-Domain Document Transaction

**Description:**
Create `server/docs/controlledDocsTransaction.ts` to coordinate dual-domain transactions between filesystem markdown documents and `.local/project-state.json` via target-sibling rollback files and durable journal logging.

**Files:**
- Create: `server/docs/controlledDocsTransaction.ts`
- Create / Test: `scripts/testControlledDocsTransaction.ts`

**Interfaces:**
- Consumes: `ProjectStore`, `ControlledDocumentRecord`, `controlledDocsPersistence.ts`, `server/projectPersistence.ts`
- Produces:
  ```ts
  export type DocumentTransactionState = 'PREPARED' | 'DOCUMENT_REPLACED' | 'COMMITTED';

  export interface DocumentTransactionJournal {
    operationId: string;
    projectId: string;
    documentId: string;
    state: DocumentTransactionState;
    baseSha256: string;
    candidateSha256: string;
    actor: string;
    startedAt: string;
    updatedAt: string;
  }

  export interface DocumentTransactionCoordinator {
    operationId: string;
    candidatePath: string;
    rollbackPath: string;
    journalPath: string;
    executeReplacement: () => { newSha256: string; candidateBytes: Buffer };
    onPersistenceSuccess: () => void;
    onPersistenceFailure: (error: unknown) => void;
  }

  export function prepareDocumentTransaction(params: {
    projectId: string;
    documentId: string;
    docRecord: ControlledDocumentRecord;
    candidateContent: string;
    baseSha256: string;
    actor: string;
    workspaceRoot?: string;
  }): DocumentTransactionCoordinator;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsTransaction.ts` asserting:
  - Valid transaction creates sibling `.rollback` and `.candidate` files in `path.dirname(targetDocument)` (Test AJ, Test AK).
  - Stale `baseSha256` triggers immediate rejection with `DOCUMENT_STALE` without disk mutations (Test O).
  - Forward rename replaces document atomically (Test P, Test AL).
  - Review Focus 2: Injected snapshot persistence failure triggers rollback hook, atomically restoring original document from rollback sibling file (Test Y, Test AM).
  - Successful transaction appends `DOCUMENT_UPDATED` audit event and increments `project.stateVersion` exactly once (Test Q, Test W).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsTransaction.ts`.
- [ ] Implement `server/docs/controlledDocsTransaction.ts`:
  - Generate `operationId = 'dmk-' + randomUUID()`.
  - Write journal in `.local/document-transactions/<operationId>.json` with state `PREPARED`.
  - Write rollback copy to `.target.rollback` and candidate copy to `.target.candidate`.
  - Advance journal state to `DOCUMENT_REPLACED` upon `executeReplacement()`.
  - In `onPersistenceSuccess()`, advance journal to `COMMITTED`, unlink siblings, and unlink journal.
  - In `onPersistenceFailure(err)`, execute atomic rollback rename, verify restored hash equals `baseSha256`, and unlink temporary artifacts.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsTransaction.ts` (PASS).
- [ ] Commit changes: `feat(docs): implement journaled atomic document transaction`.

---

### Task 7 — Startup Transaction Recovery

**Description:**
Create `server/docs/controlledDocsRecovery.ts` and integrate it into server initialization in `server.ts`. Re-derive authoritative paths from manifest registry by `documentId` and safely resolve orphaned journals.

**Files:**
- Create: `server/docs/controlledDocsRecovery.ts`
- Modify: `server.ts`
- Create / Test: `scripts/testControlledDocsRecovery.ts`

**Interfaces:**
- Consumes: Node.js `fs`, `.local/document-transactions/`, `server/docs/controlledDocsRegistry.ts`, `server/projectPersistence.ts`
- Produces:
  ```ts
  export interface RecoveryReport {
    recoveredCount: number;
    cleanedCount: number;
    ambiguousCount: number;
    errors: string[];
    locked: boolean;
  }

  export function recoverDocumentTransactions(workspaceRoot?: string): RecoveryReport;
  export function isDocumentTransactionsLocked(): boolean;
  export function assertDocumentTransactionsUnlocked(): void;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsRecovery.ts` asserting:
  - Discovers journals in `.local/document-transactions/`.
  - Review Focus 3: Journal in state `DOCUMENT_REPLACED` without committed audit event restores original document from rollback sibling file (Test Z).
  - Completed `COMMITTED` journal safely cleans leftover files (Test AA).
  - Corrupted or unparseable journal locks transactions with `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED` (Test AB).
  - Journal path tampering: altered paths inside journal JSON are completely ignored; recovery re-derives paths from manifest registry (Test AN).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsRecovery.ts`.
- [ ] Implement `server/docs/controlledDocsRecovery.ts`:
  - Scan journal directory. Read each journal JSON.
  - Look up `documentId` in `getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN')`. If not found, fail closed (lock).
  - Re-derive expected disk path and sibling paths.
  - Reconcile against `.local/project-state.json` audit events.
  - Execute recovery rollback or cleanup.
- [ ] Wire `recoverDocumentTransactions()` into `server.ts` startup sequence before Express route handlers.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsRecovery.ts` (PASS).
- [ ] Commit changes: `feat(docs): implement startup transaction recovery and path derivation`.

---

### Task 8 — Controlled Docs API

**Description:**
Create `server/docs/controlledDocsRouter.ts` providing REST endpoints for document catalog listing, reading, diffing, validating, and saving. Enforce strict rejection of client identity claims and integrate with human reviewer authorization.

**Files:**
- Create: `server/docs/controlledDocsRouter.ts`
- Modify: `server.ts`
- Create / Test: `scripts/testControlledDocsApi.ts`

**Interfaces:**
- Consumes: Express `Router`, `ProjectStore`, `requireHuman` from `server/proposals/identity.ts`
- Produces:
  - `GET /api/projects/:id/docs`
  - `GET /api/projects/:id/docs/:documentId`
  - `POST /api/projects/:id/docs/:documentId/diff`
  - `POST /api/projects/:id/docs/:documentId/validate`
  - `POST /api/projects/:id/docs/:documentId/save`

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsApi.ts` asserting:
  - `GET /api/projects/PRJ-DOCMONSTAKRAKIN/docs` returns 28 items.
  - `GET .../docs/DOC-CTRL-002` returns document metadata and content.
  - `POST .../save` rejects client identity claims with `HTTP 400 Bad Request` (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`) (Test X).
  - `POST .../save` requires human session authentication (returns 401/403 if unauthorized).
  - `POST .../save` requires `humanConfirmed === true` (returns 422 if false).
  - Full save flow persists document, appends audit, increments `stateVersion`, and survives server restart (Test L, Test R).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsApi.ts`.
- [ ] Implement `server/docs/controlledDocsRouter.ts`:
  - Check `req.body` and headers for prohibited identity claims (`actor`, `role`, `approver`, etc.). If found, return `res.status(400).json({ error: 'CLIENT_IDENTITY_CLAIMS_PROHIBITED' })`.
  - Wire `/diff` and `/validate` handlers.
  - Wire `/save` handler to `prepareDocumentTransaction`, attach `res.locals.onPersistenceCommit` and `onPersistenceRollback`, update store audit log, and return response.
- [ ] Mount router in `server.ts` via `app.use('/api/projects', createControlledDocsRouter(store, reviewerAuth.requireHuman))`.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsApi.ts` (PASS).
- [ ] Commit changes: `feat(docs): add controlled docs REST API and identity claim rejection`.

---

### Task 9 — Frontend Document Types & Data Access

**Description:**
Create `src/data/controlledDocsClient.ts` to provide typed API helpers with request sequencing, timeouts, and `AbortController` cancellation to prevent stale responses during project switching.

**Files:**
- Create: `src/data/controlledDocsClient.ts`
- Modify: `src/types.ts`
- Create / Test: `scripts/testControlledDocsClient.ts`

**Interfaces:**
- Consumes: Browser `fetch`, `src/types.ts`
- Produces:
  ```ts
  export interface ControlledDocumentSummary {
    id: string;
    path: string;
    kind: ControlledDocumentKind;
    authority: ControlledDocumentAuthority;
    editability: ControlledDocumentEditability;
    fileType: ControlledDocumentFileType;
    title: string;
    description?: string;
    integrityStatus: 'MATCH' | 'CHANGED' | 'UNPINNED';
    sha256Digest?: string;
    currentSha256?: string;
    sizeBytes?: number;
    eol?: DetectedEol;
  }

  export interface DocumentContentResponse {
    document: ControlledDocumentSummary;
    content: string;
    rawSha256: string;
    eol: DetectedEol;
    sizeBytes: number;
  }

  export interface DocumentDiffResponse {
    documentId: string;
    originalSha256: string;
    candidateSha256: string;
    additions: number;
    deletions: number;
    changes: number;
    diffUnified: string;
  }

  export interface DocumentValidationResponse {
    documentId: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }

  export function createControlledDocsLoader(request?: typeof fetch): {
    loadDocumentList: (projectId: string) => Promise<ControlledDocumentSummary[]>;
    loadDocumentContent: (projectId: string, documentId: string) => Promise<DocumentContentResponse>;
    requestDiff: (projectId: string, documentId: string, candidateContent: string) => Promise<DocumentDiffResponse>;
    requestValidate: (projectId: string, documentId: string, candidateContent: string) => Promise<DocumentValidationResponse>;
    requestSave: (projectId: string, documentId: string, candidateContent: string, baseSha256: string) => Promise<DocumentContentResponse>;
    invalidate: () => void;
  };
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsClient.ts` asserting:
  - Sequence tracking ignores out-of-order responses.
  - `invalidate()` aborts in-flight requests.
  - API errors are parsed and reported as typed error strings.
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsClient.ts`.
- [ ] Implement `src/data/controlledDocsClient.ts` following `src/data/projectWorkspace.ts` pattern.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsClient.ts` (PASS).
- [ ] Commit changes: `feat(ui): add controlled docs frontend client and types`.

---

### Task 10 — Repository Documents UI

**Description:**
Install `react-markdown` and create `src/components/ControlledDocsView.tsx` implementing the repository document browser, status badges, secure markdown viewer (HTML disabled), and the controlled editing 5-stage sequential workflow (`View -> Edit -> Diff -> Validate -> Confirm -> Save`).

**Files:**
- Create: `src/components/ControlledDocsView.tsx`
- Modify: `package.json` (add dependency `react-markdown`)
- Create / Test: `scripts/testControlledDocsViewComponent.ts`

**Interfaces:**
- Consumes: `ControlledDocumentSummary`, `controlledDocsClient.ts`, `react-markdown`, `lucide-react`
- Produces: Controlled documentation workspace React component.

**Implementation Steps:**
- [ ] Add `react-markdown` to `dependencies` in `package.json` and install (`npm install --legacy-peer-deps` or repository standard).
- [ ] Write component tests in `scripts/testControlledDocsViewComponent.ts` asserting:
  - Renders document catalog grouped by kind with search filter.
  - Renders badges: MATCH (green), CHANGED (amber), UNPINNED (slate), CONTROLLED_EDIT (blue), READ_ONLY (slate).
  - Embedded HTML `<script>` tags render as inert text without executing (Test AC).
  - Read-only documents show no edit controls.
  - Living documents (`DOC-CTRL-002`, `DOC-CTRL-006`) provide Edit button.
  - Editor workflow enforces sequential progression: cannot save without diff, validate, and explicit confirmation checkbox.
- [ ] Implement `src/components/ControlledDocsView.tsx`.
- [ ] Run focused component test: `npx tsx scripts/testControlledDocsViewComponent.ts` (PASS).
- [ ] Commit changes: `feat(ui): implement controlled documentation workspace UI`.

---

### Task 11 — Existing DocumentsView Integration

**Description:**
Integrate `ControlledDocsView` into `src/App.tsx` using a dual-tab container: Tab 1 ("Repository Documents") hosts the new controlled workspace; Tab 2 ("Dynamic Projections") hosts the existing `DocumentsView.tsx`. Ensure project switching clears draft state and preserves release gates and export functions.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ControlledDocsView.tsx`
- Create / Test: `scripts/testControlledDocsWorkspaceTabs.ts`

**Interfaces:**
- Consumes: `Project`, `Requirements`, `DocumentsViewProps`
- Produces: Seamless dual-tab documentation navigation in console.

**Implementation Steps:**
- [ ] Write integration test in `scripts/testControlledDocsWorkspaceTabs.ts` asserting:
  - Tab navigation switches between Repository Documents and Dynamic Projections.
  - Dynamic Projections maintains release gate checks and export modal triggers.
  - Switching projects clears selected document and draft buffers (Test S).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsWorkspaceTabs.ts`.
- [ ] Update `src/components/ControlledDocsView.tsx` to host tab bar:
  - Tab 1: `Repository Documents` (controlled documents UI).
  - Tab 2: `Dynamic Projections` (renders `<DocumentsView {...props} />`).
- [ ] Update `src/App.tsx` to render `<ControlledDocsView ... />` when `currentView === 'documents'`.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsWorkspaceTabs.ts` (PASS).
- [ ] Run UI smoke test: `npm run test:projects-workspace:ui`.
- [ ] Commit changes: `feat(ui): integrate controlled docs workspace with dynamic projections`.

---

### Task 12 — Comprehensive Security / Boundary Tests

**Description:**
Implement the complete test matrix covering Tests A through AN in `scripts/testControlledDocs.ts` to ensure 100% test coverage of all security boundaries, failure recovery, atomic rollback, and identity error normalization.

**Files:**
- Create: `scripts/testControlledDocs.ts`
- Modify: `package.json` (add script `"test:controlled-docs": "tsx scripts/testControlledDocs.ts"`)

**Test Matrix Mapping (Tests A through AN):**
- **Test A:** Registry Listing (28 manifest documents for `PRJ-DOCMONSTAKRAKIN`).
- **Test B:** Authority Classification (`REFERENCE` vs `GENERATED_PROJECTION`).
- **Test C:** Hash-Pinned MATCH (pinned digest matches disk raw bytes).
- **Test D:** Hash-Pinned CHANGED (tampered file returns `CHANGED`).
- **Test E:** UNPINNED Living Documents (`DOC-CTRL-002`, `DOC-CTRL-006` return `UNPINNED`).
- **Test F:** Traversal Rejection (`../`, `..\\` return HTTP 403/404).
- **Test G:** Absolute Path Rejection (returns HTTP 403/404).
- **Test H:** Unregistered Document Rejection (returns HTTP 404).
- **Test I:** Project Isolation (`PRJ-ATLAS-01` returns `[]`).
- **Test J:** Projection Edit Rejection (`DOC-CTRL-004` returns HTTP 403).
- **Test K:** `MASTER_WBS.yaml` Edit Rejection (`DOC-CTRL-003` returns HTTP 403).
- **Test L:** Controlled Editable Flow (`DOC-CTRL-002` valid edit succeeds).
- **Test M:** Diff Non-Mutating (creates zero disk writes).
- **Test N:** Validation Failure Blocks Save (malformed content returns HTTP 422).
- **Test O:** Stale Base Hash Rejection (returns HTTP 409 `DOCUMENT_STALE`).
- **Test P:** Atomic Persistence (writes `.candidate`, renames, leaves zero leftover siblings).
- **Test Q:** Audit Event Correctness (appends `DOCUMENT_UPDATED` maintaining hash chain).
- **Test R:** Persistence & Reload (document update survives server restart).
- **Test S:** Project Switching State Reset (clears document selection and draft state).
- **Test T:** UI Smoke & Accessibility (renders cleanly without console errors).
- **Test U:** Diff Preserves Snapshot Bytes & Early Exit (zero state writes, zero locks).
- **Test V:** Validate Preserves Snapshot Bytes & Early Exit (zero state writes, zero locks).
- **Test W:** `stateVersion` Increment (increments exactly once: $N \to N+1$).
- **Test X:** Client Identity Claims Rejected (returns HTTP 400 `CLIENT_IDENTITY_CLAIMS_PROHIBITED`).
- **Test Y:** Persistence Failure Restores Document (rollback hook restores from sibling file).
- **Test Z:** Startup Recovery Restores Unaudited Replace (`DOCUMENT_REPLACED` restored on restart).
- **Test AA:** Stale `COMMITTED` Journal Cleans Safely (removes completed transaction files).
- **Test AB:** Ambiguous Journal Fails Closed (`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED` blocks mutations).
- **Test AC:** Raw Markdown HTML Inert (`<script>` rendered as text).
- **Test AD:** Unregistered `docs/` File Invisible (omitted files return 404).
- **Test AE:** `LAST_HANDOFF.md` Unavailable (returns 404).
- **Test AF:** Raw-Byte Hashing Semantics (exact byte SHA-256 without CRLF normalization).
- **Test AG:** EOL Style Preservation (LF stays LF; CRLF stays CRLF).
- **Test AH:** Mixed-EOL Edit Fails Closed (`UNSUPPORTED_MIXED_LINE_ENDINGS`).
- **Test AI:** Mounted Path Classification (`${req.baseUrl}${req.path}` classifies `/diff` as `READ_ONLY`).
- **Test AJ:** Candidate Sibling Placement (candidate in `path.dirname(targetDocument)`).
- **Test AK:** Rollback Sibling Placement (rollback in `path.dirname(targetDocument)`).
- **Test AL:** Forward Same-Directory Replacement (`fs.renameSync` sibling to target).
- **Test AM:** Atomic Rollback Same-Directory Replacement (rollback rename verifies restored hash).
- **Test AN:** Journal Path Tampering (re-derives paths from manifest; ignores untrusted journal paths).

**Implementation Steps:**
- [ ] Create `scripts/testControlledDocs.ts` with explicit test cases for Tests A through AN.
- [ ] Add `"test:controlled-docs": "tsx scripts/testControlledDocs.ts"` to `package.json`.
- [ ] Run test suite: `npm run test:controlled-docs` (verify all 40 tests pass with exit code 0).
- [ ] Commit changes: `test(docs): add comprehensive boundary and security regression suite`.

---

### Task 13 — Regression & Human Verification Preparation

**Description:**
Execute the full repository regression suite, verify zero lint errors and zero WBS drift, and prepare a structured checklist for human browser verification.

**Files:**
- Test / Verify: `npm run lint`, `npm run wbs:check`, `npm run qa`, `npm run test:controlled-docs`, `npm run test:complete`
- Create: `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md`

**Implementation Steps:**
- [ ] Run `npm run lint` and verify zero TypeScript errors.
- [ ] Run `npm run wbs:check` and verify zero WBS drift.
- [ ] Run `npm run qa` and verify all 11 criteria pass.
- [ ] Run `npm run test:controlled-docs` and verify all 40 tests pass.
- [ ] Run `npm run test:complete` and verify complete regression pass.
- [ ] Create verification checklist in `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md` detailing browser verification steps:
  - Document catalog navigation & kind filtering.
  - Integrity hash badges (MATCH / CHANGED / UNPINNED).
  - Read-only protection on `MASTER_WBS.yaml` and `MASTER_WBS.md`.
  - Sequential controlled editing flow for `PROJECT_STATE.md`.
  - Stale base hash conflict rejection in UI.
  - Project switching draft isolation.
  - Dynamic Projections preservation and Gate 7 check.
- [ ] Commit changes: `docs(dmk-195): add verification checklist and automated test evidence`.

---

### Task 14 — Transition to VERIFICATION

**Description:**
Following successful automated regression, transition DMK-195 status in canonical WBS and runtime WorkItem from `IN_PROGRESS` to `VERIFICATION`. Record verification evidence without marking `VERIFIED`.

**Files:**
- Modify: `docs/00_control/MASTER_WBS.yaml`
- Modify: `docs/00_control/MASTER_WBS.md` (via `npm run wbs:render`)
- Runtime: `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items`

**Interfaces:**
- Consumes: Test evidence from Tasks 12 & 13
- Produces: Updated WBS status `VERIFICATION`, updated runtime WorkItem status `VERIFICATION`, chained audit event, preserved Gate 7.

**Implementation Steps:**
- [ ] Edit `docs/00_control/MASTER_WBS.yaml`:
  - Update `DMK-195` status: `IN_PROGRESS` -> `VERIFICATION`.
  - Attach evidence files to `evidence[]`:
    - `docs/superpowers/specs/2026-09-27-dmk-195-controlled-documentation-workspace-design.md`
    - `docs/superpowers/plans/2026-09-28-dmk-195-controlled-documentation-workspace-implementation.md`
    - `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md`
    - `scripts/testControlledDocs.ts`
- [ ] Run `npm run wbs:render` and verify zero drift with `npm run wbs:check`.
- [ ] Update runtime WorkItem state via `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items`:
  ```json
  {
    "id": "DMK-195",
    "status": "VERIFICATION"
  }
  ```
- [ ] Verify audit ledger records `WORK_ITEM_UPDATED` event and `project.stateVersion` increments exactly once.
- [ ] Confirm `DMK-201` remains `VERIFICATION_PENDING` and Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
- [ ] Do NOT mark `VERIFIED`. Mark only `VERIFICATION` pending human operator verification.
- [ ] Commit changes: `chore(dmk-195): transition DMK-195 to VERIFICATION`.

---

## 5. Absolute Non-Goals

The following activities are strictly prohibited during the implementation of DMK-195:

1. **No DMK-201 Reconciliation:** Do not generate or apply canonical reconciliation proposals.
2. **No Mass WorkItem Repair:** Do not modify historical runtime WorkItems or clear historical drift.
3. **No DMK-196 / DMK-197 Scope Creep:** Do not implement requirement sign-off routing or Approval Inbox.
4. **No Gate 7 Touch:** Release Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
5. **No Release Promotion:** Do not advance package versions or promote release candidates.
6. **No WBS Authority Edits:** `MASTER_WBS.yaml` must not be editable through the Docs workspace.
7. **No Arbitrary Filesystem Browsing:** No browsing of arbitrary host paths outside registered `docs/` items.
8. **No Auto-Registration:** Do not scan `docs/` to discover uncataloged files.
9. **No Editing Pinned References:** Pinned reference documents remain strictly read-only in DMK-195 v1.
10. **No Editing Generated Projections:** Generated projections (`MASTER_WBS.md`) remain strictly read-only.
