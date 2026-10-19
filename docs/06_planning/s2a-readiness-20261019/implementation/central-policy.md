# Implementation Plan: Selected Option 2 S2-A candidate

## Selected Design And Constraints

**PROPOSAL / NOT AUTHORIZED / NO APPLICATION IMPLEMENTATION BEGUN.** Option 2 remains selected. This preparation added only documents, synthetic primitive probes and an unapplied governance proposal; no security store, credentials, grants, HTTPS configuration or authentication routes were added to the application.

Candidate stack: better-sqlite3 13.0.3 in a private owned worker; argon2 0.45.1 Argon2id at 32768 KiB/t3/p1, 32 byte output, 16 byte random salt; max 2 active + 4 queued; 32 byte opaque sessions stored as SHA-256 digests; 10 minute idle/30 minute absolute expiry; Node 22.21.1 loopback TLS 1.3, dedicated per-install hostname and explicit approved trust. Exact measured evidence and limits are in the [decision proposal](../proposals/s2a-foundations.md).

## Source Revision And Drift Check

Reviewed AZ-08 source: e33f5ea7869db34654c831550c91029e2236b789. Master during preparation: bf5d617fa5bb76323714cc21cc20270acd826616. Before a future implementation, use the separately authorized actual PR #48 merge plus successful post-merge CI as the baseline, recheck current policy/route/persistence code and exact accepted decision revision. Halt for changed reviewed HEAD, material requirement/base drift or failed CI; do not invent the future merge SHA.

## Affected Components

Proposed new families, subject to exact final review: server/security/identity/, sessions/, policy/, securityStoreWorker.ts and offline security administration tooling; actual-server and isolated-worker tests. Exact production HTTP registration, middleware ordering and scheme-aware perimeter changes must appear in the authorized file/API list. Existing application/persistence/quorum/WBS APIs do not change merely because this plan exists.

## Ordered Work Packages

### Private repository and dependency boundary

Pin the measured package versions and reviewed lockfile; verify native artifact provenance and Windows/Linux packaging. Resolve the exact OS user and per-install private directory outside all repositories/project/package data. Protect parent, DB/WAL/SHM/locks/backups; use one writer/worker, parameterized statements, foreign keys, versioned migrations, WAL and FULL durability. Unsupported schema, corrupt store, missing permissions, locked writer or failed recovery deny; no in-memory/default-user fallback.

Require transaction/reopen/corruption/busy/disk-full/crash/backups and permission-boundary tests on actual target filesystems. The current experiment covers rollback, read-only/corrupt/busy, uncommitted child crash and backup integrity; it does not cover every production crash or disk-full scenario.

### Bounded verifier contract

Use profile version 1: Argon2id v19, 32768 KiB, t3, p1, 32 byte hash and 16 random salt bytes. Validate encoded verifier version, type, canonical fields, bounded lengths and approved parameter profile before invoking native verification; hostile stored PHC parameters must not request unbounded work. No scrypt/weak fallback or automatic legacy-roster migration.

Use an asynchronous admission queue with at most 2 active/4 queued; a proposed 2 second queued wait limit and explicit overload response. An aborted/timed-out response must not free active budget while native work still runs. Add per-principal/global throttles and a bounded dummy-verification path for unknown accounts without account enumeration. Exact password/Unicode/input policy and throttles must be approved, not silently inferred from display names.

### Sessions, principals and default-deny core

Use stable HUMAN principal IDs, random 32 byte tokens, digest-only persistence, monotonic credential/policy revisions and server restart generation. Rotate on authentication/privilege changes; logout/reset/disable/recovery revoke. Enforce 10 minute idle and 30 minute absolute expiry; do not extend absolute expiry. Unknown principal/action/resource, explicit deny, unavailable authority and stale revisions deny.

Session acceptance alone does not grant project discovery, ownership or reviewer roles. General and existing reviewer contexts must bind the same stable human on combined-plane operations. AGENT cannot satisfy human quorum. Capabilities and canonical resource handles remain server-owned; caller actor/model/provider labels are content only.

### Disabled synthetic pilot and offline ceremonies

A future code-only candidate may include login/logout/self-session APIs only under an explicitly enumerated disabled pilot boundary, exercised by actual registered test entrypoints with synthetic configuration. Proposed routes for review: POST /api/security/login, POST /api/security/logout, GET /api/security/session. Registration, listener changes and cookie/CSRF contract must be explicitly approved; production stays fail-closed/unconfigured.

