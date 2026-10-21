# Reports and export truthfulness candidate

This bounded Workstream D correction starts from master
`b4004c167e5a377a324f7eaa21f877d3d71ae33d` on
`codex/final-reports-truthfulness`. It changes exactly seven paths:

- `src/components/DocumentsView.tsx`
- `src/data/releaseReportProjection.ts`
- `scripts/testReleaseReportProjection.ts`
- `scripts/testDocumentsReportTruthfulness.ts`
- `scripts/testControlledDocVersionSync.ts`
- `README.md`
- This verification record.

Before publication, the branch was normally fast-forwarded without rebase from
that original baseline to verified master
`21da1d5bebaecf58b5037c255561c8b8315b429d`. Master's 22 changed paths were disjoint
from these six paths. SHA-256 comparison before/after the fast-forward confirmed
identical bytes for all six candidate files and all three retained focused logs.
Only documentation changed immediately afterward: this additive reconciliation
note and the reviewed README runtime/PowerShell qualifications. At that point,
implementation, tests and RED/GREEN logs remained unchanged in six uncommitted
paths. A second normal fast-forward moved the branch to merged PR #67
master `f1cc0255627fa9f986e5fa4ee70b383a6322225a`, tree
`c0aa838699c330e6e0c1be2de1a0c9001766a89c`, adding the corrected regression runner.
Its seven paths were also disjoint; all six candidate files and three focused
logs again retained identical bytes across the fast-forward. The PR #67
post-merge CI was still running when this verification preparation began; no
subsequent integration is implied. Focused results below retain their original
baseline; reconciled-tree build/full regression and CI remain separate checks.

The subsequent full run justified the seventh test-fixture path and factual
protocol-label restoration described below. All historical RED/GREEN logs and
the complete initial full failure are retained without rewriting them.

After the focused compatibility repair passed, the branch was normally
fast-forwarded again to master `acdb3e2c1057262612766d7d98ab91c32b3c084b`, tree
`a5eee775eadb97098582a97a38cefb4380dc4141`. Before this step, the parent verified
PR #60's actual [post-merge CI 39603324113](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39603324113):
all four jobs passed, including 81 suites and 2,029 named checks. Its 23 paths
were disjoint from this seven-path candidate. All seven candidate files and 92
retained evidence files had identical SHA-256 hashes across the fast-forward.
Only this additive baseline note changed before the fresh combined verification.
The merged authentication pilot remains disconnected from standard startup.

It does not change server release rules, signoff routes, reviewer authority,
canonical WBS, receipts, real identities, credentials, privileged routes or agents.
No release signoff, Gate 7 ceremony or release promotion is performed.

## Reproduced defects

The initial actual React/Playwright run against the unchanged component reported
**0 passed / 7 failed**, exit 1. A synthetic project's stored planning readiness
was 100, but no release report existed. The export nevertheless reported
`APPROVED & SIGNED OFF`, 100% capability readiness and zero audit breaks. The screen
also supplied hardcoded passed gates and unconditional verification/audit labels.
HTTP 503 did not clear or qualify those claims. An actual incomplete report still
displayed 100% verified capabilities and zero breaks in the screen.

A delayed A response replaced B's report while retaining B's project heading.
The current application container remounts projections when project ID changes,
which mitigates that particular path in normal navigation. The component itself
had no request or project fencing, and changing the same project's stateVersion
did not request a new evaluation. A wrong-project response could report signoff.
The RTM counted APPROVED requirements or arbitrary evidence references as verified.

A separate server-rendered PRD test failed on the literal canonical hash
`#7f8a91c2b`. The PRD also called the entire requirement list approved and described
stored planning health as a computed health score. That test then passed after
the factual metadata/count corrections; no replacement hash is invented.

## Resulting behavior

