# Stage 3 MCP security remediation candidate — 2026-10-25

Authorization: operator-supplied **Stage 3 Security Remediation Mandate** in this conversation. This record is agent-authored execution evidence, not a personally submitted human GitHub review, independent human quorum or operational acceptance.

Baseline: `27fbec2a359071c7d2994dd49109145228ff016e`, tree `c74472c4054bdbca5e292dbf23d775e974da4193`; independently fetched master matched before editing. Branch: `feat/external-agent-mcp-bridge-20261025`. The original five staged files were copied before editing. Original bridge SHA-256: `d5f4d72eeaef5dce7c3899e6ef5d396e7ed1727bcd455d5dadc258268ef22fa8`; original test: `7634e537e34d733055a4aff1c4aaa7bd4b84a5be8e049e3ac87599c7853d79f6`; original CLI: `8a907573bb3582fa09b1a7f0eaa938baf46b4c9a80d7cfe27970372fb5bd7aec`.

## Finding disposition

The six corrections are implemented and locally exercised. Formal closure remains **OPEN pending final qualification, signed publication, exact-head hosted CI and independent review**. Stage 3 is not complete.

| Finding (closure status) | Candidate correction and evidence |
|---|---|
| HTTP admission — OPEN pending qualification | Exact 127.0.0.1/socket-port Host; raw duplicate checks; existing local perimeter validates Origin and rejects forwarded headers before bearer/authority work. Real loopback/raw-header negative tests and native SDK positive controls. |
| Private files — OPEN pending qualification | Canonical ancestry, owner/private DACL or POSIX mode, single-link file, bounded descriptor read and before/open/after/set rechecks. MCP-owned uncached Windows owner/DACL acquisition closes the shared DACL-pin owner gap. Actual hard-link, junction, broad/inherited ACL and replacement negatives; synthetic owner-acquisition denial after pinning. |
| Aggregate resources — OPEN pending qualification | Explicit concurrency, pending count/bytes, input/output, receive/execution/write deadlines, cancellation, backpressure and bounded shutdown. Burst, held work, slow body, output, active/queued cancellation and shutdown cases. No authority ceiling change. |
| Framing — OPEN pending qualification | Removed unnecessary Content-Length extension; byte-preserving standard newline MCP only. Complete/fragmented/multiple-message controls; invalid UTF-8, unsupported framing and incomplete EOF rejection. This is an explicit compatibility correction. |
| ChatGPT guide — OPEN pending qualification | Unsupported static-bearer connection recipe removed; OAuth 2.1/CIMD/DCR qualification remains separate and BLOCKED. No OAuth provider, public tunnel or ChatGPT connection was implemented. |
| Revocation evidence — OPEN pending qualification | Preserved and corrected the never-issued placeholder claim. New real native schema-3 fixture issues a token through synthetic current HUMAN sponsor authority, reads with that token, revokes its grant, and rejects the same token; never-issued token tested separately. SDK test repeats genuine revocation on both transports. |

## Changed-file inventory

Original five files retained and corrected:

- `server/security/workspaceAccess/mcpBridge.ts` — existing read-only contract; bounded/cancellable core; delegates corrected acquisition/transports.
- `scripts/workspaceMcpBridge.ts` — original CLI retained.
- `scripts/testWorkspaceMcpBridge.ts` — original 17 cases retained; standard framing, private synthetic fixtures, deterministic drain, nonzero failure exit.
- `scripts/runWindowsPrivateQualification.ps1` — registers the three MCP suites in existing Agent qualification, without changing its environment/timeout contracts.
- `docs/07_verification/external-agent-mcp-bridge-guide.md` — corrected compatibility/authentication/qualification boundaries.

Necessary remediation additions/delta:

- `server/security/workspaceAccess/mcpPrivateConfig.ts` — MCP-specific acquisition; shared authority helper remains unchanged.
- `server/security/workspaceAccess/mcpTransport.ts` — bounded stdio and direct-loopback HTTP adapters.
- `scripts/workspaceAgentClient.ts` — optional AbortSignal reaches each actual HTTPS request; existing TLS/socket/body contracts retained.
- `scripts/fixtures/mcpAuthority.ts` — disposable genuine native schema-3 authority fixture.
- `scripts/testWorkspaceMcpSecurity.ts` — adversarial/regression cases.
- `scripts/testWorkspaceMcpAuthority.ts` — genuine issuance/read/revocation versus never-issued denial.
- `scripts/verifyWorkspaceMcpSdk.ts` — portable SDK qualification with an explicit external tool path/version.
- This checkpoint.

