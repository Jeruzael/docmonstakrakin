# Stage B2b2-A human approval and role-quorum policy candidate

Status: **PROPOSED — ALL NEW POLICY CHOICES PENDING HUMAN RATIFICATION**

Date: 2026-10-18

Baseline: `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`

Parent: [ADR-0007](../05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md)

## Existing authority and proposed responsibilities

[The charter](../00_control/PROJECT_CHARTER.md), section 4, assigns Project Lead and Security Officer to Gio. That existing architecture-ratification authority is preserved. No second human, deputy, custodian or Lead Architect is appointed by this candidate. Establishing a new multi-human production policy requires an explicit human-ratified governance transition; an agent cannot infer that the transition has happened from this PR's merge or a GitHub approval.

| Action | Project Lead | Security Officer | Independent human approver | AI agent / service account |
| --- | --- | --- | --- | --- |
| Propose design / candidate WBS diff | May propose | May propose | May propose | May draft within authorized scope; no promotion |
| GitHub code/document review | May review when independent of author | May review when independent of author | May review as an authorized repository reviewer | May provide advisory findings; cannot count as human review |
| Ratify architecture / governance transition | Gio retains current charter authority | Gio currently holds this responsibility too | No existing ratification authority; future appointment explicit | Prohibited |
| Verify enrollment / grant a role | Proposed accountable sponsor; cannot self-enroll or appoint alone | Proposed security check and veto of unresolved identity/custody issues | Proposed independent enrollment witness after appointment | May validate synthetic records only |
| Sign ordinary WBS registration intent | Proposed lead slot, only if eligible | Proposed independent security slot, different person | No substitution unless explicitly appointed to a required role | Prohibited; `kind:HUMAN` is not self-certifying |
| Sign high-risk registration intent | Proposed eligible lead slot | Proposed eligible security slot | Proposed third, independent slot | Prohibited |
| Change root / policy / quorum / role roster | Proposed critical-change quorum member | Proposed critical-change quorum member | Proposed independent third member | May draft diff; cannot ratify, publish an authoritative pin or activate |
| Suspend on suspected compromise | May request immediate freeze | May request immediate freeze | May report/request freeze | May alert or trigger a predetermined deny-only detector; cannot restore authority |
| Recover or unfreeze | Proposed recovery quorum, no unilateral override | Proposed recovery quorum, no unilateral override | Proposed independent recovery member | Prohibited |
| Execute a future authorized transaction | No direct human bypass of transaction controls | No direct human bypass | No direct human bypass | Only a separately approved narrow service could execute; absent today |

Labels describe responsibilities, not proof of authority. Gio cannot fill both signing slots in a single operation. A future deputy requires separate identity verification, explicit scope, expiry and ratified appointment. Failure to find eligible independent people means **BLOCKED**, not automatic delegation to an agent or a renamed key.

## Proposed risk profiles and independence rules

All values and role names below are candidates. The trusted authority selects a profile from an independently ratified classification table; a PR's risk label or signed self-description cannot lower the requirement. An unclassified change blocks until classified by authorized humans. Mixed changes use the highest applicable risk. WBS registration does not itself grant implementation, release or runtime mutation authority.

| Profile | Proposed scope | Required independent humans | Additional conditions |
| --- | --- | --- | --- |
| R1 ordinary | Bounded additive WBS items with no elevated-risk content and no authority/control/history changes | 2: eligible Project Lead and eligible Security Officer | Different verified persons; independent human GitHub review and required CI for exact candidate head |
| R2 elevated | Items concerning identity, credentials, security controls, authority, protected data, critical operations, or uncertain high impact | 3: eligible Project Lead, Security Officer, Independent Human Approver | Independent security assessment and explicit residual-risk acceptance under ratified governance; no risk downgrade by author |
| R3 governance / recovery | Root, policy, role roster, quorum, risk classification, workflow trust, clock trust or recovery changes | 3 distinct eligible governance humans with lead, security and independent responsibilities | Authenticate under active old authority; independent audit/witness checkpoint; never conveyed by an `ADD_WBS_ITEMS` receipt |
| Outside registration scope | Historical evidence rewrite, runtime reconciliation, Gate 7, release, unsupported WBS operation | No registration profile can authorize it | Requires a different explicit authority/workflow; remains blocked here |

Proposed conflict rules: no signature from the candidate's human author, submitter, enrollment beneficiary, or a person whose authority is being increased by that decision may count toward its approval quorum. Agent-authored changes retain an accountable human sponsor/submitter; automation does not erase authorship conflicts. A reviewer may also provide a WBS signature if independently eligible, but these remain separately recorded actions. Independent reviewers and signers must disclose shared account/custody, delegation, employment/reporting dependencies, financial interests and involvement in preparing the evidence. For this candidate, a direct reporting relationship between required signers, shared key recovery control, or shared credentials disqualifies independence; other disclosed interests require documented independent adjudication before proceeding. Unknown independence rejects.

