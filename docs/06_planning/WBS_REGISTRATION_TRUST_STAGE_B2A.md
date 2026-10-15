# Stage B2a — Trusted WBS Registration Evidence Contract

**Status:** IMPLEMENTATION CANDIDATE / CI & INDEPENDENT REVIEW PENDING  
**Source baseline:** PR #36 merged master `ecada4aede13726160f361b3e0a4eb9ad0771b8e`  
**Scope:** Standalone **verification-only** contract, no live approvals or mutations.

## Threat model and current boundary

The merged Stage A/B1 code correctly documented four production weaknesses: caller-supplied policy substitution; a single signing key presented as two people; signed-manifest replay with identical WBS bytes; and mutable policy membership without a policy-content digest. The original v1 functions and historical evidence have not been changed. Their v1 approval verdict must **not** be used as production sign-off.

This Stage B2a candidate adds `scripts/verifyTrustedWbsRegistrationV2.ts`, a new **fail-closed pure verifier**, and `scripts/testTrustedWbsRegistrationV2.ts`. The v2 contract binds the exact pre/post raw WBS bytes, every newly added PROPOSED task, an exact ratified-policy SHA-256, a reviewed Git repository/PR/base commit/head commit/head tree, time-bounded validity, and an operation-specific receipt ID. It validates Ed25519 signatures with SPKI-DER-normalized public-key fingerprints, distinct principal IDs, current key expiry and revocation flags, and receipt-consumption state.

Importantly, a `valid: true / EVIDENCE_VERIFIED` result is **not** authority to apply the WBS: every result returns `mayApply: false`.

## Mandatory independent trust provisioning (not implemented or fabricated)

The `TrustedVerificationContextV2` fields **must** come from separately trusted channels, not the PR or the receipt being verified:

1. `pinnedPolicySha256`: previously ratified and independently protected policy digest; do not accept a SHA stored only alongside modifiable policy/WBS changes.
2. `expectedGit`: independently retrieved Git-provider provenance and reviewed candidate tree. No approval may create its own trusted Git context.
3. `nowIso`: trusted clock.
4. `consumedReceiptIds`: integrity-protected authoritative consumption ledger.

**These remain interfaces, not production trust-store implementations.** Passing self-generated synthetic test policy keys is evidence of algorithm behavior, **not** human verification or authentic approvals. Public-key uniqueness is necessary but not sufficient for proof of independent human principals.

## Replay-safe commit binding without self-reference

The v2 signed intent binds a stable reviewed Git base/head/tree and exact WBS hashes **before** receipts are appended. The receipt-containing merge commit cannot itself be part of that signature without circular reference. Stage B2b must separately attest, using independently trusted Git provenance, that the resulting merge points to the exact reviewed candidate and original receipt. Timestamp validation alone does not prevent repeated use within validity; the ledger must perform atomic consume/idempotent registration under separate authorized change control.

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
