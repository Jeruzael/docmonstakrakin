# Stage B2b2-A trust threat model and fail-closed matrix

Status: **PROPOSED ARCHITECTURE — NOT A PRODUCTION SECURITY ATTESTATION**

Date: 2026-10-18

Baseline: `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`

Related: [ADR-0007](../05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md), [policy candidate](../06_planning/STAGE_B2B2_A_HUMAN_APPROVAL_POLICY_CANDIDATE.md), [enrollment specification](../06_planning/STAGE_B2B2_A_SIGNER_ENROLLMENT_REVOCATION.md)

## Scope and model

**Summary.** B2a verifies supplied cryptographic/contextual evidence; B2b1 checks a supplied ledger and proposes bytes. Neither authenticates the external authority supplying the context or writes state. B2b2-A proposes that surrounding authority without implementing it. This model incorporates a fresh-context agent architecture review of the pinned source; that review is not independent human approval or a full repository security scan.

**Assets.** Exact reviewed WBS bytes and approved items; stable human identities and role eligibility; human/private-key custody; policy root, version, digest and revocation state; authenticated repository/PR/head/tree; trustworthy time; immutable historical evidence and ledger continuity; future atomic receipt consumption; protected workflow credentials; independence of runtime and release authorization.

**Attacker capabilities.** A contributor may control PR files, workflow edits, scripts, dependency changes, candidate policy/receipt artifacts and self-declared identities. A single human may create multiple keys/accounts. An agent may possess ordinary repo credentials or attempt to prompt a signer. An attacker may replay old valid artifacts, compromise a signer, collude with other signers, compromise an authority administrator, or delay/fork network responses. GitHub, the clock service, custody devices and root administrators may themselves fail or be compromised; assuming every member of a quorum remains honest is not a cryptographic guarantee.

**Security objectives.** Never convert caller-controlled consistency into security authority. Count independently verified people rather than keypairs. Bind approval to exact reviewed content, current externally ratified policy and authenticated context. Reject uncertain identity, stale or missing trust, raw ambiguity, replay and mismatched approvals. Preserve unconditional preview-only behavior and all historical/runtime/release boundaries. Future execution requires additional atomicity and operational evidence.

**Assumptions.** At least one required independent approver and an independent audit witness are assumed honest for the proposed quorum benefit; all-party collusion is residual risk. External root and recovery anchors need real human bootstrap. Network freshness may be unavailable; this blocks production but not offline synthetic analysis. Current effective GitHub protection and external service configuration are not established by repository source. No human identities, keys, signatures or policies are enrolled/ratified in this stage.

## Trust boundaries and effective resources

| Boundary / consumer | Current source of value | Current enforcement | Proposed independent source / unresolved gap |
| --- | --- | --- | --- |
| Actual human → key/role | `policy.humanKeys` claims | Ed25519, SPKI fingerprint uniqueness, principal/role checks | External person registry, out-of-band verification, custody and conflicts |
| Root → policy | `context.pinnedPolicySha256` supplied by caller | Equality to canonical policy digest and signed intent claim | Independently installed root and fresh witnessed governance envelope |
| Roles → quorum | `policy.requiredRoles` | Exact signature count; distinct claimed principals/roles/fingerprints | Risk-profile selection, verified distinct people and exclusions |
| Git provider → context | `context.expectedGit` | Equality to five signed Git fields | Authenticated API/object resolution, immutable repo IDs and protected-ref snapshot |
| Clock → context | `context.nowIso` | Strict UTC format and interval comparisons | Authenticated clock observation with uncertainty, freshness and monotonicity |
| Raw receipt → verifier | Already parsed receipt object | B2b1 exact keys, normalized receipt digest and canonical Base64 | Strict raw UTF-8/duplicate-key reader still absent |
| Protected state → preview | Buffers and expected WBS/ledger hashes supplied by caller | Canonical ledger, chain/uniqueness, hash and consumed-set consistency | Protected-ref freshness and full historical signature audit absent |
| CI → privileged authorizer | CI currently checks PR/push code with declared `contents:read` | Tests/build; no production authority broker here | Separate protected code, OIDC gate, isolation, least privilege and configuration audit |
| Preview → future transaction | `mayApply:false` | No writer in B2a/B2b1 | Remote CAS, epoch fencing and atomic receipt consumption unresolved |
| WBS → runtime/release | Separate existing governance | No grant from these pure helpers | Separate human authorization remains mandatory |

