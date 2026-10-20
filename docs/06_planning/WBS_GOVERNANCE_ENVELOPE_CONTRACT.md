# Offline WBS governance-envelope contract — candidate 1.0

Baseline: `5ecf92d1d7bb1a1bb622fd010265eb989113b3a5`. Design direction and this five-file implementation/publication were explicitly authorized by the operator's R14 instruction. Formal attribution to the charter ratifier and operational policy ratification remain pending. This document specifies a **synthetic, offline, unwired, non-applying** candidate.

## Authority and profile boundaries

- Ordinary registration: distinct **Security Officer + Lead Architect** humans.
- Elevated registration: distinct **Security Officer + Lead Architect + Independent Human Approver**. The operator classified the proposed DMK-209–214 registration as elevated for the intended design; none of those tasks is registered or authorized for implementation.
- Governance changes: three independently eligible humans; this candidate models the three named governance responsibilities with separate keys and verified-person assertions in fixtures.
- Recovery: three pre-appointed eligible custodians with independent recovery anchors; recovery is not implemented.
- Gio's combined Project Lead/Security Officer responsibilities count as one person. No individual is appointed, enrolled or verified by a role string or this candidate.

The existing `wbsEvidenceContinuity.ts` still requires exactly two registration roles, SO/LA. The generic v2 verifier can represent three roles, but this candidate **does not add elevated continuity compatibility** or change the DMK-197 runtime quorum. A separately authorized integration is necessary. Old proposals remain immutable dated evidence, not active policy.

## API and results

`verifyOfflineWbsGovernanceEnvelope(raw, policy, context)` accepts unknown inputs, rejects malformed values, and catches validation failures. It has no default trust source, permissive mode, filesystem/network/environment acquisition, signing, enrollment, receipt consumption, current-Git resolution or application path.

Every result contains:

```text
valid: boolean
mode: OFFLINE_CONTRACT_VERIFIED | REJECTED
mayApply: false
operationalAuthority: false
errors: string[]
envelopeSha256?: string
```

The optional digest is emitted only on complete offline success; rejected proofs omit it. Success demonstrates consistency and signatures under **supplied synthetic assertions**, not independently authenticated production authority. `kind:SYNTHETIC_OFFLINE` is a scope label, not proof of where a key/person/time originated. A caller can fabricate a consistent context; the result still grants no authority.

Pure helpers: `canonicalGovernanceJson`, `governanceEnvelopeBytes`, `governanceEnvelopeSigningBytes`, `clockObservationSigningBytes`, `checkpointSigningBytes`, `offlineGovernanceInputDigest`. Serialization helpers throw on invalid/bounded data; they are not verification/authorization APIs. They never sign or generate keys.

## Encoding and signatures

The raw envelope is exactly canonical UTF-8 JSON with no BOM, whitespace outside strings, trailing newline, duplicate decoded object keys or trailing data. The top-level keys are exactly `payload` and `signatures`. Object keys sort by JavaScript UTF-16 order; arrays preserve order; strings/numbers use JSON representation; numbers must be finite. This is the repository's explicit encoding, **not RFC 8785/JCS**. Unsupported fields/schemas and noncanonical byte representations reject rather than normalize an incoming signed document.

Raw framing/depth and duplicate decoded keys are scanned before materializing its object. The canonical serialization must then equal the exact original bytes. Materialized policy/context are separately admitted through a bounded inert-data walk and snapshotted before use. Reject cycles, accessors, hidden/symbol/unsafe properties, sparse/non-JSON arrays, non-plain objects and non-JSON values. This does not sandbox arbitrary JavaScript proxies or Buffer wrappers: callers must provide inert data, and acquisition/allocation before the call is outside the boundary.

Ed25519 signs the exact UTF-8 bytes:

```text
DOCMONSTAKRAKIN/WBS_GOVERNANCE_ENVELOPE/1.0<LF><canonical payload JSON>
```

Sign the message, **not its SHA-256 digest**. SHA-256 of the complete raw envelope identifies the witnessed document; it includes its signatures. Each signature has exactly `principalId`, `role`, `keyId`, `signatureBase64`. Base64 must be the canonical encoding of a 64-byte signature. Exactly three distinct governance roles/principals/people/key fingerprints must sign. Signature array order is retained in the document identity; it may vary if the witness/session are rebound to those exact bytes.

Every `publicKeyPem` must be a single Ed25519 SPKI `BEGIN PUBLIC KEY` block with LF or CRLF line endings. Private-key PEM, certificates, multiple blocks and surrounding text reject; the verifier never derives a public key from supplied private material. Test private keys are ephemeral synthetic fixtures and are never written or logged.

