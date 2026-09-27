# DMK-195 Controlled Documentation Workspace Design

Status:
APPROVED

Approved By:
Human Operator

Approved Commit:
5439dfbf6aacf4ffaf3c0ee1be25f3389e0b36ce

Approval Date:
2026-09-28

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

Furthermore, critical living governance documents—specifically `docs/00_control/PROJECT_STATE.md` and `docs/00_control/TRACEABILITY_MATRIX.md`—must frequently be updated during iterative development. Currently, such edits must be performed either through external text editors or ad-hoc file mutations outside the application's security boundary. This introduces critical operational and architectural hazards:
1. **Lack of Cryptographic Hash Verification:** No mechanism detects whether on-disk reference documents match reviewed baseline digests or have suffered unreviewed drift.
2. **Absence of TOCTOU & Concurrency Protection:** Simultaneous edits or concurrent agent sessions can silently overwrite each other's updates without detecting stale base content.
3. **Cross-Domain Partial Commit Risk:** A document save affects two distinct persistence domains: (a) the filesystem markdown document, and (b) `.local/project-state.json` (audit ledger and `project.stateVersion`). A naive save flow that replaces the document without an atomic, journaled transaction risks partial commits where the document is changed on disk but the audit record is lost.
4. **Cross-Filesystem Rename Non-Atomicity:** Renaming temporary or backup files residing under `.local/` directly over target documents in `docs/` assumes a single shared filesystem. If `.local/` and `docs/` reside across filesystem mount boundaries, `fs.renameSync` fails or falls back to non-atomic copy-and-unlink. Atomicity requires target-sibling placement.
5. **Non-Mutating POST Persistence Interception:** The application's `installProjectPersistence()` middleware automatically intercepts all successful `POST`, `PATCH`, `PUT`, and `DELETE` requests under `/api/projects`, triggering snapshot rewrites. Because middleware executes before route handlers, read-only preview actions such as `/diff` and `/validate` would trigger unintended state snapshot updates and TOCTOU lock acquisition unless classified pre-persistence using full routed paths.
6. **Missing Audit Traceability:** Edits performed outside the application bypass the cryptographically chained audit ledger (`server/security/auditImmutability.ts`), breaking the chain of custody.
7. **Risk of Arbitrary Filesystem Traversal:** Naive document viewing or editing features expose the host environment to directory traversal attacks (`../`), symlink escapes, secret store disclosure (`.env`, `.git/credentials`, OS system files), and accidental corruption of canonical planning artifacts (`docs/00_control/MASTER_WBS.yaml`).
8. **Conflation of Projections with Authorities:** Users may inadvertently attempt to edit generated projection files (e.g., `docs/00_control/MASTER_WBS.md`), leading to divergence from the canonical planning authority (`MASTER_WBS.yaml`).

DMK-195 addresses these issues by establishing a dedicated, fail-closed Controlled Documentation Workspace.

---

## 2. Goals

1. **In-Console Browsing & Viewing:** Provide a structured, categorized navigation experience to browse and read repository-controlled Markdown, YAML, and text documentation strictly confined within the `docs/` tree.
2. **Lock Authoritative Document Registry:** Define `bootstrap/docmonstakrakin.self-bootstrap.json` (`documents[]`) as the sole authoritative registry for `PRJ-DOCMONSTAKRAKIN`. The server reads and validates this registry in a strictly read-only manner.
3. **Strict Registry Filtering (No Auto-Discovery):** Expose ONLY manifest-registered documents (currently 28 controlled documents). Files physically residing in `docs/` that are not explicitly registered remain strictly invisible.
4. **Authority Classification:** Re-use the canonical document model from `bootstrap/docmonstakrakin.self-bootstrap.json` and `src/data/selfBootstrapContract.ts` to categorize every document as either `REFERENCE` or `GENERATED_PROJECTION`.
5. **Strict Immutability for Projections & Baseline References:** Enforce that all `GENERATED_PROJECTION` documents and all hash-pinned `REFERENCE` documents are strictly read-only.
6. **Controlled, Audited Editing:** Implement a rigorous, multi-step editing workflow (Edit Draft → Preview Diff → Validate → Confirm Save → Stale-Base Verification → Coordinated Atomic Transaction → Audit Logging) restricted exclusively to an approved allowlist of living reference documents.
7. **Pre-Persistence Read-Only Classification (Full Routed Path):** Implement a server-internal request classifier in `installProjectPersistence` that uses the normalized full routed path (`${req.baseUrl}${req.path}`) to classify `/diff` and `/validate` as `READ_ONLY` before entering transaction handling, guaranteeing early exit with zero snapshot rewrites, zero stateVersion changes, zero audit side-effects, and zero lock acquisition.
8. **Coordinated Cross-Domain Document Transaction & Same-Filesystem Atomicity:** Implement `server/docs/controlledDocsTransaction.ts` with a durable transaction journal under `.local/document-transactions/` and candidate/rollback artifacts placed strictly as target-directory siblings in `path.dirname(targetDocument)` to guarantee atomic `fs.renameSync` replacement and rollback.
9. **Governed State Mutation Invariant:** A successful controlled save modifies the repository document, appends `DOCUMENT_UPDATED`, increments `project.stateVersion` exactly once ($N \to N+1$), and durably commits the project snapshot.
10. **Strict Identity & Role Authorization:** Strictly reject with HTTP 400 Bad Request any client-declared identity/authority claims (`actor`, `role`, `approver`, etc.); derive actor identity and governance roles exclusively from the authenticated server session via `requireHuman()` with explicit `humanConfirmed === true`.
11. **Raw-Byte Cryptographic Integrity Verification:** Hash on-disk documents using exact raw-byte SHA-256 identical to `server/bootstrap/selfBootstrapIntegrity.ts` without CRLF normalization, reporting statuses: `MATCH`, `CHANGED`, `UNPINNED`, or `MISSING`.
12. **Line Ending Preservation:** Detect source EOL (`LF`, `CRLF`, `MIXED`). Re-encode saves in the source convention, and reject editing of mixed-EOL documents fail-closed with `UNSUPPORTED_MIXED_LINE_ENDINGS`.
13. **Strict Project Isolation:** Isolate repository document access to `PRJ-DOCMONSTAKRAKIN`. Unrelated projects without a verified repository binding present an explicit empty/unavailable state.
14. **Coexistence with Existing UI & Gate 7:** Preserve existing `DocumentsView.tsx` functionality intact under a "Dynamic Projections" tab while mounting the new workspace under a "Repository Documents" tab, strictly preserving Gate 7 sign-off and package controls.
15. **Safe Markdown Rendering Without Custom Sanitizers:** Propose `react-markdown` with raw HTML disabled and safe external link handling, rejecting dangerous URI schemes (`javascript:`, `data:`).