An existing custodian may approve an ordinary rotation of a collectively governed root only if it does not increase that person's authority, was proposed by a different accountable person, and the required other independent approvers participate. A beneficiary of a role increase must be replaced by an already appointed eligible deputy for approval. If this is impossible, authorization freezes pending a separately ratified governance transition; do not lower quorum. The initial bootstrap is a distinct charter-ratified, witnessed ceremony described in the ADR, not an ordinary self-enrollment exception available at runtime.

Person identity is stable across key rotation and account aliases. Count verified person IDs from the external registry, then enforce role eligibility and distinct key fingerprints. Two keys, two GitHub accounts, two role names, or two principal strings for the same human count as **one** human. Shared or agent-accessible private keys are ineligible regardless of a `HUMAN` label. See [enrollment and revocation](STAGE_B2B2_A_SIGNER_ENROLLMENT_REVOCATION.md).

## Mapping to the existing verifier

The current [v2 verifier](../../scripts/verifyTrustedWbsRegistrationV2.ts) requires exactly one signature for each unique `requiredRoles` entry and distinct claimed principal IDs, roles and SPKI fingerprints. This is a limited mechanism, not a risk policy or a proof of actual-human independence.

For a future R1 operation the trusted registry could select a separately ratified v2 policy with required roles `Project Lead` and `Security Officer`. R2 could select another pinned policy adding `Independent Human Approver`. Exact role strings, policy IDs and versions remain unassigned. The adapter must check the chosen policy against the externally authorized profile, verified person mapping and conflicts. These fields must not be inserted into v2 objects as schema extensions. Arbitrary N-of-M same-role quorums require a future schema, verifier and ratification; they are not supported by renaming people or keys.

A human signing client must independently display and verify the project, operation, immutable repository/PR/base/head/tree, full before/after WBS diff and exact hashes, approved items, policy/profile, expiry and receipt ID. It must verify the root/policy through a trusted channel, not blindly sign a digest supplied by an agent. The intent signature covers the v2 domain-separated canonical bytes. An SSH Git commit signature, GitHub review, OIDC token, enrollment proof or prior receipt cannot substitute for that signature. Changed candidate bytes, head/tree/base, role roster, policy or approval interval require a fresh review and signatures; never transplant approvals between candidates.

## Proposed operational bounds, all unratified

| Control | Candidate value | Unresolved ratification requirement |
| --- | --- | --- |
| Enrollment proof challenge | Random 256-bit nonce, one use, maximum 10 minutes | Verify ceremony usability and replay storage |
| Signing-key enrollment lifetime | Maximum 90 days, with explicit renewal and fresh possession proof | Custody device support and rotation availability |
| WBS intent window | Maximum 24 hours; all identity/policy/key validity must contain the execution observation | Humans may require shorter windows by risk |
| Root and revocation checkpoint age | Maximum 5 minutes and monotonic sequence | Propagation/fencing design must prevent use after effective revocation |
| Clock observation age | Maximum 60 seconds, maximum uncertainty 2 seconds | Prove service accuracy and authenticated delivery |
| Boundary behavior | Full uncertainty interval must fall inside all validity windows | No leeway that extends a human approval; exact tests needed |

These numbers are not defaults authorized for production. The pure verifier currently accepts inclusive interval endpoints at millisecond precision and checks validity for all enrolled policy keys, including unused keys. The adapter's uncertainty containment is an additional proposed gate. No clock or revocation outage permits offline production approval. Historical analysis and synthetic tests remain offline-capable and non-authorizing.

## Emergency and recovery policy

Suspension may be easier than authorization: a credible compromise report can freeze the affected key, role or entire service pending investigation. A freeze cannot grant replacement authority or silently alter historical evidence. Unfreezing, re-enrollment or root recovery requires R3 or a separately ratified offline recovery quorum of at least three distinct eligible humans, authenticated through pre-enrolled recovery anchors, independent identity re-verification and an audited new epoch. Recovery custodians and quorum are currently unassigned. Recovery material must not let one custodian reconstruct multiple humans' keys or bypass quorum.

If an old root is compromised, it cannot by itself authenticate its replacement. Use the pre-ratified independent recovery anchors and witnessed ceremony, invalidate pending receipts, and reconcile checkpoints before resuming. If both active and recovery trust are lost, remain blocked and undertake a new explicitly authorized governance establishment with out-of-band evidence; no trust-on-first-use, administrator bypass, emergency agent signature or temporary one-person quorum is permitted by this candidate. Incident response can preserve evidence while registration stays unavailable.

## Ratification boundary

This document is not a serialized `TrustedPolicyV2`, a ratification record or an authorization receipt. No actual signer roster, keys, role assignment, policy pin, production signature or Lead Architect identity is supplied. Use the [human checklist](../07_verification/STAGE_B2B2_A_RATIFICATION_AND_VERIFICATION.md) for later explicit decisions. Until then: `B2B2_A_DESIGN_READY_FOR_HUMAN_REVIEW / PRODUCTION_REGISTRATION_BLOCKED`.
