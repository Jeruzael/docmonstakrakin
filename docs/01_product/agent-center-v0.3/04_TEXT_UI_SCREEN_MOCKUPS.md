# DOCMONSTAKRAKIN | Collaborative Agent Center and Governance Profiles
## 04. Screen-by-Screen Text UI Mockups

**Status:** PROPOSED LOW-FIDELITY UX WIREFRAMES v0.2 / SIX SECURITY REVIEW FIXES / NOT IMPLEMENTED  
**Basis:** Current user screenshot at `localhost:3000/?project=PRJ-ATLAS-01` and observed Agent Center component.  
**Visual direction:** Refine existing light/slate UI with emerald project identity and violet agent accents.  
**Legend:** These mockups contain **illustrative sample data only**. They are not actual agent execution, messages, risk assessments, human approvals or model telemetry.

The goal is an operationally trustworthy workspace that can also be delightful. The existing screenshot's role list, `Dispatch Agent Run` button, mission detail, model tier, prompt contract and audit history are retained and progressively upgraded.

---

## Screen 01 | First project setup: governance choices

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ DOCMONSTAKRAKIN    Set up Atlas Platform Launch                   Step 2 / 4 │
├───────────────────────────────────────────────────────────────────────────────┤
│ How will this project be governed?                                           │
│                                                                               │
│ ┌──────────────────────┐ ┌─────────────────────┐ ┌────────────────────────┐  │
│ │ ● SOLO DEVELOPER     │ │ ○ TEAM GOVERNANCE   │ │ ○ HIGH ASSURANCE       │  │
│ │ One accountable     │ │ People + agents     │ │ Independent human      │  │
│ │ owner + AI team     │ │ share responsibilities│ │ approvals required    │  │
│ │ Owner decisions     │ │ Role-based reviews  │ │ Protected evidence    │  │
│ │ recorded truthfully │ │ and escalation      │ │ and stronger gates    │  │
│ └──────────────────────┘ └─────────────────────┘ └────────────────────────┘  │
│                                                                               │
│ Selected: SOLO                                                               │
│  ✓ You can create many functional AI roles                                    │
│  ✓ Solo self-approval possible where this project's policy permits           │
│  ! AI agents never count as independent human approvers                       │
│  ! Mandatory organization/release policies are never silently downgraded    │
│                                                                               │
│ AI execution preference:   (●) Local   ( ) Cloud   ( ) No AI                 │
│ [Test local model]       Model status: NOT CONFIGURED                         │
│                                                                               │
│                                     [Back]  [Continue manually] [Next →]      │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Interaction:** Team size is an onboarding hint, not an authority source. In the case of a locked inherited policy, the solo option may be visible but blocked with a clear reason and an authorized change path.

---

## Screen 02 | Updated Agent Center: Simple Overview (recommended default)

