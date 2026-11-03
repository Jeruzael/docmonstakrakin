# Trusted Local AI Agent Integration (`TRUSTED_LOCAL_AGENT`) — MVP Design & Capability Map

**Date:** 2026-11-04  
**Repository:** `Jeruzael/docmonstakrakin`  
**Base Commit:** `2e546b8c658318f84c3bbe3a3f66ec02c606b6f8` (`origin/master`)  
**Target Branch:** `feat/trusted-local-agent-mvp-20261104`

---

## 1. Objective & Product Direction

Make Docmonstakrakin (DMK) an AI-agent-friendly, local-first SSDLC project management platform where any compatible local AI agent (Codex, Claude Code, Gemini CLI, or custom MCP/HTTPS clients) running under the developer's own local account can connect to DMK, discover its capabilities, and execute a complete vertical workflow from repository analysis through project setup, architecture modeling, adaptive discovery questionnaire, requirements, tasks, SSDLC controls/documentation, and progress reporting — while preserving DMK's native authority integrity and human governance boundaries.

### Explicit Non-Requirements for Local MVP
- Same-user secret isolation, Hyper-V/VM boundaries, cross-principal credential brokers, remote OAuth servers, and public tunnels remain optional future security capabilities (their existing research and evidence are preserved intact).

---

## 2. Capability Map: Existing Functionality vs. New Work

| Workflow Step | Existing DMK Domain Capability | Gap for Local AI Agents on `origin/master` | New `TRUSTED_LOCAL_AGENT` MVP Work |
|---|---|---|---|
| **0. Connection, Enrollment & Discovery** | Loopback TLS 1.3 server (`127.0.0.1:3001`), native SQLite authority (`worker.cjs`), `/api/external/*` endpoints, and stdio/HTTP MCP bridge (`mcpBridge.ts`). | Existing schema-3 agent mode supports only `task:read`, requires 4-step manual sponsor API ceremonies, expires every 3–30 minutes, and requires a 4-request skill consultation per read. | Add opt-in `TRUSTED_LOCAL_AGENT` mode (`DMK_TRUSTED_LOCAL_AGENT=1`) with one-time CLI/API enrollment (`dmk_tla_v1_<64-hex>`), private owner-only registry (`.security-agents/trusted-local-agents.json`), pooled native authority session management, and ready-to-use MCP configs for Codex, Claude Code, and Gemini CLI. |
| **1. Analyze Repository** | Agent uses its own local development tools (`git`, filesystem read, etc.) on the user-provided GitHub URL / local repo. | None (performed by the connecting agent). | Provide structured schema in `create_project` and `upsert_architecture` to ingest repository findings (`repoPath`, languages, frameworks, CI workflows, components, ADRs) with untrusted-content validation. |
| **2. Create Project in DMK** | `POST /api/projects` (`validateProjectDraft`, `computeAssurance`, `DISCOVERY_QUESTION_CATALOG`, `baselineFeatures`, `applicableStandards`). | Requires browser session cookie (`dmk_workspace`) + CSRF token; inaccessible to bearer/MCP agents. | Expose `create_project` operation & MCP tool backed by native `project:create` authority commit. |
| **3. Populate Project Info & Architecture** | `GET/POST /api/projects/:id/components`, `GET/POST/PATCH /api/projects/:id/adrs`, `productBaseline`, `technicalBaseline`. | Requires browser session cookie + CSRF; no batch/idempotent agent tool. | Expose `upsert_architecture` operation & MCP tool to register/update architecture components (`ArchitectureComponent`) and draft `PROPOSED` ADRs (`ADR`). |
| **4. Start Adaptive Requirements Questionnaire** | `GET /api/projects/:id/questions`, `filterQuestionsForProject`, `discoveryGateProjection`. | Requires browser session cookie; returns raw catalog without filtering helper for missing decision-material questions. | Expose `get_discovery_questions` operation & MCP tool returning applicable questions, highlighting unresolved decision-material questions and blockers so the agent never re-asks established facts. |
| **5 & 6. Ask Missing Questions & Record Answers / Assumptions / Decisions** | `POST /api/projects/:id/answers` (`deriveArtifactsFromAnswer`, `calculateDiscoveryCoverage`), `POST /api/projects/:id/adrs`. | Requires browser session cookie + CSRF. | Expose `submit_discovery_answers` operation & MCP tool supporting single or batch answers/deferrals with justification, automatically deriving requirements/features and updating discovery coverage. |
| **7. Generate & Organize Tasks, Dependencies, Priorities & Acceptance Criteria** | `GET/POST /api/projects/:id/work-items` (`DERIVE_REQUIREMENT` via `proposeRequirementWork`, status/checklist updates). | Requires browser session cookie + CSRF; `POST /work-items` only derives from a requirement or updates status/checklist on existing items (cannot create standalone agent-organized tasks or update dependencies/priorities/acceptance criteria). | Expose `manage_work_items` operation & MCP tool supporting: (a) `DERIVE_REQUIREMENT`, (b) creating/updating `PROPOSED`/`BACKLOG`/`READY`/`IN_PROGRESS`/`VERIFICATION`/`DEFERRED` tasks with dependencies, priorities, sprint, acceptance criteria, and checklist items, while blocking `VERIFIED`/`APPROVED`/`RELEASED`. |
| **8. Propose SSDLC Security Requirements, Controls, Verification & Docs** | `POST /api/projects/:id/requirements`, `POST /api/projects/:id/import-sessions`, `createProjectManagedDocumentsRouter` (`/api/projects/:id/docs`). | Requires browser session cookie + CSRF; `projectManagedDocuments` requires `requireHuman` + `humanConfirmed: true`. | Expose `propose_requirements`, `stage_ssdlc_proposals`, and `upsert_project_document` operations & MCP tools. Agent-authored documents are stored in `store.managedDocuments[projectId]` with `governanceApprovalGranted: false` and `authority: 'REFERENCE'`. |
| **9 & 10. Keep Progress, Blockers & Evidence Visible & Continue Updating** | `GET /api/projects/:id/discovery/coverage`, `GET /api/projects/:id/next-action`, `GET /api/projects/:id/release/gates`, `GET /api/projects/:id/risks`, `GET /api/projects/:id/standards`. | Requires browser session cookie. | Expose `get_project_progress` and `get_project_overview` operations & MCP tools returning consolidated readiness metrics, discovery coverage, active blockers, release gates, risks, standards, and task counts. |