The release screen, rendered Markdown, raw Markdown, clipboard and downloaded
Markdown use one admitted current report. Missing, loading, failed, malformed,
cross-project and superseded responses cannot supply readiness, signoff,
capability verification or audit success. Neutral gate descriptors retain
navigation context while every unavailable gate is explicitly UNAVAILABLE.
Refresh is a read-only evaluation request.

Admission validates fields already returned by the existing server evaluator,
including its seven unique gates, capability records/counts, audit counts and
aggregate booleans. No new server field is required. In particular, existing
signoff sourced from an approval may omit signer details; the UI reports that
absence instead of inventing an identity. Invalid JSON and structurally invalid
data cannot crash report rendering. Failed refresh removes the previous result.

Project ID, local stateVersion, canonical-snapshot readiness and request identity
fence publication. Superseded reads are aborted; generation/active checks also
reject late results from transports that ignore cancellation. Same-project
version changes, A-to-B-to-A and canonical-readiness invalidation are covered.
The endpoint returns no stateVersion: this client guard does not prove an atomic
server snapshot or detect remote changes that the client has not observed.

The UI and export label valid values as server-reported evaluation. They no longer
claim that rendering performed a secret sweep, security tests or independent
evidence authentication. Existing signoff endpoint/payload/authority is preserved;
the modal no longer pre-fills a statement that all criteria are satisfied.

RTM reports lifecycle approval and requirements with/without evidence references
separately. Reference presence is not authenticated evidence or a passing result.
PRD reports total versus approved counts, the actual project stateVersion and a
stored planning health label; unsupported canonical-hash statements are removed.

## Focused verification

