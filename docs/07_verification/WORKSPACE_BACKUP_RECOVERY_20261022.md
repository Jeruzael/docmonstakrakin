# Offline workspace backup and unactivated restore preparation — 2026-10-22

This mechanism creates a private, verified SQLite backup and can prepare its exact bytes in a **new, previously nonexistent workspace**. Preparation does not activate authority. Original workspace/private-directory provenance is retained literally, so `WorkspaceStore.open()` must reject that prepared copy with `WORKSPACE_PATH_INVALID`. There is no identity rebinding, session resurrection, production recovery approval, or automatic lock recovery.

No operator workspace, identity, credential, trust store, or production backup/restore was used for this implementation. All runtime evidence below uses disposable synthetic fixtures in the host's actual default `TEMP`, with the genuine store and native SQLite implementation.

## Files and contract

| File | Responsibility |
| --- | --- |
| `server/security/workspaceAccess/backup.ts` | Offline backup, verification, new-destination preparation |
| `scripts/workspaceBackup.ts` | Explicit local CLI; no HTTP route or initialization command |
| `scripts/testWorkspaceBackup.ts` | Genuine SQLite/store filesystem and recovery fixtures |

`createWorkspaceBackup(workspaceRoot)` acquires `acquirePrivateWorkspace(root, false)` before creating backup directories. A live **or stale** `owner.lock` returns `WORKSPACE_BUSY`; the marker is never stolen, rewritten, or implicitly recovered. Missing authority is never initialized. The source database is opened read-only and SQLite's backup API captures committed WAL state under the exclusive store lock. No source checkpoint, generation increment, principal change, session operation, audit event, or SQL write is requested.

The source database and any nonempty WAL must retain their exact bytes and admitted inode identities. SQLite read-only WAL access may create an empty WAL and shared-memory reader coordination files. These private metadata files are admitted; the empty WAL contains no committed pages. Shared-memory reader slots are not treated as durable authority bytes. A nonempty pre-existing WAL is hashed before and after and must remain byte-identical. The exact owned marker is released using the core helper.

The output is staged in `.security-backups/.pending-<UUID>/`. SQLite's supported `journal_mode=DELETE` transition applies **only to that new private copy**, making it self-contained. The database and manifest are flushed, validated, and the staging directory is renamed to `.security-backups/<UUID>/`. A failed unpublished stage is retained for explicit inspection; the implementation never prunes backups or recursively deletes operator data.

Each published directory contains exactly `authority.sqlite` and `manifest.json`. Verification checks:

- Canonical paths, nonzero inode identities, no symlinks/junctions, and single-link files; current-owner private directory/file permissions using the existing core boundary.
- Exact canonical bounded manifest shape, backup UUID, SHA-256 of actual database bytes, and an optional caller-supplied manifest SHA-256.
- Pinned better-sqlite3 `13.0.3` / SQLite `3.53.4`, `user_version=1`, exact owned schema fingerprint, 4096-byte pages, full `integrity_check`, and foreign-key consistency.
- Bounded metadata, snapshot size, retained table counts, contiguous audit sequence and SHA-256 chain; hashes of literal provenance and snapshot bytes, plus observed generation, policy/snapshot revisions and clock high-water.
- Repeated path/inode, source, and destination checks around reads and publication.

The exact schema fingerprint for core `WORKSPACE_AUTHORITY/1` is `11db824c5cd6308dfca1fbd9e815a09cdb79c530ed889651edcbf3cecef2c909`. A future schema/native change requires a reviewed backup-format update. The backup validator checks storage consistency and the listed retained observations; it does not replace the store's full authority admission or establish recovery authority.

Artifacts contain plaintext project data, principal information, password verifiers and retained session digests. They receive private ownership/ACL admission; encryption, external custody, independent signed receipts and retention policy are outside this slice. `.security-backups` is already denied by the workspace Vite perimeter, including raw, static, filesystem and asset aliases. The enforced server serves built assets instead of mounting workspace Vite.

