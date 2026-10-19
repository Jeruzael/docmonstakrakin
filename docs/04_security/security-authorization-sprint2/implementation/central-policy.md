# Implementation Plan: Central project authorization

## Selected Design And Constraints

**Candidate option, not selected or authorized.** The operator explicitly requested an implementation-ready sequence. S2-A through S2-F below are proposal labels, not WBS IDs, assignments, status transitions or permission to activate anything. [Architecture options and rationale](../proposals/project-authorization.md) remain subject to human review.

The recommended first implementation candidate is **S2-A: identity, session and policy primitives with an actual-server authentication pilot**. It must not imply that existing project routes are authenticated. Project/package access remains partially contained until its individual cutovers pass. No slice may reopen secrets, Git or agent dispatch before that slice's explicit authorization.

## Source Revision And Drift Check

Source revision: `f35fa7bcd9fb00942c1bba76741a22a5cc7c80b8`. Evidence inventory SHA-256: `1962ac92e9722d39185daecd99ad565b08c319bb38de8b27024bc517bb998864`. Re-fetch master, compare route/security/persistence ownership and re-inventory before any implementation. Material drift returns to design review; do not silently adapt an approved permission matrix.

## Affected Components

Proposed work touches `server.ts`, `server/security/apiRoutePolicy.ts`, a private identity/policy repository, approved scheme-aware changes to `server/security/localPerimeter.ts` and `vitePerimeter.ts`, `server/projectPersistence.ts`, `server/projectStore.ts`, proposal/identity/signoff/document routes and their client flows. Package serialization and audit provenance need their own integration. Later slices touch existing SecretStore/Git guards and Agent Center contracts. These are proposed file families, not changes made by this PR.

## Ordered Work Packages

### S2-A — Human identity, sessions and decision primitives (first candidate)

**Dependencies:** Human architecture/transport review, private-store/KDF selection, explicit implementation authorization, and resolution of the conditional DMK-209/210/211 ownership/dependency gates. PR #34 is still unmerged; PR #46 is not full DMK-209 completion. A separately documented bounded preparatory exception would require explicit operator authorization, not an inferred dependency override.

**Scope and acceptance:** Versioned HUMAN principal/verifier repository outside Git and project packages; bounded asynchronous verifier work; session digest, generation/expiry/revocation; pure registered-capability decisions with explicit-deny precedence. Offline bootstrap creates no implicit reviewer/project grants. Exercise actual newly registered authentication/session/self-inspection routes in a disposable app instance. Existing 14 disabled routes stay disabled. No operator enrollment, credential migration or existing-route cutover occurs merely to demonstrate primitives.

**Negative tests:** Unknown/disabled principal, malformed verifier, spoofed HUMAN/role, incorrect password, reused pre-login cookie, expired/rotated/revoked session, restart, CSRF/origin mismatch and authority-store outage fail closed. Malformed bootstrap/recovery state never opens HTTP enrollment or an administrator shortcut. Verify no credential/token/secret appears in logs, responses, packages or repo.

**Compatibility:** New login is a pilot, not proof of general authorization. Label legacy access still unscoped; keep the containment notice. Browser authentication activation depends on separately approved loopback transport/certificate handling; synthetic listener tests do not authorize trust-store installation.

**Rollback:** Stop pilot endpoints and restore private-store backup under reviewed offline procedure; invalidate session generation. Keep all pre-existing containment. Do not roll back into an implicit owner or a weaker verifier.

**Closure evidence:** Actual-registration HTTP transcripts, verifier/resource measurements, restart/revoke and crash recovery results, clean protected-file diff, 3 exact-HEAD CI jobs and independent human security review. Primitive readiness is not closure of AZ-01 through AZ-06.

### S2-B — Workspace discovery, project ownership and membership boundary

**Dependencies:** S2-A accepted, reviewed minimal capability registry and human-approved bootstrap/project grants. Conditionally maps to proposed DMK-212 with DMK-198 retaining reviewer provisioning UX.

**Scope and acceptance:** Explicit stable owner/membership records independent of display `project.owner`. Filter project listing by current discovery/read grants; authorize project creation and atomically assign the creator's initial project-scoped rights from server identity. Authorize project-detail access using canonical project handles; no arbitrary payload/header identity. Treat nonmember and unknown resources uniformly to avoid existence leaks. Initial resource resolver checks all nested IDs.

**Negative tests:** Anonymous project list/detail/create; A-to-B reads; nonexistent versus hidden project timing/body/count differences; forged owner; duplicate/grant race; last-admin recovery boundary; role self-escalation; revoked membership during a request. Known valid same-project create/list/read must succeed. No failed transaction may leave an orphan project or membership.

**Compatibility:** Existing owner strings cannot be promoted automatically into accounts/grants. Human reviews an exact project/principal mapping. Unmapped projects deny at cutover. Other route families remain explicitly unscoped until S2-C/D, so no global tenant-isolation claim follows this slice.

**Rollback:** Disable the cutover family and preserve backup/mapping evidence; keep new grant data quarantined if schema reversibility is uncertain. Never re-enable anonymous access to make old clients work.