---

## 3. Connection, Authority & Session Lifecycle Design

### 3.1 Preserving the Native Authority Contract (`worker.cjs`)
- `server/security/workspaceAccess/worker.cjs` and its schema 1, 2, and 3 invariants remain **100% untouched**.
- All project reads, creations, and writes performed by a `TRUSTED_LOCAL_AGENT` are authorized and durably committed through the existing `WorkspaceStore` (`listProjects`, `authorize`, `commit` / `commitReceipt`) and `authorityCoordinator.runAuthorityOperation` pipeline.
- Existing 87 HTTP route registrations in `API_ROUTE_POLICIES` remain unchanged so all perimeter and cutover suites (`testAuthPilot.ts`, `testSecurityPerimeter.ts`) pass without modification.

### 3.2 Explicit Opt-In & One-Time Local Client Enrollment
- **Opt-In Activation:** Enabled when `DMK_TRUSTED_LOCAL_AGENT=1` is set in the server environment (in `ENFORCED` workspace mode).
- **Enrollment Registry:** Stored at `.security-agents/trusted-local-agents.json` inside the owner-only `.security-agents` directory (verified via `assertPrivateDirectory` / `assertPrivateFile` and owner-only Windows DACL / POSIX `0600` checks, keeping `.security/` strictly limited to `authority.sqlite*`, `owner.lock`, and `tls/{loopback.crt,loopback.key}` as enforced by `privateBoundary.cjs`).
- **Enrollment Record Schema:**
  - `enrollmentId`: UUID v4
  - `clientName`: identifier (`codex`, `claude-code`, `gemini-cli`, etc.)
  - `tokenDigest`: SHA-256 hex digest of the issued `dmk_tla_v1_<64-hex>` bearer token (raw token is never stored in `.security-agents/trusted-local-agents.json`, SQLite, or logs)
  - `sponsorPrincipalId`: human principal ID in `.security/authority.sqlite`
  - `sponsorName`: human principal account name
  - `sponsorCredentialRevision`: integer bound to the human sponsor's `credentialRevision` at enrollment time
  - `workspaceIdentity`: bound to the workspace authority's `provenance.workspaceIdentity`
  - `projectScope`: `{ kind: 'ALL_SPONSOR_PROJECTS', allowCreate: boolean }` or `{ kind: 'PROJECTS', projectIds: string[], allowCreate: boolean }`
  - `capabilities`: explicit list of allowed non-governance capabilities
  - `issuedAt`: epoch ms
  - `expiresAt`: epoch ms (default 7 days = `604,800,000` ms; max 30 days = `2,592,000,000` ms)
  - `revoked`: boolean (`revokedAt?: number`)
