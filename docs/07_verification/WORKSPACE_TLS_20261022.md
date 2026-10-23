# Workspace loopback TLS mechanism, 2026-10-22

This bounded transport change provides read-only certificate admission and an offline preparation plan. It does not initialize or enroll workspace authority, install a certificate or trust root, authenticate an independent human, establish key custody, change permissions, create operator keys, or complete Gate 7. Server listener, origin, session and route-policy wiring belong to the parent integration.

## Runtime contract

`server/security/workspaceAccess/tls.ts` exports:

```ts
resolveWorkspaceTls(workspaceRoot, env = process.env):
  | {enabled: false}
  | {enabled: true; cert: Buffer; key: Buffer}
```

Both environment values absent means disabled, with no filesystem reads or provisioning. Any partial, empty or alternative configuration fails closed. The only enabled values are exactly:

```text
DMK_TLS_CERT=.security/tls/loopback.crt
DMK_TLS_KEY=.security/tls/loopback.key
```

These are enablement selectors for fixed descendants, not caller-controlled paths. Absolute paths, URLs, backslash variants, dot aliases and alternate names cannot choose material. The workspace argument must use its canonical absolute spelling; symlink/junction ancestry, 8.3/case aliases and relative/dot paths are rejected. The workspace itself need not be a private folder; `.security`, `.security/tls`, and both files must satisfy the shared private boundary.

The helper reuses the shared `privateBoundary.cjs` `assertPrivateDirectory` and `assertPrivateFile` policy. Its location follows the trusted source module, or the fixed `dist`-to-source layout for a bundled CJS server, matching the finalized `privateDirectory.ts` resolver. Workspace working-directory changes cannot choose that module; neither environment nor request fields select it. The parent must integrate the shared boundary's narrow optional `tls` directory admission before using this helper. TLS admission does not replace the authority store's initialization/schema/owner-lock checks.

Private directories require mode `0700` and files `0600` under the current UID on POSIX. On Windows, the shared helper validates the current-owner SID and restrictive ACL using the normative Windows module path; no broad principal is accepted. Both cert and key are checked independently. The fixed TLS directory may contain only `loopback.crt` and `loopback.key`. Files must be ordinary, non-symlink, single-link files of 1–32768 bytes each. The 32 KiB limit is an implementation bound, not a ratified operational capacity claim.

Each read compares the admitted path identity, pre-open metadata, opened descriptor identity, single-link status, bounded read length, descriptor metadata and post-read path admission. POSIX opens use `O_NOFOLLOW` and `O_NONBLOCK`; Windows uses its available ordinary read flags plus the shared path/ACL/identity checks. Both files are rechecked after the pair is read, closing the observed interleaving where an earlier certificate path or permission changed while the key was being opened. Directory/root identities are rechecked too. Accepted identities, metadata and byte fingerprints are pinned in memory, so observed same-path replacements or modifications fail on subsequent calls. Offline rotation requires a new process.

This is detection of observed substitutions around admitted reads, not a race-free filesystem broker against arbitrary code already executing as the owning OS principal. A compromised owner, runtime, filesystem or shared helper remains outside this mechanism's assurance. Errors expose stable `WORKSPACE_*` codes; the helper and CLI do not log PEM material or passphrases.

## Certificate checks

Enabled loading requires exactly one PEM leaf certificate and one unencrypted PEM private key. Concatenated chains, trailing objects, alternative formats and interactive passphrase sources are not admitted. Node parses the X.509 certificate, checks its startup validity window against the local clock, requires a non-CA leaf with exactly the IP SAN `127.0.0.1`, verifies the matching private key and verifies that a TLS 1.3 context can load the material. DNS aliases, CN-only identity, additional SANs, CA certificates, expired/not-yet-valid certificates, mismatched keys and malformed material fail closed. The returned object does not configure a listener's protocol by itself; the parent must select HTTPS and a minimum TLS version explicitly.

These checks establish local startup compatibility and the fixed loopback identity, not PKI acceptance. They do not independently authenticate an issuer, provide a trusted timestamp, install trust, poll for revocation, monitor expiry after startup, rotate certificates, or prove custody. A local self-signed certificate remains untrusted to clients until a separately authorized acceptance action. The implementation never disables client verification to make that certificate work.

