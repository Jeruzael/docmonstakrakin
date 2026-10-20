# PR #48 final merge-readiness assessment

## Recommendation

**RECOMMEND MERGE of the bounded AZ-08 correction, after separate explicit operator authorization and a fresh exact-HEAD/check/protection check. MERGE NOT AUTHORIZED in this preparation instruction.**

I inspected the actual diff, current UI callers, quorum invalidation, canonical status type and release checks, and reran the actual-server security suite from a detached checkout of the reviewed commit. I found no new blocking defect within AZ-08's domain-validation boundary. We must retain the documented authorization gaps as remaining work.

## Independently verified GitHub state

| Evidence | Verified value |
| --- | --- |
| PR | [#48](https://github.com/Jeruzael/docmonstakrakin/pull/48), OPEN, UNMERGED, auto_merge null |
| Exact HEAD | `e33f5ea7869db34654c831550c91029e2236b789` |
| Master/base | `bf5d617fa5bb76323714cc21cc20270acd826616` |
| Actual approval | [5567032372](https://github.com/Jeruzael/docmonstakrakin/pull/48#pullrequestreview-5567032372), `jianzhihuoxin`, APPROVED, `2026-10-19T04:43:25Z`, commit_id matches exact HEAD |
| Approval scope | Reviewer recommends authorization of implementation; this is an actual PR approval, not operator merge permission, S2-A implementation permission or WBS authority |
| Review threads | Empty; no unresolved review thread returned |
| Mergeability | GitHub reports mergeable=true, mergeable_state=clean; this is not permission to bypass policy |
| CI | [39199644427](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39199644427), exact workflow HEAD, completed/success |
| Controlled Docs | Job 117889760596, SUCCESS |
| Complete Regression | Job 117889760763, SUCCESS |
| Quality & Build | Job 117889760822, SUCCESS |
| Regression evidence | Previously independently fetched exact-job log reports 66/66 suites, 1,636 observed outputs, 0 failures/skips; log digest `6879af45983e23fadf571d4640f12b1d736cfdba4d263d31a48e36398b567a1f` |
| Fresh local execution | 105/105 actual-route cases passed from immutable reviewed HEAD; source unchanged |
| Protection visibility | Previously reported protected master; detailed protection API denied 403. Recheck ordinary GitHub merge eligibility at authorization time; do not infer historical or current bypass rights |

The [source collection manifest](context.md) binds the captured API snapshot, actual local output and existing CI evidence. No new approval/request timestamp is invented. The earlier request at 04:28:40Z, the actual approval at 04:43:25Z and any later merge are distinct events.

## Approved-source rework and VERIFIED semantics

The tactical matrix preserves APPROVED→UNDER_REVIEW/REJECTED/DEFERRED/VERIFIED. These were compatible with the UI's existing rework controls and direct VERIFIED behavior; approval does not freeze the current mutable requirement object. Existing quorum evaluation binds an approved target digest and later reports that approval stale when the target changes. The historic signature/decision record is retained.

VERIFIED remains a supported runtime/bootstrap status, including the existing DEFERRED→VERIFIED synchronization/restart test. It does not substitute for APPROVED: the release requirement gate checks exact APPROVED. The short requirements-register taxonomy omits VERIFIED; that inconsistency remains a separate governance/documentation issue. This PR does not establish evidence adjudication for VERIFIED or a new requirement approval lifecycle.

Same-state requests and direct reset to PROPOSED now fail 409. Exact direct APPROVED still fails 403 and uses human quorum. Case/whitespace/unknown values and malformed types fail instead of being normalized. These are review-visible compatibility changes, especially for old automation that repeatedly sets the current value or sends non-string justification.

## Optional expectedStateVersion and remaining risks

If supplied, expectedStateVersion must be a nonnegative safe integer equal to the current aggregate version; stale requests fail 409 without writes. Omission remains accepted by existing UI clients. Therefore the fix does not eliminate all stale-client updates or provide a mandatory optimistic-concurrency contract. Existing on-disk digest/lock and transaction rollback remain independent protections.

**The ordinary status endpoint remains unauthenticated and unscoped (`LEGACY_LOCAL_UNSCOPED`).** A local caller can still make a valid permitted transition, including approved-source rework. Actor `Stakeholder` is not authenticated identity. AZ-08 establishes domain/transition validation, not complete requirement authorization, project membership, tenant isolation or immutable approval workflows.

Unknown persisted lifecycle/version now blocks this operation; recovery requires a separate reviewed repair. Do not silently rewrite old data. All 14 privileged registrations, specialized human quorum, agent dispatch, Gate 7 and release boundaries remain unchanged.

## Conditional post-merge closure plan — not executed

Once the operator explicitly authorizes merging this exact HEAD, re-fetch master/head/reviews/CI and unresolved feedback. Halt on changed reviewed HEAD, material requirements/base drift or failed CI; obtain renewed review. Recheck applicable GitHub policy and use the ordinary merge API with expected HEAD and no administrative bypass/force push. If GitHub refuses, stop and report its reason.

After an actual merge, fetch the resulting master commit, parents/tree and exact push workflow. Independently inspect all three jobs and actual regression totals; compare canonical WBS, historical receipts and protected runtime boundaries. Add a new checkpoint identifying merge actor/time/SHA, workflow/jobs, log digests and remaining gates. Never edit this pre-merge record into a retrospective approval or create a post-merge receipt before the event. If post-merge CI fails, stop at the discrepancy rather than proceeding with S2-A.

## Exact next human decision

Authorize or decline the ordinary merge of PR #48 at `e33f5ea7869db34654c831550c91029e2236b789`. That authorization would cover the merge and conditional verification only. The [governance proposal](GOVERNANCE_RESOLUTION.md) and [S2-A implementation boundary](implementation/central-policy.md) require their own decisions.
