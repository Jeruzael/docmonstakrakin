# Disconnected MCP OAuth launcher candidate

Baseline: master `0e45fa9b2989581568b8addbd3e8b77e8ba916bf`.

Authorization: the operator's 2026-10-30 “Alright, lets do that” response
to the bounded disconnected implementation proposal. Implement and test
this source candidate. No push, PR publication, merge, real IdP account,
credential/grant enrollment, tunnel startup or ChatGPT call is included.
The earlier preparation and provenance checkpoints remain historical.

## Goal and approach

Provide a separate, default-disabled foreground launcher for the merged
OAuth resource adapter. An explicitly enabled discovery-only profile can
serve fixed MCP/OAuth metadata over loopback TLS, but its trusted binding
resolver always returns null. Even a valid OAuth identity receives no
DMK task permission. This candidate opens no WorkspaceStore and reads no
DMK agent credential or operator state.

Reuse existing private-file admission through a behavior-preserving
extraction, rather than duplicate its security checks. Alternatives were
a custom OAuth server (excluded) and a live native binding/schema change
(separate authority scope). No production provider compatibility is
claimed by the synthetic introspection fixture.

## Interfaces and configuration

- `withPrivateMcpFiles<T>(load)` performs the existing bounded descriptor
  reads, canonical-path, owner/ACL, hard-link and final-set revalidation.
  Existing `loadPrivateMcpConfig` behavior and errors remain unchanged.
- `parseMcpOAuthLauncherArgs(args)` admits only `--help`, `--config PATH`
  and the explicit `--enable-discovery-only` switch. Unknown, duplicate,
  secret-bearing and missing-value arguments fail with sanitized errors.
  No environment variable enables the listener or supplies a secret.
- `loadPrivateMcpOAuthConfig(path)` requires an owner-only configuration
  and private referenced files. Exact schema: `DMK_MCP_OAUTH_LAUNCHER/1`,
  `enabled: true`, `mode: DISCOVERY_ONLY`, `port`, `issuer`, `resource`,
  `resourceMetadataUrl`, `tlsKeyPath`, `tlsCertPath`, and `introspection`.
  Introspection contains only `endpoint`, `clientId`, `clientSecretPath`
  and optional `caPath`. No inline secret, token, grant, binding or
  authority path is accepted. All paths are absolute and canonical.
- Reuse existing limits: 16 KiB configuration, 64 KiB TLS/CA material,
  1,024-byte introspection secret/client ID; no transport limit changes.
  URLs are canonical HTTPS without userinfo, query or fragment. The
  introspection endpoint shares issuer origin; metadata is same-origin
  and exactly `/.well-known/oauth-protected-resource` + resource path.
  The private TLS key/certificate must match and cover 127.0.0.1.
- `startMcpOAuthDiscoveryLauncher({enabled?, configPath?})` acquires no
  files/listener when disabled. Explicit enablement and an enabled
  discovery-only profile are both required. It uses the merged branded
  introspector and fixed null resolver without override hooks.
- CLI entrypoint: `scripts/workspaceMcpOAuth.ts`. Startup diagnostics
  contain mode, loopback address/port and denied task access only.
  Configuration paths, secrets and raw errors are not echoed. Close is
  idempotent and closes introspection resources, listener and sockets.
  Foreground CLI stops on SIGINT/SIGTERM or stdin EOF.

## Preserved boundaries

Keep `mcpOAuth.ts`, `mcpOAuthIntrospection.ts`, all MCP_LIMITS, exact
issuer/resource checks, token-use/cnf protection, 4,096-entry authority
ceiling, native schemas, grant rules and existing server entrypoints
unchanged. No fallback authentication or claim normalization. Discovery
is not a task read, human approval or producer provenance.

No canonical WBS, bootstrap-pinned documents, historical evidence,
operator installation, either pilot authority, global settings, trust
policy/quorum, agent writes, Gate 7 or release changes.

## Acceptance and verification

Use new disposable directories, synthetic secrets and certificates only.
Prove default-disabled CLI cannot acquire even a supplied config path;
reject malformed/duplicate/oversized configurations, unknown authority
fields, path aliases, hard links, inline secrets, invalid URLs and TLS
identities. Real loopback TLS introspection/discovery must retain
authentication challenges and deny valid identities without binding.
Negative token profiles, Host/Origin/TLS denial, secret-free CLI failures,
foreground startup/EOF shutdown and module import without activation are
observable behaviors. Existing native OAuth read/revocation suites remain
the compatibility evidence for the unchanged adapter.

Register the new suite in existing Windows npm/frozen-Bun Agent
qualification. Complete regression discovers it automatically. Run the
new suite, existing MCP/security/native suites, WBS, TypeScript, build,
controlled documents and complete regression in isolated fixtures.
Retain failures and distinguish current local results from historical
hosted results; no new hosted qualification is claimed without publication.

## Rollback and remaining gates

Rollback is removal/reversion of this isolated candidate; existing app
startup is untouched. Never roll back by deleting audit data or reverting
an authority schema. Publication and integration need separate decisions.
Real IdP compatibility, persistent authenticated HUMAN binding, operational
configuration, audit headroom and live acceptance remain separate gates.