- **One-Time Enrollment CLI & Sponsor API:**
  - **CLI (`npm.cmd run security:agent` / `scripts/trustedLocalAgentCli.ts`):**
    - `enroll --sponsor <username> --client <name> [--ttl-hours <hours>] [--origin <https://127.0.0.1:3001>]`
    - Prompts for the sponsor's workspace password via `readWorkspacePassword()`, verifies it against `.security/authority.sqlite` using Argon2id (`BoundedVerifier`), writes the enrollment record to `.security-agents/trusted-local-agents.json`, and writes an owner-only MCP configuration bundle under `.security-agents/mcp-<client-name>/` (`mcp-config.json`, `agent.token`) plus ready-to-paste client snippets for Claude Code, Codex CLI, Gemini CLI, and Claude Desktop.
    - `list [--sponsor <username>]` — lists enrolled local agent clients (without raw tokens).
    - `revoke (--enrollment <id> | --client <name>) [--sponsor <username>]` — immediately revokes the enrollment.
  - **Sponsor HTTP API (`POST /api/external/sponsor-actions`):**
    - Supports `enrollTrustedLocalAgent`, `listTrustedLocalAgents`, and `revokeTrustedLocalAgent` when authenticated as a human workspace principal (`Cookie: dmk_workspace=...` + `X-DMK-CSRF`).

### 3.3 Pooled Native Authority Sessions & 4,096-Entry Audit-Capacity Policy
- **Why Pooling Matters:**
  - `worker.cjs` enforces a hard ceiling of `4,096` rows in `audit`, `used_digests`, and `operations`.
  - Each native `issue` command consumes 1 `audit` row (`SESSION_ISSUED`) and 1 `used_digests` row, and produces a native session valid for 10 minutes idle (`600,000` ms) and 30 minutes absolute (`1,800,000` ms).
- **Session Pooling Strategy:**
  - `TrustedLocalAgentService` caches at most one active native authority session digest in memory per `enrollmentId`.
  - When an enrolled agent makes a request, `TrustedLocalAgentService` reuses the cached native session if it is still within its 10-minute idle / 30-minute absolute window (refreshing `lastSeenAt` on each native `authorize`/`listProjects`/`commit` call).
  - A new native session is issued via `store.execute({ command: 'issue', ... })` **only** when no active pooled session exists for that enrollment.
  - **Audit Reserve Guard:** Before issuing a pooled native session, `TrustedLocalAgentService` checks `info.counts.audit`. If `info.counts.audit >= 3968` (preserving a 128-entry reserve below the 4,096 ceiling for human recovery/administration), session issuance fails closed with `WORKSPACE_AUDIT_RESERVE_REACHED`.
  - **Immediate Revocation Cascade:** Revoking an enrollment (via HTTP or CLI), disabling the human sponsor, or changing/resetting the sponsor's password (`credentialRevision` mismatch) immediately invalidates the enrollment and logs out any pooled native session.

---

## 4. Governance & Security Guardrails (Fail-Closed)

1. **No Human Governance Impersonation:**
   - `dmk_tla_v1_...` tokens are rejected by `/api/projects/*` human cookie middleware and `reviewerAuth.requireHuman`.
   - Every response envelope includes `untrustedProjectData: true`, `authorityGranted: false`, `humanApproval: false`, and `provenance: 'TRUSTED_LOCAL_AGENT'`.
   - Every audit event written by an agent records `actor: "agent:<clientName> (sponsored by <sponsorName>)"` and metadata `{ provenance: 'TRUSTED_LOCAL_AGENT', enrollmentId, clientName, sponsorPrincipalId, governanceApprovalGranted: false }`.
