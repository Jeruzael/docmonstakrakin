# Security Perimeter Sprint 1 — Route Inventory and Containment

## Current post-merge checkpoint — 2026-10-19

PR #46 is **MERGED_AND_POST_MERGE_CI_VERIFIED** at `f35fa7bcd9fb00942c1bba76741a22a5cc7c80b8`. `jianzhihuoxin` approved its final feature HEAD before merge; post-merge CI `39190812393` passed all three jobs, 65/65 suites and 1,531 observed check outputs, including 51 server and 11 Vite checks. [The additive closure record](PR46_POST_MERGE_CLOSURE.md) preserves exact chronology, commits, URLs and CI-log evidence.

Containment remains partial, full authentication is not implemented, Agent Center live execution remains blocked, Gate 7 is not executed and release is not promoted. The [Sprint 2 portfolio](../04_security/security-authorization-sprint2/hardening.md) is a proposal requiring separate review and implementation authorization.

## Historical pre-publication candidate — preserved

The status and publication statements below describe the original candidate before its review and merge. They are retained as historical evidence; the current checkpoint above supersedes their pending disposition for PR #46.

**Status:** PARTIAL_CONTAINMENT_CANDIDATE / LOCAL_VALIDATION_PASS / HUMAN_REVIEW_PENDING

**Verified starting master:** `132b822979b7084302c7ad5efeb0da1c11607f09`

**Branch:** `codex/security-perimeter-sprint1`

**Authority:** Explicit user-authorized preparatory containment associated with proposed DMK-209; no WBS registration or completion claim.

## Scope decision

The existing application has no general authenticated project membership, workspace administrator or scoped agent dispatcher. A loopback connection, client actor/role/project field, audit name or specialized reviewer cookie is not that authority. Applying reviewer authentication everywhere would invent universal administrators and break ordinary project creation, discovery, editing and package workflows.

The user explicitly permits stopping that portion and publishing an independently passing containment subset. This PR therefore disables all HTTP secret administration, the dedicated AI credential-status API, all repository HTTP access, and agent dispatch. It retains ordinary project/package access as an explicitly documented residual gap. The health response still exposes service, SecretStore provider type and project-count metadata. It does not claim full perimeter authorization, tenant isolation, DMK-209 completion or readiness for shared/remote use.

## Enforced network boundary

- Main service defaults to `HOST=127.0.0.1`, `PORT=3000`. Only that exact bind host and decimal ports 1..65535 are accepted; empty, wildcard, public, IPv6 and malformed values fail before SecretStore initialization, document recovery or persistence.
- Every HTTP request, including static assets and Vite fallback, passes a shared direct-loopback Host check against the actual listening port. Only `localhost` and `127.0.0.1` authorities are accepted. Foreign/null/duplicate Origin, duplicate Host, foreign browser fetch-site metadata, proxy authority claims and malformed/ambiguous path encodings fail closed without reflecting input values.
- Origin, when supplied, must exactly match the direct HTTP authority. No-Origin non-browser local callers remain possible: this is network/browser containment, not user or process authentication.
- The same boundary is installed in direct Vite dev and preview. Resolved configuration rejects public/wildcard CLI overrides. CORS is disabled. Auxiliary WebSocket/HMR listeners are disabled; reload pages manually during development. Production/preview builds remain available locally.
- Unsupported privileged groups deny every HTTP method and case/trailing-slash alias before JSON parsing and project persistence, even with a valid reviewer cookie. Unknown API method/path pairs return 404 instead of falling through to the SPA.
- The existing specialized reviewer context is installed once and its route-specific gate runs before project persistence. The same early gate covers already protected terminal WorkItem transitions; endpoint quorum/evidence/immutability checks still run afterward. No general project authority is added.

## Route inventory

There are **69 explicit method/path registrations**: 52 in `server.ts`, 3 reviewer session, 5 signoff, 4 proposal review and 5 controlled-document routes. GET classifications also cover Express's automatic HEAD dispatch. OPTIONS cannot authorize an operation. Class counts: `LEGACY_LOCAL_UNSCOPED`: 45; `BLOCKED_SECRET_ADMIN`: 7; `SPECIALIZED_REVIEWER`: 7; `BLOCKED_REPOSITORY`: 6; `BLOCKED_AGENT_DISPATCH`: 1; `REVIEWER_SESSION`: 3.

