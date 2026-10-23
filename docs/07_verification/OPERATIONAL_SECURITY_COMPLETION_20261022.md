# Operational workspace security completion — 2026-10-22

This additive checkpoint follows the operator's instruction to defer task 1 (actual operator browser acceptance) and autonomously implement tasks 2–8. Engineering choices and ordinary development integration are authorized. Software tests, an agent review and that authorization do not establish independent humans, appointments, custody, operational WBS ratification or release approval.

Implementation baseline: master `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`, tree `45d51f48c68a91bd5233569c6301b44c786b1e15`. Its actual [CI39721949800](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800) passed four jobs and114/114 suites /2,481 reported checks. Those are baseline results, not this candidate's results. The earlier additive closure `18981cdf666f0352ac93f0648d57605d87e7bcb2` and signed design/plan `95e97a6ecbb426dc2af1dc140a1219de14d98ece` remain in the candidate's ancestry.

## Implemented decisions

| Workstream | Engineering decision and boundary |
| --- | --- |
| 2 Windows installation | Use a disposable regular dependency directory, genuine Microsoft SDK files and process-local build configuration. Preserve the first missing-SDK failure and subsequent failures. Do not change the operator's dependency junction, global installation, registry or credentials. Fresh qualification results are recorded separately from retained native execution. |
| 3 Persistent authentication | A separate private SQLite authority owns local human principals, Argon2id verifiers, revocable digest-only sessions, bounded persisted throttles, policy and security audit. No default account or HTTP enrollment. Offline initialization imports only the fixed optional migration input and grants no imported ownership. |
| 4 Scoped application access | ENFORCED is the default. Every registered API is classified; project/document/package access is bound to the authenticated principal and explicit membership. Owners do not inherit SO/LA roles. SQLite commits scope, CAS, operation replay, ownership and the whole project snapshot atomically. The browser gates mounting, fences identity transitions and keeps CSRF proof in memory. |
| 5 Release evidence | Replace status-only success with exact project/release/task/commit/build/environment binding. A bounded, pinned read-only GitHub observer supplies a fresh technical CI observation only. Imported claims, legacy signoffs and local chain consistency never become production evidence or human release authorization. |
| 6 Reliability and transport | Private path/provenance/schema admission, bounded body/authority/KDF requests, uncertain-write fencing, restart tests, explicit stopped-owner lock recovery, private offline backups and unactivated new-destination restore preparation. Optional TLS uses exact private loopback leaf/key paths; no operator certificate or trust installation. |
| 7 Governance readiness | Invoke the existing historical/current and synthetic registration verifiers, compare actual local bytes and expose the missing operational prerequisites. Every result remains non-applying, `mayApply:false`. No caller verdict can clear missing authority. |
| 8 Integration and handoff | Preserve focused failures, qualify the combined implementation, publish signed changes and inspect exact candidate and actual post-merge CI separately. Task1 remains explicitly deferred. The operator's development-review waiver is not recorded as a GitHub human APPROVED review. |

The [workspace guide](../08_handoff/OPERATIONAL_WORKSPACE_GUIDE_20261022.md) supplies normal-checkout startup, offline maintenance and recovery instructions. [Release evidence](OPERATIONAL_RELEASE_EVIDENCE_20261022.md), [TLS](WORKSPACE_TLS_20261022.md), [backup](WORKSPACE_BACKUP_RECOVERY_20261022.md), [Windows qualification](OPERATOR_WINDOWS_QUALIFICATION_20261022.md) and [governance readiness](OPERATIONAL_GOVERNANCE_READINESS_20261022.md) retain their original bounded measurements and qualifications. Later combined results supplement rather than retrospectively replace them.

## Retained failures and corrections

