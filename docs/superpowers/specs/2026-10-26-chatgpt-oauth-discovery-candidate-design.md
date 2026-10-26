# ChatGPT OAuth and discovery development candidate

Baseline: master `9814e5e530a144b0f0a066a4c17d8d868dd2e23e`.
Authority: the operator's 2026-10-26 approval of the preceding bounded
code/test candidate and signed draft publication. This is not merge,
installation, enrollment, tunnel, connection, or disclosure authorization.

## Goal and chosen approach

Make nonsecret MCP discovery possible without a DMK grant and add an
unwired, explicitly enabled OAuth resource adapter. Preserve the existing
six-field `read_task(projectId, taskId)` contract and every DMK admission.

Use an established identity provider's authenticated token introspection
(RFC 7662); do not implement a new authorization server, login, token
issuer, registration service, or recovery mechanism. Synthetic fixtures
exercise the resource-server contract. Actual IdP provisioning and
authorization-code/PKCE consent remain unperformed external prerequisites.

Alternatives: a no-auth synthetic connectivity demo would not qualify
private task authorization; hand-building an authorization server adds
unnecessary authority and is excluded. The earlier operator approval
selected the authenticated development candidate, not the demo shortcut.

## Boundaries and interfaces

- Extract shared, fixed discovery responses from `mcpBridge.ts`; the
  existing CLI/private loader and legacy bearer adapter retain their behavior.
- `createMcpDiscoveryResponse(message)` returns only initialize, ping,
  tools/list or notification results. No private acquisition or task data.
- `createMcpOAuthIntrospector(options)` authenticates only resource-server
  introspection requests to an explicitly configured HTTPS IdP endpoint.
  No arbitrary token-supplied URL, redirect, cache, or fallback.
- The IdP issuer and resource are pinned; active status, exact issuer,
  audience, subject, expiry and `task:read` scope are mandatory. Any supplied
  not-before/issued-at claims must also be valid and not in the future.
- Require case-insensitive Bearer `token_type`, explicit authenticated
  `token_use: access`, and absence of `cnf`. This is a conservative custom
  IdP profile, not a generic RFC 7662 interoperability guarantee. Refresh,
  ID and sender-constrained tokens are unsupported and fail closed.
- `createWorkspaceMcpOAuthServer(options)` is disabled unless explicitly
  enabled by trusted calling code. It is not imported by `server.ts` or
  either existing CLI. Its listener is TLS 1.3 on 127.0.0.1 only.
- The resource exposes protected-resource metadata and nonsecret MCP
  discovery before any grant. Tool metadata advertises OAuth scope.
- A tool call first introspects the user token and resolves a current,
  trusted issuer/subject-to-grant binding. Neither HTTP arguments nor
  OAuth claims supply a DMK credential/path or grant authority.
- The binding pins project/task, agent/client/sponsor, grant/session and
  grant revision. Fresh private-file admission and current DMK session
  must match, with exactly one TASKS task, exactly `task:read`, and no
  more than 180 seconds remaining. No grant is issued or renewed here.
- Instantiate the existing reader per admitted call and close all clients.
  Existing skill consultation, revision checks, read acknowledgment,
  uniform denials, and untrusted-data provenance remain necessary.
- Recheck OAuth identity, then current binding and DMK session after the
  read; check both expiries synchronously before replying. These are
  ordered observations, not an atomic cross-system revocation transaction.

The introspection client's client-secret authentication is only its
server-to-IdP credential. It does not authenticate a human by itself and
cannot replace the user token or HUMAN-sponsored DMK grant.

## Resource and transport constraints

Reuse `MCP_LIMITS` unchanged: two concurrent operations, eight connections,
16 KiB incoming messages, 512 KiB output, 30-second operation deadline,
5-second body/write bounds and 1-second shutdown. Introspection also uses
the existing 16 KiB parser and 5-second acquisition bound. No capacity,
audit retention or authority limits are increased.

Reject foreign/duplicate Host or Origin, forwarded authority, cookies,
duplicate Authorization, unsupported paths/content types, malformed or
duplicate-key JSON, oversized input, and unbounded asynchronous work.
Abort on disconnect/deadline; retain slots until underlying work settles.
No permissive CORS, public listener, credential logging or raw error echo.

## Acceptance and evidence

Use synthetic TLS IdP and native schema-3 authority in disposable paths.
Show discovery with no credential file, late grant admission, exact
six-field read/provenance, out-of-scope denial, current user revocation,
actual DMK revocation, wrong issuer/audience/scope/time/subject, mapping
substitution, malformed/oversized input, transport denial, deadline and
capacity rejection. Preserve RED failures and every qualification result.

Run unchanged MCP/security suites, TypeScript, WBS, build, controlled docs,
and complete regression in a disposable clone. Register the new suite in
Windows Agent qualification; normal hosted CI supplies exact-head Linux,
Windows npm/Bun and native/capacity qualification. Do not retry unchanged
failures for a green result or increase timeouts.

## Outstanding operational gates and rollback

Production IdP onboarding, authenticated metadata/trust acquisition,
durable user-to-grant enrollment, canonical public resource identity,
real file/certificate provisioning, actual ChatGPT protocol compatibility,
tunnel installation/permissions and model acceptance remain unqualified.
This code does not provide independent human approval or operational trust.

No existing startup path is wired to the new listener. Roll back by
reverting this isolated candidate; no schema, dependency or state migration
is involved. Stop at draft review. All existing governance restrictions,
both private authorities and historical failure evidence remain intact.
