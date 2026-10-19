# Security Hardening Review: DOCMONSTAKRAKIN authorization Sprint 2

## Evidence Basis

We independently verified PR #46's final-head human review, merge and post-merge CI, then re-extracted all 69 actual API registrations at `f35fa7bcd9fb00942c1bba76741a22a5cc7c80b8`. The [gap register](route-authorization-gaps.md) and [15-case actual-server characterization](evidence/characterization.log) distinguish source facts from demonstrated behavior and future tests. Passing these observations means gaps were reproduced, not fixed.

The [evidence inventory](evidence-manifest.json), SHA-256 `1962ac92e9722d39185daecd99ad565b08c319bb38de8b27024bc517bb998864`, records 16 Git-source, captured CI-log and probe items. [Context and scope](context.md) records additional GitHub and existing-design references. No canonical security scan, production receipt or remediation completion is claimed.

## Constraints

This is a documentation/planning candidate. We retain loopback-only containment, 14 privileged denials, specialized HUMAN checks, Security Officer/Lead Architect quorum, immutable evidence, canonical WBS and release/Gate 7 separation. PR #34 and operator state are not modified. Full authentication and Agent Center live operation remain unimplemented/blocked.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Establish one principal/action/resource authority boundary | Anonymous project access, package overwrite and actor-provenance observations; reviewer/persistence source review | Option 1 route-local guards; Option 2 central policy; Option 3 isolated authority/state broker | Option 2 under current single-process local constraints | [Authenticated project and resource authority](proposals/project-authorization.md) |

We should address the shared missing authority boundary rather than manufacture a separate new system for each route. The strongest alternative is process isolation when a real multiuser or untrusted-extension boundary becomes necessary. Both alternatives deserve review; no option is selected by this portfolio.

## Recommendation Summary

I recommend a central in-process policy service with local resource enforcement and a coordinated permission/persistence commit boundary. It keeps the current application manageable while making selected-project entitlement, package destination and server-attributed identity explicit. The [implementation proposal](implementation/central-policy.md) splits identity/session primitives, membership, packages/sensitive data, remaining routes, privileged capabilities and machine delegation into separate gated slices.

We must preserve a visible partial status during rollout: a login endpoint does not protect the remaining legacy routes. The requirement-status allowlist gap also needs a direct domain repair, not an authorization label. The proposal is grounded in [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), while the actual contracts and tradeoffs are recommendations for this codebase.

## Next Decisions

Review the draft closure/design PR, select or revise the option, resolve existing WBS ownership/dependency gates, and approve the private-store/KDF and browser transport boundary. The recommended first implementation candidate is **S2-A: identity, session and default-deny primitives with an actual-server authentication pilot**. Its exact scope needs separate authorization; credentials migration, project grants, privileged activation, WBS registration/reconciliation, Gate 7 and release do not follow from design approval.