---

## 3. Non-goals

DMK-195 explicitly does NOT:
1. **Resolve DMK-201:** Does not perform runtime/WBS state reconciliation, does not change DMK-201 status (`VERIFICATION_PENDING`), and does not apply historical candidate patches.
2. **Apply State Recovery or Reconciliation:** Does not repair historical package-overwrite state or alter unrelated WorkItem statuses.
3. **Scan or Auto-Discover `docs/`:** Does not scan the filesystem to expose unregistered documents; unregistered files remain strictly invisible.
4. **Modify `.local/project-state.json` Merely to Expose Docs:** Does not seed or mutate `store.documents` to populate the document list.
5. **Permit Editing of `MASTER_WBS.yaml`:** `MASTER_WBS.yaml` is the canonical planning authority and must never be edited through the Docs UI.
6. **Permit Editing or Ad-Hoc Regeneration of `MASTER_WBS.md`:** `MASTER_WBS.md` is a `GENERATED_PROJECTION` and remains strictly read-only in the Docs UI; regeneration belongs to controlled CLI workflows (`npm run wbs:render` / `npm run wbs:check`).
7. **Implement DMK-196 Sign-Off UX:** Does not implement the interactive requirement sign-off requesting workflow.
8. **Implement DMK-197 Approval Inbox:** Does not implement the dual-signoff quorum inbox.
9. **Provision Reviewer Accounts:** Does not create or manage cryptographic reviewer keys.
10. **Touch or Execute Gate 7:** Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
11. **Promote Release Status:** Release status remains `v0.1.0-rc1` (Release Candidate).
12. **Expose Secrets or Credentials:** Never accesses, displays, or modifies files in `.secrets/`, `.test_secret_store/`, `.env*`, or private keys.

---

## 4. Existing Repository Model

The repository currently provides several foundational building blocks that DMK-195 builds upon:

1. **Authoritative Self-Bootstrap Manifest (`bootstrap/docmonstakrakin.self-bootstrap.json`):**
   Contains the authoritative registry of 28 controlled documents under `documents[]`. Each entry defines:
   - `id`: Stable identifier (e.g., `DOC-CTRL-001`, `DOC-PROD-001`, `DOC-ARC-001`).
   - `path`: Workspace-relative path (e.g., `docs/00_control/PROJECT_CHARTER.md`).
   - `kind`: Category enum (`CONTROL`, `PRODUCT`, `REQUIREMENTS`, `ARCHITECTURE`, `SECURITY`, `VERIFICATION`, `OPERATIONS`).
   - `authority`: Governance authority enum (`REFERENCE`, `GENERATED_PROJECTION`).
   - `title`: Human-readable document title.
   - `sha256Digest`: Optional 64-character hex SHA-256 digest pinning the baseline artifact.
2. **Runtime Document Collection (`server/projectStore.ts` & `.local/project-state.json`):**
   `store.documents['PRJ-DOCMONSTAKRAKIN']` in `.local/project-state.json` is currently empty (`[]`) following the historical Test 10 package overwrite and is NOT included as portable-package authoritative state. **DMK-195 v1 locks `bootstrap/docmonstakrakin.self-bootstrap.json` as the sole authoritative registry.** The server loads this file directly in a read-only manner. It does NOT seed `store.documents`, does NOT hydrate `store.documents` from the manifest, and does NOT treat `store.documents` as fallback authority.
3. **Integrity Verifier (`server/bootstrap/selfBootstrapIntegrity.ts`):**
   Computes document digests via `crypto.createHash('sha256').update(fs.readFileSync(docPath)).digest('hex')`. This establishes the project's standard: **exact raw-byte SHA-256 without line-ending normalization**.
4. **Governance Identity & Session (`server/proposals/identity.ts`):**
   `requireHuman(req, res)` enforces:
   - Same-origin validation.
   - Active session cookie (`dmk_reviewer`).
   - `kind === 'HUMAN'`.
   - At least one recognized governance role: `Security Officer` OR `Lead Architect`.
5. **Project Persistence Middleware (`server/projectPersistence.ts`):**
   Intercepts `POST`, `PATCH`, `PUT`, `DELETE` under `/api/projects` and atomically commits snapshot changes using temporary files and directory locks.
6. **Path Boundary & Traversal Defense (`server/security/pathBoundary.ts`):**
   Implements `sanitizeAndResolvePath` and `assertWorkspacePath` enforcing `SEC-CTRL-011` / OWASP ASVS V12.3 path traversal defense, null-byte blocking, and deny-precedence rules.
7. **Cryptographic Audit Hash Chaining (`server/security/auditImmutability.ts`):**
   Implements `computeAuditEventHash`, `createChainedAuditEvent`, and `verifyAuditLedgerChain` enforcing `SEC-CTRL-013` / NIST SSDF PO.1.3 tamper-evident audit chaining.
