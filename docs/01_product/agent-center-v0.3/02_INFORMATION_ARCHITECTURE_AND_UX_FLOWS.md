# DOCMONSTAKRAKIN | Collaborative Agent Center and Governance Profiles
## 02. Information Architecture and UX Flow Design

**Status:** PROPOSED UX DESIGN v0.2 / SECURITY REVIEW INTEGRATED / NOT IMPLEMENTED  
**Reference:** User-supplied Agent Center screenshot for Atlas Platform Launch (`PRJ-ATLAS-01`).  
**Compatible baseline:** `src/components/AgentCenterView.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PromptCompilerView.tsx` on verified master `75fde2aa3e0d925673fd813cbf9e7f49c4dabb75`.

## 1. Keep the existing application shell

The screenshot already offers a legible left navigation, project selector, compact top bar, card-based metrics, role list, role-details pane, violet agent-run call-to-action, and an execution audit tab. **Refine these rather than restarting UI architecture.** Retain the application's emerald global accent, slate surfaces, violet agent actions, monospace technical identifiers, and sober assurance design. Immersive color is an optional accent, not a replacement for readable evidence.

### Existing left navigation remains authoritative

```text
PROJECT       Home / Projects / Requirements / Architecture / Security & Risk
DELIVERY      Work Management / Repository & Git / Agent Center / Prompt Compiler
ASSURANCE     Standards Registry / Evidence & Audit / Approvals Inbox
INSIGHT       Reports & Export
```

**Proposed within Agent Center, not new global navigation clutter:**

```text
Agent Center
├─ Overview                  human mentions, jobs, blockers, active agents
├─ Agents                    roles, customizable roster, agent inspectors
├─ Conversations             project chat, task threads, mentions
├─ Runs & Evidence           job monitor, existing execution audit log
├─ Workplace                 Simple | Studio 2D | Studio 3D view switch
└─ Workspace Settings        providers, governance info, avatar preferences

Project Settings
└─ Governance & Assurance    SOLO | TEAM | HIGH_ASSURANCE, inherited floors,
                             real human roster, allowable approval policy
```

**Implementation note:** The initial UI may keep the existing two tabs (`Agent Fleet Roles`, `Execution Run Audit Log`) and add Conversations, Mentions and the mode switch incrementally. A full navigation restructure is a later choice, not a dependency for the first usable release.

## 2. Primary page hierarchy

At desktop widths:

- **Left persistent sidebar:** existing application sections, active Agent Center state.
- **Top persistent project bar:** project, global search, actual connectivity/provider assurance, verified signed-in human session, notification bell. An unverified owner session must not be rendered as an authenticated human decision.
- **Agent Center header:** "Your agent workplace", project-specific governance label, provider health, `+ Agent`, `Assign task`, `Prompt Compiler`, `Simple | 2D | 3D` control.
- **Four truthful overview counters:** active real runs; waiting for you; unread mentions; agent/provider health. Historic run count remains accessible, but is not inflated by seeded demo fixtures.
- **Content:** mode-specific middle canvas with shared agents/threads/events.
- **Optional right inspector:** clicked avatar/card's mission, current task, capability grants, output and messages. Same inspector in every mode.
- **Bottom or edge activity drawer:** collapsible live project feed. Can deep-link into a canonical run, task or evidence artifact.

At mobile widths: one main surface, overflow mode selector, agent inspector becomes bottom sheet; 3D defaults off. Live announcements and outstanding approvals remain accessible in list form. All modes provide keyboard and touch alternatives.

## 3. Project onboarding flow

```text
Create / import project
  -> Choose project type (existing profile: web/mobile/etc.)
  -> Choose team setup: Just me | Small team | Organization
  -> Suggested governance mode (SOLO | TEAM | HIGH_ASSURANCE)
  -> Show actual minimum assurance policy / inherited lock
  -> Explicitly confirm mode + initial human accountability
  -> Choose AI operation: Local | Approved cloud | No model
  -> Probe permitted providers; don't upload a project to test cloud silently
  -> Recommend initial agent templates (editable)
  -> Finish: project dashboard + Agent Center welcome
```

