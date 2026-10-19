# DOCMONSTAKRAKIN | Collaborative Agent Center and Governance Profiles
## 03. Product Requirements Document (PRD)

**PRD ID:** `PRD-COLLAB-AGENT-WORKPLACE-001`  
**Status:** DRAFT / SIX ORIGINAL FINDINGS PLUS THREE FOLLOW-UP AMBIGUITIES SPECIFIED IN DESIGN / PRODUCT REVIEW REQUIRED / NO GOVERNANCE RATIFICATION  
**Version:** 0.3 focused-contract revision | 2026-10-19  
**Owner:** Project Lead (decision pending)  
**Related:** `01_PRODUCT_AND_ARCHITECTURE_SPEC.md`, `02_INFORMATION_ARCHITECTURE_AND_UX_FLOWS.md`, `04_TEXT_UI_SCREEN_MOCKUPS.md`  
**Repository reference:** `Jeruzael/docmonstakrakin`, inspected `master` `75fde2aa3e0d925673fd813cbf9e7f49c4dabb75`.

## 1. Executive summary

DOCMONSTAKRAKIN is a local-first agentic secure development control plane. Evolve its existing Agent Center into a **collaborative, observable workplace** that helps solo developers operate a functional team of specialized AI agents, supports real human teams, and preserves independently required controls for high-assurance projects. Users can view the same agents and work in an efficient Simple interface, an engaging Studio 2D scene, or an optional Studio 3D scene.

The product's value must survive missing AI connectivity: manual project tracking and deterministic A-SSDLC features continue to work without any model. A configured local model can support agent activities offline. Cloud AI requires explicit provider consent and scoped data access.

## 2. Problem statement

Existing software project tools separate planning from AI execution. Solo developers have no human teammates to assign architecture, security, QA or documentation responsibilities to, even though specialist agents could help. Current agent experiences often hide who is doing what, blur AI review with human approval, generate noisy disconnected chats, and become unusable when cloud APIs fail. A visual office can improve understanding but must not become decorative theater or an audit bypass.

The current repository's Agent Center shows role cards and run audit entries, but the existing `POST .../agents/:agentId/run` route currently emits predefined demonstration summaries and metrics, not independently verified production inference. This PRD explicitly requires those demo facts to be labeled truthfully during migration.

## 3. Users and jobs-to-be-done

| Persona | Primary job | Key constraints |
| --- | --- | --- |
| Solo owner-developer | "Let me create a skilled virtual team while I remain accountable for project decisions." | One real human, potentially offline; simple self-approval when legitimate policy permits |
| Small engineering team | "Let us see human and agent work in one place without losing individual accountability." | Multiple actors, distinct reviews and limited delegation |
| High-assurance lead/security operator | "Prove who authorized and verified every protected transition." | Ratified identity/quorum, trust-root and protected evidence prerequisites |
| Accessibility/low-power user | "Let me do all critical work without animation or WebGL." | Keyboard, reduced motion, Simple mode |
| Local-only privacy-focused user | "Help me work without shipping code or secrets to a remote provider." | On-device model or deterministic/manual mode |

## 4. Goals and non-goals

### Product goals

- Let users select a truthful, project-appropriate governance mode separate from existing app-type project profiles.
- Support customizable AI-delegated specialties without granting AI human voting authority.
- Give agents durable, evidence-linked, permission-checked messaging with human/agent mentions and bounded coordination.
- Make operational status observable and attributable across Simple, 2D and 3D.
- Work as a genuine project management and A-SSDLC application when zero models are available.
- Retain a clear audit trail of runs, reviews, proposals, notifications, source artifacts and human decisions.

### Explicit non-goals for first release

- General autonomous repository write access or production WBS registration authority.
- Agent-generated human identities, keys, fake approval quorum or silent mode downgrade.
- A fully networked multiplayer 3D world, persistent real-time avatar positioning or game-like progression metrics.
- Unbounded AI-to-AI conversations, unattended cloud data transfer, or synthesized hidden chain-of-thought.
- Changes to Gate 7, release, canonical WBS task IDs or existing historical receipts as part of this PRD.

