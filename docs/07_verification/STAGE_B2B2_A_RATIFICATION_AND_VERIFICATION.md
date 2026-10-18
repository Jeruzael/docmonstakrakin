# Stage B2b2-A human ratification and verification record

Status: **DESIGN REVIEW PACKAGE — NO POLICY RATIFICATION OR PRODUCTION AUTHORIZATION**

Date: 2026-10-18

Inspected baseline: `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`

Disposition: `B2B2_A_DESIGN_READY_FOR_HUMAN_REVIEW / PRODUCTION_REGISTRATION_BLOCKED`

## Review package and scope

1. [ADR-0007: trust root and execution boundary](../05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md).
2. [Human approval and role-quorum policy candidate](../06_planning/STAGE_B2B2_A_HUMAN_APPROVAL_POLICY_CANDIDATE.md).
3. [Signing-key enrollment, custody, revocation and recovery](../06_planning/STAGE_B2B2_A_SIGNER_ENROLLMENT_REVOCATION.md).
4. [Threat model and fail-closed test matrix T01–T22](../04_security/STAGE_B2B2_A_TRUST_THREAT_MODEL.md).
5. This verification and human ratification checklist.

Only these five new Markdown files are intended for the documentation PR. The authoritative inputs remain [B2a](../06_planning/WBS_REGISTRATION_TRUST_STAGE_B2A.md), [B2b1](../06_planning/WBS_REGISTRATION_TRANSACTION_PREFLIGHT_B2B1.md), the [merged B2b2 candidate](../06_planning/STAGE_B2B2_TRUSTED_WBS_REGISTRATION_ARCHITECTURE_CANDIDATE.md), and their unchanged verifier implementations. No canonical WBS entry is created for this documentation work.

The original checkout is preserved; work is based on the exact verified master commit in a separate managed worktree. Baseline tests use existing dependencies through an ignored local junction; no dependency or lockfile changes are part of the PR. An initial external-loader attempt could not resolve `yaml` in the new worktree; after providing the dependency junction, the exact unchanged tests below passed. This was an environment setup failure, not an altered test expectation.

## Verification routes

PASS means the stated narrow check completed. It does not confer authority. BLOCKED means required production/human prerequisites are absent. NOT RUN means an intentionally unexecuted or future route. Hosted CI and human review are reported on the PR for its exact head; this pre-commit record does not claim their future outcomes.

| Route | Status at local package preparation | Evidence / limitation |
| --- | --- | --- |
| Master baseline audit | PASS | Fetched `origin/master` and verified exact commit `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`; documentation branch starts there |
| Independent agent source and draft review | PASS | Fresh-context read-only review of baseline and package; found an epoch/signature binding gap, corrected by requiring a new v2 policy version/digest per authority epoch and adding T06 coverage; not human approval |
| B2a offline synthetic suite | PASS | `node --import tsx scripts/testTrustedWbsRegistrationV2.ts`: 22/22 checks; in-memory synthetic keys; success remains evidence-only |
| B2b1 offline synthetic suite | PASS | `node --import tsx scripts/testPlanWbsRegistrationTransaction.ts`: 26/26 checks; canonical ledger/strict receipt/chain tests; no writer |
| WBS rendering parity | PASS | `npm run wbs:check`: zero drift; check mode only, no rendering mutation |
| New document relative links and completeness | PASS | Local checker: five documents, 36 resolving relative links, unique T01–T22 rows, baseline/disposition in each document and all ratification boxes unchecked |
| Documentation-only diff and protected-state preservation | PASS | Only five new Markdown files; no tracked baseline changes; 555 original `.local`, `.secrets` and `runtime` file hashes unchanged; original checkout clean |
| SSH-signed documentation commit | NOT RUN | Sign and verify after local validation; Git provenance only, not WBS human approval |
| Hosted Quality & Build, Controlled Docs, Complete Regression | NOT RUN | Run through existing CI on the new PR; all must pass on its exact head before merge consideration |
| Independent human documentation/architecture review | BLOCKED | Requested on separate PR; no human approval exists in this package |
| New trust-boundary integration tests T01–T22 | NOT RUN | Strategy specified; proposed adapters and operational controls are not implemented; existing primitive coverage is distinguished in matrix |
| Live signer enrollment / policy activation / production signatures | NOT RUN | Explicitly outside scope; no production keys or signatures created |
| Policy and governance ratification | BLOCKED | Checklist below remains entirely pending |
| Historical full-chain trust and revocation adjudication | BLOCKED | B2b2-B adapter, retained evidence and human policy choices still required |
| Protected production workflow / provenance / clock audit | BLOCKED | B2b2-C integration and effective remote-configuration evidence missing |
| Atomic production transaction / remote CAS / freshness fencing | BLOCKED | Future B2b2-D/E work; no writer or authorization receipt created |
| PR #34 / DMK-209–214 registration | BLOCKED | No registration or merge authorized by this task |
| Local WorkItem reconciliation, Gate 7 and release | NOT RUN | Separate authority; unchanged by this documentation task |

