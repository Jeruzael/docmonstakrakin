# DMK-195 Controlled Documentation Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved DMK-195 Controlled Documentation Workspace with
registered-only repository document access, secure read-only viewing, controlled
editing of two living documents, raw-byte integrity checks, journaled atomic
document transactions, audit persistence, and project-isolated UI.

**Architecture:**
Use the validated self-bootstrap document registry as the repository-doc authority,
keep filesystem access behind dedicated server/docs modules, classify preview
operations as persistence READ_ONLY before route execution, and coordinate controlled
writes through target-sibling atomic replacement plus durable transaction journals.
The React workspace consumes typed APIs and preserves the existing DocumentsView as
the Dynamic Projections tab.

**Tech Stack:**
TypeScript, Node.js, Express, React 19, Vite, Node fs/path/crypto primitives,
react-markdown, YAML, tsx-based test scripts, and the repository's existing
project-persistence/audit infrastructure.

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
11. **Persistence Mode Classification:** Requests where `req.method === 'POST'` and path matches `/^\/api\/projects\/[^/]+\/docs\/[^/]+\/(diff|validate)$/` are classified as `READ_ONLY` pre-persistence; `/save` and all other modifying methods remain `MUTATING`.
12. **Single State Version Increment:** A successful document save increments `project.stateVersion` exactly once ($N \to N+1$).
13. **Human Governance Confirmation:** Document saves require `requireHuman()` session authorization, non-empty `reason`, and explicit `humanConfirmed === true` payload flag.
14. **Prohibited Client Identity Claims:** Any request supplying client identity fields in the request body (`actor`, `role`, `approver`, `reviewerName`, `reviewerRole`, `authorizedRole`, `identityId`, `actorType`) is rejected immediately with `HTTP 400 Bad Request` (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`). Server identity comes strictly from session state via `requireHuman()`.
15. **Target-Sibling Candidate and Rollback Artifacts:** Candidate and rollback files are placed as hidden sibling files in `path.dirname(targetDocument)` to guarantee same-filesystem `fs.renameSync` atomicity.
16. **Transaction Journal Location:** Transaction journals reside under `.local/document-transactions/<operationId>.json`.
17. **Untrusted Journal Paths:** Journal paths stored on disk are NOT authorities during crash recovery. Target and sibling paths are re-derived strictly from `documentId` and the trusted bootstrap manifest registry.
18. **Safe Markdown Rendering:** Markdown is rendered using `react-markdown` with raw HTML interpretation disabled. No `dangerouslySetInnerHTML` or homemade HTML sanitizers.
19. **Preserved Dynamic Projections:** Existing `DocumentsView.tsx` functionality remains available under Tab 2 ("Dynamic Projections"). Gate 7 behavior and portable package export remain untouched.
20. **Governance Boundaries:** DMK-201 remains untouched (`VERIFICATION_PENDING`). Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`. No reconciliation or recovery applied.

---

## 2. Implementation Review Focus

The implementation and test suites must explicitly address the following failure modes and safety invariants:

| Focus Area | Architecture Requirement | Concrete Risk | Owning Task & Test |
| :--- | :--- | :--- | :--- |
| **1. Pre-Persistence Method & Path Classification** | Middleware checks both `req.method === 'POST'` and `${req.baseUrl}${req.path}` matching `/diff` or `/validate` before `next()`. Non-POST methods (e.g. PATCH/PUT/DELETE) remain `MUTATING`. | Mounted Express routers strip mount prefixes from `req.path`. If tested against `req.path` alone or without method check, read-only requests acquire writer locks and rewrite state snapshots, or non-POST requests bypass persistence. | **Task 2**: `testProjectPersistenceClassifier.ts` (Test AI, Test U, Test V). |
| **2. Cross-Domain Rollback** | Injected snapshot persistence failure triggers `projectPersistenceHooks.onRollback` to restore document from sibling `.rollback` file. | Document is replaced on disk, but `writeProjectSnapshotAtomic` fails. Without a rollback hook, the document is mutated on disk while the audit ledger and `stateVersion` remain unrecorded. | **Task 6 & Task 8**: `testControlledDocsTransaction.ts`, `testControlledDocsApi.ts` (Test Y). |
| **3. Post-Commit Cleanup Failure Semantics** | Once `writeProjectSnapshotAtomic` succeeds, the project transaction is durably committed. If `onCommit` cleanup fails, do NOT rollback or restore ProjectStore. Report `COMMITTED_CLEANUP_PENDING` and let recovery finish cleanup. | Erroneously rolling back after snapshot persistence succeeds creates state divergence where snapshot has audit event and incremented `stateVersion` while document is reverted. | **Task 2 & Task 6**: `testProjectPersistenceClassifier.ts`, `testControlledDocsTransaction.ts`. |
| **4. Rollback Failure Semantics** | If project persistence fails and `onRollback` cannot restore the exact previous document hash, fail closed with `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED`. Retain all artifacts. | Silently swallowing rollback failures leaves an altered document without audit or leaves missing artifacts for recovery. | **Task 6**: `testControlledDocsTransaction.ts`. |
| **5. Crash Recovery Path Security** | Startup recovery reads journal, re-derives filesystem paths strictly from manifest registry by `documentId`, and ignores untrusted paths inside the journal JSON. | Server crashes after `fs.renameSync` (phase `DOCUMENT_REPLACED`) before snapshot commit. If journal paths are trusted, an attacker could point recovery to overwrite arbitrary system files. | **Task 7**: `testControlledDocsRecovery.ts` (Test Z, Test AN). |
| **6. Symlink Target Protection** | If a registered editable target itself is a symbolic link, writing must FAIL CLOSED (`assertEditableTargetNotSymlink`). | An attacker replaces `docs/00_control/PROJECT_STATE.md` with a symlink targeting `/etc/shadow` or `.env`. Controlled writes through symlinks must be strictly prohibited. | **Task 4**: `testControlledDocsPersistence.ts` (Symlink Write Rejection). |
| **7. Byte-Level EOL Preservation & Candidate Hash Ownership** | Raw-byte hashing; detect LF/CRLF; candidate hash computed over encoded bytes (`encodeDocumentBytes(candidateContent, eol)`); reject mixed EOL. | Git on Windows or editors convert LF to CRLF, altering raw-byte SHA-256 and triggering spurious integrity drift or corrupting LF-only repositories. Hashing unencoded JS strings produces wrong hashes for CRLF documents. | **Task 4, 5, 8**: `testControlledDocsPersistence.ts`, `testControlledDocsValidator.ts`, `testControlledDocsApi.ts` (Test AF, Test AG, Test AH, Raw-Byte Diff Hash Tests). |

---

## 3. Commit Strategy

Implementation will proceed via small, focused commits corresponding to each task or tightly coupled pair:

1. `chore(dmk-195): transition WBS and runtime to IN_PROGRESS for dogfooding` (Task 1)
2. `feat(persistence): add pre-persistence classifier and lifecycle hooks` (Task 2)
3. `feat(docs): add controlled docs registry and domain types` (Task 3)
4. `feat(docs): add safe document filesystem primitives and EOL handling` (Task 4)
5. `feat(docs): add document validation and non-mutating line diff` (Task 5)
6. `feat(docs): implement journaled atomic document transaction primitives` (Task 6)
7. `feat(docs): implement startup transaction recovery and path derivation` (Task 7)
8. `feat(docs): add controlled docs REST API, store orchestration, and identity filtering` (Task 8)
9. `feat(ui): add controlled docs frontend client, types, and session display` (Task 9)
10. `feat(ui): implement controlled documentation workspace UI and lockfile update` (Task 10 & 11)
11. `test(docs): add comprehensive boundary and security regression suite` (Task 12)
12. `docs(dmk-195): record automated verification evidence, checklist, and transition to VERIFICATION` (Task 13 & 14)

---

## 4. Task Decomposition

### Task 1 — Begin Controlled Dogfooding

**Description:**
Following human approval of this implementation plan, record the initial state baseline freshly from runtime and repository state, transition DMK-195 from `BACKLOG` to `IN_PROGRESS` in the canonical WBS, synchronize generated markdown, and update runtime WorkItem state via the canonical HTTP API.

**Files:**
- Modify: `docs/00_control/MASTER_WBS.yaml`
- Modify: `docs/00_control/MASTER_WBS.md` (via `npm run wbs:render`)

**Interfaces:**
- Consumes: Canonical WBS `docs/00_control/MASTER_WBS.yaml`, runtime API `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items`
- Produces: Updated WBS status `IN_PROGRESS`, updated runtime WorkItem status `IN_PROGRESS`, single `WORK_ITEM_UPDATED` audit event, incremented `stateVersion` ($N \to N+1$).

**Implementation Steps:**
- [ ] Freshly capture baseline state before mutations:
  - Read runtime DMK-195 status: expect `PROPOSED`
  - Read WBS DMK-195 status: expect `BACKLOG`
  - Read project `stateVersion` = $N$
  - Read audit event count = $A$
  - Read `.local/project-state.json` SHA-256 digest = $H$
  - Read DMK-201 status: expect `VERIFICATION_PENDING`
  - If any expected statuses differ unexpectedly: **STOP and review**.
- [ ] Edit `docs/00_control/MASTER_WBS.yaml`: change DMK-195 `status` from `BACKLOG` to `IN_PROGRESS`.
- [ ] Run `npm run wbs:render` to regenerate `docs/00_control/MASTER_WBS.md`.
- [ ] Run `npm run wbs:check` to verify zero WBS drift.
- [ ] Update runtime WorkItem state via `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items` with payload:
  ```json
  {
    "itemId": "DMK-195",
    "status": "IN_PROGRESS"
  }
  ```
- [ ] Verify post-transition state:
  - Audit event count equals $A + 1$, containing exactly one new `WORK_ITEM_UPDATED` event for `DMK-195`.
  - Project `stateVersion` equals $N + 1$.
  - Runtime WorkItem status for `DMK-195` is `IN_PROGRESS`.
  - DMK-201 remains `VERIFICATION_PENDING` and other historical WorkItems remain untouched.
  - Prior runtime snapshot hash $H$ is now historical/stale as expected from this audited mutation. Do NOT run DMK-201 reconciliation.
- [ ] Commit changes: `chore(dmk-195): transition WBS and runtime to IN_PROGRESS for dogfooding`.

---

### Task 2 — Persistence Middleware Extension

**Description:**
Extend `server/projectPersistence.ts` to support pre-persistence request classification using the fully qualified routed path `${req.baseUrl}${req.path}` and HTTP method check. Add synchronous lifecycle hooks (`projectPersistenceHooks = { onCommit, onRollback }`) and define post-commit cleanup failure semantics.

**Files:**
- Modify: `server/projectPersistence.ts`
- Create / Test: `scripts/testProjectPersistenceClassifier.ts`

**Interfaces:**
- Consumes: Express `req`, `res`, `next`
- Produces:
  ```ts
  export type ProjectPersistenceMode = 'READ_ONLY' | 'MUTATING';
  export function classifyProjectRequestMode(req: express.Request): ProjectPersistenceMode;
  ```
  `res.locals` extensions:
  ```ts
  res.locals.projectPersistenceMode?: ProjectPersistenceMode;
  res.locals.projectPersistenceHooks?: {
    onCommit?: () => void;
    onRollback?: (error: unknown) => void;
  };
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testProjectPersistenceClassifier.ts` asserting:
  - `POST /api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff` classifies as `READ_ONLY`.
  - `POST /api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate` classifies as `READ_ONLY`.
  - `POST /api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save` classifies as `MUTATING`.
  - `PATCH /diff`, `PUT /validate`, `DELETE /diff` classify as `MUTATING`.
  - `READ_ONLY` mode does not acquire writer lock, clone state, or call `writeProjectSnapshotAtomic` (Test U, Test V).
  - Injected persistence failure triggers `projectPersistenceHooks.onRollback` (Test Y).
  - Post-commit cleanup failure: if `onCommit` fails after `writeProjectSnapshotAtomic` succeeds, the project transaction remains COMMITTED and `onRollback` is NOT called.
- [ ] Run failing test and verify failure: `npx tsx scripts/testProjectPersistenceClassifier.ts`.
- [ ] Implement `classifyProjectRequestMode(req)` in `server/projectPersistence.ts`:
  ```ts
  export function classifyProjectRequestMode(req: express.Request): ProjectPersistenceMode {
    const routedPath = `${req.baseUrl}${req.path}`;
    if (
      req.method === 'POST' &&
      /^\/api\/projects\/[^/]+\/docs\/[^/]+\/(diff|validate)$/.test(routedPath)
    ) {
      return 'READ_ONLY';
    }
    return 'MUTATING';
  }
  ```
- [ ] Update `installProjectPersistence` to check `classifyProjectRequestMode(req)`. If `READ_ONLY`, immediately call `next()` without setting `transactionInFlight`, cloning state, or attaching snapshot commit interceptors.
- [ ] Add execution of `res.locals.projectPersistenceHooks?.onCommit()` after successful `writeProjectSnapshotAtomic`, catching and logging any cleanup error without triggering rollback.
- [ ] Add execution of `res.locals.projectPersistenceHooks?.onRollback(error)` in persistence failure catch block.
- [ ] Run focused test: `npx tsx scripts/testProjectPersistenceClassifier.ts` (PASS).
- [ ] Commit changes: `feat(persistence): add pre-persistence classifier and lifecycle hooks`.

---

### Task 3 — Controlled Document Registry & Types

**Description:**
Create `server/docs/controlledDocsRegistry.ts` loading and validating `bootstrap/docmonstakrakin.self-bootstrap.json` as the sole authoritative repository document registry. Import existing types from `src/data/selfBootstrapContract.ts`, add DMK-195-specific derived types, make registry loading accept `workspaceRoot` for testing, and restore the `MISSING` integrity status with `currentSha256: string | null`.

**Files:**
- Create: `server/docs/controlledDocsRegistry.ts`
- Modify: `src/types.ts`
- Create / Test: `scripts/testControlledDocsRegistry.ts`

**Interfaces:**
- Consumes: `ControlledDocumentKind`, `ControlledDocumentAuthority`, `ControlledDocumentReference` from `src/data/selfBootstrapContract.ts`
- Produces:
  ```ts
  export type ControlledDocumentEditability = 'READ_ONLY' | 'CONTROLLED_EDIT';
  export type ControlledDocumentFileType = 'MARKDOWN' | 'YAML' | 'JSON' | 'OTHER';
  export type DocumentIntegrityStatus = 'MATCH' | 'CHANGED' | 'UNPINNED' | 'MISSING';

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

  export function getControlledDocsRegistry(projectId: string, workspaceRoot?: string): ControlledDocumentRecord[];
  export function findControlledDoc(projectId: string, documentId: string, workspaceRoot?: string): ControlledDocumentRecord | null;
  export function isControlledEditAllowed(projectId: string, documentId: string, workspaceRoot?: string): boolean;
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
  - Registry functions accept custom `workspaceRoot` and validate the manifest; malformed manifest fails closed.
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsRegistry.ts`.
- [ ] Implement `server/docs/controlledDocsRegistry.ts`:
  - Validate and load manifest on demand for specified `workspaceRoot` (defaulting to `process.cwd()`).
  - Derive `editability`: `CONTROLLED_EDIT` ONLY for `DOC-CTRL-002` and `DOC-CTRL-006` in `PRJ-DOCMONSTAKRAKIN`.
- [ ] Add derived types to `src/types.ts` without duplicating canonical bootstrap types.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsRegistry.ts` (PASS).
- [ ] Commit changes: `feat(docs): add controlled docs registry and domain types`.

---

### Task 4 — Safe Document Filesystem Primitives

**Description:**
Create `server/docs/controlledDocsPersistence.ts` to implement path boundary clamping within `docs/`, raw-byte SHA-256 calculation, line ending detection/preservation, symlink write rejection, missing-document detection with discriminated union read results, and atomic same-directory replacement primitives.

**Files:**
- Create: `server/docs/controlledDocsPersistence.ts`
- Create / Test: `scripts/testControlledDocsPersistence.ts`

**Interfaces:**
- Consumes: Node.js `fs`, `path`, `crypto`, `ControlledDocumentRecord`, `DocumentIntegrityStatus`
- Produces:
  ```ts
  export type DetectedEol = 'LF' | 'CRLF' | 'MIXED' | 'NONE';

  export type DocumentFileReadResult =
    | {
        exists: true;
        rawBytes: Buffer;
        rawSha256: string;
        content: string;
        eol: DetectedEol;
        sizeBytes: number;
        integrityStatus: 'MATCH' | 'CHANGED' | 'UNPINNED';
      }
    | {
        exists: false;
        rawBytes: null;
        rawSha256: null;
        content: null;
        eol: 'NONE';
        sizeBytes: 0;
        integrityStatus: 'MISSING';
      };

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
  - Review Focus 6: Symlink write rejection fails closed when target is a symlink (`assertEditableTargetNotSymlink`).
  - Missing registered file returns `exists: false`, `rawBytes: null`, `rawSha256: null`, `content: null`, `eol: 'NONE'`, `sizeBytes: 0`, `integrityStatus: 'MISSING'`.
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
  - Implement missing file check: if `!fs.existsSync(diskPath)`, return discriminated union with `exists: false`, `integrityStatus: 'MISSING'`, null bytes/hash/content.
  - Implement `detectLineEndings`: scan `\r\n` vs `\n`. If both present, return `'MIXED'`.
  - Implement `encodeDocumentBytes`: normalize newlines to target EOL and encode as UTF-8 buffer.
  - Implement atomic write with `fs.openSync`, `fs.writeSync`, `fs.fdatasyncSync`, `fs.closeSync`.
  - Implement `fs.renameSync` for forward replacement and rollback.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsPersistence.ts` (PASS).
- [ ] Commit changes: `feat(docs): add safe document filesystem primitives and EOL handling`.

---

### Task 5 — Validation & Line Diff

**Description:**
Create `server/docs/controlledDocsValidator.ts` to implement universal content validation (UTF-8, size limits, no null bytes), document-specific structural validation with exact canonical title check for `PROJECT_STATE.md`, and deterministic line diffing where `candidateSha256` is provided by encoded bytes.

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
    oldHash: string;
    candidateHash: string;
    isStale: boolean;
    hasChanges: boolean;
    additions: number;
    deletions: number;
    changedLines: number;
    unifiedDiff: string;
  }

  export function validateUniversalConstraints(rawBytes: Buffer, content: string): DocumentValidationResult;
  export function validateDocumentContent(docRecord: ControlledDocumentRecord, rawBytes: Buffer, candidateContent: string): DocumentValidationResult;
  export function computeDocumentDiff(params: {
    originalContent: string;
    candidateContent: string;
    baseSha256: string;
    currentSha256: string;
    candidateSha256: string;
  }): DocumentDiffResult;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsValidator.ts` asserting:
  - Rejects payloads exceeding 5MB or containing null bytes `\0`.
  - `DOC-CTRL-002` (`PROJECT_STATE.md`) requires exact title `# docmonstakrakin current project state` and sections referencing `Current governance and task status`, `DMK-201`, `Gate 7`, `Live reconciliation`, and `Release status` (Test N).
  - `DOC-CTRL-006` (`TRACEABILITY_MATRIX.md`) validates Markdown table syntax `| ... |`.
  - Rejects edits to `DOC-CTRL-004` (Test J) and `DOC-CTRL-003` (Test K).
  - `computeDocumentDiff` computes logical additions, deletions, changed lines, unified diff, and stale check (`baseSha256 !== currentSha256`) without deciding byte encoding (Test M).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsValidator.ts`.
- [ ] Implement `server/docs/controlledDocsValidator.ts`:
  - Add UTF-8 decoding and null byte checks.
  - Implement structural regex checks for `PROJECT_STATE.md` with exact canonical title and non-brittle heading depth.
  - Implement table syntax validator for `TRACEABILITY_MATRIX.md`.
  - Implement diff engine with stale detection using provided `currentSha256` and `candidateSha256`.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsValidator.ts` (PASS).
- [ ] Commit changes: `feat(docs): add document validation and non-mutating line diff`.

---

### Task 6 — Cross-Domain Document Transaction Primitives

**Description:**
Create `server/docs/controlledDocsTransaction.ts` to manage filesystem transaction artifacts, target-sibling candidate/rollback files, and durable journal logging conforming strictly to the approved specification. (ProjectStore mutation and audit event generation are owned by Task 8 orchestration).

**Files:**
- Create: `server/docs/controlledDocsTransaction.ts`
- Create / Test: `scripts/testControlledDocsTransaction.ts`

**Interfaces:**
- Consumes: `ControlledDocumentRecord`, `controlledDocsPersistence.ts`
- Produces:
  ```ts
  export type DocumentTransactionPhase =
    | 'PREPARED'
    | 'DOCUMENT_REPLACED'
    | 'COMMITTED'
    | 'COMMITTED_CLEANUP_PENDING';

  export interface DocumentTransactionJournal {
    operationId: string;
    projectId: string;
    documentId: string;
    targetPath: string;
    candidateArtifactPath: string;
    rollbackArtifactPath: string;
    previousSha256: string;
    candidateSha256: string;
    projectStateBeforeDigest: string | null;
    stateVersionBefore: number;
    stateVersionExpectedAfter: number;
    auditEventId: string;
    phase: DocumentTransactionPhase;
    createdAt: string;
    updatedAt: string;
  }

  export interface DocumentTransactionCoordinator {
    operationId: string;
    candidatePath: string;
    rollbackPath: string;
    journalPath: string;
    executeReplacement: () => { newSha256: string; candidateBytes: Buffer };
    handleCommitSuccess: () => void;
    handleRollback: (error: unknown) => void;
  }

  export function prepareDocumentTransaction(params: {
    projectId: string;
    documentId: string;
    docRecord: ControlledDocumentRecord;
    candidateContent: string;
    baseSha256: string;
    projectStateBeforeDigest: string | null;
    stateVersionBefore: number;
    auditEventId: string;
    workspaceRoot?: string;
  }): DocumentTransactionCoordinator;
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsTransaction.ts` asserting:
  - Prepare sequence: verifies base hash, writes rollback sibling, fsyncs rollback, writes candidate sibling, fsyncs candidate, writes PREPARED journal with all spec fields, fsyncs journal (Test AJ, Test AK).
  - Stale `baseSha256` triggers immediate rejection with `DOCUMENT_STALE` without disk mutations (Test O).
  - `executeReplacement()` performs atomic rename and advances journal to `DOCUMENT_REPLACED` (Test P, Test AL).
  - Rollback failure semantics: if rollback rename fails or restored hash does not equal `previousSha256`, throws `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED` and preserves all artifacts.
  - Post-commit cleanup failure semantics: if `handleCommitSuccess()` fails to unlink artifacts, advances journal to `COMMITTED_CLEANUP_PENDING` without throwing rollback errors.
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsTransaction.ts`.
- [ ] Implement `server/docs/controlledDocsTransaction.ts` strictly following the approved 14-step prepare and execution sequence.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsTransaction.ts` (PASS).
- [ ] Commit changes: `feat(docs): implement journaled atomic document transaction primitives`.

---

### Task 7 — Startup Transaction Recovery

**Description:**
Create `server/docs/controlledDocsRecovery.ts` and integrate it into server initialization in `server.ts`. Re-derive authoritative paths from manifest registry by `documentId`, ignore untrusted journal paths, safely resolve orphaned journals, and handle `COMMITTED_CLEANUP_PENDING`.

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
  - Re-derives paths from manifest by `documentId`; ignores untrusted paths inside journal JSON (Test AN).
  - Phase `DOCUMENT_REPLACED` without committed audit event restores original document from rollback sibling file (Test Z).
  - Phase `COMMITTED` or `COMMITTED_CLEANUP_PENDING` safely cleans leftover files (Test AA).
  - Corrupted or unparseable journal locks transactions with `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED` (Test AB).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsRecovery.ts`.
- [ ] Implement `server/docs/controlledDocsRecovery.ts`:
  - Scan journal directory. Read each journal JSON.
  - Look up `documentId` in `getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', workspaceRoot)`. If not found, fail closed (lock).
  - Re-derive expected disk path and sibling paths.
  - Reconcile against `.local/project-state.json` audit events.
  - Execute recovery rollback or cleanup.
- [ ] Wire `recoverDocumentTransactions()` into `server.ts` startup sequence before Express route handlers.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsRecovery.ts` (PASS).
- [ ] Commit changes: `feat(docs): implement startup transaction recovery and path derivation`.

---

### Task 8 — Controlled Docs API & Store Orchestration

**Description:**
Create `server/docs/controlledDocsRouter.ts` providing REST endpoints for document catalog listing, reading, diffing, validating, and saving. Enforce strict rejection of client identity claims in request body, authenticate via `requireHuman()`, orchestrate ProjectStore audit event and `stateVersion` updates, compute encoded candidate raw-byte hashes for `/diff`, return `DocumentSaveResponse`, and attach `projectPersistenceHooks`.

**Files:**
- Create: `server/docs/controlledDocsRouter.ts`
- Modify: `server.ts`
- Create / Test: `scripts/testControlledDocsApi.ts`

**Interfaces:**
- Consumes: Express `Router`, `ProjectStore`, `requireHuman` from `server/proposals/identity.ts`, `encodeDocumentBytes` from `controlledDocsPersistence.ts`
- Produces:
  ```ts
  export interface DocumentSaveResponse {
    success: true;
    documentId: string;
    path: string;
    previousSha256: string;
    newSha256: string;
    stateVersion: number;
    auditEventId: string;
    timestamp: string;
  }
  ```
  Endpoints:
  - `GET /api/projects/:id/docs`
  - `GET /api/projects/:id/docs/:documentId` (returns 410 if status is MISSING)
  - `POST /api/projects/:id/docs/:documentId/diff`
  - `POST /api/projects/:id/docs/:documentId/validate`
  - `POST /api/projects/:id/docs/:documentId/save`

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsApi.ts` asserting:
  - `GET /api/projects/PRJ-DOCMONSTAKRAKIN/docs` returns 28 items.
  - Missing registered file returns 410 on GET content.
  - `/diff` flow:
    1. Resolves registered document.
    2. Reads current document and its EOL mode via `readDocumentDisk()`.
    3. Rejects unsupported mixed EOL for editable candidate operations.
    4. Encodes candidate with `encodeDocumentBytes(candidateContent, currentDocument.eol)`.
    5. Computes SHA-256 over candidate bytes.
    6. Passes `candidateSha256` into `computeDocumentDiff()`.
    7. Asserts `candidateHash === SHA256(the exact bytes /save would write)`.
  - `POST .../save` rejects client identity claims in request body (`actor`, `role`, `approver`, `reviewerName`, `reviewerRole`, `authorizedRole`, `identityId`, `actorType`) with `HTTP 400 Bad Request` (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`) (Test X).
  - `POST .../save` requires human session authentication (returns 401/403 if unauthorized).
  - `POST .../save` requires non-empty `reason` and `humanConfirmed === true` (returns 422 if invalid).
  - Successful save returns `DocumentSaveResponse` with `newSha256`, `stateVersion`, and `auditEventId`.
  - Successful save appends `DOCUMENT_UPDATED` audit event (Test Q).
  - Successful save increments `project.stateVersion` exactly once ($N \to N+1$) (Test W).
  - Full save flow persists document, appends audit, and survives server restart (Test L, Test R).
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsApi.ts`.
- [ ] Implement `server/docs/controlledDocsRouter.ts`:
  - Body claim check: scan `req.body` for prohibited fields; return `res.status(400).json({ error: 'CLIENT_IDENTITY_CLAIMS_PROHIBITED' })`.
  - Wire `/diff` route orchestration with exact raw-byte candidate encoding and diff computation.
  - Wire `/validate` route handler.
  - Wire `/save` handler:
    1. Authenticate with `reviewerAuth.requireHuman(req, res)`.
    2. Validate `reason` and `humanConfirmed === true`.
    3. Generate audit event ID and prepare transaction coordinator.
    4. Execute replacement.
    5. Append `DOCUMENT_UPDATED` audit event to `store` using authenticated reviewer identity.
    6. Increment `project.stateVersion`.
    7. Set `res.locals.projectPersistenceHooks = { onCommit: coordinator.handleCommitSuccess, onRollback: coordinator.handleRollback }`.
    8. Return `DocumentSaveResponse`.
- [ ] Mount router in `server.ts` via `app.use('/api/projects', createControlledDocsRouter(store, reviewerAuth.requireHuman))`.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsApi.ts` (PASS).
- [ ] Commit changes: `feat(docs): add controlled docs REST API, store orchestration, and identity filtering`.

---

### Task 9 — Frontend Document Types, Data Access & Session Display

**Description:**
Create `src/data/controlledDocsClient.ts` to provide typed API helpers with request sequencing, timeouts, and `AbortController` cancellation. Implement typed governance session reader for read-only reviewer identity display in save modals, and align `requestSave` with `DocumentSaveResponse`.

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
    integrityStatus: DocumentIntegrityStatus; // MATCH | CHANGED | UNPINNED | MISSING
    sha256Digest?: string;
    currentSha256: string | null;
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
    oldHash: string;
    candidateHash: string;
    isStale: boolean;
    hasChanges: boolean;
    additions: number;
    deletions: number;
    changedLines: number;
    unifiedDiff: string;
  }

  export interface DocumentValidationResponse {
    documentId: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }

  export interface DocumentSaveInput {
    projectId: string;
    documentId: string;
    candidateContent: string;
    baseSha256: string;
    reason: string;
    humanConfirmed: boolean;
  }

  export interface DocumentSaveResponse {
    success: true;
    documentId: string;
    path: string;
    previousSha256: string;
    newSha256: string;
    stateVersion: number;
    auditEventId: string;
    timestamp: string;
  }

  export interface ReviewerSessionInfo {
    name: string;
    roles: string[];
  }

  export function createControlledDocsLoader(request?: typeof fetch): {
    loadDocumentList: (projectId: string) => Promise<ControlledDocumentSummary[]>;
    loadDocumentContent: (projectId: string, documentId: string) => Promise<DocumentContentResponse>;
    requestDiff: (projectId: string, documentId: string, candidateContent: string, baseSha256: string) => Promise<DocumentDiffResponse>;
    requestValidate: (projectId: string, documentId: string, candidateContent: string) => Promise<DocumentValidationResponse>;
    requestSave: (input: DocumentSaveInput) => Promise<DocumentSaveResponse>;
    loadGovernanceSession: () => Promise<ReviewerSessionInfo | null>;
    invalidate: () => void;
  };
  ```

**Implementation Steps:**
- [ ] Write failing test in `scripts/testControlledDocsClient.ts` asserting:
  - Sequence tracking ignores out-of-order responses.
  - `invalidate()` aborts in-flight requests.
  - `requestDiff` passes `baseSha256` and receives stale indicators.
  - `requestSave` sends required input fields without identity claims.
  - `requestSave` parses response as `DocumentSaveResponse`.
  - `loadGovernanceSession` fetches and formats reviewer identity.
- [ ] Run failing test and verify failure: `npx tsx scripts/testControlledDocsClient.ts`.
- [ ] Implement `src/data/controlledDocsClient.ts` following `src/data/projectWorkspace.ts` pattern.
- [ ] Run focused test: `npx tsx scripts/testControlledDocsClient.ts` (PASS).
- [ ] Commit changes: `feat(ui): add controlled docs frontend client, types, and session display`.

---

### Task 10 — Repository Documents UI & Lockfile Convention

**Description:**
Install `react-markdown` adhering to the repository's lockfile convention (`package.json`, `package-lock.json`, `bun.lock`). Create `src/components/ControlledDocsView.tsx` implementing the repository document browser, status badges, secure markdown viewer (HTML disabled), the approved six-step controlled editing workflow (`VIEW -> EDIT DRAFT -> PREVIEW DIFF -> VALIDATE -> CONFIRM SAVE -> COORDINATED COMMIT`), and post-save canonical content reloading.

**Files:**
- Create: `src/components/ControlledDocsView.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `bun.lock` (if updated by package manager)
- Create / Test: `scripts/testControlledDocsViewComponent.ts`

**Interfaces:**
- Consumes: `ControlledDocumentSummary`, `controlledDocsClient.ts`, `react-markdown`, `lucide-react`
- Produces: Controlled documentation workspace React component.

**Implementation Steps:**
- [ ] Inspect repository lockfile convention and install `react-markdown` via `npm install react-markdown` (or `npm install --legacy-peer-deps`), cleanly updating `package.json` and `package-lock.json` without unrelated dependency churn.
- [ ] Write component tests in `scripts/testControlledDocsViewComponent.ts` asserting:
  - Renders document catalog grouped by kind with search filter.
  - Renders badges: MATCH (green), CHANGED (amber), UNPINNED (slate), MISSING (red), CONTROLLED_EDIT (blue), READ_ONLY (slate).
  - Embedded HTML `<script>` tags render as inert text without executing (Test AC).
  - Read-only documents show no edit controls.
  - Living documents (`DOC-CTRL-002`, `DOC-CTRL-006`) provide Edit button.
  - Editor workflow enforces the approved six-step sequential progression:
    `VIEW -> EDIT DRAFT -> PREVIEW DIFF -> VALIDATE -> CONFIRM SAVE -> COORDINATED COMMIT`.
  - Save modal displays authenticated reviewer name and roles in read-only format from session state; never editable.
  - UI Post-Save Lifecycle: after `requestSave` succeeds:
    1. Retain/display save result metadata (`newSha256`, `stateVersion`, `auditEventId`).
    2. Reload canonical document content using `loadDocumentContent()`.
    3. Refresh document catalog and integrity status.
    4. Replace draft and `baseSha256` with the freshly loaded canonical version.
    5. Clear diff, validation, and confirmation modal state.
- [ ] Implement `src/components/ControlledDocsView.tsx`.
- [ ] Run focused component test: `npx tsx scripts/testControlledDocsViewComponent.ts` (PASS).
- [ ] Commit changes: `feat(ui): implement controlled documentation workspace UI and lockfile update`.

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
Implement the complete test matrix covering Tests A through AN in `scripts/testControlledDocs.ts` to ensure 100% test coverage of all security boundaries, failure recovery, atomic rollback, raw-byte diff hash semantics, and identity error normalization.

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
- **Test Q:** Audit Event Correctness (appends `DOCUMENT_UPDATED` maintaining hash chain; owned by Task 8 API).
- **Test R:** Persistence & Reload (document update survives server restart).
- **Test S:** Project Switching State Reset (clears document selection and draft state).
- **Test T:** UI Smoke & Accessibility (renders cleanly without console errors).
- **Test U:** Diff Preserves Snapshot Bytes & Early Exit (zero state writes, zero locks).
- **Test V:** Validate Preserves Snapshot Bytes & Early Exit (zero state writes, zero locks).
- **Test W:** `stateVersion` Increment (increments exactly once: $N \to N+1$; owned by Task 8 API).
- **Test X:** Client Identity Claims Rejected (body fields rejected with HTTP 400 `CLIENT_IDENTITY_CLAIMS_PROHIBITED`).
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
- **Test AI:** Mounted Path & Method Classification (POST `/diff` and `/validate` are `READ_ONLY`; non-POST and `/save` are `MUTATING`).
- **Test AJ:** Candidate Sibling Placement (candidate in `path.dirname(targetDocument)`).
- **Test AK:** Rollback Sibling Placement (rollback in `path.dirname(targetDocument)`).
- **Test AL:** Forward Same-Directory Replacement (`fs.renameSync` sibling to target).
- **Test AM:** Atomic Rollback Same-Directory Replacement (rollback rename verifies restored hash).
- **Test AN:** Journal Path Tampering (re-derives paths from manifest; ignores untrusted journal paths).
- **Additional Security & Contract Tests:**
  - **Raw-Byte Diff Hash (LF Source):** `candidateHash` equals SHA-256 of final encoded LF bytes.
  - **Raw-Byte Diff Hash (CRLF Source):** `candidateHash` equals SHA-256 of final encoded CRLF bytes.
  - **Diff-to-Save Hash Identity:** `candidateHash` from `/diff` equals `candidateSha256` used by the later save transaction for the same draft.
  - **Encoding Drift Detection:** Changing only newline encoding changes raw-byte hash as expected.
  - **Save Contract & UI Lifecycle:** `requestSave` sends `candidateContent`, `baseSha256`, `reason`, `humanConfirmed` (no identity claims); parses `DocumentSaveResponse`; triggers canonical reload via `loadDocumentContent()`; updates editor base hash to newly loaded hash.
  - **Post-Commit Cleanup Failure:** Snapshot commit succeeds + `onCommit` cleanup fails $\to$ durable state remains committed, no rollback (`COMMITTED_CLEANUP_PENDING`).
  - **Rollback Failure:** Persistence fails + rollback rename fails $\to$ fails closed with `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED`.
  - **Missing Document:** Registered document absent on disk $\to$ reports `integrityStatus: 'MISSING'`, `currentSha256 = null`, GET returns 410.
  - **Symlink Write Rejection:** Editable target is a symlink $\to$ fails closed.

**Implementation Steps:**
- [ ] Create `scripts/testControlledDocs.ts` with explicit test cases for all tests.
- [ ] Add `"test:controlled-docs": "tsx scripts/testControlledDocs.ts"` to `package.json`.
- [ ] Run test suite: `npm run test:controlled-docs` (verify all tests pass with exit code 0).
- [ ] Commit changes: `test(docs): add comprehensive boundary and security regression suite`.

---

### Task 13 — Regression & Verification Evidence Documentation

**Description:**
Execute the full repository regression suite, verify zero lint errors and zero WBS drift, and produce both an automated verification report and a structured human verification checklist.

**Files:**
- Test / Verify: `npm run lint`, `npm run wbs:check`, `npm run qa`, `npm run test:controlled-docs`, `npm run test:complete`
- Create: `docs/07_verification/DMK_195_AUTOMATED_VERIFICATION.md`
- Create: `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md`

**Implementation Steps:**
- [ ] Run `npm run lint` and verify zero TypeScript errors.
- [ ] Run `npm run wbs:check` and verify zero WBS drift.
- [ ] Run `npm run qa` and record actual exit code and criteria passed.
- [ ] Run `npm run test:controlled-docs` and verify all tests pass with exit code 0.
- [ ] Run `npm run test:complete` and record actual exit code and suite counts.
- [ ] Expected verification standard: **exit code 0, zero unexpected failures**.
- [ ] Create `docs/07_verification/DMK_195_AUTOMATED_VERIFICATION.md` recording:
  - Branch, commit SHA, timestamp.
  - Exact command lines executed and exit codes.
  - Controlled docs test output.
  - Lint, WBS, QA, and complete regression results with actual freshly measured counts (no hardcoded historical values).
  - Known pre-existing failures/skips (e.g. historical Stage A regression notes) documented honestly.
- [ ] Create `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md` detailing browser verification steps:
  - Document catalog navigation & kind filtering.
  - Integrity hash badges (MATCH / CHANGED / UNPINNED / MISSING).
  - Read-only protection on `MASTER_WBS.yaml` and `MASTER_WBS.md`.
  - Sequential controlled editing flow for `PROJECT_STATE.md`.
  - Stale base hash conflict rejection in UI.
  - Project switching draft isolation.
  - Dynamic Projections preservation and Gate 7 check.
- [ ] Commit changes: `docs(dmk-195): record automated verification evidence and human checklist`.

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
    - `docs/07_verification/DMK_195_AUTOMATED_VERIFICATION.md`
    - `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md`
    - `scripts/testControlledDocs.ts`
- [ ] Run `npm run wbs:render` and verify zero drift with `npm run wbs:check`.
- [ ] Update runtime WorkItem state via `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items` with payload:
  ```json
  {
    "itemId": "DMK-195",
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
