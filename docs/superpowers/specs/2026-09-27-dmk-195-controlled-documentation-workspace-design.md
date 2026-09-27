# DMK-195 Controlled Documentation Workspace Design

Status:
DRAFT / HUMAN REVIEW REQUIRED

Canonical Work Item:
DMK-195

Canonical Requirement:
REQ-DOC-001

Approved Direction:
Option 1 — Conservative Controlled Editing

---

## 1. Problem

The docmonstakrakin application is designed as a local-first Assurance & Software Security Development Lifecycle (A-SSDLC) control plane. In its current implementation, the in-console documentation UI (`src/components/DocumentsView.tsx`) serves solely as a dynamic projection generator, synthesizing temporary Markdown views (such as PRD, SAD, THREAT, RTM, GOV, and RELEASE) from in-memory state objects.

However, operators and autonomous AI engineering agents currently have no secure, repository-integrated mechanism within the console to browse, inspect, and verify the repository's authoritative, version-controlled documentation residing in the `docs/` hierarchy.

Furthermore, critical living governance documents—specifically `docs/00_control/PROJECT_STATE.md` and `docs/00_control/TRACEABILITY_MATRIX.md`—must frequently be updated during iterative development. Currently, such edits must be performed either through external text editors or ad-hoc file mutations outside the application's security boundary. This out-of-band editing introduces significant operational hazards:
1. **Lack of Cryptographic Hash Verification:** No mechanism detects whether on-disk reference documents match reviewed baseline digests or have suffered unreviewed drift.
2. **Absence of TOCTOU & Concurrency Protection:** Simultaneous edits or concurrent agent sessions can silently overwrite each other's updates without detecting stale base content.
3. **Missing Audit Traceability:** Edits bypass the application's cryptographically chained audit ledger (`server/security/auditImmutability.ts`), breaking the chain of custody.
4. **Risk of Arbitrary Filesystem Traversal:** Naive document viewing or editing features expose the host environment to directory traversal attacks (`../`), symlink escapes, secret store disclosure (`.env`, `.git/credentials`, OS system files), and accidental corruption of canonical planning artifacts (`docs/00_control/MASTER_WBS.yaml`).
5. **Conflation of Projections with Authorities:** Users may inadvertently attempt to edit generated projection files (e.g., `docs/00_control/MASTER_WBS.md`), leading to divergence from the canonical planning authority (`MASTER_WBS.yaml`).

DMK-195 addresses these issues by establishing a dedicated, fail-closed Controlled Documentation Workspace.

---

## 2. Goals

1. **In-Console Browsing & Viewing:** Provide a structured, categorized navigation experience to browse and read all repository-controlled Markdown, YAML, and text documentation strictly confined within the `docs/` tree.
2. **Authority Classification:** Re-use the canonical document model from `bootstrap/docmonstakrakin.self-bootstrap.json` and `src/data/selfBootstrapContract.ts` to explicitly categorize every document as either `REFERENCE` or `GENERATED_PROJECTION`.
3. **Strict Immutability for Projections & Baseline References:** Enforce that all `GENERATED_PROJECTION` documents and all hash-pinned `REFERENCE` documents are strictly read-only.
4. **Controlled, Audited Editing:** Implement a rigorous, multi-step editing workflow (Edit Draft → Preview Diff → Validate → Confirm Save → Stale-Base Verification → Atomic Save → Audit Logging) restricted exclusively to an approved allowlist of living reference documents.
5. **Cryptographic Integrity Verification:** Dynamically hash on-disk documents using SHA-256 and compare against pinned baseline digests, reporting statuses: `MATCH`, `CHANGED`, `UNPINNED`, or `MISSING`.
6. **Optimistic Concurrency (Anti-TOCTOU):** Enforce base-hash binding on every save operation to prevent overwriting intermediate changes.
7. **Atomic Persistence:** Prevent partial-write corruption through atomic write-to-temp and rename persistence patterns.
8. **Chained Audit Trail:** Record every successful document update in the tamper-evident cryptographic audit ledger as a `DOCUMENT_UPDATED` event.
9. **Strict Project Isolation:** Isolate repository document access to `PRJ-DOCMONSTAKRAKIN`. Unrelated projects (such as `PRJ-ATLAS-01` or `PRJ-FINPAY-02`) that lack a repository-controlled document registry must present an explicit empty/unavailable state without leaking host files.
10. **Fail-Closed Path Confinement:** Enforce strict path resolution rules that reject directory traversal, absolute paths, UNC paths, URL-encoded tricks, and symlink escapes outside `docs/`.

---

## 3. Non-goals

DMK-195 explicitly does NOT:
1. **Resolve DMK-201:** Does not perform runtime/WBS state reconciliation, does not change DMK-201 status (`VERIFICATION_PENDING`), and does not apply historical candidate patches.
2. **Apply State Recovery or Reconciliation:** Does not mutate `.local/project-state.json` or alter live WorkItem statuses during this phase.
3. **Provide Arbitrary Filesystem Browsing:** Does not expose a generic file manager, directory browser, or filesystem tree outside the registered documents within `docs/`.
4. **Provide General-Purpose Source Code Editing:** Does not provide code editing or Git workspace management outside the specified allowlist (source code and Git operations remain governed by `RepositoryView`).
5. **Permit Editing of `MASTER_WBS.yaml`:** `MASTER_WBS.yaml` is the canonical planning authority and must never be edited through the Docs UI.
6. **Permit Editing or Ad-Hoc Regeneration of `MASTER_WBS.md`:** `MASTER_WBS.md` is a `GENERATED_PROJECTION` and remains strictly read-only in the Docs UI; regeneration belongs to controlled CLI workflows (`npm run wbs:generate` / `npm run wbs:check`).
7. **Implement DMK-196 Sign-Off UX:** Does not implement the interactive requirement sign-off requesting workflow.
8. **Implement DMK-197 Approval Inbox:** Does not implement the dual-signoff quorum inbox.
9. **Provision Reviewer Accounts:** Does not create or manage cryptographic reviewer keys.
10. **Execute or Touch Gate 7:** Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
11. **Promote Release Status:** Release status remains `v0.1.0-rc1` (Release Candidate).
12. **Expose Secrets or Credentials:** Never accesses, displays, or modifies files in `.secrets/`, `.test_secret_store/`, `.env*`, or private keys.

---

## 4. Existing Repository Model

