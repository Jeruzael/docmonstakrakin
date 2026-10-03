# DMK-205 — Canonical WBS → Runtime WorkItem Synchronization Design Specification

**Document ID:** SPEC-DMK-205-01  
**Authority:** Technical Specification (Living Architecture)  
**WorkItem:** `DMK-205` (`13.06.18`)  
**Project:** `PRJ-DOCMONSTAKRAKIN`  
**Date:** 2026-10-02  
**Status:** APPROVED / IN_PROGRESS  

---

## 1. Executive Summary & Objective

In DOCMONSTAKRAKIN, the canonical repository Work Breakdown Structure (`docs/00_control/MASTER_WBS.yaml`) is the supreme governance and planning authority. However, the Work Management Board in the user interface renders from runtime `ProjectStore.workItems['PRJ-DOCMONSTAKRAKIN']` stored in `.local/project-state.json`.

Historically, when new tasks (such as `DMK-203`, `DMK-204`, and `DMK-205`) were planned and tracked in `MASTER_WBS.yaml`, they did not automatically populate the operational board. Furthermore, the Work Management WBS view relied on a hard-coded static array of tasks (`EPIC-01`, `EPIC-02`) rather than reflecting the real canonical WBS hierarchy.

**DMK-205 establishes a self-tracking architecture:**
1. A governed, one-way reconciliation engine (`WBS → runtime`) that detects missing items, status drift, and metadata drift for `PRJ-DOCMONSTAKRAKIN`.
2. A dynamic read-only canonical WBS projection API and UI in Work Management replacing all hard-coded task arrays.
3. Strict enforcement of repository authority: runtime state never writes back to `MASTER_WBS.yaml`.
4. Governed administrative apply with cryptographic pre-conditions, anti-TOCTOU validation, atomic snapshot updates, and chained audit logging.

---

## 2. Source-of-Truth Contract

The boundaries of ownership between canonical repository artifacts and operational runtime state are non-negotiable:

### Rule A: Canonical Repository Authority (`MASTER_WBS.yaml`)
`MASTER_WBS.yaml` is the sole source of truth for:
- `id` (Permanent WorkItem ID, e.g. `DMK-205`)
- `wbs_path` (Hierarchical path, e.g. `13.06.18`)
- `parent_id` / `epic` (e.g. `EPIC-13`)
- `phase` (e.g. `PHASE-12`)
- `title`
- `description`
- `type` (Canonical type: `BUG`, `FEATURE`, `GOVERNANCE`, `INFRASTRUCTURE`, `QUALITY`, `RELEASE`, `SECURITY`)
- `priority` (`P0`, `P1`, `P2`, `P3`)
- `risk` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `requirements` (Traceability links)
- `dependencies`
- `acceptance_criteria`
- `verification_method`
- Canonical lifecycle status (`PROPOSED`, `BACKLOG`, `READY`, `IMPLEMENTED`, `VERIFICATION_PENDING`, `VERIFIED`)
- Repository verification evidence (`evidence` list, verification notes)

### Rule B: Operational Runtime Authority (`ProjectStore`)
The runtime store is authoritative exclusively for runtime execution fields:
- `sprint` (Operational sprint assignment)
- `checklist` execution state (checked/unchecked progress)
- `owner` / operator assignment
- Runtime timestamps (`createdAt`, `updatedAt`)
- Runtime-only execution metadata and execution logs
- UI selection and board placement state

### Rule C: Zero Runtime Writeback
Runtime code and user interface operations MUST NEVER regenerate, write, or mutate `MASTER_WBS.yaml`.

### Rule D: Strictly One-Way Synchronization
The dataflow is strictly:
```
MASTER_WBS.yaml (Canonical Authority)
       ↓
Reconciliation Engine (Diff & Planning)
       ↓
ProjectStore.workItems['PRJ-DOCMONSTAKRAKIN'] (Operational Projection)
       ↓
Board / Backlog / Sprint Views
```
Bidirectional synchronization is strictly prohibited.

### Rule E: Canonical WBS Projection View
Work Management's "WBS" tab is a live read-only projection of `MASTER_WBS.yaml`. It exposes the true repository hierarchy dynamically, indicating the sync status against runtime state.

### Rule F: Board Operational Autonomy
Work Management's "Board", "Backlog", and "Sprint" views consume operational runtime WorkItems.

### Rule G: Visible, Governed Drift
Any discrepancy between canonical WBS and runtime WorkItems is detected as drift, made transparent in a read-only review banner, and resolved only via an explicitly authorized administrative apply.