The clock and checkpoint use separate message domains:

```text
DOCMONSTAKRAKIN/WBS_GOVERNANCE_CLOCK/1.0<LF><canonical clock payload>
DOCMONSTAKRAKIN/WBS_GOVERNANCE_CHECKPOINT/1.0<LF><canonical checkpoint payload>
```

Existing `policyDigestV2`, `DOCMONSTAKRAKIN/WBS_REGISTRATION/2.0` and the original canonical receipt/ledger formats are unchanged. The envelope digest never substitutes for the independently supplied v2 policy digest.

## Payload exact fields

| Fields | Candidate grammar and meaning |
| --- | --- |
| `schemaVersion` | Exactly `1.0` |
| `repository`, `repositoryId`, `ownerId` | Repository exactly `Jeruzael/docmonstakrakin`; IDs are nonzero decimal strings, exactly equal to the separately supplied synthetic expected bindings |
| `projectId`, `operation` | Exactly `PRJ-DOCMONSTAKRAKIN`, `ADD_WBS_ITEMS`; this scopes the policy, not an application |
| `profileId`, `requiredRoles` | `ORDINARY` with ordered SO/LA, or `ELEVATED` with ordered SO/LA/IHA; exact policy/profile match |
| `classificationRulesSha256`, `personRegistrySha256` | Lowercase SHA-256 references exactly equal to expected external-record assertions; no real classification or registry is acquired |
| `policyId`, `policyVersion`, `policySha256` | Nonempty bounded identifiers and exact existing v2 digest; no policy self-pin |
| `rootId`, `rootVersion` | Exact supplied root identity/version; root version is a positive safe integer |
| `envelopeId` | Bounded identifier checked against supplied consumed IDs |
| `authorityEpoch`, `previousEnvelopeSha256` | Positive safe epoch and exact predecessor digest; rules below |
| `effectiveNotBefore`, `effectiveNotAfter` | Precise UTC millisecond ISO-8601; full clock uncertainty interval contained inside validity |
| `revocationSequence`, `revocationStateSha256` | Positive safe sequence and expected state digest; floor/predecessor/checkpoint consistency |
| `verifierCommitSha`, `workflowCommitSha` | Lowercase 40-character Git identities exactly matching expected bindings; no ancestry/source acquisition is claimed |
| `ratificationEvidenceSha256` | Expected digest reference; not proof that real ratification occurred |

Identifiers use `[A-Za-z0-9._:-]{1,128}`. SHA-256 values use 64 lowercase hex characters. Times require `YYYY-MM-DDTHH:mm:ss.sssZ` and calendar round-trip equality. Unknown role/profile, Project Lead substitution and risk selection by signature count reject.

`profileId` and `classificationRulesSha256` make the R14 proposed per-profile binding concrete. They are external envelope fields, never additions to the v2 intent/policy schema.

## Synthetic context exact fields

`kind`, `expected`, `root`, `registrationPeople`, `witness`, `clock`, `fixedNowIso`, `sessionNonce`, `minimumAuthorityEpoch`, `minimumRevocationSequence`, `minimumCheckpointSequence`, `minimumClockSequence`, `consumedEnvelopeIds`, `consumedNonces`, `previous`, `checkpoint`, `clockObservation`.

- `kind` is exactly `SYNTHETIC_OFFLINE`. `expected` contains the payload repository/owner/project/operation/profile/classifier/registry/policy/revocation/source/ratification bindings listed in the source `EXPECTED` constant. Pins never come from the envelope itself or environment fallback.
- `root` has `rootId`, `rootVersion`, `keys`. Exactly three key records: `principalId`, `personId`, `role`, `keyId`, `publicKeyPem`, `revoked`, `eligible`, `conflicted`, `custodySeparated`, `validNotBefore`, `validNotAfter`. Required roles are SO/LA/IHA. Real independent person/custody claims remain external prerequisites; fixtures only exercise their enforcement once supplied.
- `registrationPeople`: one record per active registration key, with `principalId`, `personId`, `eligible`, `conflicted`, `custodySeparated`. IDs must be distinct; no unused person may disguise two policy keys with the same principal. Eligible must be true, conflicted false and custodySeparated true. This does not prove those claims outside the fixture.
- `witness`: `keyId`, `personId`, `publicKeyPem`; the person must differ from every governance-root person. `clock`: `keyId`, `publicKeyPem`. Ed25519 key fingerprints are normalized from SPKI DER; governance, registration, witness and clock keys cannot reuse key material across purposes. The same legitimately appointed person may have separate governance/registration keys; the required people within each quorum remain distinct.
- `fixedNowIso` is an explicit fixed fixture clock. `sessionNonce` is 64 lowercase hex characters. Replay arrays are unique valid identifiers/nonces; all floors are positive safe integers.
- `previous` is null for genesis, otherwise exactly `envelopeSha256`, `authorityEpoch`, `policySha256`, `policyVersion`, `revocationSequence`, `rootId`, `rootVersion`.
- `checkpoint` and `clockObservation` each have exactly `payload`, `signatureBase64`. Their keys are separately supplied pins, not embedded certificate chains.