| Observed failure | Cause and correction |
| --- | --- |
| First broad preflight refused an unset CI environment | Correctly selected the isolated owned CI fixture; no operator data initialization. |
| Windows account helper could not load `ConvertTo-SecureString` | PowerShell7's inherited module path was incompatible with the real PowerShell5 child. A process-only native PSModulePath restores the existing contract; the focused helper passes unchanged. |
| Source Vite App blank; client403 | The private-file guard treated Vite's resolved `/@fs/` alias ID as a literal path. Normalize that exact filesystem ID before the unchanged lexical/canonical private-path and Vite admission checks. No root widening. RED24/2 → GREEN26/0 includes real App mounting, imported dependencies and retained private-file denials. |
| Old report fixtures rejected, and Gate3 wording differed | Updated test fixtures to the real versioned release DTO. Missing scope correctly yields PENDING/unavailable; forged ready flags cannot bypass production gates. Reports RED7/14 → GREEN14/0; CryptoDemon49 checks plus retained evidence passed. Runtime parsing remains strict. |
| Operational snapshot inherited constructor seed collections | Clear the projection before hydrating its authoritative snapshot. The regression retains a minimal valid snapshot and proves no unrelated collections survive. |
| Background session read superseded login; old401 invalidated a new identity | Serialize session mutations and fence session/ordinary responses by epoch; preserve the mounted private App only during a transition from an existing identity. Deferred-response regressions cover both races. |
| Uppercase operation UUID poisoned an otherwise valid write | Admit the worker's exact canonical lowercase UUID shape before handlers. No permissive worker change. |
| Malformed login JSON returned500 and could reach generic logging | Return400/413 without logging raw request/credential material. Actual server regression verifies the marker is absent. |
| Case aliases bypassed the per-name throttle | Canonicalize ASCII account names before hashing, matching SQLite's case-insensitive lookup. RED12/1 → GREEN13/0 checks three aliases resolve to one persisted key. |
| Invalid UTF8 migration/password bytes could be replaced and committed | Validate exact UTF8 round trips before authority creation and hash raw migration bytes. CLI regression passes5/5; the invalid-migration test first observed3/1, and the later password test observed3/2 (including its consequent fixture-state failure) before correction. |
| Session body decoded after a newer login could restore the old identity | Recheck sequence/epoch/disposal after JSON decoding, retain transition fencing through mutation decoding, and ignore stale parse failures. Deferred valid/malformed body regression RED12/1 → GREEN13/0. |
| Public login attempts could exhaust critical audit history and name counters | Persist bounded rate counters without appending critical audit; check global denial before allocating a new account key. Native RED1/2 → GREEN3/0 preserves existing audit, successful-operation audit and full-capacity rollback. See [the bounded admission record](WORKSPACE_LOGIN_ADMISSION_20261022.md). |

The first complete-run attempt was intentionally interrupted after discovering the compatibility failures; it is not a completed regression result. Its captured console and failing suite logs are retained locally under `runtime/operational-security-20261022/first-full-interrupted/`. Focused tool-captured RED results are identified as such; no nonexistent raw-log digest is claimed.

## Combined qualification

At this checkpoint, final combined full regression, strengthened actual-App/bundled-server qualification, fresh Windows installation and hosted candidate/post-merge CI remain pending. This paragraph must be supplemented with actual outcomes before an integration success claim. Focused results alone do not qualify the whole tree or a production workload.

## Preserved evidence and remaining limits

Canonical WBS remains69 items with its existing statuses; YAML SHA-256 is `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`. Historical receipts/snapshots, PR34/52, human-only SO/LA quorum, all14 privileged route denials, disabled live agents, Gate7 and release restrictions remain intact. New operational project data does not modify canonical WBS.

The operator's original JSON migration input and untracked PR53 note are preserved. No actual operator identity, password, grant, root or certificate was created, and no operator data migration was performed. Disposable synthetic native/HTTP/browser fixtures are distinct from actual operator acceptance.

Candidate resource bounds are finite admission rules, not accepted production SLOs. Same-OS-owner hostile mutation is not defeated by path checks; local audit consistency needs an independently retained head to detect rollback/tail truncation. Full admitted snapshot/proof workloads, whole-process capacity, real disk-full/read-only-volume/power-loss behavior and activated restore freshness remain unqualified. Backups are private plaintext and retain original provenance; a copied database cannot activate new authority.

Real independent human appointments/custody, ratified production trust roots/policy, authenticated time/revocation/antirollback acquisition, safe Git descendants and protected atomic WBS/ledger/receipt application remain separate operational prerequisites. Their absence is reported honestly; neither a CI green result nor an engineering waiver supplies them. No release promotion or Gate7 completion follows from this checkpoint.

## Continuation qualification — 2026-10-23