## CLI preparation

These commands describe the mechanism; they were not run against an operator workspace. Use the application's qualified Node 22.23.3 x64 runtime and dependency installation. Run the committed script by its absolute checkout path with the selected workspace as the current directory. Example placeholders in PowerShell:

```powershell
$runtime = 'C:\path\to\qualified\node.exe'
$checkout = 'C:\path\to\application-checkout'
$selectedWorkspace = 'C:\path\to\selected-workspace'
$tsx = Join-Path $checkout 'node_modules\tsx\dist\cli.mjs'
$backupScript = Join-Path $checkout 'scripts\workspaceBackup.ts'
Set-Location -LiteralPath $selectedWorkspace
& $runtime $tsx $backupScript --help
& $runtime $tsx $backupScript create
& $runtime $tsx $backupScript verify --id '<backup-UUID>' --expected-sha256 '<independently-retained-manifest-SHA256>'
& $runtime $tsx $backupScript prepare-restore --id '<backup-UUID>' --expected-sha256 '<independently-retained-manifest-SHA256>' --destination 'C:\path\to\new-unactivated-workspace' --confirm-unactivated
```

Stop the genuine store cleanly before `create`. If it cannot close with certainty, retain its evidence. A stale marker needs the separately explicit core stopped-owner recovery procedure; this CLI has no recovery switch. Do not delete an owner marker merely to make a backup command succeed.

The CLI accepts no passwords, keys, principal names, initialization flags or secret-bearing options. Unknown/duplicate flags are rejected without echoing their values. Success output contains only backup ID, byte count, integrity hashes and `activated:false` / `freshnessEstablished:false`; failures print a bounded `WORKSPACE_*` code without stack traces, private paths or database values.

## New-destination preparation and limits

`prepareWorkspaceRestore(sourceWorkspace, backupId, newWorkspaceRoot, expectedManifestSha256?)` verifies the artifact first. The destination must be an absolute canonical path with a canonical existing parent and must not exist, even as an empty directory or link. Source authority and backup directories cannot be used as destination parents. Existing state is never overwritten. Newly created private destination state is retained on failure for explicit inspection rather than deleting an unknown amount of data.

Preparation copies the verified database with exclusive creation, checks its exact byte hash and storage observations, and writes a private `.security-backups/restore-preparation.json` receipt. `.security` contains only the genuine authority file, without a fake lock or unsupported marker. Original principal, membership, audit, snapshot, session and provenance values are retained. Opening a source workspace normally increments its genuine generation and fences old sessions. A prepared copy has no activated session authority: foreign provenance must be rejected before any persistent admission changes.

The physical database limit is 256 MiB (65,536 × 4096-byte pages), with a 512 MiB input WAL limit, 64 MiB snapshot limit and 8 KiB manifest limit. Budget one additional database-sized staged backup per attempt and another database-sized copy per preparation, plus SQLite/native working memory and WAL. There is no automatic retention pruning or disk reservation. The fixture run is small; it does not qualify worst-case latency or disk exhaustion behavior.

Hashes prove consistency only against the values being compared. A backup and its self-contained manifest do **not** independently establish current revocations, trusted time, latest policy/audit head, antirollback protection, original custody, or integrity against arbitrary code already running as the owning OS principal. The path-based boundary detects observed substitution; it is not a race-free privileged broker. File flushing and same-volume rename do not constitute a tested power-loss durability guarantee.

An activated restore needs a separately reviewed recovery contract: validate full authority state; retain original artifact/lineage and observed provenance; establish an independent current revocation/time/policy acceptance basis; explicitly rebind the selected new workspace identity; invalidate all restored sessions and fence the runtime generation; record the recovery decision and its real authorized custodian. None of that acceptance or rebinding is implemented or claimed here. There is no rollback-to-old-authority shortcut.

## Disposable verification evidence

