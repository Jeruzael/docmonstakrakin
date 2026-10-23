# WS04 bounded diagnostic investigation — 2026-10-23

**Historical failing authority operation: UNKNOWN. Historical permission-acquisition stage/root cause: UNKNOWN. Local result: NOT_REPRODUCED. No runtime fix applied.**

The existing failure record cannot distinguish an error during fixture opening, worker startup, a particular authority command, or fixture closing. Three fixed local synthetic attempts passed. Their elapsed times describe those attempts only; they do not establish why the hosted run failed. A review-only hosted capture proposal is included separately from the four required CI jobs.

## Scope and immutable inputs

- Worktree: `C:/Users/HomePC/.codex/worktrees/ws04-diagnostic/docmonstakrakin-version-sync`.
- Branch: `codex/ws04-diagnostic-20261023`; base HEAD `62d66779b9d7236e093eb2fd8e47355c8d42b798`.
- Failed PR82 HEAD: `f578091b38ffe2b3c3357b6e6d99d528edc39fc4`; CI run `39926700203`, Windows job `120324904757`.
- Supplied later PR82 HEAD: `2e8aff5b448e5b65f10309801814ded7b0a1ac61`; run `39928184006`, all four jobs green. This later success is a separate observation, not a diagnosis or replacement of the failed record.
- Original decoded archive, read without modification: `C:/Users/HomePC/dev/docmonstakrakin-operator-prep-20261023-4e6bb8d3/docs/07_verification/operator-acceptance-preparation-20261023/ci-windows-f578091.zip`.
- Archive SHA-256, checked before and after: `14c390d9bf1559fda051d783a11cc79b2de824b2283e01229434070fb3ef7ea6`.

[Source checksums](ws04-diagnostic-20261023/evidence/source-checksums.json) show all 13 inspected test/runtime/helper/workflow/package/lock files have the same Git blob at the base HEAD, failed HEAD, later green HEAD, and current working files. The PR objects were read from the separate operator-preparation clone because this worktree's object store did not contain those PR heads. No fetch was necessary.

The investigation used only new synthetic temporary directories. It did not open an operator authority, use credentials, alter the original junction, install dependencies/SDKs, or change security predicates, timeouts, error mapping, WBS/quorum/Gate7/release gates. At local investigation capture, this agent had not committed, pushed, or created a PR; any subsequent publication status belongs to the publication metadata.

## What the failure archive establishes

The archived job records Windows image `win22`, version `20261012.333.1`, Node `22.23.3`, npm `10.9.9`, and Windows PowerShell `5.1.20348.5622`. It records the owner-correct distinct child profile, PD01–PD07 passing, and the workspace store finishing with **17 passed, 1 failed**, specifically:

`FAIL WS04 member authors write; review needs separate SO/LA and explicit DENY wins: WorkspaceSecurityError: WORKSPACE_PERMISSIONS_INVALID`

WS03 and WS05–WS18 passed, including the actual SQLite store/provenance assertions. The npm/native path was reached. The later application, TLS, backup, and Bun phases were not reached after the store suite failure. The helper's earlier inline `NODE_GENUINE_SQLITE_DIAGNOSTIC` also recorded `MODULE_NOT_FOUND`; that separate inline diagnostic did not prevent the subsequent actual store tests from running and is not evidence of the WS04 cause.

The helper prints the child's captured logs after the child exits. Consequently the nearly identical outer timestamps around the test lines are not acquisition durations. The archive has no WS04 command identifier, parent/worker distinction, target filename, subprocess status/signal/error, stack, or acquisition duration.

## Traced call path and error collapse

`scripts/testWorkspaceStore.ts:52` runs WS04 through `fixture()` at line 20. The fixture opens a store, executes the test callback, then awaits `close()` in `finally`. Its outer test wrapper prints only `String(error)`. Opening or cleanup can therefore produce the WS04 failure label even when no individual policy assertion is identified.

The opening path is `WorkspaceStore.open()` → `acquirePrivateWorkspace()` → boundary `capture()` / `acquire()` / `assertFiles()`, then `Worker(worker.cjs, execArgv:[])`. Worker startup checks files and the lock, opens genuine SQLite, creates WAL/SHM, and admits those paths before replying ready. Each authority request again checks files/lock; transactions also recheck root/lock. The callback's command sequence is:

`bootstrap → info → issue → membership → authorize ×4 → membership → authorize → provision → membership → info → issue → authorize → membership(expected canonical rejection) → close`.

The exact collapse sites in `privateBoundary.cjs` are:

