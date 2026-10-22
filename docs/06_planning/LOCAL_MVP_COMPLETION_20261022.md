# Local MVP completion implementation plan — 2026-10-22

> For agentic workers: execute each owned subsystem with test-first changes, independent review and exact-HEAD verification. Routine design and development integration decisions are authorized by the operator; this record is not human governance approval.

**Goal:** Complete the eight requested local-MVP workstreams with usable workflows, truthful projections and reproducible verification.

**Baseline:** `d503323aad1002f7325ba3a45faf4bee261686a9`, tree `faddbcbb18239f701ede1cac9e8fb00bcc22e6fa`; actual master CI [39703341247](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39703341247), four successful jobs, 94 suites / 2,258 reported checks.

**Architecture:** Reuse the current React/Express local application, configured reviewer sessions and atomic ProjectStore snapshot persistence. New evidence and project-document data remain project-bound and server-owned; new routes require explicit fail-closed policy registration. No dependency upgrade or migration of operator credentials is planned.

## Constraints and decision record

- Preserve canonical WBS, historical receipts, quorum, all 14 privileged-route denials, disabled live agents, Gate 7 and release restrictions. PRs #34/#52 stay separate.
- Never manufacture human identities, independence, consent, signatures or retrospective approval. Local roster assertions and synthetic tests must be labeled as such.
- Reuse isolated worktrees and task-owned dependencies; never install through an existing node_modules junction. Do not provision the original host SDK or change operator credentials/data.
- Use ordinary signed commits, normal merges and expected-HEAD guards; preserve genuine failures. Passing candidate checks do not substitute for actual post-merge CI.
- Serialize full/browser/native-heavy test workloads. Independent implementation and lightweight tests may run concurrently in distinct worktrees.
- Unknown measurements remain unavailable. Discovery completion, implementation, technical verification, human review and release permission are separate concepts.

## Workstreams and acceptance

- [ ] **1 Dashboard and discovery gates.** Root owns `src/data/discoveryGates.ts`, `src/data/projectHealthProjection.ts`, dashboard/project-list/report consumers, shared next-action integration and focused tests. Use one wizard-aware required-blocker source for UI and recommendations; expose version/formula/numerator/denominator for discovery, remove 70/40 placeholder claims, and preserve unknown dimensions. No arbitrary weighted health percentage.
- [ ] **2 Reviewer setup.** Reviewer worktree owns identity diagnostics, ReviewerSession UI and tests. GET session may expose aggregate configuration status, never verifier values or roster identities. No default credentials or enrollment; distinguish setup failures, missing roles/person bindings, rejected credentials, rate limits and uncertain requests.
- [ ] **3 Evidence workflow.** Verification worktree owns typed sessions, bounded draft/submission/review services, UI panel and tests. Bind project/task/build/environment/criteria and exact evidence bytes/digests; submitted bundles are immutable. Require project CAS, configured human submitter and distinct-person SO/LA review, reject agents/self-review/tampering/replay. No direct WBS/lifecycle/release apply. Parent owns route policy, App/EvidenceView integration and package bridge.
- [ ] **4 Project documents.** Document worktree owns managed-document schema/service, controlled-doc router/client/UI and tests. Server-generated IDs and virtual paths, bounded text bytes, explicit human confirmation, project/version/digest CAS, audit and atomic snapshot persistence. No caller filesystem authority; existing registered filesystem documents remain compatible. Parent owns collection declaration and package integration.
- [ ] **5 Release and complete health projection.** Root integrates admitted evidence into project/release-scoped read-only evaluation, retaining unknown/untrusted states and separate Gate 7. Define explicit inputs and denominators; future tasks cannot silently dilute current-release progress. Tests cover missing, stale, failed, cross-project and tampered evidence.
- [ ] **6 Complete journey QA.** Exercise actual local UI/API flow through creation, discovery, proposals, work, managed documents, evidence submission/review and export/restart. Include loading/failure/stale-project negatives. Agent tests do not become the outstanding named human browser retest.
- [ ] **7 Reproducible startup.** Verify normal checkout instructions, credential-free local mode, patched runtime/package provenance and persistence/package roundtrip. Distinguish fresh SDK-ready hosted installation from original-host retained-package execution. Preserve installer limitations.
- [ ] **8 Task records and handoff.** Add actual implementation/CI/merge outcomes and remaining human decisions without rewriting historical records or marking canonical tasks complete.

## Review focus

1. Project switching or uncertain request completion must not apply stale UI state or create duplicate side effects.
2. A digest or stored PASSED label alone must not establish authenticated evidence, independent humans or release permission.
3. New document content and evidence inputs must not acquire filesystem, URL, identity, role or registry authority from callers.
4. Atomic snapshot failure, stale versions and replay must preserve prior content, audit and project versions.
5. Legacy snapshots and ordinary projects must remain readable; new collections need explicit persistence/package handling and bounded admission.

## Execution loop

For each subsystem: inspect existing contracts; write and observe focused failures; implement the smallest matching change; run focused/adversarial tests; review the frozen diff; run applicable quality/full/security/controlled-document suites; sign and publish; check actual current master and required exact-HEAD CI before normal integration; verify actual post-merge CI. Append measured results and exceptions as dated checkpoints below.

## Operational decisions still not represented by code completion

Real person appointment/enrollment, production trust/acquisition/custody, canonical WBS application/receipt consumption, privileged activation, live agents, Gate 7 and release promotion remain separately attributable decisions. The operator authorized autonomous engineering choices; no agent review or synthetic assertion is recorded as human ratification.

## 2026-10-22 integration approach

Independently reviewed subsystem commits will be combined in one signed local-MVP integration candidate, then qualified together with the complete regression, browser journeys and four hosted CI jobs. This verifies interactions before master integration and avoids treating individually green subsystem checks as a completed user journey. The first dashboard full-run attempt was stopped after a genuine render failure; its partial logs remain preserved and the correction has a failing-before/passing-after regression.

The integrated local candidate has passed all 20 selected focused scripts and the 52-check actual-server perimeter. Complete real-server journey, final full regression and hosted integration evidence remain pending at this checkpoint; checkboxes represent completion after those qualifications, not implementation alone.