The repository currently provides several foundational building blocks that DMK-195 will reuse rather than duplicate:

1. **Self-Bootstrap Manifest Registry (`bootstrap/docmonstakrakin.self-bootstrap.json`):**
   Contains a comprehensive registry of 28 controlled documents under the `documents` array. Each entry defines:
   - `id`: Stable identifier (e.g., `DOC-CTRL-001`, `DOC-PROD-001`, `DOC-ARC-001`).
   - `path`: Workspace-relative path (e.g., `docs/00_control/PROJECT_CHARTER.md`).
   - `kind`: Category enum (`CONTROL`, `PRODUCT`, `REQUIREMENTS`, `ARCHITECTURE`, `SECURITY`, `VERIFICATION`, `OPERATIONS`).
   - `authority`: Governance authority enum (`REFERENCE`, `GENERATED_PROJECTION`).
   - `title`: Human-readable document title.
   - `sha256Digest`: Optional 64-character hex SHA-256 digest pinning the baseline artifact.
2. **Strongly Typed Schema Contract (`src/data/selfBootstrapContract.ts`):**
   Defines the TypeScript types `ControlledDocumentReference`, `ControlledDocumentKind`, and `ControlledDocumentAuthority`.
3. **Path Boundary & Traversal Defense (`server/security/pathBoundary.ts`):**
   Implements `sanitizeAndResolvePath` and `assertWorkspacePath` enforcing `SEC-CTRL-011` / OWASP ASVS V12.3, checking for null-byte injections, double-URL encoding, workspace confinement, and deny-precedence rules.
4. **Cryptographic Audit Hash Chaining (`server/security/auditImmutability.ts`):**
   Implements `computeAuditEventHash`, `createChainedAuditEvent`, and `verifyAuditLedgerChain` enforcing `SEC-CTRL-013` / NIST SSDF PO.1.3 tamper-evident audit chaining.
5. **Atomic Persistence Pattern (`server/projectPersistence.ts`):**
   Demonstrates write-to-temporary-file in the same directory followed by atomic `fs.renameSync`, with cleanup on failure and optional expected-digest checks.
6. **In-Memory Store (`server/projectStore.ts`):**
   Defines `store.documents: Record<string, ControlledDocumentReference[]>`, ready to hold per-project document reference lists.
7. **Frontend View Architecture (`src/App.tsx`, `src/components/Sidebar.tsx`):**
   Establishes clean separation of top-level views (`currentView: NavView`), coordinated by `App.tsx` with project-switching loaders (`src/data/projectWorkspace.ts`).

---

## 5. Authority vs Editability

To avoid ambiguity and prevent security bypasses, DMK-195 strictly distinguishes between **Authority** (what the document represents in the governance model) and **Editability** (what operations the Docs workspace permits):

### Authority (Existing Model)
Reuses `ControlledDocumentAuthority` from `src/data/selfBootstrapContract.ts`:
- **`REFERENCE`:** The document is a primary source of truth, standard, charter, architecture specification, or living operational record.
- **`GENERATED_PROJECTION`:** The document is mechanically derived or projected from another canonical authority (e.g., `MASTER_WBS.md` projected from `MASTER_WBS.yaml`).

### Editability (New Orthogonal Concept)
Defines the client/server permission boundary:
- **`READ_ONLY`:** Document content cannot be modified through the Docs workspace under any circumstances.
- **`CONTROLLED_EDIT`:** Document content may be updated via the multi-step Edit Draft → Preview Diff → Validate → Confirm Save workflow.

### Fundamental Principle
`REFERENCE` does NOT imply `CONTROLLED_EDIT`. Under Option 1 (Conservative Controlled Editing):
- All `GENERATED_PROJECTION` documents are strictly `READ_ONLY`.
- All hash-pinned `REFERENCE` documents are strictly `READ_ONLY` in DMK-195 v1.
- Living unpinned `REFERENCE` documents are `READ_ONLY` by default.
- ONLY living unpinned `REFERENCE` documents that are explicitly allowlisted qualify for `CONTROLLED_EDIT`.

### Approved Allowlist Matrix
| Document ID | Path | Authority | Pinned? | Editability | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DOC-CTRL-001` | `docs/00_control/PROJECT_CHARTER.md` | `REFERENCE` | Yes | `READ_ONLY` | Foundational charter; pinned baseline. |
| `DOC-CTRL-002` | `docs/00_control/PROJECT_STATE.md` | `REFERENCE` | No | `CONTROLLED_EDIT` | Living execution state; explicitly allowlisted. |
| `DOC-CTRL-003` | `docs/00_control/MASTER_WBS.yaml` | `REFERENCE` | No | `READ_ONLY` | Canonical planning authority; excluded from Docs UI edits. |
| `DOC-CTRL-004` | `docs/00_control/MASTER_WBS.md` | `GENERATED_PROJECTION` | No | `READ_ONLY` | Projection of WBS; must be updated via generator CLI only. |
| `DOC-CTRL-005` | `docs/00_control/ROADMAP.md` | `REFERENCE` | Yes | `READ_ONLY` | Pinned roadmap baseline. |
| `DOC-CTRL-006` | `docs/00_control/TRACEABILITY_MATRIX.md` | `REFERENCE` | No | `CONTROLLED_EDIT` | Living traceability record; explicitly allowlisted. |
| `DOC-CTRL-007` | `docs/00_control/SELF_BOOTSTRAP_CONTRACT.md` | `REFERENCE` | Yes | `READ_ONLY` | Pinned bootstrap contract specification. |
| `DOC-PROD-001..003` | `docs/01_product/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned product baseline specifications. |
| `DOC-REQ-001` | `docs/02_requirements/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned requirements register baseline. |
| `DOC-ARC-001..003` | `docs/03_architecture/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned architecture baseline specifications. |
| `DOC-SEC-001..004` | `docs/04_security/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned security baseline specifications. |
| `DOC-DEC-001..006` | `docs/05_decisions/ADR/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned ratified architectural decision records. |
| `DOC-VER-001..004` | `docs/07_verification/*` | `REFERENCE` | Yes | `READ_ONLY` | Pinned verification baselines and release reports. |

---

## 6. Security Boundary

The controlled documentation subsystem establishes a dedicated server-side boundary under `/api/projects/:id/docs`.