| Site | Genuine operation | How the same public error arises |
| --- | --- | --- |
| Line 26 | Hash the successful `icacls` listing for a previously admitted path | A different listing hash directly raises `WORKSPACE_PERMISSIONS_INVALID`; no failed PowerShell subprocess is required. |
| Lines 31–36 | First descriptor admission with direct Windows PowerShell .NET reads | Owner mismatch, unprotected directory, empty/foreign/non-Allow rules exit 3. Any subprocess exception, including acquisition failure/timeout, is collapsed to the same public error. |
| Lines 51–58 | Fresh directory's owner precheck, exact new DACL write, owner postcheck | Both owner exit-3 checks and any subprocess exception are collapsed to the same public error. |

The PowerShell acquisitions remain **4000 ms**; `whoami` and `icacls` remain **2000 ms**. Store request/startup limits remain 3000/10000 ms. No retries or relaxed admission were added. An `icacls` subprocess exception is distinct from a successful listing with a changed pin; the observer retains that distinction rather than treating every permissions error as a timeout.

`scripts/qualifyOperatorInstallation.ts` prepares a dated SDK prerequisite. It is not called by WS04 or the store/permission boundary and was inspected only; no SDK preparation or installation was run.

## Diagnostic instrumentation

[diagnoseWs04.mjs](../../scripts/diagnostics/diagnoseWs04.mjs) reads the committed original fixture/helpers and exact WS04 block, writes a temporary adjacent copy so relative import resolution remains the same, runs it once, and removes only that generated copy. The original test is untouched. The selected block SHA-256 was identical in every attempt: `84b9ff2c8121a5f63576547202098705f8ade5dcd085ba933af655c9b3d12d5c`. The original full source SHA-256 is `d5e6a7db8d0e0585c54b885cf7414ec347d19f5356fa85951b2b3684e8f687f8`.

[ws04Permissions.preload.cjs](../../scripts/diagnostics/ws04Permissions.preload.cjs) observes original boundary exports, permission subprocesses, and worker RPC command labels. It records only operation/path classes, opaque hashed path IDs, listing hashes, timeouts, durations, exit/signal/error metadata, and public error codes. It does not record command payloads, tokens, PHC/verifier strings, descriptors, subprocess arguments/output, or raw personal SIDs. Hashed path IDs let the proposed prefix capture distinguish separate fixtures' files without printing their paths.

Because the real store explicitly uses `execArgv: []`, the diagnostic launcher adds `--require <observer>` to that worker. It does not assume a parent preload is inherited. Every attempt contains both parent and worker `observer-start` events. This extra worker preload and synchronous evidence writes are explicit timing perturbations; the instrumented attempts are not an uninstrumented reproduction of the complete CI sequence.

## Local attempts and retained package provenance

Qualified executable used:

`C:/Users/HomePC/AppData/Local/Temp/dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578/node.exe`

The supplied campaign-combined `node_modules` was a junction to `C:/Users/HomePC/.codex/worktrees/campaign-report-truth/docmonstakrakin-version-sync/node_modules`. Its regular target directories were copied read-only into this worktree's new regular `node_modules`: `tsx` (including its nested esbuild), `better-sqlite3`, `argon2`, `node-gyp-build`, and `@phc/format`, about 40.7 MB. The copied tree was checked for reparse points; none were present. No lifecycle/install command was run.

A genuine native smoke query loaded better-sqlite3 **13.0.3**, returned SQLite **3.53.4**, and loaded argon2 **0.45.1**. [Native binary checksums](ws04-diagnostic-20261023/evidence/native-binaries.json) match the retained source files. **This is retained-package synthetic diagnosis, not fresh-install qualification.**

The local host reported Windows `10.0.26300.0`, owner equal to current user, and Administrator role disabled. It is not the administrator-enabled hosted Windows Server image. The supervising PowerShell was `7.6.5`; runtime acquisition continued to invoke the unchanged `powershell.exe` path.

| Fixed attempt | Environment | Exit / WS01 + selected WS04 | Observer evidence | Local result |
| --- | --- | --- | --- | --- |
| 1 | Inherited, inherited `NODE_OPTIONS` removed | 0 / 2 passed, 0 failed | Parent + worker; 155 subprocess results; 0 permission failures | NOT_REPRODUCED |
| 2 | Provisional sparse whitelist | 0 / 2 passed, 0 failed | Parent + worker; 155 subprocess results; 0 permission failures | NOT_REPRODUCED |
| 3 | Exact PD06 sparse keys plus diagnostic metadata | 0 / 2 passed, 0 failed | Parent + worker; 155 subprocess results; 0 permission failures | NOT_REPRODUCED |

Attempt 2 retained additional generic Windows keys and omitted `NODE_ENV=production`; it is preserved as **sparse-provisional**, not represented as the exact PD06 profile. Attempt 3 used `NODE_ENV=production` plus only existing `PATH`, `Path`, `SystemRoot`, `WINDIR`, `TEMP`, and `TMP`, matching PD06 before adding the two diagnostic metadata variables. This was a distinct-profile check, not a retry until success.

