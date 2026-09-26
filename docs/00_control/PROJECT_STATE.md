# docmonstakrakin current project state

## 2026-09-25 — DMK-194 Human UI Review Complete & PR #16 Merged

Pull request #16 (`dmk-194-projects-workspace`) was merged into `master` at commit `1457ab419c5d2c0e217ef4df4073c1169415b3b0`.

The human operator conducted the DMK-194 Human UI Review with final outcome: **PASS WITH NON-BLOCKING UX OBSERVATIONS**.

### Review evaluation breakdown

- **Functional project-switching verification:** PASS
- **State-isolation verification:** PASS
- **Same-project refresh preservation:** PASS
- **Portable package entrypoints:** PASS
- **Keyboard smoke:** PASS
- **Responsive review:** PARTIAL PASS

### Known non-blocking observations

1. **Full browser reload does not restore the previously selected project** (resets to default active project).
2. **Very narrow/mobile layouts exhibit top-bar clipping/horizontal overflow**.
3. **Formal requirement sign-off UX remains inconsistent** (already owned and scheduled under **DMK-196**).
4. **Package export JSON is compact/minified rather than human-readable**.

### Current governance and task status

- **DMK-194:** `VERIFIED` (Automated 14 workspace + 10 browser checks passed; human UI review completed).
- **DMK-201:** `VERIFICATION_PENDING` (Canonical Runtime/WBS State Reconciliation & WorkItem Mutation Integrity; Stage A.6–A.8 candidates SUPERSEDED; Stage A.9 assessment superseded for decision-making by Stage A.10; Stage A.10 package-evidence normalization complete but historical runtime binding is STALE due to snapshot hash advance from 9c4ca9b5... to 68b8252e...; Stage A.11 post-A.10 state-drift review completed and confirmed drift is FULLY EXPLAINED by two audited human governance transactions; recovery pending human review; NOT AUTHORIZED, NOT APPLIED).
- **Gate 7:** `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED` (Strictly held).
- **Live reconciliation:** `NOT AUTHORIZED / NOT APPLIED`.
- **Downstream work:** DMK-195 through DMK-199 remain `BACKLOG`; Batch B is `NOT STARTED`.
- **Release status:** `v0.1.0-rc1` (Release Candidate; Gate 7 human sign-off pending).
- **Next safe action:** Human operator review of Stage A.11 state-drift investigation findings. (Do NOT request recovery authorization; recovery strategy selection remains premature).

## 2026-09-24 — approved Batch A ownership

### Current pre-merge verification status

The 2026-09-24 pre-merge hardening supersedes the earlier Stage A regression disposition for current merge review.

Fresh retained verification records:

- Complete regression: PASS — 30/30 suites
- Named checks: 413/413 passed
- Failed / skipped / blocked: 0 / 0 / 0
- Git environment fixture: PASS — 17 checks in an isolated temporary repository
- Reviewer provisioning hardening: PASS — 6 grouped checks
- `npm test`: PASS — 148 named checks
- Projects workspace browser regression: PASS — 10 grouped checks
- Reconciliation / WorkItem regression: PASS — 17 checks

Evidence:

- `docs/07_verification/premerge-hardening-verification.json`
- `docs/07_verification/premerge-hardening-complete-results.json`
- `docs/07_verification/DMK_194_PROJECTS_WORKSPACE_REVIEW.md`

The prior 26/28 complete-regression result and Git-fixture BLOCKED result remain historical evidence but no longer describe the latest verified test state.

This technical verification does not constitute human acceptance.

