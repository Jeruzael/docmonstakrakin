# Trusted Local AI Agent Integration (`TRUSTED_LOCAL_AGENT`) MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an opt-in `TRUSTED_LOCAL_AGENT` local integration and 10-step vertical SSDLC workflow (from repository analysis and project setup through adaptive questionnaire, requirements, tasks, architecture/security controls, managed documentation, and progress reporting) usable over loopback HTTPS and MCP by Codex, Claude Code, Gemini CLI, and compatible local agents, while preserving DMK's native SQLite authority and human governance guardrails.

**Architecture:**
- Keep `server/security/workspaceAccess/worker.cjs` and `API_ROUTE_POLICIES` (87 routes) untouched so all existing native authority and perimeter contracts remain intact.
- Add `server/security/workspaceAccess/trustedLocalAgent.ts` implementing:
  1. Owner-only enrollment registry (`.security-agents/trusted-local-agents.json`) with `dmk_tla_v1_<64-hex>` tokens, SHA-256 digest storage, human sponsor binding (`sponsorPrincipalId`, `sponsorCredentialRevision`, `workspaceIdentity`), explicit TTL (default 7 days, max 30 days), and immediate revocation.
  2. Pooled native authority session manager that acquires at most one 30-minute native session (`issue`) per active enrollment on demand, reuses it across requests, enforces a 128-entry audit/digest safety reserve below the 4,096 ceiling, and immediately revokes the native session (`logout`) on enrollment revocation.
  3. Capability-scoped SSDLC domain dispatcher executing mutations atomically via `authorityCoordinator.runAuthorityOperation` and `WorkspaceStore` (`commit` / `commitReceipt`) while enforcing `expectedStateVersion`, `operationId` idempotency, untrusted-data framing (`untrustedProjectData: true`), and hard human-governance blocks (`PRJ-DOCMONSTAKRAKIN`, `APPROVED`/`ACCEPTED`/`VERIFIED`/`RELEASED`, approvals, verification decisions, release sign-off).
- Extend `server/security/workspaceAccess/agentHttp.ts`, `server/security/workspaceAccess/mcpDiscovery.ts`, `server/security/workspaceAccess/mcpPrivateConfig.ts`, and `server/security/workspaceAccess/mcpBridge.ts` to support `dmk_tla_v1_<64-hex>` credentials and expose the 12 `TRUSTED_LOCAL_AGENT` tools over both loopback HTTPS (`/api/external/*`) and MCP (`stdio` / `HTTP`), while preserving exact existing behavior for `dmk_agent_v1_<64-hex>` tokens.
- Add `scripts/trustedLocalAgentCli.ts` (`npm.cmd run security:agent`) for one-time local enrollment, listing, revocation, and MCP client config generation for Codex, Claude Code, and Gemini CLI.

**Tech Stack:** TypeScript, Node.js 22.23.3 x64, Express, `better-sqlite3` 13.0.3, `argon2` 0.45.1, TLS 1.3 loopback HTTPS, Model Context Protocol (JSON-RPC 2.0 over stdio/HTTP).

---

### Task 1: Write Failing Unit & MCP Bridge Tests (`scripts/testTrustedLocalAgentMcp.ts`)

**Files:**
- Create: `scripts/testTrustedLocalAgentMcp.ts`