Each attempt observed 8 successful 4-second-limit PowerShell acquisitions, 145 successful `icacls` reads, and 2 successful `whoami` calls. All eight initial acquisitions occurred during parent opening/worker startup: parent `.security` creation and admission, parent `owner.lock` admission, then worker `.security`, `owner.lock`, `authority.sqlite`, `authority.sqlite-shm`, and `authority.sqlite-wal` admission. Subsequent observed WS04 commands and close used the pin checks.

Observed PowerShell duration ranges were 230.2534–291.5604 ms (inherited), 242.7106–292.3578 ms (provisional sparse), and 220.0809–274.6678 ms (PD06 sparse). These are local measurements only; there is no historical acquisition duration to compare.

[Profiles](ws04-diagnostic-20261023/evidence/profiles.json), [archive manifest](ws04-diagnostic-20261023/evidence/manifest.json), and per-attempt summary files preserve the evidence. The first two runs preceded runner-hash metadata; attempt 3 records its runner and observer hashes. The exact attempt-3 [runner source](ws04-diagnostic-20261023/evidence/used-source-sparse-pd06/diagnoseWs04.mjs) and [observer source](ws04-diagnostic-20261023/evidence/used-source-sparse-pd06/ws04Permissions.preload.cjs) were reconstructed from the intervening diagnostic-only edits and verified byte-for-byte against those recorded SHA-256 values (`b0d15e1e7efcfb662f41bb676d5a14adbec8c507499f23c631a89b097ba0328e` and `979c30e4721d10822d75c6b76fd1807b8094de0302a08aadedd5c04bff77e08c`). No summary hash was overwritten. The final review candidate subsequently added optional prefix selection, context/worker labels, and hashed path IDs; those additions were syntax-checked without another product attempt. The optional prefix mode is **NOT_RUN**, not evidence that WS01–WS04 order was reproduced locally.

## Negative observability controls

[ws04ObserverControls.cjs](../../scripts/diagnostics/ws04ObserverControls.cjs) created two new disposable fixtures and invoked the genuine boundary without changing its predicates:

1. A preexisting inherited `.security` descriptor: observed initial directory descriptor admission **status 3**, approximately 230.88 ms, followed by `capture` → `WORKSPACE_PERMISSIONS_INVALID`.
2. A new successfully admitted private `.security`, then an added well-known Everyone read ACE: observed a successful `icacls` result with a changed listing hash, followed by `assertRoot` → `WORKSPACE_PERMISSIONS_INVALID`, **without any failed subprocess**.

Both expected rejections occurred; control process exit was 0. [Control archive](ws04-diagnostic-20261023/evidence/controls.zip) preserves the sequence. Its observer-start fixture label predates the later control-label refinement; it contains only these controls, not a WS04 product attempt. No timeout was injected or observed. These controls validate error-path discrimination only and establish no historical root cause.

## Exact commands and checks

Commands were run from the diagnostic worktree with the qualified `$node` path above:

```powershell
$node = 'C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578\node.exe'
git switch -c codex/ws04-diagnostic-20261023
git rev-parse HEAD
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\HomePC\dev\docmonstakrakin-operator-prep-20261023-4e6bb8d3\docs\07_verification\operator-acceptance-preparation-20261023\ci-windows-f578091.zip'

& $node --check scripts/diagnostics/diagnoseWs04.mjs
& $node --check scripts/diagnostics/ws04Permissions.preload.cjs
& $node --check scripts/diagnostics/ws04ObserverControls.cjs
& $node scripts/diagnostics/diagnoseWs04.mjs inherited
& $node scripts/diagnostics/diagnoseWs04.mjs sparse # attempt 2, provisional runner
& $node scripts/diagnostics/diagnoseWs04.mjs sparse # attempt 3, PD06-aligned runner
```

The control command used a new canonical `dmk-ws04-evidence-controls-<GUID>` directory, set only `DMK_WS04_DIAGNOSTIC=synthetic-only` and `DMK_WS04_EVIDENCE=<that directory>`, then ran:

```powershell
& $node --require ./scripts/diagnostics/ws04Permissions.preload.cjs scripts/diagnostics/ws04ObserverControls.cjs
```

Those two environment variables were restored in `finally`. Source comparisons used `git rev-parse HEAD:<file>`, `git hash-object -- <file>`, and read-only `git -C <operator-clone> rev-parse <PR-head>:<file>` for every entry in source-checksums.json. The native smoke imported the copied better-sqlite3 and argon2 packages and ran `SELECT sqlite_version()` on `:memory:`.