```text
┌──────────────────┬────────────────────────────────────────────────────────────┐
│ docmonstakrakin  │ Atlas Platform Launch v129  | Local ● | Gio   🔔 3       │
│ PROJECT          ├────────────────────────────────────────────────────────────┤
│  Home            │ AGENT CENTER   Solo owner governance                        │
│  Projects        │ Work with your team, review its evidence, stay in control. │
│  Requirements    │                                                            │
│  Architecture    │ [Simple ●] [Studio 2D] [Studio 3D]  [+ Agent] [Assign task]│
│  Security & Risk │                                                            │
│ DELIVERY         │ ┌────────────┬────────────┬────────────┬─────────────────┐ │
│  Work Management │ │ Running: 2 │ Waiting: 1 │ @me: 3     │ Providers: Local│ │
│  Repository/Git  │ └────────────┴────────────┴────────────┴─────────────────┘ │
│ >Agent Center    │  Session: owner verified · Project member · Demo disabled  │
│  Prompt Compiler │ [Overview] [Agents] [Conversations] [Runs & Evidence]      │
│ ASSURANCE        │                                                            │
│  Standards       │ YOUR TEAM                    RECENT ACTIVITY               │
│  Evidence & Audit│ ┌──────────────────────────┐ ┌──────────────────────────┐  │
│  Approvals Inbox │ │ Mira  Security  RUNNING  │ │ 09:42 Mira started review │  │
│                  │ │ Local Model · Read-only  │ │ 09:43 Mira @Architect    │  │
│                  │ │ Audit login design      │ │ 09:44 @me decision needed│  │
│                  │ ├──────────────────────────┤ ├──────────────────────────┤  │
│                  │ │ Orion Architect  IDLE   │ │ WAITING FOR YOU          │  │
│                  │ │ Available for ADRs       │ │ Risk RISK-018: inspect   │  │
│                  │ ├──────────────────────────┤ │ [Open evidence] [Review] │  │
│                  │ │ Tess  QA   QUEUED        │ └──────────────────────────┘  │
│                  │ │ Test plan draft          │                               │
│                  │ └──────────────────────────┘  [View all conversations →]    │
└──────────────────┴────────────────────────────────────────────────────────────┘
```

**Why this fits the screenshot:** Keep the left app sidebar, project picker and compact Agent Center cards. Add a clear view switch and truthful run/provider states instead of replacing your existing information architecture.

---

## Screen 03 | Agents view: role list with inspector

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agent Center / Agents                [Search agents...] [+ Create agent]     │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ ROSTER                            │ MIRA / SECURITY AGENT                  │
│                                   │ AI_DELEGATED · LOCAL_MODEL · RUNNING   │
│ > [Mira]  Security       Running  │                                         │
│   Audit login design              │ Mission                                │
│   [Orion] Architect     Idle      │ Review auth flows and explain risks.   │
│   [Tess]  QA            Queued    │                                         │
│   [Dox]   Documentation Available │ Authorized inputs                       │
│   [Rule]  Deterministic Available │ Requirements, ADRs, public diff        │
│                                   │                                         │
│ Filters: Role / Provider / State  │ Cannot: approve as human, edit WBS,    │
│                                   │ access secrets, bypass gate            │
│                                   │                                         │
│                                   │ Current task: WORK-104 / Review login  │
│                                   │ Last event: RUN_STARTED / 09:42        │
│                                   │ [Message] [Assign] [Inspect evidence]  │
│                                   │ [Pause after step] [Request cancel]    │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

The inspector is a single reusable component shared by all three view modes. A branded title such as `Security Agent` is never a human security signature.

---

## Screen 04 | Create a custom agent

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CREATE AGENT                                     Step 2 / 3   [Save draft]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Role template       [ Security Reviewer ▼ ]                                 │
│ Agent name          [ Mira                                   ]               │
│ Representation      [ Simple ◉ ] [ 2D Avatar ] [ 3D Avatar ]                │
│ Mission             [ Review threats and propose mitigations... ]           │
│ Runtime             [ Local Model ▼ ]  Model check: HEALTHY                  │
│ Output              [ RISK_ANALYSIS ▼ ]                                      │
│                                                                             │
│ CONTEXT GRANTS                ALLOWED ACTIONS            ALWAYS PROHIBITED    │
│ [✓] Architecture read        [✓] Draft proposals        [x] Human signoff   │
│ [✓] Requirements read        [✓] Mention other agents  [x] Edit approvals  │
│ [ ] Restricted documents     [ ] Write project files   [x] Read secrets    │
│                                                                             │
│ Work budget    Max 2 concurrent; max 4 coordination hops; time cap 5 min     │
│                                                                             │
│ Note: This agent fills a functional role, NOT an independent human slot.     │
│                                                                             │
│                          [Cancel] [Preview prompt & data] [Create agent]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Click `Preview prompt & data`:** show exact accessible source documents and digests, classification, intended audience, applicable policy, provider endpoint/tenant and possible cloud transfer, proposed tool grants and the difference between design-time permission and run-time checks. Until authenticated project membership, revocable delegation and worker durability are implemented, save as **Draft (live dispatch blocked)**.

