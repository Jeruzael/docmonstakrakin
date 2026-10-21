# R14 offline governance-envelope candidate evidence

Date: 2026-10-21 (Asia/Taipei). Source master: `5ecf92d1d7bb1a1bb622fd010265eb989113b3a5`.

```text
GOVERNANCE_DESIGN_APPROVED
FORMAL_AUTHORITY_ATTESTATION_PENDING
OFFLINE_ENVELOPE_CANDIDATE_AUTHORIZED
PRODUCTION_TRUST_NOT_ESTABLISHED
WBS_REGISTRATION_BLOCKED
S2A_IMPLEMENTATION_NOT_AUTHORIZED
```

## Operator approval and attribution

The operator's explicit R14 instruction approved the recommended governance design direction and one five-file offline implementation/test/documentation/signed-draft/review candidate. It selected SO/LA ordinary registration, SO/LA/IHA elevated registration, elevated classification for proposed DMK-209–214, three independently authorized governance humans, three eligible recovery custodians and fail-closed independent trust acquisition/application. This is the session's implementation authorization; it is recorded separately from production ratification.

The instruction also explicitly requires authenticated attribution under the existing charter before identifying Gio as the verified human ratifier. **That verification process has not been established by this candidate.** Do not infer the operator's person identity from a GitHub account, chat display, Git signature or the charter naming Gio. No human ratification signature, appointment, consent, operational effective time, root/enrollment ceremony or live authority is manufactured. Unknown appointments, individual acceptances, custody and real key enrollment remain PENDING.

Source attachment: `513c3fad-ae38-4a29-8d44-f1c68ce003d5/Pasted text.txt`, raw SHA-256 `e10d1405ffdef4b1668ff78dd03bbb857a1bdf3c6c68dcbb643579d7a119d57e`. This digest records the supplied instruction, not a human cryptographic ratification. The instruction contains no authenticated ratifier signature/effective timestamp; none is supplied here. The date above is preparation date, not backdated authority.

Earlier external records remain immutable: R13 package SHA-256 `325b3645ddca7caf055a0631128d8f9e45927f62329aebfb6267e98036d04e0e`; R14 unapproved reconciliation `c7f892a561630e5dd6298ceffde23b933ec4ed28054f7ff3abffd6987c9113f7`; unapproved appointment/acceptance JSON `a9ce304f24b11db795c6a988d9d7e6107f24bebc29a17429e496d2bd23485da7`. Their earlier PENDING status describes their capture time. The later operator approval advances design/implementation scope only, not the operational appointment fields.

## Exact five-file inventory and implementation

1. `scripts/verifyWbsGovernanceEnvelope.ts`: offline strict parser/canonical signatures, fixed profile/policy/epoch/person/purpose checks and separately signed synthetic clock/witness bindings; every result non-applying.
2. `scripts/testWbsGovernanceEnvelope.ts`: exclusively synthetic keys/records, fixed clocks and E01–E12 plus adversarial/compatibility tests.
3. `docs/06_planning/WBS_GOVERNANCE_ENVELOPE_CONTRACT.md`: concrete schema, APIs, domains, admission and non-authorizing boundary.
4. `docs/04_security/WBS_GOVERNANCE_ENVELOPE_ACCEPTANCE.md`: cases, assumptions, narrowing, exclusions and rollback.
5. This evidence file: truthful authorization, verification/failure provenance and pending gates.

No current-state/handoff, canonical WBS, original evidence, dependency/lockfile, CI workflow, runtime or existing verifier file is changed. The pre-existing untracked PR53 checkpoint is preserved outside this PR. The existing linked worktree is reused on a new branch from freshly fetched verified master; tracked baseline was clean, with only that prior untracked record present.

The [contract](../06_planning/WBS_GOVERNANCE_ENVELOPE_CONTRACT.md) and [acceptance matrix](../04_security/WBS_GOVERNANCE_ENVELOPE_ACCEPTANCE.md) identify the concrete choices omitted from the R14 prose: exact fields/encoding; per-profile classifier binding; direct message signatures; complete inert snapshots; one active key per registration role; consecutive epochs; all root rotations rejected; no production trust/provider or durable replay state. Existing v2 signature bytes and the continuity/runtime two-role invariant remain unchanged. These choices are candidate review subjects, not already ratified operational policy.