## 5. Scope and priorities

**P0-CONFIGURATION: Ship-ready UI/scaffolding, not operational approval or execution.** Governance profile display and locked states, actor/assurance labeling, model status, manual fallback, draft agent roster, explicit demo labels, improved Simple Center and migration/negative UI tests.

**P0-LIVE (release gate, BLOCKED until prerequisites pass):** Authenticated local human sessions, per-project membership, revocable agent delegation, atomic background job/outbox persistence, safe provider boundary, source-classified conversations/mentions, real run lifecycle, and evidence trace. Do not describe P0 configuration success as a functioning production approval system. The authentication/delegation workstream overlaps unmerged PR #34 and needs governed ownership/compatibility decisions before activation.

**P1: After operational foundation.** Studio 2D, avatar selection, real-message caption bubbles, spatial task stations, synchronized inspector, richer cooperative visualization and presence projection.

**P2: Optional later enhancement.** Studio 3D, adjustable camera, richer avatar gestures, environment themes, advanced scene layouts. Only after accessible 2D and Simple coverage pass.

## 6. Functional requirements and acceptance criteria

| ID | Priority | Requirement | Minimum acceptance evidence |
| --- | --- | --- | --- |
| GOV-01 | P0 | Store a separate `governanceProfile` (`SOLO`, `TEAM`, `HIGH_ASSURANCE`) per project, with provenance and inheritance of mandatory policy floors | Tests prove project type profile is unchanged and locked floors cannot be lowered |
| GOV-02 | P0 | Solo owner may self-approve only within explicitly authorized solo policy, with risk/evidence acknowledgment | Record uses `SOLO_OWNER_APPROVED`; no `INDEPENDENT_HUMAN_APPROVED` without genuine independent human |
| GOV-03 | P0 | Team and high-assurance requirements count distinct verified people, never agent or alias count | Two agent roles or two keys under one person cannot fill two required-human slots |
| GOV-04 | P0 | Profile changes require actor authority, audit and impact preview; no automatic downgrade from team-size change | Unauthorized changes denied and logged; historical approvals retain original classification |
| GOV-05 | P0 | Support only policy-authorized `SOLO_LOCAL` owner decisions with separate acknowledgment/signature provenance | Authenticated `LOCAL_SESSION_ACKNOWLEDGED` never counts as `OWNER_CRYPTO_SIGNATURE_VERIFIED`; SecretStore does not substitute for a human signing ceremony; no independent time/quorum claim |
| AGT-01 | P0 | Create/edit/disable custom agent role from templates with stable identity, mission, capabilities, provider preferences and budgets | Agent persists across refresh/restart/project change; cannot claim human authority |
| AGT-02 | P0 | Provider router recognizes approved local AI, approved cloud AI, deterministic engines and no-model/manual | Offline no-model path never attempts unauthorized cloud request |
| AGT-03 | P0 | Task run has durable attempt/dispatch lifecycle, pause and cancel requests, provider acceptance uncertainty and provenance | Can trace each attempt, accepted/unknown provider execution, cancellation acknowledgment and observed cost without exactly-once provider claims |
| AGT-04 | P0 | Agent grants are least privilege, task scoped, and checked at action time | Mention, avatar click and model prompt cannot escalate permissions |
| AGT-05 | P0 | Clearly label legacy seeded Agent Center execution summaries/metrics `SIMULATED_DEMO`, separate from real evidence | Demo response never increments real activity/verification metrics |
| COM-01 | P0 | Durable project-scoped classified channels and task/artifact threads, human/AI messages, source lineage and audience policy | Source-derived labels and notifications commit atomically; evidence references resolve only to current authorized recipients |
| COM-02 | P0 | Support `@me`, `@agent`, `@role`, controlled `@everyone`, unread notices and reply actions | Mentions notify intended authorized actors only; `@everyone` bounded |
| COM-03 | P0 | Enforce agent-to-agent delegation budgets, max hops, idempotency and escalation | Cyclic collaboration stops with explanation; no resource runaway |
| COM-04 | P0 | Human escalation uses Approvals Inbox / decisions without allowing AI to vote as a human | Human response audit distinguishes proposal, recommendation, decision |
| UX-01 | P0 | Extend existing role cards, inspector, run log, and Prompt Compiler navigation in Simple mode | Current functionality retained with improved provenance and messages |
| UX-02 | P0 | One event-driven presence projection shared by every view | Switching modes preserves thread/agent/run selection and exact states |
| UX-03 | P0 | Worklist, mentions and approvals usable with keyboard, screen reader and reduced motion | Automated accessibility tests and scripted user walkthroughs |
| UX-04 | P1 | Top-down 2D scene with avatar/caption/station interactions | Captions map to real allowed messages or logged state transitions |
| UX-05 | P2 | Optional 3D scene uses same data and inspector, degrades to 2D/Simple | 3D runtime failure does not change project state or lose work |
| OFF-01 | P0 | No-model mode provides complete manual project management and deterministic A-SSDLC tools | All core navigation, artifacts and policy checks usable with no provider |
| OFF-02 | P0 | Offline local inference differentiates configured localhost endpoints from verified on-device execution | App **and** model runtime have outbound network blocked in tests; redirects/proxies/rebinding denied; no unproven `ON_DEVICE_VERIFIED` label |
| OFF-03 | P0 | Cloud model transfer needs exact destination, model and immutable reviewed context/digest consent | Queued context, source label, provider endpoint, tenant or retry change revokes old consent; no automatic cloud fallback |
| OFF-04 | P0 | Distinguish SOLO_LOCAL, TEAM_MANAGED and HIGH_ASSURANCE_EXTERNAL authority for offline protected operations | Offline solo-scoped actions can proceed where policy permits; high-assurance protected operations remain blocked without required trust |
| AUTH-01 | P0-LIVE gate | Authenticate immutable local human principals and verify revocable server-side sessions | Spoofed identity/header, expired/revoked session and CSRF fail; loopback alone never grants identity |
| AUTH-02 | P0-LIVE gate | Enforce project membership, role version, capability allow/deny and classified resource access on every API and subscription | Nonmember, wrong-project, revoked role and unauthorized cross-project read/write/mention denied |
| AUTH-03 | P0-LIVE gate | Bind agent principals to a human sponsor with explicit expiring/revocable per-project delegation | Two agents cannot become human approvers; altered grant, retired sponsor and stale run authorization fail |
| AUTH-04 | P0-LIVE gate | Require local-auth/role-delegation milestone (DMK-209–214 or separately approved equivalent) before live messaging/dispatch | Before implementation, UI permits only draft/demo/blocked preview, not unguarded production routes |
| DUR-01 | P0-LIVE gate | HTTP and background workers share a crash-safe transaction store; atomic enqueue of task, idempotency, audit, budget reservation and outbox | Failpoint at every stage leaves no orphan job, lost mention, phantom reservation or unauthorized dispatch |
| DUR-02 | P0-LIVE gate | Leased/fenced dispatch and idempotent **local commit** under unique `(project, server-resolved actor, operation, token)` key with immutable separate request digest; external acceptance tracked separately | Same token+same digest returns same job; same token+different digest yields `409` without new job/budget/outbox/provider call; crash after provider acceptance records `RESULT_UNCERTAIN` |
| DUR-03 | P0-LIVE gate | Atomic result/message/classification/mention/audit/budget settlement publication and restart recovery | Restart between result and publish cannot leak incomplete messages or duplicate notifications |
| DUR-04 | P0-LIVE gate | Preserve billing uncertainty and trace per-attempt provider IDs when outcomes are unknown | Never promise once-only cloud charges or refund merely because cancel timed out |
| DUR-05 | P0-LIVE gate | Reject reused idempotency token with different content; enforce unique scoped key and retain digest/tombstone for the recovery horizon | Race and changed-body tests return `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`, zero second reservation/job/provider call; retry requires new authorized token |
| DATA-01 | P0-LIVE gate | Outputs inherit highest-classified input **and every source-specific ACL**, including all uncited prompt/tool inputs | Derived artifacts retain complete provenance; a recipient must have read rights to every contributing source regardless of equal classifications |
| DATA-02 | P0-LIVE gate | Enforce source-by-source **read and discover-existence** rights at creation, read, push, mention, search, export and visual render | Discover-denied recipient sees **no pointer, badge, unread count or notification**; metadata-only permitted solely when existence access to all sources is explicit |
| DATA-03 | P0-LIVE gate | Explicitly governed declassification with human scope, before/after digests and audit | Sanitization or agent summary alone cannot declassify; history preserved |
| DATA-04 | P0-LIVE gate | Authorize derived outputs against intersection of **all** contributing source ACLs and deny-over-allow; re-evaluate after ACL changes | Two same-`RESTRICTED` sources with different audiences cannot leak combined summary; denied existence cannot be inferred; ACL revocation invalidates caches/captions |
| PROV-01 | P0-LIVE gate | Canonicalize local model endpoint and verify runtime egress / proxy / redirect boundary | Unconfined localhost model is `LOCAL_ENDPOINT_UNVERIFIED` and blocked by local-only strict policy |
| PROV-02 | P0-LIVE gate | Bind cloud consent to exact endpoint/tenant/model and reviewed task/context hashes and classification | Pending task edits, changed provider or labels, consent expiry/revocation or retry require reconsent |
| PROV-03 | P0-LIVE gate | Prove offline isolation for app process and local inference runtime with outbound denied | Local IPC works and no public network requests observed across both processes |
| RUN-01 | P0-LIVE gate | Define legal user-facing run states backed by separately stored **local-worker**, **remote-provider** and **billing** states | Local worker stop cannot imply provider termination; unsupported provider pause is checkpoint-only; late responses quarantined, never silently published |
| RUN-02 | P0-LIVE gate | Retry creates new attempt and revalidates membership, delegation, content and consent | Changed task or expired permissions block retry without loss of history |
| RUN-03 | P0-LIVE gate | Track provider cancellation-request acknowledgement separately from verified remote termination and local worker stop | Kill local worker while synthetic provider continues: `RESULT_UNCERTAIN` and `UNCERTAIN` cost; no false `CANCELLED`, late result quarantined |
| GOV-06 | P0 | Use canonical `TEAM_HUMAN_APPROVED` across UI, API and documents; preserve `SOLO_OWNER_APPROVED` and independent human semantics | Single label glossary, no `HUMAN_TEAM_APPROVED` alias accidentally interpreted as separate authority |
| AUD-01 | P0 | Event history differentiates human, AI, deterministic, simulated and manual origins | Every event/run displays correct origin; audit includes immutable ref/digest |
| AUD-02 | P0 | Import/export, reconnect and restart preserve event identity and do not import approval authority | Project package imported approvals remain historical, fresh local signoff as required |
| SEC-01 | P0 | Enforce source trust and data-loss prevention across prompts, messages and tool boundaries | Agent-injected instructions cannot change grants or access secrets |