---

## Screen 05 | Conversations: agents can mention each other and you

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGENT CONVERSATIONS          [# Project] [# Architecture] [# WORK-104]      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ Channels             │ # WORK-104 - Login design                            │
│ # project-lounge     │                                                      │
│ # security           │ 09:43  Mira [AI]                                      │
│ # architecture       │ @Orion I found a missing token-revocation case.      │
│ # qa-lab             │ Evidence: RISK-018, ADR-007                        │
│ # WORK-104   (2)     │ [View risk] [Open related ADR]                       │
│                      │                                                      │
│ Mentions             │ 09:45  Orion [AI]                                     │
│ > @me (3)            │ Proposed an ADR clarification. No files changed.    │
│   @Mira              │ [Inspect proposed diff]                              │
│   @Tess              │                                                      │
│                      │ 09:46  Tess [AI]                                      │
│ Unread: 2            │ @me Test plan drafted. Owner decision needed.        │
│                      │ [Open test proposal]                                  │
│                      │                                                      │
│                      │ [Message @Mira, @Orion, or @everyone ...      ] [Send]│
│                      │ Mentions do not automatically grant tool access.     │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

**Safety:** Chat is persisted and attributable. `@everyone` is rate-limited and access-scoped, and agents need explicit authority to trigger another run. All model-derived messages inherit the highest source class **and every contributing source ACL**, even if paraphrased. Recipients denied source-existence discovery get **no metadata, count, pointer, bubble or notification**; neutral metadata is allowed only where discovery of every source is authorized. Captions and push notifications apply the same current read/discover rules. The snippets above are **sample published messages**, not hidden reasoning.

---

## Screen 06 | Dispatch a real task: context and consent

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ASSIGN TASK: Review login design                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Assignee            [ Mira (Security) ▼ ]                                   │
│ Source WorkItem     [ WORK-104 / Auth Login Design ]                        │
│ Provider       [ Verified on-device local model ]  Health: HEALTHY          │
│ Access scope        READ: Requirements, relevant ADRs, sanitized diff      │
│ Write permissions   NONE                                                    │
│ Proposed output     Risk analysis + cited findings + test ideas            │
│ Task budget         Time: 5 min / Max coordination hops: 4                 │
│                                                                             │
│ Security preview                                                            │
│  ✓ No credentials attached                                                  │
│  ✓ Both app and model-runtime outbound egress tested DENIED                 │
│  ✓ Agent cannot directly approve or modify canonical WBS                   │
│                                                                             │
│ [Cancel] [Open Prompt Compiler] [Queue reviewed task]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

On run start the UI emits real events. If no model exists, show `WAITING_FOR_PROVIDER` or offer `Create manual task`, not a fabricated completion.

---

## Screen 07 | Human inbox: control, not decorative approval

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ YOUR DECISIONS    Atlas Platform Launch / SOLO                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1 waiting for you                                     [See all approvals]   │
│                                                                             │
│ WORK-104: Token revocation mitigation                                      │
│ Recommended by: Mira [AI REVIEW]                                           │
│ Independently verified by human: NO                                        │
│ Evidence: RISK-018 + test plan + source diff                               │
│                                                                             │
│ Current project policy: SOLO_OWNER_APPROVAL_ALLOWED for this action        │
│ Risk: HIGH, explicit acknowledgment required                               │
│                                                                             │
│ [Open evidence] [Request another review] [Reject] [Accept with risk note]  │
│                                                                             │
│ Reminder: no AI review is counted as an independent human approval.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

If this exact action is protected by a team/high-assurance floor, replace the solo action with a blocked state listing the missing verified human role. A solo *session acknowledgment* should display `LOCAL_SESSION_ACKNOWLEDGED`, not `OWNER_CRYPTO_SIGNATURE_VERIFIED` unless a dedicated cryptographic human signing ceremony actually happened. SecretStore does not supply that ceremony. No click-to-downgrade workaround.

---

## Screen 08 | Agent Studio 2D: the "living workplace"

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agent Center   [Simple] [2D STUDIO ●] [3D]      [Activity] [@me 3]         │
│ Your workplace: 3 busy · 1 idle · 1 waiting    Mode: Solo  Model: Local     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     SECURITY DESK                      ARCHITECTURE TABLE                  │
│  ┌───────────────────────┐          ┌─────────────────────────────┐         │
│  │ "@Orion, see RISK-018"│          │ "Proposing ADR change..."   │         │
│  │        ▼              │          │       ▼                     │         │
│  │   (o) Mira            │ >>>>>>>  │   (o) Orion                  │         │
│  │   [RUNNING]           │ Mention  │   [REVIEWING]               │         │
│  │   [Open evidence]     │          │   [View ADR]                │         │
│  └───────────────────────┘          └─────────────────────────────┘         │
│                                                                             │
│     QA LAB                             DOCUMENTS DESK                       │
│  ┌───────────────────────┐          ┌─────────────────────────────┐         │
│  │  "Test plan queued"   │          │  (o) Dox                    │         │
│  │         ▼             │          │  [IDLE]                     │         │
│  │   (o) Tess            │          │  No active task             │         │
│  │   [QUEUED]            │          │                             │         │
│  └───────────────────────┘          └─────────────────────────────┘         │
│                                                                             │
│   [YOUR DESK] @me 3       [OPERATIONS] Rule engine available               │
│   Click agent, caption, station or your inbox. [Show text roster]           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ACTIVITY: 09:43 Mira mentioned Orion | 09:45 Orion proposed ADR change     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design key:** `>>>>>>> Mention` is an optional transient animation from a logged message event, not an always-running show. Captions disappear when stale; the message remains in Conversations. Only **viewer-authorized, every-source ACL-checked** published excerpts may appear above an avatar. For readers permitted to discover all sources but not read, show neutral metadata **only where policy allows**; if existence is forbidden, show **no bubble or activity marker at all**. Agents do not display fabricated private thoughts. `Show text roster` exposes only viewer-authorized actors for keyboard and screen readers.

---

## Screen 09 | Click an avatar: quick action menu

```text
       ┌─────────────────────────────────────────────────────┐
       │ (o) MIRA                                          × │
       │ SECURITY AGENT         AI_DELEGATED  · RUNNING     │
       ├─────────────────────────────────────────────────────┤
       │ Current task: WORK-104 / Login design               │
       │ Last published: "@Orion, see RISK-018"             │
       │ Provider: Local Model | Permission: READ_ONLY       │
       │                                                     │
       │ [Message]         [Assign Task]    [Pair with Agent]│
       │ [See Conversation Thread]   [Inspect Evidence]     │
       │ [View Capabilities] [Pause after step] [Cancel?]  │
       │ [Open full inspector]                               │
       └─────────────────────────────────────────────────────┘
```

A click should first surface useful actions, not bury the user in 3D animation. All interactions use the same service as Simple mode.

---

## Screen 10 | Optional 3D studio: stylized command center

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Simple] [2D] [3D STUDIO ●]       Camera: [Overview ▼] [Reduced motion]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                  ______________________________                              │
│                 /  ARCHITECT TABLE             /|                            │
│                /  Orion (reviewing ADR)       / |                            │
│               /______________________________/  |                            │
│              |                              |   |                            │
│       _______|__          ________          |   /                            │
│      /SECURITY /|        /QA LAB /|         |  /                             │
│     /  Mira   / |       / Tess  / |         | /                              │
│    /_________/  /       /______/  /         |/                               │
│    | RISK-018| /        |Queued| /          /                                │
│    |_________|/         |______|/          /                                │
│                                                                             │
│  Human Inbox (3)  /  Operations Console /  Documentation                   │
│                                                                             │
│  Focus: [Mira]      [Open message] [Assign] [Open evidence]                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ LIVE TEXT ROSTER / ACTIVITY / APPROVALS remains one click away              │
└─────────────────────────────────────────────────────────────────────────────┘
```

This is **not a literal rendering preview**. It communicates relative layout only. Production 3D should be a small, optional, dynamically loaded scene with identical selection and controls. Never require navigating a 3D corridor to inspect a blocking release gate.

---

## Screen 11 | Offline with no local model: project management still works

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Atlas Platform Launch      LOCAL ●        AI provider: NONE                │
├─────────────────────────────────────────────────────────────────────────────┤
│ OFFLINE MANUAL MODE                                                         │
│ You can continue managing your project normally.                           │
│ AI tasks will wait until you configure a compatible model.                  │
│                                                                             │
│ [Requirements] [Work Board] [ADR] [Risk] [Docs] [Evidence]                 │
│ [Deterministic Checks] [Prompt Compiler / Export Offline Package]          │
│                                                                             │
│ AGENT ROSTER                                                                 │
│ Mira (Security)      WAITING_FOR_PROVIDER / last real run unavailable       │
│ Rule Engine          AVAILABLE / deterministic checks                       │
│ Manual Reviewer      AVAILABLE / human-authored notes                       │
│                                                                             │
│ [Configure local model]       [Continue without AI]                         │
│                                                                             │
│ Your project data and audit events remain accessible on this device.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

The no-model state should feel like a **supported product mode**, not an error screen. If local model becomes available, offer to resume queued work with task/context revalidation, not blind replay.

---

## Screen 12 | Governance profiles: team and high-assurance view

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ GOVERNANCE & ASSURANCE                    Selected: HIGH_ASSURANCE (locked)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Profile options: [SOLO] [TEAM] [HIGH ASSURANCE ●]                           │
│                                                                             │
│ Required human seats for this protected operation:                          │
│  [✓] Project Lead        Actual human: verified                             │
│  [ ] Security Officer    Another verified person: NOT ENROLLED             │
│  [ ] Independent Review  Another verified person: NOT ENROLLED             │
│                                                                             │
│ AI advisors:  Security Agent ✓    Architect Agent ✓    QA Agent ✓          │
│ These advisors help but do not count as the missing humans.                 │
│                                                                             │
│ Registration decision: BLOCKED_BY_POLICY                                    │
│ [Inspect missing requirements] [Request enrollment procedure]              │
│                                                                             │
│ Downgrade profile: unavailable under ratified project policy                │
└─────────────────────────────────────────────────────────────────────────────┘
```

