# Original Windows host installation qualification — 2026-10-22

**Updated result: clean-install qualified with the documented task-private SDK profile.**
The additive followup below records normal fresh npm lifecycle installation,
audit 0, actual installed native provenance, native 35/path 7 and WBS/typecheck/build
on this original Windows host. The successful profile uses a genuine extracted
Microsoft SDK and a new official Node-header cache in child-process environment.
The original checkout and its dependency junction remain untouched. This is a
native-install engineering result; application acceptance and production authority
are separate gates.

## Original default-environment attempt — retained

**Result: blocked; the original Windows host is not clean-install qualified.**
A normal fresh `npm ci --foreground-scripts` exited 1 because the host has no
Windows SDK recognized by node-gyp. A subsequent lockfile audit reported zero
advisories; npm rolled back the installed packages, so that audit is not installed
artifact or native-runtime qualification. A genuine Microsoft SDK offline layout
was downloaded and verified, but its per-machine installation requires actual
Windows administrator credentials. No host SDK installation or consent occurred.

This receipt supplements the historical
[native compatibility record](WINDOWS_NATIVE_COMPATIBILITY_20261021.md) and
[normal-checkout runbook](../08_handoff/LOCAL_MVP_REPRODUCIBILITY_20261022.md).
Hosted CI and retained-package results remain separate evidence. This is an
engineering receipt, with no human signoff, real enrollment, canonical WBS
mutation, production trust/authentication activation, privileged-route activation,
live agent, Gate 7 or release claim.

## Source and isolation

The tested source was `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`, on branch
`codex/operational-windows-qualification-20261022`, in the task-owned checkout
`C:\Users\HomePC\.codex\worktrees\campaign-report-truth\docmonstakrakin-version-sync`.
Its previous clean branch `codex/local-mvp-documents-20261022` at
`ed988943074c13d7b40c6b280804129723a62d3e` was retained.

Before installation, the task checkout's `node_modules` junction was verified to
point to `C:\Users\HomePC\AppData\Local\Temp\dmk-combined-5758\node_modules`.
Only that verified junction was removed, using nonrecursive `fs.rmdirSync`;
the target remained present. The install began with no `node_modules` and used a
new regular directory. The original operator checkout's junction at
`C:\Users\HomePC\dev\docmonstakrakin-version-sync\node_modules` still pointed to
`C:\Users\HomePC\dev\docmonstakrakin\node_modules` after the probe. No install
command ran through either junction, and no operator state, credential, global
Node/npm installation or system PATH was changed.

The task evidence/cache root was a newly allocated ordinary directory:

```text
C:\Users\HomePC\AppData\Local\Temp\dmk-operator-windows-20261022-4d1e555d948946598750cce95a85a9ba
```

Only process-local PATH and npm user-config/cache/header-cache locations changed.
The user-config file was empty; normal dependency versions and lifecycle scripts
were retained. There was no `ignore-scripts`, native trust override, copied native
binding, fake SDK/header, registry detection change or source-build bypass.

## Measured environment

| Item | Actual observation |
| --- | --- |
| OS / architecture | Windows `10.0.26300`, x64 |
| Default TEMP and TMP | `C:\Users\HomePC\AppData\Local\Temp`; not overridden |
| Native canonical default TEMP | Same long path; this inventory alone does not prove the seven path tests |
| Executed Node | Portable `v22.23.3`, ABI 127, x64 |
| Node SHA-256 | `9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e` |
| Node signature | `Valid`, OpenJS Foundation; current hash matched its previously retained official manifest receipt |
| npm / node-gyp | npm `11.7.0` CLI from the existing global installation, explicitly executed by portable Node; its lifecycle selected node-gyp `12.1.0` and Node `22.23.3` |
| Python found by node-gyp | `3.11.9`, WindowsApps PythonSoftwareFoundation.Python.3.11 |
| Visual Studio | Community 2026 `18.9.12120.119`; C++ core and MSVC `v145` / `14.51.36231` present |
| Windows Kits before and after layout | `10\UnionMetadata` exists; SDK `Include` and `Lib` trees absent |
| PowerShell 7 | Existing `pwsh.exe` available; native ownership suite not reached |
| C: free before probe | `16,248,762,368` bytes at install preflight |
| C: free after SDK layout/inventory | `15,215,243,264` bytes; other processes can change free space |