### Security Boundary Guarantees:
1. **No Generic Filesystem API:** The server provides zero endpoints accepting arbitrary filesystem paths from the client.
2. **Identity-Based Resolution:** All endpoints operate strictly on verified `documentId` values (e.g., `/api/projects/:id/docs/DOC-CTRL-002`).
3. **Server-Side Safe Lookup:** The server maps `documentId` to its registered relative path via the project's trusted registry.
4. **Boundary Clamp:** The server canonicalizes the target path and verifies that it resides strictly within `path.resolve(workspaceRoot, 'docs')`. Any attempt to access a path outside this directory or escape via symbolic links triggers an immediate `ERR_SECURITY_PATH_TRAVERSAL` error and HTTP 403 Forbidden.
5. **Deny-Precedence Enforcement:** Integrates with `DENIED_PATTERNS` from `server/security/pathBoundary.ts`, ensuring secrets, `.env` files, Git internals, and system paths cannot be accessed even if an attacker attempts to inject a malicious registry entry.
6. **Authentication & Role Authorization:** Read access requires valid session context. Write operations (`/save`) require an authenticated human identity (`requireHuman`) and record the actor in the audit ledger.

---

## 7. Document Registry

### Registry Structure
Every controlled document in the project is registered with the following metadata:

```typescript
export interface ControlledDocumentRecord {
  id: string;                      // Stable identifier: e.g. "DOC-CTRL-002"
  title: string;                   // Human-readable title
  path: string;                    // Workspace-relative path: e.g. "docs/00_control/PROJECT_STATE.md"
  kind: ControlledDocumentKind;    // 'CONTROL' | 'PRODUCT' | 'REQUIREMENTS' | 'ARCHITECTURE' | 'SECURITY' | 'VERIFICATION' | 'OPERATIONS'
  authority: ControlledDocumentAuthority; // 'REFERENCE' | 'GENERATED_PROJECTION'
  editability: 'READ_ONLY' | 'CONTROLLED_EDIT';
  sha256Digest?: string;           // Optional baseline hash for pinned artifacts
  contentType: 'markdown' | 'yaml' | 'json' | 'text';
  category: string;                // Grouping category for UI navigation
  description?: string;
}
```

### Dynamic Evaluation Fields (List Response)
When queried via `GET /api/projects/:id/docs`, the server reads the filesystem in a read-only manner and dynamically enriches the record with live integrity metadata:

```typescript
export type DocumentIntegrityStatus = 'MATCH' | 'CHANGED' | 'UNPINNED' | 'MISSING';

export interface ControlledDocumentSummary extends ControlledDocumentRecord {
  currentSha256: string | null;     // Live SHA-256 of on-disk file, or null if missing
  integrityStatus: DocumentIntegrityStatus;
  sizeBytes: number;
  lastModifiedAt: string | null;   // ISO 8601 timestamp
}
```

### Integrity Evaluation Logic:
- If `!fs.existsSync(canonicalPath)`: `integrityStatus = 'MISSING'`, `currentSha256 = null`.
- If `sha256Digest` is present in registry:
  - If `currentSha256 === sha256Digest`: `integrityStatus = 'MATCH'`.
  - If `currentSha256 !== sha256Digest`: `integrityStatus = 'CHANGED'`.
- If `sha256Digest` is absent (living document):
  - `integrityStatus = 'UNPINNED'`.
  - *Note:* `UNPINNED` is NOT a verification failure; it explicitly designates an intentionally living reference document.

---

## 8. Server API

The server boundary defines the following dedicated REST endpoints:

### 1. `GET /api/projects/:id/docs`
- **Purpose:** Enumerate all controlled documents for the specified project with their live integrity statuses.
- **Access:** Read-only.
- **Parameters:** `:id` (Project ID).
- **Response (200 OK):**
  ```json
  {
    "projectId": "PRJ-DOCMONSTAKRAKIN",
    "documents": [
      {
        "id": "DOC-CTRL-001",
        "title": "Project Charter - Control Plane for A-SSDLC",
        "path": "docs/00_control/PROJECT_CHARTER.md",
        "kind": "CONTROL",
        "authority": "REFERENCE",
        "editability": "READ_ONLY",
        "sha256Digest": "61074ca8621dc61c8db7b64890b42955baf7944e3e513c82ae757ff941092c05",
        "currentSha256": "61074ca8621dc61c8db7b64890b42955baf7944e3e513c82ae757ff941092c05",
        "integrityStatus": "MATCH",
        "contentType": "markdown",
        "category": "Control",
        "sizeBytes": 14205,
        "lastModifiedAt": "2026-09-20T12:00:00.000Z"
      },
      {
        "id": "DOC-CTRL-002",
        "title": "Project State - Authoritative Roadmap and Execution Baseline",
        "path": "docs/00_control/PROJECT_STATE.md",
        "kind": "CONTROL",
        "authority": "REFERENCE",
        "editability": "CONTROLLED_EDIT",
        "sha256Digest": null,
        "currentSha256": "4a1b...",
        "integrityStatus": "UNPINNED",
        "contentType": "markdown",
        "category": "Control",
        "sizeBytes": 24662,
        "lastModifiedAt": "2026-09-27T16:00:00.000Z"
      }
    ]
  }
  ```
- **Error Responses:**
  - `404 Not Found`: Project `:id` does not exist.
  - For projects without a registered document collection (e.g., `PRJ-ATLAS-01`), returns `{ "projectId": "PRJ-ATLAS-01", "documents": [] }`.

### 2. `GET /api/projects/:id/docs/:documentId`
- **Purpose:** Retrieve the full text content and metadata of a registered document.
- **Access:** Read-only.
- **Parameters:** `:id` (Project ID), `:documentId` (e.g., `DOC-CTRL-002`).
- **Response (200 OK):**
  ```json
  {
    "document": {
      "id": "DOC-CTRL-002",
      "title": "Project State - Authoritative Roadmap and Execution Baseline",
      "path": "docs/00_control/PROJECT_STATE.md",
      "kind": "CONTROL",
      "authority": "REFERENCE",
      "editability": "CONTROLLED_EDIT",
      "sha256Digest": null,
      "currentSha256": "4a1b...",
      "integrityStatus": "UNPINNED",
      "contentType": "markdown",
      "category": "Control"
    },
    "content": "# docmonstakrakin current project state\n..."
  }
  ```
