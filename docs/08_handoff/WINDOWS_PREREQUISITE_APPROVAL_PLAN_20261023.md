# Windows prerequisite and isolated environment approval plan — 2026-10-23

**Proposal SETUP-PLAN-01. Status: draft review candidate; exact publication status is recorded in PR metadata. Environment execution: NOT_AUTHORIZED; operator activation: NOT_AUTHORIZED / BLOCKED.** `canonicalApply: false`, `runtimeApply: false`, `mayApply: false`. Audience: the operator approving a bounded Windows qualification attempt and the engineer recording it. Preparing or publishing this document does not approve its commands.

This is the first of three independent proposals. [CAPACITY-INSPECTOR-01](../06_planning/CAPACITY_INSPECTOR_PROPOSAL_20261023.md) proposes observation only. [AUDIT-CONTINUITY-01](../06_planning/AUDIT_CONTINUITY_REMEDY_PROPOSAL_20261023.md) proposes a later durable history design. Approval of setup or either proposal grants no approval of the others. Real enrollment, private import, project memberships and human task 1 each remain outside this environment plan.

## Baseline and retained failures

The inspected runtime is `62d66779b9d7236e093eb2fd8e47355c8d42b798` (PR #81), tree `8f8f34429555173bb595c1f2fdbe48a3c1fa9a87`. The proposal branch is `codex/setup-capacity-decisions-20261023`, in a separate managed worktree. Only documentation is changed. The original checkout is `C:\Users\HomePC\dev\docmonstakrakin-version-sync`; its `node_modules` is a junction to `C:\Users\HomePC\dev\docmonstakrakin\node_modules`. Never install, remove the junction, replace packages or run a cleanup through that path.

The preceding [reconciliation](https://github.com/Jeruzael/docmonstakrakin/blob/2e8aff5b448e5b65f10309801814ded7b0a1ac61/docs/08_handoff/CURRENT_STATUS_RECONCILIATION_20261023.md) and [human checklist](https://github.com/Jeruzael/docmonstakrakin/blob/2e8aff5b448e5b65f10309801814ded7b0a1ac61/docs/08_handoff/OPERATOR_ACCEPTANCE_CHECKLIST_20261023.md) remain authoritative for that preparation. Their local source is `C:\Users\HomePC\dev\docmonstakrakin-operator-prep-20261023-4e6bb8d3\docs`. Do not rewrite their receipts.

The fresh regular clone there failed normal `npm ci --foreground-scripts` on 2026-10-23: node-gyp found VS2026/v145, but no Windows SDK. Its partial dependencies are **UNQUALIFIED**. Retained `docs/07_verification/operator-acceptance-preparation-20261023/npm-ci.zip` is 1,882 bytes, SHA-256 `9a10dbc4449d9b4c23d9813501a3cb704ca34d1476606abcf6cdfee77dc36c8b`; its original archive member `npm-ci.log` preserves 6,006 raw bytes, SHA-256 `a9fbd3819a5028dd24a5798fdf5f3daa4d89beee2c49df0318fd4773d3fc1880`.

Separately, [CI 39926700203](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39926700203) on `f578091b38ffe2b3c3357b6e6d99d528edc39fc4` installed native dependencies successfully, then Windows WS04 failed `WORKSPACE_PERMISSIONS_INVALID` (17 store cases passed, one failed). Root cause is **UNKNOWN**; it is not diagnosed as an SDK fault, ACL defect or transient. The immutable 23,027-byte `ci-windows-f578091.zip` has SHA-256 `14c390d9bf1559fda051d783a11cc79b2de824b2283e01229434070fb3ef7ea6`. Its decoded 92,941-byte member has SHA-256 `e4c6bf04ba65f2e74a125b72fbcf92857c2f6f20ccefa8f5cd69df46b8bac441`. The member is a normalized decoded representation, not original HTTP archive bytes. The separate later all-four-job successful [PR #82 run 39928184006](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39928184006) on `2e8aff5b448e5b65f10309801814ded7b0a1ac61` does not diagnose that failure or qualify a local operator installation. Neither run is human acceptance.

Actual runtime-master [CI 39911133606](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39911133606) remains a historical all-four-job pass. Final signed evidence `ade88004341f59503a4ccad833d2aba9f6a76647` is a separate documentation-only evidence commit; do not merge it wholesale or confuse it with the runtime or this proposal.

## Read-only inventory verified in this preparation

These are observations, not a fresh installation or compiler execution. Recheck versions, signatures, paths and disk space immediately before any approved attempt.

| Input | Observation / exact path | Qualification consequence |
| --- | --- | --- |
| OS | Windows `10.0.26300`, x64 | Native Windows profile only; no Linux inference. |
| Qualified Node | `C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578\node.exe`; executed `--version`: `v22.23.3`; 86,973,768 bytes; SHA-256 `9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e`; Authenticode `Valid`, OpenJS Foundation | Retain existing portable binary. Native ABI 127 was established by the historical qualification; record it again during the new attempt. |
| npm | `C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js`; executed by that Node: `11.7.0` | Do not upgrade npm/global Node. Record lifecycle-selected node-gyp; historical profile selected `12.1.0`. |
| Python | `C:\Users\HomePC\AppData\Local\Microsoft\WindowsApps\python.exe`; executed `--version`: `3.11.9` | Record node-gyp's actual selected executable/version, not just the launcher. |
| VS | `C:\Program Files\Microsoft Visual Studio\18\Community`; read-only `vswhere`: `18.9.12120.119`, display `18.9.2` | Existing installation only. No VS modification is approved. |
| MSVC | Directory `VC\Tools\MSVC\14.51.36231`, toolset `v145`; `bin\Hostx64\x64\cl.exe` file version `19.51.36256.0`, Microsoft signature `Valid`, SHA-256 `e6d57100c82ae0310c18b16abfe52bc0df8fbb272ca6c5fb287d485807cfce91` | The directory/toolset version and compiler file version differ legitimately. Confirm actual compiler/MSBuild in the approved child profile. |
| PowerShell 7 | `C:\Users\HomePC\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe` resolves | Actual Node-descendant ownership/path tests remain required. This is not an ACL repair plan. |
| Registered SDK | `C:\Program Files (x86)\Windows Kits\10` contains `UnionMetadata`; no SDK Include/Lib trees observed | Missing SDK remains a local install prerequisite. |
| Old private payload | `C:\Users\HomePC\AppData\Local\Temp\dmk-sdk26100-4d1e555d\WindowsKits\10` **absent** | Do not reuse this now-missing path as an environment override. |
| Cached signed layout | Under `C:\Users\HomePC\AppData\Local\Temp\dmk-operator-windows-20261022-4d1e555d948946598750cce95a85a9ba\sdk-layout`; bootstrapper present and reverified below | Selected MSI/CAB signatures/content must be rechecked before extraction; existence is not qualification. |
| C: free | `62,961,356,800` bytes at inventory | Variable observation; budget peak install/extraction/probe/log space and stop on inadequate free space. |

No SDK extraction/download, install, authority open, enrollment or application start occurred for this document. Standard file inventory does not qualify ownership in an application's Node descendants.

## Exact historical SDK identity and payload checks

The SDK **layout product** was `10.0.26100.9457`; its bootstrapper **file version** is `10.1.26100.9457`; the selected header/lib/tool **directory version** is `10.0.26100.0`. These identifiers are not interchangeable. The source and extraction recipe are [the historical qualification](../07_verification/OPERATOR_WINDOWS_QUALIFICATION_20261022.md) and [the committed helper](../../scripts/qualifyOperatorInstallation.ts).

The cached `sdk-layout\winsdksetup.exe` was rehashed here: 1,450,360 bytes; SHA-256 `b0bdbad38ae74c40ccae8cdbcf229807627fba2bc3100be28301c4ba884f755e`; Authenticode `Valid`; signer `CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US`; signer thumbprint `36FA8A6E7CD287169DF9977FD4F2B45D01035866`. The recorded acquisition source is [Microsoft's SDK downloads](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads) and [this dated Microsoft payload](https://download.microsoft.com/download/46742ab5-6592-4968-a793-129e7f3bc55a/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe). This plan makes no claim that it is today's latest SDK. If the exact payload cannot be verified, stop; do not accept a similarly named or newer SDK without a reviewed profile change.

The retained `portable-sdk-extracted-files.json` records the following exact payload bytes. Headers, libraries and XML/props are authenticated through the signed MSI/CAB chain and the per-file map; they are not each claimed to have an individual Authenticode signature. All paths below are relative to a **new private SDK root**.

| Required original file | Bytes | Historical SHA-256 |
| --- | ---: | --- |
| `SDKManifest.xml` | 421 | `9efa2baf6f84706751eb8817a9a5e6478fa04f17183a3eb9ceb2ac308e352c43` |
| `Include/10.0.26100.0/um/Windows.h` | 7,511 | `b337d661d03a4abefb7b86a2742ce1ad5d19b57cd8b858bd13e7bbcc1dbeeaaa` |
| `Include/10.0.26100.0/ucrt/stdio.h` | 81,489 | `06cbab3a501306fdd9176a00a83e5bb92ea4d7863cfd666355743527cf99edc6` |
| `Lib/10.0.26100.0/um/x64/kernel32.Lib` | 311,908 | `842f5ce7ad8cf5aab7491b791e7968d2be510ae93f4019d3311797289399d221` |
| `Lib/10.0.26100.0/ucrt/x64/ucrt.lib` | 285,588 | `7ef4eac926bf597d2f243f16cdfed7e0db22cb3ca34a1d7e088a84c994a03d66` |
| `DesignTime/CommonConfiguration/Neutral/UAP/10.0.26100.0/UAP.props` | 7,285 | `37ada8b1270c60ddc4fcd16ed7f7415441664102a84e6e7cb45772a3c8750fbe` |
| `DesignTime/CommonConfiguration/Neutral/uCRT.props` | 1,831 | `26231650a684a4534ec43adba7e3db2f6249da751cccf3cbc0694b6871a72419` |
| `bin/10.0.26100.0/x64/rc.exe` | 55,736 | `9e2ee68da28b3318f50a9f1008d64567a9b402bda384a007a9b71a3f16bd011b` |
| `bin/10.0.26100.0/x64/rcdll.dll` | 264,616 | `4452fa0b470749e6fd70ed2ed2ac859fc243fbe4b67e6875250cfaec64f4388a` |
| `bin/10.0.26100.0/x64/mt.exe` | 1,976,744 | `fa74dd31612c78de40169599640fb955ef9ccb9f2dfabf80f100022ff1b8bc22` |

This table is a sentinel inventory, not the complete SDK. Require all `um/shared/winrt/ucrt` headers, x64 `um/ucrt` libraries, original DesignTime/Platforms inputs, and original x64 RC/MT resource files selected by the unchanged helper. The historical profile contains 3,918 source records, 3,917 unique SDK payload files, 484,335,216 unique payload bytes, across 20 signed CABs. The source-record byte total is 484,337,536 because `appnotify.h` occurs twice with identical bytes. The helper's extra `task-owned-sdk.json` is provenance only, never a manufactured detection input. Exclude optional C++/WinRT/source/other-architecture/servicing files exactly as the helper does.

Retained receipts, rehashed during this preparation:

| Receipt (beneath `%TEMP%`) | SHA-256 | Purpose |
| --- | --- | --- |
| `dmk-operator-windows-20261022-4d1e555d948946598750cce95a85a9ba/portable-sdk-file-map.json` | `4526bcbc0f12fb3e92ae0a7f9f5f47578335897b7dc94455289112d7a0b8b76b` | Original MSI/File/Component/Directory/Media mapping. |
| Same root: `portable-sdk-extracted-files.json` | `d977fb218766c931bae69926cb756d88d1ab179a45ce19bf0c21bf1e271efc8c` | Original per-file digest receipt; source of table above. |
| `dmk-sdk-repro-evidence-4d1e555d-3/sdk-extracted-files.json` | `fd5ddb9781dd929de9e1805b31bd4353f7748667b268860a82b702e1b7c98ec3` | Independent helper extraction receipt. |
| Same root: `sdk-plan.json` | `d74698710f7e9d3d93d4ff590b48db444b42f34515d9998dafa6832367e4fa99` | 3,918-record plan and 20 historically Valid Microsoft CAB observations. |
| Same root: `source-metadata.json` | `440ef6b7610d2f87ad6708071c245e39152fa30bfe89d68f74d0cd974e83f41f` | Historical signed MSI/installer inventory. |

Private temporary paths are supplemental custody locations, not a substitute for durable evidence. Before an approved attempt, independently retain the verified receipts in approved private evidence custody, record their digests and compare **every** newly extracted record by relative path, declared bytes and SHA-256. A missing receipt, missing signed source, signature failure or any mismatch is BLOCKED. No replacement hashes may be invented. Do not commit the SDK payload or private logs into Git.

## Approval boundary and exact deferred sequence

The preferred option is registry-free, task-owned extraction from the exact cached signed layout. It changes no installed SDK, VS component, registry, global PATH, user npm configuration, TEMP or TMP. Approving this option must name the operator, exact source revision, new checkout/root/evidence destinations, private custody destination, allowed disk/time/network budget and permitted synthetic tests. No destination is selected or created by this document.

1. **Preflight:** approve a new absolute task root under `C:\Users\HomePC\dev` whose canonical existing parent is known. Require ordinary local directories, no symlink/junction/reparse/alias/hardlink destination and no overlap with either original checkout/dependency target, historical evidence, any `.security` or live process. Record source tree, package/lock hashes, original junction target and original state hash references without opening private authority. Reject unexpected inherited npm/node-gyp overrides, loader injections or preloads. Verify the effective `ignore-scripts` value is false using the qualified Node/npm's `config get ignore-scripts`, then verify actual lifecycle invocation in the install log; do not dump credential-bearing npm configuration. No deletion is a preflight step.
2. **Isolated clone:** create a new regular checkout with its own `.git`, checked out at the exact approved revision. Do not reuse the failed clone's partial dependencies, any shared `node_modules`, headers or previous npm cache. The command shape below is deferred; replace the placeholders only after approval and validate resolved paths before creation.

   ```powershell
   $taskRoot = 'C:\Users\HomePC\dev\<approved-new-task-root>'
   $checkout = Join-Path $taskRoot 'checkout'
   git clone --no-hardlinks --no-checkout 'C:\Users\HomePC\dev\docmonstakrakin-version-sync' $checkout
   if ($LASTEXITCODE -ne 0) { throw 'CLONE_FAILED' }
   git -C $checkout checkout --detach 62d66779b9d7236e093eb2fd8e47355c8d42b798
   if ($LASTEXITCODE -ne 0) { throw 'CHECKOUT_FAILED' }
   ```

   Approve/create the task root first; stop if it or the clone destination unexpectedly exists. Verify no `.security`, `.local` import, dependency directory or external Git alternates exist in the new checkout. No private data is copied automatically. If a later source is selected, review its differences and record that exact revision instead of silently changing this pin.
3. **SDK plan before extraction:** recheck bootstrapper hash/signature, selected MSI/CAB signatures, helper/source hashes and free space. Choose new canonical sibling directories `private-sdk`, `sdk-plan-evidence`, `sdk-extraction-evidence` under the approved task root, separate from the layout and checkout. The helper's `--plan-only` writes its own evidence; it is not a zero-write command.

   ```powershell
   $node = 'C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578\node.exe'
   $layout = 'C:\Users\HomePC\AppData\Local\Temp\dmk-operator-windows-20261022-4d1e555d948946598750cce95a85a9ba\sdk-layout'
   $sdk = Join-Path $taskRoot 'private-sdk'
   Set-Location -LiteralPath $checkout
   & $node scripts/qualifyOperatorInstallation.ts --layout $layout --sdk-root $sdk --evidence (Join-Path $taskRoot 'sdk-plan-evidence') --plan-only
   if ($LASTEXITCODE -ne 0) { throw 'SDK_PLAN_FAILED' }
   # Review plan count, source signatures, targets and footprint before extraction.
   & $node scripts/qualifyOperatorInstallation.ts --layout $layout --sdk-root $sdk --evidence (Join-Path $taskRoot 'sdk-extraction-evidence')
   if ($LASTEXITCODE -ne 0) { throw 'SDK_EXTRACTION_FAILED' }
   ```

   The original historical peak one-CAB stage was 134,513,723 bytes; unique SDK payload was 484,335,216 bytes. Historical combined logical files were below 2.5 GiB; that is not a present peak guarantee. Approve a measured ceiling covering layout, extraction, transient CAB stage, fresh dependencies/headers/cache, probes and logs; stop before exceeding it. No download is needed if the cached verified closure is complete. Any reacquisition needs its own approved source/network/space scope; no download is performed here.
4. **Compiler validation:** in the child profile below, record `where cl`, `cl /Bv`, `where msbuild`, SDK sentinel hashes and `VSCMD_VER`. Repeat the historical Windows.h/CRT and ordinary MSBuild `v145` probes only in new task-owned probe outputs. Their source/project is not supplied as a new script by this documentation slice; review the concrete probe before executing it. A directory listing or `-winsdk=none` alone is not proof the real SDK imports compile. Failure blocks npm qualification; do not fake an SDK-installed flag or change node-gyp/MSBuild checks.
5. **Fresh lifecycle install and native qualification:** use the existing repository script commands in the child recipe. The run/config/cache/header directories must all be new ordinary directories. Preserve actual stdout/stderr/exit/times, native loaded paths/sizes/hashes, npm audit and package versions. The expected package pins are better-sqlite3 `13.0.3`, SQLite `3.53.4`, argon2 `0.45.1`; do not copy the historical prebuild bytes or call historical fingerprints new measurements. Enumerate the `.node` modules actually loaded by native probes; attributing a nearby binary by filename alone is insufficient. No `ignore-scripts`, `--force`, lockfile update, copied bindings/headers, disabled tests or altered trust/detection checks.
6. **Windows admission:** run the reviewed synthetic store/application/TLS/backup qualification under the supported current-user profile after install/native/path success. Capture WS04 per-operation diagnostic evidence under its separately approved investigation; this document does not authorize instrumentation, retries, helper changes or timeouts. A passing rerun is a distinct observation and must not erase the preserved failure. Operator readiness stays BLOCKED until the admission concern is resolved and the actual setup is qualified.

### Process-only child environment and existing command shapes

This is the historical successful recipe with the verified Node/npm/VS locations and new operator-approved output locations. Save/run only inside an approved child `cmd.exe` process after the preceding gates. `<approved-...>` placeholders deliberately prevent this block from being an unreviewed runnable setup. The parent process and persistent environment are unchanged when the child exits.

```bat
@echo off
set "VSROOT=C:\Program Files\Microsoft Visual Studio\18\Community"
set "SDKROOT=C:\Users\HomePC\dev\<approved-new-task-root>\private-sdk"
set "NODEDIR=C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578"
set "NPMCLI=C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js"
set "CHECKOUT=C:\Users\HomePC\dev\<approved-new-task-root>\checkout"
set "RUNROOT=C:\Users\HomePC\dev\<approved-new-task-root>\<approved-new-attempt>"
if exist "%RUNROOT%" exit /b 1
mkdir "%RUNROOT%"
if errorlevel 1 exit /b 1
type nul > "%RUNROOT%\empty.npmrc"
set "VSCMD_DEBUG="
call "%VSROOT%\Common7\Tools\VsDevCmd.bat" -no_logo -arch=x64 -host_arch=x64 -winsdk=none
if errorlevel 1 exit /b 1
set "WindowsSdkDir=%SDKROOT%\"
set "WindowsSDKVersion=10.0.26100.0\"
set "WindowsSDKLibVersion=10.0.26100.0\"
set "WindowsSdkDir_10=%SDKROOT%\"
set "UniversalCRTSdkDir_10=%SDKROOT%\"
set "UniversalCRTSdkDir=%SDKROOT%\"
set "UCRTContentRoot=%SDKROOT%\"
set "UniversalCRTVersion=10.0.26100.0"
set "UCRTVersion=10.0.26100.0"
set "WindowsSdkBinPath=%SDKROOT%\bin\"
set "WindowsSdkVerBinPath=%SDKROOT%\bin\10.0.26100.0\"
set "INCLUDE=%SDKROOT%\Include\10.0.26100.0\ucrt;%SDKROOT%\Include\10.0.26100.0\um;%SDKROOT%\Include\10.0.26100.0\shared;%SDKROOT%\Include\10.0.26100.0\winrt;%INCLUDE%"
set "LIB=%SDKROOT%\Lib\10.0.26100.0\ucrt\x64;%SDKROOT%\Lib\10.0.26100.0\um\x64;%LIB%"
set "PATH=%NODEDIR%;%SDKROOT%\bin\10.0.26100.0\x64;%PATH%"
set "NPM_CONFIG_USERCONFIG=%RUNROOT%\empty.npmrc"
set "NPM_CONFIG_CACHE=%RUNROOT%\npm-cache"
set "npm_package_config_node_gyp_devdir=%RUNROOT%\node-headers"
cd /d "%CHECKOUT%"
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" "%NPMCLI%" ci --foreground-scripts
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" "%NPMCLI%" audit --json
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" "%NPMCLI%" ls vite source-map-js better-sqlite3 argon2 --all --json
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" --import tsx scripts/testSyntheticSecurityFoundations.ts
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" --import tsx scripts/testSyntheticStorePaths.ts
if errorlevel 1 exit /b 1
"%NODEDIR%\node.exe" "%NPMCLI%" run ci:quality
exit /b %errorlevel%
```

`-winsdk=none` selects no SDK via the registry; the explicit variables point at genuine extracted files. It must not suppress node-gyp/MSBuild's ordinary SDK checks. Keep the MSVC INCLUDE/LIB/PATH established by the real VsDevCmd after the SDK entries. Do not set TEMP/TMP, persistent `setx`, registry keys, `NPM_CONFIG_IGNORE_SCRIPTS` or a native trust override. The successful historical retry needed a new header cache: its earlier cache lacked `include/node/common.gypi` despite having an install marker and `node.lib`. Never repair that cache in place or reuse it.

Further existing qualification commands, separately recorded after those pass, are `node --import tsx scripts/testWorkspaceStore.ts`, `scripts/testWorkspaceApplication.ts`, `scripts/testWorkspaceTls.ts` and `scripts/testWorkspaceBackup.ts`, using the same qualified Node, actual default TEMP and fresh dependencies. The workflow is [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Do not apply CI fixture initialization, CI-only owner-token launchers, TLS trust installation or `ci:prepare` to a real operator authority as a workaround. Actual browser acceptance is a different record.

## Failure, rollback and acceptance

On any signature/hash/path/compiler/install/native/permission/audit/build failure: stop dependent steps, retain bounded redacted logs and exact failure, mark FAIL or BLOCKED, and close only the owned child process. A failed install's remaining files stay UNQUALIFIED. Do not repair existing ACLs, delete a lock, restart the original application, move global tooling or repeat until green without preserving each attempt and a reviewed diagnostic reason.

Rollback for this private-layout option is to exit the child process, restore the original working directory, and leave the failed task-owned outputs for review. Nothing needs to be reverted in the machine environment or original checkout. Any later cleanup must separately verify each resolved absolute path lies inside the approved task root, reject links/overlap, preserve needed evidence and use native PowerShell literal-path operations; this plan grants no recursive deletion. No authority rollback, restored-copy activation or credential rollback is included.

Acceptance requires a durable private receipt containing the approved source/tree and consent, signatures/hashes and all-file SDK comparison, exact child environment, compiler probes, genuine lifecycle success, actual installed/loaded native provenance, native/path suites, audit, quality/build and Windows admission outcomes. Check package/lock hashes and Git diff before/after, original junction/metadata unchanged, no original authority/server interaction, no global configuration change, and actual TEMP unchanged. Reusing old receipts or agent tests is not current qualification or human acceptance.

| Decision / missing input | Current state |
| --- | --- |
| Named operator, exact new paths/custody, finite disk/time/network/test scope; approval of task-private extraction/install | **PENDING approval**; no action authorized. |
| Complete cached signed source closure, durable receipt custody, new full extraction/file comparison and actual compiler probes | **BLOCKED pending approved execution**; old payload absent. |
| Actual fresh lifecycle/native/current-owner admission; WS04 root-cause disposition | **BLOCKED**; separate investigation is unresolved. |
| Real identity enrollment, selected roles/person binding, import choice, project memberships | **BLOCKED absent explicit separate consent**. No implied SO/LA appointment. |
| Human task 1 and finite pilot headroom budget | **NOT_RUN / BLOCKED**; use the pinned checklist after all gates pass. |
| Machine-wide SDK/VS modification | **NOT_APPROVED** alternative only; requires exact administrator-owned install/repair/removal plan and explicit consent. No elevation prompt or installer command is executed here. |

A bounded operator pilot requires a freshly qualified environment, real current-user native ownership, trusted single-user local browser/host, exclusive authority ownership and a reviewed finite event budget counting **every** `AUTHORITY_OPENED` (including offline status). No valuable sole copy, bulk/unattended use, unknown/near/full history or unsupported recovery is admitted. Missing SDK, unresolved WS04, absent consent and unreviewed headroom keep the current pilot BLOCKED. Non-applying design/document review can continue.

Canonical WBS/statuses, historical receipts, Agent Center v0.3, PR #34/#52, independent-human quorum, all 14 privileged denials, disabled live agents, Gate 7 and release restrictions remain unchanged.
