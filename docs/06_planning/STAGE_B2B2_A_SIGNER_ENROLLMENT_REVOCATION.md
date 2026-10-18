# Stage B2b2-A signing-key enrollment and revocation specification

Status: **PROPOSED — PENDING HUMAN RATIFICATION; NO LIVE ENROLLMENT**

Date: 2026-10-18

Baseline: `2d7ebfbdb9f500b4b7670a721d97ddd49bc3a68f`

Related: [ADR-0007](../05_decisions/ADR/ADR-0007-wbs-trust-and-human-identity.md), [role/quorum candidate](STAGE_B2B2_A_HUMAN_APPROVAL_POLICY_CANDIDATE.md)

## Identity before cryptography

Ed25519 proves control of signing material, not legal identity, sole custody, human presence or independence. The algorithm is specified in [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.html). The proposed enrollment process must establish those external facts before a public key becomes eligible. GitHub account ownership and an SSH-signed Git commit are useful account/provenance evidence only. They do not enroll the operator as a WBS signer or prove a second human exists.

Each actual human receives one stable person identifier in an externally administered registry. Link all known account aliases, principal IDs and signing keys to that person. Two independent enrollment verifiers authenticate the person through pre-established out-of-band contact and a live identity ceremony using the human-ratified evidence standard. Neither verifier may be the applicant; neither may independently create both verifier records. Repeated applications and changed names/accounts must be reconciled against existing records before approval. An unresolved possible duplicate, proxy applicant or shared custody blocks enrollment. Claimed distinct principal strings cannot override a known person match.

The identity evidence standard and acceptable independence checks remain unresolved. Proposed evidence includes an established organizational identity, independently confirmed contact, live comparison to an authorized identity record, consent and relationship/conflict declarations. Do not publish identity documents, personal contact data, biometrics, private keys or sensitive recovery details in Git. Retain restricted evidence under a separately ratified access/retention policy; publish only opaque evidence references, decision digests and non-sensitive public-key metadata. A fabricated or automatically generated enrollment record is not an acceptable substitute.

## Proposed enrollment ceremony

1. **Request and scope.** An accountable human requests the exact project, responsibility, signing purpose and validity interval. Check the external person registry for aliases, previous keys, suspensions and conflicts. No self-appointment from a role string or GitHub permission.
2. **Identity and independence.** Two independent verifiers conduct out-of-band verification and record evidence, consent, person mapping, custody relationships and conflicts. Root bootstrap uses the separate charter-ratified ceremony in ADR-0007; it cannot be recursively certified by an untrusted registry.
3. **Human-controlled key generation.** The human creates a dedicated Ed25519 WBS signing key on a ratified custody device. No key generation by an AI agent, CI job or shared service for a human identity. Export only the public key. Verify algorithm, encoding and SHA-256 fingerprint of normalized SPKI DER using independent displays/channels. PEM formatting changes must not create a different identity.
4. **Proof of possession.** The enrollment service issues a single-use random 256-bit nonce with purpose, version, person ID, project, requested role, key fingerprint, enrollment-request digest, issuer and expiry. The human independently checks the displayed request and signs a domain-separated enrollment challenge. A proposed domain is `DOCMONSTAKRAKIN/HUMAN_KEY_ENROLLMENT/1.0`; its encoding/schema and precise payload require ratification. It is deliberately incompatible with the WBS registration domain and with SSHSIG. No production challenge or signature is created here.
5. **Validate and approve.** Verify challenge signature, issuer, purpose, fingerprint, nonce freshness/consumption and request binding. Possession proof cannot compensate for failed identity or custody checks. Apply the role-granting critical-change quorum, excluding the beneficiary. Record separate identity-verifier and governance approval evidence.
6. **Publish and activate.** Add the approved record to a new authenticated registry/policy epoch with an independently witnessed checkpoint. Confirm protected consumers have the intended pin and revocation high-water mark. Activation is explicit and cannot precede the ratified effective time. No silent approval by timeout, PR merge or registry write.

Proposed public enrollment record fields are: stable person ID, mapped v2 principal ID, role/scope, immutable account IDs and aliases where needed, key ID and SPKI fingerprint, Ed25519 SPKI public key, effective/expiry times, custody attestation reference, identity/independence decision references, possession-proof reference, authorizing policy/root epoch and status/revocation reference. This is an **external registry schema proposal**, not an extension to `HumanKeyV2`. It contains no actual enrolled person or key in this package.

The mapping into v2 is explicit: registry principal maps to `principalId`; appointed responsibility to `role`; approved key to `keyId` and `publicKeyPem`; eligibility is checked before setting `kind:HUMAN`; active intervals map to `validNotBefore` / `validNotAfter`; revocation maps to `revoked`. The adapter must reject duplicate-person quorum even if two different principal strings and two valid signatures pass the pure verifier. Changing the adapter's person mapping requires R3 governance review, not a receipt field.

## Private-key custody and signing

Proposed production custody uses a non-exportable hardware-backed Ed25519 key with per-operation human presence and a trusted confirmation display/client. Device support and recovery feasibility are blockers to confirm. If a software key is proposed instead, humans must approve the alternative's threat model and isolation before enrollment; it is not an automatic fallback.