**Definition of done for P0:** Every P0 requirement has its test(s), audit/evidence assertions, keyboard/manual UX walkthrough, and reviewer decision. Merely writing a design or a mock scene does not count as implementing a requirement.

## 7. User stories with ready-to-test scenarios

### US-01 | Solo owner sets up a virtual team

**As** a solo owner, **I want** to create an Architect, Security and QA agent, **so that** I can distribute functional work without hiring imaginary humans.

**Given** a project with no mandatory independent-human floor, **when** I choose `SOLO` and create three AI roles, **then** they appear as `AI_DELEGATED` with separate granted scopes, and the owner remains the only human actor. **And** future owner decisions may be labeled `SOLO_OWNER_APPROVED` only where the solo policy allows.

### US-02 | Human quorum cannot be faked

**Given** a protected operation requiring two independent humans, **when** the owner assigns Security Officer and Architect functional labels to two agents, **then** the human approval gate stays blocked and identifies the absent human slot.

### US-03 | User remains productive with no model

**Given** no local model, no cloud credentials, and no network access, **when** I open the project, **then** I can create requirements, work items, ADRs, risk notes and manual evidence and use deterministic policy checks. AI runs display `WAITING_FOR_PROVIDER` or `DISABLED`, not false success.

### US-04 | Local provider without cloud exfiltration

