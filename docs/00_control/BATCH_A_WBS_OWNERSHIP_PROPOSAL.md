# Batch A reconciliation — proposed WBS ownership

**Decision requested:** approve the ownership scope below and allocate its stable DMK identifier and WBS path. This is a proposal only. MASTER_WBS.yaml and its projection have not been edited. No identifier has been reserved or assigned.

The 61 existing WBS items were inspected. DMK-192 owns the original executor/dry-run and DMK-193 owns the original bootstrap ceremony; both are historical completed work. DMK-194 owns project navigation and switching and remains VERIFICATION_PENDING. DMK-085 covers the WorkItem schema, not evidence-bound historical state reconciliation. DMK-175/178 address future distributed reconciliation, and DMK-179/180 address external integrations. None clearly owns this complete remediation. Assigning it to one would silently expand that task's scope. DMK-195+ are not reassigned or started.

| Proposed field | Value |
|---|---|
| Identifier / WBS path | UNASSIGNED — human allocation required |
| Title | Canonical Runtime/WBS State Reconciliation & WorkItem Mutation Integrity |
| Description | Reconcile the bounded self-project WorkItem projection with canonical repository WBS state through retained-evidence validation, an exact reviewed candidate, stale-state protection, atomic/idempotent application, a separate post-bootstrap verifier, and reliable failed-update handling in WorkView/App/server. |
| Type | BUG |
| Phase | PHASE-12 — Forms, Export, Secrets & Release Hardening |
| Parent epic | EPIC-13, consistent with the existing self-bootstrap/remediation grouping |
| Priority | P0 — integrity of historical verification state |
| Risk | HIGH — persisted canonical state, audit history and verification provenance |
| Proposed status on allocation | VERIFICATION_PENDING; mechanism implemented and verified for review, historical apply and human acceptance pending |
| Proposed implementation owner | Codex, as recorded for Stage A; accountable human reviewer to be assigned by the user |
| Dependencies | DMK-192 and DMK-193, both VERIFIED in the existing WBS |
| Related item | DMK-194, remaining VERIFICATION_PENDING; its human acceptance is not granted by this remediation |
| Linked requirements | REQ-DATA-001 (approved canonical project aggregate); REQ-BOOT-001 (existing bootstrap traceability); proposed WorkItem trace link REQ-WORK-001, already used by DMK-085 |
| Architecture links | CMP-01, CMP-02, CMP-04, CMP-BOOT-01 |
| Security links | SEC-CTRL-004 (regression), SEC-CTRL-013 (audit chaining), SEC-CTRL-020 (human gate ratification remains separate) |

Traceability sources: [requirements register](../02_requirements/REQUIREMENTS_REGISTER.md), [system architecture](../03_architecture/SYSTEM_ARCHITECTURE.md), [security controls](../04_security/SECURITY_CONTROLS.md), [bootstrap manifest review](../07_verification/SELF_BOOTSTRAP_MANIFEST_REVIEW.md), and [existing WBS](MASTER_WBS.yaml). REQ-WORK-001 was found in DMK-085's WBS links but not in the inspected requirements register. Its proposed link needs human traceability review; this proposal neither invents a new requirement nor declares it approved. CMP-BOOT-01 and REQ-BOOT-001 retain their existing bootstrap provenance/status; this proposal does not approve architecture or requirements.

## Acceptance criteria

1. Preserve repository source-of-truth precedence and the separation between WBS task state and operational ProjectStore state. Never regenerate the full WBS from the smaller runtime subset.
2. Maintain the explicit 13-item mapping; this historical ceremony may change only DMK-192, DMK-193 and DMK-194. Report older drift without silently expanding scope; preserve DMK-195+.
3. Require retained evidence validation for DMK-192/193 before proposing VERIFIED. Translate DMK-194 VERIFICATION_PENDING to runtime VERIFICATION; unknown states fail closed.
4. Produce a mutation-free exact proposal bound to baseline bytes/stateVersion, inputs, mutation set, actor, timestamps, candidate and plan digests.
5. Require explicit human authorization for the final candidate; reject stale state, changed inputs or a changed candidate. Use the exclusive writer and atomic snapshot transaction for changes plus audit, with idempotent retries.
6. Verify the evolved state separately. Preserve historical bootstrap artifacts, the strict pristine verifier, unrelated projects/items, approvals and Gate 7.
7. Rejected WorkItem requests show an error and retain canonical UI/server/persisted values. Successful updates persist, append audit, refresh canonical values and survive restart.
8. Retain disposable automated evidence and an exact human-reviewable mutation inventory. Report the existing complete-regression failures and blocked Git fixture honestly.
9. Do not close historical apply or human acceptance as complete until separately authorized, executed and verified with new evidence. Do not treat this work as DMK-194 acceptance or release approval.

## Verification and evidence

Verification methods: `npm run test:reconciliation`; WorkItem case in `npm run test:projects-workspace:ui`; `npm run test:projects-workspace`; `npm test`; lint/build/WBS check; standalone bootstrap suites; read-only saved-candidate comparison; separate post-bootstrap verifier. Run evidence-writing suites only in disposable copies through `scripts/runBatchAVerification.mjs`. Keep the no-Git restriction and report the Git fixture BLOCKED. Complete regression remains FAIL, with the same two pre-existing evidence-order failures; follow-up is required and is not started here.

Evidence references:

- [Stage A implementation boundary](BATCH_A_RECONCILIATION_IMPLEMENTATION.md)
- [Stage A review](../07_verification/BATCH_A_RECONCILIATION_REVIEW.md)
- [Saved dry-run](../07_verification/batch-a-reconciliation-dry-run.json)
- [Stage A verification](../07_verification/batch-a-reconciliation-verification.json)
- [Stage A.5 human review](../07_verification/STAGE_A5_RECONCILIATION_HUMAN_REVIEW.md)
- [Stage A.5 exact comparison](../07_verification/stage-a5-reconciliation-review-validation.json)
- `scripts/testCanonicalReconciliation.ts`, `scripts/testWorkItemUpdates.ts`, `scripts/testProjectsWorkspaceUi.ts`

**Approval sequence:** decide ownership and allocate the identifier first. Any authorized canonical WBS edit changes a bound input and invalidates the current saved plan. Then generate a fresh dry-run with a named operator, review its complete candidate/digest, and obtain explicit live-apply authorization. This proposal authorizes none of those later mutations. Do not add the new task to the bounded runtime mapping automatically.
