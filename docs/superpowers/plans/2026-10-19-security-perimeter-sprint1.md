# Security Perimeter Sprint 1 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline with test-driven development and one fresh read-only final review.

**Goal:** Deliver an independently reviewable, signed partial containment PR from master `132b822979b7084302c7ad5efeb0da1c11607f09`.

**Architecture:** Validate loopback configuration before secret initialization. Install a shared HTTP Host/Origin boundary and explicit API classification before JSON parsing and project persistence. Deny secret administration, repository access and agent dispatch where no suitable authorization exists; retain specialized reviewer enforcement without treating reviewers as project administrators.

**Tech Stack:** Existing Express, Vite, TypeScript, Node HTTP, React and disposable subprocess fixtures; no new dependencies.

**Spec:** User-supplied “Security Perimeter Hardening Sprint 1”, 2026-10-19. Autonomous implementation and a partial containment PR are explicitly authorized.

## Global Constraints

- Do not edit canonical WBS, historical receipts, Stage B2b2 policy/quorum, PR #34, production state/credentials, Gate 7 or release status.
- Do not register or close DMK-209–214, grant implicit localhost identity, reuse reviewer identity as general membership, or implement live agent execution.
- Preserve existing reviewer workflows and their immutable-evidence checks.
- Tests run in disposable workspaces with scrubbed credentials; all three remote CI jobs must pass on final HEAD; stop before merge.

## Scope Ruling

Full project-scoped authorization would break existing creation, discovery, editing and package workflows and requires the deferred identity/membership system. Stop that portion as the user directs. Classify these routes as explicitly unscoped legacy access, retain their existing controls, and document exact gaps and staged remediation. Cost: local processes retain access to project data/mutations; this PR cannot be claimed as full authorization or DMK-209 completion.

## Review Focus

- Case/trailing-slash/HEAD aliases must not bypass denied route groups.
- Encoded separators, duplicate headers, forwarding claims and unknown API routes must fail closed.
- Configuration rejection must precede SecretStore and persistence side effects.
- Vite CLI overrides and its preview/HMR listeners must not reopen public interfaces.
- Governance cookies and body actor/role/project claims must not grant unavailable administrative authority.

## Task 1: Audit and reproduce

- [x] Verify remote baseline and use existing isolated worktree on a dedicated branch.
- [x] Independently inspect actual routes, persistence and reviewer identity; identify the compatibility boundary.
- [x] Run baseline `npm test` in a disposable Git clone (PASS, including 14 browser groups).
- [x] Add actual-entrypoint negative tests and observe failures before implementation.
- [x] Produce a 69-route inventory with method/path, required actor, project scope, sensitive data, mutations, prior enforcement and containment disposition.

## Task 2: Shared containment

**Files:** `server/security/localPerimeter.ts`, `server/security/apiRoutePolicy.ts`, `server/security/vitePerimeter.ts`, `server.ts`, `vite.config.ts`, `.env.example`.

**Interfaces:** `resolveLocalNetworkConfig(env): {host:'127.0.0.1';port:number}`; `localRequestBoundary` usable by Express and Connect; explicit API policy matching Express method/path behavior.

- [x] Run failing actual-server tests for listener/configuration, Host/Origin, aliases and denied sinks.
- [x] Implement startup validation and shared boundary before parser/persistence.
- [x] Deny unsupported privileged groups for every method and alias; reject unknown API routes.
- [x] Apply equivalent dev/preview protections and prevent CLI host/HMR bypass.
- [x] Keep legitimate local development and specialized reviewer flows working.

## Task 3: Explain compatibility and verify

**Files:** `scripts/testSecurityPerimeter.ts`, `scripts/testVitePerimeter.ts`, affected UI, security route inventory/report, this plan.

- [x] Explain disabled operations in UI; label existing agent data as demonstration records, not verified execution.
- [x] Prove denials leave snapshots, vaults, documents and Git state unchanged; exercise actual application registration with disposable test identities.
- [x] Preserve old assertions; explicitly update only contract expectations affected by intentional denial.
- [x] Run `wbs:check`, lint, build, complete regression, controlled-document and security integration checks in disposable copies (65/65 complete suites; 62 new actual-entrypoint/Vite checks).
- [x] Fresh independent read-only bypass/regression review; confirm and fix only in-scope findings.

## Task 4: Governed publication

Publication follows this candidate commit. The PR timeline is the authoritative record for completion, exact signed HEAD, request chronology, CI and any actual human review; these events must not be backdated into the candidate.

1. Reconfirm protected files and live data unchanged; SSH-sign and push normally.
2. Open one PR to master with route coverage, negative evidence, compatibility impact and remaining gaps.
3. Request `jianzhihuoxin`; verify signature and all three remote CI jobs on exact final HEAD.
4. Stop unmerged with partial containment, human review pending, full authentication and live agent execution blocked.