- DMK-194 remains `VERIFICATION_PENDING`.
- DMK-201 remains `VERIFICATION_PENDING`.
- Live reconciliation remains `NOT AUTHORIZED / NOT APPLIED`.
- Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`.
- DMK-195+ and Batch B remain outside the current authorization.

Gio explicitly approved WBS ownership application for DMK-201, **Canonical Runtime/WBS State Reconciliation & WorkItem Mutation Integrity**, at 13.06.14 under EPIC-13. The canonical record is applied at **VERIFICATION_PENDING**. This owns the existing Batch A mechanism and WorkItem rejected-update integrity fix; it does not add a runtime WorkItem or expand the bounded 13-item reconciliation map.

Next action: human review of the [fresh reconciliation candidate and verification inventory](../07_verification/STAGE_A6_OWNERSHIP_APPLICATION_AND_REBOUND_REVIEW.md), generated after these ownership/control updates. Previous Stage A/A.5 plan digests are superseded for execution by the changed input bindings and remain historical evidence. Live reconciliation is **NOT AUTHORIZED / NOT APPLIED**. DMK-194 remains VERIFICATION_PENDING; DMK-195–199 remain unchanged, Batch B is not started, and Gate 7 remains HUMAN_APPROVAL_REQUIRED / NOT EXECUTED. No release approval is granted.

The retained complete regression is **FAIL (26/28 suites)** with the two pre-existing evidence-order failures. The Git fixture remains **BLOCKED** under the no-Git restriction. Product test/build results below are historical unless identified as freshly rerun in the linked report. Historical source-control references below were not re-verified.

## Historical checkpoint — 2026-09-23


Updated 2026-09-23. This supersedes the 2026-09-16 operational snapshot, preserved in verification/history.

- Supported Source-Control Environments:
  - GIT (local clone / developer workstation / CI)
  - AI_STUDIO_WORKSPACE (cloud container / sandbox)
- Runtime Behavior:
  - In GIT mode: runtime inspection reads branch, commit, and working-tree status directly from the local repository.
  - In AI_STUDIO_WORKSPACE mode: git metadata is NOT_APPLICABLE and write access to parent repository git metadata is disabled by design.
  - Static repository documentation must not fabricate runtime-specific git metadata.
- Authoritative Local Operator Dry-Run Verification:
  - Operator Execution Environment: `GIT`
  - Branch at verification: `gaistudio-4`
  - Evaluated Manifest Digest: `229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36`
  - Dry-Run Status: `SAFE_TO_REVIEW`
  - Mutation Count: `0`
  - Snapshot Existed Before Dry-Run: `YES`
  - Snapshot Written by Dry-Run: `NO`
  - Projected Snapshot Action: `REPLACE`
  - Review Binding Enforced: `YES`
  - Anti-TOCTOU Protection Enforced: `YES`
  - Preserved Projects: `3`
    - `PRJ-d7443d21-ade5-40cc-8e4b-fa9c5ec7bc43`
    - `PRJ-ATLAS-01`
    - `PRJ-FINPAY-02`
  - Unrelated State Before Hash: `79cc3b30b24942d2038f564a77c225fba2896565199a26e1df4478a87117f527`
  - Unrelated State Candidate Hash: `79cc3b30b24942d2038f564a77c225fba2896565199a26e1df4478a87117f527`
  - Unrelated State Equivalence: `VERIFIED`
- Environment Note: AI Studio dry-run is valid for sandbox inspection, while local Git checkout is the authoritative merge/execute environment.
- Source Repository: GitHub (Jeruzael/docmonstakrakin)
- Authoritative Starting Checkpoint: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f
- Parent Checkpoint Hash: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f
- Canonical State Hash: 63d08305e50b68e7f49397f58cde586204a83b363bfabbad8751a58d73b4c70b
- State Continuity: VERIFIED
- Current Work Item: DMK-194 — Projects Workspace & Reliable Project Switching (VERIFICATION_PENDING)
- DMK-192 Status: VERIFIED (Human operator completed Step 4 review and authorized Step 5)
- DMK-193 Status: VERIFIED (Human operator ceremony executed; read-only verification passes; evidence recorded)
- Next Safe Action: Human review of DMK-194 Projects Workspace and project-switching behavior; do not advance to DMK-195.
- Self-Bootstrap Status:
  - Dry-Run: SAFE_TO_REVIEW (completed)
  - Execution: EXECUTED_AND_VERIFIED
  - Verified Target: PRJ-DOCMONSTAKRAKIN
  - Verified Project Count: 4 (transitioned from 3)
  - Verified Unrelated State: Preserved with zero drift (hash: 79cc3b30b24942d2038f564a77c225fba2896565199a26e1df4478a87117f527)
  - Verified Entity Counts: 15 Features, 24 Requirements, 6 Risks, 8 Threats, 7 ADRs, 6 Components, 13 Work Items, 4 Evidence Records, 28 Controlled Documents
  - Verified Audit Events: 1 genesis chained event (PROJECT_BOOTSTRAPPED)
  - Verified Approvals Injected: 0
  - Release Signoff Injected: false
  - Gate 7 Status: HUMAN_APPROVAL_REQUIRED (unexecuted)
- Master Manifest Digest: 229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36
- v0.1.0-rc1: RELEASE_CANDIDATE; Gate 7: HUMAN_APPROVAL_REQUIRED (STRICTLY BLOCKED).
- v0.2: PLANNING / NOT READY. Implementation strictly blocked until v0.2 Entry Gate passes.
- Manual QA: NOT_READY_FOR_SIGNOFF. Automated remediation readiness: READY_FOR_RETEST.

## DMK-194 implementation checkpoint

2026-09-23 pre-merge remediation: same-project save refreshes preserve mounted UI context while scoped actions are inert; failed refreshes hide stale views/overlays and retry only the read. Actual project changes and explicit package overwrites reset the baseline. Global import is available without a ready project; export is bound to the ready selected project. Real-browser regression: 9 grouped checks covering A1–A5 and B1–B5, including isolated package persistence and overwrite. `npm test` passes in a disposable no-Git copy (146 named checks); standalone bootstrap checks pass. Broader isolated regression retains two reproduced baseline failures caused by earlier regeneration of pinned CryptoDemon evidence; the Git-invoking environment suite is BLOCKED under the active restriction. Full details and pending human checks are appended to `../07_verification/DMK_194_PROJECTS_WORKSPACE_REVIEW.md`. Branch/commit remain UNVERIFIED; no Git command was run in this remediation session. DMK-194 remains VERIFICATION_PENDING.

DMK-194 implementation exists and is VERIFICATION_PENDING, not VERIFIED. The Projects workspace reuses App's sole selection path and canonical APIs. Automated checks cover scoped payload loading, latest-request wins, stale refresh rejection, failure/retry, zero-project rendering and shared selection wiring. Human UI checks remain pending in ../07_verification/DMK_194_PROJECTS_WORKSPACE_REVIEW.md. No human approval is recorded for DMK-194.

DMK-193 remains VERIFIED. DMK-195 through DMK-199 remain BACKLOG; Batch 2 is NOT STARTED. Gate 7 remains NOT EXECUTED / HUMAN_APPROVAL_REQUIRED. DMK-191 human CryptoDemon retest was not performed. No live self-bootstrap, canonical snapshot mutation or protected bootstrap/evidence changes were performed.

Operator-supplied branch: dmk-194-projects-workspace; operator-supplied starting master commit: 99d935064f70c790f77db160c018b56098863289. These are supplied context, not a fresh Git verification. The initial attachment-read command mistakenly included three read-only Git commands before the no-Git restriction was read. No subsequent Git command or Git mutation occurred. Control-plane QA runs against copied control files in a workspace without .git so its environment detector does not invoke Git.

## Current work and evidence

The following Step 5 material is the historical verified bootstrap checkpoint. The active task is DMK-194 above.

Step 5B (DMK-193: Execute Trusted Self-Bootstrap & Verify Canonical State) is COMPLETED and VERIFIED:
- Operator Execution Ceremony: The authorized human operator executed the live trusted bootstrap ceremony (`npm run bootstrap:self -- --execute ...`) on the authoritative local system.
- Read-Only Post-Execution Verification: The operator executed `npx tsx scripts/verifySelfBootstrapExecution.ts --baseline-snapshot .local/project-state.baseline-backup.json --json > docs/07_verification/self-bootstrap-execution-verification.json`, confirming status `BOOTSTRAP_VERIFIED` with `mutationCount: 0` and zero errors.
- Machine Evidence: Persisted at `docs/07_verification/self-bootstrap-execution-verification.json` (SHA-256: `066c07a79c2e9588fb162e82a4560b23b9c098e5564064ea44c180cbcdad95c0`).
- Post-Execution Review: Documented at `docs/07_verification/SELF_BOOTSTRAP_EXECUTION_REVIEW.md`.
- Target Project & Invariants Verified: `PRJ-DOCMONSTAKRAKIN` established; project count incremented 3 -> 4; 3 baseline projects preserved with identical unrelated-state hash (`79cc3b30b24942d2038f564a77c225fba2896565199a26e1df4478a87117f527`); all 111 manifest entities mapped 1:1; 8 dynamic discovery collections verified empty (`[]`); single genesis-chained `PROJECT_BOOTSTRAPPED` audit event validated; 0 approvals injected; release signoff false; Gate 7 unexecuted.
- Live WBS Synchronization: `docs/00_control/MASTER_WBS.yaml` updated (DMK-193 VERIFIED); `docs/00_control/MASTER_WBS.md` re-rendered with zero drift (`npm run wbs:check` passes).
- Historical Step 5B scope: DMK-194 was BACKLOG at that checkpoint; no application or UI code was modified during Step 5B. DMK-194 implementation is now VERIFICATION_PENDING as recorded above.
- Gate 7 & Batch 2: Remain strictly BLOCKED. Completion of `DMK-193` advances the controlled sequence to `DMK-194`; Batch 2 and Gate 7 remain subject to their downstream prerequisite work items and human-review gates.

### Historical Step 5A Preparation Baseline
- Operator Review Authorization: The human operator reviewed and approved Step 4 (DMK-192), transitioning DMK-192 to VERIFIED and authorizing preparation for Step 5.
- Read-Only Post-Execution Verifier: Implemented `scripts/verifySelfBootstrapExecution.ts` (`npm run verify:bootstrap:execution`).
- Verifier Test Suite: Implemented `scripts/testSelfBootstrapExecutionVerifier.ts` (`npm run test:bootstrap:execution-verifier`).
- Execution Plan: Created `docs/07_verification/SELF_BOOTSTRAP_EXECUTION_PLAN.md` documenting the 4-phase operator instructions.

### Historical Step 4 Baseline (DMK-192: Trusted Self-Bootstrap Executor & Dry-Run)
- Self-Bootstrap Executor: `server/bootstrap/selfBootstrapExecutor.ts` implements `executeSelfBootstrap` independently of the web server, without Vite or live secret store initialization.
- Pure Integrity Verification: `server/bootstrap/selfBootstrapIntegrity.ts` performs non-mutating schema, referential, document digest, and evidence hash verification. Code-level bypass heuristics completely removed in favor of manifest-declared unpinned living control documents (`DOC-CTRL-002`, `003`, `004`, `006`).
- Review-Binding & Anti-TOCTOU Guard: Execution strictly requires `--confirm-manifest-digest <digest>` matching the evaluated digest (`229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36`), `--confirm-project-id PRJ-DOCMONSTAKRAKIN`, and `DMK_SELF_BOOTSTRAP_EXECUTE=PRJ-DOCMONSTAKRAKIN`. Manifest changes after review trigger fail-closed abort.
- CLI Entrypoint & Clean Schema Reporting: `scripts/bootstrapSelf.ts` exposed via `npm run bootstrap:self -- --dry-run` (supports human and `--json` outputs). Arbitrary `--manifest` CLI selection removed. Separates Manifest Schema (`SELF_BOOTSTRAP_V1`), Project State Schema (`1`), and Bootstrap Mode (`TRUSTED_LOCAL_BOOTSTRAP`).
- Zero Mutations in Dry-Run: Performs 100% candidate state projection and produces `mutationCount: 0`. In the authoritative local Git verification, an existing `.local/project-state.json` snapshot was present and remained unwritten by the dry-run. Three existing projects (`PRJ-d7443d21-ade5-40cc-8e4b-fa9c5ec7bc43`, `PRJ-ATLAS-01`, `PRJ-FINPAY-02`) were preserved with matching unrelated-state hashes (`79cc3b30b24942d2038f564a77c225fba2896565199a26e1df4478a87117f527`).
- Accurate Snapshot Action Semantics: Projected snapshot status distinguishes create vs replace: `wouldWriteSnapshot: true`, `wouldCreateSnapshot: false`, `wouldReplaceSnapshot: true`, because an existing `.local/project-state.json` snapshot was present in the authoritative local operator environment.
- Atomic Persistence Failure Recovery: Validated via injected `beforeRename` hooks in `writeProjectSnapshotAtomic`; pre-existing state files remain byte-identical and all temporary files (`.tmp.*`) are guaranteed cleaned up.
- Regression Suite: `scripts/testSelfBootstrapExecutor.ts` validates 16 test cases covering dry-run, existing snapshots, CREATE_ONLY conflict, invalid manifests, tamper detection, temp workspace atomic execution, duplicate execution prevention, failure cleanup, validation report non-interference, TOCTOU defense, and pinned vs unpinned document handling (16/16 passing).
- Evidence References: Cleaned up in `docs/00_control/MASTER_WBS.yaml` to reference only real retained evidence (`docs/07_verification/SELF_BOOTSTRAP_DRY_RUN_REVIEW.md`, `docs/07_verification/self-bootstrap-manifest-validation.json`).
- At the Step 4 checkpoint, Step 5 (`DMK-193`) remained strictly `BLOCKED / BACKLOG` pending human operator review and explicit authorization.

### Historical Step 3 Baseline (Construct Real PRJ-DOCMONSTAKRAKIN Bootstrap Manifest)
Note: The original Step 3 manifest digest `937dee0038edea309f61a6eab459756cb8128dfc39dba435edf60edb2c144289` is historical. The current authoritative reviewed manifest digest for execution is `229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36`.
- Real Canonical Manifest: `bootstrap/docmonstakrakin.self-bootstrap.json` populated adhering strictly to `SELF_BOOTSTRAP_V1` and `TRUSTED_LOCAL_BOOTSTRAP`.
- Manifest Entity Accounting:
  - 15 Features (`FEAT-DMK-001` through `FEAT-DMK-015`, all 15 `PROPOSED`; 12 `PRODUCT_BASELINE`, 3 `MANUAL_ENTRY`)
  - 24 Requirements (14 `VERIFIED`, 4 `UNDER_REVIEW`, 6 `PROPOSED`)
  - 6 Risks (`RISK-001`, `RISK-004`, `RISK-019`, `RISK-022`, `RISK-025`, `RISK-BOOT-001`, all `PROPOSED` / `IDENTIFIED`)
  - 8 Threats (`THR-001` through `THR-007`, `THR-BOOT-001`, all mitigations `IN_PROGRESS`)
  - 7 ADRs (`ADR-0001` through `ADR-0007`, all `PROPOSED`)
  - 6 Architecture Components (`CMP-01` through `CMP-05`, `CMP-BOOT-01`, all `PROPOSED`)
  - 13 WorkItems: 4 `VERIFICATION` (`DMK-187`..`190` with real evidence); 1 `READY` (`DMK-192`); 8 `BACKLOG` (`DMK-191`, `DMK-193`..`199`)
  - 4 Evidence Records (`EV-RC-187`, `EV-RC-188`, `EV-RC-189`, `EV-RC-190` with exact real timestamps and real SHA-256 digests)
  - 28 Controlled Documents (24 pinned with verified SHA-256 byte digests, 4 unpinned living control documents)
- Future Work Items Planned: `DMK-192` through `DMK-199` (Self-bootstrap work starts at `DMK-192`: Trusted Bootstrap Executor, Bootstrap Verification, Projects Workspace, Controlled Docs, Batch 2 Sign-Off UX, Batch 3 Quorum Sync, Batch 4 Reviewer Usability, Batch 5 Full Regression). `DMK-191` is reserved for Gio CryptoDemon human browser retest per `docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md`.
- Read-Only Validator Script: `scripts/validateSelfBootstrapManifestFile.ts` (invoked via `npm run test:bootstrap:manifest`).
- Verification Report: Generated at `docs/07_verification/self-bootstrap-manifest-validation.json` (`valid: true`, `mutationCount: 0`, 24 pinned document digests verified, 4 unpinned living control documents checked, 4 evidence artifact hashes verified).
- Review Report: Generated at `docs/07_verification/SELF_BOOTSTRAP_DRY_RUN_REVIEW.md`.
- Invariant: Zero bootstrap execution performed; `.local/project-state.json` untouched; Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`; Batch 2 governance UX remains `NOT STARTED`.

