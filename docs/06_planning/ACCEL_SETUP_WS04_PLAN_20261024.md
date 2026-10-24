# ACCEL-20261024 packages 3/4 — file plan

Recorded 2026-10-24 (Asia/Taipei), before changes or setup execution. Executor: Codex setup/WS04 delegated worker. Authority: operator's accelerated-completion mandate, `DOCMONSTAKRAKIN_Accelerated_Completion_Mandate_20261024.md`, and root's explicit isolated-lane assignment. `OPERATOR_DELEGATED_DECISION`; `HUMAN_REVIEW_WAIVED_BY_OPERATOR`; all acceptance here is `AGENT_EXECUTED_ACCEPTANCE`.

Base: `556bed68191a6af27a8fc0aad95363b5a534cd48`. Branch: `codex/accel-setup-ws04-20261024`. Managed worktree: `C:/Users/HomePC/.codex/worktrees/accel-setup-ws04/docmonstakrakin-version-sync`. Root remains the sole integration owner.

## Delivered behavior and remaining gaps

PR83 `e026f5a` supplies SETUP-PLAN-01; its old execution prohibition is superseded for this campaign only. The existing `scripts/qualifyOperatorInstallation.ts` already verifies the pinned Microsoft installer/MSI/CAB chain and prepares task-owned SDK files. PR84 `9fb9448` supplies a bounded WS04 observer and a manual hosted capture proposal. Neither historical retained-package passes nor hosted CI qualify this fresh local installation. Historical WS04 failure `39926700203` remains UNKNOWN; prior local captures remain NOT_REPRODUCED.

Package 3 exits require official signed/digested inputs, fresh regular dependencies with lifecycle scripts enabled, compiler and native loading/ownership checks, audit and build. Package 4 exits require bounded stage/operation observation, environment comparison and a proven fix only if a defect is reproduced. NOT_REPRODUCED/UNKNOWN are evidence dispositions, never FIXED. These extend setup/verification evidence associated with DMK-198/199/206 and the unregistered DMK-214 qualification proposal; they do not alter canonical criteria, ownership, registration or status.

## File ownership and sequence

1. This plan and `docs/07_verification/ACCEL_SETUP_WS04_EVIDENCE_20261024.md`: decisions, exact source/environment/results, residuals and reproducible next steps. A dedicated `accel-setup-ws04-20261024` evidence directory may hold reviewed secret-free summaries/archives.
2. Task-private `.local/accel-20261024/`: SDK plan/extraction, compiler probes, process-only child environment, npm cache/header cache, logs and frozen Bun checkout. Preserve original layout/receipts and original operator checkout/junction/data. Budget: 8 GiB new disk use, 60 minutes initial execution; inspect bounded failures before further attempts. No global install, PATH/config/registry/security changes.
3. Reuse unchanged SDK extraction helper. Check every newly extracted SDK record against the preserved historical receipt. Add a narrowly reusable `scripts/setup/*` helper only if execution exposes a concrete repeatability gap; no package or lockfile edits.
4. Import only reviewed `scripts/diagnostics/diagnoseWs04.mjs`, `ws04Permissions.preload.cjs`, `ws04ObserverControls.cjs`, and `runHostedWs04.ps1` from exact PR84 source. Validate observer controls and run one fixed inherited prefix and one sparse profile on fresh dependencies. No security predicate, timeout, store or authority changes.
5. If needed, add a separate `workflow_dispatch` WS04 workflow from the reviewed PR84 proposal. Coordinate publishing/dispatch with root; existing four required CI jobs are untouched. Do not merge from this lane.

## Validation

Record official primary-source URLs and independently refreshed Authenticode/digests. Run original Windows.h/CRT and MSBuild probes, fresh `npm ci --foreground-scripts`, npm audit and native/package provenance, native/path/store/application/TLS/backup suites, lint/WBS/build. Run pinned Bun 1.4.2 frozen install in a new checkout and fail-closed lifecycle inventory, audit, actual native and Windows admission suites. Preserve install/test failures; no ignored scripts, copied native bindings, weakened checks or retry-to-green. Additional full regression belongs to root's exact combined qualification unless a lane change requires it.

Review: adversarial self-review of setup/observer/evidence, followed by root's independent agent review. Neither is human approval. Human-observed acceptance stays NOT_RUN; production release and protected registration are outside this lane.