- **Error Responses:**
  - `404 Not Found`: Project or `documentId` not found in registry.
  - `403 Forbidden`: Path traversal or boundary escape detected.
  - `410 Gone`: Registered document file is missing on disk (`integrityStatus: MISSING`).

### 3. `POST /api/projects/:id/docs/:documentId/diff`
- **Purpose:** Compute a structured, non-mutating line diff between on-disk content and candidate draft content.
- **Access:** Non-mutating / dry-run.
- **Parameters:** `:id`, `:documentId`.
- **Request Body:**
  ```json
  {
    "candidateContent": "# Updated markdown content...",
    "baseSha256": "4a1b..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "documentId": "DOC-CTRL-002",
    "oldHash": "4a1b...",
    "candidateHash": "7c9e...",
    "isStale": false,
    "hasChanges": true,
    "additions": 5,
    "deletions": 2,
    "changedLines": 7,
    "unifiedDiff": "--- a/docs/00_control/PROJECT_STATE.md\n+++ b/docs/00_control/PROJECT_STATE.md\n@@ -30,2 +30,5 @@\n..."
  }
  ```
- **Guarantees:** Does NOT write or alter any files on disk.

### 4. `POST /api/projects/:id/docs/:documentId/validate`
- **Purpose:** Run format-specific and structural invariant checks on candidate content without saving.
- **Access:** Non-mutating.
- **Parameters:** `:id`, `:documentId`.
- **Request Body:**
  ```json
  {
    "candidateContent": "# Updated markdown content..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "valid": true,
    "errors": [],
    "warnings": [],
    "format": "markdown",
    "checks": [
      { "name": "UTF-8 Encoding", "passed": true },
      { "name": "Non-Empty Content", "passed": true },
      { "name": "Size Limit (< 5MB)", "passed": true },
      { "name": "Required Sections Invariant", "passed": true }
    ]
  }
  ```
- **Error Response (422 Unprocessable Entity):**
  ```json
  {
    "valid": false,
    "errors": ["Missing required section: '## Current governance and task status'"],
    "warnings": []
  }
  ```

### 5. `POST /api/projects/:id/docs/:documentId/save`
- **Purpose:** Atomically save validated candidate content after checking optimistic concurrency (`baseSha256`).
- **Access:** Mutating; requires authenticated human operator (`requireHuman`).
- **Parameters:** `:id`, `:documentId`.
- **Request Body:**
  ```json
  {
    "candidateContent": "# Updated markdown content...",
    "baseSha256": "4a1b...",
    "actor": "Lead Architect",
    "reason": "Update project state following DMK-195 design review"
  }
  ```
- **Pre-Execution Enforcements:**
  1. `documentId` must exist in registry.
  2. Document `editability` MUST be `CONTROLLED_EDIT`. If `READ_ONLY`, immediately reject with `403 Forbidden` (`CANNOT_EDIT_READ_ONLY_DOCUMENT`).
  3. Validate candidate content. If invalid, reject with `422 Unprocessable Entity`.
  4. Compute live on-disk hash. If `liveSha256 !== baseSha256`, reject with `409 Conflict` (`DOCUMENT_STALE`).
- **Execution Flow:**
  1. Write to temporary file in same directory (`.tmp.[id].[random]`).
  2. Atomically rename temporary file over target file (`fs.renameSync`).
  3. Append cryptographically chained `DOCUMENT_UPDATED` event to project audit log.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "documentId": "DOC-CTRL-002",
    "path": "docs/00_control/PROJECT_STATE.md",
    "previousSha256": "4a1b...",
    "newSha256": "7c9e...",
    "auditEventId": "AUD-MUIX89KL-1234",
    "timestamp": "2026-09-27T17:15:00.000Z"
  }
  ```

---

## 9. Path Safety

### Fail-Closed Resolution Flow
Client inputs are never trusted to contain filesystem paths. The resolution pipeline executes in six fail-closed stages:

```
[ Client Request ]
       │
       ▼
1. Extract documentId (e.g., "DOC-CTRL-002")
       │
       ▼
2. Registry Lookup (lookup in trusted project registry)
       │  ├─ Not found ──► Return 404 (DOCUMENT_NOT_REGISTERED)
       ▼
3. Retrieve registered relative path (e.g., "docs/00_control/PROJECT_STATE.md")
       │
       ▼
4. String & Encoding Hygiene Checks
       │  ├─ Contains null bytes (\0, %00) ──► Throw 403 (NULL_BYTE_DETECTED)
       │  ├─ Contains traversal sequences (../, ..\) ──► Throw 403 (TRAVERSAL_DETECTED)
       │  ├─ Absolute path or drive letter (C:, /) ──► Throw 403 (ABSOLUTE_PATH_REJECTED)
       │  └─ UNC path (\\server\share) ──► Throw 403 (UNC_PATH_REJECTED)
       ▼
5. docs/ Boundary Confinement Verification
       │  ├─ Registered path MUST start with "docs/"
       │  ├─ Canonicalize: target = path.resolve(workspaceRoot, registeredPath)
       │  ├─ Confinement: rel = path.relative(docsRoot, target)
       │  └─ If rel.startsWith('..') or path.isAbsolute(rel) ──► Throw 403 (BOUNDARY_ESCAPED)
       ▼
6. Symlink Escape Verification
       │  ├─ realPath = fs.realpathSync(target)
       │  └─ If path.relative(docsRoot, realPath).startsWith('..') ──► Throw 403 (SYMLINK_ESCAPED)
       ▼
[ Safe Filesystem Read / Write ]
```

---

## 10. Hash Verification

### Hashing Algorithm
All document cryptographic digests are computed using SHA-256 over raw file bytes:
```typescript
export function computeFileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Status Classification Rules
1. **`MATCH` (Green Badge):**
   - Condition: `sha256Digest` is defined in registry AND `currentSha256 === sha256Digest`.
   - Meaning: File is byte-identical to the reviewed and ratified baseline artifact.
2. **`CHANGED` (Amber Warning Badge):**
   - Condition: `sha256Digest` is defined in registry AND `currentSha256 !== sha256Digest`.
   - Meaning: File differs from the pinned baseline. Does not automatically imply malice; signals that the on-disk file has evolved and requires human review or baseline repinning.
3. **`UNPINNED` (Blue Information Badge):**
   - Condition: `sha256Digest` is undefined/null in registry AND file exists on disk.
   - Meaning: The document is an active, living reference document (e.g., `PROJECT_STATE.md`, `TRACEABILITY_MATRIX.md`, `MASTER_WBS.yaml`). It is NOT an error or verification failure.
