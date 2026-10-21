# Local product journey and disconnected document creation candidate

Baseline: `148be8892b37aaf1944aca0c0671b6a948192f38` (PR #58 integration).
This Workstream D candidate contains product planning changes and synthetic tests.
It does not activate authentication, trust roots, WBS registration, agents or release.
Its fixture-isolation dependency is separately reviewable in
[PR #62](https://github.com/Jeruzael/docmonstakrakin/pull/62), signed commit
`1b636b74f9700811fa72cde2e3f63ca375bc6a92`. That dependency is not assumed merged.

## Implemented changes

- Work Management offers **Propose linked task** for ordinary external projects.
  The existing POST WorkItem endpoint accepts `DERIVE_REQUIREMENT`, a governing
  requirement ID and exact `expectedStateVersion`. The server selects all task
  attributes. The task starts `PROPOSED`, with empty tests/evidence, and both real
  requirement/task links persist in the existing atomic project transaction.
  Re-derivation with the current state version returns the existing task without
  duplicate audit. An exact network replay carrying the old version is rejected
  as stale; this is not a replay-receipt engine. Stale versions,
  client status/identity/path claims and canonical self-project derivation fail.
- Re-answering discovery preserves real reciprocal task links for retained
  requirement IDs. It does not silently rewrite previously planned tasks. If a
  requirement is withdrawn, existing tasks remain historical planning records;
  task-context compilation rejects a missing governing requirement. A human
  must reconcile changed scope; this is not automated task approval or deletion.
- Dashboard no longer unconditionally labels incomplete projects "On track" or
  "Compliant". It identifies stored planning scores and separates actual review,
  verification, compliance and release evidence.
  TopBar labels the local workspace rather than displaying a hardcoded person;
  the actual reviewer-session identity remains in its separate existing banner.
- The disconnected document creation factory allocates its own private fixture,
  accepts no caller filesystem/registry authority, and creates one fixed external
  controlled document. It uses the existing real reviewer session check plus
  HUMAN/role defense, explicit confirmation, content validation, compare-and-swap,
  a journal and an atomic content/registry/audit state object. Normal `server.ts`
  does not import or mount this factory. The ordinary product creation feature
  remains unavailable; the creation pilot is implemented and operationally inactive.
- Browser test servers use distinct OS-selected positive ports and owned optimizer
  caches. Vite 6 treats configured port zero as a fallback to 5173; the shared test
  helper retries only the bounded port acquisition race and never stops listeners.
- Actual-server fixtures preload the existing encrypted fallback in a pinned,
  freshly generated workspace before importing normal server code. A test-only
  denial tripwire forbids default native credential acquisition before OS probing.
  Environment inheritance is allowlisted. Empty provider environment alone was
  insufficient: the original startup could still query the operator's native
  keychain namespace. No secret value was printed or provider request performed
  in the earlier qualification; those runs do not prove native-store isolation.

## Acceptance matrix

| Journey / condition | Actual entrypoint exercised | Result / boundary |
|---|---|---|
| Create and initialize project | Real ProjectWizard, App and POST `/api/projects` | Persists DISCOVERY project, initial work and zero release readiness |
| Adaptive discovery | Actual questionnaire click and `/answers` | Proposed requirement and incomplete canonical coverage persist |
| Conditional branch changes | Real question/answer APIs | Recovery question appears/retracts; hidden-question answer is rejected |
| Link planning work | Real WorkView action and POST `/work-items` | Proposed task, reciprocal links, CAS, current-version re-derivation; stale replay denied |
| Board status update | Real drawer and existing update endpoint | IN_PROGRESS persists; anonymous VERIFIED is denied |
| Prompt handoff | Real `/compiler/compile` | Includes real linked requirement/task; no provider credential or request |
| Missing governing work | Real compiler | Handoff remains blocked |
| Controlled living-document save | Existing self-project registry/router/transaction | Valid synthetic content saves with actual synthetic HUMAN session |
| Save denials | Existing router and identity middleware | Anonymous, AGENT, unconfirmed, invalid and stale operations rejected |
| Ordinary external-document creation | Existing registry and unregistered paths | **UNAVAILABLE**, empty registry / 404; no authority expansion |
| Disconnected controlled creation | Separate factory and actual Express HTTP fixture | **IMPLEMENTED / INACTIVE**, fixed synthetic external document only |
| Creation safety | Actual HTTP + trusted fault injection | Invalid authority, paths, self-project, replay, CAS, replaced directory and hardlink rejected |
| Creation recovery | Journal and exact state digests | Pre-commit fault leaves no document; post-commit uncertainty recovers committed state |
| Evidence and audit | Real evidence/audit APIs and actual browser audit tab | Fixture evidence stays UNTRUSTED; save event/chain displayed |
| Capture new run evidence | Actual browser screenshots and acceptance JSON | Reproducible runtime artifacts; ordinary product evidence registration remains unavailable |
| Health projection | Real Dashboard and SSR regression | Planning data cannot assert compliance or release approval |
| Restart recovery | Actual child server termination/restart | Work/document persist; previous reviewer session is fenced |
| Release evaluation | GET `/release/gates`, byte-level read-only assertion | `releaseReady=false`, `signedOff=false`; Gate 7 remains HUMAN_APPROVAL_REQUIRED |
| Privileged capabilities | Existing route policy | Secret administration and agent dispatch remain denied |

## Verification and reproducibility

Run from a normal checkout with the committed lockfile installed and a Playwright
Chromium browser (or set `DMK_TEST_BROWSER` to an existing Chrome/Edge executable):

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testRequirementWorkDerivation.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testProductReadinessProjection.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testSyntheticDocumentCreation.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testLocalProductJourney.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testIsolatedViteFixtures.ts
node --import ./node_modules/tsx/dist/loader.mjs scripts/testSyntheticServerIsolation.ts
npm run ci:quality
npm run ci:controlled-docs
npm run ci:regression
```

New test scripts are automatically discovered by the complete regression runner.
Run full browser/build suites sequentially on a resource-constrained Windows host.
The actual browser journey builds the real App into a generated workspace, runs
the real production-mode server with an allowlisted environment, and blocks all
non-loopback browser traffic. It reads/copies registered source evidence without
modifying original records. Only synthetic identities/passwords are configured.

Generated `runtime/product-demo/acceptance.json`, `discovery-health.png` and
`document-audit.png` are new run outputs. They are not historical receipts.
All fixtures remove only their marked owned temporary roots at normal shutdown.

Focused initial results: requirement/work 6 checks; readiness 2; creation 8;
actual browser/API journey 8, with additional canonical/conditional checks included
in the final candidate. RED evidence included missing derivation (422), lost
task backlinks after re-answer, false dashboard assertions and missing creation
authorization (501). These failed before the corresponding implementation.
The first browser harness waits were corrected to real DOM readiness and exact
validator-compliant fixture content, without changing the product assertions.

An independent source review found that owner-marker admission originally read
the marker before checking its type and size. Actual Windows file-symlink and
oversized-marker tests reproduced that read. A second race test reproduced one
target read after replacing the marker between admission and open. The corrected
guard checks parent/root identities before ACL/writes, checks the marker before
opening, compares the descriptor identity before reading, and reads at most 65
bytes. The 11-check creation suite passed, with zero target reads for static links,
oversized markers and the replacement race. Windows without file-symlink permission
uses an actual directory-junction negative case; it is identified in test output.

The reproduced signoff failure had `Total Passed: 8 / 15`, `Total Failed: 0`
and process exit 0. With the correction, the same absent-browser fixture reports
missing scenarios `C, D, E, G, K, L, M`, records failures and exits 1. The genuine
browser run subsequently observes all 15. These are observed scenario outputs;
compound scenarios contain additional individual assertions.

Reproducibility failures are retained: initial concurrent Vite fixtures collided
at 5173; a later four-browser batch alongside other campaign suites exceeded
Windows commit memory (`VirtualAlloc errno=1455`) and caused timeouts. A passing
single focused component run (28 checks) does not erase the failed batch. Final
serial quality/full/controlled results must accompany the published candidate.

The historical signoff suite could catch a browser startup failure, print eight
of fifteen scenarios, and exit successfully while its banner claimed all fifteen.
Using an intentionally absent synthetic browser executable reproduced exit zero
and eight passes. The corrected harness exits one, reports the missing seven
scenario IDs, and requires unique completion of all A–O scenarios. Earlier eight-
output qualification remains historical and is not silently reclassified as full
browser coverage. The affected test assertions and reviewer contracts were kept.

The secret bootstrap also rejected an actual substituted fixture junction before
writing outside the original directory, and bounded the read of an existing
preload to its exact generated size. Its original implementation had adopted the
junction's canonical target; that negative test failed before the correction.

Creation additionally admits the complete serialized state before committing.
Escaped-content expansion previously caused an uncertain 500 after committing an
oversized state; it now returns 422 with the empty state intact. State and journal
reads also use admitted descriptors and bounded buffers.

An actual malformed-Unicode negative found that escaped unpaired UTF-16 surrogates
could hash to the same UTF-8 bytes as U+FFFD. Creation now requires lossless UTF-8
content and reason before mutation, and checks every parsed state string and key
before verifying its digests. The existing universal document validator is
unchanged. The focused creation suite passes 14 named checks, including rejection
without mutation and stored content/audit replacement-character alias attempts.
An in-flight development regression picked up the new negative before the fix:
76/77 suites and 1,941/1,942 named checks passed. Its source changed during the run;
it is failure evidence, not immutable candidate qualification.

The final local qualification uses Windows x64 and a process-only portable Node
22.23.3 (official executable SHA-256
`9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e`).
Earlier focused results used Node 22.21.1. Dependencies are a retained private
fixture reached by a new task-owned junction; no install ran through that junction.
The prior physical task dependencies were retained outside the source tree.
Neither this evidence nor the retained native binaries establish a fresh install
on Windows or Linux. No operator SDK, global package, original dependency junction
or credential store was modified.

Final local results, after the lossless-text correction:

| Verification | Observed result |
|---|---|
| WBS integrity, TypeScript and production build | PASS, 09:06:28.774–09:06:52.613Z; existing large-chunk warning remains |
| Controlled-document security matrix | PASS, 08:57:25.556–08:58:24.137Z; core 40/40, additional 29/29, focused 11/11; snapshot mutation NONE |
| Complete regression | **77/77 suites, 1,943/1,943 observed named checks**, no failures/skips, 09:06:52.713–09:13:46.094Z |
| Actual browser/API journey | 9 named checks |
| Requirement/work derivation and persistence | 7 named checks |
| Readiness and identity rendering | 3 named checks |
| Inactive controlled creation | 14 named checks |
| Native-credential fixture isolation | 5 named checks |
| Concurrent isolated Vite fixture | 1 named check; two actual HTTP servers |
| Existing browser fixtures | Approval inbox 25; workspace tabs 14; controlled view 28; projects 14; version sync 50; signoff 15 |

The controlled matrix preceded the final encoding-only creation-pilot correction;
the final complete regression reran that matrix successfully. The code/test source
was frozen before final quality/full verification. The first 28-path SHA-256
manifest was captured 16 seconds after full-run start; every file's last-write time
predated start. The final manifest is byte-identical, SHA-256
`a90c97780af3bd0b921d6b7f8affa19e2aa263fe36adb10d696b80bd76e182cd`.
This timing qualification is retained; exact signed-HEAD GitHub CI is still required.

The complete regression report SHA-256 is
`938eb8811e31a8493fc2d4c1b753d49a0907f495ad1faf2cd0c24ccddf46a779`.
The final browser acceptance JSON SHA-256 is
`11a6d6ac6f2e5a6de094c5265df2f2aa0d7e3ef9771b994a1abfe2c66d61c55a`.
It records incomplete discovery (1/22 mandatory answers resolved, 5% coverage),
`releaseReady:false`, `signedOff:false` and no browser errors. Run artifacts are
regenerable outputs, not independent human review or immutable historical receipts.
The full local run used the combined infrastructure/product working tree; it does
not substitute for CI on either separately published commit.

## Security limits and rollback

Ordinary project APIs are still legacy local, unauthenticated and unscoped. This
candidate does not convert planning access into general requirement authorization.
Synthetic HUMAN fixtures prove contract behavior, never independent human consent
or operational appointment. The creation resolver is trusted application injection;
it must not be constructed from an HTTP caller or an activation environment flag.

Creation limits (one document, 64 KiB content, 128 KiB state, 1,024-character reason)
are candidate test boundaries, not ratified production policy. Content lives inside
one atomic JSON state object; this is not a canonical Markdown registration/apply
engine. Tests cover process failure points and recovery, not power-loss durability,
disk exhaustion, durable recovery after a real OS crash or malicious same-owner
processes. Hash chains need independent checkpoints to resist complete rewriting
or tail truncation. No production trust/recovery policy follows from this pilot.

Rollback the reviewed code changes through the normal protected workflow; no
canonical WBS, historical receipt, real identity, credential or installation
migration requires reversal. Retain any external project's existing proposed tasks
and audit history rather than deleting them. Disable/remove only the disconnected
demo entrypoints if the candidate creation interface is rejected.
