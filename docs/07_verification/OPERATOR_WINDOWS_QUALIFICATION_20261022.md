# Original Windows host installation qualification — 2026-10-22

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

This attempt closes no native-install acceptance gate. The remaining blocker is
actual OS administrator credential/consent for supported SDK installation,
followed by a new clean installer/native/build qualification run. Browser and
human product acceptance are separate pending work.
