# Operational release evidence: bounded technical completion, 2026-10-22

This candidate separates local observations, public CI acquisition and unavailable production authority. It does **not** establish production readiness, independent human approval, accepted operational trust roots, operator enrollment, Gate 7 completion or a release decision. The existing human/operator acceptance work remains deferred.

Baseline: `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`. The previous worktree branch at `ccd052595b6f0d05e8a36effc8b0cb8f1133ab0c` was preserved. No canonical WBS, bootstrap receipts, package files, existing verification logs, credentials, grants or trust-root artifacts are changed by this work.

## Scope and observed defects

The prior evaluator could report Gates 1, 2, 4 and 5 passed from stored lifecycle labels, evidence-reference presence, the Atlas project ID and entity counts. Capability `VERIFIED` labels contributed directly to a verification percentage. Gates 1 and 6 supplied catalog evidence IDs without acquiring evidence. The shared audit reader tolerated legacy short hashes and an empty ledger could appear sufficient. Local signoff action text or approval records could report a human release decision. The dormant ceremony writer contained static 25/25 capability, seven-gate and 100% planning claims.

The revised evaluator retains all seven gates and all 25 catalog entries. It binds an evaluation to an unambiguous current project, target release, scope ID/revision, commit, build, environment and exact task IDs. Missing, duplicate, malformed, drifted or unknown scoped data cannot contribute capability status or references. A catalog alias identifies the actual local source task; it grants no verification authority.

`OPERATIONAL_RELEASE_EVALUATION/1` reports:

- `evaluationScope`: `BOUND`, `UNAVAILABLE` or `INVALID`, with exact binding or a reason.
- `projectStateVersion`: the local server snapshot evaluated.
- Each gate's `localCheck`: `SATISFIED`, `FAILED`, `PENDING` or `NOT_APPLICABLE`, subject IDs and rationale. `SATISFIED` describes the stated local observation only. `NOT_APPLICABLE` means no gate subject was selected in the local task scope; it is **not** an accepted release-policy waiver. Its production gate remains pending.
- Primary gates: observed failures remain `FAILED`; missing authenticated production proof remains `PENDING`. No current acquisition path emits production `PASSED` or capability `VERIFIED`.
- Scoped `VERIFICATION`/`VERIFIED` lifecycle labels can appear only as local `IMPLEMENTED` observations with explicit provenance. Unavailable/out-of-scope capabilities remain visible and pending.
- Gate 6: complete SHA-256 hash fields, a local genesis and recomputed local links are required for a satisfactory byte check. An empty ledger remains pending. `auditChainIntegrity.valid` is a local consistency observation, not proof of origin, completeness, human identity or scope. The inherited `breaksCount` reports the first detected local validation failure, not an exhaustive failure count.
- `localSignoffObservations`: historical local audit/approval IDs, including imported records, with `humanAuthorization: false`. They cannot populate `signedOff` or signer details.

`ProductionEvidenceRequest` binds a gate/capability subject and task IDs to the complete release scope. `ProductionEvidenceProvider` currently has only the `UNAVAILABLE` result, with reason `TRUST_ROOTS_NOT_ACCEPTED` and `trustedProductionEvidence: false`. There is no success callback, imported archive promotion or caller-supplied production verifier. A future success variant requires a separately reviewed acquisition/verifier contract and accepted authority. The legacy `executeReleaseSignoff` now always refuses without changing lifecycle, evidence, approvals, planning values or audit records.

## Read-only public CI acquisition

`server/release/githubCiAcquisition.ts` exports:

```ts
acquireGitHubCiObservation({
  scope: ReleaseEvaluationScope,
  runId: number,
}): Promise<GitHubCiObservation>
```

The policy is server-owned code, with no caller-configurable repository, URL, token or trust declaration:

| Binding | Pinned value |
| --- | --- |
| Allowed project | `PRJ-DOCMONSTAKRAKIN` |
| Repository | `Jeruzael/docmonstakrakin` |
| Workflow | ID `372946294`, name `CI`, path `.github/workflows/ci.yml` |
| Required jobs | `Windows Native Qualification`, `Quality & Build`, `Controlled Docs`, `Complete Regression` |
| Network | HTTPS `api.github.com`; two fixed GET paths: run and exact-attempt jobs |
| Credentials | None; no token/environment lookup or authorization header |
| Bounds | 8 seconds total; 256 KiB per decoded response body; one page of at most 100 jobs; exactly the four pinned job names |
| Time policy | Run update and job completion within seven days; at most 60 seconds future clock skew; in-memory observation reusable for at most five minutes |

