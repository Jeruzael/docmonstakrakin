# Gate 3 — Adversarial Verification Matrix

**Provenance:** Codex agent-reported local Windows run against PR #36. Reproducible portable source: `scripts/testGate3Adversarial.ts`. On the original PR #36 head, the additional 27+4 checks were not part of GitHub CI. Updated PR-head CI confirmation is required. **Passing weakness demonstrations means weaknesses remain unfixed.**

## Defensive scenarios (27 cases)

| Cases | Security boundary | Agent-reported outcome |
|---|---|---|
| ADV-01, ADV-02 | Untrusted signer under genuine policy; revoked signer | REJECTED |
| ADV-03, ADV-04 | Same identity occupies two roles; duplicate role signatures | REJECTED |
| ADV-05A–D | Truncated, oversized, corrupt and malformed signatures | REJECTED |
| ADV-06A–B | Reuse with changed before/after WBS bytes | REJECTED |
| ADV-07A–B | Different project or operation | REJECTED |
| ADV-08 | Mismatched policy version strings | REJECTED |
| ADV-09–11 | VERIFIED injection, existing-item mutation/deletion | REJECTED |
| ADV-12A–B | Duplicate item identifiers or WBS paths | REJECTED |
| ADV-13 | Root WBS metadata mutation | REJECTED |
| ADV-14A–B | Manifest count or added-item attribute mismatch | REJECTED |
| ADV-15A–B | Corrupt historical anchor, unapproved changed current WBS | REJECTED |
| ADV-16A–D | Null manifest, invalid YAML, empty items or signatures | REJECTED |

## Vulnerability demonstrations (4 cases)

| Finding | Demonstration | Observed acceptance |
|---|---|---|
| ADV-FINDING-01 | Attacker substitutes full trusted policy with attacker keys and signs | `valid: true` |
| ADV-FINDING-02 | Same Ed25519 key enrolled under two different identityId strings and roles | `valid: true` |
| ADV-FINDING-03 | Same signed intent reused for another context with identical WBS bytes | `valid: true` |
| ADV-FINDING-04 | Required reviewer roles reduced without changing policyId/policyVersion | `valid: true` |

These are **production blockers**, not proof that the verifier is secure end-to-end. `testGate3Adversarial.ts` executes those demonstrations as regression characterization tests; when production controls are later implemented, tests must be rewritten to assert rejection by the production boundary. Preserve the original weakness examples as historical evidence.

## Evidence provenance

- [Original PR #36 GitHub CI](https://github.com/Jeruzael/docmonstakrakin/actions/runs/38651819680): three jobs passed, original 58/58 suites and 1,348/1,348 checks.
- `docs/07_verification/GATE3_AGENT_REPORTED_EXECUTION_LOG.md`: transcribed agent-provided output, NOT independently authenticated raw CI output.
- `scripts/testGate3Adversarial.ts`: portable source used to reproduce all 31 characterizations on a clean checkout.
- Human reviewer identity and approval: NOT RECORDED.

**Disposition:** CONDITIONAL PASS for Stage B1 library; production authorization blocked.