Use approved same-origin loopback HTTPS with exact Host/Origin and synchronizer CSRF; preserve loopback/no-public-override constraints. Host-only Secure/HttpOnly/SameSite=Strict cookies use the __Host- prefix and Path=/, no Domain. No CA or hosts-file modification is permitted by a code-only candidate. Real browser acceptance under the approved issuer is still required; Node fixture TLS tests do not prove it.

Offline tooling must require service stopped, explicit operator authority, private-directory checks, exclusive ceremony lock and transactional state validation. Bootstrap creates workspace administration only; no project ownership or governance reviewer privileges. Recovery uses consistent SQLite backup, reviewed AES-256-GCM protection/custody, audit preservation and session-generation invalidation. No operator ceremony runs during implementation testing.

### Coordinated revisions and future cutovers

Define typed decision/resource handles and the coordinator contract now; do not claim route protection before actual enforcement. All later sensitive reads/writes must check current principal/credential/session/policy revisions before access and recheck under the owned commit coordinator. JSON/docs/SQLite are not one ACID resource: durable recovery intent and crash-point tests are required before cross-store publication is accepted.

Project membership/creation, package/document/context cutovers, remaining ordinary routes, secret/Git capabilities and agent delegation remain S2-B through S2-F. No existing route becomes implicitly protected or privileged capability enabled in S2-A.

## Compatibility And Migration

No operator roster/package-owner mapping is automatic. Old display strings do not become stable identities or grants. Existing valid ordinary routes remain explicitly unscoped until individually accepted cutovers; keep the containment notice. Credential migration, enrollment, granting ownership/reviewer roles and browser activation are separate human decisions.

Native dependencies add build/packaging requirements: a slim Linux image failed without Python; the measured build-capable image succeeded. The exact CI runner/package deployment must reproduce imports and negative behavior before acceptance. No experimental built-in SQLite API or alternative KDF is substituted silently.

## Tactical Protections During Migration

Keep all 14 privileged registrations blocked, specialized human gates and quorum unchanged, AZ-08 domain validation, package governance downgrades, atomic project snapshot/document recovery, canonical WBS and historical receipts. Live agents, Gate 7, live reconciliation and release remain unchanged.

## Tests And Security Validation

Require real entrypoint and worker tests across bad credentials, malformed PHC/versions/size, queue saturation/abort/timeout, rotation/fixation/replay, both expiries, restart/revoke/disable, conflicting identities, explicit deny and missing authority. Test capability/resource mismatch, stale permission before commit, simultaneous revoke/write, locked/corrupt/full storage and every durable recovery crash point. Denied calls leave all relevant state/audit/files unchanged.

The current 34 primitive cases per OS are feasibility evidence only. The PR #48 actual-route 105 cases and CI cover the tactical domain fix, not these future identity/session routes. At implementation publication require all 3 exact-HEAD CI jobs and independent human security/architecture review.

## Performance And Resource Benchmarks

Approve the proposed thresholds in the [measured matrix](../proposals/s2a-foundations.md): serial verification p95 ≤ 250 ms, admitted bounded burst ≤ 1 second, authority lookup+RPC p95 ≤ 10 ms, small FULL/WAL transaction p95 ≤ 25 ms, auth-subsystem delta RSS ≤ 256 MiB and runtime event-loop p95 ≤ 25 ms, measured against an actual application baseline with fixed input/load.

Re-run at least 100 serial verifications and 10 bursts on Windows and Linux. Report failures/outliers, CPU/quota/filesystem details and resource attribution. The current 20 sample profile measurements and whole-probe RSS cannot establish accepted application SLOs. No security check is removed to reach a number.

## Rollout And Rollback

No automatic rollout. Review exact HEAD, dependency lock/native build, private schema, hostname/trust, ceremony scope and permission contract. A failed candidate disables the pilot/family, revokes session generation, preserves audit and restores reviewed private state offline. Do not fall back to a weaker verifier, anonymous access or implicit owner/admin.

## Acceptance Criteria

The code/test candidate is acceptable only with all authorized API/file boundaries implemented, actual negative/positive tests passing, measured budgets evaluated, unchanged protected/canonical files, exact-head CI and independent human review. Operational acceptance additionally requires separately authorized OS/backup/trust/bootstrap/recovery and browser tests. Neither is implied by this decision package.

## Open Decisions

The operator must separately authorize PR #48 merge; governance must accept the [dependency/forward-evidence proposal](../GOVERNANCE_RESOLUTION.md) or exact [bounded exception](../governance/preparatory-exception-proposal.json). Before S2-A code starts, name the exact baseline/file/API scope, private path/user/schema, native build provenance, verifier/input/throttle/session profile, browser issuer/hostname/trust and disabled behavior, offline authority/key custody/recovery, measured acceptance/rollback and independent reviewer. No authorization exists yet.
