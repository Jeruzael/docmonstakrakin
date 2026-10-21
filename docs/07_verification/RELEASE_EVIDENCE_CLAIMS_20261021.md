# Release evaluator evidence-claim correction

This bounded candidate starts at `b4004c167e5a377a324f7eaa21f877d3d71ae33d`
on `codex/final-release-evidence-claims`. It changes only
`server/release/releaseGateEvaluator.ts`,
`scripts/testReleaseEvidenceClaims.ts` and this record. It is a partial
DMK-202 correction, not completion or verification of that canonical work item.

## Reproduced behavior

The new focused suite ran against the unchanged evaluator first: **1 passed,
15 failed**, exit 1. Inert in-memory inputs demonstrated these defects:

- An absent work-item collection produced 25 `IMPLEMENTED` capabilities and
  catalog evidence references that were absent from the input.
- `APPROVED` core requirements with no evidence references passed Gate 2.
- Gates 2–5 described authenticated evidence, active credential integration,
  secret-sweep results, 41/41 passing tests and an executed package roundtrip
  without checking those artifacts or executing those operations.
- Pending Gate 7 claimed Gates 1–6 and all capabilities were verified even
  when technical gates failed. An approval-only result invented an audit-ledger
  record and an `Authorized Human Signer` instead of identifying its source.

## Resulting contract

The response interface, gate IDs/codes, capability catalog and existing status
enum remain compatible. The evaluator still returns seven gates and 25
capabilities. No new evidence authority, authentication rule or API field is
introduced.

| Area | Result |
| --- | --- |
| Capability selection | Existing direct-item precedence and legacy primary-item aliases are preserved. |
| Capability lifecycle | Runtime `VERIFIED` reports `VERIFIED`; runtime `VERIFICATION` reports `IMPLEMENTED`, consistent with the existing canonical mapping. Missing, early, approved, released, deferred or unknown runtime statuses report `PENDING`. |
| Capability references | Only references on the selected actual work item are projected. Catalog defaults are not substituted. |
| Gate 2 | The existing CRITICAL/HIGH selection and APPROVED-status predicate remain. Each selected requirement must additionally contain a nonblank string evidence reference. Missing references and unapproved requirements are identified separately. No selected core requirements still fails, with an explicit reason. |
| Gates 2–5 references | References come from the selected core requirements or actual DMK-157/158/159/156 records. Blank, malformed and absent references do not produce replacement catalog links. |
| Gates 2–5 descriptions | Details state the actual stored status/count predicates and that the evaluator does not perform the claimed authentication, scans, test execution or package roundtrip. |
| Gate 7 descriptions | An existing local audit event is identified by its actual ID/actor/timestamp; an approval-only result identifies its approval record without inventing an audit event or signer. Missing signoff does not assert technical success. |

Reference filtering preserves the text, order and duplicates of retained
nonblank string values. A nonempty reference is **not** proof that the artifact
exists, is current, belongs to the release, passed a test or is authenticated.
`VERIFIED` capability status remains a projection of the selected work item's
stored lifecycle status, not new cryptographic verification.

Compatibility changes are intentional: missing-reference core requirements now
make Gate 2 `FAILED` and `releaseReady` false. The existing signoff precondition
therefore rejects that state without changing the writer or route. Consumers
may see more `PENDING` capabilities and empty/different reference lists.
The supplied legacy Atlas baseline retains its existing technical result.

Gate 1, Gate 6, Gate 7 status selection/import-boundary behavior, aggregate
booleans and the signoff writer remain unchanged. The existing catalog
cross-references on Gates 1/6/7 are outside this bounded correction. No quorum,
human-confirmation, reviewer authority or release-policy change is made.

## Verification evidence