8. **Frontend View Architecture (`src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/DocumentsView.tsx`):**
   Coordinates top-level views. `DocumentsView.tsx` currently renders dynamic projections and manages Gate 7 sign-off and package transfer.

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
| `DOC-CTRL-004` | `docs/00_control/MASTER_WBS.md` | `GENERATED_PROJECTION` | No | `READ_ONLY` | Projection of WBS; must be updated via `npm run wbs:render` only. |
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
4. **Registered Documents Only (No Auto-Discovery):** The repository contains 128 files in `docs/`, but only 28 are manifest-registered. Files that are not registered (e.g., `docs/00_control/LAST_HANDOFF.md`, planning records, unregistered verification reports, scratch specs) are **strictly invisible** and cannot be queried. The `docs/` boundary is necessary but NOT sufficient; visibility requires BOTH confinement within `docs/` AND active registry membership.
5. **Boundary Clamp:** The server canonicalizes the target path and verifies that it resides strictly within `path.resolve(workspaceRoot, 'docs')`. Any attempt to access a path outside this directory or escape via symbolic links triggers an immediate `ERR_SECURITY_PATH_TRAVERSAL` error and HTTP 403 Forbidden.
6. **Deny-Precedence Enforcement:** Integrates with `DENIED_PATTERNS` from `server/security/pathBoundary.ts`, ensuring secrets, `.env` files, Git internals, and system paths cannot be accessed.
7. **Pre-Persistence Routing Classification:** Non-mutating POST endpoints (`/diff`, `/validate`) are classified as `READ_ONLY` before entering persistence transaction handling using the normalized full routed path (`${req.baseUrl}${req.path}`), preventing snapshot rewrites or state version increments.
8. **Authentication & Authorization (Strict Reject Rule):** Read access (list, get, diff, validate) requires local app session context. Write operations (`/save`) require `requireHuman()` verification with `humanConfirmed === true`. Any request body containing client-supplied identity claims (`actor`, `role`, `approver`, `reviewerName`, `reviewerRole`, `authorizedRole`, `identityId`, `actorType`) is **strictly rejected** with HTTP 400 Bad Request (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`).

---

## 7. Document Registry

### Authoritative Source
For `PRJ-DOCMONSTAKRAKIN`, the authoritative document registry is:
`bootstrap/docmonstakrakin.self-bootstrap.json` -> `documents[]`
The server loads and validates this file at startup in a read-only manner.
- It does NOT seed `store.documents`.
- It does NOT hydrate `store.documents` from the manifest.
- It does NOT modify `.local/project-state.json`.
- It does NOT treat `store.documents` as fallback authority.
For other projects without a verified repository binding, the server returns an explicit empty list (`[]`).

### Registry Structure
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
When queried via `GET /api/projects/:id/docs`, the server reads the filesystem in a read-only manner and dynamically enriches the record:

```typescript
export type DocumentIntegrityStatus = 'MATCH' | 'CHANGED' | 'UNPINNED' | 'MISSING';

export interface ControlledDocumentSummary extends ControlledDocumentRecord {
  currentSha256: string | null;     // Live raw-byte SHA-256 of on-disk file
  integrityStatus: DocumentIntegrityStatus;
  sizeBytes: number;
  lastModifiedAt: string | null;   // ISO 8601 timestamp
  lineEndingMode: 'LF' | 'CRLF' | 'MIXED' | 'UNKNOWN';
}
```

---

## 8. Server API

The server boundary defines the following dedicated REST endpoints:

### 1. `GET /api/projects/:id/docs`
- **Purpose:** Enumerate all manifest-registered documents for the project with live raw-byte integrity statuses. Unregistered files in `docs/` are omitted.
- **Access:** Read-only; standard application access.
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
        "lineEndingMode": "LF",
        "lastModifiedAt": "2026-09-20T12:00:00.000Z"
      }
    ]
  }
  ```

### 2. `GET /api/projects/:id/docs/:documentId`
- **Purpose:** Retrieve the full text content and metadata of a registered document.
- **Access:** Read-only.
- **Response (200 OK):**
  ```json
  {
    "document": { ... },
    "content": "# docmonstakrakin current project state\n..."
  }
  ```
- **Error Responses:**
  - `404 Not Found`: Project not found, or `documentId` not registered. Unregistered paths return 404 even if the file exists on disk.
  - `410 Gone`: Registered document file is missing on disk.

### 3. `POST /api/projects/:id/docs/:documentId/diff`
- **Purpose:** Compute a structured, non-mutating line diff between on-disk content and candidate draft content.
- **Access:** Read-only. Classified as `READ_ONLY` by the pre-persistence classifier in `installProjectPersistence` using routed path `${req.baseUrl}${req.path}`.
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
- **Guarantees:** Zero snapshot rewrites, zero stateVersion increments, zero audit events, zero temporary files, zero transaction locks.

### 4. `POST /api/projects/:id/docs/:documentId/validate`
- **Purpose:** Run format-specific and structural invariant checks on candidate content without saving.
- **Access:** Read-only. Classified as `READ_ONLY` by the pre-persistence classifier in `installProjectPersistence` using routed path `${req.baseUrl}${req.path}`.
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

### 5. `POST /api/projects/:id/docs/:documentId/save`
- **Purpose:** Execute a governed, coordinated transaction that updates the document on disk, increments `project.stateVersion` exactly once, appends `DOCUMENT_UPDATED` to the audit log, and durably persists `.local/project-state.json`.
- **Access:** Mutating; requires authenticated human operator (`requireHuman(req, res)` returning valid session) and `humanConfirmed === true`.
- **Request Body (Client Identity Strictly Prohibited):**
  ```json
  {
    "candidateContent": "# Updated markdown content...",
    "baseSha256": "4a1b...",
    "reason": "Update project state following DMK-195 design review",
    "humanConfirmed": true
  }
  ```
  *(CRITICAL: If the request body contains ANY client identity or role claim—such as `actor`, `role`, `approver`, `reviewerName`, `reviewerRole`, `authorizedRole`, `identityId`, or `actorType`—the server immediately REJECTS the request with HTTP 400 Bad Request: `CLIENT_IDENTITY_CLAIMS_PROHIBITED`).*
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "documentId": "DOC-CTRL-002",
    "path": "docs/00_control/PROJECT_STATE.md",
    "previousSha256": "4a1b...",
    "newSha256": "7c9e...",
    "stateVersion": 31,
    "auditEventId": "AUD-MUIX89KL-1234",
    "timestamp": "2026-09-27T18:00:00.000Z"
  }
  ```

---

## 9. Path Safety

### Fail-Closed Resolution Flow
```
[ Client Request ]
       │
       ▼
1. Extract documentId (e.g., "DOC-CTRL-002")
       │
       ▼