API references: [Node 22 IP SAN matching](https://nodejs.org/docs/latest-v22.x/api/crypto.html#x509checkipip), [private-key matching](https://nodejs.org/docs/latest-v22.x/api/crypto.html#x509checkprivatekeyprivatekey), and [TLS context options](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlscreatesecurecontextoptions).

## Read-only offline preparation

```text
node --import tsx scripts/prepareLoopbackTls.ts --instructions
node --import tsx scripts/prepareLoopbackTls.ts --check
```

The default/`--instructions` path prints a fixed OpenSSL recipe and operator prerequisites. It executes no OpenSSL command and creates no directory, key, certificate, authority, lock or trust-store entry. The operator must separately initialize authority, stop its owner/server, prepare private paths, confirm both destination files are absent and select an existing genuine OpenSSL installation. The recipe must not overwrite existing material. The CLI deliberately implements the documented operator-command fallback instead of attempting unsafe authority/lifecycle coupling.

`--check` only runs the same material loader and reports whether TLS is enabled, with `trustInstalled: false` and `humanAcceptance: false`. With both selectors absent it truthfully reports disabled. Invalid arguments or invalid material fail without printing key contents. Permission repair, trust installation, certificate fingerprint/custody acceptance, live-lock recovery and listener activation remain separate actions.

The printed recipe creates a short-lived self-signed EC leaf with the sole loopback IP SAN and `CA:FALSE`. It is a transport setup recipe, not operational CA acceptance or independent reviewer authorization. Neither this work nor its tests execute that recipe in an operator workspace.

## Verification scope

The tests generate fresh synthetic EC self-signed fixtures using the existing genuine OpenSSL installation, without network acquisition or software installation. All keys and certificates live beneath one fresh test-owned temporary root. ACL mutations, hard links and junctions are confined to those fixtures; recursive cleanup first checks the exact absolute generated root and removes test junctions explicitly. No test installs trust or opens a real workspace authority.

The script covers disabled/no-provisioning behavior; exact configuration; private fixed file loading; canonical roots; junctions/hard links; independent cert/key permissions; file bounds; malformed/mismatched/CA/SAN material; validity-window refusal using a controlled loading clock and real certificate dates; across-call and during-open substitutions; paired-read path/permission changes; stable errors for missing material; unexpected children; and read-only CLI behavior. Windows uses mandatory junction plus file-hardlink attacks; POSIX uses directory symlink coverage alongside hard links.

The actual HTTPS case starts a disposable TLS 1.3 server bound only to `127.0.0.1` using the returned buffers. A per-request explicit fixture certificate permits the intended client to verify that exact server; an ordinary untrusted client and a `localhost` hostname are rejected. A test-only handler returns 401 without its inert fixture authorization text and 200 with it. This is transport/fixture-handler verification, not proof of the parent's production authentication policy or a genuine human session. No system/browser trust setting changes.

Run against the integrated complete checkout:

```text
node --import tsx scripts/testWorkspaceTls.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

During parallel implementation, `--boundary-checkout=<canonical shared-helper checkout>` supplies genuine shared helper bytes to a fresh disposable source/bundled test deployment; certificate/workspace roots remain disposable too. Production code has no such selector. Separate source-import and bundled-CJS child processes use a different workspace working directory, proving that cwd cannot select the policy module. `--metadata-only` explicitly skips the live HTTPS case, and `--case=TLS15` limits a diagnostic run; neither is a substitute for the final full script.

The final generated-fixture script completed on Windows with Node `v22.21.1` and the existing Git OpenSSL `3.1.4`: **17 passed, 0 failed, 0 skipped**, including the actual loopback HTTPS case. The shared core checkpoint is `cbacc4c8b66cdaad06169f042e0769ebbb804c9e`; its tested `privateBoundary.cjs` SHA-256 is `46c3e7cd6da96b83b7f33e981b1b90683a84a5f26afceb0f5176e4a4cc686e7a`. TypeScript and diff checks also completed with exit 0. This result does not claim an integrated server or production authentication test.

Initial red outputs and subsequent focused results are retained locally under `runtime/operational-release-evidence/`. The initial metadata run recorded 6 semantic failures after its loader-path harness issue was corrected. Further red tests exposed paired-read certificate substitution, raw filesystem errors for a missing directory, and cwd-dependent source/bundled helper resolution. Those defects are fixed without rewriting earlier outputs. Full repository regression, browser testing, actual operator trust/custody acceptance, production certificate installation and release execution are outside this bounded slice.

## Enforced API body receive admission

`server/security/workspaceAccess/bodyAdmission.ts` adds a separate, in-memory receive resource gate. The parent server must mount `createWorkspaceBodyAdmission()` **only in ENFORCED mode**, after its direct loopback/perimeter and `enforceApiRoutePolicy` checks and before the existing `express.json({limit: '10mb'})`. That parser remains before session, authorization and authority RPC work. The final error handler must begin with `if (res.headersSent) return;`: shutting down a rejected reader also causes body-parser to report an aborted request, and that later error must not replace or log the response already sent.

The engineering candidate permits four concurrently admitted incoming API body streams per Node process, including across independently installed instances, with no waiting queue. It preserves the 10MiB parser limit and independently counts at most 10,485,760 incoming body bytes. A body declaring a larger length is rejected before parsing. Streaming/chunked bodies receive the same count, and the original parser remains responsible for JSON syntax and its own 10MiB bound. The gate neither copies nor stores incoming chunks. Requests without a body, including an explicit zero content length, do not occupy receive slots. Body admission applies to every HTTP method, including GET bodies; unknown and privileged routes remain denied by the earlier existing policy.

The receive deadline is five seconds from middleware admission and is never extended by trickled bytes. The only constructor option, `{receiveTimeoutMs}`, must be an integer from 1 through 5000 and can shorten that deadline for focused tests. A lease ends exactly once on actual request receive end, abort, error or reader close. Node can close a paused reader after the HTTP parser received its final wire chunk without emitting the readable `end` or `aborted` event; that actual reader termination also ends its lease. Response `finish`, authentication, parsing and RPC completion do not release or extend receive leases.

Rejected readers are paused immediately. Responses use `Cache-Control: no-store` and `Connection: close`; a graceful socket FIN after response finish allows ordinary clients to observe the status. A fixed 50ms grace timer starts at rejection and forcibly destroys any remaining reader independently of response finish, including a response queued behind a stalled pipelined response. No authority work is invoked by the gate. Delivery of a complete error response to a sender that prevents flushing is best effort; teardown remains bounded by the timer instead of waiting for that sender.

| Condition | HTTP status | Error |
| --- | --- | --- |
| Four admitted body receivers already active | 503 | `REQUEST_BODY_CAPACITY_EXCEEDED` |
| Declared or streamed body exceeds 10MiB | 413 | `REQUEST_BODY_TOO_LARGE` |
| Body receive deadline expires | 408 | `REQUEST_BODY_RECEIVE_TIMEOUT` |
| Body media, charset or encoding is unsupported | 415 | `REQUEST_BODY_MEDIA_UNSUPPORTED` |

The ENFORCED compatibility candidate accepts body media `application/json`, optionally with `charset=utf-8` (quoted or unquoted), and no content encoding other than explicit `identity` or an absent encoding. This matches the existing parser's JSON media type and avoids non-JSON bodies bypassing that parser and reaching authority during receive. `+json`, other media parameters, other charsets and compressed bodies are rejected before authority work. Compression is deliberately unavailable here to keep wire and decoded byte budgets unambiguous. No-body requests require no media header. LOCAL_DEVELOPMENT keeps its historical parser behavior because the parent does not mount this gate there. Existing malformed-JSON handling, including the specialized requirement-status response, remains with the parent error handler.

These are reviewable engineering bounds, not ratified production capacity. Four receivers are process-local, not a bound on all host processes or all sockets. Ten MiB per wire body is not an aggregate heap limit: JSON buffers, decoded strings, parsed objects and other application state add memory. Receive timers depend on event-loop scheduling and do not bound header receipt, TLS handshakes, synchronous JSON CPU time, authority queue latency or request completion. Server connection/header limits, session admission, backing-store resource admission and operational load qualification remain separate. This resource gate establishes no human identity, project membership, operator acceptance, production trust, release readiness or Gate 7 approval.

`scripts/testWorkspaceBodyAdmission.ts` uses actual disposable loopback HTTP servers and inert downstream counters. It covers a fifth held-body refusal, receive-end and aborted-reader release without over-release, declared and chunked overflow before mutation, deadline closure and slot reuse, no-body bypass, GET/chunked parity, strict media/charset/compression admission, the exact 10MiB boundary, canonical malformed JSON, a process-wide cap across instances, upstream policy denials, invalid deadline overrides, trickled bytes, response-finish independence and pipelined-response teardown. No native authority, operator workspace, credential, external service or system trust store is used.

```text
node --import tsx scripts/testWorkspaceBodyAdmission.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

The original 14-case pass-through baseline recorded **4 passed and 10 failed**; those red outputs remain in `runtime/operational-release-evidence/body-admission-red-expanded.log`. Subsequent tests exposed premature TCP reset during a trickled timeout and a wire-complete paused-reader cleanup case; their earlier outputs are retained too. The final focused HTTP script completed with **16 passed and 0 failed**; TypeScript and diff checks completed with exit 0. This test result verifies the helper and documented fixture composition; the parent's actual ENFORCED server wiring is a separate integration step.
