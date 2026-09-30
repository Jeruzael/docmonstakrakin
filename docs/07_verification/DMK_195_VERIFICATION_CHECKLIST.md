# DMK-195 Human Verification Checklist

Status:
PENDING HUMAN VERIFICATION

Implementation commit:
f72263beb191260270d0462ae37720fa1773b81c


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

- [ ] Open DOCMONSTAKRAKIN application in browser.
- [ ] Navigate to the **Reports & Export** area in the main navigation.
- [ ] Confirm **Repository Documents** is the default active workspace tab.
- [ ] Confirm **Dynamic Projections** remains available as an alternate tab.
- [ ] Confirm no console errors or unhandled exceptions occur during normal navigation between workspace tabs.


---

## 2. Document Catalog & Organization

- [ ] The repository document catalog renders the full registered manifest.
- [ ] Catalog items are visually organized and grouped by document kind (Control, Product, Requirements, Architecture, Security, Decisions, Verification).
- [ ] Search input successfully filters documents by ID, title, or logical path.
- [ ] Expected controlled document identifiers and titles are clearly recognizable.
- [ ] Unregistered filesystem documents (e.g., test scratch files, internal scripts) are not exposed in the catalog.

> [!NOTE]
> The catalog UI provides visual grouping by document kind alongside text search. An independent kind dropdown filter is not implemented and was not part of the approved UI design.


---

## 3. Document Integrity Badges

- [ ] **MATCH** badge displays for uncorrupted SHA-pinned documents.
- [ ] **UNPINNED** badge displays for unpinned living documents (`PROJECT_STATE.md`, `TRACEABILITY_MATRIX.md`, `MASTER_WBS.yaml`, `MASTER_WBS.md`).
- [ ] **CHANGED** badge semantics are recognized in UI when file hash differs from manifest digest.
- [ ] **MISSING** badge semantics are recognized in UI when a registered document file cannot be found on disk.

> [!TIP]
> Verify `CHANGED` and `MISSING` states using disposable test fixture evidence (`scripts/testControlledDocsViewComponent.ts`) rather than modifying live repository files.


---

## 4. Read-Only Document Protection

- [ ] `MASTER_WBS.yaml` (`DOC-CTRL-003`) displays `READ_ONLY` authority badge and exposes no Edit Draft action.
- [ ] `MASTER_WBS.md` (`DOC-CTRL-004`) displays `READ_ONLY` / generated projection authority badge and exposes no Edit Draft action.
- [ ] SHA-pinned reference documents (e.g., `SYSTEM_ARCHITECTURE.md`, `SECURITY_CONTROLS.md`) display `READ_ONLY` badges and expose no Edit Draft action.
- [ ] Read-only view displays canonical raw markdown content or rendered view without draft buffer controls.


---

## 5. Controlled Edit Workflow

Verify on living document `DOC-CTRL-002` (`PROJECT_STATE.md`):

### Safe Pre-Commit UI Verification
- [ ] Select `PROJECT_STATE.md` in catalog; confirm canonical content displays.
- [ ] Click **Edit Draft**; draft editing buffer opens with current document content.
- [ ] Modify content in draft buffer; confirm unsaved changes indicator appears.
- [ ] Click **Preview Diff**; review computed line-by-line diff.
- [ ] Confirm additions, deletions, line counts, and candidate hash preview match modifications.
- [ ] Click **Validate**; structural validation executes against document schema.
- [ ] Confirm validation errors block progression if required headers/sections are deleted.
- [ ] Confirm **Save** dialog / modal becomes accessible only after structural validation succeeds.
- [ ] Confirm Reviewer Identity and assigned roles display as read-only values in the Save dialog.
- [ ] Confirm Change Reason field is mandatory (empty reason disables submission).
- [ ] Confirm Human Confirmation checkbox is required before submission.

### Coordinated Commit & Live State (Audited Live Save)
- [ ] Confirm coordinated commit state locks UI and disables duplicate submission during save request.
- [ ] If an authorized live save is intentionally performed: confirm dialog closes immediately upon save resolution, saving state resets, and canonical content refreshes with updated digest.


