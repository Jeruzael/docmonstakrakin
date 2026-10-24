# ACCEL-20261024 sponsored agent task-read contract

## Agreed first slice (supersedes the historical draft below)

The root integrator agreed this technical contract on 2026-10-24. Implementation base: `fec902620145e1526861b20c2c2400d198a1779d`; branch `codex/accel-agent-authority-core-20261024`. **Development-only capability; no live grants or client activation until trusted skills/admission package 13 and actual-client qualification.** No canonical/runtime task registration, valuable-data migration or human enrollment is authorized by this record.

The slice supports only `task:read`. It adds no task writes, lifecycle engine, agent operation receipt, new receipt version or worker-only snapshot mutation. Future writes must reuse existing lifecycle functions through the common host projection coordinator. HUMAN principal, reviewer and login adapters remain unchanged. This is bounded progress on packages 10/11, not full completion of their criteria.

Exact owned files, fixed before implementation:

| Core lane file | Change |
| --- | --- |
| `server/security/workspaceAccess/contracts.ts` | Discriminated agent actor/records/scope/read result and strict RPC union. |
| `server/security/workspaceAccess/store.ts` | Strict schema 3 new-only initialization option. |
| `server/security/workspaceAccess/worker.cjs` | Separate agent records, exact schema admission, current sponsor policy intersection, scoped read, cascades and combined limits. |
| `server/security/workspaceAccess/agentService.ts` (new) | Token parsing/generation and typed host methods; no policy engine. |
| `server/security/workspaceAccess/agentManagementContract.cjs` (new) | Shared pure canonical public-input hash and command field definitions; no policy/store. |
| `scripts/testWorkspaceAgentDelegation.ts` (new) | Real SQLite synthetic authority/session/scope/restart/capacity evidence. |
| `scripts/testWorkspaceAgentService.ts` (new) | Pure token/adapter/no-secret-on-failure checks. |
| `docs/07_verification/ACCEL_AGENT_AUTHORITY_CORE_20261024.md` (new) | Exact commands/revisions/results and preserved failures. |

Root owns HTTP, CLI, direct client, HUMAN service, host projection integration and actual-app evidence. Reuse `projectPolicy.cjs` and `identity.ts` unchanged. Follow red test, implementation, focused qualification/regressions, review and signed commit; serialize Windows-heavy runs with setup lane.

`WorkspaceStore.open(root,{initialize:true,actionReceipts:true,agentDelegation:true})` creates schema 3 only for a new/disposable authority. Invalid types/prerequisites reject before native acquisition. Existing authority plus initialization opt-in rejects before SQLite mutation. Ordinary opens accept exact schemas 1/2/3; defaults and old schema result shapes remain unchanged. Schema 3 inherits HUMAN receipt capability. It adds `agentDelegation:true` and a development-only capability marker to schema 3 metadata. No upgrade/import/downgrade is implemented.

```ts
type WorkspaceAgentAction = 'task:read';
type WorkspaceAgentScope = {kind:'TASKS';taskIds:string[]}|{kind:'PROJECT_TASKS'};
type WorkspaceAgentActor = {
 kind:'AGENT';principalId:string;clientId:string;sessionId:string;
 sponsorPrincipalId:string;grantId:string;grantRevision:number;
 projectId:string;scope:WorkspaceAgentScope;actions:WorkspaceAgentAction[];
 expiresAt:number;policyRevision:number;snapshotRevision:number;
};
```

Actions must be exactly `['task:read']`. TASKS is a nonempty sorted unique list of at most 64 existing task IDs in one bound ordinary project; PROJECT_TASKS permits individually named tasks in that one project, never task listing or the aggregate. Missing/unknown/wildcard/duplicate scope/actions reject. Self-project is denied entirely. Task projection is exactly `id,title,description,status,priority,updatedAt`; no relationship pointers, evidence, other tasks, project metadata, counts or snapshot. Missing/out-of-scope resources share a uniform external denial.

Four new tables retain the draft's separate agent principal/client/grant/session relationships, but **combined HUMAN+AGENT principal/session limits stay 128/256**, shared used digests stay 4096, and new clients/grants are capped at 256/512. Existing audit/operation/snapshot/RPC/time budgets remain unchanged. Grants/profile/client history is retained. Expired/revoked/generation-stale sessions may be reclaimed under the existing rules. Grant lifetime <=30 minutes; sessions use existing 10-minute idle and 30-minute absolute limits, bounded by grant expiry. Equality at expiry rejects.

