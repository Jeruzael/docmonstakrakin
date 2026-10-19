# S2-A implementation decision package

## Decision boundary

**DIRECTION_SELECTED / IMPLEMENTATION_NOT_AUTHORIZED / ACTIVATION_NOT_AUTHORIZED.**

The operator selected **Option 2: central principal/action/resource authorization with resource-level enforcement** on 2026-10-19. PR #47's independently attributable approval and merge accept documentation/proposals. They do not authorize S2-A. This record updates the design direction without rewriting the [historical options portfolio](../04_security/security-authorization-sprint2/proposals/project-authorization.md).

Evidence baseline: master `bf5d617fa5bb76323714cc21cc20270acd826616`; PR #47 exact-merge CI 39197583510 passed all three jobs. The route surface remains 69 registrations: 45 legacy unscoped, 14 blocked privileged, 7 specialized human reviewer and 3 reviewer-session. AZ-08 is an isolated domain-validation candidate on its own branch; it is not an authorization cutover.

## Policy and transaction contract

The central service accepts only a server-authenticated principal, a registered capability/action, a canonical resource handle and server-owned context. HUMAN and AGENT are distinct principal kinds; display names, project.owner strings, request actors, model/provider names and role labels confer no rights. Unknown principals/actions/resources, unavailable authority, absent grants, expired sessions and explicit denials fail closed. Explicit deny takes precedence over allow; no default owner/admin/reviewer grant is inferred.

Resource resolution binds project and nested record/document/package identities before data disclosure or mutation. Discovery and list filtering, content read, mutation, export, import.create, import.replace and governance are separate capabilities. Derived outputs require every contributing source's ACL; packages cannot install credentials/grants or author authority.

Authorize before project persistence and sensitive file reads. A single owned coordinator serializes grant/revocation updates with sensitive commits; recheck credential/session/principal/policy revision and target snapshot digest immediately before publication. All writers must participate; offline administration stops the server. SQLite plus a JSON snapshot/document journal is not one ACID transaction: require a durable intent/recovery protocol with recorded old/new revisions, crash-point tests and denied protected work until ambiguous recovery completes. If this cannot be demonstrated, affected cutovers stay disabled. Do not solve races with an unversioned cache.

General and specialized reviewer sessions must resolve to the same stable authorized HUMAN on combined-plane operations. Reject conflicts/missing mappings; never union two people's rights. Security Officer and Lead Architect quorum remains distinct, human and nondelegable. Administrator, project owner, AGENT and GitHub reviewer identity are not substitutes. Existing controlled-doc, approval digest, import downgrade, release and WBS checks remain additional invariants.

## Recommended defaults, tradeoffs and unresolved choices

| Area | Recommended decision | Tradeoff and exact unresolved approval |
| --- | --- | --- |
| Private store | Transactional SQLite security repository outside Git, project roots, ProjectStore and packages; candidate location under per-user OS application data | Exact absolute directory/OS account, reviewed binding/version, schema/migration policy, file/parent/WAL/SHM/backup ACLs and restore procedure remain unapproved |
| Runtime compatibility | Prove the chosen SQLite and Argon2 binding on current Windows Node 22.21.1 and CI's Node 22/Linux; retain reviewed lockfile and native build provenance | Current project does not depend on either new binding. Existing runtime compatibility is not proof of their compatibility. Built-in or third-party driver choice must be explicit; no silent experimental API assumption |
| Passwords | Asynchronous bounded Argon2id; initial benchmark candidate at least 19 MiB, t=2, p=1; random per-verifier salt and algorithm/parameter/version metadata | Target hardware p50/p95, event-loop delay, RSS, login concurrency/queue caps, input-size limit and throttles must be measured and approved. No benchmark or final profile exists; no automatic scrypt/weak fallback |
| Sessions | 32 random bytes; only token digest at rest, server-owned principal/revision/generation; rotate on login/privilege change and revoke on logout/reset/disable/recovery | Proposed 10 minute idle and 30 minute absolute expiry, restart generation invalidation and session concurrency need human acceptance. Active authorized work alone may extend idle; absolute expiry never slides |
| Browser | Separately reviewed same-origin loopback HTTPS; Secure, HttpOnly, host-only, SameSite=Strict cookies, Path=/; synchronizer CSRF and exact trusted Origin | Exact hostname/cert issuer/SAN/key custody/rotation, trust provisioning, port, development workflow and recovery remain open. No CA/trust-store/certificate installation or listener activation is authorized |
| Bootstrap/recovery | Explicit offline ceremony while service stopped; bootstrap workspace administrator only; reviewed backup/recovery and session-generation revocation | Name operator authority, recovery authentication/custody, backup encryption/key recovery, last-admin handling, exact dry-run/apply evidence and fail-closed interruption behavior |
| Human governance | Preserve distinct Security Officer/Lead Architect HUMAN quorum; separately approved 1:1 mapping from existing reviewers where needed | No automatic reviewer migration, enrollment, privilege grants or WBS signer trust. DMK-198 UX and existing quorum retain ownership |
| Rollback | Disable pilot/cutover family, revoke sessions, recover reviewed store revision offline and retain audit | Never restore anonymous access, fallback to weaker verification or automatically grant owner/reviewer rights |