---

## 3. Self-Project Operational Scope

To prevent flooding the active Kanban board with hundreds of historical bootstrap tasks, the operational synchronization scope for `PRJ-DOCMONSTAKRAKIN` in DMK-205 v1 is bounded to:
- **Project:** `PRJ-DOCMONSTAKRAKIN`
- **Scope Filter:** Items where `epic === 'EPIC-13'` or `parent_id === 'EPIC-13'` in `MASTER_WBS.yaml`.

This operational scope directly captures DOCMONSTAKRAKIN's active self-governance program (`DMK-187` through `DMK-205+`). The Work Management WBS view continues to project the full canonical hierarchy for comprehensive navigation.

---

## 4. Status and Type Mappings

### 4.1 Status Mapping Matrix
Canonical WBS status vocabulary maps deterministically to runtime `WorkItemStatus`:

| Canonical WBS Status | Mapped Runtime Status | Rationale |
|---|---|---|
| `PROPOSED` | `PROPOSED` | Direct 1:1 match |
| `BACKLOG` | `BACKLOG` | Direct 1:1 match |
| `READY` | `READY` | Direct 1:1 match |
| `IMPLEMENTED` | `VERIFICATION` | Implementation complete; awaiting verification |
| `VERIFICATION_PENDING` | `VERIFICATION` | Testing complete; awaiting verification/review |
| `VERIFIED` | `VERIFIED` | Final verified state (governance provenance required) |

**Fail-Closed Invariant:** Any unrecognized canonical status (e.g. unknown strings) throws `UNSUPPORTED_WBS_STATUS` and aborts reconciliation planning.

### 4.2 Type Mapping Matrix
Canonical WBS type vocabulary maps deterministically to runtime `WorkItemType`:

| Canonical WBS Type | Mapped Runtime Type | Preservation |
|---|---|---|
| `FEATURE` | `FEATURE` | `canonicalWbsType: 'FEATURE'` |
| `BUG` | `TASK` | `canonicalWbsType: 'BUG'` |
| `INFRASTRUCTURE` | `TASK` | `canonicalWbsType: 'INFRASTRUCTURE'` |
| `GOVERNANCE` | `TASK` | `canonicalWbsType: 'GOVERNANCE'` |
| `QUALITY` | `VERIFICATION` | `canonicalWbsType: 'QUALITY'` |
| `SECURITY` | `SECURITY` | `canonicalWbsType: 'SECURITY'` |
| `RELEASE` | `RELEASE` | `canonicalWbsType: 'RELEASE'` |

**Fail-Closed Invariant:** Any unrecognized canonical type throws `UNSUPPORTED_WBS_TYPE` and aborts reconciliation planning.

---

## 5. WorkItem Extended Canonical Metadata

Runtime `WorkItem` is extended with optional provenance attributes:
```typescript
interface WorkItem {
  // Existing runtime fields
  id: string;
  parentEpicId: string;
  type: WorkItemType;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: Priority;
  risk: RiskLevel;
  sprint: number;
  owner?: string;
  requirements: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  evidence: string[];
  checklist: ChecklistItem[];
  updatedAt: string;

  // DMK-205 Canonical Metadata Extensions
  canonicalManaged?: boolean;
  canonicalWbsPath?: string;
  canonicalWbsStatus?: string;
  canonicalWbsType?: string;
  canonicalSource?: 'MASTER_WBS';
}
```

---

## 6. Reconciliation Engine Architecture (`selfWorkItemReconciliation.ts`)

### 6.1 Plan Schema: `DMK_SELF_WBS_SYNC_V1`
A dry-run produces a tamper-evident, deterministic reconciliation plan:
- `planId`: Deterministic UUID/timestamp string
- `formatVersion`: `'DMK_SELF_WBS_SYNC_V1'`
- `projectId`: `'PRJ-DOCMONSTAKRAKIN'`
- `actor`: Requesting reviewer/operator
- `timestamp`: Reviewed ISO timestamp
- `wbsSha256`: Raw SHA-256 digest of `MASTER_WBS.yaml`
- `beforeSnapshotSha256`: SHA-256 digest of `.local/project-state.json`
- `stateVersion`: Current project stateVersion
- `auditCount`: Current project audit count
- `categories`:
  - `SYNCED`: Items in full alignment
  - `MISSING_RUNTIME`: Items in canonical WBS but absent in runtime
  - `STATUS_DRIFT`: Runtime status differs from mapped canonical status
  - `METADATA_DRIFT`: Canonical attributes differ (title, description, priority, criteria, etc.)
  - `RUNTIME_ONLY`: Runtime items with no canonical counterpart (reported as warnings; never deleted)
  - `BLOCKED`: Items failing verification provenance or invariant checks
