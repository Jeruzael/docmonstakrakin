# Stage A.6 — exact WBS ownership candidate

**WBS ownership candidate: READY FOR HUMAN REVIEW. WBS ownership application: NOT AUTHORIZED. LIVE RECONCILIATION APPLY: NOT AUTHORIZED.**

Stage A.6 section 6 requires an approval stop before the unknown identifier or ownership mutation can become canonical. No exact candidate has yet been approved. Accordingly, this package completes candidate preparation only; sections 7–10 (canonical application and reconciliation rebinding) are not executed. No canonical WBS/control file, runtime snapshot, historical evidence or product code was edited. The earlier Stage A/A.5 artifacts remain unchanged.

## Exact candidate for approval

| Field | Proposed value |
|---|---|
| Proposed ID; assigned ID | **DMK-201**; none assigned |
| Title | Canonical Runtime/WBS State Reconciliation & WorkItem Mutation Integrity |
| Parent / phase | EPIC-13 / PHASE-12 |
| WBS path | **13.06.14** |
| Type / priority / risk | BUG / P0 / HIGH |
| Proposed canonical status after authorization | VERIFICATION_PENDING |
| Candidate review status | READY FOR HUMAN REVIEW |
| Human authorization | PENDING; NOT AUTHORIZED |
| Exact record | [BATCH_A_WBS_OWNERSHIP_CANDIDATE.yaml](../00_control/BATCH_A_WBS_OWNERSHIP_CANDIDATE.yaml), its single `items[0]` entry |
| Candidate file SHA-256 | `802072d03f11ac494b25192c4bba93275037a5039160f1ab9c5b0e44621c3a78` |
| Canonical WBS baseline SHA-256 | `4a069a5411ad43aa0fd3438e91c2ef088185d647cbfd8bc70fd16d930d4bba95` |

The YAML contains every requested field: ID/path, epic/type/phase, priority/risk/status, dependencies, requirement/architecture/security links, acceptance criteria, verification method, evidence, planned_by, implemented_by, verified_by and pending human approval. It records existing implementation and automated evidence honestly; it does not declare the whole task VERIFIED, invent an independent human review, or claim a historical apply occurred.

## Ownership and identifier allocation

Read: AGENT_BOOTSTRAP.md; MASTER_WBS.yaml; PROJECT_STATE.md; TRACEABILITY_MATRIX.md; LAST_HANDOFF.md; the Stage A.5 ownership proposal and human-review package. Current control files still carry the DMK-194 checkpoint and historical verification descriptions; they do not supply authorization for Batch A ownership. WBS task state and retained Stage A evidence are kept distinct.

No existing item legitimately owns the complete scope. DMK-192/193 own the original bootstrap mechanism and ceremony, DMK-194 owns project navigation/switching, and DMK-085 owns the WorkItem schema. DMK-175/178 own future distributed reconciliation, and DMK-179/180 own external integrations. None is reassigned.

Identifier inspection covered **61 top-level WBS items and 66 records including child tasks**. No duplicate canonical IDs were found. The highest canonical integer ID is DMK-199. Existing remediation paths occupy 13.06.01 through 13.06.13 under EPIC-13.

**Exactly one identifier is proposed: DMK-201.** It and path 13.06.14 have no canonical collision, including child items, and DMK-201 is absent from all persisted runtime WorkItems. Before creating this candidate, a repository search of docs/bootstrap/src/server/scripts/AGENT_BOOTSTRAP found no DMK-201 occurrence. DMK-200 already occurs as a synthetic WorkItem in `scripts/testSelfBootstrapContract.ts`; choosing DMK-201 avoids that overlap without renaming the fixture or assigning DMK-200. This is a conservative proposal, not a claim that test fixtures formally reserve canonical IDs.

AGENT_BOOTSTRAP.md section 8 prohibits changing stable identifiers. The existing generated WBS describes permanent DMK IDs and hierarchical WBS paths. No mandatory gap-free allocator or additional reservation rule was found in the inspected controls. Therefore the proposed next non-overlapping ID and next path are valid candidates, subject to explicit human allocation. No Git history/remote reservation check was run under the no-Git restriction; recheck current collisions at any later authorized application.

## Scope and traceability

Ownership covers only bounded WBS/runtime reconciliation, status translation, retained-evidence validation, a mutation-free dry-run, stale-state/TOCTOU protection, atomic/idempotent apply with audit, a separate evolved-state verifier, and rejected WorkItem update integrity.

It does **not** own DMK-194 feature implementation, DMK-195, DMK-196/197, Batch B, Prompt Compiler Batch C, visual Batch D, Architecture Exit Gate Batch E, or Gate 7. DMK-194 remains VERIFICATION_PENDING. The proposed item must not automatically be added to the 13-item runtime mapping.

Dependencies are DMK-192 and DMK-193, already VERIFIED in canonical WBS. DMK-194 is related but is not made a completion dependency that would prevent reporting its pending verification accurately.

