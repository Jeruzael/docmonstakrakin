# Forward WBS Registration Compatibility — Stage A

**Status:** Implementation candidate, pending CI and independent review  
**Source:** Authentication initiative issue #31; draft registration PR #34  
**Baseline:** master `84dabf513354ad469e3ae3fdb3a95bfd111badbe`

## Boundary
This Stage A PR adds a **standalone candidate verifier and tests only**. It does **not** modify the canonical WBS, old receipts, historical verifier logic, fixed historical 27-item scope, Gate 7, or the application runtime. A valid PREVIEW is NOT an authorization, and an APPROVED verdict requires a separately supplied trusted human key roster and policy plus cryptographic signatures. The test keypairs are generated only in volatile test memory.

## Verification contract
- Bind precise raw before/after WBS SHA-256 to the manifest.
- Parse both WBS snapshots; reject invalid or duplicate IDs/paths, modified root metadata or any changed/deleted historic item.
- Require every added item to match exact manifest contents and begin in PROPOSED.
- Require separately trusted policy version, unique authenticated human signer identities with applicable authority, Ed25519 signatures over domain-separated canonical manifest bytes.
- Reject revoked signers, invalid signatures, changed manifest content, missing quorum, unknown policy, partial additions and unauthorized existing-item mutations.
- Signatures alone are not a complete operator ceremony: enrollment/key custody, human authentication, policy authority, approval evidence and anti-replay constraints must be ratified before production integration.

## Stage A tests
Run `npx tsx scripts/testWbsRegistration.ts`, `npm run wbs:check`, `npm run lint`, `npm run build`, `npm run test:complete`; isolate any local evidence writing with the existing CI runner or disposable workspace.

## Stage B follow-up (separate PR)
Before adding the six tasks to master, implement a versioned, independently authorized *forward-state registration receipt and historical snapshot compatibility adapter*, including a reproducible historical WBS snapshot bound to the 27-item historical SHA. Do not replace the DMK-196/197/208 historical checksums or relax negative tamper tests. Update the nine historically affected regression fixtures for forward state, ensuring original 27-item history remains verified. Update UI badge tests to the new intended 33-item scope. Bind the new WBS SHA and the six exact items to an independently authorized WBS registration approval; ensure deterministic generated WBS Markdown.

**Do not merge PR #34** until full CI is green and it has an exact independently reviewed authorization; do not claim that this Stage A module authorizes PR #34 by itself.

## Open governance decisions
- Define required work-item/WBS registration approver roles independently from feature-level Security Officer + Lead Architect quorum.
- Choose authoritative local trusted policy/key repository with revocation and recovery semantics.
- Define explicit approval receipt, trusted Git provenance, anti-replay/idempotency and forward-state chaining.
- Decide the eventual production boundary for verifying current WBS while validating historical receipts at their original snapshot.
