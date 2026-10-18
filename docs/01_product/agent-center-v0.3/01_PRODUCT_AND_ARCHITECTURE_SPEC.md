# DOCMONSTAKRAKIN | Collaborative Agent Center and Governance Profiles
## 01. Product and Architecture Specification

**Status:** PROPOSED DESIGN / SIX ORIGINAL FINDINGS AND THREE FOLLOW-UP CONTRACT AMBIGUITIES ADDRESSED IN DESIGN / NOT APPROVED OR IMPLEMENTED  
**Design edition:** 2026-10-19 | v0.3 focused contract clarification (design only)  
**Project:** DOCMONSTAKRAKIN (A-SSDLC control plane)  
**Repository baseline inspected:** `Jeruzael/docmonstakrakin`, `master` at `75fde2aa3e0d925673fd813cbf9e7f49c4dabb75`  
**Reference UI:** supplied screenshot of Agent Center for project `PRJ-ATLAS-01` (Atlas Platform Launch).

> **North star:** A local-first, evidence-driven project control plane in which a solo developer can work with a visible, collaborative fleet of AI specialists; real teams can distribute accountability; and high-assurance projects can demand independently authenticated human review. Simple, 2D and 3D are three views of **the same system**, not separate sources of truth.

## 1. Basis: what exists versus what this document proposes

### Confirmed implementation baseline (repository inspection)

| Existing element | Location / fact | Implication |
| --- | --- | --- |
| Agent Center | `src/components/AgentCenterView.tsx` has fleet role list, detail blueprint, two tabs, run button and run audit log | **Preserve and evolve** existing Simple UI |
| Agent API | `GET /api/projects/:id/agents` and `POST /api/projects/:id/agents/:agentId/run` in `server.ts` | Add real execution services behind versioned contracts; do not silently reinterpret existing demo data |
| Current run behavior | Existing `run` route returns predefined summary/review text, random-looking duration and token values | **Current demonstration/simulated results must be labeled**, not presented as real inference or attested assurance |
| Current types | `AgentRole` and `AgentRunLog` in `src/types.ts`; model tiers include Gemini 2.5 and deterministic rules | Add a compatibility layer, provider identities, verified run origin and actor classifications |
| Project state | `server/projectStore.ts`, `server/projectPersistence.ts`, `.local/project-state.json` | Use project-scoped, crash-safe, versioned state; preserve existing data and locks |
| Prompt Compiler | `src/components/PromptCompilerView.tsx` | Compile tasks/context for external or integrated models, with authority and privacy checks |
| Existing product modules | Requirements/Questionnaire, Work Management, Repository & Git, Risk, Evidence & Audit, Approvals Inbox | Connect agents and conversations to these canonical artifacts; do not replace governance |
| A-SSDLC trust work | Merged Stage B2b2-A documents, including `docs/05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md` | These are **unratified architecture proposals**, not active production signer/quorum requirements |
| Authentication program | Existing reviewer-session guards are specialized; the agent endpoints are not generally guarded. Local human sessions, RBAC and agent delegation are proposed in the DMK-209–214 authentication workstream / unmerged PR #34 | **Explicit gating dependency:** shared messaging or real execution cannot be enabled until the relevant authenticated principal, membership and revocation contracts are implemented and tested |

**Important terminology:** Existing `ProjectProfile` means application type (`WEB_APPLICATION`, `MOBILE_APPLICATION`, etc.). Introduce a distinct `governanceProfile` field. Do **not** overload `Project.profiles`.

### Proposed, not yet present

Custom instantiated agents, local-model provider detection, durable agent-to-agent conversation threads, mentions, a multi-agent scheduler, meaningful live run states, a solo/team/high-assurance governance selector, 2D/3D workplaces, and owner-approved delegation are **new work**. This document is not a claim they already function.

## 2. Product principles and invariants

1. **Useful with zero AI:** Manual PM, requirements, documentation, evidence, traceability, deterministic policy checks and audit history work when no model is available.
2. **One canonical activity model:** Run execution, conversation, mentions, task changes, evidence and avatar status originate in recorded, attributable events. Renderers never invent activity.
3. **Governance depends on required assurance, not just headcount:** Team size suggests a default; project risk, organizational rules, contractual requirements and ratified floors determine permitted authority. No automatic downgrade.
4. **Agents occupy functional roles, not human identities:** Agents can act as Architect, Security Analyst, Tester or PM assistant, but their participation is recorded as `AI_DELEGATED`; they cannot satisfy a requirement for independently verified humans.
5. **Separate review kinds:** GitHub approval, AI advisory review, deterministic verifier result, solo owner acknowledgment and independent human governance approval are different evidence types.
6. **No model or avatar bypass:** Agents and views cannot grant permissions, alter protection rules, change risk classes, or turn an evidence-only result into authorizing execution.
7. **Visibility without fake thought bubbles:** A speech bubble shows a published message, run stage or observable summary. Never fabricate an agent's hidden reasoning, private prompt or purported internal thoughts.
8. **Local-first privacy:** Cloud transmission requires user-approved provider configuration and per-task data scope. Secrets never enter ordinary project data or a model prompt. A local model stays local.
9. **Pause, inspect, recover:** Every run has identifiable ownership, explicit pause/cancel-request semantics, crash recovery, uncertain-outcome and duplicate-billing disclosure, and bounded cost/resources. Retained history survives mode switches and restart.
10. **Fun is optional:** 2D and 3D enrich comprehension but must never be prerequisites for oversight, accessibility, portability or audit.

## 3. Three governance modes

The project chooses a **governance profile**, initially suggested from team size but explicitly confirmed by its authority holder. A stronger organizational policy can impose a minimum, and moving downward requires separately authorized review.