For `SOLO`, replace the roster with a clear one-owner assurance statement and policy-allowed risk acknowledgment. Do not manufacture imaginary human slots as agents just to make cards green.

---

## Screen 13 | Mobile fallback and accessible selection

```text
┌────────────────────────────────┐
│ Atlas · Agent Center     @me 3 │
│ [Simple ●] [2D] [3D disabled]  │
├────────────────────────────────┤
│ 1 waiting for you             │
│ [Open decisions]              │
│                                │
│ AGENTS                         │
│ Mira / Security   Running      │
│ [Message] [Inspect]            │
│ Orion / Arch     Idle          │
│ [Message] [Assign]             │
│ Tess / QA        Queued        │
│ [Open run]                    │
│                                │
│ [Conversations] [Runs] [More] │
└────────────────────────────────┘
```

No interaction necessary for core work should rely on hover, animation, avatar dragging, or the user's ability to see colors.

---

## Screen 14 | A short end-to-end narrative

The solo developer opens **Atlas Platform Launch** at home. The connection is offline, but a local model is running. The Agent Center shows Mira reading an authentication ADR, Orion idle, and Tess queued for test design. A caption appears above Mira: **"@Orion, I found a token-revocation gap."** That is an actual, permitted thread message, not a pretend thought bubble.

