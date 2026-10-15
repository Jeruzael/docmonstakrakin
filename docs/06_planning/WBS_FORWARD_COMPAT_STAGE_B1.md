# Stage B1: Historical WBS Snapshot & Forward-State Evidence Boundary

Status: IMPLEMENTATION CANDIDATE / PENDING INDEPENDENT CI AND REVIEW

## Scope
Adds a byte-identical archival snapshot of the current, post-DMK-197-closure canonical WBS, plus a standalone adapter that checks a separately supplied Ed25519 authorization manifest before accepting a future WBS as an approved additive successor.

- Historical anchor digest: `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`
- Source SHA: `0fad5f5c58923f5d60de2b3a94cf4c83fd11a76b`
- Snapshot: `docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml`
- Adapter: `scripts/verifyForwardWbsEvidence.ts`
- Regression: `scripts/testForwardWbsEvidence.ts`

This stage DOES NOT modify original historical DMK-196, DMK-197, or DMK-208 verification functions or receipts, does not promote canonical tasks, does not change the WBS, and does not update the app board or runtime snapshot. The trusted policy and signatures are external inputs. Unit tests create ephemeral test-only keys, not real approval receipts.

## Trusted-state contract
- Historical snapshot MUST exactly match its pinned SHA-256.
- Current WBS with matching historical SHA is recognized as HISTORICAL.
- Any changed WBS is REJECTED unless a manifest binds exact before/after bytes and a separately trusted independent human approval policy accepts signatures.
- Forward-state verification returns FORWARD_APPROVED only with validated additive-only content and human-signer provenance. No unapproved mutation is inferred from the operator's desire to see board tasks.
- The cryptographic check itself is not a full approval ceremony: human enrollment, independent policy authority, revocation, review records and signatures require separate governance authorization.

## Required follow-up Stage B2
1. Obtain ratified registration authority policy, key trust root, and exact six-item registration manifest and evidence, without fabricating human approvals.
2. Integrate forward-state approval checks with historical verifiers while retaining historical-source validation and all negative cases. Avoid using current WBS for historical pre-apply test fixtures.
3. Reconcile fixed 27-item historical audit expectations against current proposed 33-item scope; never rewrite original audit receipts.
4. Update current board UI assertions to follow authorized item scope, preserving historical test expectations.
5. Rebase PR #34 after Stage B2, verify generated WBS markdown and all CI jobs, and obtain separate authorization to merge.
6. Pull canonical changes locally, inspect read-only reconciliation, and require a separate approved exact candidate before live runtime synchronization.

Nothing here approves or merges PR #34, authorizes release, Gate 7, or a runtime mutation.