| Property | `SOLO` | `TEAM` | `HIGH_ASSURANCE` |
| --- | --- | --- | --- |
| Intended operators | One human owner | Multiple humans | Regulated, safety/mission-critical or independently controlled team |
| AI roles | Unlimited configurable functional agents within resource/permission budgets | Shared across teams, attributable sponsors | Advisory/draft/test under narrow signed delegation |
| Allowed human approval | Owner self-approval for operations expressly allowed by the selected solo policy | Configurable distinct-human review according to ratified policy | Independent authenticated people and protected signing/quorum requirements |
| Evidence label | `SOLO_OWNER_APPROVED`, `AI_REVIEWED`, `NO_INDEPENDENT_HUMAN_REVIEW` as applicable | `TEAM_HUMAN_APPROVED` with actual actors | `INDEPENDENT_HUMAN_APPROVED` only when verified quorum truly exists |
| Sensitive changes | Require explicit owner risk acceptance, tests, traceable decision and explicit policy allowance | Escalate based on risk/role | Block when mandatory independent humans/trust infrastructure are missing |
| Absent approver | Solo works only for permitted solo-scoped operations | Wait / reassignment to legitimately eligible human | Fail closed for protected operation |
| Audit truth | Never claim multi-human separation | Count distinct persons, not keys/accounts | Verify true identity, custody, policy root and evidence chain |

**Non-negotiable:** A project previously operating under a charter, legal or organization-mandated multi-human quorum cannot convert a protected operation to solo by clicking a switch. Introducing `SOLO` into the platform does not retroactively modify the current DOCMONSTAKRAKIN project's unratified/active policies or authorize PR #34. Migration needs an explicit project-specific decision.

**Role vs identity:** `Agent role = function + allowed capabilities + mission + provider`. `Human governance authority = authenticated person + ratified scope + current policy`. One person with two hats counts as one human; multiple agents do not add humans. Solo assurance should be useful and truthful, not a forged quorum.

## 4. Capability and connectivity matrix

Model availability and governance profile are **orthogonal** dimensions. A project may be `SOLO + OFFLINE + NO_MODEL`, or `TEAM + ONLINE + CLOUD_MODEL`.

| Provider situation | Agent action | Project management and A-SSDLC |
| --- | --- | --- |
| Local compatible model healthy; offline | Use configured local provider within device quotas and verified tool permissions | Fully functional |
| Cloud model healthy; online and permitted | Use explicitly approved provider and approved context scope | Fully functional |
| Both available | Follow user-chosen local/cloud preference and task data policy; disclose fallback | Fully functional |
| Model temporarily unavailable | Queue recoverable AI tasks, offer manual draft and deterministic tools; disclose unavailability | Fully functional |
| No model configured | Manual project/agent collaboration plus deterministic rule checks; AI run buttons disabled or invite configuration | Fully functional |
| Restricted/high-assurance environment | Only approved provider destinations and allowed offline capability | Enforce the selected project's policy floor |

**Suggested provider state machine:** `UNCONFIGURED -> DISCOVERING -> HEALTHY | UNAVAILABLE | AUTH_REQUIRED | POLICY_BLOCKED`. Each run records the actual provider/model/runtime and whether any cloud data left the device. Do not automatically send confidential content to cloud as fallback. A pending offline run must not masquerade as running.

**Deterministic/manual fallback:** The Adaptive Discovery questionnaire remains navigable; deterministic branching/validation, backlog, standards and evidence capture remain usable. AI-generated question suggestions, synthesis and automatic responses are unavailable until an authorized model returns. Label manually filled agent roles as `MANUAL` rather than `AI_ACTIVE`.

### 4.1. Trust backends by assurance mode (proposal)

| Backend | How trust is established | Can owner work offline? | Honest limit |
| --- | --- | --- | --- |
| `SOLO_LOCAL` | Project-scoped owner identity using the device's OS-protected credential/signing facility, explicitly accepted local policy and locally appended evidence events | **Yes**, for operations that the local solo policy actually authorizes | Device administrator or compromised machine may alter the local clock or roll back local records; do not claim independently witnessed or regulatory-grade approval |
| `TEAM_MANAGED` | Ratified project human registry, separate actor access, configured local or hosted collaboration and evidence verification | **Conditional**, according to whether the team's ratified policy supports offline decisions/synchronization | Cannot count absent or offline humans as having approved; signed submissions may remain queued/pending |
| `HIGH_ASSURANCE_EXTERNAL` | Independently authenticated governance root, signer roster, witness/checkpoint and trusted time as required by the selected ratified policy | **Offline preparation and evidence review**, but protected approval/registration blocks when its authoritative services or independent humans are unavailable | A local-only fallback must not silently impersonate external witnesses or lower the required quorum |

For `SOLO_LOCAL`, a project may record an **authenticated local owner acknowledgment** and precise change/evidence hashes for operations the explicitly authorized local solo policy permits. Use the evidence label `SOLO_OWNER_APPROVED` only after an authenticated owner decision, never merely because an agent made a proposal. An acknowledgment from a local session is `LOCAL_SESSION_ACKNOWLEDGED`, **not** a cryptographic signature. `OWNER_CRYPTO_SIGNATURE_VERIFIED` requires a distinct enrolled signing key, consent ceremony and verified payload; SecretStore protects credentials but does not implement that ceremony. Locally recorded time, backups and hashes do **not** constitute independent trusted time or rollback prevention. This is lower, honestly described assurance, and does not grant authority over DOCMONSTAKRAKIN's protected WBS registration or override a higher organizational floor.

**Existing DOCMONSTAKRAKIN project caveat:** The previously designed B2b2 protected canonical WBS registration program is not automatically moved to `SOLO_LOCAL` by adding this feature. Any change to that program's human signing requirements, protected branch policies or governance charter needs separate human authorization and explicit compatibility decisions before PR #34 can move.

## 5. Agent organizational model

