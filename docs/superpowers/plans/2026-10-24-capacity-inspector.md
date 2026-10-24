# Package 5 capacity inspector implementation plan

> For agentic workers: execute this bounded plan in the assigned isolated worktree. The operator delegated routine planning, implementation, tests and PR preparation under ACCEL-20261024; routine human review is HUMAN_REVIEW_WAIVED_BY_OPERATOR. Agent review is not independent human approval.

**Goal:** Observe bounded capacity without opening, locking, altering or activating the selected authority.

**Architecture:** Admit only an existing original workspace on an already read-only local ext4 superblock on Linux x64, with current-owner private directories/files and literal original dev:ino provenance. No detached copies, writable mounts (including read-only bind mounts over writable superblocks), WAL images, uncertain ownership or Windows input are supported. Read the pinned no-atime/no-follow file into a bounded Buffer and deserialize into read-only in-memory better-sqlite3; SQLite never receives the input pathname. A timed worker isolates parser resource usage and publishes only after complete validation and final source invariance checks.

**Tech stack:** Existing Node 22.23.3+, better-sqlite3 13.0.3 / SQLite 3.53.4, TypeScript wrapper and plain CJS worker; no dependency changes.

**Spec:** ACCEL-20261024 mandate package 5; CAPACITY-INSPECTOR-01 at e026f5a; separate CAPACITY-FOLLOWUP-01 / DMK-120 extension, REQ-OPS-001 and REQ-SEC-014. Original DMK-120 / EV-159 closure is unchanged. Root owns integration, canonical registration and campaign records.

## Global constraints and delegated decisions

- OPERATOR_DELEGATED_DECISION P5-D01 (2026-10-24 Asia/Taipei), actor Codex capacity inspector worker: qualify a narrow immutable Linux profile; never equate writable-file hash equality with immutability. Cost: normal Windows/operator installations remain BLOCKED, not inspected.
- P5-D02: deserialize bounded admitted bytes using the pinned library's actual Buffer/read-only native path instead of relying on unproven URI recognition. Source SQLite I/O and sidecars become structurally unavailable. This is an explicit implementation alternative to the historical proposal's URI exploration.
- No WorkspaceStore/worker startup, privateBoundary acquisition/recovery, audit append, generation increment, metadata update, source timestamps repair, checkpoint, history deletion, higher ceilings or authorization.
- Unsupported schema/native provenance, alias/link/network/device input, any owner marker or unknown sidecar fail closed. Do not infer freshness/production authority from hashes.
- Independent observer tests capture full source bytes/metadata and attempted mutation APIs separately from inspector claims. Qualification gaps remain NOT_RUN/BLOCKED.
- Exactly scoped new files below; no changes to shared worker.cjs, schema, package versions, canonical WBS or four main campaign records.

## Review focus

1. A clean WAL header or copied main database is not established closed input: require DELETE header, exact entries and original source identity; copied foreign provenance fails.
2. A read-only bind mount can hide a writable superblock: require ext4 super options ro, no nested mounts and immutable pinned mount table.
3. Equal endpoint hashes do not prove nonmutation: immutable filesystem and no-atime descriptor admission precede data reads; test write-attempt guard plus external observer.
4. Audit-tail removal can leave a valid prefix: require sqlite_sequence tail equality and monotonic bounded event metadata; independent rollback freshness remains explicitly unestablished.
5. Cancellation and hostile bytes must not produce partial capacity output: bounded worker lifetime, input size, counts, row bytes and safe fixed error results.

## Task 1: source admission, pure image validation and CLI

Files:
- Create server/security/workspaceAccess/capacityInspector.ts: public async inspectWorkspaceCapacity(workspaceRoot: string) result union and timed worker lifecycle.
- Create server/security/workspaceAccess/capacityInspectorWorker.cjs: immutable filesystem admission, bounded reading, final pins and worker adapter.
- Create server/security/workspaceAccess/capacityImage.cjs: pure Buffer parser, exact schema/native/provenance and bounded relational/audit checks, aggregate result only.
- Create scripts/inspectWorkspaceCapacity.ts: exact --workspace absolute path CLI, bounded JSON stdout, nonzero BLOCKED/INVALID.
- Create scripts/testWorkspaceCapacityInspector.ts: synthetic disposable image/parser, CLI/worker/refusal/privacy/nonmutation tests.
- Create scripts/fixtures/capacityInspectorReadonlyQualification.cjs: independently provisioned read-only fixture observer/qualification, no automatic mount or host mutation.
- Create docs/07_verification/CAPACITY_INSPECTOR_ACCEL_20261024.md: exact commands/results, supported profile and residual limits.

Interface: inspectWorkspaceCapacity(path) returns schema WORKSPACE_CAPACITY_OBSERVATION/1, status VALID_BOUNDED/FULL/BLOCKED/INVALID, bounded reason(s), and aggregates only on successful complete admission. Success retains activated:false, freshnessEstablished:false, pilotAuthorized:false. No self-reported sourceMutated:false claim substitutes for external observer evidence. capacityImage validates only already supplied bytes and emits image aggregates, never a filesystem-admitted success result.

- [ ] Write tests for missing exported inspector/image APIs and observe expected failure.
- [ ] Implement admission + image validator; test audit 4094/4095/4096 and independent used_digests/operations ceilings, over-limit, corrupt schemas/history/metadata/provenance, relational/session bounds and safe redaction.
- [ ] Implement timed public API/strict CLI; test ordinary writable source, locks/sidecars/links/permission/path/race refusal and bounded failures with original bytes/metadata unchanged.
- [ ] Qualify native Buffer readonly behavior and no source-path SQLite opens. Run immutable-profile positive checks in a disposable read-only ext4 fixture if an isolated namespace is available; otherwise preserve NOT_RUN.
- [ ] Run lint, focused tests, existing workspace admission/store/backup suites and npm test. Root will run the four combined-tree CI jobs.
- [ ] Perform separate adversarial code/evidence self-review, fix concrete findings, record exact results, sign a focused commit and hand off to root without merging.

## Progress and evidence ledger

- Baseline 556bed68191a6af27a8fc0aad95363b5a534cd48, branch codex/accel-capacity-inspector-20261024, isolated managed worktree accel-capacity-inspector.
- Read complete mandate, current worker/privateBoundary/store/backup schema and historical CAPACITY-INSPECTOR-01. No source operator authority inspected.
- Native source: Buffer constructor substitutes :memory: and preserves readonly; native deserialize flags still require test/source qualification.
- Planned ordinary filesystem refusal is required scope, not package completion. Windows immutable qualification remains a residual acceptance gap.

