# docmonstakrakin current project state

Updated 2026-09-19. This supersedes the 2026-09-16 operational snapshot, preserved in verification/history.

- Execution Environment: Google AI Studio workspace container
- Source-Control Mode: AI_STUDIO_WORKSPACE
- Source Repository: GitHub (Jeruzael/docmonstakrakin)
- Review Branch: gaistudio
- Authoritative Starting Checkpoint: ab3cdda66f59b1e0acef3299d6107cfa09d5efa7
- Target Branch: master
- Development Branch: master
- Workspace Git Metadata: unavailable inside local AI Studio container (Git metadata is not present in container snapshot; repository tracking managed via remote checkpoints)
- Current Step: Step 3 — Construct and Review the Real PRJ-DOCMONSTAKRAKIN Bootstrap Manifest (COMPLETE — Review Ready)
- v0.1.0-rc1: RELEASE_CANDIDATE; Gate 7: HUMAN_APPROVAL_REQUIRED.
- v0.2: PLANNING / NOT READY. Implementation strictly blocked until v0.2 Entry Gate passes.
- Manual QA: NOT_READY_FOR_SIGNOFF. Automated remediation readiness: READY_FOR_RETEST.

## Current work and evidence

Step 3 (Construct and Review Real PRJ-DOCMONSTAKRAKIN Bootstrap Manifest) is complete and review-ready:
- Real Canonical Manifest: `src/data/selfBootstrapManifest.json` populated adhering strictly to `SELF_BOOTSTRAP_V1` and `TRUSTED_LOCAL_BOOTSTRAP`.
- Canonical Manifest SHA-256 Digest: `4f5c64f02e6b26e5ce9f71e030cc0b126757aeb6c3a78cd6bd08c72e3639dd63`.
- Manifest Entity Accounting:
  - 15 Features (`FEAT-DMK-001` through `FEAT-DMK-015`, all `PROPOSED`, source `PRODUCT_BASELINE`)
  - 24 Requirements (14 historical v0.1 requirements, 4 verified remediation requirements `REQ-RC-187`..`190`, 6 dogfooding roadmap requirements `REQ-BOOT-001`, `REQ-UX-PROJECTS-001`, `REQ-DOC-001`, `REQ-GOV-SIGNOFF-001`, `REQ-GOV-QUORUM-001`, `REQ-GOV-REVIEWER-001`)
  - 6 Risks (`RISK-001`, `RISK-004`, `RISK-019`, `RISK-022`, `RISK-025`, `RISK-BOOT-001`)
  - 8 Threats (`THR-001` through `THR-007`, `THR-BOOT-001`)
  - 7 ADRs (`ADR-0001` through `ADR-0007`, all `PROPOSED`)
  - 6 Architecture Components (`CMP-01` through `CMP-05`, `CMP-BOOT-01`)
  - 12 WorkItems (Remediation verification items `DMK-187`..`190` as `READY` with evidence; `DMK-191` & `DMK-192` as `READY`; `DMK-193`..`198` as `BACKLOG`)
  - 4 Evidence Records (`EV-RC-187`, `EV-RC-188`, `EV-RC-189`, `EV-RC-190`)
  - 14 Controlled Documents (`DOC-CTRL-001`..`004`, `DOC-PROD-001`..`002`, `DOC-REQ-003`, `DOC-ARC-001`, `DOC-SEC-002`..`003`, `DOC-DEC-001`..`004` with pre-computed live SHA-256 digests)
- Automated Manifest Validation: 0 errors, 0 warnings, verified via `scripts/testSelfBootstrapContract.ts` (17/17 tests passing).
- Dry-Run Report: Generated at `docs/07_verification/BOOTSTRAP_DRY_RUN_REPORT.json` (`valid: true`, `mutationCount: 0`, all governance restrictions confirmed).
- Invariant: Zero bootstrap execution performed during Step 3; `.local/project-state.json` untouched; Gate 7 remains `HUMAN_APPROVAL_REQUIRED / NOT EXECUTED`; Batch 2 governance UX remains `NOT STARTED`.

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
- All 16 focused self-bootstrap contract tests in `scripts/testSelfBootstrapContract.ts` pass cleanly (zero failures).
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

Current next action:
1. Review the real PRJ-DOCMONSTAKRAKIN bootstrap manifest and dry-run report (Step 3 review).
2. Upon operator approval, proceed to reviewed bootstrap execution step.
3. Batch 2 governance UX remains NOT STARTED.
4. Gate 7 remains HUMAN_APPROVAL_REQUIRED / NOT EXECUTED.
5. v0.2 product work remains blocked.

## State and evidence identity

Seeded canonical baseline hash: 63d08305e50b68e7f49397f58cde586204a83b363bfabbad8751a58d73b4c70b

Seeded parent checkpoint: 31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f

State Continuity: VERIFIED for the seeded baseline fixture only. These are not current CryptoDemon runtime hashes, source-tree digests, or proof of release approval. The authoritative current automated regression evidence is recorded in `docs/07_verification/rc-regression/results.json`. Integration fixtures run in isolated temporary workspaces; their human credentials and approvals are synthetic test data. Historical control records remain under `docs/07_verification/history/`.