2. Registry Lookup (lookup in authoritative bootstrap manifest)
       │  ├─ Not found in registry ──► Return 404 (DOCUMENT_NOT_REGISTERED)
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

## 10. Hash Verification & Line Ending Semantics

### Exact Raw-Byte Hashing
To maintain 100% mathematical consistency with `server/bootstrap/selfBootstrapIntegrity.ts`, document hashes are calculated over the **exact raw file bytes** on disk:
```typescript
export function computeRawFileSha256(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
```
**CRITICAL:** The server does NOT normalize `CRLF -> LF` before computing pinned integrity hashes. Normalizing line endings would create false agreement/disagreement against existing bootstrap verifiers.

### Status Classification Rules
1. **`MATCH` (Green Badge):** `sha256Digest` defined AND `currentSha256 === sha256Digest`.
2. **`CHANGED` (Amber Badge):** `sha256Digest` defined AND `currentSha256 !== sha256Digest`. Signals that on-disk bytes differ from reviewed baseline.
3. **`UNPINNED` (Blue Badge):** `sha256Digest` is null/undefined in registry AND file exists on disk. This is a healthy, expected status for living reference documents. It is NOT an error.
4. **`MISSING` (Red Alert Badge):** File does not exist at registered path.

### Line Ending Handling for Editable Living Documents
Browser text inputs normalize newlines to logical `\n`. To prevent unintended line-ending churn:
1. **Detection:** When reading a document, detect its EOL convention:
   - `LF`: contains `\n` without preceding `\r`.
   - `CRLF`: all `\n` are preceded by `\r`.
   - `MIXED`: contains both `\r\n` and bare `\n`.
2. **Preservation on Save:**
   - **`LF` source:** Candidate text is encoded with `\n`.
   - **`CRLF` source:** Candidate logical newlines are converted to `\r\n` before computing candidate hash, diff, or saving to disk.
   - **`MIXED` source:** Controlled editing is rejected fail-closed with `UNSUPPORTED_MIXED_LINE_ENDINGS`. Read-only viewing remains allowed.
3. **Candidate Hash Exactness:** Candidate SHA-256 is computed over the exact encoded bytes that will be written to disk.

---

## 11. Viewer UX & Existing Components Integration

### Coexistence Architecture (Preserving Gate 7 & Package Export)
DMK-195 does NOT replace or delete existing dynamic projection behavior. The existing `DocumentsView.tsx` component houses:
- Dynamic Markdown projections (PRD, SAD, THREAT, RTM, GOV, RELEASE).
- Package export and import triggers.
- **Gate 7 Release Sign-off workflow** (`POST /api/projects/:id/release/signoff`).

The Documentation Workspace (`currentView === 'documents'`) is structured with two top-level tabs:
1. **Tab 1: Repository Documents (New DMK-195 Controlled Workspace):**
   Displays the controlled repository documentation catalog, category navigation, safe rendered Markdown, raw source toggle, live raw-byte hash badges, and the controlled edit workflow.
2. **Tab 2: Dynamic Projections (Existing `DocumentsView` Reused As-Is):**
   Preserves the existing `DocumentsView` behavior exactly as implemented. Gate 7 sign-off and package transfer remain 100% untouched.

### Safe Markdown Rendering (Zero Custom Sanitizers)
- Propose using `react-markdown` with raw HTML interpretation disabled (no `rehype-raw`, no `dangerouslySetInnerHTML`).
- Raw HTML tags embedded in Markdown remain inert text.
- External links automatically receive `rel="noopener noreferrer"`.
- Dangerous URL schemes (`javascript:`, `data:`) are sanitized/neutralized.
- *(Note: `react-markdown` is recorded as a proposed implementation dependency and will be installed during Phase 2 implementation planning, not during this design task).*

---

## 12. Controlled Edit Workflow

For `CONTROLLED_EDIT` documents (`PROJECT_STATE.md`, `TRACEABILITY_MATRIX.md`), the UI enforces a 6-step state machine:

```
[ 1. VIEW ] ──► [ 2. EDIT DRAFT ] ──► [ 3. PREVIEW DIFF ] ──► [ 4. VALIDATE ] ──► [ 5. CONFIRM SAVE ] ──► [ 6. COORDINATED COMMIT ]
```

### DocSaveModal Requirements:
- Does NOT collect typed identity (no username/role inputs).
- Displays authenticated operator details from server session:
  - "Signed in as: Gio"
  - "Roles: Lead Architect"
- Collects:
  1. Mandatory confirmation checkbox: `[x] Confirm this governance document update` (`humanConfirmed: true`).
  2. Mandatory justification: Reason / change summary text.
- Strictly rejects any client attempts to inject identity fields with HTTP 400 Bad Request.

---

## 13. Coordinated Cross-Domain Document Transaction & Same-Filesystem Atomicity

### The Cross-Domain Partial Commit Problem
A document save affects two separate persistence domains:
1. **Filesystem:** The physical document file in `docs/`.
2. **Project Snapshot:** `.local/project-state.json` containing `stateVersion` and the `DOCUMENT_UPDATED` audit record.

If the document file is renamed on disk but the project snapshot persistence fails, the in-memory store rolls back while the on-disk document remains mutated, resulting in an unlogged, non-audited modification.

### Cross-Filesystem Atomicity & Target-Sibling Artifacts
`fs.renameSync` is only guaranteed to be atomic across POSIX and Windows NTFS when source and target reside in the **same directory on the same filesystem**. Attempting to rename from `.local/document-transactions/` across to `docs/` can violate atomicity if directories reside on different mount points or volumes.

Therefore, DMK-195 enforces **target-sibling artifact placement**:
- The transaction **JOURNAL** remains centralized under `.local/document-transactions/<operationId>.json`.
- The **CANDIDATE** and **ROLLBACK** artifacts are created strictly in `path.dirname(targetDocument)` as hidden sibling files:
  - Candidate Sibling: `docs/00_control/.PROJECT_STATE.md.dmk-<operationId>.candidate`
  - Rollback Sibling: `docs/00_control/.PROJECT_STATE.md.dmk-<operationId>.rollback`