**Closure evidence:** A/B isolation and creation atomicity traces, migration dry-run with explicit unresolved entries, no unauthorized ledger/snapshot writes, restored-state rehearsal and exact-HEAD CI.

### S2-C — Portable packages and sensitive project/document data

**Dependencies:** S2-B membership/resource handles; reviewed source ACL and package-destination contracts; approved one-to-one binding of general and reviewer sessions wherever an operation uses both. DMK-206 retains evidence adjudication; this slice protects access rather than replacing adjudication.

**Scope and acceptance:** Distinct workspace `import.create` and existing-target `import.replace` authorization; payload destination must match the explicitly resolved target. Require fresh destination state digest, scoped replacement intent, schema/size limits and existing seal checks before the transaction. Preserve local audit chain; record foreign ledger as unverified imported history with digest and server-attributed import event. Keep all existing imported-governance downgrades.

Apply source-read/export rights and ACL intersection to both exports, compiler, evidence/audit reads and registered documents. Document reads/diff/validation require permission before file access; save additionally retains HUMAN, controlled-edit, pin and journal checks. Packages may never serialize identity/session/grant secrets or install permissions.

**Export contract:** Current GET/HEAD package export mutates audit and remains protected by Sprint 1's interceptor until an approved cutover. Prefer a CSRF-protected POST download; after migration, old GET/HEAD aliases return 405 without audit/state effects. Update UI download behavior and route inventory together. Do not remove export auditing to pretend the GET is pure.

**Negative tests:** Anonymous/nonmember full export, body-only target switch, resealed wrong-project overwrite, forged owner/actor/approval/ACL, conflicting general/reviewer principal cookies, altered/unavailable base digest, stale permission mid-commit, failed import after document/audit work, source-hidden derived output and read-only route aliases. Assert byte-identical denial across state, local ledger, document/journal, vault and Git. An authorized same-project export/import round trip must retain provenance and fresh-signoff requirements.

**Compatibility:** Downloads become an authenticated operation; old GET clients require explicit update or safe 405. Unauthorized import/overwrite stops. Restoring a package does not restore local identity, approval authority or grants.

**Rollback:** Disable import/replace/export/save families; keep the original local ledger and recoverable data backup. Reverting permission code while accepting anonymous packages is forbidden.

**Closure evidence:** Exact destination/ACL matrix, concurrent overwrite/revoke/crash cases, import provenance and old-client behavior, actual main entrypoint tests plus controlled-doc transaction suites and exact-HEAD CI.

### S2-D — Remaining legacy route cutover and reviewer scope

**Dependencies:** S2-B/C and accepted per-route capability matrix; preserve DMK-197 inbox/quorum and DMK-208 canonical status ownership. Coordinate approved reviewer mappings with DMK-198 rather than duplicating its UX.

**Scope and acceptance:** Move every remaining legacy operation to an explicit capability/resource check before persistence. Handle discovery, features, requirements, WorkItems, architecture, proposals, next-action/WBS/release views and metadata. Repair the requirement-status allowlist as a separate domain constraint. New audit events use server-resolved identity/kind and policy provenance; keep caller labels as unverified content only.

Existing qualified-human reviewer checks remain mandatory in addition to project authorization. Security Officer/Lead Architect quorum and existing release preconditions are unchanged. The gate cannot be satisfied by project administrator, workspace owner or an AGENT. Unknown registrations, unsupported methods and aliases fail closed by construction.

**Negative tests:** Every registration across anonymous, member, nonmember, read-only role, relevant writer, eligible human reviewer and AGENT; explicit deny versus allow; nested foreign IDs; role/grant version changes; invalid status; self/duplicate governance identities. Stale-state conditions must not run before authorization. Positive legitimate workflows remain, using synthetic configured permissions.

**Compatibility:** Anonymous project APIs cease working. Client login/logout and project/principal/policy-keyed cache clearing must be tested. Old unauthenticated regression fixtures must gain explicit test identity/grants and keep their original business assertions; do not delete cases to get green CI.

**Rollback:** Disable failed route families, restore a reviewed permission revision, revoke affected sessions and preserve data. Never fall back to legacy unscoped allowances.

**Closure evidence:** Closed registration-to-capability inventory (including deliberate public minimal health/session endpoints), no residual legacy allowance, all old and new assertions, recorded compatibility breaks and independent human review. Do not claim this milestone if any ordinary family remains open.

### S2-E — Explicit secret and repository capabilities

**Dependencies:** S2-D; fresh human administrative authorization, scoped repository/workspace mapping, existing SecretStore and sandbox controls. Any actual rotation/migration or credential-store change is separately approved.

**Scope and acceptance:** Re-enable only individually reviewed operations. Secret metadata access is separate from writes/rotation; raw credentials never become HTTP exports. Repository read and mutation capabilities bind an owned root and allowed operations; they never grant arbitrary command execution or parent repository access. Require current human permission/reauthentication and any existing governed approval; a reviewer cookie alone is insufficient.