---

## 6. Stale Concurrency & Optimistic Locking

- [ ] Attempting to save against a document whose base hash has changed on disk/server is rejected with conflict error (HTTP 409 `STALE_BASE_HASH` / concurrency conflict).
- [ ] UI displays clear conflict notification and offers canonical reload action.
- [ ] No automatic or unprompted save retry is initiated by the client.

> [!NOTE]
> Recommend verifying this scenario via automated test evidence (`Test O` in `scripts/testControlledDocs.ts`) to avoid contaminating live state.


---

## 7. Multi-Project Tenant Switching

- [ ] Begin an unsaved draft on a living document in Project A (`PRJ-DOCMONSTAKRAKIN`).
- [ ] Switch active project to Project B (`CryptoDemon` or `Atlas Platform`).
- [ ] Confirm Project A draft buffer and dirty state are discarded/reset.
- [ ] Confirm Repository Documents remains active tab, reloading catalog for Project B.
- [ ] Confirm Project B identity and metadata are correctly reflected in the workspace.
- [ ] Confirm Dynamic Projections tab remains fully functional for Project B even if Project B has no repository documents registered.
- [ ] Confirm Portable Package modal reflects Project B identity.


---

## 8. Dynamic Projections Dual-Workspace Verification

Confirm all six canonical Dynamic Projections remain fully functional under the **Dynamic Projections** tab:

- [ ] **Product Requirements** (`REQ`) projection renders canonical requirements.
- [ ] **Threat Model & Risk Register** (`SEC`) projection renders threats and risk matrix.
- [ ] **Traceability Matrix** (`RTM`) projection renders requirement-to-component mappings.
- [ ] **Software Architecture** (`ARC`) projection renders architectural baselines and ADRs.
- [ ] **Governance & Quorum** (`GOV`) projection renders approval status and reviewer quorum.
- [ ] **Release Gates & DoD** (`REL`) projection renders gate evaluation criteria.

For all projections, confirm supporting capabilities remain operational:
- [ ] `STATE PROJECTION ONLY` indicator remains visible.
- [ ] **Copy Markdown** action copies projected text to clipboard.
- [ ] **Export .md** action triggers browser download of projected markdown.
- [ ] **Portable Package** action opens package dialog.


---

## 9. Governance Projection Verification

- [ ] Governance & Quorum projection accurately renders existing approvals.
- [ ] Distinguishes between `APPROVED` and `PENDING` approval baseline items.
- [ ] Displays collected signature counts and required roles.
- [ ] Confirm Repository Documents integration has not altered existing governance or approval state.


---

## 10. Release Gates & Gate 7 Invariant

- [ ] Open **Release Gates & DoD** projection.
- [ ] Confirm all seven release gates (Gate 1 through Gate 7) are evaluated and displayed.
- [ ] Confirm **Gate 7** evaluates as `HUMAN_APPROVAL_REQUIRED` / unexecuted.
- [ ] Confirm navigating to the release view does not trigger automatic gate execution.
- [ ] Confirm no release sign-off ceremony is performed or recorded during this verification.

> [!CAUTION]
> **DO NOT EXECUTE GATE 7 AS PART OF DMK-195 HUMAN CHECKLIST VERIFICATION.**


---

## 11. Portable Documentation Package Modal

- [ ] Click **Portable Package** button; modal dialog opens.
- [ ] Active project name and ID match current project.
- [ ] Displayed state version corresponds to current project state.
- [ ] Cryptographic sealing and packaging description is clearly displayed.
- [ ] Closing the modal dialog is completely non-mutating (no audit events, no state changes).


---

## Human Verification Record

Reviewer:
____________________________

Roles:
____________________________

Date / Time:
____________________________

Implementation Commit:
f72263beb191260270d0462ae37720fa1773b81c

Result:

- [ ] PASS
- [ ] FAIL
- [ ] BLOCKED

Findings / Evidence Notes:

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

*(Note: Human verification records UI and workflow assessment. Human verification does NOT execute Gate 7.)*
