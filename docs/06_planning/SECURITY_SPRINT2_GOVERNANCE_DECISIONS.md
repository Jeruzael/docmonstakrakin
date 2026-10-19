# Security Sprint 2 governance dependency decision

## Status and authority

**DECISION_REQUIRED — no canonical WBS mutation or exception applied.** Operator authorization covers AZ-08 as a bounded tactical security candidate and this decision package. It selects central principal/action/resource authorization as the design direction, while explicitly withholding S2-A implementation. A GitHub proposal approval, merged design document, technical test or signed commit does not manufacture a governance authorization receipt.

Baseline: master `bf5d617fa5bb76323714cc21cc20270acd826616`, after PR #47. Existing [six-slice proposal](../04_security/security-authorization-sprint2/implementation/central-policy.md) is historical proposal text; its “not selected” wording described its publication checkpoint and is superseded only for the operator's Option 2 direction selection.

## Reinspection of PR #34

[PR #34](https://github.com/Jeruzael/docmonstakrakin/pull/34) remains OPEN and UNMERGED, feature HEAD `5912185a005df3e0469dd46392d7d0dbb0378b68`, base/merge-base `84dabf513354ad469e3ae3fdb3a95bfd111badbe`. Git records 54 master-only commits and 3 candidate-only commits; 90 paths changed on master since that fork. Its actual candidate changes only canonical YAML and generated Markdown. Do not refresh or merge this branch automatically.

The candidate appends DMK-209–214 as PROPOSED. None is present in current master. Current WBS YAML SHA-256 remains `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`; generated Markdown remains `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f`. Candidate YAML digest is `e166f4679a71e8cec45ec5e0c5dc60f0b12c8ade0ada4696339662e258132273`.

### Fresh compatibility experiment

In a disposable clone of current master with synthetic CI state, copy only PR #34's two exact WBS blobs, leaving all current verifiers/historical evidence untouched:

| Command | Observed result |
| --- | --- |
| `npm run wbs:check` | PASS, zero rendering drift |
| `npm run verify:dmk-208-status-audit` | FAIL: scoped count 33, expected 27 |
| `npm run verify:dmk-197-closure` | FAIL: candidate WBS digest differs from historical post-closure digest 53050b92… |
| `npm run verify:dmk-196-closure` | FAIL: candidate WBS digest differs from historical post-apply digest c4bf5011… |

These are expected incompatibility observations, not failures in the AZ-08 candidate. Current master has forward-registration/trust tooling absent from PR #34's old baseline, but the two-file candidate supplies no approved forward-state receipt and does not satisfy historical validation. Historical receipts must remain immutable; do not edit them to match new WBS bytes. Registration readiness still requires an independently reviewed forward-state transaction/receipt, historical-snapshot-aware verification, missing/tampered/stale receipt negative tests, applicable current trust/ratification prerequisites, complete CI and a separate human merge decision. Existing preliminary Stage B2b2 trust policy is not ratified by this document.

## Proposed ownership and dependency mapping

These are proposed scopes, not assignments, accepted work packages or new canonical statuses.

| Slice | Proposed ownership | Exact prerequisite consequences |
| --- | --- | --- |
| S2-A identity/session/default-deny primitives and synthetic pilot | DMK-210 architecture + DMK-211 identity; coordinate DMK-198 provisioning UX | DMK-211 currently proposed to depend on DMK-209 + DMK-210. Both must exist and have satisfied acceptance or an explicitly approved bounded preparatory exception must name exactly what is deferred |
| S2-B workspace discovery/membership | DMK-212 | Proposed DMK-212 depends on DMK-210 + DMK-211; S2-A acceptance, approved owner mapping and canonical resource resolver also required |
| S2-C packages/documents/context/evidence access | DMK-212 implementation + DMK-209 route protection | S2-B, fresh destination/source-ACL contracts and mixed-plane human mapping; DMK-206 retains evidence adjudication, not replaced by access control |
| S2-D remaining routes/reviewer scope | DMK-209 + DMK-212 | S2-B/C and full route/capability matrix; preserve DMK-197 quorum, DMK-198 provisioning and DMK-208 canonical lifecycle ownership; AZ-08 is only a tactical domain correction |
| S2-E individually authorized secrets/Git operations | DMK-209 with DMK-212 grants | S2-D plus fresh operation-specific human authorization, reauthentication and owned-root/sandbox/SecretStore prerequisites; no mass re-enablement |
| S2-F distinct agent delegation | DMK-213, integrated verification DMK-214 | Proposed DMK-213 depends on DMK-212; proposed DMK-214 depends on DMK-209 + DMK-211 + DMK-212 + DMK-213. Agent Center durable lifecycle, consent, egress and execution readiness are additional separate prerequisites |

Actual proposed PR #34 dependency edges: DMK-209 none; DMK-210 none; DMK-211 → DMK-209/210; DMK-212 → DMK-210/211; DMK-213 → DMK-212; DMK-214 → DMK-209/211/212/213. Six slice labels are not six new DMK IDs and are not one-to-one canonical task completion.

Existing canonical ownership remains: DMK-197 VERIFICATION_PENDING (depends on DMK-196); DMK-198 IN_PROGRESS (depends on DMK-197); DMK-206 BACKLOG (depends on DMK-197/198/208); DMK-208 VERIFIED (depends on DMK-205). No transition is made here. DMK-208 VERIFIED is technical evidence, not automatic approval of later requirement or authentication policies.

## Dependency mismatch requiring a human decision

DMK-209 acceptance requires denial of unauthenticated project mutations, exports and privileged actions plus a complete route policy inventory. Sprint 1 satisfies partial network containment/inventory and disables 14 privileged registrations; 45 legacy registrations remain unscoped. Therefore PR #46 does not complete DMK-209. Yet proposed DMK-211 depends on DMK-209, while implementing DMK-209's full route authorization requires identity/policy capabilities developed in DMK-211/212. This is a practical sequencing cycle despite the proposed YAML graph itself being acyclic.

Recommend a separate governance change that distinguishes perimeter foundations from final route cutover: retain complete DMK-209 acceptance, identify the bounded foundations needed by DMK-211, and make final route cutover depend on accepted identity/membership. Do not simply mark DMK-209 VERIFIED or remove its security acceptance. Exact revised items/edges, owners, evidence and historical-verifier strategy require review before registration.

Alternative: an explicit preparatory exception for a synthetic, disabled-by-default S2-A pilot may name the unmet DMK-209 criteria, time/scope boundary, owner, acceptance, safe rollback and prohibition on activation. It would not complete DMK-209/211, register missing tasks or authorize existing-route cutover. **No such exception has been granted.**

## Required next human action

Resolve ownership/dependency registration or grant a narrowly specified preparatory exception through the actual governed process, then separately authorize the exact [S2-A decision package](SECURITY_S2A_IMPLEMENTATION_DECISION.md). Keep PR #34 unmerged, canonical WBS/history unchanged and live reconciliation blocked until their own approved transaction. AZ-08 human review/merge is a separate decision and cannot satisfy these gates.
