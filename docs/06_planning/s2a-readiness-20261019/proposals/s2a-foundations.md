# Security Hardening Proposal: Measured S2-A foundations

## Decision

**Option 2 remains selected; application implementation and activation remain unauthorized.** I recommend `better-sqlite3@13.0.3` in an owned worker and `argon2@0.45.1` with a 32 MiB/t3/p1 candidate profile, bounded to 2 active KDF operations and 4 queued jobs. We have primitive feasibility evidence on Windows and Linux, not an accepted authentication system.

## Executive Recommendation

The existing alternatives remain Option 1: route-local guards, Option 2: central principal/action/resource decisions with resource enforcement, and Option 3: a separate OS authority broker. The operator selected Option 2. We can now name compatible implementation candidates and measured budgets while keeping the later permission cutovers and operational ceremonies separate.

We should authorize a bounded code/test candidate only after the governance prerequisites or exact exception, transport/trust decision, private-store/recovery choices and acceptance scope are explicitly approved. A production-ready label would be premature: our measurements exercise libraries and fixture contracts, not the application's future identity APIs, cross-store coordinator or browser deployment.

## Evidence

| Evidence | Meaning and basis |
| --- | --- |
| Exact-head AZ-08 review | Actual human approval and three successful CI jobs on e33f5ea; [assessment](../PR48_MERGE_READINESS.md), observed |
| Legacy route boundary | server/security/apiRoutePolicy.ts at master bf5d617: 69 registrations, 45 legacy unscoped, 14 privileged denied; source-derived |
| Primitive feasibility | [measurements](../evidence/measurements.json): 34 checks per platform; Node 22.21.1/x64, SQLite 3.53.4, both pinned libraries; observed |
| Governance constraint | [resolution proposal](../GOVERNANCE_RESOLUTION.md): historical/count failures reproduced; revised additive dependency preview accepted but not authorized |

I inspected the real persistence and reviewer boundaries rather than assuming a login would protect them. The current status endpoint remains unauthenticated after AZ-08; its approved-source rework and optional expectedStateVersion behavior are deliberate compatibility limits. Those observations drive the need for an owned decision/commit boundary.

## Current Design And Failure Mode

The service constrains network authority to loopback and rejects unsafe Host/Origin/path representations, while most project operations still select resources without authenticated principal or membership. Specialized human approvals protect particular governance actions; they do not establish ordinary project authorization.

The structural risk is independent ownership of identity, selected resources, policy revisions and file publication. We would still have a race if a valid decision could become stale before JSON or document publication. Choosing SQLite does not make project JSON, controlled-document journals and the authority database a single transaction.

## Desired Invariants

Every protected operation must use a server-resolved current principal, registered action and canonical resource. Unknowns, explicit deny, revoked/expired credentials and unavailable authority deny. Read and write boundaries must use current revisions; every writer must participate in the coordinator. Existing human quorum and immutable historical evidence remain additional constraints.

HUMAN and AGENT remain distinct; neither model labels nor a project administrator can satisfy distinct Security Officer/Lead Architect signatures. General and specialized sessions must bind the same HUMAN on combined-plane operations, never union different people's rights.

## Constraints And Non-Goals

No operator identity, credential migration, live grant, certificate trust installation, route cutover or privileged re-enablement is authorized. Tests used synthetic passwords/tokens/keys and disposable stores. The temporary Linux volume was removed; no production store was mounted. A synthetic self-signed TLS leaf was trusted only by test clients, not installed in OS/browser trust.

## Before Architecture

[Before diagram](../diagrams/before.mmd) shows the existing partial perimeter and unscoped project data path. There is no general authority store or central policy service today.

## Options

### Option 1: Route-local guards

We could attach common principal/resource helpers to each route and repeat revision checks near each sink. That retains familiar handlers and could suit a much smaller API. At 69 registrations, however, alias coverage and every new reader/writer would depend on keeping repeated guard and commit code aligned. We would still need the same private identity, session and KDF foundations; choosing local guards does not remove those costs.

[Local-guard diagram](../diagrams/local-guards-after.mmd). The API remains familiar, but each guard owns its resource and revision boundary:

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Decisions | Local network authority | Per-route current identity/scope | Mitigates unauthorized calls if every path participates | Repeated integration and drift review |
| Publication | Snapshot/file transaction | Per-route policy/state recheck | Narrows stale-decision races | Every writer must implement the contract |