Each project has an agent roster. Agents may be created from role templates or customized with:

- Identity: stable `agentId`, display name, avatar preset/appearance, functional role, category, owner/sponsor, whether `AI`, `DETERMINISTIC_SERVICE` or `MANUAL_PLACEHOLDER`.
- Runtime: approved provider preference (local/cloud), model and fallback policy, health, deterministic profile, task budget, token/cost/time budgets, concurrency and max delegation depth.
- Authority: read-only project contexts; per-tool capability grants; explicit allowed file/API scopes; proposal vs apply mode; escalation rules; secrets denied by default.
- Work: supported artifact contracts (risk assessment, ADR review, test evidence, questionnaire proposals, documentation), assigned task IDs, current run, accountability links.
- Collaboration: subscribed channels, who may mention them, communication/output budget, cooldown, whether agent-to-agent delegation requires owner approval.
- Safety: policy floor, immutable event references, prompt-injection/data provenance checks, expiration and disable state.

**Suggested starter roster:** Architect, Security, Test/QA, Requirements/Discovery, Documentation, PM/Coordinator. These are templates, not required employees or ratified humans. Start a solo user with 3 visible agents and suggestions to add more, rather than populating dozens of costly idle models.

## 6. Conversation and orchestration

### Proposed conversation primitives

- **Channels:** Project lounge (general), task thread, risk/ADR discussion, run-specific review, human escalation inbox.
- **Targets:** `@me` / human account, `@agent-name`, `@everyone` (privileged and rate-limited), `@role:security`, thread participants.
- **Messages:** Human-authored, agent-authored (real provider output), deterministic event, system/audit. Clearly labeled, ordered and related to a real project artifact/run where possible.
- **Threads:** Durable `threadId`, related task/requirement/ADR/risks, participants, event sequence, edit/redaction history, moderation/permissions.
- **Events:** `MESSAGE_POSTED`, `MENTION_CREATED`, `TASK_ASSIGNED`, `RUN_QUEUED`, `RUN_STARTED`, `RUN_PROGRESS`, `RUN_COMPLETED`, `RUN_FAILED`, `EVIDENCE_ATTACHED`, `APPROVAL_REQUESTED`, `HUMAN_DECISION_RECORDED`, `AGENT_PAUSED`, `POLICY_DENIED`.

### Orchestration rules

A mention does not automatically grant execution. Mentioning another agent sends a deliverable-oriented request with visible scope, and may enqueue a job only if the sender is permitted to delegate, within rate/budget/loop limits. Messages containing user-supplied repository text are untrusted data, not agent instructions with authority. Require explicit human confirmation for high-risk tool access and changes to authoritative state. `@everyone` must be scoped to subscribed participants, offer opt-out for noncritical notices, and be unavailable to untrusted/compromised agents.

Bound response chains by `maxHops`, `maxRepliesPerThread`, `maxConcurrentRuns`, token/time budgets, deduplication key and human escalation. A graph cycle (Security -> Architect -> Security) must terminate or escalate, not spend tokens indefinitely. Agent-to-agent critiques may be technically independent if isolated, but are still **AI review**, never independent human sign-off.

### Example collaboration (illustrative, not actual runtime data)

1. The human assigns **Audit login design** to Security Agent, with read-only Architecture/Requirements context.
2. Security Agent produces a sourced finding and mentions `@Architect Agent` in the task thread.
3. Architect proposes an ADR change. Its proposal is not automatically canonical.
4. Test Agent drafts a regression test plan; deterministic check attaches observed evidence when run.
5. Coordinator sends `@me` a concise decision request, separating proposed fixes, evidence and risk acceptance.
6. The human inspects the diff and issues any policy-allowed decision. The Evidence & Audit view records true actors and timestamps.

## 7. Architecture sketch

```text
React App (existing shell, project selector, Simple Agent Center)
  ├── Agent Center / Simple mode (operational list and detail)
  ├── Agent Center / Studio 2D (top-down accessible canvas/DOM)
  ├── Agent Center / Studio 3D (optional lazy-loaded renderer)
  └── Conversations, Tasks, Approvals, Evidence (shared inspectors)
          │ versioned API + event subscriptions
          ▼
Agent Workspace Application Services (proposed)
  ├── Project Governance Resolver (solo/team/high-assurance + policy floors)
  ├── Human Session / Project Membership Authority (authentication prerequisite)
  ├── Agent Directory and Scoped/Revocable Delegation Authorization
  ├── Classified Conversation + Mention Router (source-derived labels, rate limits)
  ├── Durable Worker / Transaction Coordinator (queue, outbox, budget reservation)
  ├── Run Scheduler (pause/cancel requests, uncertain outcomes, recovery)
  ├── Provider Router (verified local boundary / consented cloud / manual)
  ├── Context Package Adapter -> existing Prompt Compiler
  ├── Proposal + Evidence Adapter -> existing controlled modules
  └── Presence Projection (read-only event-derived status for visuals)
          │
          ▼
Project persistence and immutable attribution references
  ├── Shared HTTP + worker atomic transaction boundary and recovery ledger
  ├── Versioned snapshots/migrations and project-scoped append-only events
  ├── Work items, risks, ADRs, questions, document references
  ├── Run/provenance IDs and evidence attachment checksums
  └── Protected approval service (separate human authority)

External boundary: local inference server or explicitly consented cloud provider
Production WBS signer/trust infrastructure: separate B2b2 authority, never inferred here
```

**Integration strategy:** Retain `AgentCenterView.tsx` as Simple mode initially. Reuse `AgentRole`/`AgentRunLog` through a versioned mapper; do not delete legacy histories. The existing two routes can remain as compatibility or explicit simulation endpoints while new typed versioned routes are introduced. All data must be scoped to the selected project, including agent configuration, conversations and scene preferences.

## 8. Candidate domain model (illustrative, not deployed)