**Given** a healthy user-configured local model and network denied, **when** I assign Security Agent a read-only ADR review, **then** the run uses that local endpoint, stores provider provenance and returns an evidence-linked proposal without cloud requests.

### US-05 | Security agent mentions Architect

**Given** Security Agent has bounded coordination permission, **when** it publishes a sourced issue and mentions `@Architect`, **then** a durable thread message, mention notification and permitted review job are created. **And** the recipient sees only accessible artifacts.

### US-06 | Human is escalated

**Given** an agent review flags an unresolved risk, **when** it mentions `@me`, **then** an actionable notification opens the exact risk and discussion, and no decision is applied until the authorized human responds.

### US-07 | Infinite agent loop is stopped

**Given** two agents repeatedly mention each other, **when** max coordination hops or budget is exceeded, **then** the scheduler stops the next run and records `COLLABORATION_LIMIT_REACHED` with an escalation to the owner.

### US-08 | Visual selection works in all modes

**Given** a selected QA agent and open run inspector, **when** I switch Simple -> Studio 2D -> Simple, **then** the same agent, run, thread, permissions and logs remain selected, without duplicating any message.

### US-09 | Speech bubbles are honest

**Given** an agent has no published message and no active run, **when** I view the 2D studio, **then** its avatar shows `Idle` and no invented "thinking" text. **When** a permitted real message is posted, **then** an optional shortened caption appears with a link to the source thread.

