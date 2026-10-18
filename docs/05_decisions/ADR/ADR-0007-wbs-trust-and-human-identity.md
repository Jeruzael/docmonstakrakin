# ADR-0007: WBS trust, human identity, and approval authority

Status: **PROPOSED — PENDING HUMAN RATIFICATION**

Stage: B2b2-A; architecture only

Date: 2026-10-18

Inspected master baseline: `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`

Disposition: `B2B2_A_DESIGN_READY_FOR_HUMAN_REVIEW / PRODUCTION_REGISTRATION_BLOCKED`

## Context and authority

This ADR proposes the missing authority surrounding the existing pure verifiers. It neither appoints humans nor grants registration authority. A merged documentation PR, a signed Git commit, passing CI, an agent review, and a cryptographic WBS approval are different evidence classes. None substitutes for another.

The technical baseline is [Stage B2a](../../06_planning/WBS_REGISTRATION_TRUST_STAGE_B2A.md), [Stage B2b1](../../06_planning/WBS_REGISTRATION_TRANSACTION_PREFLIGHT_B2B1.md), and the [merged B2b2 architecture candidate](../../06_planning/STAGE_B2B2_TRUSTED_WBS_REGISTRATION_ARCHITECTURE_CANDIDATE.md). Merging that candidate did not ratify its proposed security policy. The [approved charter](../../00_control/PROJECT_CHARTER.md), section 4, names **Gio as Project Lead / Security Officer**. These are two responsibilities held by one person. The Lead Architect description in the [v0.2 charter](../../01_charter/V0.2_MILESTONE_CHARTER.md) and synthetic test roles do not establish an appointed co-signatory. [ADR-0006](ADR-0006-multi-agent-peer-identity-and-trust-boundary.md) remains a proposal, not a source of human authority.

This package comprises this ADR, the [role/quorum candidate](../../06_planning/STAGE_B2B2_A_HUMAN_APPROVAL_POLICY_CANDIDATE.md), [enrollment specification](../../06_planning/STAGE_B2B2_A_SIGNER_ENROLLMENT_REVOCATION.md), [threat model](../../04_security/STAGE_B2B2_A_TRUST_THREAT_MODEL.md), and [verification and human ratification checklist](../../07_verification/STAGE_B2B2_A_RATIFICATION_AND_VERIFICATION.md). Every new policy choice in these documents is pending human ratification, including choices described with “must” or “reject.” Such language specifies intended future enforcement, not deployed behavior.

## Proposed decision

Introduce a separately administered trust authority and a protected verification adapter. The adapter resolves identity, policy, provenance, time, and current protected state before calling B2a/B2b1. It may only produce evidence; a future, separately approved authorizer and transaction writer remain outside this stage. Unavailable, inconsistent, stale, or ambiguous authority fails closed. AI systems may draft and verify synthetic evidence; they cannot enroll humans, ratify policy, supply production trust anchors, or sign as human approvers.

### Independently ratified policy root

The proposed source of truth is an external, access-controlled authority registry with an append-only, independently witnessed audit log. A repository file, PR attachment, workflow input, environment variable set by PR code, or candidate receipt is never an authoritative pin. Repository copies are informational mirrors only. The concrete registry service, custodians, witness, and access controls are unresolved production blockers.

The registry publishes a versioned **governance envelope**, separate from the strict v2 policy object. The envelope binds immutable repository identity, project and operation scope, authority epoch, previous envelope digest, policy ID/version/digest, risk-profile selection rules, verified person/role registry digest, revocation sequence, allowed verifier/workflow revisions, effective interval, and ratification evidence references. It is authenticated under the separately installed governance root. Its canonical encoding, signature domain, distribution protocol, and schema require specification and ratification before implementation. No root bytes, production policy digest, or usable approval artifact is minted by this ADR.

The v2 policy digest remains exactly `policyDigestV2`: SHA-256 of UTF-8 repository canonical JSON with sorted object keys and preserved array order, **without a domain prefix**. It is not claimed to be RFC 8785. See [the implementation](../../../scripts/verifyTrustedWbsRegistrationV2.ts). The envelope authenticates that exact digest; its own future digest must not be substituted for `pinnedPolicySha256`.

Every authority-epoch transition must issue a new `policyVersion` and therefore a new v2 policy digest for every active risk profile, even when its roles and keys are unchanged. The envelope must reject an epoch advance that reuses a prior active policy digest. The human-signed v2 intent already binds policy ID/version/digest; it has no epoch field, so an envelope-only epoch change could otherwise replay old signatures. Routine freshness observations and unchanged-state witness checkpoints use their own monotonic sequence without advancing the authority epoch. Any authority change requires the epoch/digest transition; revocation state additionally requires the immediate deny/fencing rules below. No new v2 fields or issuance receipts are introduced.

Initial trust cannot be bootstrapped by a self-signed PR. Proposed bootstrap ceremony: Gio, under the existing charter, explicitly ratifies the governance transition; two other independently identity-verified humans witness the ceremony and accept named custodian responsibilities through out-of-band contact. The three people authenticate root fingerprints and the initial envelope through independent channels and record their decisions in separately controlled records. The two witnesses are not assumed to exist or to hold roles today. The current charter must be explicitly reconciled by human decision before the new authority is activated. This unavoidable initial human trust assumption is recorded rather than hidden behind circular signatures. No production registration is allowed during bootstrap.