The portable Node executable used for these checks is Node 22.23.3. Dependencies
are reached through the task-owned junction to retained package files. No install
or package write was performed. This is not fresh operator-host installation
qualification. Tests use neither operator state nor external-provider credentials.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testReleaseReportProjection.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testDocumentsReportTruthfulness.ts
git diff --check
```

- Pure/API-shape/SSR suite: **11/11 passed**. It executes the real release evaluator
  against inert in-memory inputs to check response compatibility, without loading
  ProjectStore or executing signoff. Malformed fields, contradictory success flags,
  incomplete/duplicate gates, audit inconsistencies and false capability totals
  fail admission.
- Actual React/browser suite: the first **7/7** cases fail before correction; the
  expanded **13/13** cases pass afterward. The final suite passes **14/14**, exit 0,
  including the reviewed lifecycle correction described below. It bundles the
  real component in memory and exercises browser events, hooks and exports. HTTP
  response bodies are synthetic; actual browser network traffic is blocked.
  Read-only cases assert zero attempted mutations. No server is started.
- The first expanded run reported **12/13**, because a nested JSON-error injector
  serialized through Playwright referenced tsx's unavailable `__name` helper. Moving
  that injector into the already bundled fixture corrected the harness; product
  source and assertions were unchanged. The subsequent run passed **13/13**.
- An independent source review identified a pending-denied-signoff UI reset edge
  when a document tab changes. The existing modal permits keyboard focus on
  background tabs. A held, fixture-only HTTP 403 response reproduced a permanently
  disabled refresh button after PRD → RELEASE navigation: **13/14**, exit 1.
  Resetting signoff UI on both snapshot and selected-document changes fixed the
  cause; the final **14/14** run rejects the stale response and never reports a
  signed release. This one case exercises only a synthetic denial, with no real
  signoff route, evaluator mutation, audit write or authority operation. Ignored
  raw run logs are `runtime/report-truthfulness/r14-red.log` and
  `runtime/report-truthfulness/browser-green.log`; this record retains their
  outcome independently of disposable runtime storage.
- Final focused TypeScript `tsc --noEmit` passed, exit 0. `git diff --check` passed.
  At that focused checkpoint, production build/full regression, signed publication
  and actual CI/integration remained separate pending qualification. The later
  local combined results appear below; neither set claims candidate integration
  or release authorization.

## Reconciled-tree regression compatibility

The first complete run on `f1cc0255627fa9f986e5fa4ee70b383a6322225a`
finished at 2026-10-21T12:50:06.884Z with **81/82 suites and 2011/2013
checks passed**, exit 1. The two failures were scenarios 49 and 50 in the
50-case controlled-document version-sync suite. Quality checks had not yet run.
All 579 tracked/candidate source files retained identical before/after hashes;
their ordered SHA-256 manifest was
`79c12694260e03a4dfd1b1eca216ae1d79c6a353920795629c028f0d07871c6c`.

Both scenarios supplied an older incomplete release mock containing five partial
fields and no gates. It omitted existing real API identity, timestamp, capability,
audit-count and aggregate fields. Correct report admission rejected that mock,
so the tests timed out waiting for signoff entry. The actual evaluator's full
response already passes the pure compatibility test; admission is not loosened.
The same scenarios also preserve the factual `Governance Protocol: SEC-CTRL-020`
context after canonical data becomes stale. That label is restored alongside the
explicit separation of server evaluation, human authorization and evidence
authentication, without reviving the removed verification claims.

The fixture now uses the real evaluator with inert cloned Atlas seed inputs and
asserts that its seven-gate response is ready but unsigned. Only browser-fixture
project identity is remapped for these existing stale-snapshot scenarios; it does
not assert actual DOCMONSTAKRAKIN readiness or execute a signoff writer. The
otherwise unused POST response mock also retains the full response shape and
consistent Gate 7/aggregate fields. All existing scenario assertions, including
zero POST attempts, stale-response rejection, modal invalidation and recovery,
remain unchanged. The corrected actual controlled-document version-sync suite
passed **50/50**, exit 0, including both formerly failing scenarios. Its ignored
log is `runtime/final-reports-gates/version-sync-corrected.log`, SHA-256
`d2d1e75c5a13864038573e0c6c488fc74cc803eb54f0f52246b6fb00215220f3`.
The complete rerun remains pending at this checkpoint.

The complete failed run, all 82 suite logs, result JSON and source manifests are
copied to ignored `runtime/final-reports-gates/initial-full-failed/`. Retained
SHA-256 digests:

- Full log: `5b4bd53b4cd363e5413a4772df4c8e39de7fda1abf201a6640b8001a812080c0`
- Results JSON: `c87b7d266264db2c8fcc43b6b138fac65102d9397bc43d76c328ac8fe238d0d1`
- Failed suite log: `45a1d5cacc8a5b8fd8366275c544a81cd3b9542a5548e9b8fbc0593e5c8fd670`

## Final local combined qualification

On the reconciled `acdb3e2c1057262612766d7d98ab91c32b3c084b` baseline, a fresh
synthetic CI fixture and sequential complete regression/quality run started at
2026-10-21T13:02:06.2773343Z and finished at 2026-10-21T13:08:24.0983042Z,
exit 0. The process used qualified Node 22.23.3, the retained dependency fixture,
and the process-only Windows PowerShell module setup documented in README.
No install, package/lockfile modification, external credential or live authority
operation was performed.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/prepareCiRuntime.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/runCompleteRegression.ts
npm run ci:quality
git diff --check
```

- Complete regression: **83/83 suites, 2,054/2,054 named checks**, zero failures
  and zero skips under `NAMED_CHECK_PREFIXES/2` / result schema 2.0.
- The combined run includes Reports **11 pure/API/SSR + 14 browser** checks and
  the repaired version-sync **50/50** suite. Its scenario bodies/assertions are
  unchanged. Authentication pilot **41/41**, runner **12/12** and ordinary local
  product journey **9/9** also pass.
- Controlled documents: **40/40 core, 29/29 additional security and 11/11 focused**,
  with `LIVE SNAPSHOT MUTATION: NONE`. This is the actual full-run log; no redundant
  controlled-document rerun substitutes for it.