The project boundary column distinguishes required authority from actual checks. URL project selectors and dictionary partitioning provide selection, not authenticated membership. All rows receive the network/browser boundary; only the explicitly blocked groups gain new authorization denial in this partial sprint.

| Method | Path | Required actor / project boundary | Sensitive access | Mutation capability | Pre-sprint enforcement | Containment disposition |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | Local operational caller; no authenticated identity | Service/provider/project-count metadata | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/secrets/metadata` | Workspace secret administrator (not implemented) | Credential metadata / provider status | No | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| POST | `/api/secrets` | Workspace secret administrator (not implemented) | Credential metadata / provider status | Yes / mutation-capable handler | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| DELETE | `/api/secrets/:key` | Workspace secret administrator (not implemented) | Credential metadata / provider status | Yes / mutation-capable handler | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| POST | `/api/secrets/migrate` | Workspace secret administrator (not implemented) | Credential metadata / provider status | Yes / mutation-capable handler | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| POST | `/api/secrets/rotate` | Workspace secret administrator (not implemented) | Credential metadata / provider status | Yes / mutation-capable handler | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| GET | `/api/secrets/rotations` | Workspace secret administrator (not implemented) | Credential metadata / provider status | No | Input/encryption/migration guards; no caller authorization | 403 before parser/persistence |
| GET | `/api/ai/status` | Workspace secret administrator (not implemented) | Credential metadata / provider status | No | Status/immutability guards; no general membership | 403 before parser/persistence |
| GET | `/api/projects` | Workspace/project capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects` | Workspace/project capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/questions` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/answers` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/discovery/coverage` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/derivations` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/features` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/features` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/requirements` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/requirements` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/requirements/:reqId/status` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Status/immutability guards; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/compiler/compile` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/risks` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/threats` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/standards` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/wbs` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/work-items/reconciliation` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/work-items` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Project dictionary lookup; no membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/work-items` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Validation/canonical status ownership; requireHuman only terminal transitions | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/evidence` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/audit` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/audit/verify` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/adrs` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/adrs` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| PATCH | `/api/projects/:id/adrs/:adrId` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/components` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/components` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/next-action` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/overrides` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/export` | Project member/capability required for full auth (not implemented) | Full project package/content | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/package/export` | Project member/capability required for full auth (not implemented) | Full project package/content | Yes: audit (GET and HEAD) | Package integrity/provenance validation; no membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/package/verify` | Workspace/project capability required for full auth (not implemented) | Full project package/content | No canonical mutation | Package integrity/provenance validation; no membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/package/import` | Workspace/project capability required for full auth (not implemented) | Full project package/content | Yes / mutation-capable handler | Package integrity/provenance validation; no membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/release/gates` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/release/signoff` | Configured HUMAN governance reviewer; URL/target checks, no membership | Project artifacts / governance / provenance | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| GET | `/api/repo/status` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | No | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| GET | `/api/repo/diff` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | No | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| POST | `/api/repo/stage` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | Yes / mutation-capable handler | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| POST | `/api/repo/unstage` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | Yes / mutation-capable handler | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| POST | `/api/repo/commit` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | Yes / mutation-capable handler | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| POST | `/api/repo/branch` | Workspace repository authority (not implemented; projectId is not proof) | Workspace Git metadata, paths or diffs | Yes / mutation-capable handler | Owned-Git root, sandbox/path validation; no identity | 403 before parser/persistence |
| GET | `/api/projects/:id/agents` | Project member/capability required for full auth (not implemented) | Demonstration roles/run records | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/agents/:agentId/run` | Project-scoped agent dispatcher (not implemented) | Demonstration roles/run records | Yes / mutation-capable handler | Project role lookup and simulated results; no identity | 403 before parser/persistence |
| GET | `/api/governance/session` | Roster credentials/session holder; no project membership | Own reviewer identity only | No | Roster verifier, cookie session, specialized Origin check | Existing specialized session controls retained |
| POST | `/api/governance/session` | Roster credentials/session holder; no project membership | Own reviewer identity only | Session only | Roster verifier, cookie session, specialized Origin check | Existing specialized session controls retained |
| DELETE | `/api/governance/session` | Roster credentials/session holder; no project membership | Own reviewer identity only | Session only | Roster verifier, cookie session, specialized Origin check | Existing specialized session controls retained |
| GET | `/api/projects/:id/governance-policy` | Project member/capability required for full auth (not implemented) | Project artifacts / governance / provenance | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/approvals` | Configured HUMAN governance reviewer; URL/target checks, no membership | Project artifacts / governance / provenance | No | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| POST | `/api/projects/:id/approvals` | Configured HUMAN governance reviewer; URL/target checks, no membership | Project artifacts / governance / provenance | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| POST | `/api/projects/:id/approvals/:apvId/reissue` | Configured HUMAN governance reviewer; URL/target checks, no membership | Project artifacts / governance / provenance | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| POST | `/api/projects/:id/approvals/:apvId/decide` | Configured HUMAN governance reviewer; URL/target checks, no membership | Project artifacts / governance / provenance | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| GET | `/api/projects/:id/import-sessions` | Project member/capability required for full auth (not implemented) | Proposal, prompt and review context | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/import-sessions/:sessionId` | Project member/capability required for full auth (not implemented) | Proposal, prompt and review context | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/import-sessions` | Project member/capability required for full auth (not implemented) | Proposal, prompt and review context | Yes / mutation-capable handler | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/import-sessions/:sessionId/changes/:index/review` | Configured HUMAN governance reviewer; URL/target checks, no membership | Proposal, prompt and review context | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |
| GET | `/api/projects/:id/docs` | Project member/capability required for full auth (not implemented) | Controlled document content/registry | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| GET | `/api/projects/:id/docs/:documentId` | Project member/capability required for full auth (not implemented) | Controlled document content/registry | No | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/docs/:documentId/diff` | Project member/capability required for full auth (not implemented) | Controlled document content/registry | No canonical mutation | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/docs/:documentId/validate` | Project member/capability required for full auth (not implemented) | Controlled document content/registry | No canonical mutation | Input/target validation where present; no general membership | Unscoped legacy access; residual gap |
| POST | `/api/projects/:id/docs/:documentId/save` | Configured HUMAN governance reviewer; URL/target checks, no membership | Controlled document content/registry | Yes / mutation-capable handler | requireHuman plus endpoint quorum/evidence/target guards | Existing specialized reviewer controls retained |

## Additional integrity correction

Portable-package export creates an audit event despite using GET. Express also invokes it for HEAD, case aliases and a trailing slash. Previously those aliases bypassed the persistence interceptor, mutating audit memory without an atomic snapshot write. The interceptor now covers those actual routing representations. Existing receipt, immutable evidence, approval, document transaction and canonical WorkItem protections are retained.

## Intentionally disabled functionality

- Secret metadata and dedicated AI credential status, credential writes/deletion, migration, rotation and rotation history through HTTP.
- Repository status/diff and stage/unstage/commit/branch operations through HTTP. Separately authorized external Git workflows remain available.
- Agent dispatch, including the old simulated run path. Existing Agent Center records are labeled demonstration examples, not verified execution or independent review.

The UI displays a persistent local-containment notice, repository denial explanation and disabled agent dispatch controls. No insecure bypass flag, new authentication substitute, signer enrollment or live agent executor exists.

## Remaining gaps and staged remediation

1. **Identity and capability design:** Independently review the full local human/agent identity, session and recovery architecture. Define workspace administration, project membership and resource capabilities with explicit deny precedence; keep human governance authority distinct.
2. **Project enforcement:** Implement authenticated membership checks for project listing/reads, creation, discovery, requirements, WorkItems, architecture, evidence, audit, prompts, imports and exports. Bind resource IDs to both the route project and authenticated principal. This includes the currently unscoped package import/overwrite and audit-producing export endpoints.
3. **Reviewer integration:** Preserve quorum and immutable evidence guards, then add project/resource authorization around the existing specialized reviewer workflows. A reviewer roster role alone must never imply universal project access.
4. **Privileged re-enablement:** Re-enable each disabled group only after its real permission model exists and passes anonymous, spoofed, cross-project and denial-without-side-effects tests. No local-owner shortcut is acceptable.
5. **Shared/remote deployment:** Separately approve TLS, trusted proxy authority, origin policy, session transport, secure key custody, abuse controls and process/network exposure. This sprint intentionally supplies no remote-binding mode.
6. **Agent Center:** Live dispatch remains blocked pending scoped, expiring agent delegation, authenticated orchestration, evidence provenance and its own reviewed implementation. Existing demonstration data is not execution proof.

## Reproducible verification

- Existing baseline `npm test`: PASS in a disposable Git clone with synthetic CI state; 14 browser groups passed.
- Actual-entrypoint negative reproduction: original main server yielded **41 failures / 5 controls passed**, including wildcard binding, accepted foreign Host/Origin, administrative handlers and startup credential side effects.
- Original Vite config: **11 failures / 0 passed** for direct dev/preview boundary and configuration checks.
- Added package-export alias regression: failed with unchanged persisted audit count after HEAD/case/trailing-slash export before the persistence correction.
- Run `npx tsx scripts/testSecurityPerimeter.ts` and `npx tsx scripts/testVitePerimeter.ts` against actual application registration/configuration. The former launches the real `server.ts` with an isolated existing SecretStore driver, disposable Git/state/documents, scrubbed environment and synthetic roster credentials. It does not mirror production handlers.
- Run `npm run wbs:check`, `npm run lint`, `npm run build`, `npm run test:complete`, `npm run test:controlled-docs` and the existing server security integration suite in a disposable repository copy. Prepare synthetic CI state only in that copy; never run `ci:prepare` against operator data.
- Existing helper-level/mirrored-route suites remain regression evidence for their own scope; they are not proof of main-app middleware ordering. New actual-entrypoint tests supply that evidence.

### Final local results

All checks ran against matching candidate executable sources in a disposable clone with a fresh `npm ci` from the unchanged lockfile. No operator runtime or credentials were used.

| Check | Result |
| --- | --- |
| `npm run wbs:check` | PASS; zero generated-WBS drift |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing large-chunk advisory only |
| `npm test` | PASS, including all 14 browser groups |
| New actual-server perimeter suite | 51/51 named checks PASS |
| New actual-Vite dev/preview suite | 11/11 named checks PASS; clean process exit |
| `npm run test:complete` | 65/65 suites PASS; 1,531 observed named check outputs, 0 failures/skips; no retained-evidence changes |
| `npm run test:controlled-docs` | PASS; all 11 focused suites, no fixture snapshot mutation |
| Existing `server/security/testServerSecurityIntegration.ts` | 7/7 checks PASS |

The complete runner counts observed named outputs, including compound checks, rather than claiming a count of individual Node assertions. The two new suites contribute 62 outputs; the other 63 existing suites contribute 1,469. Full local result timestamp: `2026-10-19T01:40:31.186Z`; archived result JSON SHA-256: `75ea50fbb963eaec2bba3ce1f97d146166435eac1b08158885cac4d9562819ae`.

Exact signed HEAD, independently attributable review request, remote exact-HEAD CI and any actual human review are recorded on the publication PR timeline. No request or approval is manufactured in this pre-publication candidate. Independent human review and the human merge decision remain separate gates.

### Independent technical review and compatibility corrections

A fresh read-only security reviewer confirmed one unmet ordering requirement: unauthenticated approval requests received the persistence stale-state response (409) before reviewer authentication (401). This pre-existing order was corrected by installing the existing identity context and narrow reviewer gate before persistence. The actual-entrypoint regression now checks both approval and terminal WorkItem aliases; specialized identity is not reused for the disabled administrative groups.

The existing CryptoDemon regression retains its collection-isolation checks and now expects explicit denial for repository/agent dispatch and explicit demonstration metadata. The browser package regression retains all of its import, persistence and conflict assertions. Its trusted test bridge translates Host/Origin when forwarding from the temporary UI server to a different temporary API server; actual deployment uses a single origin, and production cross-origin rejection remains covered by the new negative tests.

The first complete local run passed 63/65 suites. Its failures were the existing account fixture's incompatible inherited PowerShell module search path, and the new Vite fixture retaining filesystem watchers after all 11 assertions passed. The account test is unchanged: local validation uses `cmd.exe` with process-only `PSModulePath=C:\Windows\System32\WindowsPowerShell\v1.0\Modules`. The Vite network fixture uses the existing `DISABLE_HMR=true` watcher switch and restores it afterward; Host/Origin, listener and override assertions remain unchanged. No machine settings, dependency lockfiles or production policy exceptions were introduced.

## Preserved governance

Canonical YAML/generated WBS, historical receipts, bootstrap evidence, Stage B2b2 trust/quorum, PR #34, production credentials/WorkItems/runtime, Gate 7 and release status are unchanged. No DMK-209–214 item is registered or closed.

**Disposition:** `SECURITY_PERIMETER_CONTAINMENT_PARTIAL / HUMAN_REVIEW_PENDING / FULL_AUTHENTICATION_BLOCKED / AGENT_CENTER_LIVE_EXECUTION_BLOCKED`.
