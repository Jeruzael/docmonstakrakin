# ACCEL-20261024 package 6 offline continuity candidate

This is an offline engineering extension of AUDIT-CONTINUITY-01 / CAPACITY-FOLLOWUP-01, linked to DMK-120, REQ-OPS-001 and REQ-SEC-014. Package 6 remains **INCOMPLETE**. The new engine stages and verifies history and exercises an anchor-CAS protocol; it does not activate a workspace or supply operational custody/currentness authority. HUMAN_REVIEW_WAIVED_BY_OPERATOR is not independent review. Code and evidence reviews in this lane are agent self-review.

## Exact scope and interfaces

The signed plan is `3c2e2e8a25146f7a7ae3ac3b10495798a9a4a02f`, based on PR88's preserved signed `3e314f93e6053b5f90253e8a02c85168ffa34a80`. Work is isolated on `codex/accel-audit-continuity-20261024` in the managed `accel-capacity-inspector/docmonstakrakin-version-sync` worktree. Root is sole integrator. Existing shared worker, store, contracts, schema definitions, package versions, canonical WBS and campaign records are unchanged.

New `continuity/contracts.cjs`, `anchor.cjs`, `verify.cjs` and `stage.cjs` implement exact formats, configured Ed25519 receipts, complete bounded history verification and these offline APIs:

- `prepareTransition({sourceWorkspace,destinationBase,transitionId,priorStage?}, client, trust)` writes a new private stage only after source admission and a fresh configured-anchor observation.
- `commitTransition(stage, client, trust)` resolves an earlier unknown outcome before attempting an exact compare-and-swap. It never activates the successor.
- `recoverTransition(stage, client, trust)` obtains signed resolution for the exact transition/request hash; it never blindly retries CAS or reactivates a predecessor.
- `verifyStage(stage, trust)` validates complete retained images, every historical manifest/index/seal/successor/receipt, source state, the current complete replay index and the phase journal.
- `lookupReplay(stage, kind, identifier, trust)` fully verifies the bounded sealed history before returning a membership observation. `authorized:false` is unconditional; active-segment authorization is not implemented here.

`CONTINUITY_SUCCESSOR/1` is deliberately distinct from existing workspace schemas. Both runtime v1 and v2 activation adapters are **UNSUPPORTED**. The original input must satisfy PR88's Linux x64 Node22, readonly ext4 superblock, private-owner, no-link, no-lock, no-sidecar, exact schema-1 and provenance profile. Normal writable sources and Windows are **BLOCKED/UNSUPPORTED**; schema 2 is rejected, never reduced to schema 1 or silently dropped.

All three mutating transition entry points require the **SYNTHETIC** trust domain. `OPERATIONAL` is explicitly refused before source/output access or provider calls. Otherwise an injected operational client could move a real current-head pointer to an unsupported successor format before runtime hooks exist. The receipt parser retains the future domain format, but it does not enable operational transitions. Tests cannot turn this guard into production qualification by relabeling synthetic keys.

## Durable artifact and custody contract

Every new stage is `continuity-<UUID>` directly under an already private `.security-backups` directory on ext4. This uses the existing private-path HTTP/Vite perimeter; no new public asset directory is introduced. Root/base directories must be canonical current-owner mode0700; files are mode0600, regular, single-link, canonical and bounded. The source is read only with `O_NOATIME|O_NOFOLLOW`, remains on an admitted readonly superblock, and is checked before and after copying. No WorkspaceStore, source SQLite filename open, source checkpoint, original metadata write, audit append or generation increment occurs.

Retained segment files are exact original SQLite bytes, with original provenance and full raw audit sequence/hash chains. Each manifest includes every earlier segment, manifest, index, seal, successor and signed commit receipt. Every historical index and successor is semantically revalidated, in addition to its signed digest binding. The exact index stores operation IDs, snapshot revisions, segment pointers and used digests. Historical request hashes remain null because schema 1 never recorded those body hashes. There are no receipt-body copies, probabilistic membership filters, truncated scans or eviction. Duplicate identifiers between segments reject staging.

The successor retains the exact snapshot string and complete principal, credential revision, disabled flag, membership/DENY, throttle and metadata state. Its active-session table is empty. A separate config advances authority ID, epoch and generation, preserves policy/snapshot/clock high-water values and requires fresh service keys. Source metadata is retained as evidence; a runtime adapter must explicitly interpret the successor config instead of treating the copied source generation as active authority. Genesis links the old audit head to the continuity seal. No service keys are provisioned by this module.

The append-only logical journal has four rows: PREPARING, PREPARED, COMMIT_CONFIRMED and FINALIZED. Payloads and the stage directory are fsynced before PREPARED; SQLite uses DELETE journaling and FULL synchronization. External CAS precedes local COMMIT_CONFIRMED and FINALIZED. These operations are not a distributed atomic transaction: exact signed resolution reconciles lost acknowledgments. No result treats cancellation or a missing local acknowledgment as proof that the predecessor remains current.