If a user clicks **Just me**, make `SOLO` the suggestion, not an unconditional override. If imported project policy mandates independent signers, show `HIGH_ASSURANCE (locked by project policy)` and an explanation. Do not imply naming a virtual Security Officer fills a mandated human slot.

### Governance selection copy

- `SOLO`: "You are the accountable owner. Agents can review and recommend. Your project can allow self-approval with transparent risk records. No independent human approval is implied."
- `TEAM`: "People can review and approve separately. AI agents assist but never count as a second person."
- `HIGH_ASSURANCE`: "Independent humans, verified authority and protected evidence are required for specified actions. Operations block when mandatory controls are missing."

### Profile-change flow

`Settings > Governance & Assurance > View current profile > Proposed change > Impact preview > Confirmable policy decision`.

For a move to a weaker profile, if an organization/legal/charter floor is active, show `BLOCKED_BY_POLICY` and which authority is needed. Agent requests to switch a governance profile create a proposal only. Preserve prior approval classifications when a profile changes; do not relabel history.

## 4. Agent roster creation flow

```text
Agent Center > Agents > + Create agent
  -> Pick template / Blank
  -> Name and functional discipline (e.g., "Mira", "Security")
  -> Pick avatar (simple initials, 2D sprite, optional 3D counterpart)
  -> Choose provider policy: local, approved cloud, deterministic, or manual
  -> Define mission and canonical deliverables
  -> Choose project artifact access from least-privileged grants
  -> Define message/delegation permissions and run budget
  -> Preview prompt/context, data exposure and restrictions
  -> Save as DRAFT / disabled (or activate if permitted)
  -> Agent roster shows status and evidence label
  -> Live enablement requires local session, project membership, scoped agent delegation and durable worker gate; otherwise remain DRAFT / CONFIGURATION ONLY
```

Display **Agent role** separately from **Authority**. An agent named `Lead Architect` can be an advisory technical specialist; it does not become a ratified human Lead Architect. Do not allow identity confusion via avatar design or status label.

## 5. Assigning work and observing progress

```text
Human selects WorkItem, requirement, ADR or risk
  -> Assign to an agent or a multi-agent plan
  -> Show project-scoped context and permissions preview
  -> Verify current owner session, membership, scoped delegation and source-classification policy
  -> Show exact provider endpoint/tenant, model, `ON_DEVICE_VERIFIED` versus `LOCAL_ENDPOINT_UNVERIFIED`, latency/cost cap and output format
  -> Display reviewed context/source digests and require destination-bound cloud consent when applicable
  -> User submits (or explicitly confirms privileged tool scope)
  -> Enforce unique (project, authenticated actor, operation, idempotency token); digest effect-bearing request separately
  -> Same token + same digest = existing job; same token + changed payload = 409, no provider call
  -> Atomically persist first job + idempotency mapping + budget reservation + outbound dispatch intent
  -> QUEUED -> STARTING -> RUNNING (or WAITING_FOR_PROVIDER / BLOCKED_BY_POLICY)
  -> Bounded progress events, artifacts and communication thread
  -> Success, failure, policy block or separately verified local/remote pause/cancel/uncertain provider outcomes
  -> Evidence/Proposal inspector
  -> Human accepts/rejects or creates next governed action
```

A run's status is read from real observed events, not synthesized from a timer or avatar animation. For existing sample records, show `DEMO DATA` and never merge demo status into production metrics.

## 6. Multi-agent conversation flow

### Human-to-agent

`Agent Center > Conversations > #architecture > Type "@Security review this ADR" > Preview shared context > Send`.