- [ ] **Step 1: Write the failing test suite `scripts/testTrustedLocalAgentMcp.ts`**
  Test:
  1. One-time local enrollment creates an owner-only `.security/trusted-local-agents.json` record without storing the raw `dmk_tla_v1_` token, binds to sponsor `credentialRevision`, and generates ready-to-use MCP configs for `claudeCode`, `codexCli`, `claudeDesktop`, and `geminiCli`.
  2. Pooled native authority session reuses a single native `sessions` row across multiple reads and writes (consuming only 1 `SESSION_ISSUED` audit event across an entire multi-step workflow), and refuses new session allocation when `audit` count reaches the 3,968 reserve threshold.
  3. Revoking the enrollment (or resetting the sponsor's password / disabling the sponsor) immediately invalidates the `dmk_tla_v1_` session and logs out the pooled native session.
  4. MCP bridge (`createWorkspaceMcpBridge` with a `dmk_tla_v1_` token) exposes the full `TRUSTED_LOCAL_AGENT` tool list in `tools/list` while preserving `read_task`-only behavior for `dmk_agent_v1_` tokens.
  5. Hard governance guardrails fail closed: `PRJ-DOCMONSTAKRAKIN` access is denied, requirement `APPROVED` is denied, ADR `ACCEPTED` is denied, and task `VERIFIED`/`APPROVED`/`RELEASED` transitions are denied.

- [ ] **Step 2: Run `node --import tsx scripts/testTrustedLocalAgentMcp.ts` and verify it fails (Red)**

---

### Task 2: Write Failing End-to-End 10-Step Vertical Workflow Test (`scripts/testTrustedLocalAgentWorkflow.ts`)

**Files:**
- Create: `scripts/testTrustedLocalAgentWorkflow.ts`

- [ ] **Step 1: Write the failing E2E vertical workflow test `scripts/testTrustedLocalAgentWorkflow.ts`**
  Simulate a local AI agent given a synthetic GitHub repository (`https://github.com/acme-sec/pulse-ledger-api`) running against a real disposable `ENFORCED` loopback HTTPS server (`server.ts`) + stdio MCP subprocess:
  1. Analyze synthetic repository fixture (TypeScript/Fastify/PostgreSQL service with GitHub Actions CI).
  2. Connect via enrolled `dmk_tla_v1_` MCP bridge and discover capabilities (`get_capabilities`).
  3. Create project **Pulse Ledger API** (`create_project`) with `repoPath`, `productBaseline`, `technicalBaseline`, and `assuranceInputs`.
  4. Populate architecture components (`CMP-API-GW`, `CMP-LEDGER-SVC`, `CMP-PG-STORE`) and `PROPOSED` ADRs (`ADR-001`, `ADR-002`) (`upsert_architecture`).
  5. Start Adaptive Requirements Questionnaire (`get_discovery_questions`) and inspect `unresolvedDecisionQuestions` so only missing decision-material questions are asked.
  6. Submit answers and deferrals with justification (`submit_discovery_answers`), verifying automatic requirement/feature derivation and updated `discoveryCoverage`.
  7. Record additional SSDLC security and functional requirements (`propose_requirements`), all enforced as `PROPOSED`.
  8. Derive work items from requirements (`DERIVE_REQUIREMENT`), organize additional tasks with dependencies, priorities, and acceptance criteria (`UPSERT_TASKS`), and progress tasks through `READY -> IN_PROGRESS -> VERIFICATION` with checklist completion (`UPDATE_TASK_PROGRESS`).
  9. Author project security & verification documentation (`upsert_project_document`) and stage structured SSDLC proposals (`stage_ssdlc_proposals`).
  10. Query consolidated progress, blockers, release gates, and audit trail (`get_project_progress`, `get_project_overview`), and verify human governance boundaries remain enforced (agent cannot ratify requirements/ADRs, mark tasks `VERIFIED`/`APPROVED`/`RELEASED`, or sign off release; human sponsor can still review and sign off through the human governance API).

- [ ] **Step 2: Run `node --import tsx scripts/testTrustedLocalAgentWorkflow.ts` and verify it fails (Red)**

---

### Task 3: Implement `TrustedLocalAgentService`, HTTP Transport, MCP Tools & CLI

**Files:**
- Create: `server/security/workspaceAccess/trustedLocalAgent.ts`
- Modify: `server/security/workspaceAccess/agentHttp.ts`
- Modify: `server.ts`
- Modify: `server/security/workspaceAccess/mcpDiscovery.ts`
- Modify: `server/security/workspaceAccess/mcpPrivateConfig.ts`
- Modify: `server/security/workspaceAccess/mcpBridge.ts`
- Create: `scripts/trustedLocalAgentCli.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement `server/security/workspaceAccess/trustedLocalAgent.ts`**
- [ ] **Step 2: Integrate `TrustedLocalAgentService` into `agentHttp.ts` and `server.ts`**
- [ ] **Step 3: Extend `mcpDiscovery.ts`, `mcpPrivateConfig.ts`, and `mcpBridge.ts` for `dmk_tla_v1_` tokens and client configs**
- [ ] **Step 4: Implement `scripts/trustedLocalAgentCli.ts` and add `"security:agent"` script in `package.json`**
- [ ] **Step 5: Run `scripts/testTrustedLocalAgentMcp.ts` and `scripts/testTrustedLocalAgentWorkflow.ts` and verify they pass (Green)**

---

### Task 4: Write Developer Connection Guide & Run Full Qualification

**Files:**
- Create: `docs/07_verification/trusted-local-agent-integration-guide.md`

- [ ] **Step 1: Write `docs/07_verification/trusted-local-agent-integration-guide.md`**
  Include step-by-step instructions for connecting Codex, Claude Code, Gemini CLI, and custom local agents, capability map, governance guardrails, and remaining future features.
- [ ] **Step 2: Run existing and new regression suites (`testAgentHttp.ts`, `testAgentJson.ts`, `testAgentBodyAdmission.ts`, `testWorkspaceAgentDelegation.ts`, `testWorkspaceAgentApplication.ts`, `testWorkspaceMcpBridge.ts`, `testWorkspaceMcpSecurity.ts`, `testWorkspaceMcpAuthority.ts`, `testSecurityPerimeter.ts`, `testControlledDocs.ts`, `npm run wbs:check`, `npm run lint`, `npm run build`)**
- [ ] **Step 3: Dispatch code-review subagent, address any findings, commit signed changes, push branch, and create Draft PR**
