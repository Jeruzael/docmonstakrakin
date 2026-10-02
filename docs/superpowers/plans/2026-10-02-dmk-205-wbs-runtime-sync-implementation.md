# DMK-205 Canonical WBS → Runtime WorkItem Synchronization Implementation Plan

**WorkItem:** `DMK-205` (`13.06.18`)  
**Project:** `PRJ-DOCMONSTAKRAKIN`  
**Date:** 2026-10-02  
**Status:** IMPLEMENTED / VERIFICATION_PENDING  
**Spec Reference:** `docs/superpowers/specs/2026-10-02-dmk-205-wbs-runtime-sync-design.md`  

---

## 1. Executive Summary & Objectives

The purpose of DMK-205 is to close the architectural self-tracking gap in DOCMONSTAKRAKIN. `MASTER_WBS.yaml` is the authoritative source for planning and governance. However, the Work Management Board previously displayed only items present in the runtime `ProjectStore.workItems['PRJ-DOCMONSTAKRAKIN']`, omitting newly planned self-project tasks (`DMK-203`, `DMK-204`, `DMK-205`), while the Work Management WBS view relied on a static hardcoded array.

**Core Objectives:**
1. Provide a strictly one-way synchronization engine (`WBS → runtime`) bounded to `EPIC-13` for `PRJ-DOCMONSTAKRAKIN`.
2. Guarantee zero runtime writeback to `MASTER_WBS.yaml`.
3. Provide a dynamic read-only canonical WBS projection in Work Management with real-time sync indicators.
4. Protect canonical items from unauthorized runtime status changes (HTTP 409 `CANONICAL_WBS_STATUS_OWNED`).
5. Support a tamper-evident administrative CLI with dry-run planning, digest verification, anti-TOCTOU validation, atomic snapshot apply, single stateVersion bump, and chained audit logging.
6. Preserve operational runtime fields (`sprint`, `owner`, `checklist`). Never delete runtime-only items.

---

## 2. Global Invariants & Constraints

1. **Repository Authority:** `MASTER_WBS.yaml` is the immutable source of truth for task definitions, hierarchy, and canonical status.
2. **Zero Runtime Writeback:** Operational runtime code and UI actions must never write or mutate `MASTER_WBS.yaml`.
3. **One-Way Dataflow:** Synchronization flows strictly from WBS to runtime store.
4. **Scope Bounded to EPIC-13:** Operational runtime sync for `PRJ-DOCMONSTAKRAKIN` v1 is strictly bounded to `EPIC-13` items.
5. **Fail-Closed Vocabulary:** Unrecognized canonical statuses or types abort reconciliation with explicit errors (`UNSUPPORTED_WBS_STATUS`, `UNSUPPORTED_WBS_TYPE`).
6. **Provenance Required for VERIFIED:** Items marked `VERIFIED` in canonical WBS require verification metadata (`verifiedBy`, `verificationStatus`, `humanApprovedBy`, non-empty `evidence`); otherwise they are blocked from runtime status elevation.
7. **Runtime Field Preservation:** Operational assignments (`sprint`, `owner`) and `checklist` progress are preserved during updates.
8. **Runtime-Only Preservation:** Items existing only in runtime are reported as warnings and never deleted.
9. **Single State Version & Audit Increment:** Applying a reconciliation plan advances `stateVersion` by exactly 1 and appends exactly 1 `WORK_ITEMS_WBS_SYNCHRONIZED` audit event.
10. **Anti-TOCTOU:** Both WBS SHA-256 and snapshot SHA-256 are verified prior to commit.
11. **Gate 7 Isolation:** Gate 7 strictly remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
12. **Release Version Unaltered:** Release tag remains `v0.1.0-rc1`.

---

## 3. Implementation Tasks

### Task 1: Canonical WBS Updates
- Added `DMK-205` (`13.06.18`) to `docs/00_control/MASTER_WBS.yaml` under `EPIC-13`.
- Rendered and verified `docs/00_control/MASTER_WBS.md` via `npm run wbs:render && npm run wbs:check`.

### Task 2: Core Work Tracking Modules
- `server/workTracking/canonicalWbs.ts`: Implemented canonical parser, raw SHA-256 digest computation, duplicate ID/path validation, EPIC-13 scoping, and hierarchy tree generation.
- `server/workTracking/wbsMapping.ts`: Implemented deterministic status, type, priority, and risk mapping matrices with fail-closed errors.
- `src/types.ts`: Extended `WorkItem` interface with canonical metadata (`canonicalManaged`, `canonicalWbsPath`, `canonicalWbsStatus`, `canonicalWbsType`, `canonicalSource`).
- `server/workTracking/selfWorkItemReconciliation.ts`: Implemented dry-run planning (`DMK_SELF_WBS_SYNC_V1`), drift categorization (`SYNCED`, `MISSING_RUNTIME`, `STATUS_DRIFT`, `METADATA_DRIFT`, `RUNTIME_ONLY`, `BLOCKED`), provenance verification, candidate snapshot generation, anti-TOCTOU validation, and atomic apply.

### Task 3: Server Endpoints & Mutation Guards
- `GET /api/projects/:id/wbs`: Returns canonical WBS hierarchy for `PRJ-DOCMONSTAKRAKIN`.
- `GET /api/projects/:id/work-items/reconciliation`: Returns live read-only reconciliation status for `PRJ-DOCMONSTAKRAKIN`.
- Guard in `POST /api/projects/:id/work-items`: Returns HTTP 409 `CANONICAL_WBS_STATUS_OWNED` when attempting to alter status of canonical-managed items.

### Task 4: Work Management UI Modernization
- `src/App.tsx`: Propagated `projectId={activeProjectId}` to `<WorkView />`.
- `src/components/WorkView.tsx`: Removed static hardcoded WBS groups. Replaced with dynamic epic grouping and path sorting. Added sync badges (`SYNCED`, `MISSING_RUNTIME`, `STATUS_DRIFT`), reconciliation review modal, summary banner, and disabled status selector with explanatory note for canonical-managed items.

### Task 5: Administrative Tooling & Independent Verifier
- `scripts/reconcileSelfWorkItems.ts`: Command-line tool supporting `--dry-run` and governed `--apply`.
- `scripts/verifySelfWorkItemReconciliation.ts`: Independent verifier checking before/after snapshots against plan invariants and validating the audit ledger chain.
- `package.json`: Added `test:self-work-sync`, `reconcile:self-work`, and `verify:self-work-sync`.

### Task 6: Test Suite Implementation
- `scripts/testSelfWorkItemReconciliation.ts`: Implemented 36 comprehensive test scenarios covering parser integrity, fail-closed mapping, drift detection, verification provenance, zero-mutation dry run, anti-TOCTOU rejection, atomic apply, and verifier checks.

### Task 7: Governed Project State Update & PR Verification
- Transition `DMK-205` canonical status in `MASTER_WBS.yaml` from `READY` to `VERIFICATION_PENDING`.
- Re-render `MASTER_WBS.md` and check with zero drift.
- Execute governed update to `docs/00_control/PROJECT_STATE.md` (DOC-CTRL-002) via the Controlled Docs save endpoint.
- Push branch `dmk-205-wbs-runtime-sync`, open PR #20, and verify GitHub Actions CI.
- Generate reviewed dry-run plan artifact `runtime/dmk-205-sync/live-plan.json` for human approval without live apply.