- WBS zero-drift check, TypeScript `tsc --noEmit`, Vite frontend and esbuild server
  builds pass. Vite retains the existing advisory for a chunk larger than 500 kB.
- All **598** tracked/candidate source files had identical before/after hashes,
  ordered SHA-256 manifest
  `623e9ab491afcee3ab085cdd0cd351261d19ced1ddd7ad013e12998f80c6bd34`.
  All 92 retained historical evidence files also remained unchanged. This
  results-only documentation addition follows the checked source snapshot;
  implementation and test bytes are unchanged after qualification.

The complete successful run, 83 suite logs, result JSON, preparation/build logs
and before/after source manifests are retained under ignored
`runtime/final-reports-gates/combined-pass/`. The original failure is retained
separately, not overwritten. Successful-run SHA-256 digests:

- Full log: `34a9252f58b82e3730edab23978ccffd96dcbc647a603f6a41af304fffb17379`
- Results JSON: `6b4d659e500e68e975c5f4eaa17def3bfe0fd192a2c2cab894a88e397ae64d6f`
- Quality log: `b5a33975c6bd910befa1270f2af19909023f765f7d45e1d3b66de56aa4873992`
- Combined version-sync log: `fb8e177bba179c6e58f5a5fb681b7a88f0bcb11fcdf62a1f1d3459bcc54a1acb`
- Controlled-document log: `3876af23f91ffa871d50d3c70e57a5824baa1b883807bdd3572b901a1312c533`

This is local qualification of the seven-path candidate. Its signed publication,
candidate CI and eventual actual post-merge CI remain separate work.

## Remaining boundaries

The authorized handoff addition replaces the README's stale AI Studio / required
Gemini-key quick start with the actual credential-free local workflow. Commands
and links were checked against master `21da1d5bebaecf58b5037c255561c8b8315b429d`,
its `LOCAL_PRODUCT_DEMO.md`, package scripts, CI workflow, native compatibility
record, network boundary and synthetic runtime initializer. The README explains
qualified patched Node 22 x64/native prerequisites (including the 22.12.0 package
engine floor), the required process-only Windows PowerShell account-fixture
setup, hosted versus operator Windows qualification,
disposable demo/test state, ordinary startup, and unchanged security/release
limits. This documentation does not claim a fresh installation or rerun of the
demo/full suites. No installer, package/lockfile or production configuration is
changed. Master's demo files are now present after the normal fast-forward;
these links and commands refer to the reconciled checkout.

DMK-202 remains open: backend Gates 1–5 still use their existing heuristics,
including requirement approval/status checks and the Atlas golden-project rule.
This candidate prevents additional fabricated UI/export success; it does not make
those heuristics authenticated evidence or close the release evaluator task.
DMK-206 evidence registration and DMK-207 deterministic project-health calculations
are not implemented or closed here. Human review, canonical transitions, Gate 7
and release authority remain independent.

Historical reports and failures are preserved. No prior test result, receipt,
timestamp or approval is rewritten by this record.

## Publication baseline checkpoint

Before publication on 2026-10-21, this branch normally fast-forwarded from
`acdb3e2c1057262612766d7d98ab91c32b3c084b` to verified master
`59fea80b9374a7e90b0d4f855df6ede09aa350c8`. The nine incoming PR #61 paths
do not overlap this seven-path candidate; implementation and test bytes are
unchanged. Actual master CI [39605514442](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39605514442)
passed four jobs and 82 suites / 2,085 checks. The earlier local 83-suite /
2,054-check result remains evidence for its explicitly recorded `acdb3e2` base;
it is not relabeled as qualification of the newly combined tree. Candidate CI
and actual post-merge CI must independently check the combined tree.

The operator explicitly waived the ordinary development human-review gate and
authorized normal merges for this completion campaign. Agent inspection is not
a GitHub human APPROVED review. This waiver does not establish operational
governance authority, activate authentication or execute Gate 7.