4. **`MISSING` (Red Alert Badge):**
   - Condition: File does not exist at registered path.
   - Meaning: The registered artifact is missing from the filesystem.

---

## 11. Viewer UX

### Proposed Layout (`ControlledDocsView.tsx`)
The Docs workspace integrates cleanly with the application's sidebar navigation (`currentView === 'documents'`), replacing the current synthetic export generator with a comprehensive dual-mode layout:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TopBar: Active Project [PRJ-DOCMONSTAKRAKIN]                                                     │
├──────────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ Controlled Docs      │ Document Header:                                                          │
│ 🔍 Filter documents  │ [DOC-CTRL-002] Project State                                              │
│                      │ Path: docs/00_control/PROJECT_STATE.md                                    │
│ ▼ CONTROL (7)        │ Authority: [REFERENCE]   Editability: [CONTROLLED EDIT]                   │
│   • Project Charter  │ Integrity: [UNPINNED]    Current Hash: [4a1b8c... (Copy)]                 │
│  ▶• Project State    ├───────────────────────────────────────────────────────────────────────────┤
│   • Master WBS (YAML)│ Actions: [Edit Draft]  [Raw / Rendered Toggle]                            │
│   • Master WBS (MD)  ├───────────────────────────────────────────────────────────────────────────┤
│   • Roadmap          │ Content Viewer Panel:                                                     │
│   • Traceability     │                                                                           │
│   • Self-Bootstrap   │ # docmonstakrakin current project state                                   │
│                      │                                                                           │
│ ► PRODUCT (3)        │ ## 2026-09-25 — DMK-194 Human UI Review Complete                          │
│ ► REQUIREMENTS (1)   │ ...                                                                       │
│ ► ARCHITECTURE (3)   │                                                                           │
│ ► SECURITY (4)       │                                                                           │
│ ► DECISIONS / ADR (6)│                                                                           │
│ ► VERIFICATION (4)   │                                                                           │
└──────────────────────┴───────────────────────────────────────────────────────────────────────────┘
```

### Viewer Capabilities by Content Type:
1. **Markdown (`.md`):**
   - Default: Safe rendered HTML view. HTML tags and script execution are strictly sanitized (inline scripts, `<iframe>`, `javascript:` URI handlers, and `<object>` elements are stripped).
   - Toggle: "View Raw Source" displays monospace syntax-highlighted Markdown.
2. **YAML (`.yaml` / `.yml`):**
   - Syntax-highlighted code viewer with line numbers and structure folding.
   - Read-only formatted inspection.
3. **Text / JSON (`.txt` / `.json`):**
   - Monospace formatted code viewer with line numbers.

---

## 12. Controlled Edit Workflow

For documents designated as `CONTROLLED_EDIT` (initially `PROJECT_STATE.md` and `TRACEABILITY_MATRIX.md`), the user interface enforces a strict, multi-step state machine. Direct saving is architecturally blocked:

```
   ┌─────────────────────────────────────────────────────────┐
   │                       1. VIEW                           │
   │  - Display canonical on-disk content                    │
   │  - Capture baseSha256 = currentSha256                   │
   │  - Action: Click "Edit Draft"                           │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                    2. EDIT DRAFT                        │
   │  - In-memory local draft buffer                         │
   │  - Syntax highlighting / line numbers                   │
   │  - Actions: [Cancel Draft] or [Preview Diff]            │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   3. PREVIEW DIFF                       │
   │  - Calls POST /api/projects/:id/docs/:docId/diff        │
   │  - Server generates structured line diff                │
   │  - UI renders additions (+), deletions (-), line counts│
   │  - Actions: [Back to Edit] or [Validate Draft]          │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   4. VALIDATE DRAFT                     │
   │  - Calls POST /api/projects/:id/docs/:docId/validate    │
   │  - Evaluates UTF-8 encoding, size, syntax, invariants   │
   │  - If FAIL: Displays exact validation errors; blocks    │
   │  - If PASS: Enables "Proceed to Save"                   │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   5. CONFIRM SAVE                       │
   │  - Modal dialog prompts for:                            │
   │    • Actor Identity (e.g., "Lead Architect")            │
   │    • Justification / Change Summary                     │
   │    • Displays baseSha256 and candidateSha256            │
   │  - Actions: [Cancel] or [Confirm & Apply Save]          │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                 6. SERVER ATOMIC COMMIT                 │
   │  - Server verifies baseSha256 === liveOnDiskSha256      │
   │    (If mismatch: aborts with 409 DOCUMENT_STALE)        │
   │  - Writes candidate to temp file                        │
   │  - Atomically renames over canonical target             │
   │  - Appends DOCUMENT_UPDATED to chained audit log        │
   │  - Returns newSha256 and auditEventId                   │
   │  - Client clears draft and reloads canonical file       │
   └─────────────────────────────────────────────────────────┘
```

---

## 13. Concurrency / TOCTOU

To prevent Time-Of-Check to Time-Of-Use (TOCTOU) race conditions and stale overwrites:
1. **Binding to Base Hash:** When the client enters Edit mode, it records the exact `baseSha256` of the file it loaded.
2. **Server-Side Live Recheck:** Upon receiving `POST .../save`, the server reads the current on-disk target file and computes `currentLiveSha256`.
3. **Stale Collision Handling:**
   - If `currentLiveSha256 !== baseSha256`, the server immediately halts the write and responds with:
     ```json
     {
       "error": "DOCUMENT_STALE",
       "message": "The document on disk has been modified since your edit session began. Reload to review the latest changes.",
       "expectedBaseSha256": "4a1b...",
       "currentLiveSha256": "9f2e..."
     }
     ```
   - No data is overwritten.
   - The UI displays an explicit conflict alert and offers a "Reload Canonical Document" action.
4. **Process-Level Write Mutex:** An in-process async lock ensures that concurrent save requests targeting the same document are queued sequentially rather than interleaving filesystem operations.

---

## 14. Validation Strategy

Validation occurs server-side prior to any file mutation. Validators are specialized by file type and document identity:

### Universal Validators (All Documents)
- **UTF-8 Integrity:** Content must be valid UTF-8 without malformed multi-byte sequences or null bytes.
- **Non-Empty:** Rejects empty or whitespace-only submissions.
- **Size Bounds:** Enforces a maximum document size of 5 MB to prevent memory exhaustion.

### Format-Specific Validators
1. **Markdown (`.md`):**
   - Valid text stream.
   - Preserves balanced Markdown header levels (`#`, `##`, etc.).
