# Windows native path compatibility candidate — 2026-10-21

Baseline: signed master `148be8892b37aaf1944aca0c0671b6a948192f38`, actual push workflow [39559475919](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39559475919), four successful jobs, 71 suites / 1,904 checks. This is Workstream A of the [new standing campaign authorization](../06_planning/AUTONOMOUS_CAMPAIGN_AUTHORIZATION_20261021.md). The supplied attachment's original byte SHA-256 is `f832a4d05f0507490a46f5d923a5eda0a1278be0a05fd09ce52432d18bf55ac0`; its text is copied with normal Git EOL normalization. This authorizes bounded engineering and conditional protected integration, not operational governance ratification. Maximum eight scoped PRs, expiry 2026-11-04T00:00:00Z; independent exact-HEAD human review remains mandatory.

## Design and bounded implementation

Use Node's native filesystem canonicalizer consistently in parent, worker and cleanup. Keep rejecting junction/symlink substitution and noncanonical generated roots; do not approximate identity by lowercasing paths or string-prefix matching. Pin original parent and generated-root device/inode identities, not only the pathname and marker bytes. Native canonicalization fixes actual 8.3/long-name disagreement; identity pinning also rejects a copied replacement directory. Keep Windows per-user DACL restriction, Linux 0700 ownership and exact generated-root bounds. Directory cleanup uses its original pinned parent even if process TEMP changes.

The parent/worker private protocol gains parent/root identity fields atomically. This is not a public production adapter or schema migration. Existing schema v1, native pins, KDF/session/policy/audit assertions and all cardinality limits remain unchanged. Raw malformed worker initialization still returns STORE_PATH_INVALID. SQLite, WAL, SHM and marker files must have one link; a hard-linked database cannot redirect native writes to an external inode. This deliberately tightens fixture acceptance: moved/replaced directories and linked authority files are unsupported and fail closed.

Files: `ownedDirectory.mjs` (native canonicalization/identity guards), `privateStore.ts` (capture and cleanup), `privateStoreWorker.mjs` (worker admission), `testSyntheticStorePaths.ts` (real adversarial fixtures), CI (default Windows TEMP and both installer checks), this record, campaign authorization and additive main handoff. No dependency version, real identity, operator directory, production listener, canonical WBS or historical receipt changes.

## Defects and genuine RED evidence

The unchanged baseline was checked in a separate disposable checkout with exact test source and retained, lock-matching native packages:

| Input | Baseline observation | Candidate requirement |
| --- | --- | --- |
| Actual Windows 8.3 TEMP from GetShortPathName | Positive open assertion fails with STORE_PATH_INVALID | Real alias opens and closes the same owned native store |
| Substitute freshly allocated root with a junction before provisioning | Initial candidate adopted the target's canonical name and identity | Keep lexical creation result; reject link before any target provisioning |
| Stop, rename generated root, copy database and owner bytes into a new directory at original path | Missing expected rejection: copied replacement is accepted | Device/inode mismatch rejects restart |
| Move database and hard-link it back on Windows | Missing expected rejection: external inode accepted | Multi-link authority file rejected before open |
| Junction/symlink root substitution | Fail-closed behavior retained | No deletion of link target |
| Matching-marker replacement at cleanup | Previously trusted pathname/marker alone | Cleanup refuses replacement; retains both directories |
| Process TEMP changes after creation | Re-read TEMP could refuse original cleanup | Original parent remains pinned; alternate directory untouched |

An early Windows test attempted to rename an open SQLite directory and received EPERM; the test now checkpoints/terminates its own worker before replacement. An early failing hard-link test cleanup hit EBUSY; cleanup now stops its own worker before removing the test link, revealing the actual assertion failure. An encoded PowerShell probe emitted CLIXML progress that masked captured stderr; explicit text output and suppressed progress preserve the actual STORE_PATH_INVALID assertion. These fixture failures were not reported as product acceptance. The original PR58 hosted default-TEMP failure remains preserved in [the earlier gate](FAST_TRACK_FINAL_GATE_20261021.md).

Candidate local Node22.21.1 x64 Windows checks initially passed six new path scenarios, actual `aliasDiffers:true`, all35 existing native-foundation checks and WBS/TypeScript/build. Independent agent review then found a creation-admission gap: canonicalizing the just-created root could adopt a substituted target. A seventh deterministic real-filesystem substitution test reproduced this with a missing expected rejection before the lexical-root fix. Final focused/full/controlled results and exact signed-head CI are recorded separately in the PR, after this document is committed; future success is not predeclared here. The local retained dependency fixture is **not** a clean operator-host installation.

Parallel campaign verification exposed an existing browser-test harness issue: Vite treats `port:0` as default5173, causing independent runs to collide. The failed A controlled run is retained, not weakened or counted as passing. Full gates are serialized until the separate test-fixture correction is integrated. Hosted CI jobs run in isolated machines and must independently pass the exact candidate.