2. **Blocked Privileged & Governance Transitions:**
   - **Canonical Self-Project Protection:** Any read/write targeting `PRJ-DOCMONSTAKRAKIN` or `MASTER_WBS.yaml` is rejected with `CANONICAL_PROJECT_PROTECTED`.
   - **Requirements:** Agent can only create `PROPOSED` requirements or transition non-approved statuses (`PROPOSED <-> IN_REVIEW | DEFERRED`). Attempting `APPROVED` is rejected (`GOVERNANCE_HUMAN_SIGNOFF_REQUIRED`).
   - **ADRs:** Agent can only create/update `PROPOSED` ADRs. Attempting `ACCEPTED` is rejected (`GOVERNANCE_HUMAN_SIGNOFF_REQUIRED`).
   - **Work Items / Tasks:** Agent can create/update tasks in `PROPOSED | BACKLOG | READY | IN_PROGRESS | VERIFICATION | DEFERRED`. Attempting `VERIFIED | APPROVED | RELEASED` is rejected (`GOVERNANCE_HUMAN_SIGNOFF_REQUIRED`).
   - **Approvals, Verification Decisions & Release Sign-Off:** Inaccessible to `TRUSTED_LOCAL_AGENT` (`requireHuman` + specialized reviewer role required).
   - **Destructive Operations:** No project deletion, audit erasure, or authority reset exists.
3. **Version & Concurrency Validation:**
   - All project mutations require `expectedStateVersion` matching `project.stateVersion` (returning `409 STALE_STATE` on mismatch) and commit atomically through `authorityCoordinator.runAuthorityOperation` + `commit`/`commitReceipt` with `operationId` idempotency.

---

## 5. Shared Interfaces: Local HTTPS API & MCP Tool Suite

Both `POST /api/external/actions` (with `Bearer dmk_tla_v1_<64-hex>`) and the MCP Bridge (`scripts/workspaceMcpBridge.ts`) expose the same 12 structured operations:

1. `get_capabilities` — Returns enabled capabilities, project scope, sponsor metadata, and hard governance boundaries.
2. `list_projects` — Lists sponsor-accessible projects (excluding `PRJ-DOCMONSTAKRAKIN`) with summary readiness and `stateVersion`.
3. `get_project_overview` — Returns full project context (metadata, `productBaseline`, `technicalBaseline`, `discoveryCoverage`, `computedRisk`, counts of requirements/components/ADRs/tasks/docs, and current `stateVersion`).
4. `create_project` — Creates a new project from repository analysis (`name`, `description`, `repoPath`, `maturity`, `profiles`, `specializedProfiles`, `deliveryMethod`, `deploymentIntent`, `dataSensitivity`, `productBaseline`, `technicalBaseline`, `assuranceInputs`).
5. `upsert_architecture` — Adds or updates `components` (`ArchitectureComponent[]`) and `PROPOSED` `adrs` (`ADR[]`) discovered from repository structure.
6. `get_discovery_questions` — Returns applicable questionnaire items for the project, categorized into `unresolvedDecisionQuestions` (material questions the agent should ask the user or answer from repo evidence), `establishedByBaselineQuestions`, `answeredQuestions`, and `blockers`.
7. `submit_discovery_answers` — Records one or more questionnaire answers or deferrals (`questionId`, `state: 'ANSWERED' | 'DEFERRED' | 'NOT_APPLICABLE'`, `answer`, `justification`), automatically running `deriveArtifactsFromAnswer` and updating `discoveryCoverage`.
8. `propose_requirements` — Creates or updates `PROPOSED` functional/security/compliance requirements with `statement`, `rationale`, `category`, `priority`, `acceptanceCriteria`, and `standardLinks`.
9. `manage_work_items` — Supports `DERIVE_REQUIREMENT` (deriving linked tasks from requirements), `UPSERT_TASKS` (creating/updating tasks with `title`, `description`, `type`, `priority`, `risk`, `sprint`, `requirements`, `dependencies`, `acceptanceCriteria`, `checklist`), and `UPDATE_TASK_PROGRESS` (updating non-governed `status` and `checklist` items).
10. `upsert_project_document` — Creates or updates a snapshot-backed project document (`PRODUCT | REQUIREMENTS | ARCHITECTURE | SECURITY | VERIFICATION | OPERATIONS`) with content validation and SHA-256 integrity tracking (`governanceApprovalGranted: false`).
11. `stage_ssdlc_proposals` — Stages structured review proposals (`import-sessions`) for human review (`AWAITING_HUMAN_REVIEW`).
12. `get_project_progress` — Returns comprehensive progress, blockers (`nextAction`), release gate statuses (`evaluateReleaseGates`), risks, and applicable standards.