The executed Node binary came from the existing task-private portable directory
`C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578`.
Its signature was rechecked during this attempt. The machine's existing Node
installation was not replaced.

## Actual commands and results

The dedicated PowerShell process used this setup, with `$evidenceRoot` set to
the generated task directory above and the working directory deliberately set to
the task checkout:

```powershell
$nodeRoot = 'C:\Users\HomePC\AppData\Local\Temp\dmk-node-22.23.3-ab7bc72893cb47a987f31af733436578'
$node = Join-Path $nodeRoot 'node.exe'
$npm = 'C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js'
$env:PATH = $nodeRoot + ';' + $env:PATH
$env:NPM_CONFIG_USERCONFIG = Join-Path $evidenceRoot 'empty.npmrc'
$env:NPM_CONFIG_CACHE = Join-Path $evidenceRoot 'npm-cache'
$env:NPM_CONFIG_DEVDIR = Join-Path $evidenceRoot 'node-headers'
& $node $npm ci --foreground-scripts
& $node $npm audit --json
& $node $npm ls vite source-map-js better-sqlite3 argon2 --json
```

| Check | Actual outcome |
| --- | --- |
| Fresh full-lifecycle npm install | Exit **1**, `2026-10-22T05:52:31.5566571Z` to `05:53:30.9601108Z` |
| Lockfile audit | Exit **0**, zero info/low/moderate/high/critical advisories; metadata total 431 dependencies |
| Installed-version inventory | Exit **1**, only root project identity; requested package roots absent after npm rollback |
| Actual loaded native binary provenance | **Unavailable**; no newly installed binding can be attributed or hashed after rollback |
| Native foundations 35 checks | **Not run**; fresh `tsx` loader/native packages absent |
| Ownership/path 7 checks | **Not run**; same dependency prerequisite, no substituted TEMP |
| Typecheck / production build | **Not run**; fresh TypeScript/Vite/esbuild packages absent |

The decisive retained install output was:

```text
> argon2@0.45.1 install
> cross-env ZERO_AR_DATE=1 node-gyp-build
> better-sqlite3@13.0.3 install
> node-gyp rebuild
gyp info using node-gyp@12.1.0
gyp info using node@22.23.3 | win32 | x64
gyp info find Python using Python version 3.11.9
gyp ERR! find VS checking VS2026 (18.9.12120.119) found at:
gyp ERR! find VS "C:\Program Files\Microsoft Visual Studio\18\Community"
gyp ERR! find VS - found "Visual Studio C++ core features"
gyp ERR! find VS - found VC++ toolset: v145
gyp ERR! find VS - missing any Windows SDK
gyp ERR! configure error
gyp ERR! stack Error: Could not find any Visual Studio installation to use
npm error code 1
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-gyp rebuild
```

The log also retains npm cleanup `EPERM` warnings for the task's `motion-dom` and
`framer-motion` directories and the npm 11 warning that the isolated `devdir`
environment config is unknown to npm. The node-gyp header cache was nevertheless
created under the task root: 61,688,102 bytes. The npm cache measured 55,645,404
bytes. These warnings were not suppressed or reported as a passing installation.
After npm rollback, the task `node_modules` was a regular empty directory; the
`tsx` loader, TypeScript entry point and native prebuild directories were absent.

## Supported SDK preparation, without host installation

