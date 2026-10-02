# DMK-195 Human Verification Checklist

Status:
HUMAN VERIFICATION COMPLETED — PASS WITH NON-BLOCKING UX OBSERVATIONS

Implementation commit:
f8347e9de30886c4cd64140a4d60448aedcc6a2c


================================================================
SAFETY NOTICE: CANONICAL STATE & ADVERSARIAL TESTING
================================================================

> [!CAUTION]
> **Human verification must strictly avoid uncontrolled or accidental mutations of the live repository state (`PRJ-DOCMONSTAKRAKIN`).**
>
> 1. **Do NOT deliberately tamper with or corrupt live registered documents** in `docs/` merely to force `CHANGED` or `MISSING` badges to appear in the UI.
> 2. **Destructive and adversarial conditions** (such as file tampering, missing files, stale optimistic lock conflicts, symlink rejections, or crash recovery scenarios) must be evaluated using dedicated disposable fixtures or referenced through the automated test suite evidence in [`DMK_195_AUTOMATED_VERIFICATION.md`](file:///c:/Users/HomePC/dev/docmonstakrakin/docs/07_verification/DMK_195_AUTOMATED_VERIFICATION.md).
> 3. **Distinguish Safe Pre-Commit Inspection from Audited Live Saves**: Interacting with draft editing, diff preview, and validation is non-mutating. Actually completing the final Save confirmation against a live project writes an audited mutation and advances the project state version. Do NOT instruct or perform a live save casually.
> 4. **Release Gate 7 Invariant**: Human verification of the UI does **NOT** execute Gate 7. Gate 7 must remain in `HUMAN_APPROVAL_REQUIRED` / unexecuted status.


---

## 1. Workspace Entry & Navigation

- [x] Open DOCMONSTAKRAKIN application in browser.
- [x] Navigate to the **Reports & Export** area in the main navigation.
- [x] Confirm **Repository Documents** is the default active workspace tab.
- [x] Confirm **Dynamic Projections** remains available as an alternate tab.
- [x] Confirm no console errors or unhandled exceptions occur during normal navigation between workspace tabs.


---

## 2. Document Catalog & Organization

- [x] The repository document catalog renders the full registered manifest.
- [x] Catalog items are visually organized and grouped by document kind (CONTROL, PRODUCT, REQUIREMENTS, ARCHITECTURE, SECURITY, VERIFICATION).
- [x] Search input successfully filters documents by ID, title, or logical path.
- [x] Expected controlled document identifiers and titles are clearly recognizable.
- [x] Unregistered filesystem documents (e.g., test scratch files, internal scripts) are not exposed in the catalog.

> [!NOTE]
> The catalog UI provides visual grouping by document kind alongside text search. An independent kind dropdown filter is not implemented and was not part of the approved UI design. ADR / decision documents are currently registered under ARCHITECTURE; there is no separate DECISIONS kind group.


---

## 3. Document Integrity Badges

- [x] **MATCH** badge displays for uncorrupted SHA-pinned documents.
- [x] **UNPINNED** badge displays for unpinned documents (`PROJECT_STATE.md`, `TRACEABILITY_MATRIX.md`, `MASTER_WBS.yaml`, `MASTER_WBS.md`).
- [x] **CHANGED** badge semantics are recognized in UI when file hash differs from manifest digest.
- [x] **MISSING** badge semantics are recognized in UI when a registered document file cannot be found on disk.

> [!TIP]
> Verify `CHANGED` and `MISSING` states using disposable test fixture evidence (`scripts/testControlledDocsViewComponent.ts`) rather than modifying live repository files.


---

## 4. Read-Only Document Protection

- [x] `MASTER_WBS.yaml` (`DOC-CTRL-003`) displays `READ_ONLY` authority badge and exposes no **Edit Document** action.
- [x] `MASTER_WBS.md` (`DOC-CTRL-004`) displays `READ_ONLY` / generated projection authority badge and exposes no **Edit Document** action.
- [x] SHA-pinned reference documents (e.g., `SYSTEM_ARCHITECTURE.md`, `SECURITY_CONTROLS.md`) display `READ_ONLY` badges and expose no **Edit Document** action.
- [x] Read-only view displays canonical raw markdown content or rendered view without draft buffer controls.


---

## 5. Controlled Edit Workflow

Verify on living document `DOC-CTRL-002` (`PROJECT_STATE.md`):

### Safe Pre-Commit UI Verification
- [x] Select `PROJECT_STATE.md` in catalog; confirm canonical content displays.
- [x] Click **Edit Document**; draft editing buffer opens with current document content.
- [x] Modify content in the draft buffer; confirm the edited draft remains visible and Preview Diff uses the modified content.
- [x] Click **Preview Diff**; review computed line-by-line diff.
- [x] Confirm additions, deletions, total changed line count, and unified diff correspond to the draft modifications.
- [x] Click **Validate Invariants**; structural validation executes against document schema.
- [x] Confirm validation errors block progression if required headers/sections are deleted.
- [x] Confirm **Proceed to Save** button becomes enabled/accessible only after structural validation succeeds.
- [x] Click **Proceed to Save** to open the save modal; confirm Reviewer Identity and assigned roles display as read-only values.
- [x] Confirm Change Reason field is mandatory (empty reason disables submission).
- [x] Confirm Human Confirmation checkbox is required before submission.
- [x] Confirm **Confirm & Save** button initiates the coordinated commit.

### Coordinated Commit & Live State (Audited Live Save)
- [x] Confirm coordinated commit state locks UI and disables duplicate submission during save request.
- [x] If an authorized live save is intentionally performed: confirm dialog closes immediately upon save resolution, saving state resets, and canonical content refreshes with updated digest.


---

## 6. Stale Concurrency & Optimistic Locking

- [x] Attempting to save against a document whose base hash has changed on disk/server is rejected with conflict error (HTTP 409 `DOCUMENT_STALE` / concurrency conflict).
- [x] UI displays clear conflict notification and offers **Reload Canonical Content** action.
- [x] No automatic or unprompted save retry is initiated by the client.

> [!NOTE]
> Recommend verifying this scenario via automated test evidence (`Test O` in `scripts/testControlledDocs.ts`) to avoid contaminating live state.


---

## 7. Multi-Project Tenant Switching

- [x] Begin an unsaved draft on a living document in Project A (`PRJ-DOCMONSTAKRAKIN`).
- [x] Switch active project to Project B (`CryptoDemon` or `Atlas Platform`).
- [x] Confirm Project A draft buffer and dirty state are discarded/reset.
- [x] Confirm Repository Documents remains active tab, reloading catalog for Project B.
- [x] Confirm Project B identity and metadata are correctly reflected in the workspace.
- [x] Confirm Dynamic Projections tab remains fully functional for Project B even if Project B has no repository documents registered.
- [x] Confirm Portable Package modal reflects Project B identity.


---

## 8. Dynamic Projections Dual-Workspace Verification

Confirm all six canonical Dynamic Projections remain fully functional under the **Dynamic Projections** tab:

- [x] **Product Requirements** (`PRD`) projection renders canonical requirements.
- [x] **Threat Model & Risk Register** (`THREAT` internally) projection renders threats and risk matrix.
- [x] **Traceability Matrix** (`RTM`) projection renders requirement-to-component mappings.
- [x] **Software Architecture** (`SAD`) projection renders architectural baselines and ADRs.
- [x] **Governance & Quorum** (`GOV`) projection renders approval status and reviewer quorum.
- [x] **Release Gates & DoD** (`RELEASE` internally / `REL` label) projection renders gate evaluation criteria.

For all projections, confirm supporting capabilities remain operational:
- [x] `STATE PROJECTION ONLY` indicator remains visible.
- [x] **Copy Markdown** action copies projected text to clipboard.
- [x] **Export .md** action triggers browser download of projected markdown.
- [x] **Portable Package** action opens package dialog.


---

## 9. Governance Projection Verification

- [x] Governance & Quorum projection accurately renders existing approvals.
- [x] Distinguishes between `APPROVED` and `PENDING` approval baseline items.
- [x] Displays collected signature counts and required roles.
- [x] Confirm Repository Documents integration has not altered existing governance or approval state.


---

## 10. Release Gates & Gate 7 Invariant

- [x] Open **Release Gates & DoD** projection.
- [x] Confirm all seven release gates (Gate 1 through Gate 7) are evaluated and displayed.
- [x] Confirm **Gate 7** evaluates as `HUMAN_APPROVAL_REQUIRED` / unexecuted.
- [x] Confirm navigating to the release view does not trigger automatic gate execution.
- [x] Confirm no release sign-off ceremony is performed or recorded during this verification.

> [!CAUTION]
> **DO NOT EXECUTE GATE 7 AS PART OF DMK-195 HUMAN CHECKLIST VERIFICATION.**


---

## 11. Portable Documentation Package Modal

- [x] Click **Portable Package** button; modal dialog opens.
- [x] Active project name and ID match current project.
- [x] Displayed state version corresponds to current project state.
- [x] Cryptographic sealing and packaging description is clearly displayed.
- [x] Closing the modal dialog is completely non-mutating (no audit events, no state changes).


---

## Human Verification Record

Reviewer:
Gio

Roles:
Lead Architect / Governance Reviewer

Date / Time:
2026-10-02T00:30:00+08:00

Implementation Commit:
f8347e9de30886c4cd64140a4d60448aedcc6a2c

Result:

- [x] PASS WITH NON-BLOCKING UX OBSERVATIONS
- [ ] FAIL
- [ ] BLOCKED

Findings / Evidence Notes:

1. **Repository Documents Navigation:** PASS — Workspace loads cleanly as default tab under Reports & Export.
2. **Catalog / Search / Grouping:** PASS — All 28 registered manifest documents are visible, searchable, and grouped by kind.
3. **Collapsible Grouping:** Non-blocking UX improvement suggestion — catalog currently groups statically by kind; collapsible accordions could improve density for large doc sets.
4. **Integrity Badges:** PASS with clarification UX suggestion — MATCH and UNPINNED badges display as designed; hover tooltips explaining badge semantics would improve operator clarity.
5. **Read-Only Protection:** PASS — Pinned references and generated WBS files are strictly protected from in-app editing; no edit controls are exposed.
6. **Controlled Edit / Diff / Validation:** PASS — Living document edit buffer, syntax highlighting, structured unified diff, and schema validation execute cleanly.
7. **Invalid Structural Modification Rejection:** PASS — Deleting required sections or invalid schemas triggers explicit validation blocking before save.
8. **Authenticated Reviewer Enforcement:** PASS — Reviewer identity and assigned roles are verified; unauthenticated edits are blocked.
9. **Mandatory Change Reason:** PASS — Empty or whitespace justification disables save submission.
10. **Human Confirmation Requirement:** PASS — Explicit checkbox confirmation is required to enable final coordinated commit.
11. **Stale Concurrency:** PASS — Concurrency conflicts and optimistic locking fail closed with HTTP 409 and reload prompt (supported by disposable automated test O).
12. **Project Switching:** PASS — Tenant switching cleanly resets draft buffers, reloads catalog, and preserves workspace isolation.
13. **Dynamic Projections:** PASS — All six projections (PRD, THREAT, RTM, SAD, GOV, REL) render accurately with copy/export capabilities.
14. **Project Retention After Refresh:** PASS — Live retest confirmed `PRJ-DOCMONSTAKRAKIN` and other projects survive browser refresh with deterministic URL parameter synchronization; browser Back/Forward restores projects without full-page reloads.
15. **Requirement Direct-Approve Behavior:** Deferred — Out of scope for DMK-195; formally owned and scheduled under **DMK-196** (Batch 2 — Formal Requirement Sign-Off UX).
16. **Approval Inbox Synchronization:** Deferred — Out of scope for DMK-195; formally owned and scheduled under **DMK-197** (Batch 3 — Approval Inbox & Canonical Quorum Synchronization).
17. **Release Gate Evaluator Issue:** Deferred — Separate remediation required before Gate 7.
18. **Gate 7:** Strictly held in **HUMAN_APPROVAL_REQUIRED / NOT EXECUTED** status.

*(Note: Human verification records UI and workflow assessment. Human verification does NOT execute Gate 7.)*