Requirements are REQ-DATA-001 (canonical aggregate), REQ-DATA-002 (optimistic concurrency/state versioning), and REQ-BOOT-001 (existing bootstrap traceability). The first two are APPROVED in the requirements register; the bootstrap reference is retained from the existing WBS/manifest review without changing its governance status. The tentative REQ-WORK-001 link from Stage A.5 is deliberately omitted because its requirements-register gap remains unresolved; it is not silently treated as an approved requirement. The existing aggregate requirement supports the WorkItem integrity correction.

Architecture links are CMP-01, CMP-02, CMP-04 and CMP-BOOT-01. Security links are SEC-CTRL-004, SEC-CTRL-013 and SEC-CTRL-020. These preserve existing references and do not approve architecture or exercise gate authority. Evidence links resolve to the Stage A mechanism/verification records, Stage A.5 review and focused tests.

## Re-bound reconciliation candidate — NOT RUN

No canonical ownership change has been authorized or applied. **No newly bound runtime plan, timestamp, mutation inventory, plan digest or candidate digest has been generated.** The previous digest is not presented as a new review binding.

| Required output | Current observation / disposition |
|---|---|
| Project | PRJ-DOCMONSTAKRAKIN |
| Current runtime stateVersion | 19, read from the current snapshot |
| Proposed stateVersion | NOT GENERATED; must be recalculated after authorized ownership application |
| Current baseline state digest | `2f19134a0a5fd5ccc5aea7d4d9592174c3864a1e7dc4b02c76709c13b4b942c9` — observation only, not a new plan |
| New reconciliation digest | NOT GENERATED |
| New candidate digest | NOT GENERATED |
| DMK-192 | Currently READY; expected future transition READY → VERIFIED |
| DMK-193 | Currently IN_PROGRESS; expected future transition IN_PROGRESS → VERIFIED |
| DMK-194 | Currently BACKLOG; expected future transition BACKLOG → VERIFICATION |

After exact ownership approval, the authorized next work is to recheck and insert the single approved record, regenerate MASTER_WBS.md, update only required living control/traceability records, and verify zero drift. Those input changes invalidate the old reconciliation plan. Only then may a fresh read-only candidate use actual current stateVersion/digest, the approved WBS state, a named operator and exact timestamps/mutations. It requires a separate human review and live-apply authorization. Approval of ownership alone will not authorize runtime reconciliation.

## Isolation and historical boundary

| Category | Actual changes during candidate preparation |
|---|---|
| Unrelated WorkItems / unrelated projects | 0 / NONE |
| Approvals / requirements / ADRs | 0 / NONE |
| Gate 7 | 0 / NONE |
| Historical bootstrap artifacts / pinned hashes | 0 / NONE |
| Pristine bootstrap verifier / separate reconciliation verifier | 0 / NONE |
| MASTER_WBS.yaml / MASTER_WBS.md / current control records | 0 / NONE |
| Live snapshot / stateVersion | 0 / NONE |

Existing files are checked byte-for-byte against the Stage A.6 starting inventory; the original Stage A 107-file protection inventory is also checked. New files are solely the unapplied YAML candidate, this review and [candidate validation](stage-a6-ownership-validation.json). Local verification helpers/results are under runtime/batch-a. Historical bootstrap remains evidence of the original ceremony, separate from later operational evolution.

## Verification and pending decisions

| Route | Result / freshness |
|---|---|
| Candidate YAML fields, dependencies, evidence references and collision checks | PASS — Stage A.6 |
| Protected-state integrity | PASS — Stage A.6; see validation inventory |
| WBS check | PASS — `npm run wbs:check`, existing canonical files show zero drift |
| Focused reconciliation | NOT RUN in A.6; retained Stage A PASS (13 reconciliation + 4 HTTP tests) |
| WorkItem/browser regression | NOT RUN in A.6; retained Stage A PASS (10 grouped browser cases) |
| Projects workspace | NOT RUN in A.6; retained Stage A PASS (14 checks) |
| npm test | NOT RUN in A.6; retained Stage A PASS (147 checks) |
| lint / build | NOT RUN in A.6; retained Stage A PASS; existing build chunk warning retained |
| Bootstrap standalone suites | NOT RUN in A.6; retained Stage A PASS |
| Complete regression | FAIL retained — 26/28 suites; two pre-existing evidence-order failures; not rerun |
| Git fixture / prohibited Git operations | BLOCKED |
| Canonical ownership application | NOT RUN — NOT AUTHORIZED |
| Re-bound reconciliation generation | NOT RUN — ownership approval/application prerequisite unmet |
| Live reconciliation apply | NOT RUN — NOT AUTHORIZED |

The two complete-regression failures remain the bootstrap execution verifier and executor suites following evidence mutation by an earlier test inside the disposable regression copy. They predate Stage A; follow-up remains required. No historical hash was regenerated or verification weakened. Product code is unchanged, so its passing routes were not rerun for proposal documentation.

**Decision requested:** approve or revise the exact DMK-201 ownership candidate linked above. Its identifier, path and record remain proposals until approval. Per Stage A.6 section 6, work stops here; no live apply and no other WBS task or batch is started.