The mention creates a classified, durable message and notification only after server-side sender/membership and recipient clearance checks. The message and mention outbox/audit event commit atomically. If permitted, a separate read-only review job may be enqueued under the sender's revocable delegation; mention text never grants new tools. If provider unavailable, show `Message posted; agent waiting for provider`, not `thinking`.

### Agent-to-agent

`Security Agent detects documented issue > posts evidence-linked thread message > mentions @Architect > scheduler checks delegation grant/budget > Architect receives task > posts proposed correction > @TestAgent review request > Human @me escalation`.

Cap the chain. If too many agents reply, prompt `Pause coordination and ask owner`, with a summarized thread; never loop silently. A mention is not an implicit instruction to execute arbitrary tools.

### Everyone

`@everyone` opens a human confirmation showing the **audience permitted by every source ACL plus classification clearance**, scope (#project, #security, all agents), and authorized notification impact. The channel is not an authority upgrade. Even two equally `RESTRICTED` sources can have disjoint audiences; their derived message is visible only to recipients authorized to read **both**. Recipients permitted to discover existence of **every** source but not read content may receive a neutral policy-approved notification with reauthorized link. Recipients forbidden to discover any contributing source receive **no event or pointer at all**, including no badge/caption/count. Agents require an explicit broadcast grant and rate limit.

### Notifications

`Notification bell > @me` displays permitted actionable human asks only when the recipient has current **source-by-source discovery rights**. Preview requires read permission to **every contributing source**, not only classification clearance. Metadata-only push is permitted solely where all sources explicitly allow existence discovery; otherwise send **nothing**, not a generic `restricted update` hint. Each permission check runs before enqueue, delivery and render, including locked-screen and desktop notifications. A notification counts as completed only when its durable event has a recorded resolution; stale sessions cannot read or acknowledge it.

## 6.1. Security-sensitive interaction details for the first production-capable Simple Center

- **Session and membership:** `Sign in` or `Session expired` appears before sensitive shared actions; a project badge shows *verified membership*, not just currently selected project. New agents are `DRAFT` if the local-auth/role-delegation gate is incomplete. The UI never synthesizes an owner session.
- **Delegation preview:** Show sponsor, exact capability grants, project/resource and maximum classification, expiry and revocation status. Changing grants invalidates queued authority; the server rechecks at dispatch and on every read/write.
- **Provider confirmation:** Distinguish `LOCAL_ENDPOINT_UNVERIFIED` from `ON_DEVICE_VERIFIED`. Cloud consent shows canonical provider endpoint/tenant, model, source classes and content digests; invalidate it on edits and retries. Disable automatic cloud fallback.
- **Classified collaboration:** Composer shows highest source class **and intersection of every source ACL** (including uncited inputs), with separate allowed-to-read and allowed-to-discover audiences. Apply both to notifications, search, exports, avatars, counts and captions. A recipient denied existence gets **no pointer/badge**. `@everyone` previews only recipients genuinely authorized for that output.
- **Honest interruption:** The inspector shows **local worker state, separate remote provider state, and cost state**. *Pause after current step* is not provider pause; local worker stop is not provider termination. If cloud processing may continue, show `RESULT_UNCERTAIN` and billing `UNCERTAIN`, never a green `CANCELLED` badge.
- **Manual fallback:** Project management and deterministic checks remain available with no provider or no network; only unavailable execution features are blocked. User-created manual text is attributed to the human, never forged as an AI message.

### 6.2. Three explicit edge flows (v0.3)

- **Reused submit token:** First authorized click creates a job; retrying the same request with the same idempotency token returns that **same** job. Editing attachments/provider/prompt but retaining the token yields `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` with **no** new job/reservation/provider call. Offer `Review changes and submit new request`, which generates a new token and fresh consent after deliberate human action.
- **Multiple source ACLs and invisible existence:** A derived message references source A and source B (same classification but different permitted audiences). Its eligible readers must have rights on **both**; separate `DISCOVER` permission is checked for notifications/captions. A user forbidden to discover source B sees **no message, marker, badge, notification, link or participant count**. A user permitted to discover both but not read may receive neutral content only when the policy explicitly authorizes it.
- **Worker stop while cloud continues:** `Cancel` first records local `CANCEL_REQUESTED` and sends a provider cancel request only if supported. If the worker stops and the provider's termination is unproven, the inspector shows local `STOPPED`, provider `MAY_BE_RUNNING`/`OUTCOME_UNKNOWN`, cost `UNCERTAIN`, and public `RESULT_UNCERTAIN`; any late result is quarantined. No UI animation may claim `CANCELLED` or cost refunded.

## 7. Three presentation modes, one interaction model

| Feature | Simple (default) | Studio 2D | Studio 3D (later) |
| --- | --- | --- | --- |
| Information density | High | Medium, spatial | Lower, spatial/immersive |
| Agent list and status | Full cards/table | Avatars + optional roster rail | Avatars + accessible roster panel |
| Current task | Inline + inspector | At workstation + inspector | At virtual station + inspector |
| Real published messages | Chat panel | Short caption above agent; open thread | Short caption/overlay; open thread |
| Click/select agent | Card | Avatar or keyboard accessible list | Mesh/avatar or keyboard accessible list |
| Actions | Message, Assign, Pause-if-supported / Pause after current step, Request Cancel, Evidence, Permissions | Same shared action menu and state semantics | Same shared action menu and state semantics |
| Audit, controls and approvals | Always accessible | Always accessible via side panel/deep link | Always accessible via side panel/deep link |
| Device requirements | Minimal | Canvas/SVG/DOM | WebGL capable, optional assets |
| Offline | Yes | Yes when assets are installed | Yes when assets are installed |
| Reduced motion | Default calm | Static sprites | Static pose / fallback to 2D |

A user's current selection follows mode changes: `selectedAgentId`, `selectedThreadId`, `selectedRunId` and scroll/deep-link anchors remain stable. The mode is a per-user presentation preference, not a governance setting.

## 8. Studio 2D room design

Recommended first scene: **top-down clean studio** with subtle grid, desks and small status indicators. Avoid pixel-art novelty as the only skin. Work zones:

| Station | Functional purpose | Click behavior |
| --- | --- | --- |
| Security Desk | Threat models, attack surface, risk review | Open Security agent inspector or related risk |
| Architecture Table | ADRs, boundaries, design decisions | Open ADR thread and assigned architect |
| QA Lab | Tests, evidence, verification | Open run/test evidence |
| Requirements Wall | Adaptive Questionnaire, traceability | Open question/requirement threads |
| Documentation Desk | Controlled docs and source references | Open document proposals |
| Operations Console | Scheduler, provider statuses, escalations | Open task queue, budgets and waiting-human list |
| Human Desk / Your Inbox | `@me`, decisions, role assignments | Open mentions and Approvals Inbox |

**What motion means:** Walking between stations is an optional visual representation of an event such as `TASK_ASSIGNED` or `RUN_STARTED`, not proof of invisible cognition. Short caption bubbles contain only durable **classification-permitted** excerpts for the current viewer or neutral state labels; `@everyone`, model-derived summaries, restricted artifact snippets and locked-screen captions require the same server-authorized filtering. Never expose private prompts, chain-of-thought or unpublished internal deliberations.

## 9. Studio 3D design, strictly optional

First version should be a **lightweight stylized diorama**, not an open-world game. Use a fixed angled/isometric camera initially, keyboard accessible station list, capped frame rate, paused off-screen animation, and prepackaged avatar assets. Avoid requiring external models, network textures or cloud game infrastructure. Degrade to 2D on WebGL loss and to Simple on reduced device capability. 3D adds no new commands or permission scopes.

3D affordances: subtle avatar gestures tied to state transitions, station highlights, speech overlays, room overview and one-click focus on pending escalations. Users should never have to navigate physically to reach Approvals Inbox.

## 10. Agent click menu and inspector

**Agent card/avatar primary action:** open inspector. Secondary quick menu:

```text
Mira (Security Agent)       AI_DELEGATED · LOCAL_MODEL · RUNNING
────────────────────────────────────────────────────────────
Message Mira                      opens associated conversation
Assign / Request review           requires context and grant preview
Pair with another agent           drafts bounded collaboration task
Open current task                 canonical WorkItem/ADR/risk link
View evidence & run history       verified vs simulated clearly labeled
Inspect permissions & model       read-only policy/credential summary
Pause after safe checkpoint       `PAUSE_REQUESTED` -> scheduler `PAUSED_AT_CHECKPOINT`; provider state separate
Request cancel                   `CANCEL_REQUESTED`; do not pretend provider stopped
Edit agent                        role admin, not human governance admin
Escalate to human                 emits @me request, not autoapproval
```

Avatar hover shows name and neutral status; the accessibility equivalent is a focusable roster item with text. Bubbles offer `Open thread`, `Mute noncritical`, `Show source` actions when applicable.

## 11. Information design: status and assurance

| Category | Allowed displayed labels | Meaning |
| --- | --- | --- |
| Presence | `IDLE`, `QUEUED`, `RUNNING`, `WAITING_FOR_PROVIDER`, `WAITING_FOR_YOU`, `BLOCKED`, `FAILED`, `PAUSED` | Event-derived; never infer from chat silence |
| Runtime | `LOCAL_MODEL`, `APPROVED_CLOUD`, `DETERMINISTIC`, `MANUAL`, `DEMO` | Actual execution origin |
| Functional role | `AI_DELEGATED_ARCHITECT`, `AI_DELEGATED_SECURITY`, `AI_DELEGATED_TESTER`, etc. | Job specialty only |
| Human decision | `SOLO_OWNER_APPROVED`, `TEAM_HUMAN_APPROVED`, `INDEPENDENT_HUMAN_APPROVED` | Derived from actual authenticated decision and ratified policy; `LOCAL_SESSION_ACKNOWLEDGED` is not a cryptographic signature |
| Review | `AI_REVIEWED`, `HUMAN_REVIEW_PENDING`, `NO_INDEPENDENT_HUMAN_REVIEW` | No AI-to-human equivalence |
| Data exposure | `ON_DEVICE_VERIFIED`, `LOCAL_ENDPOINT_UNVERIFIED`, `CLOUD_APPROVED_CONTEXT`, `NOT_SENT` | Distinguish actual verified egress boundary from user-configured localhost; explicit per-destination consent |

**Critical event states must use text and icon, not only color or animation.** Avoid misleading activity metrics: measured durations/tokens require actual telemetry; demo runs count only in a separate example-data view.

## 12. Empty, error and transitional states

- **First launch:** "Your workspace is ready. Add your first agent or continue manually." Provide `Create agent` and `Use project tools without AI` equally visible.
- **No AI models installed:** "No AI provider available. Your project and deterministic checks still work." Provide `Configure local model` and `Continue manually`. Don't replace content with a blank loading spinner.
- **Local model initializing:** `WAITING_FOR_PROVIDER` with health/retry; no fabricated token stream.
- **No human available for optional solo review:** Show owner acknowledgment actions only if permitted under current solo governance policy.
- **Mandatory team/high-assurance approver absent:** Show `BLOCKED_BY_POLICY`, missing actual role and an appropriate escalation/appointment path. Do not suggest spawning another agent as a substitute.
- **2D/3D crash:** Automatically render Simple while preserving state, with unobtrusive explanation.
- **Agent coordination storm:** Stop new delegated runs; show `Collaboration paused, reply limit reached` with all messages retained.
- **Privacy boundary:** Before cloud fallback, show exact provider/destination and reviewed context fingerprint, source classes, scope, token cap and consent expiry; re-prompt after any queued-context or destination change. Respect previous denial.
- **Unknown local egress:** A localhost model endpoint without proved runtime egress restriction shows `LOCAL_ENDPOINT_UNVERIFIED` and a plain-language explanation; a strict local-only policy blocks the run.
- **Lost authorization:** Expired session, revoked agent grant or removed project membership blocks message send, run dispatch, search, export and speech-caption reads; show a reauthenticate or ask-owner action.
- **Uncertain execution:** If provider acceptance may have happened before a crash, show `RESULT_UNCERTAIN` and potential cost, offering inspect/reconcile, **not** a blind Retry.
- **Pausing and cancellation:** Show `PAUSE_REQUESTED` or `CANCEL_REQUESTED` until acknowledged; label unsupported provider pause `Pause after current step`, not `Paused`.
- **Demo records:** Visible `SIMULATED DATA` and not merged with real run totals or approval evidence.

## 13. Representative task flows (acceptance paths)

| ID | Starting point | Target outcome | Failure behavior |
| --- | --- | --- | --- |
| UX-FLOW-01 | Create solo project | Explicit profile + no second-human requirement for solo-permitted actions | Existing protected policy floor stays locked |
| UX-FLOW-02 | Configure 3 functional agents | Roster, grants, budget and provider shown | No implicit privileged actions |
| UX-FLOW-03 | Type `@Architect` in task thread | Durable mention only if recipient may discover **every** source; otherwise no notification | Recipient can't see inaccessible artifact or infer hidden source existence |
| UX-FLOW-04 | Security agent mentions `@me` | Notification deep-link to evidence and decision | Offline notification retained |
| UX-FLOW-05 | Select `Studio 2D` | Same agent selection and messages spatially displayed | Fallback to Simple preserves state |
| UX-FLOW-06 | Select `Studio 3D` | Optional scene and same task/agent inspector | Unsupported WebGL -> accessible 2D/Simple |
| UX-FLOW-07 | Turn off all AI providers | Manual PM and deterministic functions continue | Queued AI tasks show unavailable, not fabricated results |
| UX-FLOW-08 | Attempt AI-agent human signoff | Denied and audited | No trusted approval issued |
| UX-FLOW-09 | Switch Team to Solo under mandatory floor | Blocked with policy explanation | Never silently downgrades |
| UX-FLOW-10 | Click "View Evidence" on completed run | True run ID, provider, outputs, validations, source records | Unknown provenance labeled unverified |
| UX-FLOW-11 | Reply to restricted agent thread or view avatar caption | Read-authorized viewer sees permitted content; discover-only recipient sees neutral metadata if approved; discover-denied recipient sees **nothing** | No leaked source existence or paraphrase through bubbles, mentions, search, unread counts or notifications |
| UX-FLOW-12 | Pause/cancel while provider request is active | Request state and acknowledgment/uncertainty are visible | Late response quarantined; no false cancellation or assumed refund |
| UX-FLOW-13 | Enqueue task, crash and restart | Queue, budget reservation, message and audit ledger reconcile as one durable transaction | Unknown provider acceptance remains `RESULT_UNCERTAIN`; no blind duplicate billing |
| UX-FLOW-14 | Local endpoint proxies to cloud or redirects | `LOCAL_ENDPOINT_UNVERIFIED`, blocked in strict local-only mode | Outbound deny test covers app **and** inference runtime |
| UX-FLOW-15 | Queued cloud task context or endpoint changes | Reconfirm exact scope, digest and destination | Original consent cannot be reused |

## 14. UX rollout recommendation

Implement governance and truthful runtime labels first, then custom agents and collaboration threads, then the evolved Simple Center, then 2D, and 3D last. Instrument task completion and comprehension, not arbitrary time spent staring at avatars. Validate with solo users, small teams and accessibility users before expanding scene complexity.

**Design verdict:** Proposed for user/human design review only. No implementation or canonical WBS change is authorized by this document.
