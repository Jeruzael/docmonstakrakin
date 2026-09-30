# DMK-195 Automated Verification Evidence

## Document Control

Work Item:
DMK-195 — Controlled Documentation Workspace

Verification status:
AUTOMATED VERIFICATION PASS

Implementation commit verified:
f72263beb191260270d0462ae37720fa1773b81c

Branch:
dmk-195-controlled-docs

Verification timestamp:
2026-09-30T09:34:12.041Z

Runtime baseline:
stateVersion 70
auditCount 76


## 1. Verification Scope

This report records formal, deterministic automated verification evidence for work item **DMK-195 (Controlled Documentation Workspace)** executed against implementation commit `f72263beb191260270d0462ae37720fa1773b81c`.

Automated verification covers the end-to-end controlled documentation architecture and integration:
- Controlled-document manifest registry & logical path resolution
- Read-only authority classification & projection protection
- Controlled edit lifecycle (view canonical, draft, preview diff, structural validate, save dialog, coordinated commit)
- Raw-byte cryptographic hashing (SHA-256) without normalization
- End-of-line (EOL) preservation (CRLF and LF) and mixed-EOL rejection
- Stale concurrency protection and optimistic hash locking (HTTP 409)
- Two-phase crash recovery and transaction rollback mechanisms
- Multi-stage failure injection (Stages A through J)
- Actor identity boundary enforcement and client claim rejection
- Markdown rendering security (XSS sanitization, unsafe URI blocking)
- Multi-project tenant isolation and dirty edit state reset
- Dual-workspace integration with Dynamic Projections
- Full repository regression and preserved-evidence immutability


## 2. Commands Executed

The following automated verification commands were executed freshly in sequence:

| Command | Exit Code | Result | Evidence / Metric |
|---|---|---|---|
| `npm.cmd run lint` | 0 | PASS | 0 TypeScript errors across repository (`tsc --noEmit`) |
| `npm.cmd run wbs:check` | 0 | PASS | Zero drift between `MASTER_WBS.yaml` and `MASTER_WBS.md` |
| `npm.cmd run qa` | 0 | PASS | 11 / 11 automated QA criteria passed (`scripts/runAutomatedQa.ts`) |
| `npm.cmd run test:controlled-docs` | 0 | PASS | 40/40 Core Matrix, 29/29 Additional Security, 11/11 Focused Suites (323 measured assertions) |
| `npm.cmd run test:complete` | 0 | PASS | 41/41 suites passed, 826/826 assertions passed, 0 failures, 0 changed evidence |


## 3. Controlled Documentation Security Matrix

The formal controlled documentation test suite (`scripts/testControlledDocs.ts`) executed with complete pass coverage:

- **Core Matrix A–AN**: 40 / 40 PASS (0 duplicates, 0 failed)
- **Additional Security & Contract Scenarios**: 29 / 29 PASS (0 failed)
- **Focused Subsystem Suites**: 11 / 11 PASS (0 failed)
- **Focused Measured Assertions**: 323 / 323 PASS

### Canonical Document Catalog Classification

The self-bootstrap manifest defines exactly **28 registered documents**:
- **24 SHA-Pinned Manifest Entries**: Cryptographically bound to fixed SHA-256 digests; tampering is detected immediately (`integrityStatus: CHANGED`).
- **4 Unpinned-by-Digest Documents**:
  - `DOC-CTRL-002` — `docs/00_control/PROJECT_STATE.md` (Living document, `CONTROLLED_EDIT`)
  - `DOC-CTRL-003` — `docs/00_control/MASTER_WBS.yaml` (`READ_ONLY` by registry policy)
  - `DOC-CTRL-004` — `docs/00_control/MASTER_WBS.md` (`GENERATED_PROJECTION` + `READ_ONLY`)
  - `DOC-CTRL-006` — `docs/00_control/TRACEABILITY_MATRIX.md` (Living document, `CONTROLLED_EDIT`)
- **2 Controlled-Edit Living Documents**: Exactly `DOC-CTRL-002` and `DOC-CTRL-006` permit the controlled edit workflow.
- **Strict Read-Only Enforcement**: All other 26 registered documents (including `MASTER_WBS.yaml`, `MASTER_WBS.md`, and all pinned architecture/security/decision documents) strictly disallow edit actions and reject save requests.


## 4. Security & Boundary Results

The suite probed all security boundaries and confirmed robust fail-closed enforcement:

- **Path Traversal & Absolute Paths**: Directory traversal sequences (`../`, `..\\`, `%2e%2e/`) and absolute paths (`/etc/passwd`, `C:\...`) are rejected with HTTP 400 (`INVALID_DOCUMENT_ID` / `INVALID_DOCUMENT_PATH`).
- **Project Boundary Isolation**: Document operations are isolated to the active project context; cross-tenant document manipulation is rejected.
- **Physical Unregistered Files**: Arbitrary files placed inside `docs/` (e.g., `docs/test-unregistered.md`) are excluded from the registry catalog, return `null` on logical lookup, and yield HTTP 404 (`DOCUMENT_NOT_FOUND`) on API access.
- **Handover Exclusion**: Physical `docs/LAST_HANDOFF.md` is excluded from the registry catalog, returns `null` from `findControlledDocByLogicalPath`, and yields HTTP 404 (`DOCUMENT_NOT_FOUND`) on API routes.
- **Symlink Rejection**: Symlinked targets are detected via `assertEditableTargetNotSymlink` throwing `EDITABLE_TARGET_SYMLINK`; router operations reject symlink write requests returning non-2xx HTTP 500 (`DOCUMENT_UPDATE_FAILED`) while preserving original real target file bytes untouched.
- **Mixed Line Endings**: Documents containing inconsistent line endings (CRLF mixed with LF) are rejected fail-closed with `UNSUPPORTED_MIXED_LINE_ENDINGS`.
- **Client Identity Boundary**: Inbound client attempts to inject reviewer username or roles in save payloads are ignored and stripped; the server derives reviewer identity exclusively from the authenticated session context or fallback (`CLIENT_IDENTITY_CLAIMS_PROHIBITED` invariant).
- **Recovery Lock Enforcement**: If a pending transaction journal exists in `.local/document-transactions/`, any subsequent save attempt is blocked fail-closed with HTTP 500 (`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED`) with zero state or disk mutation.
- **Journal Path Tampering Guard**: Operation IDs are validated against strict regex `^[A-Za-z0-9_-]+$`; directory traversal sequences within journal IDs are rejected.
- **Markdown URI Security**: Dangerous URI schemes (`javascript:`, `data:`) in Markdown links are inertly filtered; external hyperlinks enforce `rel="noopener noreferrer"`; safe relative documentation links remain functional.


## 5. Transaction Safety & Failure Injection

Controlled document persistence follows a two-phase atomic write protocol:
- **Candidate Sibling**: `.<filename>.dmk-<operationId>.candidate` placed in the same directory as the target document.
- **Rollback Sibling**: `.<filename>.dmk-<operationId>.rollback` placed in the same directory as the target document.
- **Transaction Journal**: `.local/document-transactions/<operationId>.json` records operation metadata, actor, target path, base hash, and candidate hash.
- **Operation ID Hygiene**: Sanitized against `^[A-Za-z0-9_-]+$`.

### Failure Stage Matrix (Stages A through J)

| Stage | Simulated Failure | Recovery / Boundary Behavior | Result |
|---|---|---|---|
| **Stage A** | Rollback sibling write failure | Transaction aborts before candidate creation; target untouched | PASS |
| **Stage B** | Candidate sibling write failure | Rollback sibling cleaned; transaction aborts; target untouched | PASS |
| **Stage C** | Candidate fsync failure | Temporary siblings removed; transaction aborts; target untouched | PASS |
| **Stage D** | Journal write/fsync failure | Sibling files cleaned; transaction aborts; target untouched | PASS |
| **Stage E** | Candidate rename failure | Original file restored from rollback sibling; journal cleaned; abort | PASS |
| **Stage F** | Post-replacement pre-audit failure | Atomic rollback to original bytes; journal marked `ABORTED`; cleanup | PASS |
| **Stage G** | Audit append failure | Atomic rollback to original bytes; state unmutated; abort | PASS |
| **Stage H** | Snapshot persistence failure | Atomic rollback to original bytes; snapshot state reverted; abort | PASS |
| **Stage I** | Rollback execution failure | System fails closed; recovery lock engaged to prevent corruption | PASS |
| **Stage J** | Post-commit cleanup failure | Target replacement committed; journal marked `COMMITTED_CLEANUP_PENDING`; safe startup cleanup | PASS |


## 6. Audit & Identity

Audit logging adheres to strict immutability and monotonically chained hashing:
- **Audit Event Type**: Every controlled document modification emits a `DOCUMENT_UPDATED` audit record.
- **Audit Event ID Format**: Monotonically formatted as `AUD-<timestamp-base36>-<4 chars>` (not UUIDs).
- **Audit Payload**: Contains document ID, logical path, actor identity, reason, base SHA-256 hash, and candidate SHA-256 hash.
- **Reviewer Identity**: Derived strictly from server session; client-supplied identity claims are rejected.
- **Duplicate Audit ID Rejection**: Inbound or duplicate audit event IDs are rejected to preserve monotonic ledger integrity.
- **Audit Chain Integrity**: Live audit ledger cryptographically verified valid (`76 / 76` entries in `REVERSE_CHRONOLOGICAL` sequence).


## 7. Raw Bytes & Encoding