**Negative tests:** Project admin/reviewer/AGENT without administration; forged repo path/project ID; parent-root escape; shell/argument injection; stale admin grant; failed credential/Git mutation; concurrent policy change. Re-run existing path/sandbox/key-integrity tests and actual-handler denials. Unauthorized operations leave vault, index, refs and workspace bytes unchanged.

**Compatibility:** UI enables controls only after backend policy permits each action. Unsupported operations remain 403 even if another operation is enabled.

**Rollback:** Immediately restore early denial for the affected group and revoke administrative sessions; use separately authorized Git/vault recovery, not automatic key rollback.

**Closure evidence:** Exact per-operation grants/denials, safe fixture-only ceremonies and repository diffs, no leaked credentials, 3 CI jobs and independently attributable human approval for actual administrative activation.

### S2-F — Machine identity and bounded delegation readiness

**Dependencies:** S2-D and relevant S2-E operations, proposed DMK-213/214 governance, plus Agent Center v0.3 durability, source lineage/ACL, provider consent/egress and truthful lifecycle contracts. Authentication alone does not satisfy live-operation readiness.

**Scope and acceptance:** Independent AGENT IDs and audience-bound, expiring, revocable delegations with action/project/resource/limit intersection. Grants never exceed delegator or current project policy. Provider/model/agent names carry no authority. Human approvals, signer enrollment and quorum capabilities cannot be delegated, even through custom roles or a nested grant chain.

**Negative tests:** AGENT supplies `kind:HUMAN`, human sender, delegated admin, another project, widened resource, stale/replayed/revoked token, switched audience or injected prompt authority. Revocation before enqueue, queued delivery and commit stops new privileged effects. No external GPT/Claude/Gemini call occurs in auth tests; provider behavior is a separate synthetic integration contract.

**Compatibility:** Demonstration labels and dispatch denial stay until all live-worker prerequisites have separate evidence and approval. There is no automatic live execution cutover at the end of an auth sprint.

**Rollback:** Revoke delegation epoch and disable dispatch/agent write routes, preserving attributable uncertain outcomes. Do not call a stopped local process proof of provider cancellation.

**Closure evidence:** Actual authenticated entrypoints with synthetic agents, current grants and expired/revoked cases, no human-quorum contribution, no provider calls on denial, separate live-system readiness review.

## Compatibility And Migration

Keep an explicit table for each family: prior contract, new auth/capability contract, old-client behavior, migration mapping, backup and safe disabled rollback. No stage silently accepts the legacy contract after its authorization cutover. Human reviewer provisioning and old roster migration are separately reviewed; existing test-only identities never become operator accounts.

## Tactical Protections During Migration

Retain loopback binding, startup validation, Host/Origin/ambiguous-path policy, disabled auxiliary HMR listeners, all 14 administrative/dispatch denials, specialized HUMAN gates, immutable evidence/manifest pins, canonical WBS protection, import governance downgrades and atomic snapshot/document recovery.

## Tests And Security Validation

For each slice, test the actual application registration and caller-visible response, not a duplicated router. Cross product principal state, project scope, capability, explicit deny, resource relationship, HTTP alias and permission revision. Include no-Origin native callers, cross-origin browser calls, stale snapshots, abort/timeout, simultaneous revoke/commit, write-lock contention and restart. Compare storage bytes and audit counts. Verify source ACL inheritance in context, export, UI caches and metadata discovery.

Unit tests for the decision engine supplement those entrypoint tests. Future tests specified here have not been run. The current [15-case probe](../evidence/characterization.log) characterizes known gaps; it is not expected-remediation coverage.

## Performance And Resource Benchmarks

Benchmark current baseline and each candidate on the same target workstation with fixed synthetic project sizes and package limits: authorized/denied read and write p50/p95, import/export latency, concurrent login KDF saturation, event-loop delay, peak/idle RSS, session/grant index growth and authority-store failure recovery. No measurements or numerical acceptance budgets have been obtained. Owner-approved latency/RSS/concurrency budgets and a demonstrated bounded fail-closed path are prerequisites to activation; do not trade away checks to meet them.

## Rollout And Rollback

Deploy no stage automatically. Review the exact commit, route family, permission/schema version and authorized mapping; run disposable migration/restore rehearsals and all 3 exact-HEAD CI jobs. A rollback may disable an operation or stop the service. It must not reopen an unauthenticated route, adopt foreign approvals, bypass revocation or overwrite immutable history. Runtime/operator backups and restore actions need their own explicit authorization.

## Acceptance Criteria

The documentation proposal is review-ready when source counts/evidence are reproducible, alternatives and residual risks are stated, every slice has dependencies/tests/compatibility/rollback/evidence, and historical/governance status remains truthful. Implementation closure additionally requires actual negative and positive entrypoint tests, preserved existing suites, exact candidate CI and human review. Proposed architecture or login alone never meets closure.

## Open Decisions

The immediate next human action is to review this draft documentation PR and approve or revise the design recommendation and sequence. A later separate authorization must name the exact S2-A scope, ownership/dependency resolution, security-store/KDF choice and transport boundary before code starts. Operator enrollment/migration, role grants, privileged re-enablement, live agent execution, WBS registration/reconciliation, Gate 7 and release remain separate blocked actions.