No package/lockfile, runtime-authority engine, canonical WBS, historical receipt or bootstrap-pinned document change is included.

## Candidate decisions and limits

Decisions follow the bounded operator mandate; they do not ratify production budgets. See the guide for the full table: input 16 KiB, output 512 KiB, eight stdio messages/128 KiB queue plus one partial input, two operations/HTTP slots, eight TCP connections, 30-second operation, five-second receive/write, one-second shutdown. Upstream five-second socket timeouts and 4,096-entry authority ceiling remain unchanged. The 512 KiB output ceiling accommodates the maximum escaped 65,536-byte description plus framing, independently of request size.

No tunnel-origin allowlist is added. Only direct loopback SDK HTTP is qualified. Standard newline framing is retained; custom Content-Length clients are intentionally rejected. A saturated stdio connection receives a terminal resource error and cancels admission, rather than retaining an infinite queue. Cancellation of queued requests returns `-32800` without authority dispatch.

## Evidence, failures and independent review

Windows x64, Node 22.23.3, npm 10.9.9. Existing regular native dependencies were used, never the original operator junction. Disposable regression checkout received a separate regular copy of those dependencies. This is retained-native runtime qualification, **not a clean Windows installation claim**. No SDK extraction/installation was performed.

Original independent review: `C:/Users/HomePC/.codex/reviews/mcp-bridge-20261025/REVIEW.md`. Original Stage 2/3 receipts remain unchanged; their digests and the evidence correction are in the guide.

RED on original staged code: 2 passing / 12 failing checks. Expanded original-code run: 3 passing / 16 failing; documentation was already corrected in that expanded run. Its failures additionally demonstrate invalid UTF-8 repair, material-set replacement, output overflow, cancellation and receive-deadline gaps. Independent review found queued cancellation and stale owner pins in the first remediation candidate. Queued cancellation reproduced 19 PASS / 1 FAIL before correction. After correction the focused security suite reports 26/26, original MCP suite 17/17, native authority 3/3, and real SDK 1.17.0 4/4. These are distinct checks, not a fabricated total of human observations.

An independent read-only agent reviewed the complete diff, reported the two additional gaps and rechecked their corrections. No other concrete source-backed issue was found in the inspected boundaries. That review is not human GitHub approval. Actual foreign-owner reassignment was unavailable on this host; file/parent owner denial and final-set reacquisition were exercised by subprocess-boundary fault injection. Other Windows filesystem tests use actual native objects. POSIX execution and actual application-host connections remain separately unverified.

Initial full regression retained these failures: AccountProvisioning could not load Windows PowerShell Security under the inherited module path; EnvironmentFixtures inherited operator SSH signing and timed out on a synthetic initial commit; ControlledDocVersionSync Scenario 1&2 page navigation exceeded its existing eight-second limit, while Scenarios 44 and 47 passed. No runtime/test timeout was increased. A later pass cannot itself diagnose the navigation timeout. The synthetic signing process chain was stopped after preserving its identity and timeout evidence; operator signing remains enabled.

The bounded final qualification uses a separate process-only synthetic Git config and Windows PowerShell 5 module path inside the disposable checkout. It does not alter operator Git configuration, signing keys, modules or installation. Initial fixture initialization correctly refused without an explicit test-mode flag; that refusal is preserved. The successful explicit test-mode initializer ran only in the disposable checkout. The initial full run (before final owner/cancellation/output-lifecycle corrections) completed 159 suites: 155 passed, 4 failed; 2,951 passing and 4 failed reported checks. The fourth failure was the unchanged 120-second WorkspaceAgentDelegation harness deadline after 14 passing outputs. This run does not qualify the later final diff. Its results JSON SHA-256 is b2611a62ab9bb49ae3237eff11138c8328489b84c8a84582ec8d49bcb88b35a2.

