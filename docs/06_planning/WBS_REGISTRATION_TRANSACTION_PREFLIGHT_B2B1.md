# Stage B2b1 — Fail-Closed WBS Registration Transaction Preflight

**Status:** Candidate, read-only; CI and independent review pending  
**Master baseline:** `ab6c1da2731da3290ee7f52fccf8272fc2f031ae` (post PR #37)  
**Related:** PR #34 six proposed tasks, PR #36 historical archive, PR #37 evidence-verification foundation

## Scope

`scripts/planWbsRegistrationTransaction.ts` is a **pure read-only preflight helper** for canonical WBS updates and a versioned receipt-consumption ledger. It verifies an independently pinned current WBS digest and ledger digest, a byte-exact historical genesis, connected receipt state, uniqueness of consumed receipt IDs, the signed v2 manifest and its independently trusted validation context, and produces deterministic proposed ledger bytes and SHA-256.

This helper returns `mayApply: false` **unconditionally**, even when `valid: true`. It does not write files, change Git refs, enroll human identities, create signing keys, register tasks, or consume receipts.

## Security controls exercised by tests

- Reject mismatched protected WBS or ledger digests, stale baselines and malformed or disconnected receipt chains.
- Reject noncanonical ledger bytes, duplicate JSON keys and duplicated consumed receipt IDs.
- Require independently provided authenticated evidence context and exact before/after WBS bytes.
- Verify historical genesis SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`.
- Preserve `mayApply: false` and ensure no modifications to historical receipts or canonical WBS.

Tests use generated **synthetic** Ed25519 test-only keys, not enrolled production human signers.

## Stage B2b still blocked by unimplemented production security

1. **Trust provenance:** Ratify an independent policy anchor, required approver roles, per-human identity enrollment and key custody/revocation. A hash in the same editable PR is not independent.
2. **Trusted Git event binding:** Independently prove reviewed tree/ref/PR provenance and distinguish reviewed pre-receipt head from resulting merge attestation.
3. **Atomic application:** Implement and test compare-and-swap commit of WBS plus ledger against protected branch head with collision/retry handling, immutable receipt evidence and auditable decision provenance.
4. **Replay lifecycle:** Explicitly establish idempotence versus rejected replay, expiry, protected clock source, and post-merge SHA continuity.
5. **Historical verifier compatibility:** Continue verifying DMK-196, DMK-197 and DMK-208 receipts against their pinned historical snapshots. Do not replace 27-item historical expectations with current live scope or change historical receipts.
6. **Scope registration:** Reconcile exactly six proposed items (DMK-209..214) only with approved versioned receipts, refreshed PR #34 candidate, 33-item forward UI expectations, full regression and separate human merge decision.
7. **Runtime reconciliation:** Local WorkItems and `.local/project-state.json` must not change on WBS commit; require a distinct read-only preview and approved live apply.

## Important consistency notes

This preflight ledger schema is a proposal, not an applied register. No authoritative `consumed_wbs_receipts.json` exists or is modified by this PR. The canonical genesis is generated **in memory only**. The preflight accepts independently trusted inputs by contract but does not establish that provenance itself. Before production integration, implement an authenticated service boundary and commit both ledger and WBS in a **single conditional transaction**.

**No PR #34 merge, Gate 7, release, receipt approval or runtime mutation authorized here.**