These numeric limits are candidate implementation bounds, not ratified operational capacity, availability or retention commitments. Expanded job sets require a policy review; they do not silently pass. Redirects, non-JSON bodies, HTTP errors, pagination, oversized/incomplete responses, deadline expiry and identity mismatches produce no successful observation. Repository/head repository, run ID, workflow ID/path/name, exact head commit, attempt, unique job IDs/names, completion times and all four success conclusions are checked. Failed exact-run conclusions remain failures even when the local work item says `VERIFIED`.

Only a frozen observation created by this module in the same process can be attached to an evaluator report. A `WeakSet` records object identity; serialization/import loses that identity. The evaluator rechecks every scope field and freshness before including an observation. Changing project, release, commit, build, environment, tasks, scope ID or scope revision fences it out. This is an application provenance guard, not a security boundary against compromised code in the same process.

The bounded follow-up adds `registerGitHubCiRoutes(app, store, requireHuman)` in `server/release/githubCiRoutes.ts`. The parent mounts it after its authenticated project READ policy and registers the new API path in its route inventory. The route takes scope only from current stored data with `evaluateReleaseScope`, acquires using a validated integer run ID, then evaluates the report with the original branded object. Ordinary projects cannot borrow the self project's CI. The route neither enrolls a provider, persists acquired claims nor executes CI.

### Read-only acquisition route and cache

`GET /api/projects/:id/release/ci?runId=<positive-safe-integer>` requires the parent's human-session resolver as well as the already applied project READ policy. The route additionally rejects an agent identity. Its single query parameter is the canonical integer run ID; duplicate/extra query parameters, URL/token/commit claims, aliases, and request bodies cannot select provider authority. GET uses the existing read/session policy; it does not introduce a CSRF-protected write or a release approval operation.

The response is `{observation, report, cache: {hit}}`, with `Cache-Control: no-store`. The report still has unavailable production evidence, false release readiness/signoff, and separately reported CI metadata. Statuses are explicit:

| HTTP | Meaning |
| --- | --- |
| 200 | A valid technical `OBSERVED_SUCCESS` or `FAILED` acquisition/cache result; not release success |
| 400 | Missing, invalid, duplicate or authority-selecting input |
| 401/403 | Session/project policy denial; unsupported non-self projects are also denied |
| 409 | Exact stored release scope changed while acquisition was awaited; result is discarded |
| 412 | Current release scope is missing, invalid or ambiguous |
| 422 | The provider response was acquired but rejected by the pinned metadata policy |
| 429 | Another acquisition is in flight or the acquisition-start gap has not elapsed |
| 503 | Acquisition is unavailable or an unexpected safe refusal occurred |

A process-wide budget permits one acquisition in flight and at least ten seconds between acquisition starts, including separate router registrations. Matching fresh cache hits perform no network acquisition. The private insertion-ordered cache contains only same-process branded observations, has a hard limit of 128 entries and a five-minute lifetime, and purges expired objects on access/insertion. These are candidate implementation constraints, not ratified service capacity. All acquisition dispositions remain technical observations; no caller/imported object enters the cache. No public reset or injected provider-success seam exists.

After the network await, the route re-evaluates every stored scope field and returns 409 before caching or reporting if the project/release/commit/build/environment/tasks/scope ID/revision changed or became unavailable. The returned `cachedObservation(projectId)` helper independently rebinds against the current scope and returns the most recently inserted matching fresh observation for normal release-gate reporting. Cache expiry/eviction means unavailable current observation, never inferred success. The cache concerns explicitly requested runs; it does not assert that a requested run is GitHub's newest run or provide a durable history/archive. Parent wiring can call `evaluateReleaseGates(store, id, {ciObservation: ciRoutes.cachedObservation(id)})` after its existing project-read authorization.

Neither the route, getter nor cache modifies projects, tasks, approvals, audit records, authority data, trust roots or credentials. The parent's actual authentication, project authorization, route inventory and server wiring remain separate integration responsibilities; this module does not establish human identity custody or independent release authorization.