The developer clicks Mira, sees the linked risk and a reviewable proposal, and chooses **Pair with Orion**. The scheduler checks the allowed context and hop budget. Orion reviews the proposal, Tess produces a test-plan draft, and the human receives an `@me` notification. The user can click the notification to inspect the exact evidence and either accept the permitted solo decision with a risk note or request more work. The app records `SOLO_OWNER_APPROVED` if the actual project policy allows it; it does not claim three independent human signatures.

Then the developer switches from 2D to Simple and sees **the identical thread and run records**. The local model goes offline. The project board, questionnaire and controlled documents continue working, and queued agent work is visibly waiting. No fake successes, no abandoned governance, and no need for a second human who doesn't exist.

That is the emotional payoff of the idea: a small team feels productive and alive, but the software remains transparent about who did the work and who actually approved it.

## Screen 15 | Sign-in, project membership and agent delegation gate

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Agent Center     Access: PROJECT MEMBER? UNKNOWN                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Shared conversations and real agent dispatch are not enabled yet.       │
│                                                                          │
│ [Sign in with verified local human session]                              │
│ Project membership       Required: project.discuss / agent.dispatch     │
│ Delegation              Sponsor: owner; read-only; expiry and revocation│
│                                                                          │
│ [View agent configuration]  [Browse demo runs]  [Review access policy]  │
│ [Send message] DISABLED         [Start real run] DISABLED                │
└──────────────────────────────────────────────────────────────────────────┘
```

The current specialized reviewer session is **not** a general-purpose member session. Loopback networking does not authenticate a human. Live actions unlock only when local account/session, project membership, least-privilege grants, revocation checks and durable worker storage have been verified. Even if an agent has a human-sounding name, it remains an AI principal.

---

## Screen 16 | Local-model privacy and cloud consent

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Provider boundary                Current: LOCAL_ENDPOINT_UNVERIFIED      │
├──────────────────────────────────────────────────────────────────────────┤
│ URL: http://127.0.0.1:11434    Model: example-local-model               │
│ Loopback connection: YES        Runtime outbound isolation: UNPROVEN    │
│ Redirect/proxy test: NOT RUN    Verified on-device claim: NOT ALLOWED   │
│ [Inspect runtime config] [Test outbound-denied app + runtime]            │
│ STRICT LOCAL-ONLY: [Run blocked until verified]                          │
│                                                                          │
│ Fallback destination: cloud.example/model (ILLUSTRATIVE)                │
│ Context: ADR-007 @ SHA256(...) · CONFIDENTIAL · 2 attachments           │
│ Estimated token cap/cost: ...     Consent expires: ...                  │
│ [Decline] [Review exact context] [Approve exact scope for this run]     │
└──────────────────────────────────────────────────────────────────────────┘
```

