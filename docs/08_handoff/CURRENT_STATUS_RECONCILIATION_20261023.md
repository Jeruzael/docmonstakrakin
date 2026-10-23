# Current runtime, evidence and operator-acceptance reconciliation — 2026-10-23

Status: bounded documentation/planning candidate. canonicalApply: false; runtimeApply: false; mayApply: false. This record does not change canonical lifecycle statuses, grant authority or execute the earlier external-agent-first campaign.

## Verified baseline and source hierarchy

GitHub was refreshed on 2026-10-23 during this pass. Default branch `master` and the original checkout both resolve to `62d66779b9d7236e093eb2fd8e47355c8d42b798`, PR #81. The runtime tree is `8f8f34429555173bb595c1f2fdbe48a3c1fa9a87`; ordered parents are PR #80 master `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732` and signed candidate `9e2d5aac52feb6371aca1abee5e4b0374337b32f`. GitHub reports the runtime signature valid. PRs #80 and #81 are closed/merged; neither is work to redo.

Actual [master CI 39911133606](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39911133606) is a completed successful push run on that exact runtime commit. Its four jobs were independently refreshed: Quality & Build 120274162486, Complete Regression 120274162741, Controlled Docs 120274162775, Windows Native Qualification 120274162720, all successful. These historical results qualify their recorded revision; this pass does not claim a new full regression or human acceptance. Recorded Linux regression is 139 suites / 2,765 reported checks; local Windows was 139 / 2,766, with the Windows-only PD07 accounting for the difference.

Final evidence commit `ade88004341f59503a4ccad833d2aba9f6a76647`, tree `297bbb1b5f1e965215549aac10724e9ce11bd903`, has runtime master as its sole parent and a valid GitHub signature. The live `codex/operational-qualification-evidence-20261023` ref still points there. Its documentation-only delta is separate from the runtime, has not been merged into master, and must not be imported wholesale merely to fix an entry point.

