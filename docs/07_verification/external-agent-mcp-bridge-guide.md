# DOCMONSTAKRAKIN — External-Agent MCP Bridge Guide (Stage 3)

## 1. Architecture & Security Boundaries

The Docmonstakrakin Model Context Protocol (MCP) bridge (`server/security/workspaceAccess/mcpBridge.ts` and `scripts/workspaceMcpBridge.ts`) provides a **provider-independent, read-only MCP adapter** layered strictly over the PR #95 loopback HTTPS agent client (`scripts/workspaceAgentClient.ts`) and schema-3 authority engine (`server/security/workspaceAccess/agentService.ts`).

### Non-Negotiable Security Invariants
1. **Single Read-Only Tool Contract:** Exposes only `read_task(projectId, taskId)`. No filesystem, shell, Git, secret, project-listing, or write/approval tools exist.
2. **Canonical Self-Project Isolation:** Requests targeting `PRJ-DOCMONSTAKRAKIN` are rejected before any network call (`MCP_INPUT_INVALID`).
3. **Mandatory Two-Stage Skill Consultation:** Every `read_task` invocation authenticates against `/api/external/session`, retrieves and validates `DESCRIPTION` (`/api/external/skills/description`) and `INSTRUCTIONS` (`/api/external/skills/content`) for `AGT-TASK-READ-01`, and only then invokes `/api/external/actions` with the bound `admissionReceipt`.
4. **Exact Six-Field Projection & Correlation:** Verifies `READ_OBSERVATION` (`durable: false`), `requestHash`, `policyRevision`, `snapshotRevision`, `provenance: "AUTHENTICATED_AGENT_READ"`, `humanApproval: false`, and the exact six task fields (`id`, `title`, `description`, `status`, `priority`, `updatedAt`).
5. **Untrusted Data Framing:** All returned task fields are wrapped in a `DMK_MCP_TASK_READ/1` envelope with `untrustedProjectData: true`, `authorityGranted: false`, `humanApproval: false`, and an explicit `dataBoundaryNotice`.
6. **Secret Non-Disclosure:** Raw `dmk_agent_v1_...` bearer tokens are forbidden in CLI arguments (`MCP_CLI_SECRET_FORBIDDEN`), never stored in committed config files, and never echoed in `tools/list`, `tools/call`, or error outputs.
7. **Uniform Sanitized Denials:** Unauthorized, out-of-scope, cross-project, missing, expired, or revoked requests all return an identical `MCP_TASK_READ_DENIED` payload (`isError: true`) with no upstream HTTP status code or existence oracle.

---

## 2. Private Credential File Format

Store the MCP bridge runtime configuration in an owner-only local file outside Git (for example, `C:\Users\<operator>\.dmk-secrets\mcp-bridge-config.json`), with the short-lived agent bearer token stored in a separate owner-only file (`agent.token`):

```json
{
  "origin": "https://127.0.0.1:3001",
  "caPath": "C:\\Users\\<operator>\\.dmk-secrets\\loopback.crt",
  "tokenPath": "C:\\Users\\<operator>\\.dmk-secrets\\agent.token"
}
```

- Config, CA, token and connector-token inputs must use canonical absolute native paths, current-user ownership, single-link ordinary files and private parent directories. On Windows the DACL must admit only the current SID; inherited broad grants, junction/symlink ancestry, alternate spellings and hard links are rejected. On POSIX files require 0600 and private parents 0700. Acquisition checks descriptors and rechecks the entire material set. No ACL repair occurs. This detects observed substitutions; it is not isolation from arbitrary hostile code already executing as the owning OS principal.
- Choose exactly one of token/tokenPath and at most one of connectorToken/connectorTokenPath. Generated configs resolve native paths. Convert copied Windows paths to their canonical backslash spelling; JSON requires escaped backslashes. Obtain any CA copy through a separately authorized setup; this candidate does not touch the existing pilots.
- Never pass `--token` or `dmk_agent_v1_...` on the command line.

---

## 3. Local `stdio` MCP Client Configuration (Task 3.2)

