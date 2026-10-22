# Operational Security Completion Implementation Plan

> **For agentic workers:** use superpowers:executing-plans for the parent integration and isolated parallel agents for independent store, qualification and release-evidence work. The operator explicitly authorized autonomous design/implementation choices.

**Goal:** Implement the remaining technical installation/security/reliability/readiness mechanisms with honest external acceptance gates.

**Architecture:** A new private SQLite authority owns principals, sessions, project policy and the operational project snapshot in one transaction. Existing disconnected synthetic engines remain unchanged. A server-owned per-route policy and browser session boundary protect actual application access; release/governance evidence remains independently scoped.

**Tech Stack:** Existing React/Express/TypeScript, Node22.23.3, better-sqlite313.0.3, Argon20.45.1; no package upgrade.

**Spec:** `docs/superpowers/specs/2026-10-22-operational-security-completion-design.md`.

## Global constraints

- Preserve canonical WBS/history, human-only SO/LA quorum, privileged denials, disabled agents and genuine failure evidence.
- Never fabricate people, approvals, roots, ratification, custody or operator acceptance. Task1 acceptance is deferred.
- No installation through dependency junctions; use isolated, signed work and normal expected-HEAD merges only after required checks.
- Use the exact candidate limits and RPC names in the spec. Retain mayApply:false for canonical governance paths.

## Review focus

1. Revocation/policy changes between admission and commit must reject without partial data or audit writes.
2. Cross-project IDs, import replacement and implicit HEAD/case aliases must not leak or mutate another owner's data.
3. Process failure, full storage, loose permissions, substituted links or uncertain commits must preserve data and fail closed.
4. Session/principal switching must discard previous cached data and personal confirmations; no auto-retry of uncertain mutation.
5. Synthetic/local evidence, a successful CI run and a development waiver must never become independent human production approval.

## Tasks

- [ ] **2 Original-host qualification:** preserve the first clean-install failure; investigate supported Microsoft SDK acquisition; run fresh lifecycle-enabled npm install/audit/native/build gates if prerequisites are satisfied. Record actual OS-consent blockers explicitly.
- [ ] **3 Persistent authority:** add spec-defined contracts/private directory/worker/store. Observe missing-module RED, then test bootstrap/provision, current-session fencing, persisted throttles, policy precedence, snapshot scope/CAS and full-capacity rollback. No HTTP enrollment.
- [ ] **3 Session service/CLI:** reuse bounded Argon verifier; add offline stdin-only initialization/provision/recovery and session/CSRF service. Test exact generation/revision fences, generic login failures, no secret outputs and no default grants.
- [ ] **4 HTTP/persistence/UI:** route every actual API action through current policy, filter lists, atomically persist scoped writes through the authority worker, integrate reviewer principal and UI cache fencing. Actual HTTP tests must deny anonymous, cross-project, forged-role, agent, CSRF and imported-authority attacks.
- [ ] **5 Release evidence:** remove legacy status-only verification/static signoff claims; implement bounded pinned GitHub CI observation and scope-binding tests; keep unmet human/trust gates explicit. Wire readonly authenticated endpoint only after the route policy exists.
- [ ] **6 Reliability/transport:** test restart/lock/corruption/substitution/rollback/capacity and backup/recovery paths; support explicit loopback HTTPS without installing trust roots. Preserve genuine native/toolchain and resource limitations.
- [ ] **7 Governance preflight:** use actual historical/synthetic verifiers for exact evidence observations; reject caller-provided verdicts; report actual missing authority/custody/transaction prerequisites and preserve mayApply:false.
- [ ] **8 Review/integration/handoff:** independent code/security review, focused red/green evidence, full WBS/TypeScript/build/regression/controlled docs, signed PR, four required candidate jobs and actual post-merge jobs before closure. Record operator acceptance as deferred and external governance/release prerequisites as outstanding where still absent.

Each implementation task writes and runs meaningful failing tests before implementation, implements only its owned files, observes green focused checks, and publishes a signed checkpoint for parent review. Heavy host tests are serialized. Final whole-branch review and actual-master CI qualify the combined result; subsystem results alone cannot substitute.