The Argon2 starting candidate follows [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); its suitability still depends on local measurement. Cookie authority must account for lack of port isolation under [RFC6265 §8.5](https://www.rfc-editor.org/rfc/rfc6265.html#section-8.5). Prefer a dedicated per-install loopback authority without mutually distrusting services sharing that hostname. Host-only cookies alone do not isolate ports.

Fail-closed authority-store handling must bound request work and expose no secrets in health/errors. KDF throttling requires per-account/source/global limits; all loopback callers share an OS network source, so address-only throttling is insufficient. Generic failure responses should avoid account enumeration. Session tokens, passwords, salts/verifiers/recovery material and private-store data must not enter packages, prompts, repository evidence, logs or audit payloads; audit uses nonsecret stable IDs/revisions.

## Exact proposed S2-A boundary

Once separately authorized, limit the first slice to private identity/verifier/session repositories, pure default-deny registered-capability decisions, coordinator/revision primitives, explicit offline ceremony tooling and an actual-server authentication/self-inspection pilot with synthetic fixtures. The final authorization must enumerate files/APIs/dependencies/schema and disabled-by-default behavior. Existing route-family cutovers remain S2-B/C/D; privileged capabilities remain S2-E; agent delegation remains S2-F. Adding a login does not protect existing routes.

No operator credential migration, account enrollment, automatic grants, HTTPS activation or existing-route cutover is included now. A synthetic pilot is not permission to touch operator data. Future AGENT authority must be a bounded intersection of current delegator rights, delegation scope/action/audience/budget/expiry and policy; it cannot contribute to human quorum.

## Prerequisites and compatibility

Resolve the [DMK-209/210/211 sequencing and PR #34 registration decision](SECURITY_SPRINT2_GOVERNANCE_DECISIONS.md) before implementation. Option 2 selection does not satisfyDMK-209's full route-protection acceptance or create DMK-211 in master. Any bounded preparatory exception must be explicit and exact; none currently exists.

Legacy HTTP/dev clients and reviewer-only sessions continue under the present partial-containment contract until an approved family cutover. At cutover, update clients and fixtures to use explicit identity/grants while retaining business assertions. Cookies are not stored in localStorage or URLs. Cache keys must include principal/project/policy revision, clear on logout/scope change and respect denied discovery.

Old reviewer identities, package owner strings and project IDs must be mapped through reviewed input; unresolved/duplicate/malformed mappings deny. Imported packages retain untrusted history, cannot replace local identity/grants and preserve governance downgrades. GET/HEAD audited package export remains under its current transaction interceptor until a separately approved POST-download migration. No schema/data migration occurs in this candidate.

Option 1 would reduce initial machinery but repeat checks across 69 registrations. Option 2 centralizes decisions while retaining the existing deployment process, at the cost of registry completeness, cross-store recovery and a coordination bottleneck. Option 3 requires a real separate OS authority owning files/state/privileged access to create a stronger compromise boundary; a process hop under identical permissions is insufficient. Reconsider Option 3 for untrusted extensions/multiple OS users, not as an implicit claim of current isolation.

## Acceptance evidence required before S2-A acceptance

| Test family | Required proof |
| --- | --- |
| Identity/KDF | Correct/incorrect password, unknown/disabled HUMAN, malformed/unknown verifier version, no algorithm downgrade; bounded queue/concurrency under saturation; benchmarked target profile and resource budgets |
| Sessions | Token randomness/uniqueness and digest-only storage; rotation/fixation, idle/absolute expiry, logout/revoke/reset/disable/restart generation; no stale replay, secret in responses/logs/packages or account enumeration |
| Browser | Real approved HTTPS origin/cookies/CSRF, login CSRF, Host/Origin/port/case/path/duplicate-header negatives; current loopback and no public/wildcard override retained |
| Policy/resources | Unknown action/principal/resource, explicit-deny precedence, forged HUMAN/role/actor, mixed human/agent credentials, conflicting general/reviewer sessions, canonical nested-resource mismatch |
| Revision/commit | Revoke/grant/state change during queued read/write, stale base digest, lock contention, process abort at every journal/commit boundary, corrupt/unavailable authority/WAL/backup; no unauthorized data/audit publication |
| Governance | Security Officer+Lead Architect remain distinct; duplicate/self/AGENT/owner/admin signatures cannot satisfy quorum; exact artifact digest binding and WBS/release boundaries remain |
| Compatibility | Actual new server registrations with synthetic fixtures, unchanged14 privileged denials and general route residual notice, preserved existing tests, WBS/historical evidence unchanged |
| Publication | Exact signed candidate HEAD; all 3 GitHub CI jobs successful; independent human security/architecture review and explicit scope acceptance; no automatic activation |

These are future acceptance requirements, not tests run by this documentation package. Numeric performance/concurrency budgets and recovery RTO/RPO remain unresolved; the human must approve measured values before calling them accepted. No operator authentication data has been benchmarked or migrated.

## Next human authorization — required fields

A separate authorization must name:

1. Exact baseline/candidate decision revision, S2-A code/API/file boundary and synthetic-only versus any later operational action.
2. Private-store directory/account/schema, selected SQLite binding/version and demonstrated Windows/Linux Node compatibility; backup encryption/ACL/recovery choices.
3. Selected Argon2id binding/version and measured profile, bounded KDF limits, latency/memory budgets and no-downgrade policy.
4. Approved browser hostname/HTTPS certificate/key/trust model, cookie/CSRF/session lifetimes and whether pilot transport remains disabled until a later activation.
5. Offline bootstrap/recovery authority, reviewed ceremony, credential/session handling and explicit separation from enrollment/migration/project/reviewer/WBS grants.
6. Exact WBS prerequisites/ownership resolution or a narrowly bounded preparatory exception; unchanged canonical task states until governed application.
7. Acceptance matrix, independent reviewer, evidence requirements, rollback/stop conditions and human merge/activation gates.

**Until those fields are resolved, S2-A implementation stops here.** Fourteen privileged registrations stay disabled; Agent Center live execution remains blocked; full authentication/tenant isolation is not implemented; live reconciliation, Gate 7 and release status remain unchanged.
