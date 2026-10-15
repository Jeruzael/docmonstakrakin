# Gate 3 — Corrected Security Assessment

**Target:** PR #36 / Stage B1, historical snapshot and forward WBS verifier  
**Baseline reviewed:** `ed02373df53284f3780c1f84cdb9899e2b33eb26`  
**Provenance:** Codex agent-produced assessment, independently cross-checked against repository implementation; agent review is not authenticated human sign-off  
**Disposition:** `GATE3_TECHNICAL_ASSESSMENT_CONDITIONAL_PASS / HUMAN_GOVERNANCE_PENDING`

## Evidence and verdict

Remote GitHub Actions [run 38651819680](https://github.com/Jeruzael/docmonstakrakin/actions/runs/38651819680) for the original PR head succeeded: 58/58 regression suites and 1,348/1,348 checks; registration verifier 11/11 and forward-evidence adapter 9/9. Agent separately reported 27 defensive tests and four vulnerability demonstrations executed on Windows. The portable source is `scripts/testGate3Adversarial.ts`; the historical agent-produced log is archived separately. Reproduce on the updated PR head before treating its results as CI-verified.

## Established protections

- Exact SHA-256 binding of historical and proposed WBS file bytes.
- Ed25519 verification of a signed canonical manifest against **supplied** public keys.
- Rejection of tampered WBS items, duplicate paths/IDs, invalid signatures, absent quorum, and revoked signer records when marked as such by the supplied trust policy.
- Pure read-only adapter; no authority to write canonical files, execute a release, or reconcile runtime state.

## Four reproduced limitations

1. **P1: Unanchored trust policy.** A caller can supply their own trustedPolicy, matching rogue keys and valid signatures; the low-level validator accepts them. A signature proves possession of a private key, not that an authorized human enrolled it.
2. **P1: Inadequate signer independence.** Two identities pointing to one public key/private key can satisfy distinct role-string slots. Uniqueness requires normalized public-key fingerprint checks AND separately established distinct human principal identities.
3. **P1: Replay context absent.** The signed manifest binds raw WBS hashes, operation, project and policy ID/version, but not a reviewed Git tree or commit, PR identity, temporal validity, nonce or consumed receipt. Identical-byte authorization can be replayed in another context.
4. **P1: Policy contents unbound.** Policy requiredRoles and trusted keys can be altered without changing policyId/policyVersion. The manifest does not pin a digest of the full ratified policy.

Passing the four weakness reproductions means these weaknesses are **confirmed**, not fixed. Do not interpret `FORWARD_APPROVED` as production authorization until Stage B2 establishes the trust root and independently validates receipt provenance.

## Human review conditions

- Ratify the WBS registration approver roles under the applicable governance policy; test fixtures do not confer real authority.
- Require authenticated signer enrollment, independently controlled keys, revocation validity, policy immutability, anti-replay rules and historical verifier compatibility in Stage B2.
- Record Security Officer and Lead Architect human decisions separately when required by the ratified policy. An AI review is technical evidence only.

**Stage B1 conditional acceptance does not approve PR #34, live synchronization, Gate 7 or release promotion.**