### US-10 | Unsupported 3D does not break oversight

**Given** WebGL is unavailable, **when** the user attempts Studio 3D, **then** the app offers Studio 2D or Simple automatically and keeps critical decisions reachable.

### US-11 | Bounded cloud fallback

**Given** a local model has failed and the task contains confidential source code, **when** a cloud provider is available, **then** the project asks for explicit permission and displays which context would leave the device. No cloud call occurs after rejection.

### US-13 | Offline solo local authorization is truthfully limited

**Given** a personal project has an explicit authorized `SOLO_LOCAL` policy, **when** its owner authorizes an in-scope local decision offline, **then** the system records local actor provenance and evidence hashes and displays `SOLO_OWNER_APPROVED` with the limitations of local timestamps and rollback protection. **Given** a protected high-assurance registration instead, **when** required external trust or a human approver is missing, **then** that registration remains blocked despite the presence of local models or other AI agents.

### US-12 | Proposed activity is not governance approval

**Given** Security Agent generates an AI review and a deterministic verifier passes, **when** a human signoff is required, **then** the approval remains pending until the proper human action is recorded. No agent message or visual animation can transition it.

### US-14 | Anonymous actor cannot send or dispatch

**Given** an existing project is selected and a user is not authenticated, **when** they forge an agent message or `POST` a run, **then** the server denies it even on localhost. With an authenticated session but no project membership, reads, messages, notifications, event feeds and dispatches also deny. Agents cannot spoof sender IDs or self-grant human approval.

### US-15 | Crash between external acceptance and durable result

**Given** a background worker may already have submitted work to a cloud provider, **when** it crashes before recording acceptance or output, **then** recovery shows `RESULT_UNCERTAIN`, the budget remains accurately reserved/uncertain and no automatic duplicate provider request occurs. Durable message, mention, audit and output publication remain atomic.

### US-16 | Cloud destination/context changes after queue

**Given** an exact destination/model/context consent was recorded, **when** an attachment, data class, endpoint, tenant or retry payload changes before dispatch, **then** old consent becomes invalid and no cloud request occurs until reviewed again.