```ts
type GovernanceProfile = 'SOLO' | 'TEAM' | 'HIGH_ASSURANCE';
type InferenceMode = 'LOCAL_MODEL' | 'CLOUD_MODEL' | 'DETERMINISTIC' | 'MANUAL';
type AgentKind = 'AI_AGENT' | 'DETERMINISTIC_SERVICE' | 'MANUAL_PLACEHOLDER';
type RunOrigin = 'REAL_INFERENCE' | 'DETERMINISTIC_RULE' | 'SIMULATED_DEMO' | 'HUMAN_MANUAL';
type CenterViewMode = 'SIMPLE' | 'STUDIO_2D' | 'STUDIO_3D';

type HumanDecisionClass =
  | 'SOLO_OWNER_APPROVED'
  | 'TEAM_HUMAN_APPROVED'
  | 'INDEPENDENT_HUMAN_APPROVED'
  | 'SELF_APPROVED_WITH_RISK_ACCEPTANCE';
type OwnerDecisionProvenance = 'LOCAL_SESSION_ACKNOWLEDGED' | 'OWNER_CRYPTO_SIGNATURE_VERIFIED';
type DataClass = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

interface AgentDirectoryEntry {
  id: string; projectId: string; kind: AgentKind;
  roleTemplateId?: string; name: string; mission: string;
  avatarPresetId: string; sponsorUserId: string;
  providerPolicyId: string; capabilityGrantIds: string[];
  conversationPolicyId: string; enabled: boolean;
}

interface AgentEvent {
  id: string; projectId: string; sequence: number; occurredAt: string;
  actorKind: 'HUMAN' | 'AI_AGENT' | 'DETERMINISTIC_SERVICE' | 'SYSTEM';
  actorId: string; type: string; threadId?: string; runId?: string;
  subjectRef?: string; origin: RunOrigin; payloadDigest: string;
  visibility: 'PUBLIC_PROJECT' | 'MEMBERS_ONLY' | 'RESTRICTED';
  dataClass: DataClass; sourceRefDigests: string[]; authorityVersion: string;
}

interface AgentMessage {
  id: string; projectId: string; threadId: string; eventId: string;
  authorId: string; authorKind: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  body: string; mentionedActorIds: string[]; relatedArtifactIds: string[];
  displayedSummary?: string; dataClass: DataClass;
  sourceRefDigests: string[]; audiencePolicyId: string; moderationStatus: 'VISIBLE' | 'REDACTED';
}
```

These types deliberately use separate namespaces from the current `ProjectProfile`, `AgentRole` and `ApprovalItem`. Approval engines must resolve person identity and ratified policy, not accept `actorKind` strings as cryptographic proof.

## 8.1. Identity, session, membership and delegation contract (P0 blocker)

**Dependency: local-authentication workstream DMK-209–214 / unmerged PR #34.** Existing special-purpose governance reviewer authentication is not a substitute for endpoint-wide human sessions, project membership or agent-specific delegation. Implement its required security foundations (or a separately reviewed equivalent) **before enabling** shared threads, messaging, autonomous task dispatch, role editing or cross-project reads. Scaffolding may render configuration and blocked states without enabling these actions.

| Contract | Normative design requirement | Deny condition |
| --- | --- | --- |
| Human identity | Server-verified, revocable local session tied to immutable human `principalId`; secure bootstrap and session renewal | No/expired session, spoofed header, stolen token, unknown principal |
| Project access | Membership resource and role version for exact `projectId`; enforce read, discuss, delegate, inspect and manage separately | Nonmember, wrong project, stale membership or role version |
| Agent principal | Stable `agentPrincipalId` with kind `AI_AGENT`/`DETERMINISTIC_SERVICE`; cannot present itself as HUMAN | Agent claims human session, human signoff or owner authority |
| Delegation | Persisted scope bound to human sponsor, project, capabilities, resource/classification ceilings, expiry, max hops/budget and revocation generation | Missing grant, expired scope, changed permissions/context, revoked sponsor |
| Event authorship | Sender resolved server-side from human session or trusted worker identity + delegation; user-supplied `authorId` informational only | Forged author/mentions, replayed worker event, cross-project action |
| Revocation | Increment actor/membership/delegation version; revoke pending dispatch and recheck immediately before reads, publishing or tool action | Cached authority only, revoked recipient or stale long-running run |

Use explicit deny-over-allow, unknown-action rejection, CSRF protection for cookie sessions, authenticated streaming/polling, pagination, input limits and write-rate limits. For local-only solo operation, a verifiable owner session still matters; loopback binding **does not authenticate a sender**. Network-accessible collaboration adds a separate deployment security review. Never rely on the React view to enforce any decision.

### P0 availability versus P0 production readiness

`P0-CONFIGURATION` can expose proposed governance profile, local-only draft-agent **configuration UI with no shared write authority**, provider status, demo labels and **read-only** mock conversation previews before auth is ready. Persistent user settings must still be protected by the existing permitted local owner workflow; if no authenticated state writer exists, keep drafts in a disposable local UI fixture instead of exposing unauthenticated server writes. `P0-LIVE_COLLABORATION` (persistent messages, shared human access, mentions, autonomous dispatch and run tools) is **BLOCKED** until authenticated human sessions, project-membership checks, revocable agent delegation, authorization negative tests, and the durable transaction path below are implemented. This is not the same as Stage B2b2 production WBS signing; that stays separately blocked.


## 9. Candidate additive APIs and execution state