Recovery can write only the stage control database. Before any existing control DB is opened by native SQLite, its main-file bytes must pass complete readonly-buffer verification and be PREPARED or later. A rollback journal additionally must be private, single-link and bounded; its filename is the only admitted extra entry. Stage UUID, intent, manifest and complete history must bind. A torn/unreadable main snapshot or PREPARING journal remains unavailable with all bytes preserved. No attempt is made to recover original authority files. After obtaining SQLite's immediate write lock the engine verifies again. Artifacts are rechecked before CAS and after asynchronous provider work, so detected concurrent tampering cannot receive a final completion acknowledgment.

The fault fixture records rollback-journal size and whether its real SQLite hot-header magic is present. A leftover cold journal is not described as proof of hot-journal or physical power-loss recovery. Native commit internals and torn-device recovery are not universally supported by this admission profile; an unprovable main snapshot fails closed.

Filesystem checks and `fsync` ordering assume a trusted kernel, root, backing device, namespace and exclusive same-UID staging-file custody. Permissions do not defeat malicious root or another process with the same UID. There is no atomic transaction spanning path traversal, remote CAS and all artifact files; a remote commit followed by local corruption can require restoring the exact retained bytes before forward reconciliation. The engine refuses completion in that case. It never grants authority from directory enumeration, a local hash, an old signed receipt or a synthetic key.

## Delegated candidate bounds

P6-D03 is an **OPERATOR_DELEGATED_DECISION** for an unactivated candidate, not production ratification: eight sealed segments; 256MiB per image; existing 4,096 audit/operation/digest per-segment limits unchanged; 16MiB exact index; 64MiB snapshot; 80MiB staged successor; 64KiB manifest/seal; 1MiB control journal; 16MiB free-space reserve. Exceeding a bound refuses new work without pruning or truncation. Manifests contain complete inventories, not paging promises. Full replay queries intentionally reverify all admitted history up to these finite caps.

Rationale: eight is a deliberately finite first-profile history depth, with refusal at the ninth, not a retention authorization. The segment/snapshot limits inherit the existing inspector/store ceilings. The index allowance leaves headroom over the measured identifier-only index; the successor allowance covers the existing maximum snapshot plus bounded state/SQLite overhead, subject to explicit serialized-byte rejection. The reserve exceeds the bounded control journal and directory overhead; it does not promise space against concurrent external writers. No one of these candidate values authorizes raising the existing live 4,096-entry ceilings.

The measured eight-segment synthetic run retained 32,765 operation IDs and 32,765 used digests in an 8,486,912-byte index. First two segments used 4,094/4,095 entries and the others 4,096. The separate maximum-count test retained 32,768 IDs plus 32,768 digests with maximum supported snapshot-revision width in 8,720,384 bytes. The index includes bounded identifiers/digests/pointers, not 4KiB receipt bodies. Byte and count caps are not a total RSS guarantee. Native SQLite buffers, Buffer copies, canonical JSON and strings can exceed the V8 heap; no maximum-size RSS/performance qualification is claimed. Prior segment copies are streamed one file at a time rather than retained as eight image buffers. The 30-second verification deadline is monotonic and checked between bounded synchronous operations, not a hard interruption of native SQLite work. Provider calls have a five-second deadline; a timed-out remote CAS may still complete, so only exact subsequent resolution can settle its outcome.

## Evidence ledger and preserved failures

All local inputs are disposable synthetic authorities on task-owned ext4 images. Tests use the retained Linux Node22.23.3 binary and regular better-sqlite3 13.0.3 / SQLite3.53.4 dependencies under `/home/gio/.local/share/dmk-capacity-20261024`. This is **retained-dependency** evidence, not a fresh install or an idle/exclusive-host performance run. WSL shares CPU/storage with Windows; overlap with setup/core work occurred. Further heavy runs were stopped when root reserved the host for final setup qualification.

Preserved intermediate runs:

