# Stage B2a — Trusted WBS Registration Evidence Contract

**Status:** IMPLEMENTATION CANDIDATE / CI & INDEPENDENT REVIEW PENDING  
**Source baseline:** PR #36 merged master `ecada4aede13726160f361b3e0a4eb9ad0771b8e`  
**Scope:** Standalone **verification-only** contract, no live approvals or mutations.

## Threat model and current boundary

The merged Stage A/B1 code correctly documented four production weaknesses: caller-supplied policy substitution; a single signing key presented as two people; signed-manifest replay with identical WBS bytes; and mutable policy membership without a policy-content digest. The original v1 functions and historical evidence have not been changed. Their v1 approval verdict must **not** be used as production sign-off.

This Stage B2a candidate adds `scripts/verifyTrustedWbsRegistrationV2.ts`, a new **fail-closed pure verifier**, and `scripts/testTrustedWbsRegistrationV2.ts`. The v2 contract binds the exact pre/post raw WBS bytes, every newly added PROPOSED task, an exact ratified-policy SHA-256, a reviewed Git repository/PR/base commit/head commit/head tree, time-bounded validity, and an operation-specific receipt ID. It validates Ed25519 signatures with SPKI-DER-normalized public-key fingerprints, distinct principal IDs, current key expiry and revocation flags, and receipt-consumption state.

Importantly, a `valid: true / EVIDENCE_VERIFIED` result is **not** authority to apply the WBS: every result returns `mayApply: false`.

## Mandatory external production requirements (not completed Stage B2a capabilities)

The `TrustedVerificationContextV2` fields represent **external operational prerequisites** that must be supplied by an authenticated, protected production environment in Stage B2b. They are **not** capabilities provided by the Stage B2a pure verification library:

1. **Independent Policy Anchoring (`pinnedPolicySha256`):** The policy digest must be pinned out-of-band in protected repository settings, deployment environment secrets, or protected branch configuration. It must NEVER be accepted from the pull request, unauthenticated workflow dispatch inputs, or the signed receipt itself.
2. **Authentic Git Provenance (`expectedGit`):** Repository identity, PR number, base commit SHA, reviewed head commit SHA, and reviewed head tree SHA must be extracted directly from authenticated GitHub Actions runner event contexts (`github.event.pull_request.*`), never from user-supplied parameters.
3. **Out-of-Band Human Key Enrollment:** Cryptographic public-key uniqueness is necessary but insufficient to prove independent human signers. Physical human identities, employment standing, and role authorization must be authenticated out-of-band before keys are ratified in policy.
4. **Authoritative NTP Clock (`nowIso`):** System timestamps must be obtained from an authenticated, NTP-synchronized GitHub runner clock, never from client-controlled environment variables or receipt claims.
5. **Atomic Receipt Consumption Ledger (`consumedReceiptIds`):** Pure in-memory verification does not consume receipts. Stage B2b must supply an authoritative, append-only ledger transaction engine.

## Replay prevention, CAS ledger consumption, and concurrent registration design

The Stage B2a verifier evaluates receipt validity against a static snapshot of `consumedReceiptIds`, returning `mayApply: false`. To eliminate replay vulnerabilities in production, Stage B2b must implement the following transaction model:

1. **Atomic Compare-And-Swap (CAS) Receipt Consumption:**
   When an authorized workflow applies a verified registration, it must execute a CAS operation against an append-only ledger file (`docs/00_control/consumed_wbs_receipts.json`):
   - Assert `receiptId` is not present in the current ledger.
   - Append the new `receiptId`, registration timestamp, and commit metadata.
   - Commit both the updated ledger and the updated `MASTER_WBS.yaml` in the exact same atomic Git commit or transactional push.
   - If a race or duplicate is detected, the CAS fails and the registration aborts fail-closed.

2. **Concurrent-Registration Conflict Handling:**
   Every signed registration intent explicitly binds `preWbsSha256` (the exact SHA-256 digest of `MASTER_WBS.yaml` before changes) and `postWbsSha256` (the exact SHA-256 digest after changes):
   - If two pull requests attempt concurrent registration, both will reference the same `preWbsSha256`.
   - The first PR to merge updates `MASTER_WBS.yaml` on `master`, altering the canonical `preWbsSha256` digest.
   - When the second PR attempts verification or merge, its signed `preWbsSha256` will no longer match the current `master` baseline bytes, triggering an immediate `PRE_WBS_STATE_MISMATCH` rejection.
   - The second PR must rebase, re-review the code diff, and obtain fresh dual-signature approvals against the updated baseline. This guarantees strict sequential serialization and eliminates race conditions.

3. **Independent Post-Application Verification:**
   After merge, an automated CI post-application hook must independently read the newly committed `MASTER_WBS.yaml` from disk, compute its SHA-256 digest, and assert that it matches `intent.postWbsSha256` byte-for-byte. This attests that the applied canonical state is identical to the reviewed candidate without merge skew or unreviewed file mutations.

## Remaining Stage B2b gates

- Ratify human approver roles and credential enrollment; implement authenticated, revocable policy registry and independently anchored trust root.
- Implement an atomic/idempotent approval receipt ledger with authenticated Git provenance, replay prevention, audit trail, clock enforcement and signing-key custody.
- Wire the production caller so it cannot pass arbitrary supposedly trusted context; enforce trusted service boundary and fail-closed refusal to register without it.
- Introduce immutable historical 27-item verifier fixtures with separate approval for the exact six-item forward registration; do **not** modify historical DMK-196/197/208 receipts or silently weaken tests.
- Reconcile the UI's current authorized operational scope only after the forward registration has separately passed security governance and full CI.
- Keep `MASTER_WBS.yaml`, PR #34, `.local/project-state.json`, Gate 7 and release status unchanged. Live runtime reconciliation requires another explicit approved candidate.

## Security and test evidence

Run `npx tsx scripts/testTrustedWbsRegistrationV2.ts` and all three GitHub CI jobs. The new test uses synthetic ephemeral Ed25519 keys and must not be interpreted as an approval by real humans. The historical `scripts/testGate3Adversarial.ts` characterizes v1 weaknesses on purpose and must continue to run unchanged.

**Merge policy:** A green Stage B2a PR merges an independent verifier foundation only; it must **not** unblock PR #34 or permit runtime mutation.