Byte-level fidelity is verified without semantic loss:
- **Raw-Byte Hashing**: Cryptographic SHA-256 digests are computed directly over binary file buffers without whitespace or line-break normalization.
- **LF Preservation**: Documents authored with LF (`\n`) newlines preserve LF line endings upon diffing and saving.
- **CRLF Preservation**: Documents authored with CRLF (`\r\n`) newlines preserve CRLF line endings upon diffing and saving.
- **Encoding Drift Detection**: Diff calculations accurately differentiate LF vs CRLF byte representations.
- **Diff-to-Save Identity**: The candidate hash previewed during diff verification strictly equals the hash verified upon save commit.


## 8. UI Verification Automation

User interface behavior was automated and verified across component and browser test suites:
- **Component Lifecycle (`testControlledDocsViewComponent.ts`)**: 24 / 24 PASS. Verifies catalog rendering, kind grouping, search filter, read-only mode, controlled edit draft buffer, diff calculation, structural validation, reviewer identity display, reason input, confirmation modal, and coordinated commit state management.
- **Dual-Workspace Integration (`testControlledDocsWorkspaceTabs.ts`)**: 14 / 14 PASS. Verifies "Reports & Export" renders "Repository Documents" as the default tab while preserving "Dynamic Projections" intact.
- **Project Switching Isolation**: Switching projects resets dirty draft buffers, clears document selection, and reloads catalog for the newly active project.
- **Dynamic Projections Preservation**: All six dynamic state projections (Product Requirements, Threat Model & Risk Register, Traceability Matrix, Software Architecture, Governance & Quorum, Release Gates & DoD) remain intact with their markdown copy and export capabilities.
- **Portable Package Modal**: Portable documentation package modal opens with project identity, version, and sealing indicators intact.
- **Release Gate 7 Verification**: Release Gate 7 is verified present in the UI and correctly evaluated as `HUMAN_APPROVAL_REQUIRED`. Gate 7 was **NOT** executed during automated verification.


## 9. Complete Repository Regression

The complete regression runner (`scripts/runCompleteRegression.ts`) executed all repository test suites with fresh results recorded in `runtime/rc-regression/results.json`:

- **Execution Timestamp**: `2026-09-30T09:37:34.585Z`
- **Suites Total**: 41
- **Suites Passed**: 41
- **Suites Failed**: 0
- **Suites Skipped**: 0
- **Assertions / Checks Total**: 826
- **Assertions / Checks Passed**: 826
- **Assertions / Checks Failed**: 0
- **Assertions / Checks Skipped**: 0
- **Counting Semantics**: Observed named assertion/check outputs; compound checks can contain multiple Node assert calls. Historical banner totals are not used.
- **Protected Evidence Integrity**: `changedEvidence` was verified empty (`[]`) across all 41 test suites.


## 10. Live-State Preservation

Live governance state and repository files were cryptographically verified before and after test execution:

| State Property | Pre-Verification Baseline | Post-Verification Result | Status |
|---|---|---|---|
| `.local/project-state.json` SHA-256 | `87B90FDFADB6C0C0F7ED53FDE3E287D837D0C24EFD8B49BC2C4B2E282F4B26D5` | `87B90FDFADB6C0C0F7ED53FDE3E287D837D0C24EFD8B49BC2C4B2E282F4B26D5` | IDENTICAL |
| PRJ-DOCMONSTAKRAKIN `stateVersion` | 70 | 70 | UNMUTATED |
| PRJ-DOCMONSTAKRAKIN `auditCount` | 76 | 76 | UNMUTATED |
| Audit Ledger Chain | 76 / 76 valid (`REVERSE_CHRONOLOGICAL`) | 76 / 76 valid (`REVERSE_CHRONOLOGICAL`) | VALID |
| 28 Registered Documents | 28 / 28 present and hashed | 28 / 28 present and identical | UNTOUCHED |
| `.local/document-transactions/` | Absent | Absent | CLEAN |
| Sibling Temporary Files | 0 found | 0 found | CLEAN |


## 11. Known Limitations / Observations

- **Legacy Projection Label Variations**: Existing Dynamic Projections contain historical minor phrasing variations in badge labels; these predate DMK-195 and are classified as **OUT OF DMK-195 SCOPE**.
- **Interactive Kind Filter**: The document catalog provides visual grouping by document kind and text-based search across ID, title, and path; an independent kind dropdown selector is not present and was not in the approved design.


## 12. Automated Verification Conclusion

```
================================================================
DMK-195 AUTOMATED VERIFICATION: PASS
================================================================
```

- All 5 automated commands exited with code 0.
- All 41 complete regression suites and 826 checks passed with zero failures.
- Live canonical state and all 28 registered documents were preserved byte-for-byte.

> [!IMPORTANT]
> **This report does NOT mark DMK-195 VERIFIED.**
> Human verification remains pending per `docs/07_verification/DMK_195_VERIFICATION_CHECKLIST.md`.
> Work item status remains `IN_PROGRESS`. Task 14 may transition DMK-195 only to `VERIFICATION`.
