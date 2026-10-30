# Disconnected MCP OAuth Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and locally qualify the default-disabled discovery-only launcher, with every task read denied.

**Architecture:** Extract unchanged private-file admission, validate a closed private profile, and invoke the merged loopback OAuth adapter with a hard-coded null binding resolver. No authority store or application startup wiring.

**Tech Stack:** Existing Node 22, TypeScript, HTTPS, filesystem admission and disposable TLS fixtures; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-10-30-mcp-oauth-private-launcher-design.md`.

## Global Constraints

No real credentials, grants, IdP enrollment, tunnel/model connection, source publication or merge.
Preserve all existing private-file checks, OAuth token rules, MCP_LIMITS and authority limits.
Use only synthetic disposable fixtures. Keep canonical WBS and historical evidence intact.
The operator authorized continuous bounded execution; no additional routine plan-handoff approval is required.

## Review Focus

1. Disabled operation and module import must not acquire private files or listen.
2. Referenced material must receive the same fresh owner/ACL/link/final-set checks as existing MCP secrets.
3. No profile or caller can inject a successful task binding or bypass OAuth classification.
4. CLI errors, readiness messages and failure paths must not disclose secrets.
5. Real loopback TLS, EOF/shutdown and failed startup must not leave a listener or IdP operation alive.

## Task 1: Shared admission and private profile

**Files:** Create `server/security/workspaceAccess/mcpPrivateFiles.ts`, `server/security/workspaceAccess/mcpOAuthConfig.ts`, `scripts/testWorkspaceMcpOAuthLauncher.ts`; modify `mcpPrivateConfig.ts`.

**Interfaces:** Produce `withPrivateMcpFiles<T>(load:(read:(path:string,max:number)=>Buffer)=>T):T`, `parseMcpOAuthLauncherArgs(args:readonly string[])` and `loadPrivateMcpOAuthConfig(path:string)` as specified above. Existing bridge loader interface stays unchanged.

- [x] Write config/CLI admission tests with literal expected disabled/invalid results, valid synthetic TLS material, malformed and hostile profiles.
- [x] Run the new suite and preserve RED evidence for missing behavior.
- [x] Extract existing admission without changing checks; implement the strict private profile and CLI grammar.
- [x] Run the new checks and existing MCP private-file/security suite; preserve actual results.

## Task 2: Discovery-only lifecycle

**Files:** Create `scripts/workspaceMcpOAuth.ts`; extend `scripts/testWorkspaceMcpOAuthLauncher.ts`.

**Interfaces:** Consume Task 1 profile/args; produce `startMcpOAuthDiscoveryLauncher({enabled?,configPath?})` returning a disabled result or loopback port plus idempotent async close. No binding injection interface.

- [x] Add failing module/default-disabled, actual TLS discovery, OAuth negative/valid-but-denied, transport and child-CLI startup/EOF tests.
- [x] Preserve RED output, implement the bounded launcher and sanitized foreground CLI.
- [x] Run focused GREEN and merged OAuth/native compatibility suites without changing their assertions or deadlines.

## Task 3: Qualification, evidence and review

**Files:** Modify `scripts/runWindowsPrivateQualification.ps1`; create `docs/07_verification/MCP_OAUTH_PRIVATE_LAUNCHER_CANDIDATE_20261030.md`.

**Interfaces:** Register the single new suite in Agent npm/Bun qualification; complete regression discovers it automatically. Publish only local evidence/candidate files in this task.

- [x] Register the suite and document exact scope, schema, synthetic evidence, unresolved provider/binding gates and rollback.
- [x] Run WBS integrity, TypeScript, build, controlled documents, complete regression and applicable security/native suites; preserve every failure. Complete regression FAIL 157/161; final full rerun BLOCKED by local qualification prerequisites, not waived.
- [x] Check changed-file inventory and immutable-path hashes; obtain fresh agent-only whole-branch review. Coverage-only P2 addressed by two passing lifecycle controls on unchanged production code; no fabricated runtime RED bug claim.
- [x] Prepare a signed local candidate if existing signing is available; otherwise retain the exact diff and report the signing prerequisite. Do not push, publish, merge or activate. Source checkpoint `3afb671d5fe857b991399da8845e95cf09b95800` signed and locally verified; full qualification remains FAIL/BLOCKED as recorded above.