2. **YAML (`.yaml` / `.yml`):**
   - Must parse successfully via a strict YAML parser.
   - Rejects duplicate object keys, invalid indentation, and malformed tags.

### Document-Specific Structural Invariant Checks
1. **`docs/00_control/PROJECT_STATE.md`:**
   - Must contain top-level title: `# docmonstakrakin current project state`.
   - Must preserve standard section headers:
     - `## Current governance and task status` (or dated milestone section).
     - Status entries for `Gate 7`, `Live reconciliation`, and `Release status`.
2. **`docs/00_control/TRACEABILITY_MATRIX.md`:**
   - Must contain standard Markdown table structures.
   - Must maintain valid requirement and work item link columns.

---

## 15. Atomic Persistence

Document persistence follows the battle-tested atomic persistence pattern implemented in `server/projectPersistence.ts`:

1. **Temporary File Allocation:**
   The candidate content is written to a temporary sibling file in the exact same directory as the target document:
   ```typescript
   const tempPath = path.join(
     path.dirname(targetCanonicalPath),
     `.tmp.${path.basename(targetCanonicalPath)}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`
   );
   ```
2. **File Flush & Sync:**
   The temporary file is written and its file descriptor is synced to physical storage (`fs.fsyncSync`) to ensure full disk commitment.
3. **Atomic Replacement:**
   The temporary file is atomically renamed over the target canonical file:
   ```typescript
   fs.renameSync(tempPath, targetCanonicalPath);
   ```
   *Rationale:* On POSIX filesystems and Windows NTFS, renaming within the same filesystem directory is an atomic directory entry update. If the server crashes or power fails, the target document is never left in a partially written or truncated state.
4. **Fail-Closed Cleanup:**
   If any exception occurs prior to successful rename, the temporary file is unlinked immediately in a `finally` block.

---

## 16. Audit Model

Every successful document modification generates a tamper-evident, cryptographically chained `AuditEvent` linked into `store.auditLogs[projectId]`.

### Audit Event Definition:
```typescript
{
  "id": "AUD-MUIX89KL-1234",
  "actor": "Lead Architect",
  "timestamp": "2026-09-27T17:15:00.000Z",
  "action": "DOCUMENT_UPDATED",
  "target": "DOC-CTRL-002",
  "reason": "Update project state following DMK-195 design review",
  "previousHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "stateHash": "9a8b7c6d5e...",
  "details": {
    "documentId": "DOC-CTRL-002",
    "path": "docs/00_control/PROJECT_STATE.md",
    "previousSha256": "4a1b...",
    "newSha256": "7c9e...",
    "validationStatus": "PASSED",
    "linesAdded": 5,
    "linesRemoved": 2
  }
}
```

### Audit Principles:
- **Zero Content Bloat:** The full document content is NOT stored in the audit event; storing large text payloads would bloat the project snapshot and duplicate version-controlled Git history. Only cryptographic SHA-256 digests and diff summaries are retained.
- **Cryptographic Hash Chaining:** `stateHash` is deterministically computed via `computeAuditEventHash` incorporating the previous event's hash, enforcing `SEC-CTRL-013`.
- **Integrity Failures:** Failed validation attempts, stale-base rejections, or unauthorized write attempts log security warnings to the server console but do NOT append false `DOCUMENT_UPDATED` records to the audit ledger.

---

## 17. Project Isolation

The Docs workspace strictly enforces multi-project boundaries:

1. **Registry Scoping:**
   - `PRJ-DOCMONSTAKRAKIN`: Has the repository-controlled document collection populated from `bootstrap/docmonstakrakin.self-bootstrap.json`.
   - Other Projects (e.g., `PRJ-ATLAS-01`, `PRJ-FINPAY-02`): Have an empty document registry (`store.documents[id] = []`).
2. **Explicit Empty / Unavailable State:**
   When an operator selects a project that lacks a repository-controlled document registry:
   - The UI does NOT display docmonstakrakin's `docs/` files.
   - The UI displays an explicit, friendly empty state:
     > **No Repository Documentation Available**
     > Project `PRJ-ATLAS-01` does not have a repository-controlled documentation registry configured. Repository documents are only accessible for projects with verified repository bindings.
3. **Selection State Reset:**
   Switching projects in the application header immediately:
   - Clears any selected document ID.
   - Clears in-memory draft buffers.
   - Clears active diff or validation results.
   - Resets the Docs view to its initial unselected state.

---

## 18. Dogfooding Model

DMK-195 is the first task designated for deliberate, controlled dogfooding. However, to preserve governance integrity while DMK-201 remains `VERIFICATION_PENDING`, the following separation must be maintained:

- **Canonical Planning Authority:** `docs/00_control/MASTER_WBS.yaml`
- **Operational Execution Tracking:** `docmonstakrakin` runtime / application state

### Step-by-Step Dogfooding Transition (Phase 2):
During Phase 1 (this design task), NO status transitions occur. Once this design specification and its subsequent implementation plan receive explicit human review and approval, the dogfooding rollout will proceed as follows:

1. **Update Canonical WBS:**
   Update `docs/00_control/MASTER_WBS.yaml`:
   `DMK-195 status: BACKLOG -> IN_PROGRESS`
2. **Regenerate & Verify WBS Projection:**
   Run `npm run wbs:generate` (or verify via `npm run wbs:check`) to synchronize `docs/00_control/MASTER_WBS.md`.
3. **Update Runtime WorkItem via Canonical API:**
   Issue `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items` to transition runtime `DMK-195` from `PROPOSED` to `IN_PROGRESS`.
4. **Verify Audit Ledger:**
   Verify that a `WORK_ITEM_UPDATED` audit event was chained into the project audit log.
5. **Verify Isolation:**
   Confirm that only `DMK-195` was updated; historical items (`DMK-187..194`) and DMK-201 remain completely untouched.

---

## 19. Threat Model