Portable Node 22.23.3 and the task-owned read-only dependency junction were used;
no install or package modification was performed. The new suite imports the
actual evaluator and uses cloned in-memory records. It does not start a server,
import ProjectStore, invoke the signoff writer or access real credentials.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testReleaseEvidenceClaims.ts
node --import ./node_modules/tsx/dist/loader.mjs server/release/testReleaseGate.ts
git diff --check
```

- Focused RED: **1 passed / 15 failed**, exit 1, before product edits.
- Focused GREEN: **16 passed / 0 failed**, exit 0. Coverage includes missing and
  malformed references; direct/alias selection; runtime lifecycle boundaries;
  reference order; Gate 2's status/priority/no-core policy; Gate 3–5 predicates;
  actual Gate 7 source provenance; import-boundary behavior; baseline compatibility;
  and no mutation of evaluator input.
- Unchanged legacy evaluator suite: **30/30 passed**, exit 0. Its pre-existing
  ceremony tests simulate signoff solely on cloned in-memory fixtures. They do
  not qualify real human authorization or perform an operational ceremony.
- `git diff --check` passed. Parent-owned typecheck, build, full regression and
  actual CI/integration remain separate qualification steps.

Raw local logs remain in the ignored `runtime/release-evidence-claims/` directory:

| Log | SHA-256 |
| --- | --- |
| `red.log` | `f5cba944806857bd3ff5f436857a1d5f8310c21ee8a0d9eb40ca5d5f75787021` |
| `green.log` | `d15d0ffd831e5fd68d019bf854e133e9196b8ce0a27df96d7de3d420ce834663` |

## Remaining work and rollback

DMK-202 remains open. In particular, Gate 2 still rejects a `VERIFIED`
requirement under its retained APPROVED-only predicate. It still needs an
explicit release-scope and authenticated-evidence contract; reference presence
cannot provide one. Gate 1's active-profile/formal-deferral rules, Gates 3/4's
current artifact verification, and Gate 5's Atlas/count heuristic need their
own remediation. The unchanged signoff writer also contains fixed success
claims that are outside this candidate.

No canonical WBS, status registration, evidence record, receipt, enrollment,
trust root, deployment or release is changed. Historical verification results
are preserved. Rollback is limited to reverting these three candidate paths;
it requires no data migration, and it restores the prior claim behavior and
Gate 2 predicate. Keep the retained RED/GREEN evidence when reviewing a rollback.

## Recovery reconciliation — 2026-10-21

The effective preparation baseline is now
`21da1d5bebaecf58b5037c255561c8b8315b429d`, the PR #66 recovery merge whose
actual post-merge CI was verified by the integration owner. All three candidate
paths were disjoint from the recovery changes. An ordinary fast-forward from
`b4004c1` preserved the uncommitted patch without a stash, conflict resolution,
rebase or history rewrite.

The evaluator, focused test and all retained RED/GREEN/legacy-suite logs remained
byte-for-byte identical across reconciliation. The original verification record
is retained as this section's unchanged prefix. Supplementary pre/post file
manifests and the tracked patch are retained locally in the ignored
`runtime/reconciliation-21da1d5-20261021/` directory.

No test was rerun during this preparation. The earlier results remain evidence
for their stated source/baseline; they are not presented as fresh combined-tree
verification. Effective scope remains the same three paths, with this additive
record update. The candidate remains uncommitted and unpublished; coordinated
integration tests, actual CI and post-merge verification are separate. DMK-202,
authenticated-evidence policy and operational governance prerequisites remain
open as described above. No canonical status, receipt, trust, Gate 7 or release
action is implied.

## Additive Gate 1 wording correction — 2026-10-21

Independent review identified one additional unsupported claim in the same
evaluator: Gate 1 said that blocking questions were "resolved or formally
addressed", although its predicate only checks whether selected records have
the `UNRESOLVED` state. In particular, `DEFERRED` and `NOT_APPLICABLE` do not
establish formal acceptance. This authorized follow-up stays within the same
three candidate paths and supersedes only the earlier statement that Gate 1's
description is unchanged; the earlier evidence and reconciliation record above
remain historical records of their stated source.

Gate 1 details now report the number of selected blockers and counts for
`UNRESOLVED`, `ANSWERED`, `DEFERRED`, `NOT_APPLICABLE` and `OTHER_OR_MISSING`.
Unresolved question IDs remain visible. The description explicitly states that
the evaluation does not verify answers, applicability decisions, or formal
acceptance of deferrals. Missing/unknown states are described without inventing
a resolution or silently treating them as a recognized state.

The legacy selectors (`importance=BLOCKING`, `urgency=CRITICAL`, or
`isBlocking=true`), active-profile behavior, UNRESOLVED-only pass/fail predicate,
gate ID/code/name/status fields, blocking flag and `EV-104` reference are
unchanged. No new answer, applicability, deferral, signoff or release authority
is acquired. This intentionally leaves the existing acceptance-policy gap:
an absent question collection or selected missing/unknown/non-UNRESOLVED states
can still pass Gate 1. Correcting active-profile selection and formal disposition
acceptance remains separate DMK-202 work; descriptive counts do not resolve it.

Five additional pure tests were added before the wording change. They exercise
the actual evaluator with absent collections, missing/unknown states, unresolved
legacy selector variants, and ANSWERED/DEFERRED/NOT_APPLICABLE records without
supporting answers or acceptance. They preserve the existing predicate and
references, retain unresolved IDs, reject the fabricated resolution claim, and
check that evaluation does not mutate the supplied records.

The separately captured RED passed the original 16 tests and failed all five
new cases (**16 passed / 5 failed**, exit 1). The first GREEN then passed the
expanded **21/21** suite, exit 0, using portable Node 22.23.3 and the existing
task-owned dependency junction. No test assertion was relaxed between RED and
GREEN. The original `red.log` and `green.log` still match their hashes above.
No full regression, legacy ceremony suite, build, browser or native-heavy test
was rerun for this addendum. `git diff --check` passed; independent review and
final combined-tree qualification remain separate.

Additional SHA-256 digests, covering the actual local bytes after this correction:

| File | SHA-256 |
| --- | --- |
| `runtime/release-evidence-claims/gate1-red.log` | `e0899b2dcfa66de34d63a5265d2f224eed6a3e045a326fe967cb10b3054d94d7` |
| `runtime/release-evidence-claims/gate1-green.log` | `a668f380d93eafa91a31fd41bbe84962e097c5ac28eb17c858b9ee4d94f1d290` |
| `server/release/releaseGateEvaluator.ts` | `3d3c1a55049f2af4ff88b6c6781ec53bac5f00dbbc77fbffe72a653dd6795ad1` |
| `scripts/testReleaseEvidenceClaims.ts` | `938259c153fd240e6449f87d21e3908b1e37eeb3b11490fe897f719c5493cbe9` |

## Verified combined baseline preparation — 2026-10-21

The preparation branch was normally fast-forwarded from `21da1d5` to
`59fea80b9374a7e90b0d4f855df6ede09aa350c8`, tree
`5900a589ff31ed85a7c637ee27c56212cff10d6d`. The integration owner verified
that master's actual [post-merge CI 39605514442](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39605514442)
passed all four jobs, with 82 suites and 2,085 named checks, before authorizing
this reconciliation. All 37 incoming paths were disjoint from this three-path
candidate. All three candidate files and eight existing historical evidence files
retained identical SHA-256 hashes across the fast-forward. Original candidate
copies, the tracked patch and before/after manifests are retained in ignored
`runtime/reconciliation-59fea80-20261021/`. Only this additive record changed
afterward; no stash, rebase, conflict resolution or history rewrite occurred.

An independent review confirmed that the Gate 1 correction changes descriptive
counts and wording only; its selectors, UNRESOLVED-only predicate and evidence
reference remain unchanged. A fresh pure run on this reconciled baseline passed
**21/21**, with output SHA-256
`a668f380d93eafa91a31fd41bbe84962e097c5ac28eb17c858b9ee4d94f1d290`, identical
to the preserved Gate 1 GREEN output.

A separate six-check in-memory compatibility probe used this actual evaluator
and the Reports candidate's actual `readReleaseReport` projection. The Atlas seed
remained ready and unsigned; the version-sync fixture's explicit synthetic project
identity remap retained the admitted seven-gate shape; wrong-project data stayed
rejected; missing-reference Gate 2 failures remained renderable without readiness;
approval-only signoff omitted invented signer fields; and original question,
work-item and audit inputs were unchanged. All **6/6** checks passed, log SHA-256
`4d4f32bf23e4f03ee20ab082a8db7d60ebadd0862f8f19cd86a7a1c8bdaf8325` in
`runtime/release-evidence-claims/reports-compatibility-green.log`. This is pure
cross-candidate response compatibility, not an actual combined browser/50-case
version-sync run. That combined verification remains required after Reports
integration. Neither probe executes a signoff writer or changes authority.

Fresh synthetic complete regression and sequential WBS/TypeScript/build checks
on this baseline remain pending at this checkpoint. No candidate publication or
CI/integration result is implied.

## Local combined qualification — 2026-10-21

The subsequent fresh synthetic run on `59fea80b9374a7e90b0d4f855df6ede09aa350c8`
started at 2026-10-21T13:18:51.3592286Z and completed at
2026-10-21T13:25:25.2782404Z, exit 0. It used portable Node 22.23.3 and the existing
task-owned dependency junction, with `CI=true` and an empty provider-key setting.
Windows imported `Microsoft.PowerShell.Utility` before setting process-only
`PSModulePath` to `$env:SystemRoot/System32/WindowsPowerShell/v1.0/Modules` for the
account fixture. No install or package/lockfile write occurred.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/prepareCiRuntime.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/runCompleteRegression.ts
npm run ci:quality
git diff --check
```