No end-to-end performance measurement exists for this design. If chosen, migration would proceed by coherent route families with actual positive/negative tests; rollback disables a failed family instead of reopening anonymous access. The repetition risk makes it less attractive here, not intrinsically incapable of secure behavior.

### Option 2: Central policy and resource enforcement — selected

We can keep the deployment process while routing explicit capabilities and canonical resource handles through one default-deny service. Route metadata cannot replace resource enforcement: handlers must consume the resolved resource and retain their domain and human-quorum rules. A worker owns SQLite access to avoid synchronous database work on the HTTP event loop; it is a scheduling boundary, not isolation from a compromised application process.

[Central-policy diagram](../diagrams/central-policy-after.mmd). The shared coordinator must serialize grant/revocation changes with sensitive writes and record durable recovery intent across the authority store, project JSON and controlled files. Ambiguous recovery denies protected work until resolved; neither a stale cached allow nor an old-policy fallback is acceptable.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Authority | No general principal/resource contract | Registered central default-deny decision plus local enforcement | Consistent scope/deny semantics | Capability registry, resolver and complete cutover inventory |
| Commit | JSON/document transaction only | Current credential/session/policy revision + target digest under coordinator | Revocation/state races can be rejected at commit | Owned writers, durable intent and crash testing |
| Availability | Legacy calls ignore authority | Protected calls stop on store/recovery failure | Fails closed | Explicit offline recovery and bounded queues |

The primitives support this direction: indexed lookup and worker roundtrips are small in the measured fixture, and bounded KDF work leaves room for a local interactive application. What still gives me pause is cross-store recovery and operational trust. Those require actual application tests before we could accept a cutover. We should introduce a disabled synthetic pilot first and preserve existing 14 route denials.

### Option 3: Separate OS authority broker

A broker becomes preferable if the frontend hosts untrusted extensions or multiple OS users. To create a real compromise boundary, it must run under a separate OS identity and own the project files, authority data and privileged operations. Moving only an authorize function into another process while retaining frontend file access would not provide that boundary.

[Broker diagram](../diagrams/isolated-broker-after.mmd). We would pay for process supervision, authenticated RPC, installation ACLs, crash/restart behavior and more difficult local recovery. None of those costs or security properties was measured in this experiment. The same domain/quorum and revision invariants still apply inside the broker.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| OS authority | One process owns files/state | Restricted frontend and separately owned broker | Limits compromised frontend access when OS ACLs enforce it | Service identity, authenticated channel, deployment/recovery |
| Publication | In-process writer | Broker-owned writer/coordinator | One privileged publication boundary | RPC copies/latency and failure supervision |

Adoption would first transfer ownership through an explicit OS deployment and recovery plan, then move one operation family at a time. Rollback would disable broker-dependent operations, not restore broad frontend authority. Without a demonstrated multi-user/extension requirement, that installation burden is not justified for the first slice.

## Comparison

| Dimension | Option 1 | Option 2 selected | Option 3 |
| --- | --- | --- | --- |
| Security | Source-derived: distributed omission risk | Source-derived: one policy contract; enforcement/commit still essential | Hypothetical until separate OS ownership is established |
| Performance | Unmeasured repeated lookups/rechecks | Measured primitive worker/SQLite/KDF costs below; end-to-end unknown | Unmeasured RPC/process costs |
| Memory | Unmeasured identity/session caches | Measured whole-probe RSS below; application delta unknown | Additional process/cache overhead, hypothetical |
| Reliability | Per-route failure behavior must align | Store/worker/coordinator failures deny; primitive rollback/crash tested | IPC and supervisor recovery adds cases, unmeasured |
| Operability | Simpler deployment, harder audit completeness | Private directory, native builds, backups and recovery ownership | Separate service account/install/IPC supervision |
| Migration | Repeated family guards and compatibility updates | Central registry plus explicit family cutovers; no implicit migration | Ownership transfer plus API/client migration |

These comparisons do not form a composite score. The measurements establish feasibility only for shared foundations of Option 2; they do not prove a security outcome or quantify whole-design superiority.

