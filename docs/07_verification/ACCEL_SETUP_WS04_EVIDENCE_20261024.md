# ACCEL-20261024 packages 3/4 — setup and bounded diagnostics

Executor: Codex delegated setup/WS04 worker. Authority: the operator's accelerated-completion mandate and root's isolated-lane assignment. `OPERATOR_DELEGATED_DECISION`; `HUMAN_REVIEW_WAIVED_BY_OPERATOR`; `AGENT_EXECUTED_ACCEPTANCE`. This is a candidate engineering record, not human acceptance or production release.

**Local qualification complete:** historical Node22.23.3 and current Node22.23.4 fresh npm/Bun installation, audits, genuine native loading and targeted application qualification passed. Each current profile passed all122 targeted checks plus WBS validation, typecheck and build. Local WS04: NOT_REPRODUCED. Historical WS04 operation, permission stage and cause: UNKNOWN. Hosted diagnostic and actual combined-candidate CI remain separate pending evidence. No runtime fix, permission change, timeout change or dependency-version change is included.

## Source, ownership and inputs

- Base runtime: `556bed68191a6af27a8fc0aad95363b5a534cd48`, tree `9f03079669e65329be553e96cbed3b3d9e843d31`. Diagnostic source commit: `c2c8501890ecfcb187d1dd1a0220cb02a8cf678d`, tree `6444f679f46c95f801fb00ad4da189f96139fcdf`.
- Lane: `codex/accel-setup-ws04-20261024`, `C:/Users/HomePC/.codex/worktrees/accel-setup-ws04/docmonstakrakin-version-sync`. Private task root: its ignored `.local/accel-20261024` directory. Root alone integrates.
- Read and preserved PR83 SETUP-PLAN-01 at `e026f5a`; PR84 diagnostic proposal at `9fb9448`; PR85 external-agent specification, ownership/candidates and checklist at `ef6cd8a`. Their historical prohibitions/results remain historical. Campaign delegation authorizes this task-owned setup and diagnostic activation; it supplies no human test or quorum vote.
- Original operator `C:/Users/HomePC/dev/docmonstakrakin-version-sync/node_modules` remains a junction to `C:/Users/HomePC/dev/docmonstakrakin/node_modules`. No installation, cleanup, authority access or configuration change targeted it.
- Local OS `10.0.26300.0`, x64, PowerShell 7.6.5; token owner equals current user, Administrator role false. Runtime ACL acquisition still uses original Windows PowerShell and unchanged 4-second/2-second subprocess limits. Actual TEMP/TMP remained `C:/Users/HomePC/AppData/Local/Temp`.

## Official toolchain and SDK evidence