`WorkspaceAgentService(authority, clock=Date.now)` exposes `sessionState(token)` -> `{available,actor:null|WorkspaceAgentActor}` and `readTask(token,{projectId,taskId})` -> `{available,allowed,reason,task?,actor?,policyRevision?,snapshotRevision?}`. `agentTokenDigest` accepts only `dmk_agent_v1_` + 64 lowercase hex and hashes `dmk-agent-session-v1\0` plus token. HUMAN tokens are rejected; root rejects ambiguous mixed credential kinds. IDs and raw tokens are generated by host; only digests enter worker/audit. Issuance returns raw token once after confirmed commit, never on uncertainty.

Final RPC set (all strict exact fields):

| Command | Fields beyond command |
| --- | --- |
| `enrollAgent` | `sponsorDigest,projectId,agentId,name,expectedPolicyRevision,now` |
| `registerAgentClient` | `sponsorDigest,agentId,projectId,clientId,name,expectedPolicyRevision,now` |
| `grantAgent` | `sponsorDigest,agentId,clientId,grantId,projectId,scope,actions,expiresAt,expectedPolicyRevision,now` |
| `issueAgent` | `sponsorDigest,grantId,expectedGrantRevision,expectedPolicyRevision,sessionId,digest,now` |
| `agentSession` | `digest,now` |
| `readAgentTask` | `digest,projectId,taskId,now` |
| `revokeAgent` | `sponsorDigest,agentId,expectedPolicyRevision,now` |
| `revokeAgentClient` | `sponsorDigest,clientId,expectedPolicyRevision,now` |
| `revokeAgentGrant` | `sponsorDigest,grantId,expectedPolicyRevision,now` |
| `revokeAgentSession` | `digest,now` (caller session only) |

Management results include resulting policy revision. Host methods mirror RPC names with typed public inputs, HUMAN token, generated IDs/time and no arbitrary command selection. Every issuance/session/read rechecks actual HUMAN sponsor enabled, original credential revision, current OWNER plus `evaluateProjectAction(...,'project:read',projectId)`, agent/client/grant/session revocation, current grant revision, times/generation and exact task scope. A declared HUMAN copy of an agent is never used. Credential reset/password change/disable and membership loss immediately invalidate agent use. Explicit revoke cascades and audits atomically. Original sponsor may revoke its objects after membership loss; a current project OWNER may revoke an exact grant for that project. Ordinary HUMAN logout does not revoke independently issued bounded grants.

Schema 3 strictly validates all added table/FK/identity/JSON/time/revision/capacity bindings on reopen, and applies schema 2 HUMAN receipt validation unchanged. Read-only agent operations never change snapshot or operations. Raw token material never enters evidence. No agent receipt-version 2, session-issuance-to-receipt binding, task-update diff guard or agent commit command from the historical draft is implemented in this slice.

Required evidence: red missing-feature tests; schema compatibility/new-only/options/old-binary rejection; persistence/reconnect; cross-kind/scope/project/self-project and projection-denial tests; sponsor/credential/membership/expiry/revocation/generation checks; combined/additional capacity and rollback; tamper/reopen; no snapshot/receipt changes; HUMAN identity adapter denial and legacy regressions. Root qualifies real app/direct client and four CI jobs. Source-derived ACLs, trusted skill admission, all transports, lifecycle writes, live enrollment/client compatibility, human acceptance and production release remain unqualified.

### Agreed management acknowledgment addition

Before implementation of this addition, root agreed all sponsored management writes above need durable body-bound idempotency. Add `agent_management_ops(operationId,principalId,projectId,action,requestHash,expectedPolicyRevision,receiptJson)` to schema 3; receiptJson is at most 4096 bytes. Its rows and existing `operations` share the existing total 4096 ceiling and global operation-ID uniqueness. No raw token is stored. Management inputs add client-stable UUID `operationId`; host and worker use the same pure module to compute/verify requestHash over exact canonical public input, including original expectedPolicyRevision. Generated record/session IDs and token digest are excluded from public-input hashing and bound in the persisted result.

First mutation, result metadata and `AGENT_MANAGEMENT_COMMITTED` audit digest commit atomically. Replaying the same actor/operation/body checks current HUMAN authority and original action scope before returning a historical acknowledgment, before policy CAS; it adds no action effects or audit. Changed body/actor/operation-kind fails. Revocation replay remains valid after its own target becomes revoked; it still requires current HUMAN authority. Issue first confirmed result may deliver the generated token; replay returns `tokenAvailable:false` and the historical session acknowledgment, never a fresh uncommitted token. Lost secret requires explicit revoke/replacement. The acknowledgment contains IDs and revisions, not full grant content.

Agent session-ID replay tombstones also consume the shared 4096 used-digest ceiling (two entries per agent session: token digest plus domain-separated session-ID hash). No limit is increased. Self-session logout retains the existing HUMAN logout semantics and is not a sponsored management operation. Task reads currently have no durable receipt; a future typed read boundary must include expectedSnapshotRevision and operation identity. This slice does not claim all package 12 operations are idempotently acknowledged.