## Recommendation

Retain Option 2 and the following exact candidate stack, subject to separate approval:

| Component | Candidate implementation | Measured compatibility / remaining boundary |
| --- | --- | --- |
| Store | better-sqlite3@13.0.3, SQLite 3.53.4, worker-owned; WAL, synchronous=FULL, foreign_keys=ON, busy timeout 100 ms, schema/user_version 1 | Windows native and Linux Node 22.21.1 pass; minimal Linux image lacks Python for implicit native build. A build-capable image succeeds; native build provenance/packaging remains a gate |
| KDF | argon2@0.45.1, Argon2id, memoryCost 32768 KiB, timeCost 3, parallelism 1, hashLength 32 bytes, per-verifier random 16 byte salt | Correct/incorrect/malformed verifier tests pass on both platforms; no weaker fallback; parameter/version/length bounds must be enforced before accepting hostile PHC input |
| Admission | Max 2 active KDF operations,4 queued jobs; reject additional work, no hidden queue | Ten concurrent fixture submissions admit 6/reject 4. Abort/timeout must not release active budget until native work actually completes |
| Sessions | Node crypto.randomBytes(32), base64url opaque token; SHA-256 digest storage; 10 min idle/30 min absolute; rotation and credential/policy/generation revocation | 10,000 unique token samples and fixture expiry/revoke/reset/logout pass. These are not actual server sessions or replay/CSRF acceptance |
| Private paths | Windows LOCALAPPDATA/DOCMONSTAKRAKIN/Security/install-id/authority.sqlite; Linux XDG_DATA_HOME/docmonstakrakin/security/install-id or per-user .local/share fallback | Paths are proposed only. Windows synthetic owner DACL and Linux uid1000/mode0700 exercised; protect parent, DB, WAL, SHM,locks/backups; same-OS-user malicious processes remain outside this ACL boundary |
| Browser transport | Node 22.21.1 node:https, TLS1.3 minimum, dedicated per-install dmk-install-id.localhost authority; Secure/HttpOnly/host-only/SameSite=Strict/Path=/ cookie | TLS and negative trust/hostname/Host/Origin probes pass with explicit fixture CA. The probe explicitly mapped the synthetic hostname to loopback and set TLS SNI; production DNS/issuer/trust provisioning and real browser cookie/CSRF/port behavior are not approved/tested |
| Offline bootstrap/recovery | Node offline CLI while server stopped; exclusive lock, SQLite transaction/backup API; AES-256-GCM encrypted backup with 12 byte nonce, 16 byte tag and separately held 32 byte recovery key | Synthetic backup integrity, authenticated encryption/tamper rejection and exclusive lock pass. No real enrollment or operational recovery ceremony executed |

