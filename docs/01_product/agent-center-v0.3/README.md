# DOCMONSTAKRAKIN | Agent Workplace Design Package

**Edition:** 2026-10-19 | Proposal v0.3 / six original findings and three follow-up ambiguities specified  
**Repository read-only baseline:** `Jeruzael/docmonstakrakin`, master `75fde2aa3e0d925673fd813cbf9e7f49c4dabb75` (includes merged PR #44, whose Stage B2b2-A trust policy remains a human-ratification candidate).  
**Inputs:** User's current Agent Center screenshot for Atlas Platform Launch (`PRJ-ATLAS-01`) and discussion of solo/team/high-assurance governance, agent-to-agent conversations, custom agents, optional 2D/3D scenes, offline local models and no-model/manual project management.

## The four requested deliverables

1. **[01_PRODUCT_AND_ARCHITECTURE_SPEC.md](01_PRODUCT_AND_ARCHITECTURE_SPEC.md):** Core product model; solo/team/high-assurance governance; real vs simulated run provenance; offline/local/cloud/manual operation; agent permissions; event bus; conversations; security and additive API architecture.
2. **[02_INFORMATION_ARCHITECTURE_AND_UX_FLOWS.md](02_INFORMATION_ARCHITECTURE_AND_UX_FLOWS.md):** Updated navigation, onboarding, agent creation, mentions, human escalation, Simple vs 2D vs 3D flow parity, avatar interactions, empty/error/accessibility states.
3. **[03_PRODUCT_REQUIREMENTS_DOCUMENT.md](03_PRODUCT_REQUIREMENTS_DOCUMENT.md):** Product outcomes, user stories, P0/P1/P2 requirements, acceptance tests, epics, dependencies and handoff gates.
4. **[04_TEXT_UI_SCREEN_MOCKUPS.md](04_TEXT_UI_SCREEN_MOCKUPS.md):** Eighteen text-only screen/storyboard mockups following the existing UI: governance setup, live list, role editor, conversations, dispatch, approvals, studio scenes, offline/manual and mobile.

## Independent architecture review response

The six original source/design review findings and three v0.2 follow-up ambiguities are resolved as **proposed contractual behavior**, **not** as implemented code, independently verified tests or a security attestation. See [05_SECURITY_REVIEW_RESOLUTION_MATRIX.md](05_SECURITY_REVIEW_RESOLUTION_MATRIX.md) for source finding references, F02/F04/F05 clarifications, open decisions and fail-closed negative test requirements.

**Focused v0.3 contract delta:**

- **Idempotency (F02):** One unique `(project, server-resolved actor, operation, token)` mapping stores a separate request digest; same token+changed digest returns `409` and creates no additional job, budget reservation, outbox or provider invocation. External provider billing remains at-least-uncertain when acceptance is unknown.
- **Source ACLs and existence (F04):** Highest classification is **not enough**. Outputs inherit every contributing source's ACL, including uncited inputs; read permission requires all sources; discover-denied recipients receive **no pointer or notification**, not even a neutral one. ACL revocations invalidate derived output access/caches.
- **Local versus remote cancellation (F05):** Worker `STOPPED` is separate from provider `TERMINATION_CONFIRMED` and from billing. Local stop with remote work possibly continuing is `RESULT_UNCERTAIN`, not `CANCELLED`; late results are quarantined. Test a continuing synthetic provider.
- **Editorial:** Four malformed bold markers in the architecture rollout list are repaired.

**Prerequisite:** The existing local-authentication workstream (DMK-209–214, currently unmerged PR #34) or an independently approved equivalent must provide server-verified human session identity, project-scoped RBAC and agent delegation before real shared conversations and agent execution may be enabled. The existing reviewer-specific sign-in does not fill that gap. P0 **configuration and blocked states** can be developed earlier; P0 **live execution and production approval** cannot be claimed early.

**Durability:** Background workers need one shared crash-safe store, atomic job+outbox+budget+audit transitions, unique token+actor+operation enforcement and uncertainty handling. “Exactly once” applies only to tested local effects, not cloud execution or billing. Model-origin evidence must be honest.

**Provider/privacy:** An on-device label requires proof of egress confinement of both application and local model runtime. Agent-generated messages, summaries, mentions, exports and speech captions inherit **all source ACLs and existence restrictions**, not only class. Cloud consent is bound to reviewed context hashes and exact destination.

**Vocabulary:** The canonical team approval label is `TEAM_HUMAN_APPROVED`. IA flow IDs use `UX-FLOW-##`, distinct from PRD requirements `UX-##`. An owner session acknowledgment is not a cryptographic human signing ceremony.

## Key product decisions proposed, not ratified

- A project selects a governance profile separately from its existing application-type profile. Size suggests a starting choice but does not automatically set or weaken the security floor.
- AI agents fill functional roles; they **never** fill independently required human seats or impersonate real people.
- Solo owner self-approval is allowed only under an explicit project-authorized solo policy and is labeled truthfully. For the strongest governance profile, missing human or external trust requirements genuinely block protected operations.
- Offline with a **verified and egress-confined** local model supports agent tasks after auth and worker gates pass; offline without a model remains a useful manual A-SSDLC/project management product. A localhost endpoint without confinement proof is labeled `LOCAL_ENDPOINT_UNVERIFIED`.
- The existing Agent Center's canned demonstration summaries and random duration/token metrics must be clearly labeled `SIMULATED_DEMO` until actual execution/provenance is implemented.
- One event and evidence model drives Simple, 2D and 3D. Avatar speech bubbles must show actual published messages or logged status, never fabricated model thoughts.
- Ship a reliable Simple Agent Center and durable communication first, 2D second and optional 3D last.

## Suggested controlled handoff

1. Human product/UX reviewer evaluates these four proposals, especially the permitted scope of `SOLO_LOCAL` and project-specific governance policy floors.
2. Independent security reviewer reconciles proposed governance profiles with the existing approved charter and unratified Stage B2b2-A ADR-0007. **A documentation merge alone must not ratify policy.**
3. Prepare a documentation-only, SSH-signed PR with these proposal documents in a new branch, using repository-appropriate paths and no generated WBS mutation. Independently review and run CI.
4. Plan P0 slices with traceable requirements and automated negative tests. Do not invent canonical DMK IDs or automatically merge PR #34.
5. Only after actual human authorization, implement one bounded slice at a time, preserving project-state migrations and existing historical evidence.

## Explicit restrictions

This package changes no repository files or local runtime state. It does **not** register tasks DMK-209–214, merge/approve PR #34, ratify human quorum or real signing keys, authorize production WBS registration, execute runtime WorkItem reconciliation, advance Gate 7 or promote release. It is a design package for discussion and governed implementation planning.

## Source pointers

- [Existing Agent Center](https://github.com/Jeruzael/docmonstakrakin/blob/master/src/components/AgentCenterView.tsx)
- [Existing Agent run route (currently demo behavior)](https://github.com/Jeruzael/docmonstakrakin/blob/master/server.ts)
- [Agent/project types](https://github.com/Jeruzael/docmonstakrakin/blob/master/src/types.ts)
- [Current proposed Stage B2b2-A ADR-0007](https://github.com/Jeruzael/docmonstakrakin/blob/master/docs/05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md)