### US-17 | A localhost model actually proxies remotely

**Given** a model responds through localhost but the runtime attempts public-network egress, **when** the offline/on-device boundary test denies internet to both app and model runtime, **then** no external request succeeds and UI cannot claim `ON_DEVICE_VERIFIED`. Strict local-only runs stay blocked until verified.

### US-18 | Sensitive source paraphrased by agent

**Given** an agent reads two equally RESTRICTED documents with disjoint allowed audiences and paraphrases both without citations, **when** it mentions `@everyone` or populates a 2D caption/desktop notification, **then** the resulting message is readable only by the intersection of their permitted audiences. A recipient barred from discovering either source receives **no event, pointer, unread count or caption**; neutral metadata is allowed only where existence rights to every source are explicitly granted.

### US-19 | Pause, cancel and late provider response

**Given** a cloud provider does not support pause, **when** the operator requests Pause, **then** UI offers scheduler checkpoint semantics, not provider pause. **When** cancellation is requested and the local worker stops while cloud execution continues, **then** UI shows local `STOPPED`, remote `MAY_BE_RUNNING`, `RESULT_UNCERTAIN` and cost `UNCERTAIN`, not `CANCELLED`. An accepted cancel API call without remote-termination evidence has the same uncertain outcome; late output is quarantined. A retry is a new attempt requiring fresh authorization and consent.

### US-20 | Solo owner acknowledgment is not a signing ceremony

**Given** a local owner logs into an allowed SOLO project, **when** they acknowledge an in-scope decision, **then** evidence shows `SOLO_OWNER_APPROVED` + `LOCAL_SESSION_ACKNOWLEDGED` and exact subject digest. It must **not** display `OWNER_CRYPTO_SIGNATURE_VERIFIED` unless a dedicated key enrollment, consent display and cryptographic verification actually occurred.


### US-21 | Reusing a token with edited work cannot create a second job

**Given** an authorized actor has enqueued a task with idempotency token `K` and request digest `D1`, **when** the same actor retries with token `K` and the same canonical request, **then** the same existing job is returned without a new reservation or provider call. **When** a changed attachment/provider/prompt produces digest `D2` under token `K`, **then** the server returns `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`; no second job, reservation, outbox or provider call occurs, even with concurrent requests.

### US-22 | Identical classifications do not override disjoint source ACLs

**Given** two RESTRICTED sources permit different audiences, **when** a model derives a shared summary, **then** read permissions require access to **both** sources. Recipients denied source **existence** receive no notification, link, badge, avatar caption or search result. Revoking one source permission immediately removes derived output access, including cached and exported views. Neutral metadata is never issued without explicit discover permission to every source.

### US-23 | Stopping a local worker does not cancel remote execution

**Given** a provider accepts a request and keeps running after its local worker is terminated, **when** the owner requests cancellation, **then** the persisted local state becomes `STOPPED`, the remote state stays `MAY_BE_RUNNING` or `OUTCOME_UNKNOWN`, billing remains `UNCERTAIN` and UI shows `RESULT_UNCERTAIN`. If the provider later returns output, it is quarantined until separately reviewed. `CANCELLED` requires verified non-dispatch or termination proof.

## 8. Key screens in scope

| Screen ID | Screen | Outcome |
| --- | --- | --- |
| S01 | Project creation + governance chooser | Clear personal/team/assurance setup and floor preview |
| S02 | Simple Agent Center | Current screen modernized with roster, running jobs, channels and statuses |
| S03 | Custom Agent Editor | Mission, avatar, provider, tool grants, budgets and output contract |
| S04 | Conversation / mention thread | Evidence-linked messages and bounded coordination |
| S05 | Task dispatch and run inspector | Provider scope preview, real execution, diagnostics and evidence |
| S06 | Studio 2D | Avatar/station scene with genuine activity |
| S07 | Studio 3D | Optional spatial view of same state, accessible fallback |
| S08 | No-model/manual mode | Functional PM screen and honest offline status |
| S09 | Team/High-assurance review | Missing human/independent approvals shown explicitly |
| S10 | Mentions + Approvals Inbox | Human decision and agent collaboration not confused |