Use these immutable final records:
- [Final closure and preserved failures](https://github.com/Jeruzael/docmonstakrakin/blob/ade88004341f59503a4ccad833d2aba9f6a76647/docs/07_verification/OPERATIONAL_SECURITY_COMPLETION_20261022.md).
- [Final setup/recovery guide](https://github.com/Jeruzael/docmonstakrakin/blob/ade88004341f59503a4ccad833d2aba9f6a76647/docs/08_handoff/OPERATIONAL_WORKSPACE_GUIDE_20261022.md).
- [Thirteen engineering rulings and their costs](https://github.com/Jeruzael/docmonstakrakin/blob/ade88004341f59503a4ccad833d2aba9f6a76647/docs/superpowers/plans/2026-10-22-operational-security-decisions.md).
- [Final handoff](https://github.com/Jeruzael/docmonstakrakin/blob/ade88004341f59503a4ccad833d2aba9f6a76647/docs/08_handoff/FAST_TRACK_DEVELOPMENT_HANDOFF.md).

The earlier brief used PR #80 and its separate `18981cdf666f0352ac93f0648d57605d87e7bcb2` documentation capture. Preserve that historical reference; use PR #81 and the final evidence above for current reconciliation. A documentation commit, runtime merge, operator acceptance and production authorization are four different records. GitHub account attribution and an agent review are not independent human appointment/approval evidence.

## Existing implementation credited

PR #80 delivered ordinary managed documents, local verification sessions, reviewer diagnostics, user-journey corrections and scoped projections. PR #81 added default ENFORCED workspace sessions, private SQLite authority, bounded Argon2id, CSRF/session fencing, project ACLs, atomic scoped snapshot writes, Unicode password input, deterministic inbox races, transactional listing, bounded transport, backup preparation and scope-bound release/CI reporting. Source, existing tests and final closure were inspected; BACKLOG/proposed canonical labels do not erase these delivered mechanisms.

Relevant implementation/evidence includes `server/security/workspaceAccess/{worker.cjs,service.ts,http.ts,projectPolicy.cjs,backup.ts}`, `src/data/{contextPackageCompiler.ts,releaseReportProjection.ts}`, `server/proposals/review.ts`, `scripts/{testWorkspaceStore.ts,testWorkspaceApplication.ts,testDmk197ApprovalInboxUi.ts,testProposalContract.ts}`, and the immutable final records. The compiler already emits schema 1.1, editable-target manifests and string-array acceptance criteria. Returned proposals still require validation and the applicable human disposition; model-provider keys are unnecessary for ordinary manual/compiler use.

These facts do not complete production acquisition, real independent humans, agent delegation, cross-transport authorization, canonical registration or human browser acceptance. No live agent protocol, skill attestation, durable cross-system outbox or external-agent workplace is claimed from the existing local workflow.

## Audit-capacity finding and non-applying follow-up

Finding key `CAPACITY-FOLLOWUP-01`; proposed functional owner **DMK-120**, the existing audit-ledger scope (VERIFIED for its original EV-159 criteria only), coordinated with proposed DMK-214 migration/qualification and existing DMK-198/199 operator acceptance. A linked extension is required; the historical verified scope is not broadened or relabelled. Named accountable human assignee: **PENDING**. This is an unregistered planning candidate, not a canonical or runtime task.

| Path at 4,096 audit entries | Current behavior, confirmed from source |
| --- | --- |
| Audit append / ordinary mutations | `event()` and `transaction()` reject with WORKSPACE_CAPACITY_EXCEEDED; transaction rollback preserves data/history. |
| Normal project reads, session lookup, list/authorization | Current-session authorization uses `transaction()`, which checks the audit ceiling even when no event is appended; normal authenticated access fails closed. Public aggregate health/setup is separate. |
| Login / rotation / logout | Login admission and issuance, rotation and logout require capacity-checked transactions. Login can return 503 AUTHORITY_UNAVAILABLE; logout can return 403 CSRF_OR_SESSION_INVALID. A failed logout is not acknowledged server-side revocation and does not clear its cookie through the success path. |
| Existing worker diagnostics | Direct worker `info`, `snapshot` and `audit` remain readable on an already-open worker; these are internal diagnostics, not an authorized HTTP read bypass. WS12 explicitly tests this nuance. |
| Reopen / offline CLI status | Startup rejects an already-full audit before generation/write admission. Every successful store open, including offline `status`, appends AUTHORITY_OPENED. Status is not a non-mutating capacity probe and can consume the final free entry. Offline status also cannot compete with a live owner lock. |
| Lock recovery / backup | Explicit stopped-owner lock recovery does not reclaim audit entries. Offline backup can preserve a stopped authority; a prepared restored copy retains old provenance and cannot activate as a new authority. Neither restart, lock recovery nor backup resets capacity or establishes fresh revocation/antirollback authority. |

Source anchors: `worker.cjs` MAX/transaction/event, session/authorize/listProjects, validateStoredAuthority/startup; `service.ts` error handling; `http.ts` login/logout responses; `scripts/workspaceSecurity.ts` status/open; `scripts/testWorkspaceStore.ts` WS12; [backup contract](../07_verification/WORKSPACE_BACKUP_RECOVERY_20261022.md). Independently bounded retained operation IDs and used session digests also have 4,096-entry ceilings; history exhaustion is not just active-session count. Reclaiming revoked sessions does not remove these histories.

Recommended next reviewed slice: specify and implement a genuinely read-only offline capacity/continuity inspector which does not open the authority through WorkspaceStore, increment generation, write WAL/checkpoints, consume records or create an authorization path. It must validate private paths/provenance/schema/audit continuity, report remaining retained budgets with uncertainty and reject a live/uncertain owner. Its exact file scope and tests need separate review before implementation.

Necessary durable remedy is a separately designed, reviewed append-only segment/successor mechanism with independently anchored continuity, complete retained replay/operation history, authorized generation/custody transition and crash-safe compare-and-swap. Decide retention horizon, revocation/clock/antirollback acquisition, concurrent readers/writers, resource bounds and recovery authority before application. Increasing the number, deleting rows, disabling admission, manually editing SQLite or activating a copied backup is not a remedy authorized here.

Verification criteria for that future scope:
1. At 4,094/4,095/4,096 and over-limit malformed inputs, preserve every original row/hash, exact snapshot/provenance and negative admission result until an authorized successor is durably committed.
2. Inspector succeeds without source byte/generation/audit/WAL mutation; rejects aliases, loose ACLs, live/uncertain owners, corruption, stale or untrusted anchors and unsupported schema.
3. Replays and changed-content operation IDs still reject across segment boundaries; old sessions and revoked grants never revive.
4. Prove one atomic result for racing writers/CAS, crash at every cutover/fsync/ack point, disk full and rollback failure; partial results remain visibly uncertain/blocked.
5. Bound full-chain/retained-index CPU and memory on Windows/Linux; preserve all source signatures, human quorum and mayApply:false for non-applying tools. No acceptance result is supplied by this proposal.

**Bounded acceptance verdict:** a finite, disposable, nonproduction operator pilot can proceed only after clean installation/native/owner qualification, explicit enrollment/import choices, trusted local host/browser, exclusive authority and a reviewed step/event headroom budget are satisfied. Include every store/CLI/status/server open in that budget; do not poll status while live or treat it as free. Preserve the original dataset; avoid bulk/unattended imports and automated write loops. Unknown headroom, near/full authority, sole-copy valuable data, hostile/shared/remote hosts and activated restore are **BLOCKED**. No production capacity/retention policy is ratified. The current prepared environment is **BLOCKED**, as below.

## Actual preparation results

A new ordinary clone with its own .git was created from verified master at `C:/Users/HomePC/dev/docmonstakrakin-operator-prep-20261023-4e6bb8d3`, branch `codex/current-state-operator-prep-20261023`. It began without node_modules, authority or copied operator data. No junction links it to the original installation. Only its own task-local npm configuration/cache/Node-header directory were used.

Normal `npm ci --foreground-scripts` with Node22.23.3 failed (exit 1, 2026-10-23T08:18:22.0540985Z–08:19:13.5392877Z): better-sqlite3 node-gyp found VS2026/v145 but **missing any Windows SDK**. The former private SDK payload paths are absent (markers/probe remnants alone are not SDKs). No global SDK/install, package upgrade, lifecycle skip, retained-binary substitution or original-junction change was attempted. [Original failure bytes](../07_verification/operator-acceptance-preparation-20261023/npm-ci.zip) and [machine-readable preparation record](../07_verification/operator-acceptance-preparation-20261023/preparation.json) are preserved. Partial dependencies are not a qualified installation. Historical configured CI/private-SDK success remains valid for its recorded environment.

| Preparation / acceptance | Actual result |
| --- | --- |
| Live baseline, signatures, recorded four-job master CI | PASS (refreshed records; not new human acceptance) |
| Fresh regular clone, absent initial dependencies/authority, isolated npm paths | PASS |
| Fresh lifecycle-enabled dependency installation | FAIL; resulting local setup qualification BLOCKED |
| Current SDK/native/private-owner/browser/headroom qualification | BLOCKED / not established in this environment |
| Original state/note/junction preservation | PASS, read-only hashes/target compared |
| Real enrollment, credential/import/membership choices | BLOCKED pending explicit authorization; NOT_RUN |
| Human document/task, persistence, session/access-denial acceptance | NOT_RUN |
| Long-running production use / full-capacity recovery activation | BLOCKED |

No server was started, authority initialized, secret requested, original data imported or human acceptance substituted. Use the [operator checklist](OPERATOR_ACCEPTANCE_CHECKLIST_20261023.md); no real enrollment is authorized by this preparation.

## Refresh to the earlier external-agent-first brief

Use the new runtime/evidence pair above, and preserve PR #80 and its separate closure as historical credit. Keep its original 22/6/10 estimate as a historical estimate rather than a target count. The broad product-specification rewrite, exact amendment/registration payloads and runtime task synchronization have **not** been executed in this bounded pass.

Provisional ownership review of Inventory A plus one discovered owner (all canonical statuses unchanged):
| Owner | Original status | Existing behavior/evidence credited; only remaining extension | Planning disposition |
| --- | --- | --- | --- |
| DMK-010 | IMPLEMENTED | Existing Project aggregate, scoped persisted snapshots; add external actor/session/decision/version references. `src/types.ts`, worker/store tests. | ADD_SUBTASK |
| DMK-017 | IMPLEMENTED | Existing creation/onboarding and project switching; add conversational existing-project matching, no duplicate project creation. `server.ts`, Projects UI tests. | ADD_SUBTASK |
| DMK-020 | IMPLEMENTED | Existing Question/validation/branch model; extend the typed controls, late questions, dedup/reopen history. `src/types.ts`, discovery tests. | ADD_SUBTASK |
| DMK-027 | IMPLEMENTED | Existing questionnaire renderer/branch navigation; add the missing controls and affected-work notifications/accessibility. `QuestionnaireView.tsx`, questionnaire UI tests. | ADD_SUBTASK |
| DMK-033 | IMPLEMENTED | Existing lifecycle gates; add scoped late-blocker/impact rules without new incompatible enums. `canonicalLifecycle.ts`, lifecycle tests. | ADD_SUBTASK |
| DMK-038 | IMPLEMENTED | Existing risk-floor calculation; extend security-question/coverage links, no vulnerability-detection guarantee. Risk/discovery tests. | ADD_SUBTASK |
| DMK-041 | IMPLEMENTED | Existing override/risk-acceptance scope; extend attributed expiry/exception invalidation and human authority, never relabel as PASS. | ADD_SUBTASK |
| DMK-081 | IMPLEMENTED | Existing second-agent orchestration; add external/provider-independent review without satisfying human quorum. `AgentCenterView.tsx`, server agent controls. | ADD_SUBTASK |
| DMK-085 | IMPLEMENTED | Existing WorkItem model/mutation guards; add atomic claims, handoff and claim recovery, not task CRUD reimplementation. | ADD_SUBTASK |
| DMK-167 | PROPOSED | Reuse delegation design; specify external sponsor/client scopes, expiry and revocation. No live grant exists. | AMEND_SCOPE |
| DMK-169 | PROPOSED | Reuse handshake design; add external capability/session coordination and bounded recovery. | AMEND_SCOPE |
| DMK-170 | PROPOSED | Reuse asymmetric review design; bind current evidence/producer and independent required approver. | AMEND_SCOPE |
| DMK-171 | PROPOSED | Reuse prompt-injection scope; admit skills/messages/repository context through trust policy. | AMEND_SCOPE |
| DMK-179 | PROPOSED | Retain scoped Git-operation ownership; project command transport belongs to EXT-CAND-02. | AMEND_SCOPE |
| DMK-180 | PROPOSED | Retain tracker projection ownership; share conflict/idempotency contracts rather than duplicate bridge protocols. | AMEND_SCOPE |
| DMK-198 | IN_PROGRESS | PR80/81 diagnostics, offline CLI and sessions exist; actual operator provisioning/acceptance and agent setup distinctions remain. | ADD_SUBTASK |
| DMK-199 | BACKLOG | Credit 139-suite/four-job evidence; add external/direct/mediated/manual tests and human acceptance, not rerun to change status. | ADD_SUBTASK |
| DMK-201 | VERIFICATION_PENDING | Atomic local scoped CAS exists; cross-system receipts/outbox/partial delivery and conflicts remain. | ADD_SUBTASK |
| DMK-202 | BACKLOG | Scoped release evidence/CI observation exists; production provenance/freshness/exceptions/release authority remain gated. | ADD_SUBTASK |
| DMK-205 | VERIFICATION_PENDING | MASTER_WBS.yaml still owns self-project runtime projection; any authority transition needs exact governance/migration decision. | AMEND_SCOPE |
| DMK-206 | BACKLOG | Local evidence sessions, digests and human decisions exist; external producer provenance and freshness extensions remain. | ADD_SUBTASK |
| DMK-207 | BACKLOG | Scoped health/release projections exist; cross-system claimed/observed/stale/sync states remain. | ADD_SUBTASK |
| DMK-190 (additional owner) | VERIFIED | Schema1.1/editable targets/importer already verified; add linked revision/skill/policy round-trip extension, preserving original closure. Absorbs EXT-CAND-05. | ADD_SUBTASK |

This is 23 canonical owner assessments: 16 ADD_SUBTASK and 7 AMEND_SCOPE proposals, not 23 applied amendments. Unchanged foundations (DMK-188/189/195/196/197/203/208 and original Agent Center v0.3 contracts) are referenced, not counted again.

Inventory B remains six **unregistered proposals**, not six new registrations:
| Proposal | PR81 credit and residual scope |
| --- | --- |
| DMK-209 | Central workspace route/policy enforcement exists; external transport action/skill admission and remaining privileged activation are gated. Absorbs EXT-CAND-04 as a linked scope. |
| DMK-210 | Central default-deny identity/policy architecture exists; independently ratified production/external-agent trust and self-project exception remain. |
| DMK-211 | SQLite/Argon2id/revocable sessions/CSRF exist; real consent, enrollment and operator acceptance remain. |
| DMK-212 | OWNER/EDITOR/READER/DENY project policy exists; source-specific discover/notification/delegated-action extensions remain. |
| DMK-213 | Disconnected synthetic foundations exist; no live external agent sponsor/grant/client identity is enrolled. |
| DMK-214 | Extensive synthetic crash/replay/perimeter/native evidence exists; real migration, all-transport/revocation qualification and acceptance remain. |

All six receive provisional AMEND_SCOPE planning disposition; registration and operational activation remain NOT_APPLIED.

Inventory C deduplication:
| Original candidate | Disposition / owner |
| --- | --- |
| EXT-CAND-01 | Retain NEW_CANDIDATE: common external action protocol/capabilities/direct adapters. |
| EXT-CAND-02 | Retain NEW_CANDIDATE: acknowledged GitHub project-command delivery/outbox; reuse DMK-179/180 boundaries. |
| EXT-CAND-03 | Retain NEW_CANDIDATE: trusted versioned skills/prompt registry extending current assets. |
| EXT-CAND-04 | Absorb into proposed DMK-209, coordinated with 210/213 and registry03; no separate admission engine. |
| EXT-CAND-05 | Absorb into DMK-190 linked extension; reuse current compiler/importer. |
| EXT-CAND-06 | Absorb into DMK-201/205 extensions; ordinary-project synchronization and protected self-project authority stay distinct. |
| EXT-CAND-07 | Retain NEW_CANDIDATE: external presence/event projection; identity remains DMK-213. |
| EXT-CAND-08 | Absorb into07 as Simple-first view subtasks and optional 2D; 3D stays DEFER. |
| EXT-CAND-09 | Retain NEW_CANDIDATE: durable permission-filtered chat/mentions/blocker inbox. |
| EXT-CAND-10 | Absorb into DMK-038/041/199/206 extensions; reuse risk, exceptions, tests and evidence. |

Recalculation: initial 22 + 6 + 10 = 38; add DMK-190 owner assessment (+1), absorb five candidate packages (-5): **23 + 6 + 5 = 34 external-agent planning entries**. The separate capacity extension under DMK-120 adds **one**, yielding **35 total review entries in this pass**. No permanent ID is reserved. These are provisional non-applying owner-level entries, not atomic coding task counts or implementation-ready exact payloads.

Reuse the Agent Center's existing AGT/COM/UX/AUTH/DUR/DATA/PROV/RUN/AUD/SEC families. Registry/admission map to AGT-04/AUTH-03/SEC-01; command/outbox to DUR-01/02/03/05; presence/views to UX-01/02/04 and AGT-03; messaging to COM-01–04 and DATA-01–04. Preserve the original v0.3 PRD/manifest and create a reviewed successor/addendum during the later authorized documentation pass. Retrieval does not prove understanding; server policy must enforce operations. Fifteen-minute presence expiry remains a proposal, not a ratified requirement/default.

Revised work tracks for the later brief: non-applying documentation/planning may proceed while human acceptance is BLOCKED. The setup/consent/headroom gates apply to executing the operator pilot, not to reading evidence or preparing planning proposals. The broader documentation campaign remains outside this bounded pass.
1. Review this current-state/capacity/acceptance preparation; obtain a qualified fresh environment and explicit operator enrollment consent separately.
2. Complete actual bounded human task1; retain failures and all production restrictions.
3. Perform the broader single-specification/requirements/architecture/impact-matrix and typed PLANNING_CANDIDATE YAML pass against current master; build exact positive/negative acceptance and dependency graphs for the 34 entries, coordinated with the separate capacity owner. It is still a draft review, not registration.
4. Review authority/identity/delegation/common actions before skill admission/direct adapters; add conversation/questions/claims/evidence/sync, then mediated bridge, presence and messages. Simple precedes optional2D; 3D stays deferred.
5. Only separately authorized exact implementation/registration/activation slices may follow. Preserve DMK-205 authority, historical receipts, human quorum, 14 privileged denials, disabled agents, Gate7 and release restrictions.

## Safe validation performed in this pass

- The existing WBS renderer reported zero YAML/Markdown drift using the separate retained tsx/yaml toolchain. This is document validation, not fresh-install/native qualification.
- Canonical YAML parsed as 69 unique IDs; all 23 external-brief owners plus capacity owner DMK-120 exist, and DMK-209–214 remain unregistered.
- Local document links and pinned Git-object targets were checked; planning uniqueness, 16/7 dispositions, 34+1 counts, criteria string arrays and non-applying flags were validated. The one-entry failure archive preserves the original 6,006 bytes and SHA-256 a9fbd3819a5028dd24a5798fdf5f3daa4d89beee2c49df0318fd4773d3fc1880 without Git line-ending conversion.
- Ten bounded sensitive-data pattern categories found zero matches in the six changed artifacts, including the extracted failure log. No canonical WBS, generated WBS, historical receipt, Agent Center v0.3, runtime, dependency declaration/lockfile or original operator state was changed.
- Full local browser/native regression and operator acceptance were NOT_RUN in this pass. Any hosted publication CI qualifies its exact later documentation candidate only; it does not repair the observed operator installation or supply human acceptance.

## Additive publication failure observation — 2026-10-23T08:53:25Z

Fresh publication CI [39926700203](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39926700203) on signed documentation HEAD f578091b38ffe2b3c3357b6e6d99d528edc39fc4 failed Windows job120324904757. Private-directory7/7 passed, but workspace store reported17 passed/1 failed: WS04 member-author/reviewer/explicit-DENY case raised WORKSPACE_PERMISSIONS_INVALID. Npm installation/native provenance passed before that failure; this is separate from the local missing-SDK installation failure. The later Windows App/TLS/backup and Bun phases were not reached. Quality and Complete Regression had succeeded; Controlled Docs was still in progress at this snapshot. These are per-job facts, not an all-green run.

The relevant worker/private-boundary source, store test, qualification helper and workflow are byte-identical to runtime master62d66779. The log does not identify which WS04 operation or underlying permission acquisition failed; root cause is UNKNOWN. Do not label it transient, environmental, an actual loose ACL, an SDK error or a policy regression without evidence. The earlier successful exact-master run remains a historical observation; it cannot qualify this failed candidate or establish repeatable Windows acceptance.

The [one-entry decoded failure archive](../07_verification/operator-acceptance-preparation-20261023/ci-windows-f578091.zip) has SHA-25614c390d9bf1559fda051d783a11cc79b2de824b2283e01229434070fb3ef7ea6. Its92941-byte decoded log has SHA-256e4c6bf04ba65f2e74a125b72fbcf92857c2f6f20ccefa8f5cd69df46b8bac441; BOM is preserved, CRLF normalized to LF and one terminal LF appended. The original GitHub log remains linked through the exact job/run. This is a decoded representation, not original HTTP archive bytes.

Operator readiness additionally remains BLOCKED on this unresolved Windows admission/qualification result. Recommended separate scope: instrument only a disposable synthetic WS04 reproduction at each authority operation and permission-acquisition stage; retain bounded error/exit/timeout/SID-DACL-pin observations without credentials, then isolate the cause under the exact supported owner profile. Preserve all permission predicates, four-second acquisition deadlines, native versions, quorum and source history. No code/helper/timeout change, automatic retry-to-green, live authority test or remediation is authorized by this documentation pass. A later successful CI run must not erase this failure or claim its cause resolved.

The next documentation commit may trigger its own CI; attribute that separately. This snapshot does not claim results on any later HEAD.

## Publication and application state

README now points to this record and pinned final evidence through a narrow documentation-only branch based on current master. Publish as a review candidate targeting master; the entry-point correction is **PENDING_INTEGRATION** until that PR is actually merged. The evidence branch is untouched. No existing PR is merged as a shortcut. No broad product rewrite, canonical WBS registration or runtime board synchronization is applied. Human task1 remains NOT_RUN; setup is BLOCKED.
