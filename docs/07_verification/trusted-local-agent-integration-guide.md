# Docmonstakrakin — Trusted Local AI Agent Integration Guide (`TRUSTED_LOCAL_AGENT`)

## 1. Overview & Design Philosophy

`TRUSTED_LOCAL_AGENT` mode is an explicit, opt-in local developer workflow (`DMK_TRUSTED_LOCAL_AGENT=1`) that makes Docmonstakrakin (DMK) an AI-agent-friendly, local-first SSDLC project management platform.

When enabled on an `ENFORCED` workspace running over private loopback HTTPS (`https://127.0.0.1:3001`), any compatible local AI agent running under the developer's own local OS account—such as **Claude Code**, **Codex CLI**, **Gemini CLI**, or **Claude Desktop**—can connect to DMK over the standard Model Context Protocol (MCP) stdio bridge or the local HTTPS JSON API, discover its capabilities, and execute a complete 10-step repository-to-SSDLC workflow without requiring VM isolation, cross-principal credential brokers, remote OAuth servers, or public tunnels.

### What `TRUSTED_LOCAL_AGENT` Simplifies
- **One-Time Local Client Enrollment:** Enroll a local agent client (`claude-code`, `codex`, `gemini-cli`) once under your human workspace account via CLI or HTTP sponsor API.
- **Usable, Revocable Multi-Day Sessions:** Enrollments default to 7 days (configurable up to 30 days) and pool a single underlying native authority session in memory so ordinary agent work does not exhaust the 4,096-entry authority audit log or require 3-minute token renewals.
- **Standard 12-Tool MCP Surface:** Exposes 12 structured MCP tools and matching `/api/external/actions` operations covering project creation, architecture & ADR modeling, adaptive discovery questionnaires, requirement proposals, task derivation & organization, SSDLC security control staging, managed documentation, and readiness reporting.

### What Product Protections Are Preserved
- **Native Authority Enforcement:** Every read, project creation, and state mutation executes through `.security/authority.sqlite` (`worker.cjs`) with optimistic concurrency (`expectedStateVersion`, `snapshotRevision`, `operationId`).
- **Explicit Human Governance Sign-Off:** A local agent **cannot** approve requirements (`APPROVED`), ratify ADRs (`ACCEPTED`), mark work items as `VERIFIED`, `APPROVED`, or `RELEASED`, grant governance approvals (`/approvals/*`), record verification sign-off decisions, or execute release sign-off (`/release/signoff`).
- **Canonical Self-Project Protection:** `PRJ-DOCMONSTAKRAKIN` and `MASTER_WBS.yaml` remain strictly off-limits (`CANONICAL_PROJECT_PROTECTED`).
- **Traceable Provenance & Untrusted Content Handling:** All agent mutations record `actor: "agent:<clientName> (sponsored by <sponsorName>)"` with `governanceApprovalGranted: false`, and all responses carry `untrustedProjectData: true`.
- **4,096-Entry Audit Reserve Protection:** Pooled native session allocation halts automatically at `3,968` audit entries (`WORKSPACE_AUDIT_RESERVE_REACHED`), preserving 128 entries for human administration and recovery.

---

## 2. Quickstart: One-Time Enrollment & Server Startup

### Step 1: Initialize Workspace & Loopback TLS (If Starting Fresh)
With the DMK server stopped:

```powershell
# 1. Initialize workspace authority (prompts for human password on console)
npm.cmd run security:workspace -- init --id dev-owner --name dev-owner --person local-dev-owner --can-create --action-receipts

# 2. Prepare owner-only loopback TLS certificate & key (.security/tls/loopback.crt & .key)
node --import tsx scripts/prepareLoopbackTls.ts
node --import tsx scripts/prepareLoopbackTls.ts --check
```

### Step 2: Enroll Your Local AI Agent Client (Server Stopped)
Run the offline enrollment CLI and enter your human sponsor password at the private terminal prompt:

```powershell
npm.cmd run security:agent -- enroll --sponsor dev-owner --client claude-code --ttl-hours 168
```

This command:
1. Verifies your human sponsor password against `.security/authority.sqlite` using Argon2id.
2. Stores only the SHA-256 token digest in `.security-agents/trusted-local-agents.json` (protected by owner-only Windows DACLs / POSIX `0600`).
3. Writes an owner-only MCP configuration bundle to `.security-agents/mcp-claude-code/`:
   - `.security-agents/mcp-claude-code/agent.token` (contains the `dmk_tla_v1_<64-hex>` bearer token; never passed on the command line)
   - `.security-agents/mcp-claude-code/mcp-config.json` (references `origin`, `caPath`, and `tokenPath`)