The companion text mockup supplies screen-by-screen layouts and example interactions.

## 9. Measurable success indicators (candidate targets, validate via beta)

- **Truthful origin:** 100% of visible run records and captions distinguish real/model, deterministic, simulated or manual origin in acceptance tests.
- **Governance integrity:** Zero successful attempts in negative tests to count an AI as required independent human approval or bypass a locked policy floor.
- **Offline usability:** 100% of a documented manual project workflow passes with cloud and local models disabled.
- **Task discoverability:** In usability testing, a new solo user can identify who is working on what and open relevant evidence without knowing agent IDs.
- **Communication:** All `@me` mentions and explicit approval asks survive restart; unauthorized mention recipients cannot fetch restricted content.
- **Reliability:** Persisted jobs do not silently turn into success after crash; scoped token reuse has deterministic identical/different-digest handling; local and remote cancellation plus cost states are separately evidenced.
- **Performance:** Set and validate operational device targets from beta hardware. Don't claim a fixed 3D frame rate before profiling.
- **Engagement:** Compare user-rated usefulness and clarity between Simple and 2D, not total avatar screen time.

Metrics collection should be local/opt-in and privacy-conscious. No hidden provider prompt/content telemetry.

## 10. Candidate delivery epics and task decomposition

**Planning IDs below are proposal placeholders, NOT canonical DMK WBS IDs.** Registering real tasks requires separate authorized WBS governance; existing PR #34 remains blocked.

| Epic | Candidate implementation slices (bounded PRs) | Dependencies | Output |
| --- | --- | --- | --- |
| EPIC-C1: Governance & truth | C1.1 Mode and assurance display; C1.2 locked policy configuration/fixture; C1.3 legacy-demo provenance/migration; C1.4 owner acknowledgment vs signature labels | Current charter, separate policy decisions | Truthful settings and blocked states; **not** production approval |
| EPIC-C2: Provider/runner | C2.1 On-device egress verification & consent; C2.2 durable transaction/outbox and worker recovery; C2.3 pause/cancel/retry/uncertain-billing states | C1 plus **EPIC-CA authentication** | Real execution only after fail-closed auth and transaction tests |
| EPIC-C3: Agents and messages | C3.1 Agent directory/edit; C3.2 source-classified threads/mentions/exports; C3.3 delegation, recipient filtering and privacy tests | C1-C2 and **EPIC-CA** | Authenticated, durable, classified collaboration core |
| EPIC-CA: Auth/session/delegation prerequisite | CA.1 Session and project membership; CA.2 deny-by-default scoped RBAC; CA.3 agent principal/sponsor delegation and revocation; CA.4 negative tests and route inventory | Existing local-authentication program DMK-209–214 / PR #34 **unmerged**; separately authorize ownership/compatibility | Hard prerequisite for C2/C3 live endpoints, not an implied WBS task registration |
| EPIC-C4: Simple Agent Center | C4.1 roster/inspector; C4.2 conversation/mentions; C4.3 run/evidence UX + accessibility | C1-C3 | Reliable first release |
| EPIC-C5: Studio 2D | C5.1 spatial layout; C5.2 state-presence/avatars; C5.3 bubble/source linking and fallback | C3-C4 | Optional fun workplace |
| EPIC-C6: Studio 3D | C6.1 lazy-loaded viewer; C6.2 equivalent controls; C6.3 perf/accessibility/disable | C5 | Optional immersive experience |

Recommended implementation discipline: one coherent epic slice with roughly 2–4 related code tasks per agent run, tests and independent review, never a single PR implementing all epics. Stage B2b2 production trust/registration is a **separate** program, not included in C1–C6 automatically.

## 11. Dependencies, open decisions and risks