The first exact-head hosted run [39569273055](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39569273055) at `e2b310c2efd81602e20fb292f3ad6742401f3587` passed all three Linux jobs. Windows completed a normal clean npm install, audit0, the original35 checks and six new path checks; its alias helper then hit its 15-second PowerShell timeout without output, so Bun qualification did not run and that candidate was not accepted. Raw Windows log SHA-256: `e91a5c43480f7e2664b04ebdaec1c0daeafe323256dc5ed9c38aca401d1020aa`. The helper now obtains the actual short path through the existing Windows `Scripting.FileSystemObject` ShortPath API, removing its transient C# Add-Type compilation dependency. The process bound, exact canonical-path comparison and real SQLite open/close assertions are unchanged. A new signed HEAD requires all four CI jobs; the earlier failure remains part of the evidence.

## Clean installation qualification

The Windows CI job now keeps actual default TEMP, including RUNNER~1; the former unaliased-TEMP override is removed. Both normal fresh npm/full-lifecycle installation and a separate pinned Bun1.4.2 frozen installation run the original35 checks plus the seven new path checks. Linux full regression discovers the new test automatically. Each job prints actual toolchain, installed versions and loaded binary SHA-256; a successful compiler log is not proof of the artifact selected by the loader.

Use fresh disposable clones, Node22 x64, Python and compatible MSVC/Windows SDK (Windows) or build tools (Linux):

```text
npm ci --foreground-scripts
npm audit --json
node --import tsx scripts/testSyntheticStorePaths.ts
node --import tsx scripts/testSyntheticSecurityFoundations.ts
npm run ci:quality
npm run ci:controlled-docs
npm run ci:regression
```

Install Playwright Chromium/dependencies as described in the main handoff, only in the disposable environment. On Windows, import Microsoft.PowerShell.Utility before assigning process-only PSModulePath to System32/WindowsPowerShell/v1.0/Modules for the existing account fixture. Never run installation through the original operator node_modules junction or the retained test-only dependency junction. A real clean installation starts with no node_modules at all.

For the separate Bun checkout use `npx --yes --package=bun@1.4.2 -- bun install --frozen-lockfile`, inspect `bun pm untrusted`, then execute the native tests with Node22. No ignore-scripts or trust-manifest override is added. The already disclosed protobufjs7.6.6 postinstall remains blocked under Bun's default policy. Its pinned script only reads dependency metadata and warns about version-scheme mismatch; it does not supply a native binding. Inspected script SHA-256: `5af8463b97ee8e309b4a2111f9479bacdf0c180de0ca0155527679b1fc6d9e6c`. Retain this limitation rather than silently enlarge the lifecycle trust allowlist. Npm is the full-lifecycle proof; Bun's qualification is under its stated default policy.

## Operator-host SDK maintenance disposition

Read-only inventory: Node22.21.1/npm11.7.0, Python3.11.9, VS2026 Community18.9.12120.119/MSVCv145; no Windows Kits Include tree; current token is not elevated. C drive had 5,075,496,960 bytes free at inventory. Microsoft's [SDK requirements](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/) list 4GB available disk. Download/cache/install/recovery plus campaign test outputs would leave insufficient prudent working headroom, so no installer was downloaded or run and no UAC/elevation bypass attempted. This is an unresolved operator-host qualification, not a hosted failure or request to change credentials.

Before any later permitted installation: inventory free space again; select an official supported Microsoft SDK installer from the [official download page](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads); record final official URL/hash; require Get-AuthenticodeSignature Status=Valid and a Microsoft signing identity; determine exact Desktop C++ x64 header/library components and space/cache requirements; record installer feature IDs, logs and normal uninstall/repair procedure; respect ordinary UAC consent and /norestart. Never stop unrelated services, reboot automatically, alter credentials or touch the original dependency junction. If these prerequisites cannot be satisfied, stop host maintenance and keep hosted/operator qualification distinct. A documented setup is not proof an installation occurred.

## Acceptance, residual risk and rollback

Required for candidate integration: valid signed final HEAD, all four exact-head jobs including default-TEMP Windows fresh npm/Bun qualification, independent human security/compatibility approval and clean protected merge. Verify actual master ancestry/tree/signature and all four post-merge jobs afterward. No synthetic result ratifies production limits, identity storage, trust or authorization.

The generated-directory identity guard detects observed replacement; it is not a claim of a fully race-free filesystem broker against another process controlled by the same OS principal. Native SQLite opens are path-based. No new production adapter is introduced. Windows file-symlink creation itself needs additional privilege and is not claimed from an ordinary token; real directory junction and database hard-link rejection are exercised there, with POSIX file symlinks on Linux.

On candidate failure retain original evidence and reject integration. Roll back through an independently reviewed revert of this bounded code/CI change; never rewrite evidence or weaken the path assertions to regain green. Failed cleanup leaves uncertain directories for independently inspected recovery, rather than deleting a replacement. No operational WBS apply/consume, trust enrollment, authentication cutover, privileged route, live agent, Gate7 or release operation is part of this change.
