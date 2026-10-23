# Task 1 operator acceptance checklist — 2026-10-23

Prepared against runtime `62d66779b9d7236e093eb2fd8e47355c8d42b798`. **Human acceptance: NOT_RUN. Current start gate: BLOCKED.** This document grants no real enrollment, credential change, import, membership or certificate authority.

Use the [current reconciliation](CURRENT_STATUS_RECONCILIATION_20261023.md), [qualified final setup guide](https://github.com/Jeruzael/docmonstakrakin/blob/ade88004341f59503a4ccad833d2aba9f6a76647/docs/08_handoff/OPERATIONAL_WORKSPACE_GUIDE_20261022.md) and [private SDK installation recipe](../07_verification/OPERATOR_WINDOWS_QUALIFICATION_20261022.md). A past qualified environment is not the present operator installation.

## Record before execution

Record exact source/tree, Node/npm/native versions and provenance, OS/architecture/browser, selected new regular checkout/workspace, read-only original backup/hash references, start/end times, operator and consent scope. Store only nonsecret metadata in Git. Never record passwords, cookies/CSRF, password verifiers, full private database, personal identity documents or screenshots exposing them. PASS requires observed expected behavior; FAIL preserves the actual error; BLOCKED records an unmet prerequisite; NOT_RUN means the human did not execute it. Existing agent/CI results cannot fill these rows.

## Start gates

- [ ] Fresh regular checkout, own .git and regular node_modules; no dependency junction, original worktree modification or live application restart.
- [ ] Qualified Node22.23.3/x64 and supported SDK/compiler/Python prerequisites; normal lifecycle-enabled npm ci, actual native loads/provenance, audit and build succeed on exact source. Never skip hooks or substitute retained binaries.
- [ ] Current-user private ownership/ACLs are qualified in actual Node descendants. An Administrators-owned authority or a CI-only token launcher is not an operator setup workaround.
- [ ] Trusted single-user local host/browser with BroadcastChannel and no untrusted loopback services. HTTP cookies are not port-isolated; explicit loopback TLS/custody needs its own authorization. Shared/remote/hostile-host use is BLOCKED.
- [ ] Explicit operator authorization for named real identity initialization, role scope, any import and project memberships. Do not appoint SO/LA or manufacture independent people. No default credentials.
- [ ] Fresh disposable pilot data, exclusive stopped/live-owner procedure and a reviewed finite event/headroom budget. Count AUTHORITY_OPENED on every store/status/CLI/server open. No live status polling, bulk/unattended writes or near/full history. Unknown capacity or sole-copy valuable data is BLOCKED.
- [ ] Independently preserve original data; choose no import, a synthetic input or an explicitly approved private copy. Do not copy original private data automatically.

Actual gate results this pass: clone/runtime isolation PASS; npm ci FAIL (missing SDK), native/owner/headroom qualification BLOCKED, real enrollment authorization absent/BLOCKED. All human steps below remain NOT_RUN.

Fresh publication CI on f578091 also failed Windows store WS04 with WORKSPACE_PERMISSIONS_INVALID (17/18 cases passed). Reproducible Windows admission remains BLOCKED pending separate diagnosis; the earlier green master run does not resolve this new observation. See the current reconciliation for preserved evidence.

## Human execution and expected results

| Step | Operator action and observable acceptance | Actual |
| --- | --- | --- |
| 1 Setup-only start | After gates pass, build and start only the new checkout in default ENFORCED mode. Setup/sign-in is shown; anonymous project data is unavailable; no default account appears. Record exact source/config without secrets. | NOT_RUN |
| 2 Owner initialization | With explicit authorization and server stopped, use the documented offline init command with the real chosen account/person and hidden terminal/private stdin. No password in arguments/env/chat. Ordinary author gets no human-reviewer role by implication. | NOT_RUN |
| 3 Import decision | Explicitly choose empty/synthetic/approved-copy input. If --import-state is authorized, only the fixed new-workspace .local/project-state.json is read; original source bytes remain unchanged. Imported projects receive no automatic ownership/grants. | NOT_RUN |
| 4 Membership decision | Use only explicitly approved OWNER/EDITOR/READER/DENY assignments on selected ordinary projects. Self project remains read/export-only. Confirm visible project list agrees with actual grants and no denied IDs leak. | NOT_RUN |
| 5 Document workflow | Create an ordinary acceptance project/document, edit/validate/save, observe version and persistence. Exercise stale-version/conflict handling; a failed/uncertain save preserves draft and is not silently retried. | NOT_RUN |
| 6 Task/compiler workflow | Create/link an ordinary task and criteria; compile a no-provider-key package with schema1.1, actual editable targets and string-array criteria. Validate a synthetic returned proposal; validation creates no canonical artifact/approval. Human disposition creates PROPOSED work under existing gates. | NOT_RUN |
| 7 Verification/readiness | Use an ordinary local evidence session bound to the task/revision. Observe no fabricated human approval, authenticated producer or release PASS from a hash/status/CI alone. Gate7 remains blocked. | NOT_RUN |
| 8 Restart persistence | Cleanly stop and restart within reviewed headroom. Documents/task state persist; generation fences old sessions; sign in again. Original JSON remains unchanged. Uncertain stop/retained lock is BLOCKED for explicit stopped-owner recovery, never stolen. | NOT_RUN |
| 9 Session behavior | Observe successful logout acknowledgement and cleared cookie/private UI; old requests cannot repopulate state. Check expiry and cross-tab/principal invalidation with consented test identities only. A logout error is FAIL, not proof of revocation. | NOT_RUN |
| 10 Access denials | Confirm anonymous, wrong-project, missing CSRF, stale session and revoked/denied membership cases fail before writes. Additional identities or policy changes require explicit consent first; otherwise that case is BLOCKED. All14 privileged operations and agents remain denied. | NOT_RUN |
| 11 Capacity/backup closeout | Record nonsecret event counts/headroom through the agreed supported observation procedure; offline status itself opens/audits and cannot run beside a live owner. Stop well before full; preserve evidence. Do not fill a real authority, prune, reset or activate a copied backup to complete acceptance. | NOT_RUN |

Expected command shapes are already in the pinned guide; their placeholders are deliberately not executable identity appointments. Do not run CI fixture initialization against the operator checkout. Credential reset/disable, additional test identities, private import, TLS trust installation and recovery activation are outside this pass.

## Closeout and remaining BLOCKED conditions

Record each observed result/evidence reference, source/configuration, operator, timestamp and failure separately. A checklist tick or agent test is not human acceptance. Unknown SDK/native/ownership/browser qualification, absent consent, unreviewed event headroom, full history, unsupported recovery or unsafe host/transport remains BLOCKED. Complete the finite pilot only after its start gates actually pass. Production capacity, operational trust/signers, canonical WBS/receipts, privileged operations, live agents, Gate7 and release remain separate restrictions even if all ordinary acceptance rows later pass.
