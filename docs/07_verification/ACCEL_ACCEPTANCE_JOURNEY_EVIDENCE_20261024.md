# ACCEL-20261024 package7 — acceptance journey evidence

Executor: Codex delegated acceptance worker. `OPERATOR_DELEGATED_DECISION`; `HUMAN_REVIEW_WAIVED_BY_OPERATOR`; `AGENT_EXECUTED_ACCEPTANCE`. **Human Task1 acceptance remains NOT_RUN.** This extends automated integration evidence; it does not register/complete canonical work or promote a release.

## Scope and source

[Pre-implementation plan](../06_planning/ACCEL_ACCEPTANCE_JOURNEY_PLAN_20261024.md). Base `fec902620145e1526861b20c2c2400d198a1779d`, tree `c51cc3aef2153b1875326680d365e80d429129aa`; branch `codex/accel-acceptance-journey-20261024`. Files: the new `scripts/testWorkspaceAcceptanceJourney.ts`, this record, plan and additive operator checklist section. No shared runtime, schema/policy, CI, package/lock or original data changes.

PR80/81 managed-document, compiler/proposal, local verification, private session/ACL, browser, TLS and backup suites remain credited. Root's separately observed schema2 receipt application8/8 and current fresh-setup qualification are not rerun or presented as new evidence here. This journey uses legacy schema1 fixed synthetic import deliberately; schema2 import remains unsupported. Existing actual browser acceptance tests cover the UI independently; this new connected journey exercises real HTTP routes in the actual source application, not browser interaction.

## Initial checks and native gate

- `node22.23.4 --import tsx scripts/testWorkspaceAcceptanceJourney.ts --contract-controls`: **2/2 PASS**, actual production validator rejects object criteria and externally supplied approval fields. No authority/native acquisition is performed in this mode. This is control-only evidence, not a full-journey PASS.
- `node22.23.4 node_modules/typescript/bin/tsc --noEmit`: PASS on the initial complete test implementation and final precommit source; exit0. `git diff --check`: PASS.
- Initial actual-source journey: **7 PASS / 1 FAIL**, documented below. Final corrected journey remains NOT_RUN at this checkpoint.

No missing product feature red was fabricated: this is a test-only extension over existing services. Rejection controls precede positive flow; the final native run must prove denial/rollback through actual routes. Failures, exact test bytes, source/tree, environment, command envelope and counts will be appended from execution.

## Acceptance mapping and truthful limits

| Checklist step | New connected observation | Preserved boundary |
| --- | --- | --- |
|1–4 setup/import/membership|Fresh setup-required child; explicit fixed synthetic import; no implicit grants; explicit owner/reader memberships; unrelated project and outsider denied|No real enrollment, original data import or SO/LA appointment|
|5 document|Create/read/validate/save; stale hash and state rejected without overwrite|Existing ordinary-author confirmation flag is a synthetic protocol input, not human review|
|6 task/compiler|String criteria, linked PROPOSED task, schema1.1 compiler targets, invalid proposal rollback and valid staging|No provider call; no ACCEPTED review or canonical artifact from proposal validation|
|7 evidence|Ordinary evidence/readiness projections; explicit verification-session GET/POST denial without state mutation|Evidence session **BLOCKED_REVIEW_ROLE_REQUIRED** for ordinary owner; planned digest/producer/attestation draft checks NOT_RUN; no reviewer fabricated|
|8–10 persistence/access/session|Controlled stopped-owner recovery, reauthentication, document/task/proposal/evidence projection persistence, old session denial and acknowledged logout|No live lock theft, original-data cutover or fake reviewer|
|11 bounded closeout|At most120 HTTP requests,12 authority-open attempts, one offline count check with audit below512|No capacity fill, history deletion, backup activation or production capacity claim|

Current setup uses the separately verified task-owned Node22.23.4 and regular genuine native dependencies. Their installation evidence is in package3/4; this journey will report its own actual source/config rather than transfer old runtime acceptance. Core/receipt checks, actual four-job candidate CI, post-merge qualification, human observation and production authorization remain distinct fields. Parent root remains sole integrator.

## Preserved initial failure and bounded correction

Signed implementation `aa1f55528fb8e7c4aa105ce4f2fde5c5569347ab` was normally merged with root's requested portable AR10 loader repair `4ba894046d51628a3eec1c8e336b72e42a93d3ff`. Actual run source `7a87ff6406db9601fab37ded3efef138bcaa68db`, tree `c1c95ff08353ffe559a2a5b67c97ad6ba9522f5f`, test SHA256 `8d1e289aa995fdce690144fbd2fd09e38a5f3bb50a68929ec3bded744f4377a4`; Node22.23.4 Windows x64. The continuity worker released the exclusive host window before this command; no install/build/capacity stress ran concurrently in this lane.

Command: qualified Node `--import tsx scripts/testWorkspaceAcceptanceJourney.ts`. Start `2026-10-24T07:06:57.1340937Z`; end `2026-10-24T07:07:35.7689218Z`; exit1. AJ01–07 PASS; AJ08 failed at GET verification-sessions: expected200, actual403, request40, authority-open attempt8. AJ09/10 NOT_RUN. Fixture cleanup confirmed; no remaining child was reported. Local immutable receipt folder `.local/accel-acceptance-20261024/native-7a87ff6` retains stdout, stderr and result metadata.

The actual error is an incorrect test assumption, not a timeout: `server/security/workspaceAccess/identity.ts` deliberately requires a configured SO/LA role even for a verification submitter. Ordinary OWNER membership grants no such role. The corrected test retains ordinary scope, expects GET/POST403 and unchanged state, and checks the permitted evidence/readiness projection. The desired evidence-session portion remains **BLOCKED_REVIEW_ROLE_REQUIRED**. It does not test reference digest/producer-claim/attestation handling; those existing verification suites remain separately credited. No policy, runtime or native timeout changed, and no unchanged rerun was made.

Sanitized failing observation:

```json
{"stage":"AJ08 evidence remains a bound unverified draft without human attestation or review","code":"ERR_ASSERTION","lastResponse":{"method":"GET","status":403,"sequence":40},"requests":40,"openAttempts":8,"expected":200,"actual":403}
```