Step 2A (Harden Trusted Self-Bootstrap Contract) is technically complete:
- Hardened Schema: `SELF_BOOTSTRAP_V1` enforced with closed root schema (`PERMITTED_ROOT_KEYS`), rejecting unexpected properties.
- Recursive Governance Protection: Recursively scans entire manifest at any depth and rejects `approvals`, `signatures`, `releaseSignoff`, `authorizedBy`, etc., with strict error-hygiene (property path only, zero value leaks).
- WorkItem Governance Semantics: WorkItems during bootstrap strictly forbid `VERIFIED`, `APPROVED`, or `RELEASED`. Permitted bootstrap statuses: `PROPOSED`, `BACKLOG`, `READY`, `IN_PROGRESS`, `VERIFICATION`, `DEFERRED`. Prior technical completion is represented as `status = 'VERIFICATION'` backed by real `Evidence` records.
- Governance-Bearing Artifact States: Rejects `Requirement.status = 'APPROVED'`, `ADR.status = 'ACCEPTED'`, and `Feature.status = 'APPROVED'` during bootstrap.
- Strict Runtime Enum Validation: Validates all domain enums against explicit allowlists without leaking unvalidated values into errors.
- Complete Referential Integrity: 100% cross-collection referential integrity enforced across Features, Requirements, Risks, Threats, ADRs, Components, WorkItems, and Evidence. Heuristic text matching on acceptanceCriteria removed.
- Path Traversal Defense: Controlled document references enforce repository-relative paths under `docs/`, reject directory traversal (`..`), absolute POSIX, and absolute Windows paths. Validates 64-hex SHA-256 digests.
- Canonical JSON Compatibility: Verified 100% serialization equivalence between self-bootstrap canonicalizer and `server/package/portablePackage.ts`.
- Node Isolation: `src/data/selfBootstrapContract.ts` confirmed structurally isolated from Vite frontend production bundle; `npm run build` cleanly compiles client and server.
- All 19 focused self-bootstrap contract tests in `scripts/testSelfBootstrapContract.ts` pass cleanly (zero failures).
- No bootstrap execution executed; `.local/project-state.json` untouched; no project created.

