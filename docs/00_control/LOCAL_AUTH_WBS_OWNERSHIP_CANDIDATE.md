# Local Authentication and Role Delegation — Proposed Canonical WBS Ownership

**Document class:** Candidate, non-authoritative, read-only registration analysis  
**Source tracking:** [GitHub issue #31](https://github.com/Jeruzael/docmonstakrakin/issues/31) and [merged planning PR #32](https://github.com/Jeruzael/docmonstakrakin/pull/32)  
**Baseline:** `master` @ `eb45e9258abc76f0b927214a62050223d1d6c2e6`  
**Disposition:** `CANDIDATE_PREPARED / PENDING_WBS_OWNERSHIP_REVIEW`

This document proposes candidate ownership and traceability; it **does not** allocate permanent IDs, authorize implementation, edit the canonical WBS, bind governance approvals, mutate operational runtime, execute live reconciliation, or advance Gate 7 or release status. Operator approval of S1/S2/S3 design direction is not a substitute for future exact-scope registration authorization or credentialed sign-off.

## Confirmed repository constraints

- The authoritative self-project work-item register is `docs/00_control/MASTER_WBS.yaml`; `MASTER_WBS.md` is a generated projection. The runtime Work Management board reads canonical WBS but is not allowed to overwrite it.
- Baseline inspection found candidate IDs **DMK-209..DMK-214** and paths **13.06.22..13.06.27** unoccupied. These are proposed, **not reserved**, and must be rechecked immediately before registration.
- `DMK-197` remains `VERIFICATION_PENDING` and owns the Approval Inbox/quorum feature. `DMK-198` remains `IN_PROGRESS` and owns reviewer provisioning. `DMK-206` remains `BACKLOG` and owns WorkItem evidence + independent human sign-off. `DMK-208` is the existing canonical lifecycle owner.
- The scoped EPIC-13 WBS currently contains **27** items. Adding the six proposed scoped items would increase the prospective total to **33**, provided no other scoped items are added.
- Historical verifier compatibility blocks a direct WBS append today. `scripts/verifyDmk208StatusAudit.ts` enforces `EXPECTED_SCOPE_COUNT = 27` and historical candidate bindings. `scripts/verifyDmk197Closure.ts`, `scripts/verifyDmk196Closure.ts`, and `scripts/verifyDmk196PostMergeCandidate.ts` depend on exact historical WBS digests/chains. Any new WBS bytes require a governed forward-state-compatible verification contract; do not modify historical receipts or silently loosen validators.
- Existing reconciliation logic has special historical item and provenance constraints. A new WBS item must **not** trigger live runtime creation or synchronization merely by appearing in a PR.

## Proposed collision-free ownership (not approved IDs)

| Planning package | Proposed DMK ID | Proposed WBS path | Proposed title | Priority / risk | Status | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-WP-00 | DMK-209 | 13.06.22 | Local API Security Perimeter and Route Authorization | P0 / CRITICAL | PROPOSED | none |
| AUTH-WP-01 | DMK-210 | 13.06.23 | Local Identity, Authorization and Governance Policy Architecture | P1 / HIGH | PROPOSED | none |
| AUTH-WP-02 | DMK-211 | 13.06.24 | Persistent Local Human Authentication and Session Security | P1 / HIGH | PROPOSED | DMK-209, DMK-210 |
| AUTH-WP-03 | DMK-212 | 13.06.25 | Configurable Project-Scoped RBAC and Custom Role Restrictions | P1 / CRITICAL | PROPOSED | DMK-210, DMK-211 |
| AUTH-WP-06 | DMK-213 | 13.06.26 | Distinct AI Agent Identity and Scoped Delegation | P1 / CRITICAL | PROPOSED | DMK-212 |
| AUTH-WP-07 | DMK-214 | 13.06.27 | Authentication Migration and Cross-Workstream Security Verification | P1 / HIGH | PROPOSED | DMK-209, DMK-211, DMK-212, DMK-213 |
| AUTH-WP-04 | **DMK-198 (existing)** | 13.06.12 | Reviewer provisioning and usability | existing | IN_PROGRESS | Existing dependency on DMK-197 retained |
| AUTH-WP-05 | **DMK-206 (existing)** | 13.06.19 | Evidence-bound WorkItem approvals and sign-off | existing | BACKLOG | Existing dependencies on DMK-197/198/208 retained |

**Ownership rules:** DMK-212 owns authorization policy and *custom role/capability/restriction configuration*; DMK-198 retains reviewer onboarding and reviewer-specific UX. DMK-206 retains general WorkItem evidence sessions and independent human adjudication; DMK-197 retains its current Approval Inbox/quorum feature. Avoid introducing a `DMK-197 -> DMK-206 -> DMK-198 -> DMK-197` or equivalent cycle. Any changes to existing items must be separately enumerated and approved.

## WBS candidate acceptance boundaries

### DMK-209 — API perimeter (P0)
- Default development/server bind to `127.0.0.1`; network mode requires explicitly configured secure deployment.
- Produce a complete registered API-route inventory with required actor, action, resource, scope and access policy.
- Enforce authentication + authorization for sensitive secret management, repository mutation, exports, administrative operations, and relevant project state mutations; close uncovered paths.
- Add negative tests proving unauthenticated and wrong-scope/role callers cannot perform privileged actions, including through alternate routes.
- Do not disable existing protections, leak tokens/secrets or add mandatory external identity providers.

### DMK-210 — Architecture and approval policy
- Formalize technical `VERIFIED` versus human-governance approval as distinct dimensions, with protected operations blocked until requisite governance is satisfied.
- Specify local-first identity architecture, bootstrap/recovery and review authority.
- Define the role/permission registry, separation of duties, permission revocation and protected nondelegable controls.
- Provide threat model, ADR candidates and migration boundaries without treating proposed risk-tier quorum as already ratified.

### DMK-211 — Human identity and sessions
- Introduce persistent unique human principals, secure password verifier storage, protected session cookies, expiration/revocation and safe recovery.
- Never persist raw passwords or sessions in repository or logs; use appropriate existing SecretStore integration.
- Provide tests for invalid sign-in, replay, session revocation, restart behavior, credential rotation and unauthorized role assertions.
- Preserve existing reviewer sign-in during explicitly designed migration.

### DMK-212 — Scoped RBAC and custom roles
- Support built-in and custom roles with `roleId`, name, description, principal type, project/resource scope, configured `allowedCapabilities[]`, configurable `restrictions[]`, version and audit provenance.
- Only server-registered capabilities are grantable; deny-by-default and explicit-deny precedence are mandatory.
- Custom configurations cannot bypass human-only governance, separation of duties, Gate 7, release policy, scope isolation or self-approval bans.
- Include role management authorization, revocation tests and UI/UX ownership boundary with DMK-198.

### DMK-213 — Agent identities and delegation
- Agent principals are not human principals; persona/agent descriptions are not authority.
- Delegations are bounded by delegator authority and cannot include protected human approvals; scope, expiration, revocation and audit provenance are required.
- Test identity forgery, agent privilege escalation, stale delegation, revoked rights, injected authority and cross-project access.
- Distributed peer Ed25519/federation remains subject to separately ratified ADR-0006 work; avoid automatic expansion into this local MVP.

### DMK-214 — Migration and independent security verification
- Verify all approved security and compatibility controls, local account/reviewer migration, crash/restart recovery and preserved audit evidence.
- Require Quality & Build, Controlled Docs and Complete Regression CI and human security/architecture review before each protected merge.
- Preserve historical canonical receipts, status, release and Gate 7; ensure operational reconciliation is still separately authorized.

## Blocking compatibility and verification tasks BEFORE canonical WBS registration

1. **Verifier matrix:** Enumerate every historical script/test that assumes fixed WBS raw hash, scoped count, exact item set, or immutable current state. At minimum include:
   - `scripts/verifyDmk208StatusAudit.ts` (27-item scope and historical candidate)
   - `scripts/verifyDmk197Closure.ts` (current WBS digest and DMK-197 status)
   - `scripts/verifyDmk196Closure.ts` (WBS historical receipt chain)
   - `scripts/verifyDmk196PostMergeCandidate.ts` (WBS historical receipt chain)
   - WBS/runtime reconciliation, WBS render/check and their regression tests.
2. **Forward-state proof:** Design an authorization-bound WBS registration receipt that connects exact pre/post WBS digests, exact added items, identity/decision authority and versioned policy. Historical verifiers must continue validating their *historical evidence*, while forward verification must independently validate the new canonical WBS through explicit receipt checks. No unconditional `VERIFIED` or new-item allowances.
3. **Negative cases:** Missing/replayed/forged receipts, changed canonical bytes, changed scope count without authorization, duplicate IDs/paths, unrelated item mutations and broken prior chain must fail closed.
4. **Sequential gates:**
   - Gate A: human review of this ownership and dependency candidate (now).
   - Gate B: separately authorized verifier/reconciliation compatibility remediation, with CI-green PR.
   - Gate C: refreshed, exact canonical WBS registration candidate and human approval.
   - Gate D: governed WBS YAML/MD registration PR with forward receipt checks and CI-green merge.
   - Gate E: local pull and read-only runtime reconciliation preview, followed by *separate exact-candidate approval* before any live runtime apply.
5. **No historical edits:** Keep DMK-197 technical/governance state unchanged, preserve prior approval chronology and noncompliance findings, and never fabricate missing approvals.

## Review checklist

- [ ] Confirm proposed six new IDs and WBS paths remain unoccupied at registration time.
- [ ] Approve precise ownership split across new tasks and DMK-198/206/208.
- [ ] Confirm no circular dependencies or unapproved expansion of existing items.
- [ ] Define and approve exact registration permission, receipt and verifier compatibility requirements.
- [ ] Confirm sequencing for immediate P0 API perimeter protection without hidden app-network exposure.
- [ ] Authorize later canonical WBS mutation separately from this candidate review.

**Review disposition:** `PENDING_HUMAN_WBS_OWNERSHIP_DECISION`. No code execution, WBS mutation, receipt generation, release change or live reconciliation is authorized by the creation or merge of this planning file.
