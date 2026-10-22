# Operational governance readiness report

Inspected source baseline: `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`.
Preparation date: 2026-10-22. Disposition: **IMPLEMENTED READ-ONLY REPORT / PRODUCTION AUTHORITY NOT ACQUIRED**.

The current operator instruction authorizes the remaining engineering work. It does not let software invent authenticated people, appointments, human acceptances, private-key custody, ratification or actual receipt consumption. Technical implementation can continue under that instruction; the missing external facts below must be acquired honestly before an operational decision can use them.

## Executable boundary

[`assessGovernanceReadiness`](../../scripts/governanceReadiness.ts) produces a versioned `GOVERNANCE_READINESS/1` report. Its only input fields are an absolute `workspaceRoot` and an optional `testOnlyCandidate` containing the existing request/source/state contracts. Unknown fields, caller verdicts, `ratified:true`, production source labels, hidden/symbol fields and accessors reject. The API accepts a trusted-host TEST_ONLY acquisition callback solely to exercise the existing synthetic composition; that callback is executable host code, not sandboxed untrusted JSON. No production authority provider is accepted.

The report performs real verification rather than accepting verifier-result objects:

1. `verifyWorkspaceWbsContinuity` reads the actual local canonical and pinned historical WBS bytes. The report does not provide a purported production forward-evidence adapter. Missing history or changed current bytes without authenticated applied evidence retain the existing rejection. `VERIFIED_LOCAL_BYTES` describes local byte consistency; it does not authenticate protected Git, current remote refs or actual application.
2. An optional candidate goes through the unchanged `verifySyntheticRegistration`. That composition verifies the raw canonical receipt, exact before/after bytes, v2 signatures/policy/Git bindings, ledger preview, offline governance envelope, independent fixture witness, synthetic applied provenance, uncertainty, freshness, epochs and replay floors. The wrapper does not parse or reimplement these signed formats. `VERIFIED_TEST_ONLY` preserves the composition's explicit nonoperational scope.
3. `candidateByteBinding` separately compares the exact candidate pre-WBS digest to the verified local current digest. A mathematically valid synthetic transaction cannot substitute for a missing, altered or different current workspace. Proposed WBS, raw receipt and proposed ledger digests identify only the bytes actually evaluated; no output receipt or ledger is written.

Every result has `mode:BLOCKED`, `operationalReady:false`, `operationalAuthority:false` and `mayApply:false`. There is intentionally no positive operational branch or caller-cleared prerequisite list in version 1. Successfully validating all supplied fixture evidence cannot supply independent production acquisition. A future implementation must authenticate its provider and enforcement boundaries before a new report contract can express a different production result; adding a flag or changing the status literal is insufficient.