The KDF candidate is above the [OWASP starting minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Driver behavior and APIs are grounded in the [SQLite driver documentation](https://github.com/WiseLibs/better-sqlite3), [Argon2 options](https://github.com/ranisalt/node-argon2/wiki/Options) and [SQLite WAL guidance](https://www.sqlite.org/wal.html). Exact package versions and dependency integrity are captured in the retained lockfile. This is not a full dependency/supply-chain security certification.

For browser deployment, I recommend an operator-provisioned leaf under an already authorized issuer, with protected keys and an exact dedicated hostname. If no approved issuer/trust path exists, keep the browser pilot disabled and request that separate decision. Do not automatically create/install a CA or add hosts-file entries. Cookies are not isolated by port; Host/Origin and an exclusive hostname remain important. The current HTTP-only perimeter needs separately reviewed scheme-aware changes before future HTTPS activation.

Bootstrap would create a workspace administration identity only. Project grants and governance reviewer roles remain explicit independent decisions. Recovery must verify the existing operator/recovery authority offline, preserve audit, reject active-service or incomplete state, revoke old session generation and never synthesize a second human for quorum. Recovery key custody, backup location/encryption, RTO/RPO and any quorum remain human decisions under the existing charter.

## Evidence Coverage And Residual Risk

AZ-08's tactical validation remains necessary; the general authorization design does not replace it. Option 2 can address legacy access only after each registered route/resource cutover is implemented, tested, reviewed and accepted. The current primitive probe leaves every legacy route's actual exposure unchanged.

Windows/Linux tests are source-bound and reproducible, but do not cover real browser trust, cross-store atomicity, disk-full recovery, actual authority-store outage across every handler or operational user migration. An in-process native driver failure can still affect the application process; a worker is not a privilege or crash-isolation guarantee.

## Migration And Rollout

First resolve the [governance proposal](../GOVERNANCE_RESOLUTION.md) or separately approve its bounded preparatory exception. Implement only the [exact S2-A candidate boundary](../implementation/central-policy.md) after human authorization. Do not infer readiness from a login or alter existing route permissions as a convenience.

Subsequent project membership, package/document/context cutovers, remaining ordinary routes, privileged capabilities and agent delegation retain their separately reviewed slices. Unmapped owner/reviewer identifiers deny rather than becoming automatic grants. Rollback disables pilot/cutover families, revokes sessions and restores reviewed private state offline; it never restores anonymous access to an already protected family.

## Validation Plan

### Observed exploratory matrix

| Metric | Windows x64 | Linux x64 (Docker, 2 CPUs/1 GiB) |
| --- | --- | --- |
| Primitive checks | 34/34 | 34/34 |
| Argon2id 19 MiB, t2, p1 verify p95,n20 | 31.15 ms | 40.81 ms |
| Argon2id 32 MiB, t3, p1 verify p50/p95,n20 | 64.77/68.40 ms | 63.00/72.08 ms |
| Argon2id 64 MiB, t3, p1 verify p95,n20 | 149.92 ms | 154.53 ms |
| Six admitted bounded KDF jobs p95 | 216.84 ms | 214.66 ms |
| Indexed SQLite read p95,n2000 | 0.0068 ms | 0.00545 ms |
| Worker request/reply p95,n100 | 0.154 ms | 0.204 ms |
| FULL/WAL transaction write p95,n80 | 2.916 ms | 6.037 ms |
| Busy probe including connection setup | 197.54 ms | 101.07 ms |
| Whole-probe peak RSS / delta | 123.24/81.59 MiB | 215.13/158.16 MiB |
| Whole-probe event-loop p95/max | 18.63/80.67 ms | 10.64/39.16 ms |
| First trusted synthetic TLS request | 22.18 ms | 13.15 ms |

The platforms ran sequentially, but host load was not controlled. Linux used a Docker local volume on the Windows/WSL2 host, not bare-metal Linux; Windows used native temporary storage. At n20 our reported p95 is the sample maximum. RSS and event-loop measurements include startup, all profiles, backups and TLS, so they cannot be attributed to the 32 MiB profile alone. The initial helper required syntax/DNS/SNI corrections before final runs; no application code was changed. The final 34 checks are the evidence, not the failed helper runs.

### Proposed measurable acceptance thresholds — not yet accepted

For a later integrated synthetic S2-A candidate on named target hardware, propose serial 32 MiB verification p95 ≤ 250 ms; six admitted jobs p95 ≤ 1 s; no more than2active/4 queued and overload returns a bounded explicit denial; indexed authority lookup including worker roundtrip p95 ≤ 10 ms; durable small-write p95 ≤ 25 ms; incremental authority/KDF RSS ≤ 256 MiB above recorded application baseline; runtime event-loop p95 ≤ 25 ms excluding offline ceremony/startup. Test at least 100 serial verifications and 10 repeat bursts under fixed load and record outliers, no-write denials, malformed PHC bounds and worker/store/revoke races.

These thresholds are proposals with headroom, not a claim the current application satisfies them. Any failure returns to review; do not weaken KDF, revocation or domain checks to meet a latency number.

## Implementation Work Packages

See the [selected implementation handoff](../implementation/central-policy.md): dependency/store boundary; bounded verifier and version contract; digest-only sessions and default-deny decision core; disabled synthetic pilot plus offline ceremony tests; exact-head CI and independent human security review. No such application work was begun in this preparation.

## Open Questions

Human decisions remain the exact code-only scope, revised WBS prerequisites or exception, private-store OS account/path and recovery custody, approved native build provenance, password/verifier input policy, browser hostname/issuer/trust deployment and acceptance budgets. Production activation, operator enrollment/migration/grants and existing-route cutovers require separate authorization even after a code candidate is accepted.
