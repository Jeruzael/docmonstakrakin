# Gate 3 — Corrected Architecture Assessment

**Target:** PR #36 @ `ed02373df53284f3780c1f84cdb9899e2b33eb26`  
**Reviewer provenance:** AI-generated technical assessment; human architecture approval not yet recorded  
**Disposition:** CONDITIONAL PASS (isolated Stage B1 architecture); HUMAN_GOVERNANCE_PENDING

## Reviewed architectural boundary

PR #36 introduced only four new files at the original assessed commit: one 76,337-byte historical WBS snapshot, a pure in-memory forward evidence adapter, a 9-case test suite, and Stage B1 design documentation. The historical snapshot's raw SHA-256 is `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`. Historical DMK-196/197/208 verifiers, their fixed 27-item scope, and original receipts were not modified. No canonical WBS item, release authorization, local runtime WorkItem, or Gate 7 state changed.

Stage B1 reads WBS buffers supplied to its functions and returns a verdict. It cannot confer authority merely by returning `FORWARD_APPROVED`. The GitHub PR #34 registration remains a separate, unmerged proposal.

## Stage B2 trust boundary: recommended design

1. **Independent trust anchor.** A production policy store is not trusted merely because it lives beside editable source files. Authenticate it using previously ratified signer keys or an independently pinned policy digest, controlled outside the mutation candidate; prevent untrusted code/agents from replacing it. Require independent human identity enrollment and controlled revocation.
2. **Policy integrity.** Canonically hash the ratified policy including required roles, public keys, validity, version and security restrictions. Bind this hash inside the manifest signed by approving humans. Changing roster or rules must require its own authorized governance ceremony.
3. **Signer independence.** Derive canonical public-key fingerprints from parsed SPKI key bytes rather than PEM text formatting. Reject reuse of the same key across approval slots; this is necessary but not sufficient to prove different human beings. Verify distinct enrolled human principals under ratified separation-of-duties policy.
4. **Commit binding without self-reference.** Bind the signed intent to a stable **reviewed candidate** (e.g. exact WBS digest, base Git commit, reviewed PR head/tree digest, PR ID, operation ID, nonce, validity interval, policy digest). Do not try to sign a merge commit that itself includes the resulting receipt. Instead verify a separately recorded merge/approval attestation linking the reviewed intent to the resulting Git commit/tree.
5. **Replay safety.** Validate expiry and not-before against trusted time; track unique operation IDs/receipt consumption under an integrity-protected, atomic/idempotent transaction; reject reused authorization outside its stated scope.
6. **Historical evidence / current state separation.** Preserve original 27-item historical audits using pinned historical snapshot bytes; independently check a newly approved 33-item forward WBS with a versioned receipt. Keep original historical receipts and fail-closed tests unchanged. Update forward UI tests only after approved registration.
7. **Runtime separation.** A merged canonical WBS change does not authorize mutation of `.local/project-state.json`. Read-only reconciliation precedes a separately approved exact-candidate apply.

### Stage B2 go/no-go
No production registration or merge of PR #34 until the trust-root design, signed policy, replay control, approved exact six-item manifest, historical adapter integration, and complete regression have passed independent review and any required human sign-off.

**Gate 3 architecture verdict:** technically suitable as a bounded library foundation, not an end-to-end authorization system.