Execution logs and originals are retained in the target-bound Codex Security artifact collection under `artifacts/stage3-remediation/`. Important initial failure digests: AccountProvisioning `8faa4ba4950c948fa1333960a9b9fb352548b0c330c1a9dbecc3ed89d33d421d`; ControlledDocVersionSync `b3c3d8fc500d1bf6d88a2bf8fe1577e278160850ab77d94c3e235bf833d0099c`; EnvironmentFixtures `b47c8c2591df0988f26940d297f7c9224f4b92c81e9a798c9b39169f50eb2d48`. Source tests and commands remain usable from an ordinary checkout.

## Reproduction and gates

Run in an isolated regular checkout with genuine native dependencies:

```powershell
node --import tsx scripts/testWorkspaceMcpSecurity.ts
node --import tsx scripts/testWorkspaceMcpBridge.ts
node --import tsx scripts/testWorkspaceMcpAuthority.ts
# External test tool, not a repository dependency or an application-client claim:
$env:DMK_MCP_SDK_ROOT = '<existing @modelcontextprotocol/sdk 1.17.0 package root>'
node --import tsx scripts/verifyWorkspaceMcpSdk.ts
npm run wbs:check
npm run lint
npm run build
# Disposable fixture checkout ONLY, with isolated Git/PowerShell environment:
$env:DMK_ALLOW_CI_FIXTURE = '1'
node --import tsx scripts/prepareCiRuntime.ts
npm run test:complete
```

The final-source focused security suite passes 26/26, including blocked output destruction and asynchronous terminal-output error handling. RED for the blocked-output gap was 24 PASS/1 FAIL; RED for the terminal-output gap exited 1 with an unhandled error before correction. Independent rechecking retained the original review findings and validated normal child-pipe EOF behavior. TypeScript/lint, WBS and build passed locally; the final-source complete regression remains FAILED as recorded below. No candidate commit, PR or hosted CI is asserted by a staged diff. Required hosted qualification includes the existing four CI jobs **and** the already-existing Windows Agent Qualification job with lifecycle-enabled npm and frozen Bun paths. Both installations remain NOT_RUN locally.

| Status | Disposition |
|---|---|
| LOCAL_MCP_SERVER | PASS in disposable local tests; fixtures closed afterward; no operator listener activated |
| SDK_CLIENT_VERIFIED | SDK 1.17.0 stdio/HTTP qualified against genuine synthetic native authority |
| REAL_GEMINI_CONNECTED | NOT_RUN |
| REAL_CLAUDE_CONNECTED | NOT_RUN |
| CHATGPT_OAUTH_READY | BLOCKED |
| CHATGPT_CONNECTED | BLOCKED |
| HUMAN_ACCEPTANCE | NOT_RUN |
| PRODUCTION_ACCEPTANCE | BLOCKED |
| Signed commit / draft PR / hosted CI | BLOCKED by the failed complete-regression gate; existing signing key became available after the operator unlocked it |

Additional qualification limitations: the existing Ubuntu WSL runtime was Node 18 and lacked a C++ toolchain. A disposable Node 22.23.3 runtime under /tmp was downloaded from nodejs.org and matched official archive SHA-256 df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de. A normal lifecycle-enabled npm ci then failed rebuilding better-sqlite3 because make was absent. No tests used that partial installation and no compiler/SDK was installed. Node-gyp reported its normal Linux header-cache path under /home/gio/.cache/node-gyp/22.23.3; no existing Windows SDK or original dependency junction was changed. Docker was unavailable, and no daemon was started. An earlier disposable WSL /tmp-path acquisition failure was retained before the single-process attempt. Linux qualification remains BLOCKED, not PASS.

SSH signing remains enabled. The existing signer/key configuration was used for a five-second, noninteractive signature-availability probe of a synthetic text file. The probe timed out, produced no signature, and did not request or expose the passphrase. No unsigned fallback, new key, service change, commit, push or PR was performed. Successful required qualification remains necessary before publication. The operator subsequently reported "unlocked"; at 2026-10-25T09:26:47.371Z the configured signer signed a synthetic probe successfully and ssh-keygen check-novalidate verified its cryptographic integrity (both exit 0). The service was Running. This proves current signing availability, not a new commit signature, GitHub verification, new signing authority or independent approval. The earlier timeout record remains preserved.