Verified source anchors at the pinned baseline: [B2a context and verifier](../../scripts/verifyTrustedWbsRegistrationV2.ts) lines 67, 138–151, 180–209, 236–315; [B2b1 normalization and preview](../../scripts/planWbsRegistrationTransaction.ts) lines 217, 354–363, 394–470, 488–574; [CI](../../.github/workflows/ci.yml) line 12; [charter](../00_control/PROJECT_CHARTER.md) section 4. The [B2b2 candidate](../06_planning/STAGE_B2B2_TRUSTED_WBS_REGISTRATION_ARCHITECTURE_CANDIDATE.md) records the raw receipt, historical signature, stale snapshot, concurrent candidate and caller-controlled context gaps. These gaps are not closed by this documentation.

## Threats and negative-test matrix

`EXISTING` means a matching primitive is covered by an existing synthetic suite, not end-to-end trust enforcement. `DESIGN / NOT RUN` means the proposed boundary has no implementation or executable test added in this documentation-only stage. Every proposed negative test must assert rejection, no authorization output and no mutation; a passing pure preview still has `mayApply:false`.

| ID | Threat / synthetic offline negative case | Intended fail-closed result and enforcement owner | Current coverage |
| --- | --- | --- | --- |
| T01 | Impersonate a human using a GitHub name, `kind:HUMAN`, forged interview record or an unapproved role | Enrollment authority rejects missing independently authenticated identity and role evidence | DESIGN / NOT RUN |
| T02 | One person enrolls two keys under two principal IDs/accounts; same person returns after rotation | Registry alias/person mapping collapses identities; adapter rejects duplicate-person quorum | DESIGN / NOT RUN; current verifier only catches duplicate principal claims/key material |
| T03 | Two nominal humans share a key, recovery secret, custody account, or signer delegated to an AI agent | Custody/independence gate rejects; no human slot for service credentials | DESIGN / NOT RUN; shared SPKI rejection EXISTING |
| T04 | Replay proof of possession; alter nonce, role, fingerprint, purpose, issuer or expiry; submit a Git SSH signature as enrollment proof | Enrollment challenge verifier rejects domain/request mismatch and consumed/expired nonce | DESIGN / NOT RUN |
| T05 | PR substitutes its own policy, keys and matching pin; retains policy name/version while changing roles | External root resolver rejects PR pin and unratified envelope; B2a rejects changed digest against true pin | Digest mismatch EXISTING; root provenance DESIGN / NOT RUN |
| T06 | Roll back to a legitimately signed older policy/revocation checkpoint, fork authority log, rotate root with only new-root signatures, or advance authority epoch while reusing the old policy digest and receipt | Root resolver rejects below high-water mark, missing witness/old authority, or epoch advance without new v2 policy version/digest; old signatures fail against the new active digest | DESIGN / NOT RUN |
| T07 | Author signs own change, beneficiary approves own role increase, or direct reports/shared custodians claim independence | Eligibility/conflict gate rejects; missing eligible deputy blocks | DESIGN / NOT RUN |
| T08 | Misclassify security-related items as ordinary; submit two signatures where external profile requires three; add an unrecognized role/version | Trusted risk/profile selector rejects downgrade/unknown schema; exact role count enforced | Exact role/count primitive EXISTING; risk and real-person profile DESIGN / NOT RUN |
| T09 | Steal a key; use suspended/revoked/expired key or approval; revoke between verification and consumption | Registry/clock gates reject and invalidate pending use; future consumer fences revocation epoch | Revoked/invalid validity primitives EXISTING; freshness/race DESIGN / NOT RUN |
| T10 | Reuse consumed receipt or valid receipt on another project, operation, PR, base, head/tree or WBS bytes | Signature/context/ledger checks reject substitution; authoritative consumer prevents second use | Context/hash/consumed-set primitives EXISTING; atomic consumption DESIGN / NOT RUN |
| T11 | Supply a coherent stale WBS, ledger, policy, Git context and clock that pass all local equality checks | Trusted adapters reject stale sources; consumer CAS/epoch/time checks block stale execution | DESIGN / NOT RUN; mismatched supplied hashes tested, coherent stale authority not solved |
| T12 | Modify PR workflow/dependency/cache to exfiltrate credentials; call privileged reusable workflow from malicious caller | Broker rejects source claims; isolated worker never executes PR code with credentials | DESIGN / NOT RUN; current CI is not a production broker |
| T13 | Forge/replay OIDC token; wrong issuer/audience/repo ID/owner/ref/event/workflow SHA/environment; valid callee but malicious caller | OIDC verifier plus independent allowlist reject; token identity alone grants no human authority | DESIGN / NOT RUN |
| T14 | Spoof API response or API origin; rename/transfer repo; confuse merge SHA with head; change PR head or dismiss review after approval | Authenticated provenance resolver rejects inconsistent IDs/objects/reviews; revalidation blocks stale head | Signed Git mismatch primitive EXISTING; provider/review enforcement DESIGN / NOT RUN |
| T15 | Use local/caller time, replay signed clock response, roll clock backward, lose time source, or cross approval expiry within uncertainty | Clock adapter rejects without trustworthy bounded observation and monotonic session binding | Fixed-time interval primitive EXISTING; clock source/uncertainty DESIGN / NOT RUN |
| T16 | Substitute approval attachments, a signature for another intent, SSHSIG/enrollment proof, missing signer or malformed Base64 | Trusted human display and domain-specific verification reject; no cross-purpose signature acceptance | Invalid/missing signatures and canonical Base64 EXISTING; signing display/cross-purpose adapter DESIGN / NOT RUN |
| T17 | Raw receipt/policy has duplicate keys, invalid UTF-8/BOM, unknown fields, excessive size/depth or object traps | Raw reader rejects before parse/digest; strict schemas reject extras; no normalization that hides ambiguity | Object/ledger strictness EXISTING; raw receipt reader DESIGN / NOT RUN |
| T18 | A structurally valid ledger references a forged historical receipt, missing policy, fabricated time or later-compromised key | Full-chain auditor rejects/quarantines unverifiable history; no toggling flags or rewriting hashes | Structural/acyclic chain EXISTING; historical crypto/time adapter DESIGN / NOT RUN |
| T19 | Two valid same-base candidates race; operation crashes after WBS update but before receipt consumption; remote ref changes | Future writer permits at most one atomic transition and no partial visible state | DESIGN / NOT RUN; no writer authorized or implemented |
| T20 | Emergency recovery lowers quorum, recovers two people through one custodian, accepts compromised old root, or silently reenrolls | Recovery authority freezes; require pre-ratified independent anchors and full recovery quorum | DESIGN / NOT RUN |
| T21 | Required signers collude and sign malicious but formally valid content | Detection by independent review/audit and role separation; no claim that crypto rejects a valid colluding quorum | Residual risk; exercise audit/alert scenarios DESIGN / NOT RUN; human acceptance required |
| T22 | Treat evidence success, signed docs commit, GitHub review, policy PR merge or environment approval as mutation authority | Boundary rejects elevation; result stays non-authorizing; runtime/Gate 7/release require separate decisions | `mayApply:false` EXISTING; production integration bypass tests DESIGN / NOT RUN |