- `proposedCreations`: Full WorkItem payloads to create
- `proposedUpdates`: Exact property diffs to patch
- `planDigest`: SHA-256 hash of canonicalized plan payload
- `candidateSnapshotDigest`: Anticipated SHA-256 digest of snapshot post-apply

### 6.2 Zero-Mutation Dry Run
Calling `--dry-run` executes all parsing, diffing, digest calculation, and candidate generation without modifying disk, database, or memory state.

---

## 7. Atomic & Governed Apply Model

Applying a reconciliation plan requires:
1. Exact plan file path (`--plan <file>`)
2. Exact project confirmation (`--confirm-project-id PRJ-DOCMONSTAKRAKIN`)
3. Exact plan digest confirmation (`--confirm-plan-digest <hex>`)
4. Explicit environment gate: `DMK_WBS_SYNC_EXECUTE=PRJ-DOCMONSTAKRAKIN`
5. Anti-TOCTOU check:
   - Re-read `MASTER_WBS.yaml` and verify its SHA-256 matches `plan.wbsSha256`.
   - Re-read `.local/project-state.json` and verify its SHA-256 matches `plan.beforeSnapshotSha256`.
6. Acquire exclusive transaction/snapshot writer lock.
7. Apply updates:
   - For `MISSING_RUNTIME`: Insert new WorkItem with fresh unchecked checklist.
   - For `STATUS_DRIFT` and `METADATA_DRIFT`: Patch canonical-owned fields while preserving runtime-owned fields (`sprint`, `owner`, `checklist`).
   - For `RUNTIME_ONLY`: Retain untouched.
8. State Version & Audit Increment:
   - `stateVersion` advances by exactly 1.
   - Append exactly 1 `WORK_ITEMS_WBS_SYNCHRONIZED` audit event linked to preceding hash.
9. Atomic save to disk (`.local/project-state.json`) via sibling write + atomic replace.
10. Release writer lock.

---

## 8. Protection Against Un-Governed Runtime Status Mutation

When a WorkItem has `canonicalManaged === true`, changing its status via generic runtime endpoints (`PATCH /api/projects/:id/work-items/:itemId` or Kanban drag-and-drop) must fail closed:
- Return HTTP 409 `Conflict`
- Error code: `CANONICAL_WBS_STATUS_OWNED`
- Message: *"Status is owned by the canonical repository WBS. Update canonical WBS through the governed repository workflow, then reconcile runtime."*
- UI renders the status dropdown as disabled with an explanatory tooltip for canonical-managed items. Operational checklist toggles remain permitted.

---

## 9. Work Management UI Modernization

### 9.1 Dynamic Canonical WBS Tab
In `src/components/WorkView.tsx`, remove the hard-coded `const wbsGroups = ...` definition. Replace with dynamic rendering:
- Fetch canonical WBS hierarchy from `GET /api/projects/:id/wbs`.
- Group by `epic` / `parent_id`.
- Sort by `wbs_path`.
- For each row, show canonical status and compare with runtime status to display real-time sync state (`SYNCED`, `MISSING_RUNTIME`, `STATUS_DRIFT`).

### 9.2 Synchronization Summary Banner & Review Modal
In Work Management for `PRJ-DOCMONSTAKRAKIN`, display a compact status banner:
- Canonical items count, Runtime WorkItems count.
- Count of missing, status drift, metadata drift, and blocked items.
- "Review Reconciliation" button opening a read-only diff inspection dialog showing exact canonical vs runtime states.

---

## 10. Traceability & Non-Negotiable Invariants

| Invariant | Rule |
|---|---|
| Repository Authority | `MASTER_WBS.yaml` is immutable from runtime; zero writeback. |
| Runtime-Only Preservation | Runtime items never deleted; runtime checklist/sprint preserved. |
| Atomic Mutation | Exactly 1 `stateVersion` bump, exactly 1 chained audit event per batch. |
| Anti-TOCTOU | Recheck WBS and snapshot hashes immediately prior to disk commit. |
| Gate 7 Isolation | Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`. |
| Release Status | Release remains `v0.1.0-rc1`. |