Cloud consent is limited to the **exact provider/tenant/endpoint/model and context digest**. A queued edit, provider redirect, label change, expiry or retry invalidates it and requires new review. Denying cloud never disables manual project management. The isolated local-model test must cover both the app and model runtime, not simply trust a localhost URL.

---

## Screen 17 | Derived-content source-ACL intersection and protected captions

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ #security / RISK-018        RESTRICTED ≠ permission to read             │
├──────────────────────────────────────────────────────────────────────────┤
│ Input A: ADR-007 · RESTRICTED · allowed: Mira, Gio                       │
│ Input B: SPEC-021 · RESTRICTED · allowed: Tess, Gio                      │
│ Derived summary: RESTRICTED + source ACL intersection => Gio only       │
│ Model paraphrased both (no citations) · both sources still inherited     │
│                                                                          │
│ @everyone preview:   1 permitted reader; blocked for others             │
│ Mira: READ A but not B -> no summary access                              │
│ Tess: READ B but not A -> no summary access                              │
│ No DISCOVER B? -> NO pointer / unread badge / notification / avatar text │
│ DISCOVER A+B but not READ? -> neutral metadata only if policy permits   │
│ [Inspect complete lineage] [Request source access] [Cancel broadcast]  │
│ Search, exports and caches must enforce the same current ACLs           │
└──────────────────────────────────────────────────────────────────────────┘
```

Two sources can share a sensitivity label and still have disjoint readers. The result requires access to **every contributing source**, even if a model drops citations. Discovery of existence is checked separately. A recipient barred from discovering any contributing source gets **no hint of activity**, not even `Restricted update available`. A source ACL revocation removes access to prior derived outputs and invalidates cached views. Declassification requires a separately authorized human decision and full source/output digest audit.

---

## Screen 18 | Durable run identity, pause/cancel and external uncertainty

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ RUN-AC142 / Attempt 02           RESULT_UNCERTAIN                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Idempotency scope: project + authenticated actor + operation + token K  │
│ Canonical request digest: D1 stored separately                           │
│ Retry K + D1 -> return RUN-AC142 (no new work)                            │
│ Retry K + D2 -> 409 Conflict (no new job/budget/provider call)           │
│ [Review changes and create new authorized request]                       │
│                                                                          │
│ LOCAL WORKER: STOPPED     CLOUD PROVIDER: MAY_BE_RUNNING                 │
│ Cancel request: SENT     Remote termination: NOT CONFIRMED              │
│ Billing: UNCERTAIN       Never show 'CANCELLED' or 'Refunded'            │
│ Late output: QUARANTINED until separately authorized                     │
│ [Inspect attempts] [Reconcile provider result] [Ask owner]              │
│ [Automatic retry] DISABLED while outcome unknown                        │
│                                                                          │
│ Other run: PAUSE_REQUESTED   'Pause after current local checkpoint'     │
│ Remote provider may still be processing.                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

The first enqueue atomically persists a unique scoped idempotency mapping, immutable request digest, job, budget reservation and outbox event. Changed content with the same token fails `409` without side effects. Local scheduler stop and remote provider termination are independent, auditable states. Killing a local worker cannot establish cloud cancellation or zero billing. Provider-acknowledged cancellation is not enough without verified termination; provider-late responses are quarantined. No simulated billing or cancellation is labeled as observed fact.

---

## Mockup-to-implementation traceability

| Screen | Requirement references | Delivery stage |
| --- | --- | --- |
| 01 | GOV-01 through GOV-04, OFF-01 | P0 foundation |
| 02–03 | AGT-01 through AGT-05, UX-01, UX-02 | P0 Agent Center |
| 04 | AGT-01, AGT-02, AGT-04, SEC-01 | P0 role builder |
| 05 | COM-01 through COM-04 | P0 collaboration |
| 06 | AGT-02 through AGT-04, OFF-03 | P0 task runner |
| 07 | GOV-02, GOV-03, COM-04, AUD-01 | P0 governance |
| 08–09 | UX-02, UX-04 | P1 Studio 2D |
| 10 | UX-05 | P2 Studio 3D |
| 11 | OFF-01 through OFF-03 | P0 offline |
| 12 | GOV-01 through GOV-04 | P0 governance |
| 13 | UX-03, UX-05 | P0/P2 fallback |
| 15 | AUTH-01 through AUTH-04 | P0-LIVE prerequisite, blocked until verified |
| 16 | PROV-01 through PROV-03, OFF-02, OFF-03 | P0-LIVE provider trust and consent |
| 17 | DATA-01 through DATA-04, COM-01 and COM-02 | P0-LIVE classification, every-source ACL and discover-rights enforcement |
| 18 | DUR-01 through DUR-05, RUN-01 through RUN-03 | P0-LIVE idempotency conflicts, worker/provider state and interruption recovery |

**Mockup status:** Text-only concept, not actual rendered UI, working prototype or proof of model/agent activity. These scenes do not make governance decisions.
