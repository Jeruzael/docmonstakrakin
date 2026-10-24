# ACCEL-20261024 sponsored agent task-read core evidence

Candidate based on `fec902620145e1526861b20c2c2400d198a1779d`, branch `codex/accel-agent-authority-core-20261024`. Root's portable loader repair `4ba894046d51628a3eec1c8e336b72e42a93d3ff` and its ancestry were normally merged through `f27e127c561e13f30690a4696ab679e66ed8f7a9`. Scope and file ownership are fixed in [the agreed contract](../06_planning/ACCEL_AGENT_AUTHORITY_CONTRACT_20261024.md). No publication or integration of this agent candidate, live grant, HUMAN acceptance or production release is claimed by this lane.

## Implemented bounded behavior

New-only schema 3 adds separate durable agent/client/grant/session records and sponsored management acknowledgments in the existing SQLite worker. Default schema 1 and receipt-only schema 2 remain supported. Agent tokens have a separate syntax and digest domain; HUMAN credentials/review adapters remain unchanged. The only delegated action is `task:read`, through an exact limited projection. Current sponsor OWNER/read policy, credential revision, grant scope, expiry, revocation and generation are required for every session/read. Loss/restoration of ownership cannot revive a revoked grant.

Sponsored enrollment/client/grant/issue/revoke commands are body-bound to an operation UUID, actor, original policy revision and bounded durable acknowledgment. Same-body retries reauthorize before recovering historical IDs without new effects/audit. Secret delivery occurs only on a confirmed first issuance; replay cannot recover or fabricate the token. First writes and their acknowledgment audit commitments are atomic. Existing HUMAN receipt version 1 and global operation collision rules apply in schema 3.

Combined principals/sessions/used digests remain 128/256/4096; added client/grant bounds are 256/512. Agent issuance uses two digest-budget entries, one for token digest and one for permanent session-ID replay fencing. HUMAN operations plus management acknowledgments share the existing total 4096 operation ceiling. Audit remains 4096. Scope/identity/management-result audit commitments are checked on reopen. This is local consistency protection, not anti-rollback custody against a complete rewrite by the same OS account.

Capability metadata explicitly marks agent delegation development-only. Package 13 trusted skills/admission and complete real-client qualification are prerequisites to live activation. Task writes/claims/lifecycle, source-derived ACL intersections, GitHub/direct-provider compatibility, HUMAN enrollment/independence, canonical registration, valuable-data migration and release acceptance remain separate work. No PLANNING_CANDIDATE flag changed.

## Runtime and scheduling

Synthetic fixtures only, Windows x64. Executable:

`C:/Users/HomePC/.codex/worktrees/accel-setup-ws04/docmonstakrakin-version-sync/.local/accel-20261024/node-22.23.4/node.exe`

Read-only regular dependencies and working directory:

`C:/Users/HomePC/.codex/worktrees/accel-setup-ws04/docmonstakrakin-version-sync`

`NODE_PATH` points to that checkout's `node_modules`. The loader is its absolute `file:///.../node_modules/tsx/dist/loader.mjs` URL, and the test source argument is the absolute path under the core checkout. This avoids resolving the source or child loader relative to a temporary fixture directory. Dependency installation, native versions, OS ACL checks, timeouts and audit ceilings were not modified by this lane.

Setup lane explicitly released all Windows-heavy work at 06:40:48 UTC. This lane then reserved native qualification; no intentional install/build/native overlap. Each fixture is created under the resolved temporary parent, has a task-specific prefix, is closed, and is removed only after checking the absolute parent/prefix. No operator workspace is used as test data.

## Preserved red and diagnostic outcomes

- Before implementation: `AS01` failed `Agent service is not implemented`; pure suite 0/1. `AG01` failed `WORKSPACE_INPUT_INVALID` for absent `agentDelegation`; native feature suite 0/1, before boundary acquisition.
- Before management-replay secret handling: `AS05` failed `false !== true`; pure suite 4/5. Existing service rejected the new stable operation input and had no replay acknowledgment behavior.
- First native invocation used a relative test source with the dependency checkout as cwd and failed `ERR_MODULE_NOT_FOUND` before test execution. The invocation was corrected to the absolute source path; no runtime code change or timeout increase was involved.
- Initial fresh-schema smoke: `AG01` 1/1 on Node 22.23.4 after correcting that invocation.
- Core native run, 06:42:58.198–06:44:45.690 UTC: **14/14 PASS**. Command suffix `scripts/testWorkspaceAgentDelegation.ts --mode=core` with the absolute source/loader/runtime described above. This is a selected core run, not capacity/legacy/HTTP/CI qualification.
- Pure service at the pre-final-hardening stage: **5/5 PASS**. It checks token-domain separation, no authority call for invalid/accessor inputs, confirmed-only secret delivery, replay without a token, exact scope forwarding and clock/close denial.
- Host protocol review found that trusting only `replayed:false` could return a candidate token for a malformed acknowledgment. Added AS06 first: **5/6**, `true !== false`. The service now requires matching operation/action/requestHash/original expected policy revision, a bounded resulting policy revision and matching generated first-write IDs. Final pure service result: **6/6 PASS**; malformed/uncorrelated responses return unavailable with no token.
- Focused TypeScript initially found TS2339 in the test's union-array callback. The assertion now uses the two explicitly narrowed result elements. This is a test type correction, with no production or assertion-semantics change; the same focused check then exited 0.

The earlier receipt-core lane's genuine 22.23.4 timeout failures remain recorded in `ACCEL_ACTION_RECEIPT_CORE_20261024.md`; this new work does not rewrite those outcomes. Parent PR 90's AR10 relative child-loader failures are separately diagnosed/owned by root; a passing local absolute-loader invocation is not a claim that the earlier hosted failures passed.

