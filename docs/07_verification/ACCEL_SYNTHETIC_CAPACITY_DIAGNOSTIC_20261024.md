# ACCEL-20261024 — bounded capacity failure diagnostics

## File plan recorded before implementation

Executor: Codex delegated setup/diagnostic worker. Authority: operator ACCEL-20261024 mandate and root's explicit assignment after actual master CI failed. `OPERATOR_DELEGATED_DECISION`; `HUMAN_REVIEW_WAIVED_BY_OPERATOR`; `AGENT_EXECUTED_ACCEPTANCE`. Root is sole integration owner. Base `ef6b30bf1392a9c9ead69a3a73f9655c7d18317d`; branch `codex/accel-capacity-diagnostics-20261024` in an isolated managed worktree.

Change only `scripts/testSyntheticSessionCapacity.ts` and this evidence record plus reviewed secret-free evidence. Add bounded per-fixture parent observation for current case, phase, operation ordinal/name and elapsed time when a request or lifecycle operation times out/becomes unavailable. Label audit-fill counts and boundary verification stages. Preserve every original assertion, store operation, input, capacity ceiling, timeout, success/failure counting and cleanup action. No retries, fabricated ledger rows, payload/token logging, production code, dependency or workflow change. Then typecheck, run the complete 18-case suite with qualified Node22.23.4 and genuine native dependencies, review the diff, sign and publish a separate diagnostic candidate. This improves future evidence; it is not a proven fix for the old timeout.

## Original failure and bounded comparison

[Actual master run40067046174](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40067046174), Windows job120792387120, failed fresh-Bun synthetic capacity at "one remaining audit slot and the full 4096-entry ceiling both roll back reclamation": `STORE_REQUEST_TIMEOUT`,17 passed/1 failed,66,432ms. Other three campaign jobs passed. The3,000ms timer rejected an uncertain operation and stopped its worker. The particular command and cause are UNKNOWN. Root retained the complete original log, SHA-256 `4aa2fa11027575759d2f84d2f7aff330a10c4e7ab61a24613ac9cb5329307326`. No unchanged retry was requested.

The setup lane ran exactly three predefined full source-derived diagnostic profiles, with fresh regular dependency directories and no runtime changes:

| Profile | Cases / elapsed | Disposition |
| --- | --- | --- |
| Node22.23.3 / frozen Bun1.4.2 | 18/18 /88,868ms | NOT_REPRODUCED |
| Node22.23.4 / npm11.7.0 | 18/18 /77,697ms | NOT_REPRODUCED |
| Node22.23.4 / frozen Bun1.4.2 | 18/18 /73,414ms | NOT_REPRODUCED |

The historical comparison uses source556bed6; current comparisons use diagnostic sourcec2c8501. Relevant test/runtime bytes equal masteref6b30. The manual observer copied the complete original test into a temporary adjacent file and wrapped parent requests; hashes and timing perturbation are retained. These local passes do not establish why hosted CI timed out. The separate WS04 `WORKSPACE_PERMISSIONS_INVALID` investigation has a different failure and remains separately UNKNOWN/NOT_REPRODUCED.

## Candidate verification

The candidate run began 2026-10-24T06:23:15Z and finished 06:24:29Z in the isolated capacity worktree. Actual checkout HEAD was `ef6b30bf1392a9c9ead69a3a73f9655c7d18317d` with only the test change and evidence additions. The Git tree containing that base plus the tested script is `4794f6ad5074e00140c49d52d413552aa159b8ae`; script blob `9767429edbdecd7fa08c7f15a12199589e917141`, SHA-256 `a192545426d3b8e71f3ed9adcd69d2216f7b58c3b48d6c3437a52042530f778c`. Evidence-only additions after execution do not change the tested script/runtime bytes.

- Qualified official Node22.23.4 (`dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f`), Windows x64, genuine better-sqlite3/argon2 native dependencies copied from the task-owned fresh lifecycle-enabled npm checkout. Regular directories throughout; the original operator junction is untouched.
- `node --import tsx scripts/testSyntheticSessionCapacity.ts`: **18 passed, 0 failed**, 73,443ms, exit0. Windows heavy work was reserved to this lane during the run. [Result](accel-capacity-diagnostic-20261024/candidate/candidate-result.json); [stdout](accel-capacity-diagnostic-20261024/candidate/candidate.stdout.log), SHA-256 `d069ff0407f7b57192d7b5ae6fe65461fad22ac04b8758ad9c442faf602d6328`; stderr empty.
- `node node_modules/typescript/bin/tsc --noEmit`: PASS, exit0. [Log](accel-capacity-diagnostic-20261024/candidate/typecheck.log).
- Source-extracted observer controls: **2/2 PASS**, preserving returned value and original error identity, checking fixed output keys, previous successful operation, and exclusion of private sentinel payload/message. [Control source](accel-capacity-diagnostic-20261024/candidate/diagnostic-controls.ts); [result](accel-capacity-diagnostic-20261024/candidate/diagnostic-controls.log). These controls test observation only; they do not reproduce the hosted timeout.
- Root agent adversarial review: bounded single last-completed record, no payload copies, unchanged assertions/timeouts, original error rethrow and all lifecycle wrappers checked. Review is agent review under `HUMAN_REVIEW_WAIVED_BY_OPERATOR`, not independent human approval. `git diff --check` passed. Secret-pattern scan of the curated evidence returned no matches.

The [evidence manifest](accel-capacity-diagnostic-20261024/$181ac3231a5ed07beb554b301fed719ef8314f6c9ae137b783b032e18d68c4794`, binds the three predefined comparison outcomes, original manual observer source, candidate source snapshot, controls and run logs. The original hosted failure remains preserved by the root integration owner. Historical failure disposition remains **NOT_REPRODUCED; cause UNKNOWN**. The diagnostic candidate is ready for signed PR publication and fresh actual candidate CI; candidate/post-merge CI is not yet credited here. Root owns integration. No human acceptance, canonical task transition, authority application or release approval follows from this candidate.
