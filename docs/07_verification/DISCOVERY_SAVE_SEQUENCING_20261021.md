# Discovery answer save sequencing — 2026-10-21

## Scope and baseline

This bounded candidate changes exactly three paths:

- `src/components/QuestionnaireView.tsx`
- `scripts/testDiscoverySaveSequencing.ts`
- `docs/07_verification/DISCOVERY_SAVE_SEQUENCING_20261021.md`

Preparation baseline: `80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e`, an **unmerged repair candidate**, not a verified master or release claim. This branch was created from that immutable candidate in the existing campaign-auth checkout. The previous `codex/campaign-auth-recovery` branch remains at `d574915eedf164d201c3b5e0fc7bbaf5076005b6`; 287 existing runtime/local files were retained byte for byte. The ignored checkout preservation record is `runtime/final-discovery-save-gates/checkout-preservation.json`.

Before full qualification, the unpublished branch advanced by normal fast-forward to `b8784d97c727160f46b77930c39428d8124ba5db`. This is a **pending combined candidate, not verified master**. Its 24 incoming paths are disjoint from the three paths above and combine the repair, risk, evidence, requirement draft, work display, reviewer-session and session-capacity candidates. All three candidate file hashes plus prior runtime/local evidence remained unchanged across reconciliation (312 retained files, zero changes). Raw patch/source copies and before/after manifests are under `runtime/final-discovery-save-gates/reconciliation-b878/`. Full local qualification of this combined tree does not replace each integration/post-merge CI gate.

## Reproduced behavior and correction under test

The existing answer handler sets React pending state but has no immediate request admission lock. Numeric presets and several clickable option containers can submit another answer while the first callback is pending. Their local setters also change the displayed draft before the shared handler runs. A callback for an earlier question can subsequently write its error into the active question. The Not Applicable wrapper awaits a handler which catches errors and resolves, so it closes the modal and discards its justification even when persistence failed.

The focused test mounts the actual QuestionnaireView in Chromium with actual React/browser events and a deliberately held persistence callback. Its eleven cases cover immediate numeric overlap, clickable technology choices, pending input controls, retained draft and reasoning after failure, explicit retry, A/B/A feedback ownership, Not Applicable failure and navigation, a bounded UI wait, late completion ownership, and unmount. All network access is denied by the fixture. No HTTP route, server idempotency, reviewer identity, or authorization is exercised.

The correction uses a synchronous admission lock, question/lifecycle feedback ownership, disabled answer controls, acknowledged success before clearing Not Applicable justification, and an explicit 20-second UI deadline. Capture guards also protect clickable option containers and their local setters. Navigation remains available; changing question visits clears obsolete modal/error feedback while the owning request eventually releases the pending lock. Unmount cancels only the local wait and clears its timer.

The persistence callback has no cancellation interface: a deadline can only stop waiting for local feedback. It cannot establish whether the server committed, cancel the underlying request, or guarantee exactly-once writes. Timeout guidance says that the server may still have saved the answer and asks the user to refresh and check the question before any manual retry; there is no automatic retry. Deadline tests inject the callback for the actual 20-second timer and do not measure elapsed wall-clock time. The App callback may still complete its ordinary project refresh after this component has stopped waiting.

## Evidence status

Focused verification used the existing dependency junction with Node 22.23.3 x64 and installed Chromium, without installation or package/lockfile changes. Actual mounted RED completed at 2026-10-21T14:43:53.051Z: **2 passed, 9 failed**, exit 1. The source manifest was unchanged during execution (`15a3719ff41ba1fb39c022280c90550a0a937a63f9758715370485984f2fad9a`). Numeric presets produced both 30 and 90 callbacks; technology options admitted two writes; pending inputs stayed editable; A/B and A/B/A navigation exposed old errors; failed Not Applicable closed its dialog; no 20-second deadline existed. Ordinary failure/retry and unmount isolation already passed.

The same test source passed **11/11** after the component correction. The pre-existing questionnaire UI suite passed **13/13**, including technical recommendation/selection, deferred decisions, navigation, and readiness compatibility. TypeScript exited 0. The GREEN harness completed at 2026-10-21T14:45:15.707Z with an unchanged tested-source manifest (`24e2bd1396785f7893a0d24ac0defc776867016abd29f992a56473a58e648b2c`). No assertion changed between RED and GREEN. All browser cases denied network access and checked for runtime errors/unhandled rejections.

| Retained artifact under `runtime/final-discovery-save-gates/` | SHA-256 |
| --- | --- |
| `red/browser.log` | `fbddbe873645dd6d8867680ec5677d434b01fd3c5c0995009db6bf95017cbb99` |
| `red/results.json` | `4fa242c21a8edd0e1c5899a371c7e4fc675886c674cac89f02f4fd152a2b2fbd` |
| `red/execution.json` | `3ba88169c0ecf6aacf0862c36b504c4edd8d86a188aba3c5049e0a560b4494a6` |
| `green/browser.log` | `5b771dea46af4515a9b995dae70c4c36e281cda107b2c2d06bbe7125d55d17e1` |
| `green/results.json` | `a09f5dfdad88f750b3f3ce2ebfe5c831723039e1fe57d5021a1780829ee1f6e0` |
| `green/questionnaire-compatibility.log` | `e5317f537bd478a8b97bbb04de59fa665fefd5df4f1bcbaf05370444a709d5b9` |
| `green/execution.json` | `1f50c734fc23d8ac14d1c400ca4cd7708ae3d8411b19a55e44fd94064149d07f` |