The [official SDK downloads page](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads)
listed SDK **10.0.26100.9457**. Its installer link
[`linkid=2382321`](https://go.microsoft.com/fwlink/?linkid=2382321) resolved to
[the Microsoft download](https://download.microsoft.com/download/46742ab5-6592-4968-a793-129e7f3bc55a/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe).
The downloaded bootstrapper was verified before execution:

| Field | Verified value |
| --- | --- |
| File version / bytes | `10.1.26100.9457` / `1,450,360` |
| SHA-256 | `b0bdbad38ae74c40ccae8cdbcf229807627fba2bc3100be28301c4ba884f755e` |
| Authenticode | `Valid` |
| Signer | `CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US` |
| Certificate thumbprint | `36FA8A6E7CD287169DF9977FD4F2B45D01035866` |

The selected feature was **`OptionId.DesktopCPPx64`**. This is a genuine SDK
feature present in Microsoft's installed Visual Studio catalog's SDK command;
the broad Visual Studio component additionally selects UWP, x86, ARM64, signing
and other tools. The narrower standalone feature avoids requesting those broad
feature IDs, although its supported dependency closure still downloads common
SDK/UCRT and x86-hosted tooling packages.

The only SDK command actually executed was the supported download layout:

```text
winsdksetup-10.0.26100.9457.exe /layout <evidenceRoot>\sdk-layout /quiet /norestart /features OptionId.DesktopCPPx64 /log <evidenceRoot>\sdk-layout.log
```

It exited **0**, from `2026-10-22T05:57:14.0406358Z` to
`06:00:55.8111565Z`. The log records layout action 2, `WixBundleElevated = 0`,
`execute: None` package plans, successful completion and no restart. It is
download evidence only. Measured layout: **429,349,125 bytes / 152 files**.
Read-only Windows Installer database inspection found **50 MSIs**, all with
`ALLUSERS=1`; their File tables totaled **1,430,612,780 bytes / 7,504 files**.
That sum is a payload upper inventory, not actual installed or peak disk usage;
installed features, caches, shared components and filesystem allocation differ.
The cached layout plus existing npm/header caches used about 547 MB, within the
bounded 2.5 GiB preparation allowance. Microsoft's
[SDK requirements](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/)
specify 4 GB free; the current free-space observation exceeds that minimum.
Space is no longer the measured blocker.

## Actual administrator-credential gate and continuation

At `2026-10-22T06:02:53.6748737Z`, read-only token/policy inventory showed:

```json
{
  "CurrentTokenElevated": false,
  "AdministratorsGroupPresent": false,
  "EnableLUA": 1,
  "ConsentPromptBehaviorAdmin": 2,
  "ConsentPromptBehaviorUser": 3,
  "PromptOnSecureDesktop": 1
}
```

The MSI package metadata requires per-machine installation. Microsoft documents
[`ALLUSERS`](https://learn.microsoft.com/en-us/windows/win32/msi/allusers) and
[the UAC credential/secure-desktop policy](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/settings-and-configuration).
Together with the actual standard-user token, this establishes an administrator
credential boundary. User engineering authorization supplies no Windows
administrator identity or credential. No elevation prompt was triggered or
answered, policy changed, credential supplied, service abused or detection
spoofed. An offline layout is not a supported registered per-user SDK.

The concrete continuation is an administrator-owned Windows session using the
verified cached `sdk-layout\winsdksetup.exe`. Recheck its hash/signature and free
space before installing; the following commands are **prepared, not executed**:

```text
winsdksetup.exe /features OptionId.DesktopCPPx64 /quiet /norestart /log <evidenceRoot>\sdk-install.log
winsdksetup.exe /repair /features OptionId.DesktopCPPx64 /quiet /norestart /log <evidenceRoot>\sdk-repair.log
winsdksetup.exe /uninstall /features OptionId.DesktopCPPx64 /quiet /norestart /log <evidenceRoot>\sdk-uninstall.log
```

Keep the layout and installer logs for normal repair/removal. Preserve any shared
SDK feature required by another installed application; do not delete SDK files or
registry entries manually. No automatic reboot or unrelated service shutdown is
part of this plan.

After a real installation, inspect genuine SDK files and normal node-gyp
detection, then retry the same clean npm installation before running the native
35/path 7, installed binary/version inventory, typecheck and build. A standalone
SDK may require the genuine Microsoft Developer Command Prompt to discover the
installed SDK. That environment is not evidence of plain-shell detection.
If normal detection still requires the registered Visual Studio SDK component,
the supported broader alternative is the existing Microsoft-signed Visual Studio
installer's `modify --installPath "C:\Program Files\Microsoft Visual Studio\18\Community"
--add Microsoft.VisualStudio.Component.Windows11SDK.26100 --quiet --norestart
--noUpdateInstaller`; reassess its exact plan and footprint first. Do not insert a
made-up `WindowsSDKVersion`, override detection or relax lifecycle scripts.
Microsoft's [installer command documentation](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio)
also states that quiet/passive installation is unavailable programmatically to
standard users.

## Durable receipt and supplemental raw evidence

The command outcomes, failure excerpt, source, environment, hashes and exact
continuation above are committed evidence. Raw files remain supplemental in the
task root; their private workstation path is not the only account of the result.

| Raw file | Bytes | SHA-256 |
| --- | ---: | --- |
| `npm-ci.log` | 6,146 | `8982bc04e02fe7ca2899c76a4b3c4229c73835983e0516c841c058034b74530d` |
| `npm-ci-result.json` | 164 | `709c5397d48da95578276c27bc1433bf552617ec1c61dd3660c963a6d437f619` |
| `npm-audit.json` | 365 | `646ce2fa9d8d21b9674f96caada594d35cdba776e17acd9f50140cf0b70bbf43` |
| `npm-ls.json` | 54 | `64ed646d4e372f4306b7bac4220d6b850aff81ed0748a93992d2e905ef8eecfd` |
| `sdk-layout.log` | 258,966 | `0486329504538bc0dc7c2893604c8c5cd83dd2ac669b9717aa2e8f7f9e3823c5` |
| `sdk-layout-result.json` | 260 | `bece0902e3d36245007f11b1d328e21b7e1c2b9f534ef82efd74f2ca9773748c` |
| `sdk-layout-inventory.json` | 313 | `a77fa95df1c5e0f1d972fb2e2143c4074481e37fc152866fcf022ef04c1f3d2b` |
| `sdk-layout-msi-inventory.json` | 17,262 | `949755f0f76ff3e53ecad3232df62fcced83df61d30ccfc396364df2a24dd293` |

This original attempt closed no native-install acceptance gate. At that point the remaining blocker was
actual OS administrator credential/consent for supported SDK installation,
followed by a new clean installer/native/build qualification run. Browser and
human product acceptance are separate pending work.

## Additive followup: genuine private SDK and successful clean installation

The supported private-toolchain alternative was investigated after the original
failure. MSI `ALLUSERS=1` describes the installer; it does not prevent reading
Microsoft-signed MSI tables and expanding their signed CAB payloads into a new
task-owned directory. No MSI installation, registry write or UAC interaction was
used in this followup.

The successful checkout was the same task worktree, on
`codex/operational-windows-portable-sdk-20261022` at
`3bc79972ddf93e46e46563c17b33df31606dc39d`. That commit adds only the earlier
receipt to `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`; runtime code,
`package.json`, lockfile and both native suites match that baseline. The backup
implementation branch/checkpoint was retained separately. The fresh dependency
tree remains an ordinary directory at:

```text
C:\Users\HomePC\.codex\worktrees\campaign-report-truth\docmonstakrakin-version-sync\node_modules
```

The install started with an empty regular dependency directory and a new npm
cache. No retained dependency directory supplied this installation. The parent
may subsequently reuse this freshly installed tree through its own task test
junction; that later reuse is separate from the installation measured here.

| Unchanged source file | SHA-256 before and after |
| --- | --- |
| `package.json` | `c1f32e484ce88cba53168fb92412669c634329a8a285cb69b8a0e124f4116cd8` |
| `package-lock.json` | `14fc25efb722971a956cec1c4ad2808fc09e8ac6ea745152b47fb105e0a21f65` |

### Genuine SDK preparation and bounds

The exact signed SDK installer/source/hash in the original receipt was reused.
The acquisition entry is [Microsoft's SDK download page](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads);
the retained payload URL is
`https://download.microsoft.com/download/46742ab5-6592-4968-a793-129e7f3bc55a/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe`.
Verify its `Valid` Microsoft signature and SHA-256
`b0bdbad38ae74c40ccae8cdbcf229807627fba2bc3100be28301c4ba884f755e`
before using the documented `/layout /quiet /norestart /features OptionId.DesktopCPPx64`
download command. The layout operation downloads; it does not install a host SDK.

The committed [verification helper](../../scripts/qualifyOperatorInstallation.ts)
preserves the mapper/extractor without operator-specific paths. Node 22.23.3 can
run it directly before application dependencies exist:

```powershell
$node = 'C:\path\to\qualified-node-22.23.3\node.exe'
$layout = 'C:\task\official-sdk-layout'
& $node scripts/qualifyOperatorInstallation.ts --layout $layout --sdk-root 'C:\task\new-private-sdk' --evidence 'C:\task\new-plan-evidence' --plan-only
& $node scripts/qualifyOperatorInstallation.ts --layout $layout --sdk-root 'C:\task\new-private-sdk' --evidence 'C:\task\new-extraction-evidence'
```

Both output directories must be new absolute paths with canonical existing
parents, separate from the read-only layout. The helper pins this dated installer,
opens MSI databases read-only, verifies Microsoft Authenticode signatures on the
installer/MSIs/CABs, maps `File` → `Component` → `Directory` and `Media` sequence,
and expands one CAB at a time. It preserves source file bytes/declared sizes,
rejects path escapes/links and conflicting targets, and removes only its own flat
staging directories. It never manufactures a header, manifest or detection file,
runs npm, edits registry, suppresses an SDK check, or claims qualification from
mere extraction. A future SDK patch/profile needs a reviewed helper update.

The native x64 selection contains `um/shared/winrt/ucrt` headers, x64 `um/ucrt`
libraries, original `SDKManifest.xml`, original `UAP.props` and `uCRT.props`, and
the original x64 RC/rcdll/MT tools. There are 3,918 source records across 20 signed
CABs and 3,917 unique extracted SDK payload files / 484,335,216 bytes. The duplicate
`appnotify.h` records were byte-identical. Unrelated servicing tools and other
target architecture libraries, optional C++/WinRT packages and optional source
packages are outside this native x64 profile. The two original servicing packages
contain differing `ServicingCommon` DLLs; neither is needed by this native build,
so neither was mixed into the private tree. Original `DesignTime` and `Platforms`
files are retained for ordinary SDK imports. The public helper adds only its own
`task-owned-sdk.json` provenance marker beyond those 3,917 payload files; that
marker is not an SDK detection input.

The committed helper was exercised through help, plan-only and a full independent
extraction. Every one of its 3,918 records matched the qualified private SDK's
declared byte count and SHA-256, including the duplicate record. Its initial
PowerShell 5 JSON-array enumeration failure was retained before the SDK output
was created; assigning the parsed array before enumeration fixed that helper
compatibility issue. Unknown arguments were rejected without echoing a synthetic
secret-like argument, and an existing SDK destination was refused before creating
evidence or changing files. A focused TypeScript check of the helper exited 0.
These checks validate preparation reproducibility; the runtime qualification
below was performed separately against the original private SDK tree.

The independent reproduction evidence remains at
`C:\Users\HomePC\AppData\Local\Temp\dmk-sdk-repro-evidence-4d1e555d-3`:

| Reproduction evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `helper-validation.json` | 186 | `a069c17dd4b60d8471e1dee3a547fc14b2743db150a9dc0d08d87460daf07357` |
| `sdk-extracted-files.json` | 1,347,846 | `fd5ddb9781dd929de9e1805b31bd4353f7748667b268860a82b702e1b7c98ec3` |

The actual qualified SDK root is
`C:\Users\HomePC\AppData\Local\Temp\dmk-sdk26100-4d1e555d\WindowsKits\10`.
Peak single-CAB stage was 134,513,723 bytes. A later logical-file inventory of
the official layout/caches, private SDK including probe outputs, and fresh
`node_modules` totaled 1,378,719,378 bytes. The independent helper reproduction
adds 484,335,216 payload bytes and its small marker/logs, plus at most 134,513,723
bytes of transient CAB staging; the combined owned footprint remained below the
2.5 GiB task budget. Free
space after the first extraction was 13,066,162,176 bytes; unrelated processes
can change it. The installed host `Windows Kits\10` still contains only the
pre-existing `UnionMetadata` tree. Existing global tooling remains intact.

### Actual process-only toolchain profile

The local node-gyp 12.1.0 finder explicitly supports the real Developer Command
Prompt's `VCINSTALLDIR`/`VSCMD_VER` and `WindowsSDKVersion` path. The genuine VS
2026 Developer Command Prompt reported `VSCMD_VER=18.9.2`, MSVC
`14.51.36231`/`v145`; its setup inventory earlier reported installation version
`18.9.12120.119`. MSBuild's unmodified SDK properties accept an explicit
`WindowsSdkDir_10`, `UniversalCRTSdkDir_10` and `UCRTContentRoot`. The original
SDK `UAP.props` resolves its own root through the original `SDKManifest.xml`.
No SDK-installed boolean, fake VS package, disabled check, source edit or registry
substitution was used.

A disposable Windows.h/CRT C++ program compiled and executed through both raw
MSVC and an ordinary MSBuild `v145` project, printing `PORTABLE_SDK_CXX_OK`.
The MSBuild project retained normal SDK imports/checks. Its actual TEMP output
produced warning `MSB8029` about incremental builds in a temporary directory;
the warning was retained. Compiler probes established the private SDK could be
consumed before the normal npm lifecycle was attempted.

The following usable `.cmd` recipe reproduces the successful environment with
selected genuine paths. Run it in a **task-owned checkout with no dependency
junction**, using qualified Node 22.23.3 x64 and a new `RUNROOT`. It changes only
the child process environment. An already installed compatible SDK can instead
use its ordinary Developer Command Prompt.

```bat
@echo off
set "VSROOT=C:\Program Files\Microsoft Visual Studio\18\Community"
set "SDKROOT=C:\task\new-private-sdk"
set "NODEDIR=C:\path\to\qualified-node-22.23.3"
set "NPMCLI=C:\path\to\npm\bin\npm-cli.js"
set "CHECKOUT=C:\task\fresh-application-checkout"
set "RUNROOT=%TEMP%\dmk-sdk-qualification-%RANDOM%-%RANDOM%"
if exist "%RUNROOT%" exit /b 1
mkdir "%RUNROOT%"
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

`-winsdk=none` skips automatic registry-based SDK environment selection; the
subsequent variables select the actual private SDK. Normal node-gyp/MSBuild
discovery, imports, SDK checks, dependency versions and lifecycle scripts remain
enabled. The supported `npm_package_config_node_gyp_devdir` spelling uses a new
header cache. TEMP/TMP are never replaced by this recipe.

### Retained retry and successful measurements

The first private-SDK retry at `07:56 UTC` passed SDK detection, then failed
because the **old task header cache** had `installVersion=11` and `x64/node.lib`
but no `include/node/common.gypi`. Node-gyp's normal `ensure` shortcut trusted
that incomplete cache. This failure is retained in
`portable-profile-ef87b83f-ed50-4ad9-8a1f-0463d8d239ee`. Its 78 leftover ordinary
`.bin` shims were moved into that failed attempt's `rollback-bin` after exact
path/link checks. No retained package or header was copied into the retry.

The successful attempt used a new empty per-attempt header cache. Normal
node-gyp downloaded the official Node 22.23.3 headers, SHASUMS and x64 `node.lib`
and completed its normal MSBuild lifecycle. Evidence is under the original task
evidence root in `portable-profile-409ddae3-d828-489b-9ee7-ae8ec660f6a3`:

| Check | Actual result / UTC |
| --- | --- |
| Fresh `npm ci --foreground-scripts` | **0**, `08:00:27.272`–`08:01:31.579`; 329 packages added, 330 audited |
| `npm audit --json` | **0**, `08:01:31.581`–`08:01:34.608`; zero advisories, dependency metadata total 431 |
| Installed package inventory | **0**; Vite `6.4.4`, source-map-js `1.2.2`, better-sqlite3 `13.0.3`, argon2 `0.45.1` |
| Native foundations | **35/35**, `08:01:36.883`–`08:01:42.045`; actual SQLite `3.53.4` and real Argon2id work |
| Ownership/path suite | **7/7**, `08:01:42.046`–`08:01:44.547`; actual `pwsh7`, `aliasDiffers:true` |
| `npm run ci:quality` | **0**, `08:01:44.548`–`08:02:15.292`; WBS zero drift, TypeScript, Vite 2378 modules, server esbuild |
| Runtime TEMP/TMP | Actual default `C:\Users\HomePC\AppData\Local\Temp` throughout launcher/profile |
| Checkout isolation | Ordinary fresh dependency tree; package/lock hashes unchanged; original operator junction unchanged |

The ordinary lifecycle ran argon2's `node-gyp-build`, better-sqlite3's implicit
`node-gyp rebuild`, both esbuild installers and protobufjs postinstall. The
default loaders selected the upstream prebuilt native files from the **freshly
installed** packages; the result does not claim locally source-compiled bindings:

| Loaded artifact below the fresh `node_modules` | Bytes | SHA-256 |
| --- | ---: | --- |
| `better-sqlite3/prebuilds/win32-x64.node` | 1,989,632 | `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a` |
| `argon2/prebuilds/win32-x64/argon2.glibc.node` | 210,944 | `7d1716c8eafe32d54a12af5c0d3024cd715a7e1fdc8092eea84fd369d267075c` |

The Node process was `v22.23.3` x64, ABI 127. Existing `node-domexception`
deprecation and Vite's bundle-size warning remain; no npm/global upgrade was
performed. Synthetic native/path success establishes the stated compatibility
profile, without human enrollment, production policy/revocation acceptance,
browser acceptance, release authorization or OS administrator consent.

### Followup evidence fingerprints

The following files are below the successful attempt directory above unless
prefixed `../`, which refers to the original task evidence root:

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `qualification.json` | 4,384 | `22326d0b30df30d16135c41de7cbd59c7989080145817f6e1b5b3d2022bd1b82` |
| `npm-ci.stdout.log` | 511 | `04816e8faca89ce16cdd0f821826886dc7ce655c583818e6f9be1c4dd18c7939` |
| `npm-ci.stderr.log` | 3,823 | `26401f1a4ff760ed1f03a02981b7f76669554ee807827d95abe0d81df58d60e7` |
| `npm-audit.stdout.log` | 365 | `646ce2fa9d8d21b9674f96caada594d35cdba776e17acd9f50140cf0b70bbf43` |
| `native35.stdout.log` | 3,639 | `feb6b81f6dcbf459b893a3c6648964cace0d617292d5dd924e53aa31f82035f4` |
| `paths7.stdout.log` | 809 | `5f19233467ed9c7a5042dc0896f16f7fa1d4e56c5cdc03f4b8c79015c02fd31a` |
| `ci-quality.stdout.log` | 789 | `b242340015414cb211b9429970272a0030096bee413c76ac99e475401ab7cb8a` |
| `ci-quality.stderr.log` | 409 | `0efe29e4e782ba1577b5e9f8f1ab59237f5dd324a74364fee299c4d47291313f` |
| `../portable-sdk-file-map.json` | 2,943,553 | `4526bcbc0f12fb3e92ae0a7f9f5f47578335897b7dc94455289112d7a0b8b76b` |
| `../portable-sdk-extracted-files.json` | 1,379,192 | `d977fb218766c931bae69926cb756d88d1ab179a45ce19bf0c21bf1e271efc8c` |
| `../portable-sdk-child-environment.json` | 3,787 | `b01c989ec2302c6cd819f89bf18d6ae6b9fd924ced0f6e302e8a9e49c5350420` |
| `../portable-sdk-build-probe-result.json` | 1,703 | `c1056fb38b44c422a3d91901bccee89ab5ff20e4a38ec18491fe9fb646f6ba5a` |
