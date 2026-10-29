# MCP OAuth private launcher — disconnected source candidate

Status: LOCAL_CANDIDATE / COMPLETE_REGRESSION_FAIL / TASK_ACCESS_DENIED /
CHATGPT_ACCEPTANCE_OPEN. Not merge-ready or operationally accepted.
Baseline master: `0e45fa9b2989581568b8addbd3e8b77e8ba916bf`.
Branch: `codex/mcp-oauth-private-launcher-20261030`.

Authority is the operator's 2026-10-30 message accepting the bounded
disconnected source/test proposal. This record is agent-authored evidence,
not a personally submitted GitHub review or independent human quorum.
It does not approve publication, merge, real OAuth provisioning, tunnel
activation, grants, model calls or project disclosure.

## Delivered boundary and exact inventory

| Path | Purpose |
| --- | --- |
| `server/security/workspaceAccess/mcpPrivateFiles.ts` | Extract existing private-file admission without changing its checks. |
| `server/security/workspaceAccess/mcpPrivateConfig.ts` | Reuse the extraction; preserve existing bridge parsing/error behavior. |
| `server/security/workspaceAccess/mcpOAuthConfig.ts` | Strict discovery-only profile and nonsecret CLI grammar. |
| `scripts/workspaceMcpOAuth.ts` | Separate default-disabled foreground launcher with fixed null binding resolver. |
| `scripts/testWorkspaceMcpOAuthLauncher.ts` | Disposable configuration, real TLS/OAuth and child-lifecycle checks. |
| `scripts/runWindowsPrivateQualification.ps1` | Register the new suite for existing npm/frozen-Bun Agent qualification. |
| `docs/superpowers/specs/2026-10-30-mcp-oauth-private-launcher-design.md` | Bounded design and acceptance. |
| `docs/superpowers/plans/2026-10-30-mcp-oauth-private-launcher.md` | Implementation and qualification plan. |
| This document | Evidence, reproducibility and remaining gates. |

No existing application startup route is wired to this launcher. It never
opens a WorkspaceStore, accepts a binding/config override, or reads a DMK
agent token. OAuth identities are authenticated against the configured
introspector and uniformly denied task permission by the fixed resolver.
The unchanged adapter's authentication-linking and loopback boundaries
remain in force. No authority schema or policy was modified.

## Local reproduction and configuration contract