| Proposed API/event | Meaning | Minimum security conditions |
| --- | --- | --- |
| `GET /api/projects/:id/agent-workspace` | Role roster, capabilities, unread counts, view preferences | User/project access filtering |
| `POST /api/projects/:id/agent-workspace/agents` | Create custom agent or template clone | Human-authorized owner/role admin; no authority by naming |
| `PATCH /api/projects/:id/agent-workspace/agents/:agentId` | Edit mission, provider, grants, avatar | Changes to grants/policy separately audited and gated |
| `GET /api/projects/:id/agent-workspace/threads` | Thread list/filter/search | Access control and redaction on every thread |
| `POST /api/projects/:id/agent-workspace/threads/:threadId/messages` | Human message / delegated agent message | Server-resolved sender, membership, scoped delegation, content-class inheritance, atomic message+mention+audit commit |
| `POST /api/projects/:id/agent-workspace/runs` | Persist bounded task and reservation before dispatch; uniqueness is `(projectId, serverResolvedActorId, operation, idempotencyToken)` and canonical request digest is stored separately | Current session/delegation and membership, reviewed context snapshot, provider consent, atomic uniqueness; same token/different digest must return `409 Conflict` without effects |
| `POST /api/projects/:id/agent-workspace/runs/:id/pause` | Request pause after safe checkpoint, if supported | Operator permission; asynchronous acknowledgment, no claim that remote provider has paused |
| `POST /api/projects/:id/agent-workspace/runs/:id/resume` | Revalidate and resume paused work | New permission/policy, reviewed context and provider-consent check; new attempt ID |
| `POST /api/projects/:id/agent-workspace/runs/:id/cancel` | Request local stop, remote provider cancellation where supported, and suppress further publication | Authorized operator; independently persist local worker and remote provider state, cancellation evidence, and possible charges |
| `GET /api/projects/:id/agent-workspace/events?cursor=...` | Replay canonical event feed | Per-event visibility and monotonic cursor; polling fallback |
| `GET /api/projects/:id/agent-workspace/presence` | Read-only status derived from run/message events | No simulated inference status passed as actual run |
| `PUT /api/projects/:id/agent-workspace/view-preferences` | Mode and accessibility settings | Changing visuals cannot change governance |

Candidate **user-facing** run states: `DRAFT`, `QUEUED`, `WAITING_FOR_HUMAN`, `WAITING_FOR_PROVIDER`, `BLOCKED_BY_POLICY`, `STARTING`, `RUNNING`, `PAUSE_REQUESTED`, `PAUSED`, `RESUMING`, `CANCEL_REQUESTED`, `RESULT_UNCERTAIN`, `COMPLETED`, `FAILED`, `CANCELLED`. These are **derived** from two independent, durable axes: **local scheduler/worker state** and **remote provider acceptance/execution/termination state**, plus cost state. A locally stopped worker is **not** evidence that a remote provider stopped. Provider request receipt or a successful cancellation HTTP response is not by itself proof of completed termination. `CANCELLED` is permissible only before dispatch or with independently verified no-remote-work/remote termination evidence. If the provider may continue, show `RESULT_UNCERTAIN` and preserve `UNCERTAIN` billing even if the local worker is stopped. Pause is a scheduler-safe checkpoint unless the provider separately verifies remote pause. Late provider results after cancellation are quarantined and attributed, not silently published or counted as accepted success. Explicit retries use a new authorized attempt with fresh authority/consent review, never an implicit duplicate dispatch. Use durable monotonic run/attempt IDs and preserve seeded records as `SIMULATED_DEMO`. See §9.2 for exact interruption semantics.

### 9.1. Durable background execution contract (P0 prerequisite, not currently implemented)

`server/projectPersistence.ts` currently provides an HTTP response-oriented snapshot commit mechanism for `.local/project-state.json`. **Background workers cannot depend on an HTTP response to commit work.** Define one transaction interface shared by HTTP and workers, with project-scoped serialization, optimistic expected-version checks, crash consistency and recovery evidence. A transactional local database with a WAL (for example SQLite) is a **candidate implementation**, not an assertion that the current project already uses it. If reusing atomic snapshot files, prove worker/HTTP writer serialization, power-loss durability and multi-record atomicity rather than assuming them.

Atomic local transaction boundaries:

1. **Enqueue:** Under a unique server-side `(projectId, actorId, operation, idempotencyToken)` constraint, commit the separately computed immutable canonical request digest, task/context hash, actor/delegation and permission version, job, budget reservation, `RUN_QUEUED` audit event and outbound dispatch intent atomically. The request digest is **not** part of the unique key. No provider call occurs before this transaction commits.
2. **Dispatch claim:** Worker atomically leases/claims one outbox item with attempt ID, fencing token and expiry. Recheck actor status, project membership, capability grants, data classes, risk policy and destination consent; expired lease is not evidence that external work never started.
3. **Publish:** Commit provider response digest, classified artifact/message, derived mentions/notifications, budget reconciliation, job transition and provenance events together. A viewer may not see a message unless its source and authorization metadata are already durable.
4. **Recovery:** On restart replay the committed outbox/event ledger; reconcile leases and status without double-applying local side effects. If external provider acceptance is unknown, mark `RESULT_UNCERTAIN`, retain cost reservation/uncertainty, and request an operator decision or safely query provider status when supported. No blind resubmission.
5. **Concurrency:** Enforce single authoritative ordering/fencing per project and conditional snapshot-version checks. A unique scoped idempotency key resolves one request digest only; duplicates return the existing authorized result or `409` on digest mismatch. Revoke access on role/version changes even if old events remain stored; transactional visibility also enforces every source ACL on each derived notification.

**Guarantees:** At most one **local committed effect** per scoped idempotency key if the transaction store passes crash testing. There is **no blanket exactly-once guarantee** for external inference acceptance, execution, cost or callbacks. Provider-level idempotency may improve recovery only when documented and tested. A budget can be `RESERVED`, `SETTLED`, `RELEASED` or `UNCERTAIN`; never quietly release it when external billing may have occurred.

#### 9.1.1. Scoped idempotency uniqueness and payload mismatch (normative candidate)