4. Prints ready-to-copy MCP configuration snippets for **Claude Code**, **Codex CLI**, **Gemini CLI**, and **Claude Desktop**.

> **Alternative (Online Enrollment via Human Session):**  
> When the server is running with `DMK_TRUSTED_LOCAL_AGENT=1`, an authenticated human user can also enroll, list, or revoke clients via `POST /api/external/sponsor-actions` with `action: "enrollTrustedLocalAgent"`, `"listTrustedLocalAgents"`, or `"revokeTrustedLocalAgent"`.

### Step 3: Start DMK with `TRUSTED_LOCAL_AGENT` Enabled
```powershell
npm.cmd run build
$env:NODE_ENV = 'production'
$env:PORT = '3001'
$env:DMK_WORKSPACE_ACCESS = 'ENFORCED'
$env:DMK_TRUSTED_LOCAL_AGENT = '1'
$env:DMK_TLS_CERT = '.security/tls/loopback.crt'
$env:DMK_TLS_KEY = '.security/tls/loopback.key'
node --import tsx server.ts
```

Verify discovery reports `TRUSTED_LOCAL_AGENT` as enabled:
```powershell
curl.exe --cacert .security/tls/loopback.crt https://127.0.0.1:3001/api/external/discovery
```

---

## 3. Connecting Compatible Local AI Agents

All compatible MCP agents connect through `scripts/workspaceMcpBridge.ts` using `--config <repoRoot>/.security-agents/mcp-<client-name>/mcp-config.json`. Raw tokens are **never** passed in CLI arguments (`MCP_CLI_SECRET_FORBIDDEN`).

### 3.1 Claude Code (`.mcp.json` or `claude mcp add`)
Add to your project `.mcp.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "dmk-agent-bridge": {
      "type": "stdio",
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "C:\\Users\\HomePC\\dev\\docmonstakrakin\\scripts\\workspaceMcpBridge.ts",
        "--config",
        "C:\\Users\\HomePC\\dev\\docmonstakrakin\\.security-agents\\mcp-claude-code\\mcp-config.json"
      ]
    }
  }
}
```

### 3.2 OpenAI Codex CLI (`~/.codex/config.toml`)
Add to `~/.codex/config.toml`:

```toml
[mcp_servers.dmk_agent_bridge]
command = "node"
args = [
  "--import",
  "tsx",
  "C:\\Users\\HomePC\\dev\\docmonstakrakin\\scripts\\workspaceMcpBridge.ts",
  "--config",
  "C:\\Users\\HomePC\\dev\\docmonstakrakin\\.security-agents\\mcp-codex\\mcp-config.json"
]
```

### 3.3 Google Gemini CLI (`~/.gemini/settings.json`)
Add to `~/.gemini/settings.json` (or `.gemini/settings.json`):

```json
{
  "mcpServers": {
    "dmk-agent-bridge": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "C:\\Users\\HomePC\\dev\\docmonstakrakin\\scripts\\workspaceMcpBridge.ts",
        "--config",
        "C:\\Users\\HomePC\\dev\\docmonstakrakin\\.security-agents\\mcp-gemini-cli\\mcp-config.json"
      ],
      "trust": false,
      "includeTools": [
        "get_capabilities",
        "list_projects",
        "get_project_overview",
        "create_project",
        "upsert_architecture",
        "get_discovery_questions",
        "submit_discovery_answers",
        "propose_requirements",
        "manage_work_items",
        "upsert_project_document",
        "stage_ssdlc_proposals",
        "get_project_progress"
      ]
    }
  }
}
```

### 3.4 Revoking an Enrolled Local Agent
- **Offline CLI (server stopped):**
  ```powershell
  npm.cmd run security:agent -- list
  npm.cmd run security:agent -- revoke --client claude-code
  ```
- **Online Sponsor API (server running):**
  Send `POST /api/external/sponsor-actions` with `{ "version": 1, "action": "revokeTrustedLocalAgent", "operationId": "<uuid>", "clientName": "claude-code" }`.
- **Automatic Cascade:** Resetting or rotating the human sponsor's password (`credentialRevision` increment) or disabling the sponsor principal immediately invalidates all enrollments sponsored by that human.

---

## 4. End-to-End 10-Step Vertical Workflow & Capability Map

When a user gives a connected local AI agent a GitHub repository URL (or local repository path), the agent executes the following 10-step workflow using DMK's 12 MCP tools:

| Step | Agent Action | MCP Tool / Local API Operation | Underlying DMK Services Reused |
|---|---|---|---|
| **1** | Analyze repository structure, stack, dependencies, auth model, and CI workflows using local dev tools (`git`, file read). | `get_capabilities`, `list_projects` | `TrustedLocalAgentService`, `WorkspaceStore.listProjects` |
| **2** | Create project in DMK with discovered metadata, profiles, assurance inputs, `productBaseline`, and `technicalBaseline`. | `create_project` | `validateProjectDraft`, `computeAssurance`, `baselineFeatures`, `applicableStandards`, `DISCOVERY_QUESTION_CATALOG`, `WorkspaceStore.commit` (`project:create`) |
| **3** | Populate architecture components (`ArchitectureComponent[]`) and draft `PROPOSED` architectural decision records (`ADR[]`). | `upsert_architecture` | `validateText`, `project.components`, `project.adrs`, `WorkspaceStore.commit` |
| **4** | Start Adaptive Requirements Questionnaire and inspect applicable vs. answered vs. unresolved decision-material questions. | `get_discovery_questions` | `filterQuestionsForProject`, `projectQuestionCatalog`, `discoveryGateProjection`, `calculateDiscoveryCoverage` |
| **5** | Ask the user **only** unresolved decision-material questions not already established by repository evidence. | *(Agent conversation turn filtered by `unresolvedDecisionQuestions`)* | Prevents redundant questioning on facts already answered in Step 2/4. |
| **6** | Record questionnaire answers/deferrals, assumptions, and decisions; automatically derive baseline requirements. | `submit_discovery_answers`, `upsert_architecture` | `deriveArtifactsFromAnswer`, `calculateDiscoveryCoverage`, `generateUniqueRequirementId` |
| **7** | Derive tasks from requirements and organize tasks with dependencies, priorities, sprints, acceptance criteria, and checklists. | `manage_work_items` (`DERIVE_REQUIREMENT`, `UPSERT_TASKS`, `UPDATE_TASK_PROGRESS`) | `proposeRequirementWork`, `store.workItems`, task dependency & cycle validation |
| **8** | Propose SSDLC security requirements, verification activities, staged review proposals, and managed SSDLC documentation. | `propose_requirements`, `stage_ssdlc_proposals`, `upsert_project_document` | `validateRequirementId`, `store.importSessions`, `validateProjectManagedDocuments` (`authority: 'REFERENCE'`, `governanceApprovalGranted: false`) |
| **9** | Keep progress, discovery coverage, next-action blockers, release gates, risks, and applicable standards visible in DMK. | `get_project_progress`, `get_project_overview` | `evaluateReleaseGates`, `discoveryGateProjection`, `store.risks`, `store.standardMappings` |
| **10** | Continue updating task progress, checklists, architecture, and documentation through version-checked DMK operations. | `manage_work_items`, `upsert_project_document`, `propose_requirements` | Optimistic concurrency (`expectedStateVersion`) + idempotency (`operationId`) |

---

## 5. Remaining Future Features for Full Agent-Driven Project Management

While this MVP delivers a complete local repository-to-SSDLC vertical workflow, the following capabilities remain future milestones:

1. **Interactive UI Diff & Batch Promotion Workbench for Agent Proposals:**
   - Dedicated UI review queue allowing a human Lead Architect or Security Officer to inspect side-by-side diffs of agent-proposed requirements (`PROPOSED`), ADRs (`PROPOSED`), and staged import sessions (`PENDING_REVIEW`) and batch-approve them with human sign-off.
2. **Automated Git Commit / PR Evidence Linking:**
   - Webhook or local Git hook integration linking commit SHAs, test runner receipts, and pull request URLs directly to DMK `WorkItem` verification evidence records.
3. **Multi-Repository & Portfolio Dependency Graphs:**
   - Cross-project dependency tracking when an organization decomposes a system across multiple microservice repositories in DMK.
4. **Controlled Audit Archival / Compaction Utility:**
   - Offline human-signed maintenance command to archive and roll over historical audit records when a long-lived workspace approaches the 4,096-entry authority audit ceiling.
5. **Optional High-Isolation Deployment Modes (Preserved Research):**
   - Cross-principal OS credential brokers, Hyper-V/VM sandbox boundaries, remote OAuth 2.1 authorization servers, and Secure MCP Tunnels remain preserved in the repository for future enterprise/untrusted-agent deployments.
