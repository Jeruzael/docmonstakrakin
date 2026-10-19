# AZ-08 requirement lifecycle correction candidate

## Outcome and boundary

**FIXED_IN_CANDIDATE / INDEPENDENT_HUMAN_REVIEW_REQUIRED.** Master baseline `bf5d617fa5bb76323714cc21cc20270acd826616`; branch `codex/security-az08-requirement-lifecycle`. The signed candidate HEAD, new PR, exact-HEAD CI and attributable review request are publication evidence on the new PR timeline. This report does not assert that the candidate is merged or human-approved.

The actual `POST /api/projects/:id/requirements/:reqId/status` handler assigned arbitrary caller values into `Requirement.status`, incremented project version and persisted a business audit event. The baseline test observed 200 and persisted `SYNTHETIC_INVALID_STATUS` when 422 was expected. The [captured reproduction](az08/baseline-reproduction.log) is actual execution evidence, not a hypothetical payload.

The invariant is exact domain membership and a permitted V1 source/destination transition before any requirement/project timestamp, version, audit or snapshot change. Direct APPROVED remains 403 and goes through existing authenticated human quorum. This endpoint remains explicitly `LEGACY_LOCAL_UNSCOPED`: legitimate existing operations can remain anonymously reachable; no full authentication, membership or tenant isolation claim follows.

## Narrow implementation and compatibility

[server/requirementLifecycle.ts](../../server/requirementLifecycle.ts) defines policy version 1 with exhaustive keys for the actual six-value `RequirementStatus` type. Canonical type additions require a policy review/build change. Snapshot schema 1 is already enforced by existing persistence loading; future/invalid snapshot schemas are not silently reinterpreted.

The parser requires an object, an exact string status and optional string justification. It neither trims nor changes case. Unknown strings, arrays/objects/numbers/booleans/null, prototype property names, whitespace/case variants and absent status fail 422. This route's JSON syntax/strict-body parse failures return 400; other routes' error contracts are unchanged. Exact APPROVED retains 403 before lookup, including escaped JSON representations.

Current project/unique nested requirement lookup retains 404 and duplicate-ID 409. An unknown persisted lifecycle or invalid/nonincrementable aggregate version fails 409 with no automatic repair. An optional `expectedStateVersion` must be a nonnegative safe integer and equal the current aggregate version; stale values fail 409. Omission remains compatible with existing UI callers and does not provide full stale-client concurrency protection. Existing snapshot digest/lock protection is unchanged.

### Explicit V1 transition table

| Current status | Permitted direct destinations |
| --- | --- |
| PROPOSED | UNDER_REVIEW, REJECTED, DEFERRED, VERIFIED |
| UNDER_REVIEW | REJECTED, DEFERRED, VERIFIED |
| APPROVED | UNDER_REVIEW, REJECTED, DEFERRED, VERIFIED |
| REJECTED | UNDER_REVIEW, DEFERRED, VERIFIED |
| DEFERRED | UNDER_REVIEW, REJECTED, VERIFIED |
| VERIFIED | UNDER_REVIEW, REJECTED, DEFERRED |

APPROVED as a direct destination always 403. Same-state requests and resets to PROPOSED are invalid transitions 409. PROPOSED remains the creation/import state. These two restrictions are explicit new conservative tactical choices requiring review, not a claim that a ratified transition matrix already existed.

Repository evidence: `src/types.ts` includes VERIFIED; `src/data/selfBootstrapContract.ts` permits it; the actual-server `testRequirementStatusSync.ts` requires DEFERRED→VERIFIED and restart persistence. The register's short taxonomy omits VERIFIED, an unresolved documentation inconsistency preserved for governance review. No established full requirement transition matrix was found. Existing UI offers UNDER_REVIEW/DEFERRED/REJECTED from any unequal source, including APPROVED; these remain supported. VERIFIED compatibility is retained without inventing an evidence/quorum requirement absent from this route.

VERIFIED is not APPROVED: release Gate 2 requires exact APPROVED. Existing human signoff code alone assigns APPROVED after quorum/digest checks, and later target evolution makes prior approvals stale. This correction does not redefine immutable approval history or freeze all approved-source UI actions. Proposal creation and package import continue producing PROPOSED; bootstrap retains its separate evidence-integrity checks. WorkItem lifecycle policy is a different contract and is unchanged.