These sibling files are internal transaction files:
- Never exposed through the Docs workspace registry.
- Never treated as registered docs.
- Automatically cleaned up after commit or rollback.

### Transaction Journal Record (`journal.json`):
```typescript
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
  phase: 'PREPARED' | 'DOCUMENT_REPLACED' | 'COMMITTED';
  createdAt: string;
}
```

### Save Execution Lifecycle:
1. **PREPARE Phase:**
   - Require `requireHuman(req, res)` and `humanConfirmed === true`.
   - Validate that the request body contains NO prohibited client identity claims (`actor`, `role`, `approver`, etc.). If present, immediately reject with HTTP 400 Bad Request (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`).
   - Validate document registration and `CONTROLLED_EDIT` permission.
   - Run format and structural validation on candidate content.
   - Verify `baseSha256 === liveRawFileSha256`.
   - Acquire document-level in-process write lock.
   - Capture current `projectSnapshotDigest()`.
   - Write rollback sibling file in target directory:
     `${targetDir}/.${targetBase}.dmk-${operationId}.rollback`
   - `fs.fsyncSync` rollback sibling file.
   - Write candidate sibling file in target directory:
     `${targetDir}/.${targetBase}.dmk-${operationId}.candidate`
   - `fs.fsyncSync` candidate sibling file.
   - Write journal under `.local/document-transactions/${operationId}.json` with `phase = 'PREPARED'`.
   - `fs.fsyncSync` journal file.
2. **DOCUMENT_REPLACED Phase:**
   - Atomically rename candidate sibling over target document (`fs.renameSync(candidateArtifactPath, targetPath)`).
   - Because both files reside in the same target directory, replacement is guaranteed same-filesystem atomic.
   - Update journal to `phase = 'DOCUMENT_REPLACED'` and `fs.fsyncSync`.
   - Rollback sibling is preserved.
3. **PROJECT_COMMIT Phase:**
   - Server persistence hooks integrate with `installProjectPersistence`:
     ```typescript
     res.locals.projectPersistenceHooks = {
       onCommit: () => {
         // Journal phase = 'COMMITTED', unlink candidate sibling, rollback sibling, journal; release lock
       },
       onRollback: () => {
         // Atomically restore original document from rollback sibling:
         // fs.renameSync(rollbackArtifactPath, targetPath)
         // Verify: SHA256(target) === previousSha256
         // If hash mismatch: report DOCUMENT_TRANSACTION_RECOVERY_REQUIRED
         // Unlink candidate sibling and journal; release lock
       }
     };
     ```
   - Increment `project.stateVersion` exactly once ($N \to N+1$).
   - Append `DOCUMENT_UPDATED` to `store.auditLogs[projectId]`.
   - Commit `.local/project-state.json` via standard atomic snapshot persistence.
4. **COMMITTED & CLEANUP Phase:**
   - Snapshot persistence succeeds. `onCommit` triggers.
   - Delete candidate sibling file.
   - Delete rollback sibling file.
   - Delete transaction journal.
   - Release lock.
   - Respond HTTP 200 OK.
   - *(Note: If cleanup fails after durable commit, do not report that document rolled back; distinguish `COMMIT_FAILED` from `COMMITTED_CLEANUP_PENDING` and retain journal for startup cleanup).*

### Startup Crash Recovery & Journal Path Validation
Before allowing new document mutations, the server scans `.local/document-transactions/`:
- **Untrusted Path Protection:** Paths in the journal are NOT trusted blindly. The server re-derives the authoritative target path from `documentId` + manifest registry, and re-derives expected sibling artifact paths. Any mismatch causes recovery to FAIL CLOSED.
- **Recovery Cases:**
  - **Case A (Completed):** Document hash matches `candidateSha256`, matching `DOCUMENT_UPDATED` audit event exists in snapshot, and `stateVersion` committed $\to$ Transaction completed. Clean up sibling artifacts and stale journal.
  - **Case B (Uncommitted Replace):** Document hash matches `candidateSha256`, but committed audit event is absent $\to$ Atomically restore target document from rollback sibling (`fs.renameSync(rollbackSibling, targetPath)`), verify `SHA256(target) === previousSha256`, and clean up journal.
  - **Case C (Uncommitted Prepare):** Document hash matches `previousSha256`, and audit event is absent $\to$ Operation never committed. Clean up candidate/rollback sibling artifacts and journal.
  - **Case D (Ambiguous State):** Rollback sibling missing, hashes corrupt, or inconsistent state $\to$ **FAIL CLOSED**. Halt document operations and report `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED`.

---

## 14. Validation Strategy

### Universal Invariants
- Valid UTF-8 encoding (no malformed sequences or null bytes).
- Non-empty content.
- File size $< 5$ MB.

### Document-Specific Structural Invariants
1. **`docs/00_control/PROJECT_STATE.md`:**
   - Must contain top-level title: `# docmonstakrakin current project state`.
   - Must contain a recognizable governance section: `Current governance and task status`.
   - Must contain entries referencing: `DMK-201`, `Gate 7`, `Live reconciliation`, and `Release status`.
   - *(Note: Avoids brittle heading depth checks (`##` vs `###`) to accommodate dated section evolution).*
2. **`docs/00_control/TRACEABILITY_MATRIX.md`:**
   - Structurally valid Markdown tables with recognized header rows.
   - Valid requirement and work item link format.

---

## 15. Persistence Middleware Extensions

### Pre-Persistence Classification Model
Because `installProjectPersistence(app, store, workspaceRoot)` is mounted under `app.use('/api/projects', ...)`, it intercepts requests before route handlers execute. Inside mounted middleware, `req.path` is relative to `/api/projects`.

To avoid mount-path discrepancies, the classifier computes the **normalized full routed path**:
```typescript
const routedPath = `${req.baseUrl}${req.path}`;
// Example: "/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff"
```

`installProjectPersistence` is extended with a **server-controlled pre-persistence classifier**:

```typescript
export type ProjectPersistenceMode = 'READ_ONLY' | 'MUTATING';

export interface ProjectPersistenceOptions {
  classifyRequest?: (req: Request) => ProjectPersistenceMode;
}
```

The classifier is **SERVER-INTERNAL**. Clients must NEVER choose persistence mode via body, query, header, or cookie (no `X-Persistence-Mode` header allowed).

### Classification Logic:
```typescript
function classifyProjectRequest(req: Request): ProjectPersistenceMode {
  const routedPath = `${req.baseUrl}${req.path}`;
  // Explicitly classify DMK-195 read-only preview endpoints
  if (
    req.method === 'POST' &&
    /^\/api\/projects\/[^/]+\/docs\/[^/]+\/(diff|validate)$/.test(routedPath)
  ) {
    return 'READ_ONLY';
  }
  // All other POST, PATCH, PUT, DELETE, and export routes remain MUTATING
  return 'MUTATING';
}
```
If the classifier returns an unknown or invalid mode, the middleware **FAILS CLOSED** (throws an error / 500), rather than silently downgrading to `READ_ONLY`.

### READ_ONLY Early-Exit Semantics
When classification is `READ_ONLY`, `installProjectPersistence` immediately invokes `return next()` without entering mutation transaction state.
This provides the following strict guarantees:
- `transactionInFlight` is NOT acquired.
- Project snapshot writer lock (`project-state.write.lock`) is NOT acquired.
- `.local/project-state.json` is NOT rewritten.
- `project.stateVersion` is unchanged.
- Audit ledger is unchanged.
- `persistedDigest` is unchanged.
- No mutation rollback snapshot is cloned or held in memory.

### Persistence Transaction Hooks
For mutating operations (such as document save), `installProjectPersistence` supports server-internal hooks:
```typescript
res.locals.projectPersistenceHooks = {
  onCommit?: () => void;
  onRollback?: () => void;
};
```
Invoked immediately after successful snapshot write (`onCommit`) or upon failure/error rollback (`onRollback`).

---

## 16. Audit Model

Every successful document modification generates a tamper-evident, cryptographically chained `AuditEvent`:

```typescript
{
  "id": "AUD-MUIX89KL-1234",
  "actor": "Gio",
  "timestamp": "2026-09-27T18:00:00.000Z",
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
    "authenticatedIdentity": "usr-lead-architect-01",
    "roles": ["Lead Architect"],
    "roleSource": "LOCAL_SERVER_ROSTER",
    "linesAdded": 5,
    "linesRemoved": 2
  }
}
```

Identity details (`actor`, `authenticatedIdentity`, `roles`, `roleSource`) are populated strictly from the server-validated session, never from client input.

---

## 17. Project Isolation

1. **Registry Scoping:**
   - `PRJ-DOCMONSTAKRAKIN`: Has the repository document collection loaded from `bootstrap/docmonstakrakin.self-bootstrap.json`.
   - Other Projects (`PRJ-ATLAS-01`, `PRJ-FINPAY-02`): Return `{ "projectId": id, "documents": [] }`.
2. **UI Isolation:**
   When an external project is active, the "Repository Documents" tab displays an explicit empty state:
   > **No Repository Documentation Available**
   > Project `PRJ-ATLAS-01` does not have a repository-controlled documentation registry configured.
3. **State Reset:** Switching projects immediately clears selected document IDs, in-memory drafts, and diff previews.

---

## 18. Dogfooding Model

### Separation of Concerns:
- **Canonical Planning Authority:** `docs/00_control/MASTER_WBS.yaml`
- **Operational Execution Tracking:** `docmonstakrakin` runtime / application state

### Step-by-Step Dogfooding Transition (Phase 2):
During Phase 1 (this design task), NO status transitions occur. Once this design specification and its implementation plan are approved by a human:
1. **Update Canonical WBS:**
   Update `docs/00_control/MASTER_WBS.yaml`:
   `DMK-195 status: BACKLOG -> IN_PROGRESS`
2. **Regenerate & Verify WBS Projection:**
   Run `npm run wbs:render` and verify zero drift via `npm run wbs:check` to synchronize `docs/00_control/MASTER_WBS.md`.
3. **Update Runtime WorkItem via Canonical API:**
   Issue `POST /api/projects/PRJ-DOCMONSTAKRAKIN/work-items` to transition runtime `DMK-195` from `PROPOSED` to `IN_PROGRESS`.
4. **Verify Audit Ledger:**
   Confirm `WORK_ITEM_UPDATED` audit event is chained.
5. **Verify Isolation:**
   Confirm that only `DMK-195` was updated; historical items and DMK-201 remain completely untouched.

---

## 19. Threat Model

| Threat ID | Threat Name | Attack Scenario | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **THR-DOC-001** | Directory Traversal | Attacker provides `../../etc/passwd` or `..\\private_keys`. | **ID-Only Lookup & Boundary Clamp:** Client provides only `documentId`. The server resolves relative path exclusively from manifest registry and clamps to `docs/`. |
| **THR-DOC-002** | Symlink Escape | Symlink inside `docs/` targets external files. | **Realpath Verification:** Resolves `fs.realpathSync` and ensures real path remains within `docs/`. |
| **THR-DOC-003** | Arbitrary File Read | Attacker requests unregistered files inside `docs/` (e.g. `LAST_HANDOFF.md` or verification reports). | **Strict Registry Whitelist:** Only manifest-registered documents are accessible. Unregistered files return HTTP 404. |
| **THR-DOC-004** | Arbitrary File Write | Attacker attempts to overwrite read-only baseline documents. | **Strict Allowlist:** Server verifies `editability === 'CONTROLLED_EDIT'`. Only `DOC-CTRL-002` and `DOC-CTRL-006` permit editing. |
| **THR-DOC-005** | TOCTOU / Stale Overwrite | Concurrent edits overwrite each other. | **Optimistic Concurrency via Base Hash:** Save requires `baseSha256`. Server verifies live hash immediately before writing; rejects stale edits with HTTP 409 `DOCUMENT_STALE`. |
| **THR-DOC-006** | Projection Mutation | Direct edit of `MASTER_WBS.md` causes drift from `MASTER_WBS.yaml`. | **Immutable Projections:** All `GENERATED_PROJECTION` documents are strictly `READ_ONLY`. Saves rejected with HTTP 403. |
| **THR-DOC-007** | WBS Authority Corruption | User attempts to edit `MASTER_WBS.yaml` through Docs UI. | **WBS Exclusion:** `MASTER_WBS.yaml` is excluded from allowlist and enforced as `READ_ONLY`. |
| **THR-DOC-008** | Cross-Project Leakage | Selecting `PRJ-ATLAS-01` displays docmonstakrakin documents. | **Project-Scoped Registry:** External projects return empty registries; UI shows explicit empty state. |
| **THR-DOC-009** | Unsafe Markdown / XSS | Malicious Markdown contains executable HTML scripts. | **Disabled Raw HTML:** `react-markdown` configured with raw HTML interpretation disabled; dangerous schemes (`javascript:`) neutralized. |
| **THR-DOC-010** | Malformed Syntax / Corruption | Submitting malformed YAML or corrupted text. | **Pre-Save Syntax Validation:** Server runs parsers before committing files; malformed syntax rejected with HTTP 422. |
| **THR-DOC-011** | Cross-Domain Partial Commit | Document replaced on disk, but project snapshot write fails, losing audit log. | **Coordinated Transaction Journal:** `.local/document-transactions/` journal with target-sibling rollback copy, persistence hooks, and startup recovery guarantees complete atomic rollback or commit. |
| **THR-DOC-012** | Line Ending Integrity Confusion | Platform newline differences cause raw-byte mismatch against pinned digest. | **Raw-Byte Semantics & EOL Preservation:** Hashes computed over exact bytes; living docs preserve detected EOL; mixed EOL fails closed. |
| **THR-DOC-013** | File Encoding / DoS | Submitting oversized files ($> 5$MB) or non-UTF-8 payloads. | **Size Limit & UTF-8 Clamp:** Enforces 5MB payload limit and UTF-8 validation. |
| **THR-DOC-014** | Client Identity Injection | Attacker supplies fabricated `actor` or `role` in save payload. | **Strict Claim Rejection:** Any request containing client identity/role claims is rejected with HTTP 400 Bad Request (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`). Actor details are derived exclusively from session. |
| **THR-DOC-015** | Cross-Filesystem Rename Assumption | Candidate/backup files placed under `.local` fail atomic rename across different filesystem mounts to `docs/`. | **Target-Sibling Placement:** Candidate and rollback artifacts are placed in `path.dirname(targetDocument)`; forward and rollback renames remain strictly same-filesystem atomic operations. |

---

## 20. Test Strategy

### Comprehensive Test Matrix (Tests A through AN)
- **Test A (Registry Listing):** `GET /api/projects/:id/docs` returns exactly the 28 manifest-registered documents for `PRJ-DOCMONSTAKRAKIN`.
- **Test B (Authority Classification):** Verify every document correctly reports `authority: 'REFERENCE'` or `'GENERATED_PROJECTION'`.
- **Test C (Hash-Pinned MATCH):** Pinned documents matching disk return `integrityStatus: 'MATCH'`.
- **Test D (Hash-Pinned CHANGED):** Modified pinned document file returns `integrityStatus: 'CHANGED'`.
- **Test E (UNPINNED Living Documents):** Living documents return `integrityStatus: 'UNPINNED'` and are not flagged as errors.
- **Test F (Traversal Rejection):** Traversal sequences in document lookup fail closed with HTTP 403/404.
- **Test G (Absolute Path Rejection):** Absolute paths fail closed.
- **Test H (Unregistered Document Rejection):** Requesting an unregistered document ID returns HTTP 404.
- **Test I (Project Isolation):** Docs for `PRJ-ATLAS-01` returns empty array.
- **Test J (Projection Edit Rejection):** `POST .../save` targeting `DOC-CTRL-004` (`MASTER_WBS.md`) returns HTTP 403.
- **Test K (`MASTER_WBS.yaml` Edit Rejection):** `POST .../save` targeting `DOC-CTRL-003` (`MASTER_WBS.yaml`) returns HTTP 403.
- **Test L (Controlled Editable Flow):** `POST .../save` targeting `DOC-CTRL-002` succeeds with valid content and matching base hash.
- **Test M (Diff Non-Mutating):** `POST .../diff` computes diff without altering target file or writing temporary files.
- **Test N (Validation Failure Blocks Save):** Malformed content returns HTTP 422 and preserves on-disk content.
- **Test O (Stale Base Hash Rejection):** Mismatched `baseSha256` returns HTTP 409 `DOCUMENT_STALE`.
- **Test P (Atomic Persistence):** Writes to sibling `.candidate` first, renames atomically, leaves zero leftover sibling files.
- **Test Q (Audit Event Correctness):** Successful save appends `DOCUMENT_UPDATED` event maintaining hash chain continuity.
- **Test R (Persistence & Reload):** Updated content survives server restart.
- **Test S (Project Switching State Reset):** Switching projects clears document selection and draft state.
- **Test T (UI Smoke & Accessibility):** React components render without console errors.
- **Test U (Diff Preserves Snapshot Bytes & Early Exit):** Executing `POST .../diff` leaves `.local/project-state.json` SHA-256 byte-for-byte identical, `stateVersion` unchanged, audit count unchanged, acquires zero writer locks, creates zero snapshot temp files, and enters zero mutation transactions.
- **Test V (Validate Preserves Snapshot Bytes & Early Exit):** Executing `POST .../validate` leaves `.local/project-state.json` SHA-256 byte-for-byte identical, `stateVersion` unchanged, audit count unchanged, acquires zero writer locks, creates zero snapshot temp files, and enters zero mutation transactions.
- **Test W (stateVersion Increment):** Successful save increments `project.stateVersion` exactly once ($N \to N+1$).
- **Test X (Client Identity Claims Rejected):** Submitting any client identity/role claims (`actor`, `role`, `approver`, `reviewerName`, `reviewerRole`, `authorizedRole`, `identityId`, `actorType`) in `POST .../save` is rejected with HTTP 400 Bad Request (`CLIENT_IDENTITY_CLAIMS_PROHIBITED`), leaving document bytes, `stateVersion`, and audit ledger unchanged with zero transaction journals created.
- **Test Y (Persistence Failure Restores Document):** Injected snapshot persistence failure triggers rollback hook, restoring original document from rollback sibling file.
- **Test Z (Startup Recovery Restores Unaudited Replace):** Startup recovery restores document from rollback sibling when `DOCUMENT_REPLACED` exists without committed audit event.
- **Test AA (Stale COMMITTED Journal Cleans Safely):** Startup recovery removes leftover transaction files when audit record is fully committed.
- **Test AB (Ambiguous Journal Fails Closed):** Corrupted journal halts document mutations with `DOCUMENT_TRANSACTION_RECOVERY_REQUIRED`.
- **Test AC (Raw Markdown HTML Inert):** Embedded `<script>` or HTML tags render as inert text in Markdown viewer.
- **Test AD (Unregistered docs/ File Invisible):** Files in `docs/` omitted from manifest are not listed and return 404.
- **Test AE (LAST_HANDOFF Unavailable):** `docs/00_control/LAST_HANDOFF.md` returns 404 while unregistered.
- **Test AF (Raw-Byte Hashing Semantics):** Pinned hash verification matches `server/bootstrap/selfBootstrapIntegrity.ts` without CRLF normalization.
- **Test AG (EOL Style Preservation):** Saving an LF file writes LF; saving a CRLF file writes CRLF.
- **Test AH (Mixed-EOL Edit Fails Closed):** Attempting to save a mixed-EOL document is rejected with `UNSUPPORTED_MIXED_LINE_ENDINGS`.
- **Test AI (Mounted Path Classification):** In an actual Express app with `app.use('/api/projects', persistenceMiddleware)`, issuing `POST /api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff` is classified as `READ_ONLY`, `POST .../validate` is classified as `READ_ONLY`, and `POST .../save` is classified as `MUTATING`, proving routing classification uses `${req.baseUrl}${req.path}`.
- **Test AJ (Candidate Sibling Placement):** Candidate artifact resides in `path.dirname(targetDocument)` as `.PROJECT_STATE.md.dmk-<opId>.candidate`.
- **Test AK (Rollback Sibling Placement):** Rollback artifact resides in `path.dirname(targetDocument)` as `.PROJECT_STATE.md.dmk-<opId>.rollback`.
- **Test AL (Forward Same-Directory Replacement):** Replacement uses candidate sibling -> target (`fs.renameSync`), never `.local` -> `docs` rename.
- **Test AM (Atomic Rollback Same-Directory Replacement):** Rollback uses rollback sibling -> target and verifies restored raw-byte hash equals `previousSha256`.
- **Test AN (Journal Path Tampering):** Altered candidate/rollback paths in journal fail closed and cannot redirect filesystem writes. Authoritative paths are always re-derived from manifest registry.

---

## 21. Expected Files / Components

### Proposed Server Modules (Phase 2)
1. **`server/docs/controlledDocsRegistry.ts`:**
   - Authoritative bootstrap manifest registry loader.
   - Metadata and editability enrichment.
2. **`server/docs/controlledDocsPersistence.ts`:**
   - Safe path resolution and confinement clamp.
   - Raw-byte hashing and EOL detection/encoding.
   - Low-level atomic file replacement primitives.
3. **`server/docs/controlledDocsValidator.ts`:**
   - Universal, Markdown, and structural validators.
4. **`server/docs/controlledDocsTransaction.ts`:**
   - Transaction journal management under `.local/document-transactions/`.
   - Target-sibling candidate and rollback artifact management.
   - Cross-domain coordination, persistence hook integration, and startup crash recovery.
5. **`server/docs/controlledDocsRouter.ts`:**
   - HTTP route definitions.
   - Authentication enforcement (`requireHuman`).
   - Strict rejection of client identity claims (HTTP 400).

### Existing Files to Modify (Phase 2)
1. **`server/projectPersistence.ts`:**
   - Support pre-persistence request classifier `classifyRequest(req): ProjectPersistenceMode` using full routed path `${req.baseUrl}${req.path}`.
   - Implement `READ_ONLY` early-exit path.
   - Support `res.locals.projectPersistenceHooks`.
2. **`server.ts`:**
   - Pass `classifyRequest` to `installProjectPersistence`.
   - Mount controlled docs router under `/api/projects/:id/docs`.
   - Run transaction recovery check on startup.
3. **`src/types.ts`:**
   - Export controlled document record and summary types.
4. **`src/components/ControlledDocsView.tsx`:**
   - Dual-tab container hosting Tab 1 ("Repository Documents") and Tab 2 ("Dynamic Projections").
5. **`package.json`:**
   - Proposed implementation dependency: `react-markdown` (to be installed in Phase 2).

---

## 22. Rollout / Verification

1. **Unit & Boundary Tests:** `npx tsx scripts/testControlledDocs.ts` (covering Tests A through AN).
2. **UI Smoke Tests:** `npx tsx scripts/testControlledDocsUi.ts`.
3. **Full Regression Suite:** `npm run test:complete` (30/30 suites passing).
4. **Automated QA Suite:** `npm run qa` (11/11 criteria passing).
5. **WBS Consistency Check:** `npm run wbs:check`.
6. **Human UI Evaluation:** Operator verification in browser.

---

## 23. Explicit Exclusions

- Gate 7 sign-off or release promotion.
- Historical DMK-201 reconciliation or recovery execution.
- DMK-196 formal sign-off UX.
- DMK-197 Approval Inbox.
- Arbitrary file creation on disk.
- Direct editing of `MASTER_WBS.yaml` or `MASTER_WBS.md`.

---

## 24. Open Issues, if any

None. All architectural questions identified during Phase 1 have been resolved:
- Mounted path classification using `${req.baseUrl}${req.path}` and `READ_ONLY` early-exit semantics are formally defined.
- Same-filesystem atomicity is guaranteed via target-sibling candidate and rollback placement.
- Client identity claims are strictly rejected with HTTP 400 Bad Request.
- Coexistence with `DocumentsView` is resolved via dual-tab layout (Repository Documents vs Dynamic Projections).
- Cross-domain partial commit is resolved via journaled transaction in `controlledDocsTransaction.ts`.
- Safe Markdown rendering is resolved via `react-markdown` with disabled raw HTML.