After bootstrap, protected consumers pin the root fingerprint and a minimum accepted epoch outside PR-controlled configuration. Registry updates require the critical-change quorum in the policy candidate, a semantic diff, an independently reviewed enrollment/role impact assessment, and old-root authentication. Root rotation additionally requires proof of possession of the new root and old/new custody attestations. An independent witness retains the new checkpoint before activation. Consumers persist monotonic epoch and revocation high-water marks; valid signatures on an older envelope do not permit rollback. Log equivocation, witness disagreement, missing freshness, or a partial rollout freezes authorization. The architecture of checkpoint distribution and anti-rollback storage must be verified before deployment.

Policy changes never silently bless outstanding receipts. A changed active policy digest or epoch invalidates pending authorizations; collect new human signatures on fresh intent after re-review. Keep immutable old policies and ratification records for historical audit. An authority registry operator cannot approve their own unilateral root or role change. Read and write administration, witnesses, and signing custody must not collapse into one person or one recoverable shared account.

### Trusted execution boundary

The following is a proposed integration contract. No protected authorizer or broker is deployed by this change.

| Input / boundary | Trusted acquisition and validation | Rejection rule / B2a destination |
| --- | --- | --- |
| Workflow execution identity | A broker validates GitHub OIDC issuer, audience, signature, temporal claims, unique token/run binding, immutable repository and owner IDs, exact protected ref, allowed event, environment, and approved workflow source revision. For reusable workflows validate both caller and `job_workflow_ref` / `job_workflow_sha`. | Missing or unexpected claims, wrong repo/ref/revision, replayed token, or ambiguous caller reject. OIDC authenticates a job, not a human or a policy. |
| Trusted code and dependencies | Execute only an independently reviewed protected revision; pin reusable workflows/actions and verifier dependencies to immutable reviewed revisions. Use isolated ephemeral workers without PR caches, hooks, scripts, or credential-bearing signing agents. | Never execute a PR checkout, downloaded candidate script, or PR-modified workflow in the privileged boundary. Existing CI is not this boundary. |
| Candidate receipt/policy transport | Treat files as bounded data. A future reader rejects duplicate keys before object construction, invalid UTF-8, BOM, unsupported schema, ambiguous encodings, unexpected keys and excessive size/depth. | Strict parsing precedes digest computation. B2b1 object validation cannot recover duplicate raw receipt keys already collapsed by JSON parsing. |
| Policy and human registry | Authenticate a fresh governance envelope and witness checkpoint using the independently installed root; apply person independence, roles, risk profile, custody, revocation and conflict checks. | Populate `pinnedPolicySha256` only from the active envelope. Unknown/stale identity or policy rejects; caller pins are ignored. |
| PR provenance | Broker reads authenticated GitHub API data and Git objects; cross-check numeric repository/owner IDs, PR number, base repository/ref/current protected tip, head commit, head tree, and review state for that exact head. Inputs may locate a PR, not assert its authority. | Derive `expectedGit` containing exactly `repository`, `pullRequestNumber`, `baseCommitSha`, `reviewedHeadCommitSha`, `reviewedHeadTreeSha`. Do not use an event merge SHA as reviewed head, or assume a PR's reported merge base is the current protected tip. |
| Time | Independently administered clock service supplies authenticated observation, uncertainty, freshness, monotonic sequence and nonce binding to this verification session and digest of its non-time inputs. Broker validates it with already trusted clock-service credentials. | Derive precise UTC `nowIso`; reject missing/expired observations, clock rollback or uncertainty overlapping any validity boundary. Receipt dates and caller `Date.now()` are not time authority. |
| Protected current WBS / ledger | Resolve current protected ref through the authenticated provider; read exact blobs at that same commit; validate chain and retained historical evidence before deriving consumed IDs and expected hashes. | Populate `consumedReceiptIds` and B2b1 expected current WBS/ledger hashes from that snapshot. An internally consistent stale caller snapshot rejects. |
| Verification result | Call unchanged pure B2a/B2b1 only after every external gate succeeds. Preserve result plus evidence references and source revisions. | Even success retains `mayApply:false`. A result is not a bearer authorization or permission to mutate. |