From a qualified checkout with its own existing dependencies:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/workspaceMcpOAuth.ts --help
node --import ./node_modules/tsx/dist/loader.mjs scripts/testWorkspaceMcpOAuthLauncher.ts
npm run ci:quality
```

Running the launcher without its explicit enable flag prints only
`MCP_OAUTH_DISABLED` and exits. A config argument alone does not enable it.
Only the synthetic test starts a listener under this authorization.
Future operator startup requires a separately reviewed private profile
and activation decision; do not submit the ChatGPT plugin form yet.

The private JSON profile has schema `DMK_MCP_OAUTH_LAUNCHER/1`, mode
`DISCOVERY_ONLY`, explicit boolean `enabled`, numeric `port`, exact HTTPS
`issuer`, `resource`, `resourceMetadataUrl`, absolute `tlsKeyPath` and
`tlsCertPath`. Its `introspection` object contains only `endpoint`,
`clientId`, `clientSecretPath` and optional `caPath`. No inline secrets,
DMK credentials, authority paths, bindings, public hosts or extra fields
are accepted. Keep every material file outside Git in an owner-only
operator directory. Private-file admission verifies filesystem security;
it does not implement a repository-wide secret-management system.

Use canonical external resource/metadata identities from the reviewed
tunnel contract. They are separate from internal `/mcp` and
`127.0.0.1` TLS/Host identity. The introspection endpoint must share the
issuer's origin. No forwarded header establishes either identity.
Secrets use exact UTF-8 bytes without control characters or trimming.
Limits remain 16 KiB profile, 64 KiB PEM and 1,024-byte client secret/ID;
MCP_LIMITS and the 4,096-entry native authority ceiling are unchanged.

## Evidence chronology

Evidence streams are retained under local ignored
`runtime/mcp-oauth-launcher-20261030/`. They are supplemental local files,
not GitHub-hosted CI. No raw tokens, private keys or account identifiers
are intentionally logged.

| Checkpoint | Actual result |
| --- | --- |
| Unchanged MCP private/security baseline | 26/26 PASS. |
| New config tests before implementation | RED, 0/10; missing API. |
| Private config implementation | 10/10 PASS. |
| Extracted private admission compatibility | Existing security suite 26/26 PASS. |
| Initial added lifecycle-test parse error | FAIL; preserved `launcher-red.log`, corrected test syntax. |
| Launcher behavior before implementation | RED, 10/11; missing launcher. |
| First implemented full focused run | 18/20; Windows child fixture used a filesystem path instead of a `file:` ESM import URL. |
| Matched child diagnostic | `ERR_UNSUPPORTED_ESM_URL_SCHEME`; normal relative-import launcher was disabled as intended. |
| Corrected fixture full focused run | 20/20 PASS; only test child import changed to `pathToFileURL`. |
| TypeScript after launcher implementation | PASS. |
| WBS integrity, TypeScript, production build | PASS; three existing esbuild `import.meta` warnings retained. |
| First complete regression, frozen index tree `f20654e10f6d323a1b9f09da8ea5aa7151dc5073` | FAIL: 157/161 suites, 3,001/3,006 reported assertions passed, five failures, zero skips. 1,407,209 ms. |
| Controlled-document version synchronization / controlled documents | PASS 50/50 / 87 runner-counted checks in that run. |
| Existing OAuth / MCP security / native MCP authority / TLS | PASS 24 / 26 / 3 / 17 runner-counted checks respectively. OAuth includes the 30-case linking contract; do not add these counts twice. |
| Fresh agent whole-candidate review | No critical/high implementation defect found; P2 lifecycle-coverage request. Agent-only review, not HUMAN approval. |
| Added review controls | PASS 21/21 focused checks in 31,248 ms, including occupied-port startup rejection and active-introspection shutdown within the unchanged 1,000 ms bound. No production change needed for the coverage finding; no original runtime bug/RED fix is claimed. |
| Final source/type/build and document checks after coverage addition | `npm run ci:quality` and `scripts/testControlledDocs.ts` PASS. |
| New hosted CI / fresh installation | NOT_RUN in this local source scope. |
| Human review / operational acceptance | NOT_RUN / OPEN. |

The final 21 focused checks include real loopback TLS 1.3, metadata/tool
discovery without IdP acquisition, correlated linking challenges,
authenticated-but-unbound denial, invalid/revoked/access-token profiles,
foreign Host/Origin/forwarded-header rejection, failed trust/TLS downgrade,
secret-free CLI errors, explicit foreground startup and EOF/idempotent
shutdown. Synthetic introspection is not a qualified real IdP and does
not simulate independent human permission or successful ChatGPT access.

The complete run preceded the final lifecycle-coverage addition. Production
source is identical; only the test and later evidence documentation differ.
The 21/21 focused result is not a substitute for final complete/hosted CI.

### Retained complete-regression failures

| Suite | Observation and disposition |
| --- | --- |
| `testAccountProvisioning.ts` | Windows PowerShell `ConvertTo-SecureString` fails with `CouldNotAutoloadMatchingModule` / `CommandNotFoundException` before the application check. A two-profile synthetic probe reproduced inherited-environment FAIL and Windows-system-module-path PASS. No global module/profile change. |
| `testEnvironmentFixtures.ts` | Initial disposable Git commit exceeded the unchanged 120-second harness bound. The inherited global `commit.gpgsign=true` launched a signer using the operator's configured key while its agent was stopped. The matching orphaned test process tree was terminated after timeout; no signing bypass or global Git-config change. Future fixtures require a separate empty process-local Git profile. |
| `testVitePerimeter.ts` | 24 checks passed; two failed because port 5173 was in use. A fresh loopback bind control still returned `EADDRINUSE`; no owning service was stopped and no port/security assertion changed. The owner/cause of the reservation is unconfirmed. |
| `testWorkspaceAgentDelegation.ts` | 14 checks passed before the unchanged 120-second harness timeout. Cause remains unresolved. This is not a diagnosis of the separate historical hosted AGC1 3,000 ms RPC timeout. |

All full-run outputs are copied under
`runtime/mcp-oauth-launcher-20261030/inherited-run/rc-regression/` before any
subsequent qualification. No assertion, timeout, dependency, audit capacity
or permission check was weakened. A full rerun of the final test revision
is BLOCKED on a qualified environment; no unchanged retry was used to
replace this FAIL. Local Docker's daemon is unavailable; the existing WSL
probe reports Node 18.19.1, which is incompatible with the qualified Node 22
baseline. No Docker service, toolchain install or runtime upgrade was performed.

Supplemental stream digests (SHA-256, exact local bytes):

| Evidence | SHA-256 |
| --- | --- |
| `complete-regression.log` | `9378bc68097398dcb8e83d6fc748fa7c0bf48d9fa8aad64ce4fbfcea42d3a085` |
| `inherited-run/rc-regression/results.json` | `88a03d0f7b763a371e643decda080da2b64095b31e3bac8397af86ba56cfa65a` |
| `lifecycle-review-coverage.log` | `7f0b8e6576e33613966cfc41607298a994e79e3f778fbfe0ae378eff6ac26767` |
| `quality-final.log` | `24e6d61b9541fd799e19f8ebdf6ec885d513b5118c7ea26909dd7afe9c098da7` |
| `controlled-docs-final.log` | `2e82ccb4dd446b537bceb8fd81b8fcec6f92ceb5f0e5f4e92ab87fcf110de6fd` |

All 161 results reported zero mutations of retained bootstrap evidence.
The nine-path candidate leaves canonical WBS, dependency/lockfiles,
historical records, application startup, OAuth adapter and introspector
unchanged. Master was rechecked and remains the baseline above.

The operator made the existing signing agent available; its loaded public
key matches the configured Git signing key. Signing this local candidate
does not imply human review, operational authorization or GitHub-hosted
signature verification. The exact commit/tree and verification result are
recorded in the local `candidate-checkpoint.json` after signing.

Earlier local regression failures, Windows AGC1 and the merged PR #97
chronology remain intact. These focused results neither diagnose nor
close those historical failures.

## Remaining gates and rollback

1. Review/publish the exact candidate and obtain fresh applicable hosted
   qualification before any source-integration decision.
2. Qualify an established IdP's real PKCE/client registration, audience,
   authenticated introspection, genuine access-token marker and revocation.
3. Separately design/authorize persistent HUMAN-to-agent grant bindings
   with native revision, scope, expiry and revocation checks. A profile
   cannot supply such a binding to this candidate.
4. Confirm account/workspace/tunnel permissions, audit headroom, private
   deployment and operator startup. Only then plan live connector
   discovery and the separately authorized three-minute task test.

Rollback removes this isolated launcher candidate; it needs no authority
migration, audit deletion or credential reset. Existing server startup,
canonical WBS, receipts, bootstrap evidence and both pilot authorities
remain unchanged. No real connection, agent write, privileged activation,
Gate 7 or release is accepted by this document.
