# Capacity inspector candidate — ACCEL-20261024 package 5

**Owner:** CAPACITY-FOLLOWUP-01 / linked DMK-120 extension, REQ-OPS-001 and REQ-SEC-014. Original DMK-120 / EV-159 closure is unchanged. **Disposition:** Linux schema-1 implementation and local synthetic qualification PASS; combined candidate CI/integration PENDING. Windows immutable inspection and detached snapshot admission UNSUPPORTED. This is not full package-5 or audit-continuity completion.

**Authority:** OPERATOR_DELEGATED_DECISION under the complete Accelerated Completion Mandate dated 2026-10-24, relayed by the parent implementation task. Platform message ID unavailable. HUMAN_REVIEW_WAIVED_BY_OPERATOR and AGENT_EXECUTED_ACCEPTANCE are campaign metadata. Agent self-review below is not independent human approval. Root remains sole integration owner.

## Exact scope and use

The plan was signed before implementation at `377440a0a1e6dcb0e7a27ee6e57eb88be75164b0`. Implementation commit `77dd93ff8500c3b2127af4d80cafd70cb8d63680`, tree `e816f819ed88d8123f4be5123e6e764e0cc835e7`, is based on `556bed68191a6af27a8fc0aad95363b5a534cd48`. The subsequent evidence/workflow commit leaves production modules unchanged and adds two explicit snapshot-boundary tests. Local SSH signature verification succeeded using the existing configured public signing key as an explicit task-local trust entry; this does not claim human review or GitHub verification.

Files: [public API](../../server/security/workspaceAccess/capacityInspector.ts), [offline process](../../server/security/workspaceAccess/capacityInspectorWorker.cjs), [pure image validator](../../server/security/workspaceAccess/capacityImage.cjs), [CLI](../../scripts/inspectWorkspaceCapacity.ts), [focused tests](../../scripts/testWorkspaceCapacityInspector.ts), four test-only fixture helpers and [isolated Linux qualifier](../../scripts/fixtures/qualifyCapacityReadonly.sh). No shared schema, worker startup, service/HTTP policy, package version, WBS or canonical receipt changed. [Plan](../superpowers/plans/2026-10-24-capacity-inspector.md).

Run only against an independently selected, already stopped and already immutable original workspace:

```sh
node --import tsx scripts/inspectWorkspaceCapacity.ts --workspace /absolute/original/readonly-workspace
```

The command writes one bounded JSON result to stdout. Exit 0 means an observed VALID_BOUNDED or FULL image; exit 2 is BLOCKED/INVALID with no counts. FULL is an observation, never permission to reopen. Remaining entries are separate audit/operation/digest counts, not a safe action budget. Session aggregates are evaluated at the persisted clock, not current wall time. Existing `workspaceSecurity status` retains its mutating-open behavior.

## Supported profile and admission

Only Linux x64 / Node 22.23.3 or later 22.x on a **read-only local ext4 superblock** is admitted. A merely read-only bind mount over a writable superblock is refused. The selected workspace and .security directory must be canonical, current-owner mode 0700, with same-device regular single-link mode-0600 files. No links, aliases, nested mounts or foreign provenance. Any owner marker is rejected without reading its contents, including stale or malformed markers. Any WAL, SHM, journal or unknown entry is rejected, including empty files. Existing TLS files are permitted only in the fixed private TLS directory; their content is never read.

Only an already self-contained DELETE-format SQLite header is accepted. The inspector never converts WAL, checkpoints, makes a snapshot, changes mount/ACL settings, creates/removes locks, repairs timestamps or opens through WorkspaceStore. The image remains bounded to 256 MiB and snapshots to 64 MiB; table limits stay 128 principals, 512 memberships, 256 sessions, 128 throttle rows and 4,096 retained audit/digest/operation entries.

