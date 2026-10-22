# Local readiness setup and explicit release scope — 2026-10-22

## Design and acceptance

This additive module resolves project maturity/source-control decisions and records an explicit current-release work denominator. It grants local planning context only. It does not execute repository/provider actions, enroll identities, approve work, ratify technical selections, or promote local attestations into production trust.

Acceptance criteria:

- Existing configured HUMAN Security Officer/Lead Architect authority gates every readiness read/write. Missing/invalid identity and the canonical self-project are rejected.
- Saving setup works before any work exists. An omitted scope preserves existing scope. An explicit scope requires unique existing work IDs in this project, the exact current `targetRelease`, a full lowercase commit SHA, exact build revision, and exact environment.
- Every mutation requires `expectedStateVersion`, increments project state once, records one sanitized local planning audit event, and uses existing transactional snapshot persistence. Scope ID/revision/actor/timestamp are server-controlled.
- Read summaries report exact scoped IDs, denominator, version and formula. Unrelated future tasks do not contribute. Stored lifecycle counts remain separate from local evidence review.
- Only a server-supplied resolver can supply current local evidence observations. Missing, inconsistent, stale, mismatched or rejected observations do not count. Security and production release remain unavailable.
- The editor retains drafts after rejection/uncertainty, blocks unsafe retries after timeout/CAS conflict until explicit reload, fences old project/session results, and calls `onChanged(projectId, stateVersion)` only after a valid save acknowledgement. The validated version lets the parent advance its acknowledgement floor before reloading; it does not certify the loaded snapshot.

## Files and integration types

All implementation files are new:

- `src/releaseScopeTypes.ts`: `ReadinessProject = Project & {readinessContext?: ReleaseScopeContext}`, scope request/context, evidence-adapter and response/summary types. Parent may add the optional `Project.readinessContext` field by importing `ReleaseScopeContext`; this branch does not edit shared `types.ts`.
- `server/readiness/service.ts`: validation and synchronous setup/scope/audit mutation.
- `server/readiness/routes.ts`: `registerProjectReadinessRoutes(app, store, requireHuman, evidenceResolver?)`.
- `src/data/releaseHealthProjection.ts`: pure `releaseHealthProjection(project, workItems?, evidence?)` and bounded context validators.
- `src/components/ProjectReadinessSetup.tsx`: editor plus read-only summary.
- `scripts/testProjectReadiness.ts`, `scripts/testProjectReadinessUi.ts`: focused tests.

Parent integration must register both `GET` and `POST /api/projects/:id/readiness` as `SPECIALIZED_REVIEWER`, after existing perimeter/reviewer authorization and project persistence middleware. POST fails with 503 when the existing persistence middleware has not established `res.locals.projectPersistenceMode === 'MUTATING'`. No duplicate persistence layer is installed here.

Pass the existing `reviewerAuth.requireHuman` callback. Route-level validation also rejects malformed actor IDs/names (empty, whitespace, controls or more than 160 characters), AGENT kind, wrong role source, and absent SO/LA authority. This does not change ordinary session login semantics.

The optional resolver has this structural signature:

```ts
(projectId, current: {
  workItemId: string;
  commitSha: string;
  buildRevision: string;
  environment: string;
}) => LocalReleaseEvidenceObservation | Promise<LocalReleaseEvidenceObservation>
```

Parent adapter:

```ts
(projectId, current) => projectVerificationEvidence(store, projectId, current)
```

The verification module owns revalidation of the current WorkItem/acceptance criteria, submitted digest, actual evidence bytes/provenance, role quorum, person bindings, and author/reviewer separation. The readiness GET supplies exact current server-stored scope binding; it never takes binding from a submitted bundle. The pure projection independently checks wrapper project/task/commit/build/environment, observation consistency, the literal local trust classification, and `trustedProductionEvidence: false`. The resolver is a trusted server dependency, never a client request field.

## API contract

POST body:

```ts
{
  expectedStateVersion: number;
  maturity: 'GREENFIELD' | 'EXISTING_PROJECT' | 'MIGRATION' | 'EXTENSION';
  sourceControl: string;
  scope?: {
    targetRelease: string;
    workItemIds: string[];
    commitSha: string;
    buildRevision: string;
    environment: string;
  };
}
```

Unknown fields, client actors/revisions/trust/results, duplicate/unknown work IDs, empty scope, mismatched release, and malformed build binding are rejected with 422. Scope supports at most 1,000 explicitly selected work IDs. Build/environment/source-control labels are bounded to 160 characters, without leading/trailing whitespace or control characters. SHA-1 and SHA-256 full lowercase commit identifiers are supported (40/64 characters); no branch names or `HEAD` inference occurs. Source-control selection is normalized to existing `USER_SPECIFIED` / `NOT_RATIFIED` semantics, preserving other technical baseline fields.

Both methods return `ProjectReadinessResponse`: project/version/setup/target release, current context or null, work options, and `LOCAL_RELEASE_HEALTH/1` summary. GET is read-only and `Cache-Control: no-store`. Canonical `PRJ-DOCMONSTAKRAKIN` is rejected with 403 for both methods; no self-project recovery/write bypass is created.