## Verification evidence

Broad application suites ran with synthetic data in disposable checkouts; focused verifier tests used ephemeral in-memory fixtures. The operator's operational store was not seeded or used. Node was 22.21.1 on Windows. A fresh `npm ci` used the unchanged patched lockfile and installed `source-map-js` 1.2.2. The original worktree's borrowed dependency tree still contains 1.2.1 and was left untouched.

| Verification | Actual result and revision boundary |
| --- | --- |
| Existing v2 contract baseline | 22/22 checks, unchanged master |
| Earlier fresh-install Windows complete regression | 69/69 suites; 1,845/1,845 reported checks; zero skipped/failed. This earlier snapshot reported 86 envelope checks through the existing runner's counting filter. It is not labelled final-HEAD CI. |
| Final-source Windows complete regression | 69/69 suites; 1,846/1,846 reported checks, zero skipped/failed; raw envelope suite 88/88. The existing runner reports only 87 envelope checks because it filters out the passing label `E05/E06 skipped epoch rejects` via its case-insensitive `SKIP` match. That negative case executed and passed; no assertion was skipped or weakened. |
| Applicable suites within that regression | Security perimeter 51/51; trusted v2 22/22; continuity 68/68; forward evidence 9/9; source-map dependency 36/36; existing DMK-196/197/208 and historical compatibility checks remained green. |
| Disposable controlled documents | Core 40/40, additional security 29/29, focused suites 11/11; all 28 registered documents and synthetic baseline unchanged; zero snapshot mutation |
| Final source: focused tests | 88/88, including E01–E12, typed predecessor rejection and public-only PEM rejection; rerun using the fresh locked dependency installation |
| Final source: WBS / TypeScript / production build | `npm run ci:quality` exit 0: rendering/integrity zero drift, `tsc --noEmit` and production build pass. Existing large-chunk warning retained. |
| Final source-specific coverage | Node built-in V8/source maps: lines 284/284 (100%), functions 31/31 (100%), branches 142/145 (97.93%). These are V8 ranges, not MC/DC or whole-application coverage. |
| Exact signed candidate / GitHub full CI | Recorded in PR metadata after publication; all three required jobs must be inspected on the exact signed HEAD. A request is not an actual human approval. |

Reproduction uses `npm ci`, `npm run ci:quality`, `npm run ci:regression`, `npm run ci:controlled-docs`, and `node --import ./node_modules/tsx/dist/loader.mjs scripts/testWbsGovernanceEnvelope.ts`. For coverage add `--experimental-test-coverage --test --test-coverage-include=scripts/verifyWbsGovernanceEnvelope.ts` and spec/LCOV reporters. CI runtime initialization is exclusively in the disposable clone. A process-only native Windows PowerShell module path was needed for the existing synthetic account test; no machine/user execution policy or source assertion changed.

Initial RED: the new test reported `0 passed, 1 failed` because the authorized API was absent; baseline existing v2 suite passed 22/22. First implementation run passed 84 checks and exposed a test-fixture mismatch: a clock key-purpose test failed earlier at signature validation because the fixture still signed with the old clock key. It was corrected to sign the intended invalid-purpose fixture with the matching synthetic key.

A source audit identified a policy-principal reuse gap: two role keys could name one principal while leaving a second-person mapping unused. A new negative check reproduced RED (`85 passed, 1 failed`), then the verifier added distinct used registration principals. Focused GREEN reached 86/86 and TypeScript passed. Genuine RED/fixture/typecheck logs are retained externally; no existing assertion or scope boundary was weakened.

A fresh read-only agent reviewer reproduced a predecessor digest coercion defect: a one-element array passed a regex test and evaded a string reuse comparison (RED 86/1). Explicit string checks now reject it (GREEN 87/0); the reviewer independently reran that result. Two incorrect relative links were fixed. This advisory agent review is not independent human governance approval.