All three JavaScript syntax checks exited 0. PowerShell AST parsing found 0 errors in the diagnostic hosted launcher, and located exactly one original `nativeDefinition` string literal (8287 characters). The optional source prefix through WS04 compiled with copied esbuild, with 0 warnings and no fixture execution. `git diff --check` passed; no original tracked file differed from HEAD. No full regression, CI retry, Bun run, installation, or publication was performed.

## Review-only hosted capture proposal and remaining uncertainty

[hosted-workflow-proposal.yml](ws04-diagnostic-20261023/hosted-workflow-proposal.yml) remains under documentation, outside `.github/workflows`. It is a proposal for a **separate manual synthetic diagnostic**, not one of the four required CI jobs and not an edit to PR82.

It selects Windows 2022 / Node 22.23.3, performs the locked fresh npm install on that disposable hosted runner without SDK installation, and invokes [runHostedWs04.ps1](../../scripts/diagnostics/runHostedWs04.ps1). That launcher parses the original qualification helper's exact reviewed C# literal and reuses its suspended-child/distinct-primary-token mechanism, while keeping the runner token unchanged. The child verifies owner equals user and runs one inherited and one PD06-sparse source prefix **WS01–WS04 in original order**, stopping before WS05. A failure is retained and stops execution; there is no retry-to-green. Evidence upload runs even on failure. Only the evidence location uses `runner.temp`; the fixture's default TEMP is preserved.

This launcher/workflow has only been reviewed and syntax-checked locally, **not executed on hosted CI**. Current image/tooling and observer overhead may still differ from the failed run. An exit-3 capture can identify the original compound descriptor-admission stage, but the observer does not split its individual predicates; a subsequent bounded read-only synthetic descriptor capture would be needed to distinguish those predicates. A 4-second subprocess exception, successful listing-pin change, command-specific boundary error, and parent/worker startup failure are distinguishable in the proposed trace.

The historical operation/stage/cause therefore remain **UNKNOWN**. No fix is proposed from the local passes. The next proposed evidence is a hosted trace with public command ID, target class, original acquisition timeout, real child status/error, and duration while retaining the original failure semantics and gates. Activating and executing that manual workflow requires separate review; publishing this diagnostic draft does not activate it or authorize a permanent fix.

## Additive publication-path failure — 2026-10-23T09:57:26Z

The first published signed diagnostic HEAD `7f5bf123999fc421af8cda218ff25371e8076a47` produced [CI39934633914](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39934633914). Complete Regression job120351059067 failed with137/139 suites passing and2,712 passed/2 failed reported checks; Controlled Docs job120351059537 also failed. Both identify the same explicit assertion in unchanged `scripts/testControlledDocsPersistence.ts:913–919`: paths containing `.candidate`, `.rollback` or `.dmk-` under real docs are rejected as transaction sibling artifacts. The inactive proposal filename `hosted-workflow.candidate.yml` matched that guard. The controlled-document orchestrator stopped at its prerequisite failure; later focused assertions were not executed. Quality & Build passed; Windows was still in progress at this capture. These are per-job observations, not an all-green run or a WS04 diagnosis.

The [two-log archive](ws04-diagnostic-20261023/evidence/publication-failure-39934633914.zip) preserves the failure. It is34,868 bytes, SHA-256 `d46a4372cb5e10d7a6e254c9a7a52848f4987a1044a36a6a25f0f96aa1cb76e1`. Members are `job-120351059067.log` (91,553 bytes, SHA-256 `e92d0923c3a9af6951c005fc6b07be679782884865b06a222823461c1106916c`) and `job-120351059537.log` (63,514 bytes, SHA-256 `5f28a61572c9d0419fcd10769d993209a77334be1724aa0d26c08ee89edd0a0d`). These are tool-decoded UTF-8 text with CRLF normalized to LF and a terminal LF; they are not original HTTP archive bytes. The exact GitHub jobs remain the primary execution records.

The narrow correction renames only the inactive proposal to `hosted-workflow-proposal.yml` and updates its link. It changes no assertion, test, runtime, permission, timeout, dependency or active workflow. The unchanged34-case persistence suite then passed using the separate retained validation toolchain from this isolated worktree:

```powershell
& $node 'C:/Users/HomePC/.codex/worktrees/campaign-combined/docmonstakrakin-version-sync/node_modules/tsx/dist/cli.mjs' 'C:/Users/HomePC/.codex/worktrees/campaign-combined/docmonstakrakin-version-sync/scripts/testControlledDocsPersistence.ts'
```

This focused check establishes the naming correction, not complete candidate CI, native installation support or the historical WS04 cause. The failed HEAD and evidence remain preserved; any later signed correction has its own CI and review boundary. The hosted diagnostic proposal is still inactive and NOT_RUN. Human acceptance remains BLOCKED/NOT_RUN.
