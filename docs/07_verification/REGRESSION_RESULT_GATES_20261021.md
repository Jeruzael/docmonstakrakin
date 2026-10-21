# Complete regression result classification — 2026-10-21

Baseline: `b4004c167e5a377a324f7eaa21f877d3d71ae33d`. This bounded test-runner correction is development evidence only. Canonical WBS, historical results/receipts, runtime authorization, human quorum, privileged-route denials, Gate 7 and release state are outside its scope.

## Reproduced defects

The original runner counted a child's leading `FAIL` line but selected the suite status using only exit code and protected-evidence changes. An actual child that printed `FAIL synthetic named failure` and exited zero therefore produced `status: PASSED`, `failed: 1`, and a zero runner exit. The integration test launches the real runner source against a fresh minimal synthetic checkout with actual child processes; it does not simulate the runner or expose a production test mode.

The original pass counter also rejected every successful label containing the word `skip`, while the skip counter accepted an embedded `[SKIP]` anywhere in a line. Three successful labels (`PASS rejects skip option`, `✓ skipped alias is rejected`, and `[PASS] literal [SKIP] label remains a pass`) were counted as zero passes. Separate leading `SKIP` and `[SKIP]` results must remain skips.

A further failing integration case showed that concatenating stdout without a terminating newline and stderr could hide a stderr failure inside a PASS description. The runner now places a newline between the two captured streams. ANSI control characters are removed for classification only; the captured output remains in the new run's log.

## Versioned report and counting contract

New reports in `runtime/rc-regression/results.json` use `schemaVersion: "2.0"` and `countingVersion: "NAMED_CHECK_PREFIXES/2"`. Existing timestamp, counting description, suite/assertion totals and result fields remain. Each result additionally records the process `signal` and explicit `failureReasons`.

- After removing terminal control sequences and leading whitespace, `PASS`, `[PASS]`, `✓` and `✅` count successful named outputs; `FAIL`, `[FAIL]`, `✗` and `❌` count failures; `SKIP` and `[SKIP]` count skips. Word markers retain their existing uppercase and word-boundary semantics.
- Labels after the leading marker do not change its meaning. Embedded prose or embedded `[SKIP]` is not a skip result. `PASS ... skipped ...` remains a pass and `FAIL ... skip ...` remains a failure.
- The existing `✓ All Release Gate verification invariants...` summary exclusion remains explicit and tested, so that banner does not duplicate its individual checks. Other unmarked banner totals are not parsed as checks.
- Any named failure, nonzero/missing exit status, process signal/error/timeout, or protected-evidence change makes the suite FAILED. A failure also makes the overall runner exit nonzero. Process/evidence causes contribute at least one failed check when there are no named failures; multiple causes do not duplicate an already counted named failure. All causes remain visible in `failureReasons`.
- Exit-zero suites without named outputs remain PASSED if there is no process error/signal or evidence drift. Named check counts can legitimately be zero. Existing successful suites that report SKIP results retain the prior suite-level success behavior; this change does not add a coverage-completeness policy.

Counts remain observed output records, not counts of individual `assert` calls or independent security properties. Future totals can increase when formerly suppressed PASS descriptions are included, and embedded `[SKIP]` prose can stop inflating skip counts. Previously false-green suites can now fail CI. Consumers comparing report totals must distinguish this counting version; historical reports and their original qualifications are not rewritten or reclassified.

## Exact file inventory

1. `scripts/runCompleteRegression.ts`: use the shared classifier, preserve stream boundaries and emit the versioned report.
2. `scripts/lib/regressionResult.ts`: pure marker counting and fail-closed process/evidence classification.
3. `scripts/testCompleteRegressionRunner.ts`: actual-runner integration plus bounded subprocess/classifier regression cases.
4. This verification record.
5. `docs/06_planning/FOUR_HOUR_COMPLETION_LEDGER_20261021.md`: complete read-only task inventory, execution queue and operator-review exception.
6. `docs/08_handoff/FAST_TRACK_DEVELOPMENT_HANDOFF.md`: additive actual PR #66 closure and continuation checkpoint.
7. `docs/08_handoff/LOCAL_PRODUCT_DEMO.md`: additive correction that the recovered product journey is now on verified master.