A subsequent source audit found that Node's `createPublicKey` accepts private PEM and derives a public key. A new synthetic negative fixture reproduced RED 87/1. The public-only SPKI guard now rejects that input; final GREEN is 88/0. No actual private key was collected or persisted. The original initial coverage was 100% lines/functions and 97.89% branches; final exact counts appear in the table above. Coverage is instrumentation evidence, not proof of every attack or production trust.

The final-source sandboxed broad repeat was interrupted after existing suites hit EPERM symlink/rename and loopback `ERR_NETWORK_ACCESS_DENIED` restrictions. Its partial logs were preserved separately; it produced no complete final result. The same final source then passed the complete regression in the permitted disposable environment. No sandbox workaround or assertion change was added to the repository.

The first broad disposable run genuinely failed: account provisioning could not load a Windows PowerShell module because the inherited path selected a PowerShell 7 module; the borrowed dependency installation also had unpatched `source-map-js` 1.2.1. That run reported 67/69 suites and 1,811/1,839 checks. A minimal module-import probe confirmed the host cause; the unchanged account test passed all six checks with a process-only native module path. The fresh-clone `npm ci` run then passed all suites as recorded above. A first clone attempt also hit Windows path-length limits and was retried under a shorter temporary path. The failed results are retained; none was substituted with a fabricated green result.

External evidence is retained in the R15 artifact set. Raw-byte SHA-256 digests:

| Artifact | SHA-256 |
| --- | --- |
| Earlier-revision Windows full regression (`regression-final.log`) | `9eed095af16a110bea44afa793d96dde3944f096f972853d7b9c7e01f3aac6c9` |
| Final-source Windows full regression (`regression-final-88-unsandboxed.log`) | `f8619f3a0ef31d976a6ab4a0744203e88a3147baacf97b3f786bb9218e3a7120` |
| Disposable controlled documents (`controlled-final.log`) | `7e2cba4573bb8ae0a17282e9b207a56e36b119c573dd9b00f6b1d3af50015526` |
| Final-source quality (`quality-final-88.log`) | `50ef4ab45c397ac1e6503a896c19fc0f430fbb162053e11509b5e1f618305014` |
| Final focused checks (`public-key-only-green.log`) | `0152dd149d81ad60be348158b3da0d7b930b79e2e5efc6e1319d0b8b0b1895db` |
| Final source coverage (`coverage-final-88.lcov`) | `2cab990782e39ffb1c9d5e0a31c29a6120c4fb1f79d49cf50a0f7deb3343894c` |
| Fresh dependency audit (`npm-audit-final.json`) | `0d682ad3fdb754f479718c7a21cca80eb246c927caf6a347f2424c19e130938a` |

## Preservation, risk and next human gates

Canonical YAML SHA-256 remains `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`; Markdown remains `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f`. Original historical receipt/snapshot bytes, 27-item audit, original 29 S2-A portfolio files and PR54 benchmark measurements/qualifications are preserved. Synthetic performance targets are not production resource acceptance.

Actual independent human identity/role/custody, roots, clock/provenance/revocation acquisition, historical compromise adjudication, elevated continuity compatibility, descendants, protected atomic application/consumption, worst-case/concurrent operational resources and activation remain unresolved. No positive offline result or GitHub code review closes those gates.

The unchanged dependency baseline has one high-severity vulnerable package in the fresh audit: Vite 6.4.3, including [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) and two moderate launch-editor advisories. The high advisory lists Vite 6.4.4 as patched. No exploit or live reachability test was performed. Dependency remediation and the stale operator installation require a separate scoped follow-up; neither lockfile nor operator installation is changed by this envelope candidate.

An independent security/governance review is requested on the signed **draft** candidate. The exact HEAD, valid Git signature, three-job CI and request/actual-review chronology belong to PR metadata, avoiding a self-referential commit hash in this file. No actual human approval is claimed before it exists. Stop before merge; even later approval only permits a separate operator merge decision.

Rollback is an authorized code-only revert/disable while unwired, with no operational artifact restoration. Future real authority/application rollback must freeze and preserve evidence and require separate incident decisions. No WBS registration, DMK-209–214 implementation, PR34/52 merge, signer/root installation, privileged route/live-agent activation, S2-A, Gate7 or release promotion is authorized.