- Initial RED: missing continuity modules, then missing verify/stage; expected tests failed before implementation.
- First complete focused test: 10 passed, 0 failed.
- First ext4 setup: failed because the synthetic membership used a nonexistent `document:write` action. Corrected to the real `project:write` action; no production validator weakening.
- First chain fixture: 256MiB disposable output correctly refused the eighth stage with `CONTINUITY_SPACE_UNAVAILABLE`. Only the disposable output image was enlarged to 1GiB; the 16MiB reserve and all protocol caps remain unchanged.
- Initial complete ext4 qualification: 24 passed, 0 failed. Covered eight-segment retention, replay lookup, ninth-segment refusal, linked/corrupt/missing history, unsupported inputs, stale/competing CAS, lost acknowledgment, real SIGKILL, short/zero writes, EIO and actual ENOSPC. Original bytes, metadata, timestamps and absence of sidecars were checked.
- Expanded run after historical verification and await-race fixes: passed the chain and 21 completed scenarios, then failed after a SIGKILL inside COMMIT_CONFIRMED insertion with `CONTINUITY_STAGE_UNCERTAIN`. SQLite retained a cold rollback-journal file; ordinary opening did not remove it. The failure led to the narrowly admitted stage-journal recovery contract above. No retry was launched during the setup reservation. Standard-output log retained locally at `.superpowers/capacity/continuity-qualification.log` (ignored, synthetic, bounded output), SHA256 `a1ecb9f5f7e80c539af6ea93de50a348032e20090da3623805996ef983e1282d`; the failure stack is in the tool result, not that stdout-only file.

Final local qualification ran after core explicitly released the shared host at 2026-10-24T07:03:05Z. No implementation/test files changed after these runs. The focused Node strip-types command passed **13/13**. The complete private-ext4 launcher passed **31/31**, including actual separate-process CAS contention, retained cold-journal recovery, await-time tamper/refusal, strict UUID/no-native-write guard, all three OPERATIONAL-domain traps, source/output invariance, real ENOSPC, fsync EIO and SIGKILL/lost acknowledgments at each exercised phase. Both observed rollback journals were 4,616 bytes and had `sqliteHotHeader=false`; no hot-journal qualification is inferred. The host was released afterward for the setup lane's acceptance journey.

Local retained evidence:

| Log | SHA256 |
| --- | --- |
| `.superpowers/capacity/continuity-focused-final.log` | `e3f776c3714e4f5e0e0d6a0eb40ca25ef5db2dcf1dcbdcbab97afbc49ff05a42` |
| `.superpowers/capacity/continuity-recovery-final.log` | `8c794ca01401e8995e826632e8e372e19dfa4169b297468878dd1b45b6702557` |

Fresh hosted Node22.23.4 installation/profile CI and all four main jobs remain **PENDING** until their actual candidate-run results are recorded. Local evidence uses retained Node22.23.3 dependencies, not those fresh-install results.

Reproduction after host reservation releases:

```sh
node --import tsx scripts/testWorkspaceAuditContinuity.ts
sudo sh scripts/fixtures/qualifyAuditContinuity.sh "$(realpath "$(command -v node)")" "$(realpath node_modules)" "$(id -un)"
```

The dedicated `.github/workflows/audit-continuity.yml` is parent-authorized, contents-read only, pins Node22.23.4, runs normal fresh `npm ci`, requires native tools without skip, and uses explicit private mount namespace setup. Only new 64MiB source and 1GiB output images are mounted; engine and fault probes run as an unprivileged runner. Artifacts contain logs only, not synthetic private keys or private DBs. Missing tools, root isolation failure, assertion failures or unqualified native versions fail the job. All four ordinary CI jobs remain required in addition to this profile job.

## Review findings and residual integration

Agent code self-review found and corrected weak archive verification (hash-only was insufficient), provider-await artifact mutation, retaining all earlier image buffers, mutable provider object aliases and a cold-journal recovery gap. The final local run exercised those recovery and race paths successfully. Evidence self-review keeps intermediate successes, real failures, retained dependency limitations and host overlap separate from fresh hosted qualification. No independent human review is claimed.

The OPERATIONAL cutover guard was identified by static review; its controlled-provider/no-file-change regressions were added with the fix. A pre-fix red execution for that specific finding is not claimed. The missing-module RED runs and the real cold-journal failure are separately preserved above.

Root-owned required runtime work remains **INCOMPLETE**: startup and every-write fresh independent current-head/epoch enforcement; atomic source/revocation/policy pointer updates; operation/body-receipt and digest lookup across active plus complete sealed history; session/key epoch fencing and actual fresh service keys; schema-2 adapter; production interruption/availability policy; real trust-root appointment, custody, revocation and acquisition. A caller-written `domain:'OPERATIONAL'` field is not evidence of those capabilities. The only shipped provider lives under `scripts/fixtures/`, is marked SYNTHETIC ONLY and uses real SQLite/Ed25519 solely to test protocol mechanics.

No original-data activation, migration, ceiling increase, history deletion, valuable-data recovery or production trust enrollment occurred. Before a remote CAS, stopping retains an incomplete/prepared stage and requires fresh currentness to make any operational decision. After remote CAS, rollback to the predecessor is forbidden; recovery is forward-only by exact transition. All unprovable cases remain unavailable with history preserved. Physical power-loss, maximum-size resource usage, hostile privileged custody and Windows durability are **NOT_QUALIFIED**. Package6 must not be counted complete from this offline candidate.
