# Gate 3 — Agent-Reported Adversarial Test Output

**Evidence classification:** Self-reported local Windows execution transcribed from Codex's v1.1 Gate 3 report, not a GitHub Actions log, not independently replayed at the original reviewed commit. Environment reported: Windows PowerShell, Node.js 22.21.1, tsx 4.21.0. Local exit code reported: 0.

```text
[PASS] ADV-01 Untrusted public key injection rejected under supplied legitimate policy
[PASS] ADV-02 Revoked signer rejected
[PASS] ADV-03 Same identity dual-role attempt rejected
[PASS] ADV-04 Duplicate same-role signatures rejected
[PASS] ADV-05A/B/C/D Invalid signature encodings, lengths or bytes rejected
[PASS] ADV-06A/B Modified before/after WBS digests rejected
[PASS] ADV-07A/B Wrong project/operation rejected
[PASS] ADV-08 Policy version mismatch rejected
[PASS] ADV-09 Non-PROPOSED item addition rejected
[PASS] ADV-10/11 Existing WBS item changed/deleted rejected
[PASS] ADV-12A/B Duplicate WBS IDs or paths rejected
[PASS] ADV-13 Root metadata tampering rejected
[PASS] ADV-14A/B Manifest item count/content mismatch rejected
[PASS] ADV-15A/B Historical anchor tampering/unapproved forward change rejected
[PASS] ADV-16A/B/C/D Malformed or missing data rejected

[WEAKNESS CONFIRMED] ADV-FINDING-01 Caller-controlled trusted policy and keys permit apparent approved decision
[WEAKNESS CONFIRMED] ADV-FINDING-02 Shared key, different identity IDs satisfy nominal quorum
[WEAKNESS CONFIRMED] ADV-FINDING-03 Identical signed WBS intent valid in multiple Git contexts
[WEAKNESS CONFIRMED] ADV-FINDING-04 Mutable required-role set not bound by signed policy content

Reported totals: 27/27 defensive cases passed; 4/4 vulnerability demonstrations confirmed; local process exit code 0.
```

The lines above summarize agent-provided output, not an independently preserved raw terminal capture. Independent reproduction on the PR head is performed by the CI-discovered `scripts/testGate3Adversarial.ts`. No production authority should infer a human approval from this log.
