# Accelerated completion campaign — ACCEL-20261024

Authority: the operator's 2026-10-24 conversation message explicitly executing `DOCMONSTAKRAKIN_Accelerated_Completion_Mandate_20261024.md`, SHA-256 `4516f768b1469dfaf3f0341135a552218dcac8eb758e1c140a5b4317dc692455`. No machine-readable message ID is available. Routine review metadata: **HUMAN_REVIEW_WAIVED_BY_OPERATOR**. This is not a canonical lifecycle status or independent approval.

Goal: qualified local/self-hosted engineering release candidate. Production release and human-observed acceptance remain distinct. Architecture: extend the existing TypeScript application, private SQLite authority and policy/CAS services. Preserve the approved [34-owner inventory](EXTERNAL_AGENT_FIRST_TASK_CANDIDATES_20261023.yaml), all 138 criteria and separate CAPACITY-FOLLOWUP-01. The scheduling numbers below allocate no permanent DMK IDs. Original VERIFIED closures remain bounded to their original evidence.

## Execution and acceptance map

Every listed owner's positive and negative criteria remain obligations, not implicit passes. Cross-package support does not duplicate the lead owner. Exact criteria remain in the linked immutable inventory; a verbatim criterion-to-package mapping has been prepared on the separate authority-preparation branch and awaits integration. A package's status separates engineering, integration, registration, human acceptance and release. IN_PROGRESS/QUEUED/BLOCKED are campaign metadata only.

| # | Package | Existing lead/support owners | Dependencies | Current engineering state / remaining exit |
|---|---|---|---|---|
| 1 | PR87 closure | DMK-199 | — | QUALIFIED: actual master556bed6 CI40063320425, four jobs,140 suites/2774 checks; no implementation redo |
| 2 | PR85 integration | DMK-199/205 | 1 | MERGED ef6b30bf; actual CI40067046174 three PASS/Windows FAIL; bounded capacity-test timeout diagnosis pending; 13 approved file blobs preserved |
| 3 | Fresh setup | DMK-198/199/214 | 1 | Local task-owned22.23.4 npm/Bun each122 checks/audits/WBS/typecheck/build PASS; PR92 candidate/postmerge qualification pending; original installation untouched |
| 4 | WS04 diagnosis | DMK-199/214 | 3 | Local and hosted40071426037 profiles NOT_REPRODUCED; controls/two4-case prefixes completed; historical operation/stage/cause UNKNOWN. No speculative runtime fix |
| 5 | Non-mutating inspector | DMK-120 extension | 3 | IN_PROGRESS immutable-profile admission/image validation; ordinary writable sources must reject |
| 6 | Audit continuity | DMK-120 extension,214 | 5 | QUEUED explicit lineage/custody/CAS design and crash/replay tests; real currentness authority remains a gate |
| 7 | Agent-executed acceptance | DMK-198/199/214 | 3, relevant implemented flows | QUEUED actual synthetic application walkthrough; human observation NOT_RUN |
| 8 | Governed registration | DMK-205,209–214 proposals | exact registration210→211→212→209 | IN_PROGRESS candidate preparation; actual signer/acquisition/apply authority must be proved |
| 9 | Runtime tracking | DMK-205/201 | 8 or separate ordinary project | QUEUED; no manual canonical/live-board mutation |
| 10 | Authority/access residuals | DMK-210/211/212/209 | 2 | Existing human sessions/policy credited; first-create scope correction targeted6/6; external sponsor/disclosure candidate in progress |
| 11 | Durable agents/delegation | DMK-167/169/213 | 10 | IN_PROGRESS separate new-onlyschema3 task-read core/management receipts; no agent identity or live grant activated in current master |
| 12 | Common action/direct client | EXT-CAND-01 | 10,11 | IN_PROGRESS first durable acknowledgment boundary; legacy RPC replay semantics retained |
| 13 | Skills/admission | EXT-CAND-03,DMK-171/209 | 12 safe bootstrap | IN_PROGRESS separate0f90912 prompt-registry/retrieval component15 focused checks PASS; HTTP/client integration and full qualification pending |
| 14 | Compiler round trip | DMK-190 | 12,13 | Existing schema1.1/string-array importer credited; contextual skill/policy/revision extension pending |
| 15 | Conversation onboarding | DMK-010/017 | 12–14 | QUEUED residual matching/provenance, no invented business facts |
| 16 | Continuous questionnaire | DMK-020/027/033 | 12,15 | Existing typed renderers credited; lifecycle insertion/freshness/scoped notifications pending |
| 17 | Agent task control | DMK-085 | 11,12 | QUEUED atomic claim/fence/handoff; presence never releases claims implicitly |
| 18 | Evidence/review | DMK-081/170/206 | 12,17 | Existing human evidence sessions credited; external producer/currentness extension pending |
| 19 | Knowledge/progress sync | DMK-201/207 | 12,15–18 | Existing CAS credited; durable result/outbox/conflict recovery pending |
| 20 | GitHub/Git/tracker | EXT-CAND-02,DMK-179/180 | 12,19 | QUEUED scoped bridge; connector account does not establish independent human authority |
| 21 | Presence/Simple/2D | EXT-CAND-07 | 11,12,17 | QUEUED event-driven projection; 15-minute delegated rest default, 3D excluded |
| 22 | Chat/notifications | EXT-CAND-09 | 11,12,19 | QUEUED durable permission-filtered delivery, no false client wake-up |
| 23 | Security/exceptions | DMK-038/041/171 | continuous | IN_PROGRESS preserve denials/audits/failures; cross-transport negative criteria remain |
| 24 | Final qualification/RC | DMK-202/199/214 | all applicable | NOT_RUN; candidate configuration/checksums/recovery and release disposition pending |

