# DOCMONSTAKRAKIN | AUTONOMOUS COMPLETION CAMPAIGN

## Operator Standing Authorization

I authorize the local development agent to execute the four workstreams below as one continuous, autonomous development campaign.

**Do not repeatedly request my permission for routine engineering decisions, coding, tests, bug fixes, documentation, pull-request publication or eligible protected merges.**

This is a new authorization following successful integration of PRs #57 and #58. It does not revive or extend prior exhausted approvals.

**Verified starting master:**

`148be8892b37aaf1944aca0c0671b6a948192f38`

**Starting CI:** `39559475919`, four jobs successful, 71 suites and 1,904 reported checks.

Reverify the baseline before beginning.

### Authority and duration

- Authorize up to eight independently scoped development PRs across the four workstreams.
- Continue until the defined work is complete, the authorization expires on November 4, 2026 at 00:00 UTC, or an unresolvable security/human gate prevents further eligible work.
- Routine source-code, test, fixture, dependency, documentation and CI changes are preauthorized when directly necessary for the workstreams.
- Use multiple workers/worktrees for independent scopes when available. Keep integration controlled and sequential.
- Do not stop after completing the first workstream. Continue through all four.
- Avoid planning-only iterations when implementation and testing can proceed.

This authorization covers code development and conditional integration. It is not operational governance ratification.

## WORKSTREAM A: Windows compatibility and native dependencies

**Goal:** Achieve reproducible Windows/Linux development qualification.

Authorized implementation:

1. Correct short-name/long-name TEMP path canonicalization without weakening private-directory ownership, symlink, junction or cleanup protections.
2. Test actual Windows aliasing, malicious paths, directory replacement and fail-closed behavior.
3. Qualify fresh npm and Bun installations under Node 22 x64.
4. Investigate Bun's blocked protobufjs postinstall and either implement a narrowly reviewed compatibility correction or retain the accurate documented limitation.
5. Establish repeatable SDK/toolchain setup and native binary provenance checks.

**Additional bounded host-maintenance permission:** An official, verifiably signed Microsoft Windows SDK may be installed on the operator-owned Windows development machine if the agent first confirms the existing toolchain, installation source, required component, disk space and recovery procedure.

Do not bypass Windows elevation/UAC prompts, reboot automatically, change credentials, stop unrelated services, or modify the existing node_modules junction or operator data. Prefer disposable checkouts and environments. Stop host maintenance if it cannot be completed within those restrictions.

Acceptance requires normal clean installations and explicit distinction between hosted compatibility and actual operator-host qualification.

## WORKSTREAM B: S2-A authentication implementation

**Goal:** Advance the integrated synthetic foundations into a production-designed, independently testable authentication implementation that remains inactive operationally.

Authorize code-only implementation of:

- Private owned identity storage, versioned schemas and transactional recovery.
- Argon2id verification, hostile-input validation, throttling and bounded concurrency.
- Principal identity and credential lifecycle.
- Digest-only sessions, rotation, expiration, revocation and restart fencing.
- Centralized default-deny authorization using server-owned actions and resource handles.
- Secure loopback transport contracts, session cookies, CSRF and Host/Origin verification.
- Disabled-by-default login, logout and session pilot endpoints, exercised through synthetic actual-server tests.
- Audit integrity, recovery tests, concurrency tests and security/performance measurements.
- Explicit route-inventory and cutover readiness assessment.

Use the existing S2-A Option 2 design and pinned dependencies as the starting engineering baseline, but do not represent candidate parameter values as ratified production policy.

Unknown authority must fail closed. AGENT identities must never satisfy human-only approvals.

**Production authentication activation is excluded.**

No real credential enrollment, automatic account migration, live grant provisioning, certificate trust installation or privileged-route activation is permitted.

Any new HTTP pilot must be disabled by default and unreachable in the normal production configuration.

Do not silently convert the existing unauthenticated routes into supposedly protected routes without the necessary reviewed cutover and operational authority.

## WORKSTREAM C: WBS governance and atomic registration

**Goal:** Finish as much of the engineering needed for trusted WBS registration as possible without fabricating real governance authority.

Authorize code-only and synthetic implementation of:

1. Trusted public-root acquisition interfaces, using test-only roots.
2. Verified-policy, signer-person independence, epoch, revocation, witness and time validation.
3. Versioned compatibility for ordinary SO+Lead Architect and elevated SO+Lead Architect+Independent Human Approver registration proofs.
4. Replay prevention, durable synthetic receipt consumption and idempotency.
5. Protected compare-and-swap and crash/recovery transaction designs.
6. Applied-state descendant semantics and historical-proof preservation.
7. Negative security regressions, fault injection and offline ceremony simulations.
8. A complete human ratification and bootstrap decision package identifying the actual missing signers, custody requirements and acceptance records.