| Threat ID | Threat Name | Attack Scenario | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **THR-DOC-001** | Directory Traversal | Attacker provides `../../etc/passwd` or `..\\private_keys` in document ID or URL parameters. | **ID-Only Lookup & Boundary Clamp:** Client specifies only `documentId`. The server resolves the relative path exclusively from the trusted internal registry, prepends `workspaceRoot`, canonicalizes via `path.resolve`, and asserts confinement inside `docs/`. |
| **THR-DOC-002** | Symlink Escape | A symlink inside `docs/` points to a sensitive file or directory outside the workspace (e.g., `~/.ssh/id_rsa`). | **Realpath Verification:** Server resolves `fs.realpathSync` on the target file and verifies that the canonical real path remains strictly within `docs/`. Symlinks escaping `docs/` are rejected with HTTP 403. |
| **THR-DOC-003** | Arbitrary File Read | Attacker requests access to unregistered files within `docs/` (e.g., scratch notes or temporary dumps). | **Strict Registry Whitelist:** Only files explicitly registered in the project's document registry are exposed. Unregistered filesystem paths return HTTP 404. |
| **THR-DOC-004** | Arbitrary File Write | Attacker attempts to overwrite read-only baseline documents or source code files. | **Strict Allowlist & Editability Flag:** Server checks `editability === 'CONTROLLED_EDIT'`. Only `DOC-CTRL-002` and `DOC-CTRL-006` are marked editable. Any attempt to write to other documents is blocked with HTTP 403. |
| **THR-DOC-005** | TOCTOU / Stale Overwrite | Two users or agents edit `PROJECT_STATE.md` concurrently; the second write silently overwrites the first. | **Optimistic Concurrency via Base Hash:** Save endpoint requires `baseSha256`. Server hashes the live file immediately before writing; if live hash differs from base hash, write is rejected with HTTP 409 `DOCUMENT_STALE`. |
| **THR-DOC-006** | Projection Mutation | User or agent attempts to edit `MASTER_WBS.md` directly in the Docs UI, causing drift from `MASTER_WBS.yaml`. | **Immutable Projections:** All `GENERATED_PROJECTION` documents are hardcoded as `READ_ONLY`. Server rejects save requests targeting projections with HTTP 403. |
| **THR-DOC-007** | WBS Authority Corruption | User attempts to edit `MASTER_WBS.yaml` through the Docs UI, bypassing planning controls. | **WBS Exclusion:** `MASTER_WBS.yaml` is explicitly excluded from the editable allowlist and enforced as `READ_ONLY`. Planning updates must occur through governed WBS procedures. |
| **THR-DOC-008** | Cross-Project Leakage | User selects `PRJ-ATLAS-01` and sees `PRJ-DOCMONSTAKRAKIN`'s proprietary governance documents. | **Project-Scoped Registry:** Documents are loaded from `store.documents[projectId]`. Non-self projects return empty registries; UI shows explicit empty state. |
| **THR-DOC-009** | Unsafe Markdown / XSS | Malicious or untrusted Markdown document contains `<script>alert(1)</script>` or malicious iframe payloads. | **Sanitized HTML Rendering:** Markdown renderer sanitizes all HTML output, strips executable scripts, inline event handlers (`onload`, `onerror`), and `javascript:` URIs. |
| **THR-DOC-010** | Malformed YAML / File Corruption | User submits malformed YAML or corrupted text that breaks downstream tooling. | **Pre-Save Syntax Validation:** Server runs format-specific parsers before committing files; malformed syntax is rejected with HTTP 422. |
| **THR-DOC-011** | Audit Ledger Omission | File is updated on disk but the audit ledger update fails, leaving an unlogged modification. | **Transactional Atomic Save:** File write and audit logging occur in an integrated transaction. If audit event creation fails, the file write is not finalized or is flagged. |
| **THR-DOC-012** | Partial Write / Truncation | Power outage or process termination during file write leaves a governance document corrupted at 0 bytes. | **Atomic Temp-and-Rename:** Writes to temporary file in same directory first, syncs to disk, then atomically renames over target file. |
| **THR-DOC-013** | File Encoding / DoS | Attacker submits a 100MB file or non-UTF-8 binary payload to crash memory or corrupt encoding. | **Size Limit & UTF-8 Clamp:** Enforces strict 5MB payload limit and UTF-8 encoding validation. |

---

## 20. Test Strategy

The implementation must include comprehensive automated tests across the entire boundary before human acceptance.

### Required Test Matrix:
1. **Test A (Registry Listing):** `GET /api/projects/:id/docs` returns all 28 registered documents for `PRJ-DOCMONSTAKRAKIN` with accurate metadata.
2. **Test B (Authority Classification):** Verify that every document correctly reports `authority: 'REFERENCE'` or `authority: 'GENERATED_PROJECTION'`.
3. **Test C (Hash-Pinned MATCH):** Pinned documents matching disk return `integrityStatus: 'MATCH'`.
4. **Test D (Hash-Pinned CHANGED):** Temporarily modifying a pinned document file in a test fixture returns `integrityStatus: 'CHANGED'`.
5. **Test E (UNPINNED Living Documents):** Living documents (`PROJECT_STATE.md`, `TRACEABILITY_MATRIX.md`, `MASTER_WBS.yaml`) return `integrityStatus: 'UNPINNED'` and are not flagged as errors.
6. **Test F (Traversal Rejection):** Attempting to pass traversal sequences (`../`, `..%2f`, null bytes) in document lookup fails closed with HTTP 403/404.
7. **Test G (Absolute Path Rejection):** Attempting to resolve drive letters (`C:\...`) or root paths (`/...`) fails closed.
8. **Test H (Unregistered Document Rejection):** Requesting a document ID not present in the registry returns HTTP 404.
9. **Test I (Project Isolation):** Requesting docs for `PRJ-ATLAS-01` returns an empty array; no docmonstakrakin docs are leaked.
10. **Test J (Projection Edit Rejection):** `POST .../save` targeting `DOC-CTRL-004` (`MASTER_WBS.md`) returns HTTP 403 Forbidden.
11. **Test K (`MASTER_WBS.yaml` Edit Rejection):** `POST .../save` targeting `DOC-CTRL-003` (`MASTER_WBS.yaml`) returns HTTP 403 Forbidden.
12. **Test L (Controlled Editable Doc Edit Flow):** `POST .../save` targeting `DOC-CTRL-002` succeeds when provided with valid content and matching base hash.
13. **Test M (Diff Endpoint Non-Mutating):** `POST .../diff` computes accurate diff without altering target file on disk or writing temporary files.
14. **Test N (Validation Failure Blocks Save):** Submitting malformed content to `POST .../save` returns HTTP 422 and preserves on-disk content.
15. **Test O (Stale Base Hash Rejection):** Submitting a mismatched `baseSha256` returns HTTP 409 `DOCUMENT_STALE` and aborts save.
16. **Test P (Atomic Persistence):** Verify that saves write to `.tmp` first, rename atomically, and leave zero leftover `.tmp` files.
17. **Test Q (Audit Event Correctness):** Successful save appends a valid `DOCUMENT_UPDATED` event to `store.auditLogs`, maintaining audit hash chain continuity.
18. **Test R (Persistence & Reload):** Content updated via save survives server restart and reloads identically from disk.
19. **Test S (Project Switching State Reset):** Switching projects in the UI completely clears document selection and draft state.
20. **Test T (UI Smoke & Accessibility):** React component renders without console errors, supports keyboard navigation, and renders Markdown safely.

