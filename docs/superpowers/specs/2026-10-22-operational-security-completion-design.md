# Operational security completion design — 2026-10-22

## Intent and authorization

The operator requested autonomous implementation of remaining tasks2–8: original-Windows installation qualification, application authentication, scoped authorization, trustworthy release inputs, reliability, governance closure mechanisms and release readiness. Operator browser acceptance (task1) is explicitly deferred. The later authorization permits implementation decisions previously held for separate approval; it does not supply nonexistent people, credentials, custody, independent approvals or actual acceptance evidence. Record those facts honestly. Existing human-only SO/LA quorum and blocked operational capabilities remain enforced until their real prerequisites exist.

Baseline master is `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`. The implementation branch also preserves signed closure18981cdf and its nine documentation updates. Canonical WBS/history and PRs34/52 remain untouched. The approach is architectural; the operator waived iterative design/implementation approval and instructed the agent to select recommended engineering choices and document them.

## Alternatives and selected approach

1. Promote the TEST_ONLY fixture store into production. Rejected: fixture custody, temporary roots and synthetic signatures cannot acquire operational authority by renaming them.
2. Add a separate persistent workspace authority using existing pinned SQLite/Argon2 packages and the bounded KDF primitive. Selected. Keep the existing synthetic engines and their evidence unchanged. Put the operational principal/session/policy state and project snapshot in the same SQLite transaction, avoiding a dual SQLite/JSON commit gap.
3. Introduce an external identity/authorization service. Deferred: extra service custody, deployment and data-flow requirements are unnecessary for this loopback application.

## Execution boundaries

- Normal startup defaults to enforced access. Missing/uninitialized authority yields setup-required and exposes no project data. No default account or grant exists.
- An explicitly named LOCAL_DEVELOPMENT mode remains direct-loopback only and retains the local demo/legacy compatibility contract; the UI must disclose it. Only admitted disposable test fixtures set it automatically.
- Production authority lives under a private, fixed `.security` child of the selected workspace. No browser chooses filesystem paths, roles, principals or authority roots. Reject directory/file links, substitution, loose permissions and competing writers.
- Offline commands initialize/provision/reset/disable/member/recover only while the server is stopped. Passwords enter through private stdin; no password argument, environment credential migration or fixture identity enrollment occurs.
- A workspace person binding is still a local operator assertion. Explicit SO/LA role mapping is separate from project ownership. One person cannot fill two independent-human slots.
-14 privileged routes remain unavailable, live agents disabled and canonical self-project writes blocked. No Gate7 or release promotion is performed from a synthetic result or from the operator's waiver of development review.

## Persistent authority and transaction contract

New files: `server/security/workspaceAccess/contracts.ts`, `privateDirectory.ts`, `store.ts`, `worker.cjs`, `service.ts`, `http.ts`, `projectPersistence.ts`; CLI `scripts/workspaceSecurity.ts`; focused tests under `scripts/testWorkspace*.ts`. The parent owns service/HTTP/UI integration; a separate agent owns the private store/worker implementation.

`WorkspaceStore.open(workspaceRoot, {initialize?: boolean})` opens one private root and a bounded worker. Missing normal authority returns setup-required through the service; initialize is an offline explicit operation. The store owns an exclusive live-process lock. Close preserves all state; only explicit, verified stopped-owner recovery may remove a stale lock. No automatic lock stealing or data deletion.

Principal public shape: `{id,name,personId,roles:string[],canCreateProjects:boolean,disabled:boolean,credentialRevision:number}`. Only HUMAN principals are provisioned; roles are restricted to `Security Officer` and `Lead Architect` (possibly empty). Membership: `{projectId,principalId,role:'OWNER'|'EDITOR'|'READER'|'DENY',deniedActions?:WorkspaceAction[]}`. A project role cannot grant human quorum or any of the14 privileged operations.

Actions: `project:read`, `project:write`, `project:review`, `project:export`, `project:import`, `project:create`. Explicit DENY and deniedActions win. READER grants read; EDITOR grants read/write/export and review only when the principal separately holds an eligible human role; OWNER additionally grants replacement import. Creation needs canCreateProjects. All other actions deny. Existing canonical self-project permits read/export only, regardless of membership role. New project creation/import atomically assigns its actual authenticated creator OWNER; it does not grant access to existing projects.

Worker RPC input/output is plain, bounded structured data. Store exposes `execute(request):Promise<any>` and `close():Promise<void>`. Commands:

| Command | Required fields and result |
| --- | --- |
| `info` | No caller data; aggregate initialized/schema/generation/policyRevision/snapshotRevision/provenance/counts only |
| `bootstrap` | `principal`, strict Argon2id `verifier`, optional `stateJson`; accepts exactly once, offline; initial state imports data only and grants no implicit ownership |
| `provision` | `principal`, `verifier`; offline, no default grants |
| `membership` | `projectId,principalId,role,deniedActions`; offline, exact existing resource, no self-project write grant |
| `credential` | `name`; returns private verifier plus current principal/revision/generation for the service only |
| `admitLogin` | `key,now`; persisted per-name/global bounded throttle and nondecreasing clock, returns boolean |
| `issue` | `principalId,expectedCredentialRevision,expectedGeneration,digest,now`; exact credential/generation CAS, human/enabled checks, atomic session+audit |
| `session` | `digest,now`; current principal only on valid generation/credential/idle/absolute session fences, updates activity |
| `rotate` | `digest,replacementDigest,now`; atomic single successor, returns boolean |
| `logout` | `digest,now`; revoke and audit atomically |
| `changeCredential` | `digest,expectedCredentialRevision,verifier,now`; service already verified current password, worker rechecks CAS/session and revokes all that principal's sessions |
| `resetCredential` | `principalId,verifier`; offline, bumps credential revision and revokes sessions |
| `disable` | `principalId`; offline, revokes sessions and authority |
| `authorize` | `digest,action,projectId?,now`; returns `{allowed,reason,principal?,policyRevision,snapshotRevision}` from current server-owned records |
| `snapshot` | Returns `{stateJson:string|null,snapshotRevision:number}`; private startup/persistence use only |
| `commit` | `digest,action,projectId?,expectedRevision,expectedPolicyRevision,stateJson,now`; reauthorize inside the same immediate transaction, compare-and-swap revisions, validate mutation scope, update snapshot/membership/audit atomically |
| `audit` | Offline diagnostic with bounded redacted security events; never credential/session token values |

Snapshot scope validation rejects collateral changes to other projects and their keyed collections; create/import permits exactly one server-generated new project and preserves existing objects. A replacement import requires ownership. Session acceptance is not cached authority: every action checks current principal/membership records; commit checks again. Policy changes invalidate stale commit fences even when an existing login remains usable for newly authorized reads. Security/JSON atomicity is achieved by making the operational SQLite snapshot authoritative; the existing `.local/project-state.json` remains unchanged historical migration input. Offline explicit initialization is the only migration route, and its original bytes/digest must be preserved.

## Candidate resource constraints

Preserve bounded KDF: Argon2id32MiB,t3,p1, two active/four queued,2s queue wait, password<=1024UTF8bytes and minimum12 on new credentials. Preserve worker16 pending/3s RPC/10s startup. Candidate operational store caps:128 principals,512 memberships,256 sessions,4096 security events,128 throttle keys,64MiB serialized snapshot. Login throttle5/name and30/global per60s persists across process restarts. Session10-minute idle/30-minute absolute expiry; restart generation fences old tokens. Full audit/storage capacity rejects new mutations explicitly; never silently trims authority/history. Expired sessions/throttle windows may be reclaimed with audited semantics; no accepted live token is revived. These are candidate admission constraints, not production capacity ratification.

## HTTP, browser and transport

Map every registered API method/path to a server-owned action/resource. Filter list results; return404 for inaccessible project IDs; creation/import determine ownership at the atomic commit, not from a body actor. HEAD/case/trailing slash aliases use the same checks. Unknown methods/paths and14 privileged families fail closed. Existing reviewer controllers resolve current server-owned identity; trusted operational identity cannot be supplied by a header/body or inferred from a role string.

Use opaque random256-bit session cookies with HttpOnly/SameSiteStrict and Secure under TLS. Derive CSRF proof from a per-process secret and token; require it and same-origin checks on every state-changing API call, including session rotation/logout. Fetch/session state lives in memory; logout/expiry/principal switch unmounts project UI and discards previous personal confirmations. No tokens in localStorage or exported packages.

Retain direct IPv4 loopback. Support HTTPS using explicit private certificate/key files and SAN127.0.0.1 validation; no system trust installation or production certificate enrollment is performed automatically. HTTP local development is disclosed, never represented as qualified shared deployment. Production transport acceptance and custody remain explicit prerequisites.

## Evidence, governance and acceptance

Replace status/entity-count release claims with exact scope and explicit unavailable/failed/local observation states. A bounded readonly GitHub adapter pins project/repo/workflow/job identities and exact commit; its CI observation never establishes requirement/human/governance approval. Independent-person and custody decisions remain real external facts. Governance preflight invokes actual existing verifiers and preserves mayApply:false; synthetic success cannot clear operational gates.

Acceptance requires positive/negative actual-HTTP authentication/RBAC tests, cross-project/package isolation, stale/revoked session and CSRF tests, atomic snapshot/policy rollback tests, restart/corruption/lock/link/capacity failure tests, unchanged synthetic suites/canonical historical evidence, WBS/TypeScript/build/controlled docs/full regression and all four required actual candidate/post-merge jobs. Operator browser acceptance remains deferred, not silently passed. Rollback is a normal revert plus deliberate stopped-state restore; older JSON code must never overwrite the authoritative SQLite snapshot or its only backup.