The runner's discovery, Node/tsx invocation, 120,000 ms per-suite timeout, default spawn output/resource limits, cleared provider credential environment and retained-evidence snapshot checks are unchanged. No install, dependency, lockfile, CI configuration or test assertion is weakened. The new test is automatically discovered by the existing `test*.ts` rule.

## Retained verification evidence

Windows focused execution used private portable Node 22.23.3 x64 and the existing task-owned dependency junction read-only. No install or dependency mutation occurred. Each actual-runner case creates a fresh owned temporary root containing only synthetic manifest/evidence files and two small child scripts. Source imports stay in the actual checkout. The fixture-created dependency junction is removed itself before cleanup of the verified temporary root; shared dependencies are never traversed for deletion.

Initial four-check RED before runner changes: **2 passed, 2 failed**, exit 1. The failures were the actual exit-zero named-failure suite incorrectly marked PASSED and three successful skip-containing labels counted as zero. Existing nonzero-exit and protected-evidence negatives passed.

Expanded stream-boundary RED: **11 passed, 1 failed**, exit 1. The actual colored stderr failure after unterminated stdout still produced PASSED. After adding the stream boundary, focused verification was **12 passed, 0 failed**, exit 0. It includes actual runner exit/report/log assertions, zero-count compatibility, retained evidence mutation, actual nonzero/terminated/timed-out/unspawnable children, explicit error/signal precedence and nonduplicated failure counts. The separate timeout fixture uses 500 ms; it does not change the runner's 120-second production budget.

| Retained local artifact | SHA-256 |
| --- | --- |
| `runtime/regression-gate-verification/initial-red.log` | `d0786cfa681d97781a4187f13cae1565b3c38ff7cd47bfb5e53cfdca3d966430` |
| `runtime/regression-gate-verification/stream-boundary-red.log` | `489e0313e08c94942df744177dd9298062d314f38d1df44c968291e069c13a64` |
| `runtime/regression-gate-verification/focused-green.log` | `1fdb95369f9930c693954f38cc792b3806d30f6af1970f75da57c0bb62ec74a9` |

An initial TypeScript check reported two TS2339 errors because Node's `spawnSync.error` type is `Error`, while the tests inspect its actual `code` field. The assertions now narrow to `NodeJS.ErrnoException`; no runtime behavior or expected error changed. The final focused rerun passed **12/12** with exit 0 and the same output digest as the preceding GREEN log; final `tsc --noEmit` passed with exit 0 and no diagnostics. `git diff --check` passed. Later combined/hosted verification must be reported from its actual execution, not inferred from these focused results.

Reproduce the focused result with a supported Node 22 installation:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testCompleteRegressionRunner.ts
node ./node_modules/typescript/bin/tsc --noEmit
```

Full regression, browser/build gates, clean installations, independent review and hosted CI are not claimed by this worker's focused run. They remain coordinated integration checks. This record does not predeclare a future commit, review, CI result or merge.

## Rollback and remaining boundary

This changes test reporting, not product state. A reviewed code revert removes the additive helper/test/report fields; preserve all published RED/GREEN evidence and historical outputs. Returning to the old classifier would restore a known false-green defect, so prefer a bounded forward correction if compatibility trouble is found. No historical receipt, WBS state, credential, root, quorum or operational high-water mark is restored or lowered.

The runner still relies on scripts to emit truthful supported markers or fail their process. An exception swallowed with exit zero and no failure marker is outside this classification fix. Output records are not proof every intended scenario executed; individual suites retain responsibility for scenario-completeness assertions.

## Coordinated full verification on the original b4004c1 baseline

The parent verification run completed with exit0: **76/76 suites, 1,953/1,953 named checks, zero failures/skips**. WBS rendering/integrity, TypeScript, production Vite/server build and controlled documents also passed. Controlled documents report **40/40 core, 29/29 additional, 11/11 focused (332 assertions)** and unchanged disposable snapshot/registered documents. The pre-existing bundle-size warning remains; this is not a deployment or clean-host qualification.

Compared with the historical1,937-check baseline,12 new runner checks and four previously suppressed successful labels explain the total: Bun lifecycle19→20, project persistence16→18, offline envelope87→88. Historical outputs are preserved; this is the new counting contract.

| Current-run artifact | SHA-256 |
| --- | --- |
| `runtime/final-qa-gates/complete.log` | `2a37dc992671e2b00aaf2a8fab20ef8dc17f17e845c92c929a992b8359084c41` |
| `runtime/final-qa-gates/quality.log` | `5878046e2ba2ec0a2a5491626bb2e8f84d2db5fc06e543289189124289e06fc5` |
| `runtime/final-qa-gates/controlled.log` | `1485be8550ac0bff37d8ea6892bab14eee9395629678b9e5f155ba2fbb4bb114` |
| `runtime/final-qa-gates/b400-full/results.json` | `05256c28fc62d0698c16c3868985c20338875f4e37a41af4da7d591af4dc861c` |

This baseline run precedes reconciliation with the PR66 master integration. Combined-tree verification and hosted CI must be recorded separately. The additive four-hour task ledger is a fifth directly related documentation path; it does not mutate canonical WBS or confer operational authority.

### Preserved original failing output

Initial actual-runner RED:

```text
FAIL actual runner exits nonzero when an exit-zero child reports a named failure: exit-zero named failure was PASSED

