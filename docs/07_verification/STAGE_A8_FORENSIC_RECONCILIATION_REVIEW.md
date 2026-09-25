# Stage A.8 — Forensic post-DMK-194 reconciliation & recovery candidate review

Prepared 2026-09-25T18:06:00.000Z.

> [!CAUTION]
> **FORENSIC / RECOVERY-PENDING / NOT AUTHORIZATION-READY / NOT APPLIED**  
> This record evaluates both:
> 1. An in-memory forensic reconciliation candidate following DMK-194 evidence-binding hardening.
> 2. A comprehensive read-only runtime state recovery candidate following the confirmed Test 10 package overwrite.
>
> Neither candidate is authorized for apply. Gate 7 DoD sign-off and release approval remain strictly unexecuted.

---

## 1. Executive summary & forensic root-cause verdict

### Root-cause verdict: **CONFIRMED PACKAGE OVERWRITE**
During human Test 10 of DMK-194 (testing package restore conflict resolution and overwrite handling), `PRJ-DOCMONSTAKRAKIN` was restored from a `.docmonstakrakin` package with `overwrite: true` at **2026-09-25T07:12:12.888Z**.

The server package import handler (`POST /api/projects/package/import`) intentionally enforces fresh local governance policy (`SEC-CTRL-018`), resulting in:
- All 13 WorkItems reset to `PROPOSED` (previous status preserved in `importedGovernanceStatus`).
- All 24 Requirements reset to `PROPOSED` (previous status in `importedGovernanceStatus`).
- All 7 ADRs reset to `PROPOSED` (previous status in `importedGovernanceStatus`).
- All 6 Risks reset to `PROPOSED` (previous status in `importedGovernanceStatus: null`).
- All 4 Evidence items downgraded to `UNTRUSTED` (previous result in `importedResult: "PASSED"`).
- All 7 Approvals cleared to empty array `[]` (full records preserved in audit head `importedGovernanceHistory`).
- TechnicalBaseline normalized to `UNKNOWN / NOT_RATIFIED`.
- Cryptographic audit event `AUD-MUGMI1Y0-AEVN` appended with actor `docmonstakrakin Package Restore UI`.

The audit ledger chain remains cryptographically continuous and valid.

---

## 2. Evidence-binding hardening (DMK-194)

The reconciliation engine (`server/reconciliation/canonicalReconciliation.ts`) was hardened to explicitly hash-bind the human UI review document:
- When DMK-194 canonical WBS status is `VERIFIED`, `docs/07_verification/DMK_194_PROJECTS_WORKSPACE_REVIEW.md` is now included in `inputBindings` (35 bindings total).
- The review file's existence, `verified_by` provenance, and human sign-off (`human_approved_by` containing "Human operator") are strictly validated fail-closed.
- Any post-planning tampering or race modification on the review file fails closed with `STALE_INPUTS` and zero state mutation.

---

## 3. Supersession disposition of prior candidates

- **Stage A.6 Plan Digest** (`716e253ec63f0df1b9b050affe17451f06bea11ea7e9749d8f8a9756438832d2`): **SUPERSEDED FOR EXECUTION / HISTORICAL ONLY**.
- **Stage A.7 Plan Digest** (`968c0b481b3072e262cfde6befea6fc0ed33eba0af7f73773c10171cf30d754a`): **SUPERSEDED FOR EXECUTION / HISTORICAL ONLY** (lacked the DMK-194 review file hash binding).
- **Stage A.7 Candidate Digest** (`e4a9528cab41d066fa8976b1c766a40a67039d844bee495cf5a6725150ca22f6`): **SUPERSEDED FOR EXECUTION / HISTORICAL ONLY**.

---

## 4. Fresh Stage A.8 forensic reconciliation candidate (read-only)

Generated from current live snapshot (`stateVersion: 28`) and hardened 35-input bindings:

| Binding | Value |
|---|---|
| Project ID | `PRJ-DOCMONSTAKRAKIN` |
| State Version | `28 → 29` |
| Actor / Fixed Timestamp | `Gio` / `2026-09-25T18:06:00.000Z` |
| Current Snapshot SHA-256 (`beforeDigest`) | `9c4ca9b51ef11ca0c9b2257ca3a1541b136126371a1e207f1a008eae6754f8ac` |
| Canonical WBS SHA-256 | `9ac67c28dad62c0f227ec644897eedcab0cc6a190be17f85dee2875e3da59058` |
| DMK-194 Review File SHA-256 | `ed52b858f9ee1bf0348e1d390532b43a4f92e69612822bf8fa1e73a27eb52f97` |
| Bound Input Files | `35` |
| Candidate Snapshot SHA-256 (`candidateDigest`) | `ff47da596a2a414d60ad58ef6894f7d81025b94c46e051ec00fd0cb5968d8a1f` |
| Plan Digest (`planDigest`) | `a9601cc34a1606744a6617fa5b5f5cbca540b98fe7995225db04e9d4f870cccf` |
| Proposed Mutations | 3 WorkItems (`DMK-192: PROPOSED → VERIFIED`, `DMK-193: PROPOSED → VERIFIED`, `DMK-194: PROPOSED → VERIFIED`) |
| Audit Event ID | `AUD-RECON-c11d69e0dd971a61288a83c7529f92fd37ac8e5238b3b65f0b1c2b116295eb5d` |
| Dry-Run Mutation Count | `0` (In-memory projection only) |
| Disposition | **FORENSIC / RECOVERY-PENDING / NOT AUTHORIZATION-READY** |

---

## 5. Runtime recovery candidate inventory

Documented in [`docs/07_verification/stage-a8-runtime-recovery-candidate.json`](stage-a8-runtime-recovery-candidate.json):

| Collection | Pre-Import Value | Post-Import Value | Recoverable? | Recovery Source |
|---|---|---|---|---|
| WorkItems (DMK-187..190) | `VERIFICATION` | `PROPOSED` | YES | `workItem.importedGovernanceStatus` |
| WorkItems (DMK-191, 195..199) | `BACKLOG` | `PROPOSED` | YES | `workItem.importedGovernanceStatus` |
| WorkItem (DMK-192) | `READY` | `PROPOSED` | YES | `workItem.importedGovernanceStatus` |
| WorkItem (DMK-193) | `VERIFICATION` | `PROPOSED` | YES | `workItem.importedGovernanceStatus` |
| WorkItem (DMK-194) | `IN_PROGRESS` | `PROPOSED` | YES | `workItem.importedGovernanceStatus` |
| Requirements (24 items) | 12 VERIFIED, 6 UNDER_REVIEW, 6 PROPOSED | `PROPOSED` | YES | `importedGovernanceStatus` + audit history |
| ADRs (7 items) | 4 ACCEPTED, 3 PROPOSED | `PROPOSED` | YES | `importedGovernanceStatus` + audit history |
| Risks (6 items) | `null` | `PROPOSED` | YES | `importedGovernanceStatus` + audit history |
| Features (15 items) | `PROPOSED` | `PROPOSED` | YES | `importedGovernanceStatus` |
| Evidence (4 items) | `PASSED` | `UNTRUSTED` | BLOCKED | Requires operator sign-off / fresh automated run |
| Approvals (7 items) | 4 APPROVED, 3 PENDING | Cleared (`[]`) | BLOCKED | Requires fresh local quorum sign-off |
| Technical Baseline | Unratified | `NOT_RATIFIED` | YES | Normalized to pre-import null/unratified |
| Audit Ledger | 32 events | 33 events | PRESERVED | Historical `PACKAGE_IMPORTED` preserved |

---

## 6. Safety recommendations for Package-Import UX

1. **Active Project Guard:** Prevent overwriting the currently active project without explicit project switching or a separate confirmation modal.
2. **Typed Project ID Confirmation:** Require typing the target project ID (e.g. `PRJ-DOCMONSTAKRAKIN`) to enable the overwrite button.
3. **Automatic Pre-Overwrite Snapshot:** Create an atomic backup snapshot (e.g. `.local/project-state.pre-import-backup.json`) before executing any destructive overwrite.
4. **Dedicated Disposable Test Target:** Update human QA checklists to import over synthetic IDs (e.g. `PRJ-UI-TEST`) rather than the active workspace project.

---

## 7. Current governance and next action

- **DMK-194:** `VERIFIED`
- **DMK-201:** `VERIFICATION_PENDING`
- **Live reconciliation:** `NOT AUTHORIZED / NOT APPLIED`
- **Gate 7:** `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`
- **Batch B:** `NOT STARTED`

**Next Action:** Human operator review of this forensic report and decision on runtime recovery strategy before any reconciliation authorization.
