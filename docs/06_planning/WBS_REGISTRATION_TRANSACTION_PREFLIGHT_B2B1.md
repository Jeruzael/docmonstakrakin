# Stage B2b1 — Fail-Closed WBS Registration Transaction Preflight

**Status:** Candidate, read-only; CI and independent review pending  
**Master baseline:** `ab6c1da2731da3290ee7f52fccf8272fc2f031ae` (post PR #37)  
**Related:** PR #34 six proposed tasks, PR #36 historical archive, PR #37 evidence-verification foundation

## Scope

`scripts/planWbsRegistrationTransaction.ts` is a **pure read-only preflight helper** for canonical WBS updates and a versioned receipt-consumption ledger. It verifies an independently pinned current WBS digest and ledger digest, a byte-exact historical genesis, connected receipt state, uniqueness of consumed receipt IDs, the signed v2 manifest and its independently trusted validation context, and produces deterministic proposed ledger bytes and SHA-256.

This helper returns `mayApply: false` **unconditionally**, even when `valid: true`. It does not write files, change Git refs, enroll human identities, create signing keys, register tasks, or consume receipts.

## Deterministic Canonical Signed-Receipt Contract (`DOCMONSTAKRAKIN/WBS_SIGNED_RECEIPT/2.0`)

Before computing `signedReceiptSha256` or calling the Stage B2a evidence verifier, `validateAndNormalizeSignedReceiptV2()` and `canonicalSignedReceiptPayloadV2()` enforce a strict, fail-closed schema and serialization contract:

1. **Strict Schema & Reject-on-Unexpected-Fields:**
   - Top-level `receipt` must be a plain JSON object (`Object.prototype` or `null` prototype, zero symbol properties) with **exact keys** `["intent", "signatures"]`.
   - `receipt.intent` must be a plain JSON object with **exact keys** `["approvedItems", "git", "notAfter", "notBefore", "operation", "policyId", "policySha256", "policyVersion", "postWbsSha256", "preWbsSha256", "projectId", "receiptId", "schemaVersion"]`.
   - `receipt.intent.git` (and `trustedContext.expectedGit`) must be a plain JSON object with **exact keys** `["baseCommitSha", "pullRequestNumber", "repository", "reviewedHeadCommitSha", "reviewedHeadTreeSha"]`.
   - Each element of `receipt.signatures` must be a plain JSON object with **exact keys** `["keyId", "kind", "principalId", "role", "signatureBase64"]`, where `signatureBase64` is a canonical 64-byte RFC 4648 Base64 string (`/^[A-Za-z0-9+/]{86}==$/`).
   - Any unexpected property, missing property, unsafe key (`__proto__`, `prototype`, `constructor`, `toJSON`), cyclic reference, throwing getter, or non-JSON runtime value (`BigInt`, `NaN`, `Infinity`, `undefined`, `Function`, `Symbol`, non-plain prototype) fails closed and returns a structured `REJECTED` result (`valid: false`, `mode: "REJECTED"`, `mayApply: false`).
2. **Deterministic Normalization & Versioned Domain Prefix:**
   - Object keys at every level of `intent` (including `approvedItems` objects) and `signatures` are sorted lexicographically by UTF-16 code units.
   - `signatures` array entries are sorted deterministically by `(role, principalId, keyId, signatureBase64)`.
   - The canonical receipt payload is serialized as:
     ```text
     DOCMONSTAKRAKIN/WBS_SIGNED_RECEIPT/2.0\n<canonical-json(normalizedReceipt)>
     ```
   - `signedReceiptSha256` is the lowercase hex SHA-256 of those UTF-8 bytes (`signedReceiptDigestV2(receipt)`), guaranteeing that semantically equivalent valid receipts always produce identical `signedReceiptSha256` and identical `proposedLedgerBytes`.

## Strict Versioned Canonical Ledger Schema (`WbsReceiptLedgerV1`, `schemaVersion: "1.0"`)

`parseLedger()` and `serializeWbsReceiptLedger()` enforce an unambiguous, byte-exact schema:

- **Top-level object:** Plain JSON object with exact keys in canonical order:
  `["schemaVersion", "projectId", "genesisWbsSha256", "entries"]`.
- **Entry objects:** Plain JSON objects with exact keys in canonical order:
  `["receiptId", "preWbsSha256", "postWbsSha256", "policySha256", "signedIntentSha256", "signedReceiptSha256", "reviewedHeadCommitSha", "reviewedHeadTreeSha", "pullRequestNumber"]`.
- **Chain & Formatting Invariants:** Any unexpected top-level or per-entry property, non-canonical field order, duplicate JSON key, non-2-space-indented formatting, duplicate `receiptId`, or disconnected `preWbsSha256 -> postWbsSha256` chain from `HISTORICAL_WBS_SHA256` (`53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`) is rejected.

## Prior-Receipt Evidence Boundary & Historical Signature Retention

> **Critical Security Boundary:** Validating ledger entry hash formats (`SHA-256` / `GIT_SHA`), receipt ID uniqueness, and WBS digest continuity (`preWbsSha256 -> postWbsSha256` starting at `HISTORICAL_WBS_SHA256`) in `parseLedger()` verifies **structural chain continuity only**. It **does not** independently reverify the historical Ed25519 human signatures, ratified policy trust roots, or item-level WBS diffs of prior ledger entries, because the compact ledger stores digests (`signedReceiptSha256`, `signedIntentSha256`, `policySha256`) rather than full historical receipt payloads and WBS snapshots.

To close this boundary in production, **Stage B2b** must implement the following retention and authentication model:

1. **Immutable Signed-Receipt & Policy Archive:**
   - Every committed WBS registration transaction must atomically persist the canonical signed receipt artifact (`docs/07_verification/wbs-registration-receipts/<receiptId>.json`) alongside the updated `MASTER_WBS.yaml` and `docs/00_control/consumed_wbs_receipts.json` ledger in the same compare-and-swap (CAS) commit.
   - Each retained receipt file must hash to the ledger entry's `signedReceiptSha256` (`signedReceiptDigestV2(receipt) === entry.signedReceiptSha256`), and its `intent` signing payload must hash to `entry.signedIntentSha256`.
2. **Independent Historical Signature Reverification:**
   - Stage B2b full-chain audit verifiers must iterate through every entry in `consumed_wbs_receipts.json`, load the retained `<receiptId>.json`, resolve the ratified policy snapshot anchored by `entry.policySha256` from the protected governance registry, and re-execute `verifyTrustedWbsRegistrationV2` (including Ed25519 signature verification over `registrationSigningPayloadV2(intent)`) across the full historical chain from `HISTORICAL_WBS_SHA256` to the current `MASTER_WBS.yaml`.
   - Any ledger entry whose underlying signed receipt artifact is missing, tampered with (`signedReceiptDigestV2(receipt) !== entry.signedReceiptSha256`), or fails cryptographic signature verification under its anchored historical policy must fail closed.

## Security controls exercised by tests

- Reject mismatched protected WBS or ledger digests, stale baselines and malformed or disconnected receipt chains.
- Reject unexpected top-level or per-entry ledger properties, non-canonical field ordering, noncanonical ledger bytes, duplicate JSON keys and duplicated consumed receipt IDs.
- Reject malformed, cyclic, non-JSON (`BigInt`, `NaN`, functions, symbols), prototype-polluted, or throwing-getter receipts fail-closed without unhandled exceptions.
- Reject unexpected fields in `receipt`, `intent`, `intent.git`, `expectedGit`, or `signatures`, and reject non-canonical `signatureBase64` encodings.
- Prove that semantically equivalent valid receipts with different property and signature ordering produce identical `signedReceiptSha256` and `proposedLedgerBytes`.
- Verify multi-registration chained transitions (`WBS_0 -> WBS_1 -> WBS_2`) and targeted negative tests for reused receipt IDs, stale WBS snapshots, stale ledgers, and stale consumed-receipt contexts.
- Require independently provided authenticated evidence context and exact before/after WBS bytes.
- Verify historical genesis SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`.
- Preserve `mayApply: false` and ensure no modifications to historical receipts or canonical WBS.

Tests use generated **synthetic** Ed25519 test-only keys, not enrolled production human signers.

## Stage B2b still blocked by unimplemented production security

1. **Trust provenance:** Ratify an independent policy anchor, required approver roles, per-human identity enrollment and key custody/revocation. A hash in the same editable PR is not independent.
2. **Trusted Git event binding:** Independently prove reviewed tree/ref/PR provenance and distinguish reviewed pre-receipt head from resulting merge attestation.
3. **Atomic application & receipt retention:** Implement and test compare-and-swap commit of WBS, ledger, and retained signed receipt artifact against protected branch head with collision/retry handling, immutable receipt evidence and auditable decision provenance.
4. **Replay lifecycle:** Explicitly establish idempotence versus rejected replay, expiry, protected clock source, and post-merge SHA continuity.
5. **Historical verifier compatibility:** Continue verifying DMK-196, DMK-197 and DMK-208 receipts against their pinned historical snapshots. Do not replace 27-item historical expectations with current live scope or change historical receipts.
6. **Scope registration:** Reconcile exactly six proposed items (DMK-209..214) only with approved versioned receipts, refreshed PR #34 candidate, 33-item forward UI expectations, full regression and separate human merge decision.
7. **Runtime reconciliation:** Local WorkItems and `.local/project-state.json` must not change on WBS commit; require a distinct read-only preview and approved live apply.

## Important consistency notes

This preflight ledger schema is a proposal, not an applied register. No authoritative `consumed_wbs_receipts.json` exists or is modified by this PR. The canonical genesis is generated **in memory only**. The preflight accepts independently trusted inputs by contract but does not establish that provenance itself. Before production integration, implement an authenticated service boundary and commit both ledger and WBS in a **single conditional transaction**.

**No PR #34 merge, Gate 7, release, receipt approval or runtime mutation authorized here.**