- Complete regression: **83/83 suites and 2,106/2,106 named checks**, zero failures
  and zero skips under result schema 2.0 / `NAMED_CHECK_PREFIXES/2`.
- This includes the expanded release-evidence **21/21**, master version-sync
  **50/50**, authentication pilot **41/41**, regression runner **12/12** and
  synthetic WBS registration **56/56** suites.
- Actual controlled-document log: **40/40 core, 29/29 additional security and
  11/11 focused**; all 28 registered documents untouched and `LIVE SNAPSHOT
  MUTATION: NONE`. No redundant controlled-document rerun was substituted.
- WBS zero-drift validation, TypeScript `tsc --noEmit`, Vite frontend build and
  esbuild server build all passed. Vite retained its existing chunk-size advisory
  above 500 kB; it was not suppressed or treated as a failed check.
- All **604** tracked/candidate source files retained identical hashes through
  complete regression and quality checks. The ordered source-manifest SHA-256 is
  `7e0c0bc809786eea4914034be068bfd7e66226a0227e22542acca79dda804513`.
  The eight historical files captured before reconciliation also remained
  byte-identical. This result-only addendum follows the tested snapshot; the
  evaluator and focused test have not changed after qualification.

The full successful run, 83 suite logs/results, preparation and quality logs,
timestamps and before/after source manifests are copied into ignored
`runtime/final-release-claims-gates/combined-pass/`. Earlier RED/GREEN and
reconciliation evidence remains separately preserved. Retained SHA-256 digests:

| Evidence | SHA-256 |
| --- | --- |
| Full log | `9a844c6bfee7cb6a6a0cc7b8ddbc40354cf92fe9ce97965af90a7cae05cb1d0d` |
| Results JSON | `71b062761c49ceb1d511ed3bdb6ec1fbe75b3275eeace40a1c8f4271b32a1e30` |
| Quality log | `c53de8c2af72d434faa5eedcfd359bc85476b6152575440d505d7889515fce73` |
| Controlled-document log | `e088488fa5a253663ecb995f32fac75d922401327369162fa2a985ef7d82870d` |
| Release-evidence suite log | `dc860cb6e9472b91bf5911064235e4da507771d344bc3dc164d89006e56b1c86` |

This qualifies only the stated three-path candidate on the stated master base.
The Reports candidate is not present in this local combined run; the six-check
compatibility probe above does not replace its later combined browser coverage.
Signed publication, candidate CI and actual post-merge CI remain separate steps.
No live authentication, trust, WBS application, signoff or release is activated.

These are local candidate bytes, not a signed commit or post-merge result.
Rollback retains the same three-path boundary and no data migration. Historical
logs remain preserved. No canonical status, evidence registration, receipt,
production activation or human-governance action is performed by this follow-up.

## Signed-publication baseline reconciliation

Before publication, the candidate normally fast-forwarded to verified actual
master `ef160d4dea3122309687b1f44bb8972c07e879a5`. PR #64's actual
[post-merge CI 39608076350](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39608076350)
passed four jobs, 83 suites and 2,109 checks. The 29 incoming recovery paths are
disjoint; evaluator and test bytes remain exactly those locally qualified above.
Only this additive record changes after those checks. The earlier local
83/2,106 result remains tied to `59fea80`; final hosted CI must independently
qualify this recovery composition and any later Reports reconciliation.

The operator explicitly waived ordinary development human code review and
authorized normal merges for the completion campaign. Agent inspection and
passing CI are not represented as human APPROVED review. The existing
operational exclusions and actual post-merge verification remain in force.

## Reports integration reconciliation — 2026-10-21

Initial signed candidate `a072bcbf3839981f56c3e7f0787713cf43303277`
passed all four jobs in
[39609469433](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39609469433):
84 suites / 2,130 checks, including 21 release-evidence cases. That result is
preserved as qualification on the earlier `ef160d4` master.

Verified master `9a0054cd7875cd836ffde990607bb0d788806707` then integrated
PR #68. Its actual [post-merge CI](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39610190107)
passed all four jobs, 85 suites / 2,134 checks. The branch incorporates that
master through a normal signed merge, preserving the original candidate commit
and all Reports evidence. There were no conflicts. The evaluator and 21-case
test remain byte-identical to the earlier signed candidate; the effective diff
against actual master remains the original three paths. Final exact-HEAD hosted
CI must now exercise Reports browser/projection checks together with these
release-evidence changes. No earlier isolated run is described as that combined
result. Actual post-merge verification remains required after any integration.