Success still uses the existing transactional persistence wrapper: exactly one version increment and business audit event; audit details add nonsecret `lifecyclePolicyVersion:1`. Actor `Stakeholder` remains an unauthenticated audit label. No schema migration, automatic recovery, account/grant, live state or authorization service was introduced.

## Verification and negative evidence

All execution used disposable state/clones with synthetic credentials. The app was not run against operator state.

| Ordered check | Actual result |
| --- | --- |
| Baseline actual-route reproduction | Expected rejection assertion failed: observed 200/persisted unknown status; this is the reproduced vulnerability |
| Focused actual-route candidate suite | 105/105 cases passed; [captured output](az08/candidate-focused.log) |
| Syntax/type validation | `npm run lint` PASS |
| Existing actual-server synchronization | `npm run test:req-sync` 18/18 PASS |
| Required package checks | `npm run wbs:check` zero drift; `npm run build` PASS, existing large-chunk advisory only |
| Complete regression | `npm run test:complete` 66/66 suites, 1,636/1,636 observed named check outputs, 0 failed/0 skipped; `2026-10-19T04:23:25.018Z` |
| Included security/governance suites | Actual perimeter 51, Vite 11, security regression 34, security integration 7, existing requirement/signoff/quorum/persistence tests all PASS |
| Standalone controlled-document check | 40/40 core, 29/29 additional, 11/11 focused PASS; synthetic snapshot mutation NONE |
| Standalone security integration | 7/7 PASS; complements actual main-route tests, not a substitute for them |
| Diff hygiene | `git diff --check` PASS |
| Independent agent review | Fresh read-only investigator and one fresh candidate reviewer; reviewer independently ran 105/105, found no concrete bypass/regression; not human approval |

The first focused run also exposed the old generic 500 on strict JSON parsing. The test now expects a meaningful 400 for strict-parser failures and 422 for syntactically valid malformed field/container bodies; the endpoint-specific parser-error handling satisfies those assertions. Type checking exposed boolean-union narrowing under this project's compiler settings; explicit `ok === false` checks resolved it. Neither issue was hidden by weakening the domain/no-write assertions.

The 105 cases exercise all 36 canonical pairs, invalid strings/case/whitespace/missing/wrong types, protected/escaped/duplicate-key values, invalid justification, malformed/stale expected version, invalid persisted source/version, duplicate/missing targets, case/trailing aliases, unsupported GET/HEAD/PUT/PATCH/DELETE, encoded separator, foreign Origin and legitimate accepted aliases. Every rejected case compares actual project(s), requirements, audit, disk bytes and transaction-directory contents before/after. Accepted transitions increment version/audit once, preserve historical audit and survive restart; rejection on a fresh server creates no snapshot.

The original trigger now returns 422 without writes; normal UNDER_REVIEW/DEFERRED/VERIFIED flows remain accepted. Hash-bound retained logs and local complete-results digest are recorded in the [evidence manifest](az08/evidence-manifest.json). Exact-HEAD remote CI is separately recorded after publication; local test time predates the documentation freeze.

## Risk, recovery and review decision

Residual risks: 45 legacy registrations remain unscoped, supplied actor labels are not identity, package/project authorization gaps persist, and optional version omission permits stale clients to request otherwise valid transitions. Existing APPROVED-source rework and VERIFIED semantics remain broad compatibility behavior. These are not claims of full security closure.

Unknown persisted statuses now block this operation; no data is rewritten. Recovery requires a separately reviewed exact repair, never accepting the corrupted status as a new domain value. Old clients sending lowercase/whitespace, repeated same state, reset-to-PROPOSED or non-string justification must handle the explicit errors. Invalid requests create no business audit event; this is not a new security telemetry system.

Deploy/merge requires independent human review of the exact signed HEAD and new V1 rules, successful three-job CI and a human merge decision. No merge is automatic. Build/restart would be required only after such a decision; no runtime deployment occurred. Prefer a forward correction or temporarily disable this endpoint if problems arise. A rollback must not restore acceptance of arbitrary statuses or weaken human quorum.

The same candidate includes [PR #47 closure evidence](PR47_POST_MERGE_CLOSURE.md), [PR #34 dependency assessment](../06_planning/SECURITY_SPRINT2_GOVERNANCE_DECISIONS.md) and the [S2-A decision package](../06_planning/SECURITY_S2A_IMPLEMENTATION_DECISION.md). These documents do not implement S2-A, alter canonical WBS/trust, migrate credentials, activate HTTPS, re-enable 14 privileged registrations, authorize live agents, execute Gate 7 or promote release.
