# Fresh-workspace creation correction — ACCEL-20261024

Owner: DMK-198/199 acceptance residual and package10 scope enforcement. Authority: operator's accelerated mandate, OPERATOR_DELEGATED_DECISION; HUMAN_REVIEW_WAIVED_BY_OPERATOR. This extends the recorded qualification without rewriting PR80/81 evidence.

## Observed failure and supported cause

Actual application fixture on signed combined commit `1c5566ef00eea2bbe2193e84d91126fe58bdbfdf` passed fresh schema2 CLI initialization and authenticated discovery, then failed first project creation:2 passing checks/1 failure, HTTP503 `WORKSPACE_COMMIT_REJECTED`. The projection remained fenced. No retry was used as qualification.

Source inspection identified the unchanged master `validateScope` predicate rejecting a difference in optional collection presence even when both maps are empty. A null bootstrap snapshot normalizes to `{projects:[]}`; the real `ProjectStore` serializer includes empty `importSessions` and `verificationArchives` maps. A new controlled native fixture reproduced `WORKSPACE_SCOPE_INVALID` for both legacy schema1 and receipt schema2 (0/2). Both executions used the combined candidate; the corresponding predicate was byte-identical to master. This is not a claim that a separate pristine-master application run was executed.

## Minimal correction and boundaries

During creation of the first project only (`creation && old.size===0`), admit absent-before/present-after optional maps when both contain no entries. Retain every other predicate: exactly one new ordinary project, no removed project, no foreign collection key, no protected self-project, no changes to another project, no later unrelated empty-map addition, exact current session/policy/revision and atomic snapshot/audit/ownership commit. Removing an existing empty map is not exempted. No dependency, permission acquisition, timeout, retention, canonical WBS or operator data change.

`scripts/testWorkspaceEmptyCreation.ts` now checks both schemas with multiple-project, foreign-key and self-project denials preserving snapshot/info/audit, first-create success, and later unrelated-map/foreign-project-change rejection. Final targeted result6/6. Intermediate narrower positive run4/4 is retained as development evidence, not final candidate qualification.

Actual source application then passed8/8 with native credentials and SQLite: fresh schema2, scoped discovery, one project despite duplicate delivery, CSRF/changed-intent denial, one managed document despite retry, historical acknowledgment after later work, restart/session fencing, and current-permission denial for old receipts. That run preceded the final directional tightening; full CI must qualify the final committed tree. Tests used Node22.23.4 and regular retained dependencies copied from the task-owned fresh npm installation. They do not independently qualify a fresh install here. All data and credentials were disposable synthetic fixtures; AGENT_EXECUTED_ACCEPTANCE, human observation NOT_RUN.

## Compatibility and remaining qualification

Legacy schema1 keeps replay rejection. Schema2 remains explicit new-workspace experimental opt-in; no existing authority is migrated. Package-import protocol1 is deliberately unsupported because its authorization action changes after creation; legacy import remains unchanged. Backup/restore and inspector schema2 support remain unqualified/unsupported and fail closed. This slice does not establish durable agent identity, an external live client, continuity recovery or complete package12 delivery.

All four candidate and actual post-merge jobs remain required. The separate post-#85 Windows Bun synthetic-session-capacity timeout remains unexplained and preserved; this correction does not diagnose or fix it. No independent human approval, operator acceptance, canonical registration, runtime-board sync or production release is asserted.