Batch 1 and Batch 1.5 Final Correction remain technically complete:
- Canonical Requirement state synchronization and `activeDrawerReqId` architecture: PRESERVED and active in UI components.
- SecretStore deterministic layout: Configured to `.secrets/` (`store.enc`, `store.salt`, `.machine_token`). Tracked machine token removed from `.docmonstakrakin/` with gitignore protection maintained.
- Historical and current machine-token migration: Verified via `legacyMachineTokenPath` (`.docmonstakrakin/.machine_token`) and current token path. Supports both `CURRENT_MACHINE_TOKEN` and `LEGACY_MACHINE_TOKEN` migration provenance reporting when re-keying to `CONFIGURED_MASTER_KEY`. Successfully decrypts legacy envelopes, preserves all secrets and metadata, re-keys under new primary master passphrase, and removes legacy credentials. Verified in `server/secrets/testSecretStore.ts` (16/16 passing tests).
- Fail-closed secret resolution: Startup initialization and `resolveSecret()` strictly fail-closed on authentication/decryption/integrity failures. PORT resolution bound to `Number(process.env.PORT || 3000)`.
- Gate 7 status: HUMAN_APPROVAL_REQUIRED / NOT EXECUTED. Gate 7 release signoff remains strictly pending human review and verification.
- Governance remediation sequence:
  Batch 1 (complete)
  → Batch 1.5 (complete)
  → Batch 2 governance UX (NOT STARTED)
  → Batch 3 governance/quorum synchronization
  → final technical regression
  → DMK-191 human browser retest
  → Gate 7 human release approval