The operator selected all six remaining engineering workstreams. This is explicit authority for ordinary candidate planning, implementation, publication and guarded integration; no human approval, appointment, custody, trust ratification or production release is invented.

The first **completed** combined attempt ended2026-10-22T08:35:58.229Z with133/137 suites,2,693 passed/25 failed reported checks. The earlier interrupted attempt remains distinct. [Original failure bytes](operational-workspace-evidence/first-complete-failures.zip) and [raw-byte manifest](operational-workspace-evidence/first-complete-manifest.json) preserve the report, console and all four failed-suite logs. The original48/49 controlled-document version checks passed with one timeout; approval inbox13/25, reviewer coherence0/11 and actual application11/12 identified obsolete fixtures and the previously described transport race. These are not hidden by later green subsets.

Focused corrections now observed: deterministic inbox25/25; reviewer coherence11/11; actual source/built-CJS application14/14 including shared-context cross-tab logout and actual loopback TLS; password reader32/32; CLI5/5; native workspace store18/18; HTTP8/8. The application/coherence results preceded the last list/session correction, so the final whole-tree run must repeat them. WBS, TypeScript and production build exited0 after the last source changes; existing large-bundle and three CJS import.meta fallback warnings remain disclosed. Native CJS execution is tested directly rather than inferred from warning text.

The independent agent review found that account replacement ignored an unsuccessful old-session revocation. HTTP RED6/2→GREEN8/0 now refuses the transition with503 and no new cookie, attempting to revoke the undelivered successor. Expired old cookies can still perform a fresh login. This is code review by an agent, not a GitHub independent-human approval.

The new fatal streaming password helper preserves split multibyte UTF8 and literal BOM, rejects malformed/incomplete input, never echoes passwords and restores prior terminal mode after success/failure/cancel/EOF. Its8KiB cumulative terminal-editing ceiling is a candidate compatibility choice; the existing1,024-byte password and1,026-byte piped-input bounds remain. New focused text copies explicitly normalize LF; their original local bytes remain retained. No private credentials or real authority were used.

Atomic project listing uses one current-session/snapshot/membership transaction through the unchanged shared policy. Previous listing performedN+1 filesystem-admitted RPCs and reparsed the snapshot per project. Candidate complexity is one parse O(snapshot bytes), one principal-membership read and O(projects+memberships) filtering, with one RPC. It neither caches grants nor accepts caller-provided resource lists. Native RED17/1→GREEN18/0 proves policy equivalence, subtractive denial and current revocation; HTTP RED5/1→GREEN6/0 proves one listing RPC, resource isolation and refusal behavior.

### Reproducible small synthetic listing profile

Run `node --import tsx scripts/benchmarkWorkspaceListing.ts` in an isolated qualified checkout. Five alternating baseline/candidate repetitions per profile, Node22.23.3 Windowsx64, tiny serialized project-only snapshots, one explicit synthetic READER membership per project. The script creates and removes only a newly named task-private temporary directory. All visible IDs are checked against the exact expected list.

| Projects / bytes | Baseline p50 / p95 ms | Candidate p50 / p95 ms |
| --- | --- | --- |
|1 /57|491.57 /494.38|244.57 /247.07|
|8 /162|2355.80 /2388.63|257.16 /293.61|
|32 /544|8286.40 /8722.34|242.98 /300.90|

[Every sample, CPU time and sampled memory](operational-workspace-evidence/windows-list-benchmark.json) is preserved. P95 is the maximum of five samples; sampled RSS includes this process's worker, while heap covers the main isolate only. It is not a continuous peak measurement. These warm tiny-input results do not qualify64MiB snapshots, maximum memberships, whole-machine/process-tree capacity or production latency. Existing3s per-RPC/16-pending/four-admission bounds are unchanged.

Finite4,096-event/operation/digest history remains fail-closed, including startup and authority admission at capacity. Offline status reports counts; no automatic pruning, epoch reset or history bypass is introduced to prolong use. Stop and preserve the store before exhaustion. An accepted archival/successor/recovery mechanism remains future work. SQLite failure/crash tests are not described as real power-loss or disk-full qualification.

At this capture, the final combined regression, exact hosted candidate CI, signed publication and actual post-merge CI remain pending. This checkpoint records verified focused work only. Later results must be appended separately before integration is called successful.