Tested runtime SHA-256: `src/components/QuestionnaireView.tsx` = `8c33a70b5a7620e760fe1fbc998a3c45aaaa4cf92ea2b7998de0956e9c43acec`; unchanged RED/GREEN test SHA-256 = `88d9e77eddaf05e8b83935100d49f22f41393c7081885577cf0815abecaf81b7`. Each owned run retains its source copies, before/after manifest, logs, result report and execution record. Historical evidence is retained rather than overwritten.

Reproduction from the repository root with a separately qualified Node 22 runtime:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/testDiscoverySaveSequencing.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testDiscoveryQuestionnaireUi.ts
node node_modules/typescript/bin/tsc --noEmit
```

An independent read-only agent review inspected the final runtime/test hashes, raw RED/GREEN logs, compatibility result, TypeScript result, and stable per-run manifests. It found no remaining actionable issue in this scope. The reviewer ran no additional tests and made no edits; this is an engineering review, not human approval.

## Combined local qualification

Fresh qualification on pending combined baseline `b8784d97c727160f46b77930c39428d8124ba5db` ran from 2026-10-21T14:48:23.942Z to 2026-10-21T14:57:07.328Z. Actual complete regression: **93/93 suites, 2,241/2,241 checks, zero failures and skips**, exit 0. Synthetic runtime preparation, WBS synchronization, TypeScript, Vite build, server bundle, and diff whitespace checks each exited 0. Vite retained its existing advisory about chunks over 500 kB; this is not a claim of bundle-size optimization.

The full run includes the actual local product journey (9), Discovery sequencing (11), existing questionnaire UI (13), Reports UI/projection (14/11), release evidence claims (21), controlled version sync (50), requirement draft retention (10), reviewer-session UI (19), risk display (16), evidence display (8), work display (4), and native session capacity (18). The actual controlled-doc orchestrator log reports **40/40 core, 29/29 additional, 11/11 focused suites**, zero snapshot mutation, and all 28 registered live documents untouched. No redundant complete controlled-doc run was added.

The harness compared all **647 source files** before/after and found no changes. The 28 retained focused-evidence files remained exact. All 286 historical runtime files were backed up before suites reused ordinary output locations, and those backup bytes matched their original hashes. The prepared synthetic snapshot remained byte-identical: `484dca9eba843e0a3be29049dce98c5784daf6dc72aa566a95760d3f368d7263` (stateVersion 1, audit count 0, no active transactions). No install was run through the dependency junction.

| Artifact under `runtime/final-discovery-save-gates/full-combined-candidate/` | SHA-256 |
| --- | --- |
| `complete.log` | `6267c61fd78e202e19fa3d4c91f11b604ee97e205d97703e371e16e3b7150edb` |
| `rc-regression/results.json` | `3d5aa60d415d85979a130ee0dcb3d4e9c447e734093f0d788f2e6e81dfda7ea3` |
| `execution.json` | `ca1b1c296849c17cc21ceb1c52ceacc7042d758d9aed3dee50d75060dd60daa6` |
| `source-before.json` and `source-after.json` | `3401f44c74fbca2370e7ccc9cfb90233969ddfdfad190dda9ac91f58da5c5299` |
| `wbs.log` | `ac0e7cb1e9ccf9843d12673ea6ea0d31c5df0d4b3183798b46896951c53e9f95` |
| `typescript.log` (empty, exit 0) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `vite-build.log` | `9ae0dbbdf3039e4426bddac6ac515da24c65e79e6a8e529519da7afa1eb5b33b` |
| `server-build.log` | `80b76998eb3b837ba9c144b8de8dad44fc7310ea9f1829adebd5f99dc72d7e1d` |

This existing verification file received the outcome receipt after the source-invariant run; runtime and test bytes did not change. The final handoff manifest is retained separately in `runtime/final-discovery-save-gates/source-final-handoff.json`. These are local combined-candidate results. Integration, actual post-merge CI, production authentication, live credentials, human review authority, and release readiness are not established by them.

For the full Windows regression, the process imports `Microsoft.PowerShell.Utility` before setting its process-only `PSModulePath` to `Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/Modules'` so account fixtures can load their built-in module. It sets `CI=true`, clears `GEMINI_API_KEY` for that process, runs `scripts/prepareCiRuntime.ts` only in the disposable checkout, then executes `scripts/runCompleteRegression.ts` followed by WBS/TypeScript/build gates sequentially. Existing local/runtime data is preserved before preparation. This does not claim that a clean dependency installation on the original operator host has been qualified.

The answer payload, ANSWERED / DEFERRED / NOT_APPLICABLE states, explicit justification, and existing technical selection ratification semantics remain the compatibility contract. App, server endpoints, review policy, Gate 7, signoff, canonical WBS, authentication, and inactive pilots are outside this candidate. Component callback tests do not establish backend ordering after an uncertain network outcome.