Define the deduplication identity as the tuple **`(projectId, serverResolvedActorId, operationName, normalizedClientIdempotencyToken)`**, with one atomic unique constraint. `serverResolvedActorId` comes from the authenticated user session or verified delegated agent principal, never an untrusted request field; operation names are versioned. Normalize/validate the opaque token consistently and reject empty, overlong or malformed tokens. The **canonical request SHA-256** is a separately persisted immutable value, computed on the server from the full effect-bearing input: task/operation, all referenced source/context manifests, provider/model/destination, tool scope, budget and other request-controlled values. Do not trust a client-claimed digest.

- **First request:** Authorize the current actor and the exact request, then atomically insert the unique key and its digest with a single job, budget reservation, outbox event and audit record before any provider call.
- **Same key + identical canonical digest:** Reauthorize access to the existing job and return its persisted ID/state/result; **do not** create another job, attempt, reservation, outbox event or provider call. A revoked or unauthorized actor receives an appropriate denial rather than a leaked previous result.
- **Same key + different canonical digest:** Respond **`409 Conflict`** with stable code `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`. Do not overwrite the original digest, enqueue work, reserve a second budget, emit a dispatch event or call the provider. Concurrent races must resolve under the unique constraint with this exact behavior.
- **Explicit retry after a known failure or uncertain provider outcome:** Requires a separately authorized retry decision, a **new** token/attempt linked to the original job, renewed permission and cloud consent, and an explicit duplicate-billing warning where applicable; a repeated token alone must never initiate retry. For `RESULT_UNCERTAIN`, block automatic provider re-dispatch until authoritative reconciliation or a deliberate operator risk decision.
- **Retention:** Keep the mapping (or a protected non-reusable tombstone) for the configured audit/recovery horizon, **at least while any provider outcome or billing remains uncertain**. Garbage collection must not silently permit an old token to generate a second effect during a supported replay window. Define expiry and replay-horizon behavior before deployment.

Prove this with parallel same-token requests, modified body, destination/attachment changes and crashes at unique-insert boundaries. Record exactly one local job/reservation/outbox dispatch for the first successful insert and **zero additional provider invocations** for a conflicting reuse.

| Crash/race | Required recovery outcome |
| --- | --- |
| Before enqueue commit | No job/outbox/reservation visible; provider not contacted |
| After enqueue, before provider dispatch | Durable queued job dispatched once by fenced worker, subject to fresh authority checks |
| After provider accepts, before acceptance token/response is durably recorded | `RESULT_UNCERTAIN`; do not blindly rerun or mark failed/refunded |
| After response arrives, before atomic publish | Reconcile known provider result if provable; otherwise remain uncertain, no duplicate notifications/artifacts |
| After atomic publish, before HTTP/worker acknowledgment | Replayed request returns same stored result; no duplicate local messages or evidence |
| Concurrent duplicate jobs, same-token changed request, revocation, edits or cancel | One scoped idempotency winner; changed digest yields `409` and zero new job/budget/provider effects; late output quarantined |

### 9.2. Separate local worker stop from remote provider termination (normative candidate)

Store at least three **independent, audited state dimensions** for each attempt:

| Dimension | Examples | Meaning |
| --- | --- | --- |
| `localWorkerState` | `QUEUED`, `RUNNING`, `PAUSE_REQUESTED`, `PAUSED_AT_CHECKPOINT`, `CANCEL_REQUESTED`, `STOPPED`, `FINISHED` | What the local scheduler/worker has actually done; a stopped worker cannot assert anything about remote execution |
| `providerExecutionState` | `NOT_DISPATCHED`, `DISPATCH_ACCEPTANCE_UNKNOWN`, `MAY_BE_RUNNING`, `CANCEL_REQUESTED`, `CANCEL_UNSUPPORTED`, `TERMINATION_CONFIRMED`, `COMPLETED`, `OUTCOME_UNKNOWN` | Independently observed provider lifecycle with provider-specific request ID, evidence source and time; do not infer it from local process status |
| `costState` | `RESERVED`, `SETTLED`, `RELEASED`, `UNCERTAIN` | Actual cost evidence, possible billing, and reconciliation history, independent of UI run status |

The visible `runStatus` is a **derived projection** and must never overwrite these axes. Local scheduler pause at a checkpoint is not a remote pause. A cancellation API acknowledgement can mean *request received*, not *remote termination confirmed*; record those events separately. Provider cancellation is unsupported unless demonstrated by adapter capabilities. A provider that continues after local worker termination is `localWorkerState=STOPPED`, `providerExecutionState=MAY_BE_RUNNING` or `OUTCOME_UNKNOWN`, `costState=UNCERTAIN`, with UI `RESULT_UNCERTAIN` (never `CANCELLED`). On provider completion after a cancellation request, quarantine late content and preserve its provider/cost provenance; do not publish it as a successful accepted task or claim no charge. An external `CANCELLED` verdict requires evidence of no dispatch or actual remote termination, not a disconnected local socket or timeout.

| Scenario | Observable outcome |
| --- | --- |
| Cancel before any provider dispatch | Durable local cancellation and `NOT_DISPATCHED`; `CANCELLED` may be displayed, release unused reservation |
| Kill worker after remote request was accepted; provider continues running | Local `STOPPED`, remote `MAY_BE_RUNNING`, UI `RESULT_UNCERTAIN`, billing `UNCERTAIN`; no success/cancel claim |
| Provider accepts cancel request but gives no termination proof | Remote `CANCEL_REQUESTED` or `OUTCOME_UNKNOWN`; UI still pending/uncertain, never `CANCELLED` |
| Provider has no cancellation endpoint or continues after local stop | Record `CANCEL_UNSUPPORTED` or remote `MAY_BE_RUNNING`; no forced refund or automatic retry |
| Remote provider later returns output after user cancellation | Attribute to original attempt, quarantine output, reconcile possible charge, require authorized decision before any release |
| Pause requested during remote inference | Pause the **next scheduler step** after a safe checkpoint; show provider still active until separately proven stopped/paused |