- Scope gating: Batch 2 is part of the governance remediation sequence, not v0.2 product implementation. All v0.2 product implementation remains strictly blocked until Gate 7 completion (Implementation strictly blocked until v0.2 Entry Gate passes).

The authoritative automated result is in `docs/07_verification/rc-regression/results.json`, with 22/22 suites passing and raw per-suite logs in `docs/07_verification/rc-regression/`. QA acceptance criteria and observed named checks are counted separately. Review findings, resolution evidence, limitations, and retest steps are in `docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md` and `docs/07_verification/PROPOSAL_SCHEMA_1_1_REPORT.md`.

Next safe sequence:
DMK-193 bootstrap execution and canonical verification (COMPLETED / VERIFIED)
→ DMK-194 Projects Workspace (VERIFICATION_PENDING; human UI review is the next safe action)
→ DMK-195 Controlled Documentation Workspace (BACKLOG; NOT STARTED)
→ DMK-196 Batch 2
→ DMK-197 Batch 3
→ DMK-198 Batch 4
→ DMK-199 Batch 5
→ DMK-191 human browser retest
→ Gate 7 human release approval

## State and evidence identity

Seeded canonical baseline hash: 63d08305e50b68e7f49397f58cde586204a83b363bfabbad8751a58d73b4c70b

Seeded parent checkpoint: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f

State Continuity: VERIFIED for the seeded baseline fixture only. These are not current CryptoDemon runtime hashes, source-tree digests, or proof of release approval. The authoritative current automated regression evidence is recorded in `docs/07_verification/rc-regression/results.json`. Integration fixtures run in isolated temporary workspaces; their human credentials and approvals are synthetic test data. Historical control records remain under `docs/07_verification/history/`.