| Question / risk | Why it matters | Proposed owner / resolution |
| --- | --- | --- |
| Existing DOCMONSTAKRAKIN human-approval charter versus new solo-mode choice | Cannot rewrite current protected approval policy implicitly | Project Lead defines allowed scope and explicit policy migration |
| Local model provider contract | Loopback does not prove on-device; redirects/proxies may egress | Architecture ADR + network-denied app/runtime integration tests |
| Proving real run telemetry | Existing demo simulation makes inaccurate activity easy | Instrument event source; mark legacy data `SIMULATED_DEMO` |
| Communication loops, token collision and runaway cost | Agents can loop; same-token changed payload could otherwise create another provider call; external billing is not exactly once | Unique `(project, actor, operation, token)` key, separate request digest and `409` mismatch, quotas, fenced retries, uncertain billing visibility |
| Sensitive-data leakage via mentions | Equally classified sources may have non-overlapping audiences; captions, badges and pointers can reveal even source existence | Intersect **every** source ACL with classification, distinguish discover/read, suppress all existence markers for discover-denied recipients; declassify only by recorded human decision |
| WebGL/3D performance | Novelty can impair usability | Simple first, 2D second, optional 3D and accessibility fallback |
| Independent-human assurance | Agent roles may sound like human offices | Distinct human/AI labels and external identity trust boundary |
| Data retention and import/export | Local-first snapshots might be overwritten or reintroduced | Migration tests and preserve historical approved state |
| Customizable provider/model routes | User may route private project data remotely by accident or provider redirects | Exact endpoint/model/context fingerprint consent; revalidate at dispatch/retry |
| Live agent endpoints currently unguarded | Current governance reviewer auth does not secure Agent Center routes | Explicit DMK-209–214/local session/RBAC/delegation dependency; block live rollout until verified |
| Background worker crash or duplicate send | Current HTTP response lifecycle is not a transaction path for independent jobs | Shared transactional outbox/job/mentions/audit/budget commits and failpoint recovery matrix |
| Local worker termination while cloud runs | A local stop is easily misrepresented as remotely cancelled or free | Two-axis execution states + independent cost tracking, provider termination evidence, synthetic continuing-provider kill test |

## 12. Definition of ready for implementation

A **configuration-only** feature slice may start after design review and relevant product decisions, provided it clearly disables live shared APIs and production approval. **Live collaboration/runner slices must not start deployment** until the separately approved local authentication/session/membership/delegation contracts, **full contributing-source ACL and discover-rights enforcement**, shared worker transaction/outbox (including `409` mismatched token and cancellation provenance), and provider-egress controls have passed negative/crash tests. Do not treat PR #34 as merged or implement its canonical registration through this proposal. Any production signer/quorum or WBS apply still needs separately governed Stage B2b2 work.

A feature slice may be marked **technically verified** only with deterministic test/evidence links for the actual revision. Human merge decisions are separate. Visual prototype acceptance is never approval of security behavior.

## 13. Source of truth and traceability

- Source UI: supplied Atlas Platform Launch Agent Center screenshot plus repository implementation.
- Current components: `src/components/AgentCenterView.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PromptCompilerView.tsx`.
- Server and data model: `server.ts`, `src/types.ts`, `server/projectStore.ts`, `server/projectPersistence.ts`.
- Authentication workstream: DMK-209–214, currently proposed by unmerged PR #34, and current specialized reviewer guards; production contracts still require independent implementation and verification.
- Independent design review: six original findings plus three v0.2 follow-up ambiguities tracked in `05_SECURITY_REVIEW_RESOLUTION_MATRIX.md` (design dispositions, not runtime sign-off).
- Existing governance planning: `docs/05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md` and Stage B2b2-A candidate documents. **Their policy choices remain proposals.**
- Design artifact links: this PRD's three companion files in the same package.

**PRD decision status:** `PRODUCT_PROPOSAL_READY_FOR_REVIEW / HUMAN_GOVERNANCE_CHOICES_PENDING / IMPLEMENTATION_NOT_AUTHORIZED`.
