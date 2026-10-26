# ChatGPT OAuth/discovery development candidate — 2026-10-26

**DRAFT CANDIDATE; NOT AUTHORIZED FOR MERGE OR ACTIVATION.**

Baseline master: `9814e5e530a144b0f0a066a4c17d8d868dd2e23e` (PR #96).
The operator approved one bounded code/test candidate and signed draft
publication in the 2026-10-26 conversation. That approval is not a formal
GitHub review or independent human quorum. No tunnel, runtime key, app,
identity, real grant or external model connection has been created.

The existing [PR #96 guide](external-agent-mcp-bridge-guide.md) and its
failure chronology remain historical evidence. Nothing here closes the
historical Windows AGC1 or local 158/159 regression timeout diagnosis.

## Change and authority boundary

Shared `mcpDiscovery.ts` supplies only fixed initialize/ping/tools metadata.
The legacy bridge uses the same responses and retains its credential-first
CLI, strict private loader, fixed tool contract and existing transports.

The new `mcpOAuth.ts` is a separate TLS 1.3, loopback-only resource-server
factory. It rejects startup unless trusted calling code explicitly enables
it. It has no CLI, and neither server.ts nor the existing MCP entrypoint
imports or activates it. Discovery requires no DMK credential. Only the
protected-resource metadata and `read_task` tool are advertised.

An authenticated IdP introspection must precede task access. A trusted
read-only binding resolver maps issuer/subject to one exact project/task,
agent, client, sponsor, grant, session, grant revision and private config.
The existing private loader reacquires all files and ACL/link identities
for each admitted read. Current DMK authority must confirm one TASKS task,
only task:read, and no more than 180 seconds remaining. No grant issuance,
enrollment, renewal, credential migration or human approval is implemented.

The existing reader still performs DESCRIPTION then INSTRUCTIONS skill
admission, current revision checks, authenticated six-field projection
and correlated non-durable READ_OBSERVATION. No OAuth token is forwarded
as a DMK token. Returned project text remains untrusted and grants no
authority or human approval.

After reading, the adapter re-introspects the user, checks identity
continuity, resolves the binding again, obtains a final DMK session, then
synchronously checks both observed OAuth expiries and the grant expiry.
These are ordered observations, not an atomic transaction across IdP,
binding and DMK. A change after the last observation remains possible;
production concurrency/revocation guarantees are not qualified.

## Deliberately conservative provider contract

This is a resource adapter, not an OAuth authorization server. Real user
login, authorization-code/PKCE flow, client registration and consent must
come from a separately configured established IdP. They are NOT_RUN.

`mcpOAuthIntrospection.ts` uses authenticated HTTPS introspection with
client_secret_basic, strict TLS 1.3, a pinned issuer/resource and an
explicit same-origin endpoint. This server-to-IdP credential authenticates
the resource server; it does not authenticate an end user by itself.

Required response profile: active true; case-insensitive Bearer token_type;
**custom authenticated token_use: access**; exact issuer; matching audience;
nonempty subject; unexpired exp; task:read scope; valid optional nbf/iat;
and no cnf property. Missing token-kind evidence, refresh/ID/DPoP or
sender-constrained tokens fail closed. token_type_hint is only a hint.
token_use is a candidate custom profile requirement, **not a generic
RFC 7662 guarantee or proof of compatibility with every IdP**.

Configuration/admission qualifications: subject <=128 UTF-8 bytes,
introspection client ID/secret <=1024 bytes each, bearer <=8192 ASCII
characters, CA <=65536 bytes, fixed resource path /mcp, HTTPS same-origin
introspection endpoint, and TLS 1.3. These restrict this candidate's
compatibility and have not been ratified as production policy.

Existing MCP_LIMITS are unchanged: message 16384 bytes, output 524288,
two concurrent operations, eight connections, 30000 ms operation,
5000 ms body/write and 1000 ms shutdown. Introspection reuses the message,
concurrency and 5000 ms acquisition bounds. No capacity ceiling, audit
retention, authority limit, timeout or CI threshold was increased.

References: [OpenAI user authentication](https://developers.openai.com/plugins/build/auth),
[Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels),
[RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html).

## Test-first failures and corrections

The local logs are retained in the task-owned ignored
`runtime/chatgpt-oauth-candidate/`. The sanitized evidence JSON accompanying
this document records their exact hashes/results for independent review.

| Step | Actual outcome | Supported conclusion |
| --- | --- | --- |
| 01/02 missing implementation | 0 passed / 1 failed | New behavior absent before implementation |
| 03 first implementation | 15 passed / 1 failed | Transport negative test failed |
| 04 transport diagnosis | 15 passed / 1 failed; ERR_TLS_CERT_ALTNAME_INVALID | Foreign Host also changed Node's TLS name check, before HTTP admission |
| 05 corrected fixture | 16 passed / 0 failed | Strictly validate actual loopback TLS target while varying only HTTP Host |
| 06 user-change RED | 17 passed / 1 failed; HTTP 200 versus 401 | Final introspection subject was not compared |
| 07 subject correction | 18 passed / 0 failed | Identity continuity enforced |
| 09 pending DMK revocation RED | 17 passed / 1 failed; HTTP 200 versus 403 | Genuine grant revoked while final IdP acquisition was pending |
| 10 explicit access-token profile RED | 19 passed / 2 failed | Unsupported token kind and pending revocation remained observable |
| 11 pending DMK expiry RED | 19 passed / 3 failed; HTTP 200 versus 403 | Grant expiry during final IdP acquisition was missed |
| 12 ordered checks/profile GREEN | 22 passed / 0 failed | Reordered observations and strict token profile reject those cases |
| 13 final OAuth expiry RED | 22 passed / 1 failed; HTTP 200 versus 403 | A shorter final OAuth expiry was discarded |
| 14 final focused GREEN | 23 passed / 0 failed, 47456 ms | Both OAuth expiries and final DMK context enforced |

The initial TypeScript check also found HTTPS connection typing errors;
these were corrected without changing runtime limits. Quality later
passed with the existing bundle-size and CJS/import.meta warnings retained.

The final suite covers actual synthetic TLS IdP acquisition, certificate
and hostname refusal, token-kind/issuer/audience/scope/time rejection,
duplicate/oversized/error/redirect responses, public discovery before any
authority exists, OAuth-only denial, foreign Host/Origin/cookie/duplicate
Authorization/media/query refusals, bounded concurrency, disconnect and
deadline admission, and real native schema-3 task read/revocation.

The hostname fixture trusts a certificate for 127.0.0.2 while connecting
to 127.0.0.1, keeps issuer claims matching, and confirms TCP reached but
no HTTP request was delivered. This isolates hostname validation from
issuer mismatch or DNS refusal. The operation deadline is exercised via
Node's controlled MockTimers with the unchanged 30000 ms bound; slots
remain held until pending work settles. MockTimers is experimental in
Node 22 and emits its normal warning.

DMK-expiry testing advances only the disposable test process's clock,
restores Date.now in finally, and closes that separately created
authority without reusing its advanced persisted clock. Final OAuth
expiry testing waits for the exact expiry authenticated by the fixture,
not an arbitrary readiness sleep. All data and credentials are synthetic.

## Qualification and publication status

At this implementation checkpoint:

- Focused candidate: PASS, 23 grouped checks (not a count of all subcases).
- Native dependency smoke: PASS using an in-memory database.
- Local quality: PASS on the final implementation source (WBS, TypeScript,
  production build); existing warnings retained.
- Complete regression, controlled documents and unchanged security suites:
  pending exact-candidate disposable-clone execution.
- Hosted CI: NOT_RUN until draft publication; six expected normal jobs
  across CI, Agent Authority and Capacity Inspector workflows. The old
  PR96 diagnostic workflow is not manually activated.
- Human review, actual ChatGPT model invocation and operator acceptance:
  NOT_ESTABLISHED.

The local MCP worktree uses its own regular node_modules, not the original
operator dependency junction. Node 22.23.3, npm 10.9.9, Bun 1.4.2,
better-sqlite3 13.0.3, argon2 0.45.1 and tsx 4.23.13 were observed.
Retained local binaries are **not a fresh-install qualification**. Normal
hosted Linux/Windows npm and frozen-Bun jobs must supply that evidence.

## Operational blockers and rollback

Real IdP eligibility/onboarding and exact response profile; authenticated
metadata/trust acquisition; durable subject enrollment/binding authority;
canonical resource identity; real owner-only key/config admission; verified
tunnel-client installation; correct Platform/workspace permissions; actual
OAuth browser consent; ChatGPT protocol negotiation and real model read;
and human acceptance all remain separate, unqualified gates.

The earlier screenshots establish only access to ChatGPT/Platform creation
forms. A selected workspace ID has not been independently mapped to the
intended ChatGPT context. No tunnel or connection is inferred from it.

Rollback is an ordinary source revert of this candidate; there is no
schema/dependency migration or activated listener to undo. No canonical
WBS, historical receipt, bootstrap-pinned document, runtime startup,
operator authority, quorum, privileged route, live agent, Gate 7 or release
state is changed. Stop at the draft review gate.