Primary sources: [Microsoft SDK downloads](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads), [dated Microsoft installer](https://download.microsoft.com/download/46742ab5-6592-4968-a793-129e7f3bc55a/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe), [Node 22.23.3](https://nodejs.org/en/blog/release/v22.23.3), [Node 22.23.4](https://nodejs.org/en/blog/release/v22.23.4), [npm 11.7.0 registry metadata](https://registry.npmjs.org/npm/11.7.0), [Bun installation documentation](https://bun.sh/docs/installation), and [Bun 1.4.2 registry metadata](https://registry.npmjs.org/bun/1.4.2). These are pinned observations, not claims that a version is the newest.

| Input | Refreshed observation |
| --- | --- |
| SDK bootstrapper | File version `10.1.26100.9457`, SHA-256 `b0bdbad38ae74c40ccae8cdbcf229807627fba2bc3100be28301c4ba884f755e`, Authenticode Valid/Microsoft Corporation. Header/library directory version `10.0.26100.0`. |
| SDK closure | Existing helper freshly verified the selected MSI files and all 20 CAB signatures, then extracted 3,918 source records into a new regular task-owned directory. Every relative path/size/SHA-256 matches the preserved historical receipt; comparison differences zero. New receipt SHA-256 `fd5ddb9781dd929de9e1805b31bd4353f7748667b268860a82b702e1b7c98ec3`. Peak one-CAB staging bytes `134513723`. No SDK registration/host installation. |
| Node 22.23.3 | SHA-256 `9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e`, matches official release SHA list; Authenticode Valid/OpenJS Foundation. Historical comparison profile, ABI127. |
| Node 22.23.4 | SHA-256 `dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f`, matches official release SHA list; Authenticode Valid/OpenJS Foundation. Acquired in a new private directory. The official security-release notice prompted current-runtime requalification rather than transfer of old-runtime results. |
| npm 11.7.0 | All 1,835 installed files matched the official registry tarball after SHA-512 integrity verification. Current profile executes the separately extracted official npm tree in the task root. |
| Existing compiler | VS2026 18.9.2, MSVC directory `14.51.36231`, `cl.exe` 19.51.36256.0, SHA-256 `e6d57100c82ae0310c18b16abfe52bc0df8fbb272ca6c5fb287d485807cfce91`, Authenticode Valid/Microsoft Corporation. |
| Compiler probes | Direct Windows.h/CRT executable and ordinary v145 MSBuild executable both compiled and executed successfully using genuine extracted SDK headers, libraries and imports. |
| Bun | Pinned `1.4.2+744846f84`, acquired through official npm packages with registry integrity metadata; executable SHA-256 `15277c59ccd6c6c20f8dc9716c2b59c1776320d606b6a8658f70be8799519ca4`. |

The child profile calls existing `VsDevCmd.bat -no_logo -arch=x64 -host_arch=x64 -winsdk=none`, then points process-only SDK/INCLUDE/LIB/PATH variables at authentic extracted files. Empty task-owned npm configuration, caches and node-header directories isolate setup. No global PATH/npm configuration, registry, OS policy, security predicate, TEMP/TMP or package lock was changed. Source npm lifecycle selected Python 3.11.9/node-gyp 12.1.0. SQLite's official package uses its shipped prebuild when present; successful node-gyp lifecycle is not falsely described as recompiling SQLite.

## Installation and runtime checks

Each dependency tree started absent in a regular checkout. npm used `ci --foreground-scripts --registry=https://registry.npmjs.org`; Bun used `install --frozen-lockfile` with a task-owned cache. No `--ignore-scripts` bypass, manually copied native binding, force flag or lifecycle-trust change was used. Package and lock hashes stayed unchanged. Bun's default blocked scripts are explicitly disclosed below.

| Check | Node 22.23.3 npm | Node 22.23.3 frozen Bun | Node 22.23.4 npm/Bun |
| --- | --- | --- | --- |
| Fresh install / audit | PASS / zero findings | PASS / zero findings | Both PASS / zero findings |
| Required native lifecycle guard | npm scripts enabled | PASS | Bun PASS |
| Actual native load | PASS | PASS, same loaded binary hashes | Both PASS, same loaded binary hashes |
| Synthetic foundations / paths | 35 / 7 passed | 35 / 7 passed | Both35 /7 passed |
| Windows private directory | 7 passed | 7 passed | Both7 passed |
| Workspace store | 18 passed | 18 passed | Both18 passed |
| Real application and browser | 14 passed | 14 passed | Both14 passed |
| TLS / backup | 17 / 17 passed | 17 / 17 passed | Both17 /17 passed |
| Compressed parser security | 7 passed | 7 passed | Both7 passed |
| WBS / typecheck / build | PASS | PASS | Both PASS |

The current npm sequence ran 2026-10-24T06:29:00Z–06:34:00Z; frozen Bun ran06:34:34Z–06:39:50Z, serially under the reserved Windows-heavy window. Both current regular checkouts were at `c2c8501890ecfcb187d1dd1a0220cb02a8cf678d`. The historical npm private-directory suite was captured separately because it was added to the orchestration list afterward; its7/7 result is retained. No failed run was replaced by these current results.

Both native probes actually loaded SQLite 3.53.4 through better-sqlite3 13.0.3 and argon2 0.45.1. Observed `process.dlopen` paths and SHA-256 values:

- `node_modules/better-sqlite3/prebuilds/win32-x64.node`: `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a`.
- `node_modules/argon2/prebuilds/win32-x64/argon2.glibc.node`: `7d1716c8eafe32d54a12af5c0d3024cd715a7e1fdc8092eea84fd369d267075c`.

Bun continues to block `@google/genai@2.22.0` preinstall and `protobufjs@7.6.6` postinstall. The unchanged fail-closed guard confirms required native scripts are not blocked, and explicitly does **not** grant full dependency-lifecycle compatibility. npm/Bun's existing locked GenAI versions differ; no lock was rewritten. Builds retain existing CJS `import.meta` and bundle-size warnings. These successful synthetic/browser tests are agent-executed acceptance, not human acceptance, live-client qualification or original-operator cutover.

Two task-private probe defects are preserved: the initial native provenance assertion expected an obsolete `better_sqlite3` filename, and the initial Bun inventory capture omitted its stderr header. Actual load-path observation corrected the first; shared stdout/stderr descriptor acquisition corrected the second before the unchanged lifecycle guard passed. No reinstall/retry-to-green or application change was used to mask either capture error.

## WS04 diagnostic outcome

The original failure is [run 39926700203](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39926700203), Windows job `120324904757`, at `f578091b38ffe2b3c3357b6e6d99d528edc39fc4`. PR84's retained original archive SHA-256 is `14c390d9bf1559fda051d783a11cc79b2de824b2283e01229434070fb3ef7ea6`. It reports `WORKSPACE_PERMISSIONS_INVALID` under the WS04 test label, without the failing command or acquisition stage. Later green runs do not diagnose it.

The store test, store API, worker and private-boundary Git blobs are unchanged between historical `62d6677`, this runtime base, and the local diagnostic. Prefix mode copies original WS01–WS04 bytes into an adjacent temporary test, preserving order/helpers. Original WS04 block SHA-256 remains `84b9ff2c8121a5f63576547202098705f8ade5dcd085ba933af655c9b3d12d5c`.

| Fixed local attempt | Cases | Observation | Disposition |
| --- | --- | --- | --- |
| Fresh npm, inherited environment, prefix | 4/4 | Parent and worker observed; 243 subprocesses; zero failed subprocesses/permission failures | NOT_REPRODUCED |
| Fresh npm, exact PD06 sparse environment, prefix | 4/4 | Parent and worker observed; 243 subprocesses; zero failed subprocesses/permission failures | NOT_REPRODUCED |
| Genuine negative controls | 2/2 expected rejections | Initial inherited descriptor exits3; changed successful listing pin rejects without a subprocess failure | Observer discrimination only |

Local runner/observer hashes and actual HEAD/tree are in the summaries. Added worker preload and evidence writes perturb timing. This does not reproduce the historical hosted environment. No instrumented result is called an uninstrumented CI reproduction.

The dedicated read-only Windows workflow activates the reviewed capture in disposable hosted scope, separate from `ci.yml`. It runs on this lane's same-repository PR or explicit manual dispatch, freshly installs dependencies, executes genuine controls and both fixed profiles in the owner-correct child, and preserves sanitized artifacts. Root review required both profiles to execute even if the first fails; matrix failure is reported after collection. Hosted result is pending publication at this checkpoint.

## Separate current-master capacity failure

Root retained [run 40067046174](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40067046174), Windows job `120792387120`, at master `ef6b30`: fresh Bun capacity 17/18 with `STORE_REQUEST_TIMEOUT` in the 4095/4096 boundary case, elapsed66,432ms; other three jobs passed. Original log SHA-256 `4aa2fa11027575759d2f84d2f7aff330a10c4e7ab61a24613ac9cb5329307326`. Hosted Node was22.23.4. The timeout marks an uncertain request and is not retried; its particular command/cause remain UNKNOWN.

Three predefined full source-derived diagnostics passed: fresh Bun/Node22.23.3 18/18 in88,868ms; fresh npm/Node22.23.4 18/18 in77,697ms; fresh Bun/Node22.23.4 18/18 in73,414ms. Each result is NOT_REPRODUCED. The largest observed22.23.3 parent request was65.73ms for an authorization denial in the boundary case. These local measurements do not explain the hosted3,000ms timeout. The helper records only case/stage/command/count/timing and public errors, never RPC payloads or credentials. No speculative performance/runtime fix is selected. Root authorized a separate test-only diagnostic candidate from masteref6b30 to expose operation/phase/elapsed context on future failures. It is [draft PR91](https://github.com/Jeruzael/docmonstakrakin/pull/91), signed head `08cbad33af0cc3139247b04ceb1fa3b57d2c71ef`, with candidate 18/18 in73,443ms and two observation/redaction controls passing. Its dedicated record preserves all three original comparisons and the temporary observer source; the helper remains task-private here. This candidate is not a runtime fix or part of the WS04 cause claim.

At06:02:33.549Z all lane installations and heavy jobs were idle. Root reserved the host for a separate worker's matched runtime diagnosis after that worker observed two timeouts during the prior install window. Overlap is a hypothesis, not a demonstrated cause. That reservation was released after the worker's isolated checks passed; the two current capacity comparisons then completed. The user interruption preserved completed session48845 and both receipts, which were refreshed on resume at06:13Z. Root subsequently reserved a short actual-application check window; native/install/hash/clone/archive work is serialized around those explicit reservations.

## Reproduction and residuals

Use the recorded process-only profiles in a new task root, verify official inputs and SDK receipt, and begin with absent dependencies. Run npm and Bun phases serially. Preserve every output directory; the task runner rejects reuse. SDK payload, caches, authority fixtures and credentials are not release artifacts. Stop dependent operations on failed qualification and retain logs.

The evidence archive's `profile-current.cmd` and `run-qualification.mjs` reproduce the current process environment and commands. Place them in a new task root, set the verified existing VS path if this machine differs, acquire the pinned official inputs with the recorded digests/signatures, and create regular source checkouts at the recorded revision. The existing SDK helper accepts `--layout ABSOLUTE_OFFICIAL_LAYOUT --sdk-root NEW_ABSOLUTE_ROOT --evidence NEW_ABSOLUTE_DIRECTORY`; use `--plan-only` first with separate new outputs, then extract and compare the resulting receipt. Place the authentic extracted SDK at `private-sdk` under the task root. The current profile uses `node-22.23.4`, extracted `npm-official-11.7.0/package`, and separate `current-npm-checkout` / `current-bun-checkout` directories. Invoke the profile with `compiler`, `npm`, `npm-checks`, `bun`, and `bun-checks` serially. A fresh target must begin without `node_modules`; do not run the historical-profile commands in the original operator installation. The archived profiles are a record of this qualified setup, not a machine-wide installer or a guarantee for other hosts.

No canonical WBS/task registration or runtime synchronization was applied by this lane. Human-observed acceptance is NOT_RUN. Original-operator activation, production authorization and current-master post-merge qualification remain separate gates. Exact final candidate, archive manifest, hosted result and residual fields must be updated before claiming completion.

## Preserved package and review

[Raw evidence archive](accel-setup-ws04-20261024/setup-ws04-evidence.zip): 1,606,063 bytes, SHA-256 `eff93a8ca5499961daf30a06a018ac2d1d0c1e9ac2a291e3aacc750cef5ca9bf`. Its internal manifest SHA-256 is `ee24bc5a8dd83b40450adb8750fdc36bfd7910b545ea5bab22cad2cfb813506a`; all252 entries were checked against decompressed bytes. [Archive metadata](accel-setup-ws04-20261024/archive.json) records packaging time. It includes original failed provenance/inventory captures, official input receipts, SDK plan/extraction records, compiler proofs, installation/audit/guard results, all four qualification profiles, source/lock identities, sanitized WS04 observations and process-only reproduction scripts. SDK payloads, caches, dependencies, authority data and credentials are excluded. The curated inputs returned no secret-pattern matches. The raw original capacity failure remains in root's retained log; PR91 separately preserves capacity diagnostics.

[Disk footprint](accel-setup-ws04-20261024/disk-footprint.json): task root2,592,887,237 logical bytes plus separate capacity dependencies223,220,653 bytes, below the8GiB budget. This conservative sum counts duplicate hardlink sizes. Original operator junction target is unchanged; all four task dependency roots remain regular directories and package/lock Git blobs match their checkout HEADs. No task-owned evidence was discarded.

Fresh JavaScript syntax checks and hosted PowerShell parsing passed. Root's agent review of diagnostic source `c2c8501` required collection of both fixed hosted profiles and explicit negative controls; signed successor `93ed69e14d746ad7736724982bbc270677f0ca18` implements both. Local fixture/observer evidence pins the original run source and hashes; hosted execution will pin its actual checkout HEAD/tree. Review waiver and delegated decisions are campaign metadata only. The Windows-heavy reservation was released at06:40:48Z after all native/build/packaging work completed; no pending local heavy process remains. Root owns final candidate review, integration and actual post-merge qualification.

First hosted activation at signed `bdf11fcaa1eac3a92e69754ef0f8b2a0a235ba6c`, [run40071277056](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40071277056), failed workflow validation before creating any job: line28 used `runner.temp` in job-level `env`, where that context is unavailable. This is an activation defect, not WS04 reproduction. `OPERATOR_DELEGATED_DECISION`: move only the diagnostic evidence-parent assignment into the run step using the existing `RUNNER_TEMP` environment variable. Fixture TEMP, observer, native child and scope remain unchanged. Preserve the failed run; qualify the corrected workflow on its new signed head without retrying the unchanged invalid workflow. Ordinary four-job candidate run40071295167 is a separate run and receives no diagnostic credit.