## Final local qualification

All times below are UTC on 2026-10-24. These are explicitly selected runs, not a claimed single default full-suite invocation.

| Command suffix (absolute source path in actual invocation) | Time | Outcome |
| --- | --- | --- |
| `testWorkspaceAgentDelegation.ts --mode=core` | 06:42:58–06:44:45 | 14/14 PASS. |
| `testWorkspaceAgentDelegation.ts --mode=capacity` | 06:45:20–06:54:08 | 4/4 PASS, 8m49s; public-command principal/session/client/grant bounds, shared operation ceiling and audit 4095/4096 atomic rollback. |
| `testWorkspaceStore.ts` (unchanged) | 06:54:35–06:56:23 | 18/18 PASS. |
| `testWorkspaceActionReceipts.ts` at root repair `be9f9e7` | 06:56:23–06:57:42 | **13/14**. AR10's source-relative absolute loader path did not exist in this deliberately dependency-free checkout. Error was `ERR_MODULE_NOT_FOUND` before child SQLite execution; no native timeout. |
| `testWorkspaceAgentDelegation.ts --mode=edges` | 07:00:06–07:00:35 | 3/3 PASS: exact idle/short grant expiry and shared digest budget 4094/4095 -> 4096, including two-entry agent issuance. |
| `testWorkspaceAgentDelegation.ts --mode=service` | 07:00:35–07:00:44 | 1/1 PASS after final service hardening; also same-operation concurrent enrollment produces one effect and stale new-operation policy CAS rejects. This reruns the enhanced AG10, not an additional distinct case. |
| `testWorkspaceActionReceipts.ts --diagnostic=crash` after root portable resolver repair `4ba8940` | 07:02:54–07:03:05 | 1/1 PASS. Existing full receipt suite was **not rerun** after this repair; earlier 13/14 is preserved. |
| `testWorkspaceAgentService.ts` | Final host hardening | 6/6 PASS. |
| Focused TypeScript, CJS execution/syntax, `git diff --check` | Final owned sources | PASS. |

The final default agent script contains **21 distinct native cases**: core 14, capacity 4 and edges 3. Their selected-run union passed; final service behavior was rechecked by the enhanced AG10 and six pure cases. Worker bytes were unchanged across these runs. Edge cases were added after the initial core/capacity runs; the final default full invocation and fresh npm/Bun qualification remain for combined CI. The source hashes below identify the final owned bytes.

Public capacity seeding exercises actual commands; upper-bound operation/digest/audit fixtures also construct explicitly synthetic retained rows in owned temporary SQLite databases. These rows are test data, not real enrollment or external authority evidence. No limit, retry sleep or timeout was increased.

Approximate measured one-runtime total for core + capacity + edges is 11m05s, with the enhanced AG10 adding only its bounded correlation/race checks. Running both dependency configurations is roughly 22 minutes before fresh setup and build overhead. Root selected a separate `WindowsAgentQualification` job, with the existing 30-minute budget and default full suite, rather than silently omitting capacity or extending existing job timeouts. Existing four campaign jobs remain required; this agent candidate additionally needs that fifth qualification job. None of those combined CI outcomes is asserted here.

The exclusive native window ended at **07:03:05 UTC** and was explicitly released to the continuity lane. No native/install/build process remains in this lane. Subsequent work is bounded document/hash/signature work only.

Reproduction uses the recorded Node executable, `NODE_PATH`, dependency cwd, absolute test source and absolute loader. Focused TypeScript command flags were:

```text
--noEmit --target ES2022 --module ESNext --moduleResolution bundler
--allowImportingTsExtensions --allowJs --skipLibCheck --types node
--typeRoots <regular-dependencies>/node_modules/@types
--baseUrl <regular-dependencies>/node_modules
server/security/workspaceAccess/contracts.ts
server/security/workspaceAccess/store.ts
server/security/workspaceAccess/agentService.ts
scripts/testWorkspaceAgentDelegation.ts scripts/testWorkspaceAgentService.ts
```

## Final owned source hashes

| Path | SHA-256 |
| --- | --- |
| `server/security/workspaceAccess/contracts.ts` | `793daf4c08a06bcbced3affeb9e6d2a970123ee887090999ab5a7d77e288d51c` |
| `server/security/workspaceAccess/store.ts` | `f223c8008ce4876d69c1e926f5e07260c3fce9f261679b7afad3b56b1906f7c4` |
| `server/security/workspaceAccess/worker.cjs` | `c1e191ed5d18ea0f57477e54add518a04cdada61eba67f69cdb4b7eaf9ee2e48` |
| `server/security/workspaceAccess/agentService.ts` | `8175bcd5b06a5d1344b26cdbaa8e577e831fe71b844fec539385b8a2728469ee` |
| `server/security/workspaceAccess/agentManagementContract.cjs` | `5ef05824b3143d20b551c1e8e5bc0e6ad6a830ec95d1e6bec32e8972ab93f8fe` |
| `scripts/testWorkspaceAgentDelegation.ts` | `b8a0a6a0f5c74c6d1d43a1d82cceb1b2cca048b6db7eee142901573fb25a82f2` |
| `scripts/testWorkspaceAgentService.ts` | `a66b7e0d260bbdc0519b899a025c4212a6d2b5794d92be2b7110e7c5cf8f51d2` |

Self-review is an agent implementation review, not an independent human/security audit. The substantive host acknowledgment-correlation finding was fixed and tested. Root owns final static review, HTTP/CLI/direct transport, actual app behavior and combined CI. Core tests are synthetic/contract evidence, not live-client capability or package completion. No HUMAN appointment, independent quorum or production authorization is inferred from a Git signature.