Run the current-directory report with:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/governanceReadiness.ts
```

The JSON goes to stdout. The CLI exits **2** because the operation remains blocked, including after local continuity succeeds. Arguments are unsupported and reject; there is no approval override. Importing the module does not run its CLI. The report itself performs no file, Git, network, enrollment, signing, consumption or runtime writes. It invokes the explicitly supplied TEST_ONLY host callback when a candidate is provided; it cannot sandbox arbitrary caller JavaScript or prevent that host callback's own side effects.

## Existing mechanisms and actual missing prerequisites

The [R14 contract](../06_planning/WBS_GOVERNANCE_ENVELOPE_CONTRACT.md), [acceptance matrix](../04_security/WBS_GOVERNANCE_ENVELOPE_ACCEPTANCE.md), [candidate record](WBS_GOVERNANCE_ENVELOPE_CANDIDATE.md) and [earlier human ratification record](STAGE_B2B2_A_RATIFICATION_AND_VERIFICATION.md) distinguish design/implementation authorization from actual authority. The candidate record preserves the R13/R14 attachment digests and their capture-time pending status. This report has not independently reacquired those external original attachments or authenticated their human attribution; it cannot convert their digest references into ratification.

| Report prerequisite | Implemented evidence/mechanism | Missing fact or technical boundary |
| --- | --- | --- |
| `HUMAN_AUTHORITY` | Offline enforcement of distinct person IDs, roles, keys, eligibility and custody assertions | Independently attributed charter ratifier; actual distinct appointments, individual acceptance, possession/custody and conflict adjudication. Separate keys or account names do not prove separate humans. |
| `ROOT_POLICY_CLASSIFICATION` | Purpose-separated envelope signatures, policy digest and exact external-reference binding | Real root custody and externally pinned, authenticated ratified policy, person registry, classification rules and effective scope. A digest or Git signature cannot prove these facts. |
| `GIT_APPLICATION_PROVENANCE` | Exact v2 Git bindings, synthetic witness acquisition and continuity application checks | Authenticated immutable provider/repository identities, protected branch enforcement, current refs/trees and actual reviewed-to-applied ancestry. Local files, PR claims and signed intent are insufficient. |
| `EPOCH_REPLAY_FENCING` | Consecutive envelope epochs; durable TEST_ONLY transaction state and replay tests | Independent operational high-water marks, witness continuity and anti-rollback/replay enforcement, consumed atomically with the authorized operation. |
| `REVOCATION_ADJUDICATION` | Signature/key validity, current checkpoint floors and per-application continuity checks | Authenticated current revocation and historical compromise adjudication under ratified rules. Ambiguity must deny; toggling a fixture flag cannot decide it. |
| `TRUSTED_TIME` | Signed fixed fixture observations, uncertainty containment, monotonic/freshness checks | Operational clock/provider custody, authenticated current observations and a consumer fence that prevents stale authority being used after revocation. |
| `RESOURCE_ACCEPTANCE` | Bounded candidate parsers/proofs and retained synthetic measurements | Actual compatibility acceptance of production limits and measured workloads, including concurrency, full-process memory and stop/overload behavior. Fixture timing is no ratification. |
| `PROTECTED_ATOMIC_APPLY` | Nonapplying exact transaction preview; actual SQLite atomicity in newly minted TEST_ONLY databases | Protected remote ref CAS and one indivisible receipt-bearing Git tree containing YAML, generated Markdown, ledger and exact retained receipt, with atomic replay consumption and independent post-write audit. Local CAS/SQLite cannot prove remote Git atomicity. |
| `PROFILE_DESCENDANT_COMPATIBILITY` | Ordinary/elevated offline envelope and TEST_ONLY composition | Existing production continuity remains exactly SO/LA with exact terminal applied commit/tree. Elevated continuity, safe descendants, root rotation and recovery need concrete compatibility mechanisms; no fallback lowers quorum. |
| `SEPARATE_ACTIVATION` | Explicit nonapplying results and preserved boundaries | Authenticated exact-operation activation evidence, installed production acquisition and post-application audit. Runtime reconciliation, privileged route cutover, Gate 7 and release retain their own gates. |

The external facts are not asserted to be nonexistent everywhere. They are **not independently acquired or verified by this implementation**, so this report cannot rely on them. Human code-review waiver and permission to implement do not manufacture those facts. The technical adapters, compatibility work and remote transaction mechanism are implementable follow-up work; their absence is an engineering gap, not a claim that new code permission is missing.

## Smallest follow-up production adapter contracts

The next engineering boundary should be a read-only production acquisition adapter with an explicit provider configuration and independently installed public pins. It must have no environment/PR JSON fallback and no trust-on-first-use. Its authenticated output should supply the existing v2 and continuity verifiers rather than create a new permissive verifier. A TypeScript brand or callback type alone is not authentication.

| Contract | Required evidence and fail-closed behavior |
| --- | --- |
| Human/policy decision reader | Retrieve exact retained external decision/enrollment bytes; verify authorized issuer/signatures, independently established human identity, actual consent/appointment, role scope, expiry, classification, purpose-separated public keys and effective ratification. Missing custody or real people yields a missing-evidence decision; the adapter never creates substitute identities or keys. |
| Protected provenance reader | Authenticate provider and immutable repository/owner IDs; acquire protected target/head/tree and exact WBS/ledger/receipt bytes; authenticate actual application commits and ancestry separately from the reviewed intent. Deny moved refs, unsupported descendants and missing retained objects. |
| Authority/time/revocation reader | Authenticate independently pinned checkpoint/clock providers, exact policy epoch and predecessor, durable sequence floors and all current/historical revocation decisions. Bind every read to the exact operation/session/input bytes; reject stale, equivocal or uncertain evidence and preserve high-water marks. |
| Resource acceptance reader | Verify an independently authorized, current compatibility decision bound to exact verifier/workflow revisions, numerical limits and retained workload evidence. A locally observed benchmark or caller `accepted:true` is invalid. |
| Atomic-apply capability verifier | Read authenticated effective remote enforcement/capability evidence and the exact proposed transaction contract. Do not accept `supportsCas:true`. Before any later enabled executor, independently demonstrate one protected conditional remote ref transition, receipt/replay uniqueness, race refusal, unknown-outcome recovery and exact post-application audit. |

These are contracts for further implementation, not new serialized production schemas or completed authorities. Raw receipt and policy signature domains remain unchanged. Ordinary SO/LA and elevated SO/LA/IHA remain distinct; the report cannot select a weaker profile by counting signatures. If elevated continuity or descendant support is not available, the operation denies. Production activation and actual application remain separate from this read-only adapter work.

## Focused evidence and preservation

The new suite first observed the absent API as **0 passed / 1 failed** before implementation. This original RED is transcribed from captured command output; no retained raw-log digest is claimed. After implementation, the focused command below passed **25 named checks / 0 failed**, including real ordinary/elevated synthetic verification, exact byte/duplicate-key attacks, quorum/person/revocation/time/epoch/replay failures, forged caller verdicts, accessor refusal, altered/missing local continuity, repeat determinism/nonmutation, report isolation and actual child-process CLI refusal. Counts are named compound checks, not the number of Node assertions. Fixture keys remain ephemeral and are never retained or enrolled.

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/testGovernanceReadiness.ts
```

The current local canonical WBS was parsed as **69 items**, SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`; continuity reported the same pinned historical/current digest. TypeScript (`node ./node_modules/typescript/bin/tsc --noEmit`) also completed with exit 0. The suite compares original canonical YAML/Markdown and historical bytes after repeat evaluations and checks fixture replay state remains unconsumed. No canonical entry, historical receipt, operational ledger, principal, grant or root is modified. PR #34/#52, live agents, Gate 7 and release are outside this report's apply surface. Broad regression, build, hosted CI and integration verification belong to the combined final tree; this focused result does not claim their outcomes.