The adapter uses the runtime's ordinary HTTPS/PKI validation and local clock. It does not pin a certificate, establish a new operational trust root, provide signed attestations or an independent trusted timestamp, inspect workflow contents/runner integrity, download logs/artifacts, verify individual test assertions, or prove requirement authorization. GitHub account/repository/workflow compromise and local runtime/clock compromise remain outside this observation's assurance. Build revision, environment, release and task list are explicit **local bindings**; GitHub's run metadata binds the reported jobs to the commit and attempt. CI metadata never supplies independent human approval, a secret sweep, production security evidence or Gate 7.

API references: [GitHub workflow run API](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run), [exact-attempt workflow job API](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt).

## Actual public observation

After fixture tests passed, an unauthenticated bounded read at `2026-10-22T05:56:23.533Z` returned `OBSERVED_SUCCESS` for [run 39721949800](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800), attempt 1, workflow ID `372946294`, head `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`. All four required job names had success conclusions:

| Job | GitHub job ID |
| --- | --- |
| Complete Regression | `119637197680` |
| Windows Native Qualification | `119637197780` |
| Quality & Build | `119637197789` |
| Controlled Docs | `119637197818` |

The adapter output is retained locally at `runtime/operational-release-evidence/public-ci-probe.json`. It is a point-in-time technical observation of the baseline commit, not proof that the present candidate ran CI, passed a new full regression, received approval or became release-ready. The probe's scope/build/environment names are deliberately local probe declarations. Both `trustedProductionEvidence` and `humanAuthorization` are false. The retained JSON cannot be reimported as a same-process observation.

## Verification and retained failures

The first operational regression run recorded 10 failures and 1 pass against the prior evaluator: status-only success, missing scope binding, out-of-scope references, invented evidence IDs, unauthenticated requirements, undifferentiated local chain validity, legacy short hashes, local signoff promotion and missing acquisition rationale. The first CI adapter run recorded 3 failures and 2 passes against an unavailable-only stub. A further red test showed that a fresh run-update timestamp could hide stale job execution timestamps; job completion freshness now rejects that case. These red outputs remain in the local `runtime/operational-release-evidence/` directory.

Legacy compatibility runs before updating their expectations recorded 6 obsolete failures in the 30-test release-gate script and 18 obsolete failures in the 21-test evidence-claims script. Those outputs are also retained locally. The updated assertions test the stricter scope/acquisition contract; historical checked-in evidence is unchanged.

Focused verification commands:

```text
node --import tsx server/release/testOperationalReleaseEvidence.ts
node --import tsx server/release/testGitHubCiAcquisition.ts
node --import tsx server/release/testReleaseGate.ts
node --import tsx server/release/testReleaseServerIntegration.ts
node --import tsx scripts/testReleaseEvidenceClaims.ts
node --import tsx scripts/testReleaseReportProjection.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

These cover 11 operational tests, 11 CI acquisition/integration tests (with mismatch mutations and a real eight-second deadline fixture), 30 release-gate checks, 5 isolated HTTP harness cases, 21 evidence-claims tests and 12 report-projection tests. The isolated HTTP harness is not a production-authentication test. Full regression, browser, native qualification, actual operator acceptance and release execution are not run by this bounded change; their previous baseline results are not relabeled as candidate results.

The read-only route follow-up adds `node --import tsx scripts/testGitHubCiRoutes.ts`. Its unavailable stub first produced **0 passed, 9 failed**; the implemented route passes all **9** HTTP cases. They exercise real Express, local HTTP and the real acquisition adapter with inert global-fetch transport fixtures, preserving the adapter's object branding. Cases cover authenticated reads without state mutation, anonymous/agent/project denial including cached reads, caller input refusal, scope availability/ambiguity, global single-flight, acquisition gaps versus cache hits, changes during await, cache expiry/rebinding, and honest failed/unavailable/rejected responses. The test identity and project authorization middleware are explicitly synthetic; this is not a real account enrollment, production authentication or independent human approval test. No GitHub network, authority store, credentials or audit writer are used by the route tests. The final pure route/evaluator/claims/projection subset passed 9/11/21/12 named cases, TypeScript exited 0, and diff checks exited 0. Original red output remains at `runtime/operational-release-evidence/ci-routes-red.log`.