POST mutates and emits its persistence response in one synchronous turn. It deliberately does not await evidence between mutation and snapshot commit. Its acknowledgement therefore reports evidence unavailable; a subsequent explicit GET evaluates current local evidence. GET snapshots project/work input and returns 409 if that data changes while an asynchronous resolver runs, preventing a mixed summary with a newer CAS version.

Other failures: 401/403 authorization, 404 missing project, 409 stale/ambiguous/corrupted current state, 500 persistence/audit failure, 503 missing transactional middleware. Existing middleware rolls project fields, scope revision and audit back together when persistence fails. Invalid stored context requires separate recovery and is never silently rewritten.

## Projection and trust bounds

`scope` contains exact IDs/count/revision/target/commit/build/environment. Unknown/missing/duplicate scoped work or unknown lifecycle status produces unavailable results. Known lifecycle counts describe stored WorkItem status only. They are not accepted evidence and are not an implementation completion percentage.

Local review formula is `round(100 × locally reviewed scoped work items / scoped work items)`. A task counts at most once when a consistent, scope-bound server observation contains an eligible local review session. Valid observations with no eligible session produce known zero; an absent/failed/inconsistent resolver produces unavailable, with no invented zero percentage. Unrelated tasks/evidence are excluded.

`securityAssurance` and `productionRelease` always remain `Unavailable` in this module. No authenticated production evidence source is implemented here. Separately authenticated production evidence and an independent human release decision belong to the strict release evaluator. Stored work statuses, local roster assertions, human attestations, inline byte hashes, and fixture-only simulated ready reports must never grant actual release authority.

## Editor behavior

Render `ProjectReadinessSetup` with `{project, onChanged(projectId, stateVersion), sessionRevision?, canEdit?}`. The callback receives the exact validated save version; update the parent's acknowledgement floor before requesting its canonical reload. Pass session revision and `canEdit` from the parent's current reviewer observation so identity changes immediately hide prior reviewer-scoped data. The backend remains authoritative even when the display prop is true.

The initial reviewer-gated GET supplies CAS/version and work options. Changes to the parent project state version immediately hide prior observations, abort requests, fence stale save callbacks and start a fresh GET; the new observation supplies the next CAS value. Users save project setup independently or explicitly save selected scope plus setup. The current target release is shown read-only and bound exactly; no scope/work/build/environment is invented by default. Saved scope IDs that disappeared from current work are shown as unavailable selections that the user can clear, rather than becoming an unrepairable hidden choice.

Controls disable during requests; a synchronous ref rejects repeated same-turn actions. Every transport/body decode has a 20-second deadline. A timeout or malformed success leaves outcome unknown and never announces save completion or retries the write. Conflict/uncertainty retains the draft and requires explicit reload before another mutation; reload explicitly replaces the draft with server observations. Project/session generations fence late reads, writes and callbacks. A parent refresh failure is reported separately from an already confirmed save.

The parent must make this editor reachable from dashboard metadata CTAs (project maturity and source control) and surface the read-only release projection with current scope data. The component is not wired into App/Dashboard in this isolated branch.

## Verification evidence

Portable Node 22.23.3; existing dependency junction reused without installation or SDK/host changes.

- New endpoint/projection and component suites were written before implementation; initial runs failed because the new modules/component did not exist.
- Concrete behavioral RED → GREEN checks covered an evidence wait before persistence, canonical GET admission, old-project pending status visible during switch, invalid source-control text returning 500 instead of 422, malformed actor admission, unavailable scoped selections lacking recovery controls, inconsistent evidence totals rendering arbitrary data, malformed maturity coercion, and missing project-version invalidation.
- `node --import tsx scripts/testProjectReadiness.ts`: **30 passed**, covering pure denominator/binding/trust rules, authenticated HTTP validation (including maturity arrays/objects rejected with 422), CAS, scope revision/actor, read-only GET, real temporary snapshot persistence, writer-lock rollback, missing middleware, and concurrent GET/save consistency.
- `node --import tsx scripts/testProjectReadinessUi.ts`: **13 passed**, covering actual component handlers through a small in-memory hook/element adapter, exact payloads, duplicate prevention, conflict/reload, timeout/late replies, project/session/version switches, bounded HTTP errors, malformed acknowledgements, unavailable task removal and summary validation.
- `node node_modules/typescript/bin/tsc --noEmit`: **passed** after fixing test annotation and validated-input narrowing.
- `git diff --check`: **passed**.

The component harness does not validate browser layout or React scheduling itself. Full browser/build/native regression, combined evidence-resolver integration, strict release-evaluator tests and CI are deferred to the parent's serialized checks. No claim that those checks have passed is made here.

Worktree `campaign-release-claims`, branch `codex/local-mvp-readiness-20261022`, base `d503323aad1002f7325ba3a45faf4bee261686a9`. Prior branch `codex/final-reviewer-display-coherence` at `3d2ad3cc778318059a35b026e7fdac948cbf1bee` is preserved. No existing shared file, store, route policy, release evaluator, App/Dashboard, dependency, or host credential is edited. The parent authorized a local SSH-signed commit after review fixes. No push, PR, merge, pilot activation or human approval is created by this snapshot.