On restart, reconstruct all three dimensions from durable provider receipts, job events and cost records. Test with a synthetic provider that **continues processing after a local worker is killed**, an adapter that acknowledges cancellation without stopping, an unsupported-cancel provider and a late response. No simulated provider termination/billing evidence may be presented as real.

## 10. Visual modes and true state

**Simple:** Default, highest-density, fast keyboard navigation; retains existing role cards, detail contract and audit log while adding roles, channels, run queue, unread mentions and provenance.

**Studio 2D:** CSS/Canvas/SVG hybrid top-down workspace with avatar sprites at Security, Architecture, QA, PM, Docs, Discovery stations. Speech bubbles are recent published messages or status-event summaries. Selecting an avatar opens the exact same Agent Inspector used in Simple mode. No new authority.

**Studio 3D:** Later optional, dynamically loaded WebGL scene using the same presence projection, agents, thread data and inspector. User can pan/zoom or keyboard-select stations. Disable animations for reduced-motion and low-power; fall back to 2D/Simple on unsupported devices. Avoid asset/network dependency for core workflows.

A render failure is a presentation failure, not a project data loss. The app must preserve the selected thread and agent when users switch modes. No renderer writes directly to governance or run records.

## 11. Trust, privacy and audit requirements

- **Actor provenance:** Stable human IDs; agent IDs; provider identity; signer-independent role classification; source IDs and event timestamps. UI badges indicate actual assurance level.
- **Least privilege:** Initial agents are read-only and proposal-capable. An assignment never implies filesystem or shell access. Privileged tools require explicit grants and policy checks at execution time.
- **Prompt injection:** Retrieved GitHub text, user documents and other agent messages are untrusted context. Context compiler strips secrets, attributes sources and separates policy from data.
- **Secrets:** Continue using the existing SecretStore abstraction. No raw provider key, agent signing key or Git credential in threads, snapshots, logs, avatar speech bubbles or screenshots.
- **Content retention:** Provide per-channel retention/export/redaction and preserve auditable metadata, hash and explanation of redactions. Sync/import must not grant inherited approval authority.
- **Delivery semantics:** Queue/lease/outbox, messages, mentions, audits, classified source references and budget reservations use one tested atomic transaction path. Idempotency prevents duplicate **local commits**, not necessarily duplicate external inference/billing. Unknown provider acceptance remains `RESULT_UNCERTAIN`; reconnect/reload reconstructs the same visible state.
- **Human attention:** Rate-limit mentions and notifications; high-severity escalations cannot be silently muted by an agent.
- **Policy floors:** Role configurations, avatar setting and governance-profile changes are never permitted to lower a protected organization's required separation of duties.
- **Offline integrity:** Local operation can provide owner-scoped evidence and tamper-evident history, but it must not claim externally witnessed anti-rollback guarantees unless those guarantees actually exist.

### 11.1. Derived-content classification and disclosure policy

Use data classes `PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED` (within a project). **Classification is not access authorization.** Each source artifact, excerpt, tool response, retrieved result and prompt-context component has project ID, immutable source/content digest, classification, source-specific allow/deny rules or audience-policy reference, and explicit **read** versus **discover-existence** permissions. A run records a complete immutable input/source manifest, including materials merely seen by the model and **not cited** in its output. A derived output inherits the highest source classification **and the conjunction/intersection of all contributing source access policies**, not just the maximum class. Two `RESTRICTED` files can have disjoint readers; combining them must not grant either reader the other source. Unknown source ancestry, classification or ACL is fail-closed and cannot be broadcast or exposed through captions/metadata until reconciled.

**Normative authorization predicate:** For any recipient `r` and derived output `o` from complete contributing-source set `S`, `mayRead(r,o)` requires authenticated current project membership, the required data-class clearance, current channel/output policy, delegation scope where applicable, and **for every `s` in `S`, `mayRead(r,s)` under that source's current ACL**, with deny-over-allow. Evaluate per-resource predicates (not a lossy maximum-class comparison). For source audiences represented as sets, the permitted output audience is the **intersection** of all source allow sets and target-channel recipients, minus the union of denies. A recipient losing access to even one source immediately loses access to the derived output, including cached copies and historical projections; version and invalidate relevant indexes/caches when any source policy or membership changes.

**Existence visibility is separate:** `mayDiscover(r,o)` requires current permission to discover **every** contributing source and the derived output; it must not be inferred from classification clearance or read permission on one of several sources. If even one source forbids existence disclosure, the recipient gets **no mention, unread count, preview, notification, pointer, search hit, avatar caption, status marker, thread title, export entry or timing-sensitive activity detail** attributable to that output. If discovery is explicitly allowed for every source but reading is not, a policy-approved neutral notification such as `Restricted update available` may be shown without a source title, digest, identifier or sensitive count, and any link must reauthorize at click time. Locked-screen push notification behavior must additionally follow the most restrictive delivery policy.

Every **generate, write, publish, read, search, push, mention, desktop notification, export and Simple/2D/3D UI projection** rechecks classification **and every source ACL** using the complete lineage manifest, before both queueing notifications and rendering them. `@everyone` means only the dynamically authorized audience, not all account holders. Source citations may help traceability but their absence cannot remove inherited access constraints. A sanitized or paraphrased excerpt is **not automatically declassified**. Declassification that changes source-derived ACL constraints or class requires a separately authenticated, actually authorized human decision binding the complete source set, exact source/output digests, target audience, justification and audit evidence under ratified policy.