## Fixed worker contracts

Integration owner: root agent only. `accel_setup_ws04` owns setup/diagnostic helpers and its package3/4 plan/evidence, plus separately recorded new synthetic-capacity timeout diagnosis. `accel_capacity_inspector` owns new inspector/CLI/tests and its package5 plan/evidence; no core authority edits. `accel_authority_map` preserved the non-applying package8 candidate/criterion assessment, then received exclusive delegation of the receipt `contracts.ts/store.ts/worker.cjs` and native test on a separate branch. Root owns HTTP/CLI/qualification integration and these four campaign records. Shared schema/authority edits remain serialized. Independent work continues during hosted CI; no dependent merge precedes four successful actual-master jobs. Worker commits are agent-authored, not human approvals.

## First shared-contract slice: bounded durable action acknowledgment

Approaches considered: (1) replace legacy commit behavior globally; rejected because historical callers require replay rejection. (2) add arbitrary fields to legacy audit events; rejected because old exact audit validators would then reject those stores on restart. (3) explicit versioned opt-in receipt schema/command with atomic recording and current authorization; selected for detailed design after source/compatibility review. No schema is changed by this plan. Migration must be explicit, reversible before activation, tested on new/disposable workspaces, and never automatically applied to valuable original state.

Files to inspect/then change only after the concrete schema contract is recorded: `server/security/workspaceAccess/{contracts.ts,worker.cjs,store.ts,projectPersistence.ts}`, a focused receipt regression and existing store/persistence regressions. Consumes current session, policy revision, project action, operation UUID and exact body digest; produces bounded committed revision acknowledgment, never unauthenticated response content. Required negatives: changed body, actor/project/action mismatch, revoked grant/session, stale/unapplied intent, legacy tombstone without binding, corrupt receipt, uncertain commit and concurrent duplicate. Preserve ordinary/self-project policy,14 privileged denials, original timeouts and all existing legacy assertions.

## Global constraints and review focus

- No original operator checkout/data/junction mutation; no secret material in Git/evidence.
- No unsigned or bypassed merges, skipped meaningful checks, raised audit thresholds, arbitrary readiness sleeps or retry-until-green.
- No fabricated second human, cryptographic authority, review, client capability or human acceptance.
- Full history, used-session/operation replay fences and source-specific ACLs survive any schema evolution.
- Unavailable external custody/MFA/consent blocks that operation only; continue independent engineering.
- Review lost-ack recovery without duplicate effects; revoked disclosure; source/metadata races; full capacity; cold startup and native ownership on both platforms.

Plans are executed under the standing mandate without another routine planning gate. Every package records exact file scope before its own implementation. This map does not declare the remaining packages implemented.

Current reviewable slices: PR88 immutable Linux capacity inspector; PR89 criterion-preservation/non-applying registration subset; root receipt/first-create candidate (publication pending). The [receipt file plan](ACCEL_ACTION_RECEIPTS_20261024.md) and [first-create diagnosis](../07_verification/ACCEL_EMPTY_WORKSPACE_CREATION_20261024.md) define exact runtime/test changes. These slices do not mark their entire scheduling packages complete. Current prototype has no external live-agent client, no schema2 backup/inspector support and no valuable-state migration.
