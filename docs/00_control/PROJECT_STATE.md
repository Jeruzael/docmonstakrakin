# docmonstakrakin current project state

Updated 2026-09-19. This supersedes the 2026-09-16 operational snapshot, preserved in verification/history.

- Execution Environment: Google AI Studio workspace container
- Source-Control Mode: AI_STUDIO_WORKSPACE
- Source Repository: GitHub (Jeruzael/docmonstakrakin)
- Git Metadata: NOT AVAILABLE (AI Studio container sandbox; branch/commit/working-tree are NOT_APPLICABLE)
- Authoritative Starting Checkpoint: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f
- Parent Checkpoint Hash: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f
- Canonical State Hash: 63d08305e50b68e7f49397f58cde586204a83b363bfabbad8751a58d73b4c70b
- State Continuity: VERIFIED
- Current Step: Step 4 / Step 4A — Trusted Self-Bootstrap Executor Security & Review-Binding Correction (DMK-192 VERIFICATION_PENDING / READY_FOR_HUMAN_REVIEW)
- v0.1.0-rc1: RELEASE_CANDIDATE; Gate 7: HUMAN_APPROVAL_REQUIRED.
- v0.2: PLANNING / NOT READY. Implementation strictly blocked until v0.2 Entry Gate passes.
- Manual QA: NOT_READY_FOR_SIGNOFF. Automated remediation readiness: READY_FOR_RETEST.

## Current work and evidence

Step 4 / Step 4A (DMK-192: Trusted Self-Bootstrap Executor Security & Review-Binding Correction) is VERIFICATION_PENDING (READY_FOR_HUMAN_REVIEW):
- Self-Bootstrap Executor: `server/bootstrap/selfBootstrapExecutor.ts` implements `executeSelfBootstrap` independently of the web server, without Vite or live secret store initialization.
- Pure Integrity Verification: `server/bootstrap/selfBootstrapIntegrity.ts` performs non-mutating schema, referential, document digest, and evidence hash verification. Code-level bypass heuristics completely removed in favor of manifest-declared unpinned living control documents (`DOC-CTRL-002`, `003`, `004`, `006`).
- Review-Binding & Anti-TOCTOU Guard: Execution strictly requires `--confirm-manifest-digest <digest>` matching the evaluated digest (`229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36`), `--confirm-project-id PRJ-DOCMONSTAKRAKIN`, and `DMK_SELF_BOOTSTRAP_EXECUTE=PRJ-DOCMONSTAKRAKIN`. Manifest changes after review trigger fail-closed abort.
- CLI Entrypoint & Clean Schema Reporting: `scripts/bootstrapSelf.ts` exposed via `npm run bootstrap:self -- --dry-run` (supports human and `--json` outputs). Arbitrary `--manifest` CLI selection removed. Separates Manifest Schema (`SELF_BOOTSTRAP_V1`), Project State Schema (`1`), and Bootstrap Mode (`TRUSTED_LOCAL_BOOTSTRAP`).
- Zero Mutations in Dry-Run: Performs 100% candidate state projection, verifies existing project preservation (`PRJ-ATLAS-01`, `PRJ-FINPAY-02`), verifies state equivalence hash (`124d3fd3995806aae14378d5edd3c48074e7dd4ce0998e7733cf450312f0a76a`), constructs deterministic candidate audit event, verifies chained genesis audit, and produces `mutationCount: 0`. Leaves `.local/` uncreated and untouched.
- Accurate Snapshot Action Semantics: Projected snapshot status distinguishes create vs replace: `wouldWriteSnapshot: true`, `wouldCreateSnapshot: true` (since `.local/project-state.json` is uncreated), `wouldReplaceSnapshot: false`.
- Atomic Persistence Failure Recovery: Validated via injected `beforeRename` hooks in `writeProjectSnapshotAtomic`; pre-existing state files remain byte-identical and all temporary files (`.tmp.*`) are guaranteed cleaned up.
- Regression Suite: `scripts/testSelfBootstrapExecutor.ts` validates 16 test cases covering dry-run, existing snapshots, CREATE_ONLY conflict, invalid manifests, tamper detection, temp workspace atomic execution, duplicate execution prevention, failure cleanup, validation report non-interference, TOCTOU defense, and pinned vs unpinned document handling (16/16 passing).
- Evidence References: Cleaned up in `docs/00_control/MASTER_WBS.yaml` to reference only real retained evidence (`docs/07_verification/SELF_BOOTSTRAP_DRY_RUN_REVIEW.md`, `docs/07_verification/self-bootstrap-manifest-validation.json`).
- Step 5 (DMK-193: Real Canonical Self-Bootstrap Execution) remains strictly BLOCKED / BACKLOG until human operator review and explicit authorization.

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
Step 4A human review
→ synchronize gaistudio-4 with master
→ authoritative local verification
→ merge reviewed Step 4A into master
→ rerun bootstrap dry-run from merged master
→ explicit DMK-193 authorization
→ DMK-193 bootstrap execution and canonical verification
→ DMK-194 Projects Workspace
→ DMK-195 Controlled Documentation Workspace
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