No WBS private key, unlock secret, recovery secret or signing agent is exposed to repository processes, CI, AI tools, shared shells, remote session forwarding or general-purpose automation. A client may present unsigned candidate data to a human; it cannot authorize signing unattended. Separate WBS registration keys from SSH transport/Git signing, governance-root keys, workflow identities and recovery anchors. A requested SSH-signed documentation commit uses existing Git provenance credentials only and has no WBS-approval meaning.

Each signing ceremony displays the exact operation and its full reviewed context as specified in the policy candidate. The client independently checks policy/root freshness and computes the signed payload from the inspected data. Require explicit human confirmation of the final payload; reject blind hash-only requests, substituted attachments and opaque agent-supplied prompts. No cached confirmation across changed intents. Keep an audit reference to what the human approved without recording secrets.

## Lifecycle, revocation and recovery

| State / event | Proposed rule | Evidence and fail-closed behavior |
| --- | --- | --- |
| Requested / identity pending | Ineligible for signing | Missing verification or ambiguous person mapping blocks |
| Possession proven / governance pending | Still ineligible | A valid challenge alone grants no authority |
| Active | Eligible only within exact scope, interval, current policy, custody and independence conditions | Evaluate every signing operation against the active epoch |
| Expiry / renewal | No implicit extension; renew identity/role/custody checks and possession proof | Expired keys reject; outage never extends validity |
| Planned rotation | New key stays under the same stable person ID; old key retires explicitly | No extra quorum vote; preserve old public records and evidence |
| Suspected compromise / suspension | Freeze affected authority immediately; invalidate pending use | Record report time, earliest suspected compromise time, reason and checkpoint; unresolved scope may freeze all registration |
| Revocation | Monotonic, authenticated registry event; terminal for that key enrollment | Reject new use, even a receipt signed earlier but not yet consumed; preserve historical artifacts |
| Lost device / recovery | Re-verify identity and custody; enroll a new key through critical-change/recovery quorum | Do not reconstruct another person's private key or reuse an old key ID to hide replacement |
| Root compromise | Freeze authorizations; use independent pre-ratified recovery anchors | Old compromised root alone cannot authorize replacement; no anchors means blocked |

An authenticated revocation event binds person/key/fingerprint, effective time, reason class, reporter, authorized decision, monotonic sequence and previous checkpoint. Unauthorized reports may trigger investigation/deny-only quarantine, but cannot enroll replacements or reopen access. Recovery requires the separately verified humans and checks in the policy candidate. Shared recovery mechanisms that permit one human to control multiple quorum keys disqualify those keys.

Distribution must prevent a revoked key being accepted through stale caches. Proposed five-minute checkpoint age is an upper bound, **not a five-minute grace period after effective revocation**. A future authorizer/consumer needs authoritative checkpoint revalidation and an epoch fence at the operation boundary. Race semantics, outage handling and propagation tests are production blockers. A later stage must prove the fence; this document does not claim a network fetch by itself makes use atomic with revocation.

V2 validates the validity interval of every policy key, even unused entries, and rejects duplicate principal/role records. Therefore a production-compatible active v2 policy must avoid overlapping records for the same principal/role and expired unused keys. Planned rotation publishes a new policy epoch selecting the new active key, invalidates pending receipts under the retired epoch, and retains old policy snapshots separately. Never mutate old snapshots to make present-day validation pass. A different overlapping-rotation scheme needs a versioned verifier change and separate review.

## Historical verification without retrospective authorization

Distinguish **eligibility for a new operation now** from **evidence that a historical operation was authorized then**. For new operations, currently revoked or suspended keys reject regardless of the receipt's asserted signing date. For historical audit, the future versioned adapter must use immutable historical policy, registry and revocation events plus independently anchored receipt-consumption/time evidence. A self-reported `notBefore`, Git author date or newly generated timestamp is insufficient proof of signing before compromise.

Known compromise windows require explicit human adjudication: quarantine affected historical conclusions if the earliest compromise time is uncertain; mark evidence unverifiable rather than inventing a clean timestamp. Preserve receipts and bootstrap evidence byte-for-byte, including known procedural noncompliance. Audit classifications do not retroactively grant missing approval. Never toggle `revoked:false` in a historical fixture or regenerate expected hashes to obtain a pass. Full-chain signature verification and historical adapters remain B2b2-B work.

## Audit requirements and completion gate

Retain enrollment, denial, renewal, role change, rotation, revocation and recovery events in the authenticated append-only authority log, with actor/person IDs, policy epochs, evidence references, reason and trusted time. Separate administrators from approvers; require independent witness checkpoints and periodic reconciliation against protected consumer pins. Detect deletion, forked logs, sequence rollback, alias duplication and unauthorized admin access. Retention duration, privacy controls, custody device, witness service and actual personnel remain human decisions.

No enrollment, revocation, recovery or signing ceremony has been performed for this design. Its [negative test strategy and human ratification checklist](../07_verification/STAGE_B2B2_A_RATIFICATION_AND_VERIFICATION.md) are prerequisites to later implementation. Disposition: `B2B2_A_DESIGN_READY_FOR_HUMAN_REVIEW / PRODUCTION_REGISTRATION_BLOCKED`.