The v2 policy has its unchanged exact fields. This candidate narrows acceptance to **one active key per required role** and a complete one-to-one fixture person mapping. Expired/revoked keys or extra/duplicate roles/principals/key IDs/fingerprints reject. Larger candidate rosters/overlapping rotation require a separately reviewed contract; this is not generic N-of-M support.

Registry/classifier/revocation/ratification SHA values are checked against the supplied expected assertions, **not independently resolved external records**. The session binding includes the entire supplied context and policy digest. Real person enrollment, historical compromise adjudication and root ownership are not established by these equality checks.

## Epoch, replay, witness and clock

Genesis requires epoch 1, root version 1 and an all-zero predecessor digest, under an explicitly supplied synthetic root. There is no trust-on-first-use or automatic root creation. Later issuance requires exactly previous epoch +1, exact predecessor digest, changed policy version **and** changed policy digest, nondecreasing revocation and the same root identity/version. Routine freshness refresh uses a new signed observation/checkpoint, not a changed policy epoch.

**Root rotation is conservatively unsupported:** every changed predecessor root/version rejects, including new-root-only signatures. No positive old/new-root rotation protocol or recovery engine is implemented by this slice.

The input binding is SHA-256 of canonical `{envelopeSha256, policySha256, context}`, where context excludes only checkpoint/clockObservation to avoid circularity. It includes pins, expected records, person mapping, prior state, floors, session nonce and fixed evaluation time. Each signed checkpoint/clock observation must carry that digest and the exact session nonce.

Clock payload fields: `schemaVersion`, `sessionNonce`, `inputsSha256`, `nowIso`, `validUntilIso`, `uncertaintyMs`, `sequence`. The observation's signature, sequence floor and full uncertainty containment must hold.

Checkpoint payload fields: `schemaVersion`, `sessionNonce`, `inputsSha256`, `envelopeSha256`, `authorityEpoch`, `revocationSequence`, `sequence`, `observedAt`, `validUntilIso`. Its independent signature, floor, exact envelope/epoch/revocation binding and uncertainty containment must hold.

Replay refusal depends on the supplied consumed-ID/nonce lists and sequence floors. **This verifier does not consume or persist anything.** Repeating the same valid call against unchanged fixture state is deterministically valid and still non-authorizing; a fixture updated to mark the ID/nonce consumed rejects. No claim of durable replay prevention, current-revocation fencing or production clock acquisition follows.

## Candidate admission and compatibility limits

Raw envelope, each materialized policy and context, and helper canonical binding JSON are individually capped at **2 MiB** and container depth **64**. Identifier length is 128. The fixed governance set has three keys/signatures; registration sets have exactly two/three keys. Clock window ≤60 seconds, checkpoint window ≤300 seconds, uncertainty 0–2,000 ms. These fixed candidate limits have no caller override.

These are proposed **offline compatibility constraints for review**, not ratified operational budgets or proof of total memory/latency. Context near its own byte cap can fail the derived binding JSON cap; no truncation occurs. Allocator overhead, raw acquisition, arbitrary proxies and concurrent/worst-case production work are outside the measured boundary. The old PR54 benchmark evidence is preserved and not reinterpreted.

## Rollback and next gate

An authorized code-only revert/disable of this unwired candidate preserves every operational artifact. No root, policy pin, WBS, ledger or receipt is modified or needs rollback. After any future operational activation, freeze and preserve history/high-water marks, then obtain separate incident/compatibility authorization; never erase consumption, lower quorum or restore old WBS/genesis to make verification pass.

See [acceptance cases](../04_security/WBS_GOVERNANCE_ENVELOPE_ACCEPTANCE.md) and [candidate evidence/authorization](../07_verification/WBS_GOVERNANCE_ENVELOPE_CANDIDATE.md). Stop at independent review and a separate operator merge decision. Production acquisition, actual human authority, descendant support, atomic application, WBS registration and S2-A remain separate blocked gates.