---

## 21. Expected Files / Components

To maintain architectural cohesion, the design identifies affected existing files and specifies proposed new files:

### Existing Files to Modify (Phase 2)
1. **`server.ts`:**
   - Mount the controlled docs router: `app.use('/api/projects/:id/docs', createControlledDocsRouter(store, reviewerAuth))`.
2. **`src/types.ts`:**
   - Export `ControlledDocumentRecord`, `ControlledDocumentSummary`, `DocumentIntegrityStatus`, and doc API response types.
3. **`src/App.tsx`:**
   - Update `currentView === 'documents'` to render the new `ControlledDocsView`.
   - Ensure `handleSelectProject` resets document selection state.
4. **`src/components/Sidebar.tsx`:**
   - Update label for `documents` from "Reports & Export" to "Documentation Workspace" (or provide dedicated sub-views).
5. **`src/data/projectWorkspace.ts`:**
   - Add `docs` endpoint to project loader or provide standalone loader.

### Proposed New Files (Phase 2)
1. **`server/docs/controlledDocsRouter.ts`:**
   - Express router handling `/api/projects/:id/docs` endpoints (list, get, diff, validate, save).
2. **`server/docs/controlledDocsRegistry.ts`:**
   - Registry loader, path resolver, and metadata enricher.
3. **`server/docs/controlledDocsValidator.ts`:**
   - Format and structural invariant validators for Markdown and YAML.
4. **`server/docs/controlledDocsPersistence.ts`:**
   - Safe path resolution, confinement assertion, file hashing, and atomic write implementation.
5. **`src/components/ControlledDocsView.tsx`:**
   - Primary workspace UI component featuring category navigation, metadata header, viewer, and editor integration.
6. **`src/components/docs/DocViewer.tsx`:**
   - Content viewer with safe Markdown rendering and syntax-highlighted code views.
7. **`src/components/docs/DocEditor.tsx`:**
   - Multi-step editor managing Draft, Diff, and Validate states.
8. **`src/components/docs/DocDiffModal.tsx`:**
   - Visual line-diff preview modal displaying additions and deletions.
9. **`src/components/docs/DocSaveModal.tsx`:**
   - Confirmation dialog collecting actor identity and justification.
10. **`scripts/testControlledDocs.ts`:**
    - Comprehensive backend automated test suite covering Tests A through S.
11. **`scripts/testControlledDocsUi.ts`:**
    - UI smoke test suite covering Test T.

---

## 22. Rollout / Verification

The implementation of DMK-195 will be verified through the following sequential verification gates:

1. **Unit & Boundary Tests:**
   Execute `npx tsx scripts/testControlledDocs.ts` to verify API behavior, path traversal defense, hash checking, optimistic concurrency, and audit chaining.
2. **UI & Component Smoke Tests:**
   Execute `npx tsx scripts/testControlledDocsUi.ts` to verify static markup rendering, state isolation, and view transitions.
3. **Regression Test Suite:**
   Execute `npm run test:complete` (30/30 suites) to confirm zero regression across all core subsystems.
4. **Automated QA Suite:**
   Execute `npm run qa` (11/11 criteria) to ensure project governance and architectural rules remain intact.
5. **WBS Consistency Check:**
   Execute `npm run wbs:check` to ensure no unplanned task drift has occurred.
6. **Human UI Evaluation:**
   Conduct interactive human review of the Docs workspace in the browser, verifying category navigation, Markdown rendering, diff visualization, and save confirmation.

---

## 23. Explicit Exclusions

The following areas are strictly out of scope for DMK-195:
- **Gate 7 Evaluation & Release Sign-Off:** Release remains at `v0.1.0-rc1`. Gate 7 is strictly held.
- **DMK-201 State Reconciliation:** No historical state reconciliation or candidate application.
- **DMK-196 Formal Requirement Sign-Off UX:** Requirement sign-off workflows remain in backlog.
- **DMK-197 Approval Inbox & Quorum Sync:** Quorum verification and approval inbox UI remain in backlog.
- **Arbitrary File Creation:** The Docs workspace allows editing existing allowlisted files; it does not allow creating arbitrary new files on disk.
- **Git Commit / Branch Management:** Docs workspace saves directly to the working tree; staging, committing, and branching remain governed by `RepositoryView`.

---

## 24. Open Issues, if any

1. **Integration with Existing `DocumentsView` (Dynamic Projections):**
   *Question:* Should the existing dynamic projection generator (PRD, SAD, THREAT, RTM, GOV, RELEASE) be retained as a secondary tab ("Dynamic Reports & Projections") within the new Controlled Docs workspace, or remain a distinct tool?
   *Recommendation:* Integrate it as a dedicated "Dynamic Projections" tab inside `ControlledDocsView`, clearly separated from "Repository Documents", to provide a single unified documentation portal.
2. **Living Allowlist Expansion in Future Milestones:**
   *Question:* Should future phases (v2) expand the editable allowlist to include specific product or architecture working drafts?
   *Recommendation:* In v1 (DMK-195), restrict strictly to `PROJECT_STATE.md` and `TRACEABILITY_MATRIX.md`. Any future expansion must be preceded by an approved ADR and security review.
3. **Client-Side Markdown Sanitization Dependency:**
   *Question:* What sanitization utility should be used in the client bundle?
   *Recommendation:* Use a lightweight, local-only DOM sanitization routine or existing trusted dependencies without introducing external CDN or network dependencies.