## Explicit human ratification checklist

Every box below is intentionally unchecked. A reviewer must distinguish approval to merge explanatory documentation from approval to activate a security policy. Do not fill these boxes automatically from CI, an agent recommendation, a Git commit signature or a GitHub review. A future ratification record must identify actual humans, decisions, scope, evidence digests, independently authenticated time and authority; placeholders are invalid.

- [ ] **Authority transition:** Gio explicitly approves or rejects the proposed change from the current combined charter responsibilities to a multi-human production governance policy, with the exact charter transition and effective scope recorded separately.
- [ ] **Named independent people:** Identify and independently authenticate actual Project Lead/deputy, Security Officer, independent approver, root custodians, enrollment verifiers and recovery custodians. Resolve overlapping duties and conflicts. Do not infer a Lead Architect appointment.
- [ ] **Independence and conflicts:** Ratify stable person identity, alias reconciliation, author/beneficiary exclusions, reporting relationships, shared custody/recovery restrictions, exception adjudication and insufficient-quorum behavior.
- [ ] **Risk and quorum:** Ratify or revise R1/R2/R3, the classification table, exact role names, profile-selection authority, critical-change rules and explicit rejection of unclassified changes.
- [ ] **Enrollment:** Choose identity evidence standard, two-verifier ceremony, consent/privacy/retention policy, challenge schema/domain and possession-proof validation. No real enrollment until separately authorized.
- [ ] **Key custody:** Approve Ed25519 device/client, per-operation human confirmation, isolation from agents/CI, distinct key purposes, expiry, renewal, rotation and no shared recovery of quorum keys.
- [ ] **Initial root ceremony:** Approve named independent witnesses/custodians, out-of-band fingerprint verification, root and recovery anchor installation, external registry and independently retained ceremony records. No PR-controlled trust-on-first-use.
- [ ] **Policy schema and change control:** Approve governance envelope encoding, version/domain, exact v2 policy digest rules, mandatory new v2 policy version/digest for every authority-epoch transition, semantic review, old/new root transition, role changes, checkpoint witness and rollback/equivocation detection.
- [ ] **Time and freshness:** Ratify numerical bounds, clock trust/bootstrap/uncertainty, checkpoint age, monotonic state and outage behavior. Define the consumer fence so age tolerance cannot become permission to use revoked authority.
- [ ] **Recovery:** Approve independently pre-enrolled recovery anchors, at least three eligible recovery humans or a revised explicitly ratified policy, suspension, compromise adjudication and lost-all-trust procedures. No agent or administrator bypass.
- [ ] **Historical evidence:** Ratify as-of validation and compromise-time rules, archive retention/serialization and unresolved canonical ledger path. Preserve historical bootstrap evidence, procedural findings and expected hashes.
- [ ] **Execution boundary:** Approve and independently test exact protected workflow/reusable workflow revisions, immutable action/dependency pins, OIDC claims, repository IDs, API provenance, raw parsers, isolation and no PR code with privileged credentials.
- [ ] **Effective GitHub enforcement:** Independently audit branch rules, required exact-head CI and independent reviews, review dismissal, force-push/admin bypass, environment controls and plan support. A configured list of environment reviewers does not prove multiple human approvals.
- [ ] **Residual risks:** Explicitly accept or mitigate all-party collusion, identity fraud, root/witness/provider compromise, custody limitations, availability and recovery complexity under legitimate human authority.
- [ ] **Verification and activation:** Review executable synthetic integration tests and negative outcomes for every T01–T22 boundary, historical audit, remote CAS/fencing, crash recovery and independent post-application audit in later stages. Only then consider a separate production activation decision.

## Stop boundary and next-stage separation

The intended present outcome is a reviewed design candidate, not operational readiness. A separate SSH-signed documentation-only PR requires independent human review and CI. Stop before merging it or ratifying this policy. PR #34 remains separate; no merge, WBS registration, authorization receipt, runtime reconciliation, Gate 7 change or release promotion is part of this stage.

After human design review, any implementation requires new explicit scope. The merged B2b2 sequence remains: historical verification (B), trusted inputs (C), shadow/CAS design (D), production readiness and human ratification (E), then exact-candidate registration review (F). None is started by this package. Documentation approval must not be represented as an enrolled roster, installed policy pin, approved recovery root or completed production gate.