## Verification strategy

Use disposable in-memory keys, synthetic person records, a mock authority registry/witness, a fake authenticated provider, fixed clocks and temporary Git fixtures only where a later test needs object/CAS behavior. Never query a real enrollment service or issue a production signature. Tests must not read the user's signing agent or real key material. New proposed tests belong to later authorized implementation; this stage specifies them without adding a broker, writer or enrollment tool.

For each boundary, establish a positive synthetic control, change one trust claim at a time, and assert the specific rejection class, unchanged WBS/ledger/runtime bytes, unchanged consumed set and absence of authorizing output. Also combine attacks: malicious PR plus substituted policy/pin, duplicate person plus distinct keys, valid OIDC from wrong workflow, stale revocation plus clock replay. Positive mock integration tests demonstrate contract behavior, not operational deployment assurance. Mark missing adapters **NOT RUN**, not PASS because the scenario was documented.

Offline cryptography tests must exercise real synthetic Ed25519 signatures rather than stubbing every verification result. Mock provider authenticity with a fixture trust anchor and signed/validated responses; separately test TLS/JWT/issuer/claim failure paths in the eventual adapter. Inject time intervals at both edges and uncertainty spanning each edge. Model crash, duplicate delivery and concurrency with deterministic schedules when a future transaction boundary exists. An unavailable external root, registry, clock or API must yield no production authorization even though a pure offline mathematical verification can succeed.

## Residual risks and production blockers

Identity proof can be socially engineered; key possession cannot prove sole human control; valid quorum collusion cannot be cryptographically distinguished from honest agreement. A compromised root/witness or privileged execution host can undermine the design. Mitigation depends on independently administered systems, transparency, hardware custody, operational monitoring, review and explicit human acceptance, not role labels. Availability and recovery complexity are deliberate tradeoffs.

No independent roster, externally pinned production policy, approved clock, protected broker, raw receipt reader, historical signature auditor or atomic writer has been activated here. See the [ratification checklist and route results](../07_verification/STAGE_B2B2_A_RATIFICATION_AND_VERIFICATION.md). Disposition: `B2B2_A_DESIGN_READY_FOR_HUMAN_REVIEW / PRODUCTION_REGISTRATION_BLOCKED`.
