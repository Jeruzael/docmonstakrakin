# ChatGPT OAuth and Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one disabled OAuth/discovery code/test candidate as a signed draft PR.

**Architecture:** Share credential-free fixed MCP discovery. A separate, unwired TLS resource adapter performs fresh authenticated IdP introspection and exact current DMK grant admission for each task call.

**Tech Stack:** Existing TypeScript, Node HTTPS, native schema-3 synthetic fixtures; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-10-26-chatgpt-oauth-discovery-candidate-design.md`.

## Global Constraints

No merge, install, real enrollment, tunnel, external model or task disclosure.
Keep all MCP_LIMITS, authority checks and existing entrypoints unchanged.
Use one task, TASKS-only task:read, maximum 180 seconds remaining per grant.
No production trust adapter or authorization server is claimed.

## Review Focus

1. Discovery cannot touch a credential or accidentally execute a tool.
2. OAuth success cannot substitute for exact current DMK grant authority.
3. Revoked user/grant and changed mappings cannot reuse cached success.
4. Deadlines/abort retain aggregate admission until work actually settles.
5. Token, metadata and malformed transport failures never echo credentials.

### Task 1: Shared discovery and introspection

Files: new `mcpDiscovery.ts`, `mcpOAuthIntrospection.ts` beside mcpBridge;
modify `mcpBridge.ts`; new `scripts/testWorkspaceMcpOAuth.ts`.

Interfaces: `createMcpDiscoveryResponse(message)`; `createMcpOAuthIntrospector(options)` returns `verify(token, signal)` and `close()`.

- [ ] Add behavior tests for discovery with no grant and current IdP status.
- [ ] Run RED and retain the feature-missing failure.
- [ ] Implement shared metadata and bounded HTTPS introspection.
- [ ] Run GREEN and existing MCP tests without changing their assertions.

### Task 2: Disabled resource adapter

Files: new `server/security/workspaceAccess/mcpOAuth.ts`; extend new suite.

Interfaces: `createWorkspaceMcpOAuthServer(options)` accepts explicit enable,
TLS/resource/issuer, introspector and trusted `resolveBinding(identity, signal)`;
returns listener port and bounded `close()`.

- [ ] Add RED tests for no-grant discovery, exact binding and denial behavior.
- [ ] Implement transport admission, OAuth challenge/metadata, current binding
      and fresh private-file/current-session checks before the existing reader.
- [ ] Prove GREEN with actual synthetic TLS IdP and native authority; revoke
      the genuine issued grant and reject its previously working credential.
- [ ] Add adversarial time, mapping, parsing, perimeter and resource tests.

### Task 3: Qualification, documentation and draft

Files: register suite in `scripts/runWindowsPrivateQualification.ps1`;
new `docs/07_verification/CHATGPT_OAUTH_DISCOVERY_CANDIDATE_20261026.md`.

- [ ] Run quality, relevant security, controlled-document and full regression
      in disposable contexts; preserve genuine failures and exact tool/tree data.
- [ ] Review the whole diff with a fresh security reviewer; fix supported issues.
- [ ] Inspect secrets/scope; SSH-sign, independently verify signature/tree,
      push a dedicated branch normally and publish DRAFT targeting master.
- [ ] Attach PR and inspect normal hosted qualification. Record exact HEAD,
      synthetic merge identity, jobs and limitations without claiming human review.

The operator approved bounded execution in this session; routine plan
handoff is not an additional approval gate. Installation, operational
authority, real disclosures and merge remain separate decisions.