Rollback: before merge, discard only the reviewed remediation candidate through a separately chosen Git operation; originals remain preserved. After a separately authorized integration, use a normal reviewed revert of this bounded diff, retaining the evidence and blocked connection/acceptance states. Never repair credentials, delete audit history, raise capacity, activate recovery or modify pilots as rollback.

No merge is authorized. Preserve real pilots and credentials, Security Officer/Lead Architect quorum, 14 privileged-route denials, canonical WBS, disabled live-agent execution, Gate 7 and release restrictions.

## Final actual qualification and resume gate

The final frozen implementation was tested with staged input tree `53685edf69470c6ffd83552740020a7977c7ab58` (before this additive results paragraph). All 13 candidate file copies matched the qualification checkout at run start. Only this documentation checkpoint was updated afterward; implementation/test bytes remain frozen.

- MCP bridge: 17/17 PASS. Security: 26/26 PASS. Native schema-3 authority: 3/3 PASS. Actual SDK 1.17.0: 4/4 PASS on stdio and HTTP.
- WBS: zero drift. TypeScript/lint and production build: PASS, with existing bundle-size/CJS import.meta warnings retained. Controlled documents: 40/40 A–AN, 29/29 additional security, 11/11 focused groups PASS; no live snapshot mutation.
- Final complete regression: **158/159 suites PASS; 2,982 passing / 1 failed / 0 skipped reported checks**. The sole failed suite is `scripts/testWorkspaceAgentDelegation.ts`: 14 passing outputs, then no exit status, SIGTERM, and `spawnSync ... node.exe ETIMEDOUT` at the unchanged 120-second harness bound. The last observed output was AG13. The specific slow operation/root cause is not established; no timeout or capacity limit was raised.
- Final results JSON SHA-256: `f2abc7404d3b3a331a58b939616ed906ea720a0d24c8e45cdbc7bab81ed50a5a`. Both initial and final failures are retained separately. Later browser success is not a root-cause diagnosis of the initial navigation timeout.
- npm 10.9.9 audit against https://registry.npmjs.org: exit 0, zero vulnerabilities. Combined raw output retains npm's trailing update notice; no package was upgraded. Audit log SHA-256: `dd8254850c6251ec782daff43cbaafcb3beabb11724b2758ab40063a1e14a766`.
- Thirty protected source/evidence paths matched HEAD byte-for-byte, including the five bootstrap-pinned documents, canonical WBS and known historical evidence. The regression report records no changed evidence. Original Stage 2/3 receipt digests remain unchanged.

**Publication disposition: BLOCKED.** There is no new implementation commit, pushed branch, draft PR or candidate hosted CI. The operator mandate conditions publication on required checks passing; the final complete-regression failure prevents publication. The earlier signing blocker was cleared by the operator: the configured existing SSH key signed and the probe verified after the operator message "unlocked". No new commit was created because the required-checks gate remains red. Independent agent review is complete; actual human GitHub approval is not claimed. No merge was attempted.

Reproduce the delegation-suite failure in a qualified disposable environment with stage-level timing/authority diagnostics and the unchanged limits; do not infer that another green badge diagnoses it. A hosted/other qualified runner may be needed. No SDK/toolchain installation, audit retention change or canonical task application is authorized by this checkpoint. Do not use the failed Linux partial dependency installation. After successful required qualification, make the existing Git signing key available, verify a signed commit, push normally, open a draft PR against refreshed actual master, and inspect all five applicable hosted jobs before seeking a separate merge decision. Do not rebuild the already corrected MCP implementation merely to resume.

For operator-controlled key availability only, start the existing service in Administrator PowerShell: `Start-Service ssh-agent`. Then in the operator's regular private PowerShell window run `& "C:\Windows\System32\OpenSSH\ssh-add.exe" "C:\Users\HomePC\.ssh\id_ed25519_signing"` and enter the existing key passphrase locally; `ssh-add -l` verifies it is loaded. Never send the key or passphrase to an agent, replace the signing identity, or disable signing as a shortcut. Starting/loading remains an operator action, not evidence that it already happened.