GitHub documents the [OIDC claims and reusable-workflow identity](https://docs.github.com/en/actions/reference/security/oidc). An environment's configured required-reviewer list can be satisfied by **one** reviewer; it cannot enforce the proposed two- or three-human cryptographic quorum. GitHub also documents self-review prevention and administrator bypass settings; their effective configuration must be audited, not inferred from a ruleset's existence. See [deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Repository plan/visibility support and branch protection enforcement remain unverified production prerequisites.

Candidate clock design: an independently operated service disciplined by authenticated time sources, with bounded uncertainty and protected monotonic state. [NTS](https://www.rfc-editor.org/rfc/rfc8915.html) authenticates NTP communication; it does not make an arbitrary runner clock trustworthy or prove the server is correct. The service's signing keys, root pin, operational monitoring, and outage policy need independent approval. Avoid circular time bootstrap: validate clock trust against a provisioned root and monotonic checkpoint, then use the resulting bounded time for OIDC/policy lifetimes. Without a trustworthy starting checkpoint, require human-assisted re-establishment; never fall back to receipt time. Synthetic tests inject deterministic clock responses; offline production authorization is blocked while freshness cannot be established.

Final authorization would require re-reading policy/revocation checkpoint, PR head/reviews, trusted time and protected state immediately before a future atomic operation. A check followed by an unconditional write leaves a TOCTOU race. Exact remote compare-and-swap, receipt consumption, policy/revocation freshness fencing, failure recovery and independent post-application audit remain B2b2-C/D/E work. This ADR does not claim to close those races or implement them. The reviewed pre-receipt head/tree and a resulting receipt-bearing tree are distinct; never demand a circular signature over a tree containing that same signature.

## Compatibility and explicit limitations

The v2 policy schema has `requiredRoles` and `humanKeys`; it has no person-verification evidence, risk classifier, arbitrary threshold or conflict-of-interest fields. The proposed registry/envelope is a separately authenticated adapter contract, not extra fields smuggled into v2. A risk profile can select an independently pinned v2 policy with exactly two or three distinct required roles. Arbitrary two-of-three signatures with the same role would need a new reviewed schema/verifier. Unknown versions reject.

The v2 signature payload remains `DOCMONSTAKRAKIN/WBS_REGISTRATION/2.0\n` followed by canonical intent JSON. B2b1's `signedReceiptSha256` hashes its normalized, domain-separated signed receipt payload, not arbitrary receipt file bytes. Retention must preserve the raw artifact and its byte digest separately from this semantic digest. Historical receipts, bootstrap evidence and expected hashes remain unchanged. Historical signatures need a separately reviewed adapter and trusted as-of evidence; replaying them through today's roster with altered revocation flags is prohibited.

Current CI declares `contents: read` in [ci.yml](../../../.github/workflows/ci.yml), but passing those checks is not a production trust-boundary audit. Workflow permissions, action pins, branch rules, administrator bypass, review dismissal, broker isolation, environment protections, and external registry controls need effective-configuration evidence before activation.

## Decision matrix

“Existing” below means accepted technical baseline behavior at the pinned commit, not ratification of new human policy.

| ID | Classification | Decision / evidence | Production consequence |
| --- | --- | --- | --- |
| D01 | Existing approved technical baseline | B2a verifies byte/digest/Git/time/signature consistency and always returns `mayApply:false`; B2b1 adds strict objects/canonical ledger/acyclic chain and preview only. | Preserve unchanged; does not authorize production. |
| D02 | Existing approved governance | Charter names Gio as Project Lead / Security Officer. No separately named Lead Architect appointment established. | One human; no independent quorum currently established. |
| D03 | Proposed control | Person registry, independent enrollment, separate key purposes, custody and per-person quorum. | Requires human appointments and enrollment implementation. |
| D04 | Proposed control | External root/envelope, three-person bootstrap, witnessed monotonic checkpoints and authenticated updates. | No deployment or bootstrap ratification yet. |
| D05 | Proposed policy choice | Two-person ordinary / three-person high-risk profiles; no self-approval; critical governance-change quorum. | Humans must ratify roles, scope, deputies, and charter transition. |
| D06 | Proposed control | Protected broker, authenticated provenance/clock, strict raw parser and isolated execution. | Integration tests and effective configuration required. |
| D07 | Unresolved choice | Registry/witness provider, custodians, root storage, recovery quorum availability and identity proof standard. | Blocks root activation and enrollment. |
| D08 | Unresolved choice | Exact clock/freshness/expiry bounds and versioned envelope/challenge schemas. | Blocks production verification. |
| D09 | Unresolved choice | Historical compromise-time adjudication, retained artifact format and canonical ledger path. | B2b2-B full-chain audit required. |
| D10 | Production blocker | Current remote protections, privilege isolation and CAS/freshness fencing not proven. | B2b2-C/D/E evidence and independent review required. |
| D11 | Production blocker | No ratified independent human roster or production policy pin; no authorization to register DMK-209–214. | PR #34 remains separate and blocked. |

## Consequences and alternatives

Independent administration increases operational cost and may block registration during outages or loss of a signer. That is preferable to treating availability as permission to bypass identity. A PR-controlled policy file, GitHub review alone, two keys owned by one human, and a local successful verifier were considered and rejected as production trust roots. A hardware token improves custody but does not prove two owners; mandatory human enrollment and conflicts checks remain necessary. Multi-human collusion and compromise of all root custodians remain residual risks requiring explicit human acceptance and independent audit.

No canonical WBS, DMK-209–214 registration, historical evidence, local WorkItems, Gate 7, production writer, authorization receipt or release state is changed. Human review and CI on the separate SSH-signed documentation PR are required before any merge consideration. Merging documentation must not be interpreted as policy activation.