All real trust anchors and signers must come from independently authenticated human processes. Synthetic people and keys are never operational appointments.

**Prohibited:** applying real WBS changes, merging PR #34, modifying historical receipts, installing production trust roots, enrolling signers or asserting that independent-human quorum was achieved by one operator or an AI.

Keep actual application/receipt authority disabled until competent human governance decisions are recorded.

## WORKSTREAM D: End-to-end product verification

**Goal:** Demonstrate and test the existing local-first DOCMONSTAKRAKIN workflow.

Implement and verify:

1. Synthetic project creation and initialization.
2. Adaptive requirement discovery and coverage updates.
3. Derivation and tracking of linked WorkItems.
4. Kanban/task-board updates through authorized test interfaces.
5. Controlled-document creation, validation and saving.
6. Prompt compilation for external-model handoff without external credentials.
7. Evidence capture, audit display and project-health projection.
8. Recovery, denied-operation and invalid-state scenarios.
9. A deterministic local demo and reproducible browser/API regression.
10. Release-gate evaluation in strictly non-promoting dry-run mode.

Fix correctness and usability issues encountered within this scope.

Do not bypass reviewer gates simply to make the demonstration pass. Use synthetic role fixtures and report blocked operations accurately.

Do not execute Gate 7, declare release readiness without its actual criteria, or activate live agents/external-model control.

## Autonomous PR and merge rules

This standing operator authorization permits the agent to perform **ordinary protected GitHub merges of in-scope, non-activating development PRs without asking me again**, but only when every condition is satisfied:

1. The PR contains only the authorized workstream scope.
2. Its final HEAD has a valid signature.
3. All required CI jobs pass on the exact reviewed HEAD, including Windows qualification where applicable.
4. A genuine independent human reviewer submits APPROVED on that exact HEAD.
5. No blocking review threads or requested changes remain.
6. GitHub reports a clean, permitted merge.
7. The current master baseline is reverified immediately before the guarded merge.
8. No operational security or governance activation is included.

Use the ordinary GitHub merge method with exact expected-HEAD protection. Never bypass branch protections or fabricate human approvals.

After every merge, verify exact master ancestry, signature, tree identity and actual post-merge CI before integrating another PR.

If the HEAD changes, obtain new independent approval and CI. If the merge or post-merge CI fails, stop further integrations, preserve evidence and prepare a bounded corrective candidate.

Human review remains mandatory. This delegation removes repeated **operator merge decisions**, not independent human code review.

## Absolute restrictions

This campaign does not authorize:

- Real identity, credential, signer or root enrollment.
- Production trust establishment or certificate installation.
- Canonical WBS registration or receipt consumption.
- Replacement or relaxation of required human quorum.
- Activating the 14 blocked privileged routes.
- Live agent execution or external-provider credentials.
- Merging unrelated PR #34 or #52.
- Gate 7 execution, release promotion or public deployment.
- Destructive changes to operator data, existing credentials or historical evidence.

Never weaken tests or checks to obtain a passing result.

If a task requires one of these restricted actions, prepare the implementation and precise decision evidence, then continue with the next independent eligible task.

Do not allow one blocked gate to halt otherwise independent engineering.

## Quality and efficiency requirements

Every substantive implementation PR must provide:

- A reproducible defect or acceptance criterion.
- Relevant positive and negative tests.
- Scoped source changes.
- Fresh dependency/security assessment when needed.
- Full regression and controlled-document verification.
- Independent human review.
- Exact-head and post-merge evidence.
- Known limitations and rollback procedure.

Prefer reusable application code and real tested entrypoints over additional theoretical proposals.

Avoid unnecessary closure-only PRs, duplicate reports and repeated approval requests.

Preserve original failure evidence. Never rewrite earlier historical results.

## Durable continuation

Update `docs/08_handoff/FAST_TRACK_DEVELOPMENT_HANDOFF.md` through normal reviewed development changes.

Include the actual latest master, merged and outstanding PRs, completed versus blocked work, supported installation commands, security limitations, and next executable tasks.

Publish a local demo guide and acceptance matrix. Every incomplete feature must be explicitly distinguished from a working one.

The handoff must remain understandable by another AI agent without access to this conversation or temporary Codex state.

## Final report

Return a consolidated report after executing all feasible workstreams:

- Completed and merged implementations.
- Latest signed master SHA.
- Post-merge regression and CI evidence.
- Windows/Linux qualification.
- Authentication functionality implemented versus inactive.
- Governance engineering completed versus human-only gates remaining.
- End-to-end demonstration and acceptance results.
- Outstanding security risks.
- Remaining human decisions required for production and release.

**Begin execution now. Do not stop at planning or request further routine operator approvals.**

If genuine human-only gates cannot be completed, preserve the reviewed implementation candidates and continue other authorized work.

The objective is maximum safe engineering completion within this single authorization, not an unsupported claim of production readiness.