Literal WORKSPACE_AUTHORITY/1 and independently measured original dev:ino identities must match. Only the exact existing schema/user_version 1 and better-sqlite3 13.0.3 / SQLite 3.53.4 are supported. Schema 2 is explicitly rejected pending its separate qualification. The inspector additionally validates bounded metadata/provenance, integrity/foreign keys, retained rows, complete audit sequence/hash chain, sqlite_sequence tail and monotonic metadata bounds. JSON rejects duplicate decoded/forbidden keys and depth above 64, matching the existing snapshot parser; small provenance/audit/roles values have additional size and exact-field constraints. These stricter offline admission constraints do not redefine normal store behavior.

The kernel, root and backing block-device custody must be trusted. The profile does not defend against root remounting/replacing storage or arbitrary code already controlling the owning OS principal. Original filesystem identity and valid hash chains do not prove current revocation, authenticated external custody, antirollback freshness or human consent. Every result preserves `activated:false`, `freshnessEstablished:false`, `pilotAuthorized:false`; no self-reported `sourceMutated:false` substitutes for an observer. Detached copies have no authenticated custody/anchor path here and remain unsupported.

## Native/no-write mechanism and limits

The admitted file is opened O_RDONLY | O_NOATIME | O_NOFOLLOW, pinned by identity/metadata and read in 64 KiB chunks. Read-only mount state, namespace inventory and file metadata are checked before publication. SQLite receives only a Buffer, never the source filename. Inspection of the pinned library source confirmed Buffer maps to :memory: and native Deserialize uses SQLITE_DESERIALIZE_READONLY; tests proved actual memory/readonly flags and rejected an UPDATE. This is the delegated alternative to the historical proposal's unproven URI path. See SQLite's [deserialize contract](https://www.sqlite.org/c3ref/deserialize.html) and [readonly flag](https://www.sqlite.org/c3ref/c_deserialize_freeonclose.html).

Only fixed queries and connection-local trusted-schema/query-only/temp-memory settings are used. No SQL write, ATTACH, extension loading or source SQLite VFS operation exists. A dedicated process is killed after 15 seconds; output is capped at 8 KiB. The 512 MiB V8 heap setting is **not a total RSS or native Buffer/SQLite memory cap**. Reading/deserializing a maximum-size image can exceed that amount; worst-case accepted-size RSS/latency and external report disk-full behavior are not qualified by these small fixtures. The CLI does not create report files.

## Executed verification

| Check | Actual result and scope |
| --- | --- |
| Test first | Missing image/public inspector assertions failed (0 passed, 2 failed) before implementation. |
| Focused `node --import tsx scripts/testWorkspaceCapacityInspector.ts` | 36 passed / 0 failed on exact implementation commit. Audit 4094/4095/4096; independent digest/operation 4094/4095/4096; over-limits, invalid schema/provenance/audit/tail/rows/JSON, native readonly, privacy, Windows refusal, concurrent refusal, CLI errors. |
| Linux immutable fixture | 21 passed / 0 failed plus one separate readonly-bind-over-writable-superblock rejection: **22 checks**. 19 fixture cases have source syscall traces; two additional tests cover blocked competing writes and SIGKILL after first source read without a verdict. |
| External observer | Before/after complete entries, bytes/SHA256, dev/inode/link count, UID/GID/mode and nanosecond access/write/change/birth timestamps matched. Repeated success observations matched. No sidecars appeared. |
| Attempt observer | strace 6.8 found no source write/create/delete/rename/lock/checkpoint syscall in the 19 traced cases. A separate preload guard also rejected any attempted mutating Node API or SQLite filename opening; guard markers were asserted absent and negative reasons exact, so a swallowed guard exception cannot count as a successful negative test. |
| Existing workspace compatibility | Admission provenance 2/2; backup 17/17; workspace store 18/18, including unchanged full-capacity rollback, all PASS. |
| Application test chain | `npm test` exit 0; all constituent suites passed. This was the candidate worktree with retained qualified Windows dependencies, not a fresh installation claim. |
| Static checks | TypeScript noEmit exit 0; final staged diff whitespace check PASS. |
| Review boundary additions | Direct Linux native checks PASS: snapshot depth 64 admits / 65 rejects; forbidden constructor key rejects. These are added to the focused suite as CI05b/CI05c; the later full 38-case suite result belongs to candidate CI, not the earlier 36-case local record. |
| Candidate/combined CI | Added dedicated [Linux qualification workflow](../../.github/workflows/capacity-inspector.yml); actual hosted results PENDING. All four campaign jobs plus this extra profile check remain required before root integration. |

Windows testing used retained Node 22.23.3 and retained regular dependency tree supplied by the integration owner, through a new test-only worktree junction; no install ran through it and no original dependency tree was changed. Linux native component qualification used a task-owned regular npm installation of better-sqlite3 13.0.3, not a fresh complete application install. Linux runtime: WSL2 kernel 6.18.54.1-microsoft-standard-WSL2. The official Node 22.23.3 Linux x64 archive matched official SHASUMS256: `df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de`.

Local evidence lives in this worktree's ignored `.superpowers/capacity/` directory; it contains no original authority data. Exact implementation rerun:
- `focused-77dd93f.log`: SHA256 `b952e700c296bb5613b1ae0366772d5ec9d8517ab18ddabd6ffc0fac596df365`.
- `readonly-preserved-77dd93f.log`: SHA256 `d998b1eb1617e19ab11b8d07a954851d44136fda387fa7223ad3b939dbf0ed30`.
- `traces-77dd93f.tar.gz`: 34,345 bytes, SHA256 `2b1fe240d508817d089ec581f8132ce7f1e90a6fb3a29ad0356ec7986d3114dc`; only synthetic syscall traces, no database.
- `npm-test.log`: SHA256 `1f1b8756aaef4d5ffe19d38f5c925e91ff94ccefb321f8355c62af5428845345`.
- `store-test.log`: SHA256 `1fb5783204829dd2428d6b516451a296bb0375e054fb6e99602b616c1dc3fb58`.

Preserved failures: a slow initial WSL download was cancelled; its partial archive failed checksum and extraction and was not used as a qualified runtime. A later expanded run failed exit 127 because the task's /tmp Node directory was absent. Task tools were recreated in a persistent task-owned home directory, and traces were archived before that WSL invocation exited. The reason for /tmp disappearance was not diagnosed. One earlier focused invocation yielded only its first output line without a retained exit status; it was not counted as qualification. Explicit exit-0 reruns supply the results above.

## Reproduce Linux qualification

On an explicitly authorized disposable Linux environment with existing Node/dependencies and strace, mkfs.ext4, runuser, unshare and loop support:

```sh
sudo sh scripts/fixtures/qualifyCapacityReadonly.sh \
  "$(command -v node)" "$PWD/node_modules" "$(id -un)" "$(command -v strace)"
```

The harness first creates a private mount namespace. It then creates its own 32 MiB synthetic ext4 image, prepares fixtures, tests the unsafe readonly-bind case, remounts only that new image readonly and runs the observer as the original unprivileged user. It never accepts an original workspace argument. The mounted fixture detaches on exit; preserve printed traces before temporary storage is discarded. Hosted CI requires tools rather than skipping a missing prerequisite, installs normal fresh lifecycle dependencies, and uploads synthetic evidence.

## Separate code/evidence self-review and remaining work

Codex reviewed the actual three production modules and qualifier after tests. No blocking defect remains within the narrow supported profile. One evidence weakness was corrected: forbidden-write guard attempts now emit an independently checked marker, and negative fixtures require exact refusal reasons. Root also inspected the core modules/shell and highlighted the native-memory and root-custody limitations documented above. Neither review is independent human approval.

P5-D03 adds a dedicated process and narrows support to original readonly ext4 schema-1 custody; cost is explicit refusal of ordinary writable Windows/Linux sources. P5-D04 adds separate hosted immutable-profile qualification under the parent integration owner's exact-path delegation. All are OPERATOR_DELEGATED_DECISION; no canonical authority record, task registration or production gate is fabricated.

Remaining: hosted candidate and actual merged-tree checks; Windows no-write profile; authenticated detached-snapshot/current-anchor admission; hostile privileged/backing-store adversaries; maximum-size resource qualification and broader filesystem support. Package 6 continuity, rotation, recovery activation and history retention are unimplemented in this lane. The useful continuity constraint is unchanged: an inspector cannot make a full store reopen, and any future schema requires independent admission/lineage qualification.