### 3.1 Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "dmk-agent-bridge": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": [
        "--import",
        "file:///C:/Users/HomePC/dev/docmonstakrakin/node_modules/tsx/dist/loader.mjs",
        "C:/Users/HomePC/dev/docmonstakrakin/scripts/workspaceMcpBridge.ts",
        "--config",
        "C:\\Users\\<operator>\\.dmk-secrets\\mcp-bridge-config.json"
      ]
    }
  }
}
```

### 3.2 Gemini CLI (`~/.gemini/settings.json` or `.gemini/settings.json`)

> **Important:** Gemini CLI requires the server alias (`dmk-agent-bridge`) to use hyphens rather than underscores so qualified tool names (`mcp_dmk-agent-bridge_read_task`) parse unambiguously. Keep `"trust": false`; actual confirmation behavior also depends on the installed client policy and any previously granted permissions.

```json
{
  "mcpServers": {
    "dmk-agent-bridge": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": [
        "--import",
        "file:///C:/Users/HomePC/dev/docmonstakrakin/node_modules/tsx/dist/loader.mjs",
        "C:/Users/HomePC/dev/docmonstakrakin/scripts/workspaceMcpBridge.ts",
        "--config",
        "C:\\Users\\<operator>\\.dmk-secrets\\mcp-bridge-config.json"
      ],
      "cwd": "C:/Users/HomePC/dev/docmonstakrakin",
      "timeout": 15000,
      "trust": false,
      "includeTools": [
        "read_task"
      ]
    }
  }
}
```

---

## 4. Local HTTP qualification and ChatGPT boundary

The optional HTTP adapter is a direct loopback SDK test surface, bound to 127.0.0.1 with exact socket-derived Host and Origin checks. It rejects duplicate Host/Origin/Authorization, forwarded headers, cookies, and cross-origin browser requests before any authority dispatch. Native clients may omit Origin. Requests require a separate connector bearer, never a sponsor cookie; task calls also require a current TASKS/read-only grant expiring within five minutes. Unsupported methods return 405. No permissive CORS or tunnel authority is admitted.

CHATGPT_OAUTH_READY: BLOCKED. CHATGPT_CONNECTED: BLOCKED. No ChatGPT connection or external tunnel activation is authorized or established by this candidate.

A static connector bearer is only an isolated SDK fixture mechanism. It is not a supported authenticated ChatGPT connection recipe. Follow [OpenAI authentication](https://developers.openai.com/plugins/build/auth): a separately qualified OAuth 2.1 design needs protected-resource and authorization-server metadata, PKCE S256, issuer/audience/scope checks, expiry and revocation. Evaluate supported CIMD versus DCR registration against the actual client and authorization server. Preferred sequence: assess an existing conforming identity provider, independently review the bridge/token delegation design, then qualify an actual host with synthetic credentials. No custom OAuth provider is implemented here. Secure MCP Tunnel can supply private transport; it neither replaces user authentication nor automatically makes a private OAuth authorization server reachable.

## 5. Candidate resource and compatibility limits

| Boundary | Candidate ceiling |
|---|---|
| Input JSON-RPC message | 16,384 bytes; existing parser depth/node limits retained |
| Output JSON-RPC response | 524,288 bytes; distinct from request size to retain six-field projections |
| stdio admitted messages | 8 including active; 131,072 queued bytes plus one 16,384-byte partial line |
| Concurrent tool operations / HTTP receive-and-work slots | 2; no unbounded authority queue |
| HTTP TCP connections | 8 |
| Complete operation / body receive / output drain | 30 / 5 / 5 seconds |
| Shutdown force-close | 1 second |

These conservative adapter constraints are candidates for review, not production capacity ratification. Upstream five-second socket timeouts and the 4,096-entry private-authority ceiling are unchanged. Read-operation cancellation aborts the actual HTTPS requests; HTTP slots remain occupied until authority work settles. Over-capacity HTTP requests return 503 or a bounded connection rejection; stdio saturation emits a terminal resource error and closes admission, explicitly cancelling the outstanding transport instead of queueing indefinitely. Output backpressure blocks subsequent stdio dispatch. Stdout contains protocol messages only.

Standard MCP stdio uses newline-delimited UTF-8 JSON-RPC. The broken, unnecessary Content-Length compatibility extension was removed. Fragmented newline messages and multiple messages per chunk remain supported; malformed UTF-8 and incomplete EOF fail closed. Content-Length clients must change to standard MCP framing.

## 6. Historical evidence correction and separate acceptance

The original auxiliary live Stage 2 check used a never-issued placeholder token. Its uniform denial cannot prove live revocation and may also reflect unavailable transport. Preserve that original script and receipt unchanged. Original Stage 2 receipt SHA-256: dec2d769351a10bd9227835f263d62dbdb5855bc1f8dec55cbe2923e4560988e. Original Stage 3 receipt SHA-256: 6881ec8ddffb772c9c1a756670b1b6d33f0edc0489a82d8870e0604f734f3ef3. The unsupported claim is superseded by this correction, not rewritten.

The new native schema-3 test issues a genuine short-lived grant through a synthetic HUMAN sponsor, reads with that exact token, revokes through the same current authority, and proves the same token is then rejected. A never-issued token is tested separately. This is agent-executed synthetic evidence, not human acceptance and not a new observation of either existing pilot.

LOCAL_MCP_SERVER and SDK_CLIENT_VERIFIED require their own recorded final checks. REAL_GEMINI_CONNECTED and REAL_CLAUDE_CONNECTED remain NOT_RUN until the actual applications are qualified. HUMAN_ACCEPTANCE: NOT_RUN. PRODUCTION_ACCEPTANCE: BLOCKED. No agent write, independent human quorum, privileged-route permission, WBS application, live-agent activation, Gate 7 or release is granted.