'PASSED' !== 'FAILED'

FAIL actual runner counts PASS labels mentioning skip and counts only leading skip markers: Expected values to be strictly equal:

0 !== 3

PASS actual runner rejects a nonzero child even when its named checks pass
PASS actual runner rejects changed protected evidence and preserves the failed child log
Regression runner checks: 2 passed, 2 failed
```

Stream-boundary RED:

```text
PASS actual runner exits nonzero when an exit-zero child reports a named failure
FAIL actual runner detects a colored stderr failure after stdout without a newline: Expected values to be strictly equal:

'PASSED' !== 'FAILED'

PASS actual runner counts PASS labels mentioning skip and counts only leading skip markers
PASS actual runner preserves successful suites with zero named check outputs
PASS actual runner rejects a nonzero child even when its named checks pass
PASS actual runner rejects changed protected evidence and preserves the failed child log
PASS all supported leading failure markers reject even when their labels mention skip
PASS a real timeout rejects partial successful output and records its process cause
PASS real process termination cannot be accepted as a successful suite
PASS a real spawn error rejects a suite with no named failure output
PASS process error, signal and evidence drift each override an otherwise zero exit
PASS named failures are not counted again for concurrent process and evidence causes
Regression runner checks: 11 passed, 1 failed
```

## Verified product-master reconciliation

The unpublished candidate branch fast-forwarded normally to verified master21da1d5bebaecf58b5037c255561c8b8315b429d, retaining its uncommitted runner correction. No approved history was rewritten. The subsequent full run passed **80/80 suites and1,988/1,988 named checks**, with zero failures or skips. WBS integrity, TypeScript, production build and explicit controlled-document verification passed. Controlled results are40/40core,29/29additional,11/11focused(332assertions), with the synthetic snapshot and28registered documents unchanged. Existing product journey9, derivation9, creation14 and readiness3 are included. The existing bundle-size warning remains.

| Combined-run artifact | SHA-256 |
| --- | --- |
| `runtime/final-qa-gates/combined-complete.log` | `9ad2600f1657374acc3d2a657384bcaee7c312a0b7d5abc3d7f34f0a07438423` |
| `runtime/final-qa-gates/combined-quality.log` | `9fb1929ed945cd992d46558667d4f67f6fb8cad43748ba70d569d270ab7fd007` |
| `runtime/final-qa-gates/combined-controlled.log` | `56416265ba5a106705296ef1068288345d7a22bb569e6a02072241238f788a93` |
| `runtime/rc-regression/results.json` | `92ad3d9f861a9f579ccf61eaa6a8d61fd014cbf009cceae061799b05e0ea1cd3` |

These results qualify the actual source before signed publication; four fresh hosted jobs and any subsequent post-merge run remain separate evidence. The operator has explicitly waived ordinary independent human review; the waiver and initially rejected/then successful PR66 chronology are preserved in the task ledger and handoff. No actual reviewer approval is claimed for this candidate. The total scoped inventory is seven paths: three runner code/test paths and four directly related verification/planning/handoff documents. Canonical WBS, historical evidence, operational authority and dependencies remain unchanged.