The source test harness uses the signed genuine core and approved retained test dependencies; no package copying, dependency edits, lifecycle bypass or install through a junction occurs. The task's fresh Windows dependency installation remains blocked as described in [the original-host qualification receipt](./OPERATOR_WINDOWS_QUALIFICATION_20261022.md). Passing retained-dependency fixture tests must not be relabeled clean-install qualification.

Runtime: portable signed Node `v22.23.3` x64, Windows `10.0.26300`, actual default `TEMP=C:\Users\HomePC\AppData\Local\Temp`, genuine better-sqlite3 `13.0.3` / SQLite `3.53.4`. Disposable workspace roots use `dmk-workspace-backup-*` and are verified inside canonical `os.tmpdir()` before test cleanup.

The retained package selects `prebuilds/win32-x64.node` (1,989,632 bytes, SHA-256 `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a`) through the installed package's binding selector. The store and backup both check the loaded SQLite version. These are retained native dependency observations, not evidence of a successful fresh Windows installation.

Initial TDD RED: missing backup API, **0 passed / 1 failed**. The first native implementation retained a real two-file publication failure caused by readonly WAL reader sidecars (**5 passed / 8 failed**, including downstream unavailable-receipt failures). After output-only SQLite finalization, **12 passed / 1 failed**: the remaining failure proved the prior core changed a foreign prepared database's journal header before rejecting provenance. The exact-byte assertion was retained and reported for core admission-order correction.

Signed core followup `9868c9327df7813bd088ff711699f8d567e665a7` corrects that admission order. The expanded suite first retained **15 passed / 2 failed**, exposing protected-directory destination insertion and the valid bootstrapped/null-snapshot case. Those bounded fixes were implemented before the final run.

Final commands ran from a disposable full source harness with the three runtime/test files byte-identical to this checkpoint:

```text
<portable-node22> node_modules/tsx/dist/cli.mjs scripts/testWorkspaceBackup.ts
Workspace backup: 17 passed, 0 failed

<portable-node22> <npm11.7.0-cli> run ci:quality
WBS zero drift; tsc --noEmit exit 0; Vite 2378 modules; server esbuild exit 0
```

The focused suite exercised actual committed crash WAL capture after explicit stopped-owner recovery, exact source DB/WAL preservation, private ACL admission/refusal, hardlinks/junctions, resealed schema/corruption, stale/live markers, existing destinations (including empty), protected destination parents, source corruption evidence retention, session generation fencing and byte-identical unactivated preparation/rejection. The existing Vite bundle-size warning remains. No full application/browser suite was run as part of this isolated checkpoint; the parent integration runs those separately.

Retained logs live under `C:\Users\HomePC\AppData\Local\Temp\codex-security-artifacts-308a4fb4d9ffb4d6578809a339ffe53847ae6975b48d3438f2d8662f959be87c`:

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `workspace-backup-expanded-red.log` | 1538 | `eb73d4e75ebeec829b3cb8400dace6709ea6394b3329b72b1da98aa992d509bf` |
| `workspace-backup-green.log` | 1404 | `daddfc6b8e8aefd99065eb89f6d3e1c53d659adafde1cf00793a3cd0f7206c7e` |
| `workspace-backup-quality.log` | 1447 | `f57068ca2dac55f0f84b1473700aed927ce0a201f9ddae050eb18d48c5de9d8d` |

No production activation, operator restore, human identity enrollment, browser acceptance or release approval is implied by this receipt.

## Later installation reconciliation — 2026-10-23

The earlier blocked-install and retained-package observations below describe their original execution time. Later genuine private-SDK, lifecycle-enabled clean Windows npm installation succeeded, with audit0, native35/35, path7/7 and quality/build. See [the additive qualification](OPERATOR_WINDOWS_QUALIFICATION_20261022.md). The combined candidate reruns backup/native checks against that fresh dependency directory and actual hosted Windows/Linux candidate CI; those outcomes are recorded separately. Original measurements are not relabeled as fresh-install results. Activated recovery and production capacity remain unqualified.
