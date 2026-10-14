# Local Authentication & Role Delegation — Tracking Candidate

**Classification:** Planning-only / proposed canonical WBS registration  
**Decision source:** Operator approval in DOCMONSTAKRAKIN planning discussion, 2026-10-15 (Asia/Manila)  
**Tracking issue:** [#31](https://github.com/Jeruzael/docmonstakrakin/issues/31)  
**GitHub master baseline:** `1c0e526dd16858d1e0052c0ab1010a90e93a0ce5`  
**Disposition:** `TRACKING_PROPOSAL / PENDING_WBS_REVIEW`

> This document does **not** assign permanent DMK IDs, apply a canonical WBS transition, record credentialed human governance quorum, authorize feature implementation, or permit live reconciliation, Gate 7 execution, or release promotion.

## Approved design directions

1. **S1 — Identity and governance:** Local-first authentication, without mandatory cloud identity; role-based access control with project/resource scope; strict human-versus-agent identity separation; and independently verifiable approval receipts. Technical verification (`VERIFIED`) and human governance remain separate dimensions. Protected operations require satisfaction of their approved governance policies.
2. **S2 — API perimeter:** Bind local development to `127.0.0.1` by default; require an explicitly configured secure deployment mode for network access. Inventory every route, assign explicit authentication and authorization policies, and test that unauthorized access is rejected. Prioritize secret management, repository mutation, export and administrative routes.
3. **S3 — Roles and customizable policy:** Built-in roles are Workspace Owner, Project Admin, Developer, Reviewer, Security Officer, Lead Architect and Auditor; AI Agent is a separate actor type. Provide administrator-configurable custom roles, capabilities and restrictions, within a mandatory non-bypassable policy envelope.

These are operator-approved design directions, **not** evidence of independent dual-role human sign-off. Existing canonical policy and lifecycle records take precedence until amended through governed review.

## Custom role contract candidate

Custom roles have: `roleId`, `name`, `description`, `principalType` (`HUMAN` or `AGENT`), `scope` (workspace/project/resource), `allowedCapabilities[]`, `restrictions[]`, `version`, `createdBy`, `updatedBy`, and audit provenance. Capabilities are selected from a validated server-owned registry rather than arbitrary endpoints or command strings.

Permission decisions require authenticated principal, action, resource, scope, policy version and context. Evaluation is deny-by-default and explicit-deny-first. Custom roles cannot grant an agent human sign-off authority, relax separation-of-duties constraints, create self-approval, or bypass release and Gate 7 ceremonies. Role modification and delegation require governed authorization; security-critical role grants cannot be self-ratified.

**Example:** A human QA Reviewer can view assigned project evidence and adjudicate eligible evidence but cannot approve their own submission, modify security controls, read secrets or approve releases. The exact reviewer policy, including role quorum by risk, remains subject to the separate governance decision.

## Proposed work packages (temporary planning keys; not canonical IDs)

| Planning key | Scope | Priority | Proposed status | Owner boundary |
| --- | --- | --- | --- | --- |
| AUTH-WP-00 | API route inventory, loopback default, privileged-route auth, denial tests | P0 | PROPOSED | New security perimeter owner |
| AUTH-WP-01 | Identity, authorization and governance architecture/ADR; threat model | P1 | PROPOSED | New auth architecture owner |
| AUTH-WP-02 | Persistent local human accounts, session security, revocation, bootstrap/recovery | P1 | PROPOSED | New local authentication owner |
| AUTH-WP-03 | Project/resource-scoped RBAC, custom capabilities, explicit restrictions and policy engine | P1 | PROPOSED | New authorization owner |
| AUTH-WP-04 | Reviewer provisioning and custom-role management UI | P1 | PROPOSED | Align with DMK-198, avoid duplicate WBS ownership |
| AUTH-WP-05 | Evidence-bound WorkItem governance receipt verification and transition integration | P1 | PROPOSED | Align with DMK-206 and DMK-208 |
| AUTH-WP-06 | Explicitly scoped, expiring, revocable AI agent delegation with human-only policy boundaries | P1 | PROPOSED | Agent identity workstream; defer peer federation |
| AUTH-WP-07 | Negative security tests, migration/regression, independent review and verified receipts | P1 | PROPOSED | New cross-cutting verification owner |

## Existing canonical dependency constraints

- **DMK-197**: Existing Approval Inbox and quorum synchronisation; canonical `VERIFICATION_PENDING` remains unchanged.
- **DMK-198**: Reviewer provisioning / governance setup usability, currently dependent on DMK-197. Do not casually expand DMK-198 to own the entire identity system.
- **DMK-206**: Verification evidence and independent human sign-off. Existing dependencies include DMK-197, DMK-198 and DMK-208; this creates a cycle if the entire future DMK-206 workflow is made a prerequisite for DMK-197.
- **DMK-208**: Technical lifecycle and human-governance state semantics. Implement against formally adopted contract, not the contradictory current reconciliation predicate.
- **ADR-0006**: Proposed local peer Ed25519 identity and delegated agent keys; not ratified as immediate local MVP architecture.

## Proposed acceptance tests

- Every API route has a documented explicit policy; unauthorized secret, repository and administrative requests fail.
- Invalid credentials, revoked sessions, stolen/expired sessions and stale privilege grants are rejected.
- A custom role cannot create capabilities beyond the registered permission vocabulary, weaken protected denials or self-escalate.
- Human and agent principals are structurally separate, and agent approvals never count toward human quorum.
- Privileged action and approval receipts bind authenticated actor, project, resource, exact candidate/evidence digest, decision, policy version and replay prevention.
- Evidence tampering, stale digests, forged receipts, conflicted approvers and unauthorized transitions fail closed.
- Existing historical verifiers preserve fail-closed behavior while approved forward-state transitions receive separate evidence-bound validation.
- Full Quality & Build, Controlled Docs and Complete Regression jobs pass on reviewed implementation branches.

## Required registration steps

1. Refresh `master`, inspect all existing WBS identifiers/paths and confirm a collision-free allocation. `DMK-209` is **not** reserved by this document.
2. Produce a WBS ownership and dependency proposal, including complete verifier compatibility/hash-chain impact. Confirm no duplicate ownership of DMK-198/206 and no cycles.
3. Obtain approval for the **exact canonical WBS change** in a separately reviewed PR, including deterministically regenerated `MASTER_WBS.md` and full CI.
4. After approved merge, pull the new canonical WBS into the local application. Use the read-only reconciliation preview; obtain separate approval of the exact runtime candidate before any live apply.

**Preserve:** historical approvals, prior procedural noncompliance, DMK-197 canonical status, Gate 7, release status, and unrelated WorkItems.

## Open implementation design decisions

- Whether a short-term authenticated WorkItem approval bridge is separately owned before broader DMK-206 delivery.
- Which built-in roles can assign custom capabilities and what independent authorization applies to protected role grants.
- Exact policy for risk-tier reviewer quorum, reauthentication, recovery and break-glass.
- Session persistence and atomic revocation architecture across restart.
- How to replace the current `human_approved_by` text predicate with verifiable receipt-based governance without rewriting historical records.

**Review outcome required:** Approve or revise scope, ownership, IDs, path allocation and governance before canonical registration. 