A model's response is untrusted data. Renderers use only durable, permitted content and cannot display hidden reasoning, prompt secrets or invented progress. Losing source lineage requires quarantine/owner-restricted review, not default-to-public or class-only filtering. Negative tests must include two same-class sources with non-overlapping ACLs, paraphrases without citations, source ACL revocation after message delivery, recipients denied even existence, and indirect leaks via search, exports, logs, `@everyone`, avatar captions and unread badges.

### 11.2. On-device inference boundary and cloud consent

A user-supplied `http://localhost` endpoint is **not sufficient proof** that computation/data stays on-device: local runtimes can proxy remotely. Validate provider identity, trusted executable/config version (where supportable), bound socket/loopback host, DNS resolution, TLS/origin where applicable, ports and proxy settings; prohibit redirects, DNS rebinding, loopback-to-cloud forwarding and unreviewed plugin/tool egress. Restrict outbound traffic for **both** the application process **and** the model runtime, while permitting the approved local IPC connection, and verify the restriction through independent network-denied integration tests. If the runtime cannot be confined or verified, display `LOCAL_ENDPOINT_UNVERIFIED` rather than `ON_DEVICE_VERIFIED` and do not make a verified local-only/privacy guarantee. Runtime operators must explicitly approve any limited-risk use of unverified local endpoints consistent with project policy; strict local-only policy denies it.

For cloud: require human confirmation of exact destination (provider + canonical endpoint/tenant), model, task purpose, **immutable reviewed context/artifact digests**, classifications, maximum tokens/cost and retention policy; store scoped consent evidence with expiry. Revalidate at execution and retry against queued task edits, data label changes, new source attachments, provider redirects/host changes and consent revocation. Changed destination or context requires fresh consent. Never fall back from local to cloud automatically merely because a provider reports unavailable. Outbound-denied offline tests must prove **zero** external requests from both app and local model processes; a healthy local model endpoint alone is not this proof.


## 12. Technical rollout and backward compatibility

1. **Foundation/configuration (P0):** Governance profile **configuration** and policy-locked states, actor/assurance classifications, explicit simulated-demo labels, provider status without unsupported ON_DEVICE claims, project-state migration and negative UI tests. This does **not** deliver operational signing/approval or shared agent permissions. No WBS changes.
2. **Authentication/transaction gate (P0 prerequisite):** Implement and verify local human sessions, project membership, agent delegation/revocation, atomic HTTP+worker transaction/outbox/recovery and derived-content classification before exposing live conversations or real task execution. DMK-209–214/PR #34 are a related but still unregistered/blocked workstream; determine approved ownership and dependencies first.
3. **Collaboration (P0 after gate):** Custom agent roster, real task scheduler, durable classified threads/mentions, human escalation, bounded delegation and provenance events. Integrate Prompt Compiler and Evidence/Work item linking.
4. **Operational Simple UX (P0):** Role catalog, live run monitor, conversation inspector, run/evidence trace and keyboard/mobile UX.
5. **Studio 2D (P1):** Optional map, sprites, interactive agents, real-message speech bubbles and mode toggle using same state.
6. **Studio 3D (P2):** Optional lazy-loaded 3D, performance fallback, scene customization, never a security dependency.
7. **Production hardening (separate authorization):** Approval/risk policies, protected human signing, integration tests, audited remote trust and B2b2 B/C/D/E/F workstreams.

### Nonfunctional candidate targets (to validate with test users)

- Simple mode should work with no WebGL and without cloud connectivity after application assets are locally available.
- A 2D render failure must not erase, lose or mutate an agent run or message.
- A user can locate all pending `@me` mentions and human decisions without opening the immersive scene.
- No data generated by a simulated seed may be labeled independently verified; ACL-denied sources must not leak even existence through captions, badges or push notifications.
- Agent count, provider failures and model budgets must not block manual project management.
- UI should preserve basic keyboard operation, screen reader labels, reduced-motion preferences and responsive layouts; cancellation of local work must not imply remote termination.

## 13. Outstanding product decisions

1. Should solo owner acknowledgment be the default for permitted personal operations, or require explicit opt-in? Which operations require an independent signer or a separate cryptographic owner-signing ceremony?
2. Which solo operations need extra deliberate confirmation, despite not requiring a second human?
3. What is the minimum team size at which the onboarding assistant should *suggest* `TEAM` without automatically imposing it?
4. What offline model runtimes are supported first? Decide based on installed provider discovery and privacy, not vendor assumptions.
5. Should 2D be isometric or top-down? Recommendation: top-down first for accessibility and lower CPU usage.
6. Which channels may agents initiate without explicit task assignment? Recommendation: none beyond policy-bounded issue threads.
7. How should separate future WBS registration policies be reconciled with local project governance profiles? Requires a human decision; not decided here.

**Guardrail:** This suite is a product proposal and technical implementation plan. It does not ratify ADR-0007, alter the master WBS, authorize PR #34, apply runtime reconciliation, advance Gate 7, or promote a release.

## 14. Primary repository references

- [Existing Agent Center](https://github.com/Jeruzael/docmonstakrakin/blob/master/src/components/AgentCenterView.tsx)
- [Existing agent execution routes](https://github.com/Jeruzael/docmonstakrakin/blob/master/server.ts)
- [Existing types](https://github.com/Jeruzael/docmonstakrakin/blob/master/src/types.ts)
- [Project state persistence](https://github.com/Jeruzael/docmonstakrakin/blob/master/server/projectPersistence.ts)
- [Local-authentication WBS registration candidate, PR #34](https://github.com/Jeruzael/docmonstakrakin/pull/34) (unmerged and blocked; no current auth implementation claimed)
- [Prompt Compiler view](https://github.com/Jeruzael/docmonstakrakin/blob/master/src/components/PromptCompilerView.tsx)
- [Stage B2b2-A ADR-0007](https://github.com/Jeruzael/docmonstakrakin/blob/master/docs/05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md)
