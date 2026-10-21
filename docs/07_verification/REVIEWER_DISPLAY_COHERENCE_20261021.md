# Reviewer display coherence candidate — 2026-10-21

## Scope and baseline

This separate candidate begins at signed, pending UI integration commit
`1acf2a543a5add8894c0f4baecbb81a56db8158d` on
`codex/final-reviewer-display-coherence`. It uses the clean task-owned
`campaign-release-claims` checkout; the older repair branch and runtime evidence
remain preserved. This is not a claim that the baseline is verified actual master.

The five permitted paths are `src/App.tsx`,
`src/components/ReviewerSession.tsx`, `src/components/ApprovalsView.tsx`,
`scripts/testReviewerDisplayCoherence.ts`, and this note. Server endpoints,
credentials, cookie policy, grants, quorum and all authority writers remain
outside scope. The existing standalone ReviewerSession 19-case suite and
governance inbox 25-case suite are preserved unchanged.

## Design and test-first boundary

The existing header and inbox fetch reviewer identities independently. Header
logout or sign-in does not invalidate the inbox's cached name, identifier or
roles, and an older inbox response can later overwrite a newer observation.

The proposed correction makes App own a display revision and observation phase.
Optional header callbacks invalidate the shared display revision at mutation
start, and distinguish observed completion from uncertainty. Inbox observations
must match the current revision and project. Session reads will be bounded,
abortable and generation-fenced through body decoding, with a validated server
identity shape. These are display observations, never authorization tokens.

An explicit inbox re-check will ask the header for a bounded fresh read, then
permit a new inbox read after confirmation. It will not start reads during a
pending mutation, retry credentials automatically or infer rejection from a
timeout. Invalidation resets only the local human-confirmation checkbox, so a
previous reviewer context cannot leave checked consent behind. Server decision
payloads, quorum calculation and signing behavior are unchanged.

The new suite mounts the actual App, ReviewerSession and ApprovalsView with
synthetic API transport. It covers confirmed Alice-to-logout-to-Bob transitions,
pending mutation invalidation, old inbox responses, uncertain failures and
explicit recovery, malformed identities, held headers/bodies, confirmation reset
and unmount isolation. Abort is deliberately ineffective in the session fixture
to test the state fence. All authority mutation routes are blocked and counted;
no live server, roster, session cookie, credential, canonical project store or
governance decision is created.

At this checkpoint only the test and this note are written. RED has not run;
runtime implementation, focused GREEN, unchanged standalone regressions,
complete regression, quality/build and exact-candidate hosted CI remain pending.

## Implemented behavior and focused evidence

App now owns a monotonic display revision, observation phase and explicit
re-check token. The header reports checking, pending, confirmed and unknown
observations through optional callbacks. The inbox admits only a successful,
validated human-reviewer display identity from its current revision/project;
an older observation is hidden immediately during rendering, before effect
cleanup. Unknown and confirmed-null are visibly distinct. Every inbox read
bounds transport plus JSON decoding at 20 seconds and retains generation,
project, revision, phase and mounted fences even when abort is ignored.

Refresh explicitly requests a bounded header re-check; a confirmed header
observation then permits an independent inbox read. During a mutation it is
disabled and programmatic re-check admission is rejected. Read-effect cleanup
only invalidates its own still-current read; mount cleanup separately cancels
the active operation. This prevents a re-check queued immediately before a
mutation from cancelling that mutation or starting a competing session read.
Invalidation resets the local human-confirmation checkbox. Server routes,
decision bodies, quorum evaluation and authoritative signing are unchanged.

The actual-App original RED was **1 passed / 8 failed**, exit 1, at
`2026-10-21T14:57:21.0091346Z`–`2026-10-21T14:57:36.1553532Z`. The first
implementation run was **7 passed / 2 failed**, exit 1. Investigation showed
that the fixture intercepted only the obsolete first StrictMode read; the
second valid Alice response legitimately remained visible in two cases. The
fixture was corrected to intercept both reads without weakening assertions.
The original three runtime files were restored byte-for-byte from the baseline
for a second RED, **1 passed / 8 failed**, exit 1, at
`2026-10-21T15:01:10.4051709Z`–`2026-10-21T15:01:25.0342560Z`. Restoring the
exact first implementation then produced **9/9 PASS**, exit 0. Both initial
runs, the initial test bytes, and the saved implementation remain preserved.

Before broader qualification, a tenth test reproduced the queued
Refresh-then-logout lifecycle race: **9 passed / 1 failed**, exit 1, at
`2026-10-21T15:03:38.2098689Z`–`2026-10-21T15:03:53.5804594Z`. Separating
mount cleanup from per-read cleanup fixed that race. The identical ten-case
test then passed **10/10**, exit 0, at
`2026-10-21T15:04:21.8273855Z`–`2026-10-21T15:04:37.1727023Z`. TypeScript
`--noEmit` exited 0 at `2026-10-21T15:04:51.9425458Z`; diff checking passed.

| Frozen file or retained log | SHA-256 |
| --- | --- |
| `src/App.tsx` | `1cb3c90092491d9fecc629a610161ec390439bdfd1aa29ddf0a8836cf92d5707` |
| `src/components/ReviewerSession.tsx` | `7f175cf26a86d7911200b7cb24bd6f736b3dfa0b6118048606eb7610a7eb676e` |
| `src/components/ApprovalsView.tsx` | `fa5d36a8cd1bb0ecd7df9eaed49dc38b3248669d1bcfa678e25e9e651f74eb69` |
| Ten-case test, unchanged between race RED and GREEN | `76476a22f0925ff8e2708f995f87fcee0e1ad5bf1157745636f7f72534b72d61` |
| Original `red.txt` | `4abcc580e0970e07dad9d296f5c13d6d8a846d0f1efe90d24282a2a972eee87d` |
| Corrected-fixture `red-strict.txt` | `0e3d23ec1528e0c17c7deeda44e92d21bebcd739a5be3a0a8833ee142ca8c061` |
| `green-strict.txt` | `4a39d10a16def7368d0adbe0c5ad2abcc2c6e0685b71bcc686dc9987b8bc647d` |
| `race-red.txt` | `7b0a8eada0440c78895ea1bc81ca495027eb3872f57e7cfc991052ab9e9016ed` |
| `race-green.txt` | `16fb24832fa3ce04c7dd35d276e5ea5a5cd274b9dd904f5cd839a72d74acacd4` |

These files and all phase receipts are retained under
`runtime/reviewer-display-coherence/`. No failure log was overwritten.

The branch normally fast-forwarded through seven disjoint baseline paths to
signed pending Discovery candidate `c6d6e3fde57166309d1153fe6557ebd6d5af8ace`.
All five candidate files retained identical bytes through that reconciliation.
The tenth-case RED/GREEN was run on this combined pending baseline; it is not
represented as verified actual master. Full regression and quality are next.

## Limits and remaining gates

This coordinates mounted App display observations, not server authority or
cross-tab cookie outcomes. The header and inbox still perform separate reads;
the server checks every protected action independently. An external session
change without an in-app event may remain unknown until an explicit re-check.
A timeout cannot establish whether a server mutation committed. No operational
identity, trust, canonical governance, release approval or auth activation is
created by this candidate. Independent source review, final combined local
qualification, exact-HEAD hosted CI and actual post-merge verification remain
separate gates owned by root.

## Complete local run before the final reissue-consent correction

The frozen ten-case candidate on `c6d6e3f` completed fresh synthetic preparation,
complete regression and sequential quality checks from
`2026-10-21T15:05:41.0709708Z` to `2026-10-21T15:14:41.8336523Z`:
**94/94 suites and 2,251/2,251 named checks passed**, zero failures/skips.
Prepare, WBS synchronization, TypeScript, frontend build and server build all
exited 0. Current result entries include coherence 10, unchanged standalone
ReviewerSession 19, unchanged governance inbox 25, auth pilot 41, recovery 24
and session capacity 18. The actual current controlled-document log retains
40/40 core, 29/29 additional and 11/11 focused suites, zero active transactions,
28 unchanged registered documents and `LIVE SNAPSHOT MUTATION: NONE`.

The source/index manifest stayed
`cf47a850e05ce4663f93c1b54d4879beb10dd59938f2f9b35f397c675ec0b32b`;
the fresh synthetic snapshot stayed
`0e8b1ee6a4475c0902022274422c8e11c25bca1d185170fe140869367cb5a276`.
All **104** retained artifact hashes were independently recomputed without a
mismatch. Evidence is under `runtime/reviewer-display-full-c6d6e3-20261021/`:

| Artifact | SHA-256 |
| --- | --- |
| `verification.json` | `72718d5c5ed70629d14e315273567ca365efcc8441fef78c0776d40959be8ae8` |
| `complete.txt` | `7850b8756314755895014c7134a99054f9204442efb828279086b84c166966e9` |
| `quality.txt` | `c98d9512815def505cb9f78186c8be8deed983bcef35b16b7cfa63c657cc07ed` |
| `regression/results.json` | `ee5f4e248ad34be7f3663382ced8e38303114ac42031282b1a690855fbe8c839` |

This is explicitly **pre-correction local full evidence**. During the frozen
run, independent review found a P2 local-consent gap: the decision checkbox
reset on reviewer invalidation, but the separate governed-reissue checkbox did
not. An open reissue dialog could retain the prior reviewer's checked local
attestation. This was not an endpoint authorization bypass; the accepted fix
remains inside the same five paths and does not modify server policy or writers.

## Final reissue-consent RED/GREEN and focused regression

After that full run finished, C11 was added without changing runtime behavior.
It opens the actual governed-reissue dialog against an explicitly malformed
synthetic stored-signature fixture, enters justification and checks consent.
It then exercises held logout, failed logout, successful logout and an explicit
re-check observing Bob. It checks that the old consent is cleared and the
reissue button requires fresh confirmation. Authority-write routes remain
blocked; no reissue is submitted by this new display test.

The expanded suite reproduced **10 passed / 1 failed**, exit 1, from
`2026-10-21T15:15:17.5994119Z` to `2026-10-21T15:15:34.1263169Z`.
Implementation then added only `setReissueConfirmed(false)` beside the existing
decision-confirmation reset. The identical expanded suite passed **11/11**,
exit 0, from `2026-10-21T15:15:55.6660079Z` to
`2026-10-21T15:16:14.5868534Z`. The unchanged existing governance inbox suite
then passed **25/25**, followed by TypeScript exit 0, ending
`2026-10-21T15:16:42.9240604Z`; all runtime/test bytes stayed unchanged during
those focused checks. The App and header bytes remain those from the complete
run, including its standalone ReviewerSession 19/19 result.

| Final file or evidence | SHA-256 |
| --- | --- |
| Final ApprovalsView | `198e4b999cc776c2221530915a50dbde62522147cb09c9c967f3d302289c3ab2` |
| Final eleven-case test, identical between consent RED/GREEN | `b0506402f566265cf9b5f50b2f6f2285e672159cb6c6546d50fffd7727f7fba5` |
| `consent-red.txt` | `bf758d7a38b9c923103939ab8d6f34736e7cbb1e99bedd5643883a95ad38feaa` |
| `consent-green.txt` | `f7e428cbc85272d44850d230aad9a40b0fd1f4fbf4fe0b5292d96521ee597780` |
| `governance-final.txt` | `6a500c8ea982951cd6168187a508774d24dd99d130f67218432a1a10159d3809` |
| Empty successful `typescript-consent-final.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

All phase logs and `final-checks-receipt.json` are retained in the focused
evidence directory. Final exact-source full qualification remains required:
root owns the signed candidate's hosted Complete Regression, all four required
CI jobs and actual post-merge verification. The historical local 94/2,251 run
does not claim coverage of the later one-line correction or eleven-case suite.
The expected next full count is 94 suites / 2,252 named checks; that is an
expectation only until actual hosted results are inspected. Fresh independent
review of the final consent correction has been requested. No production or
human operational-governance authority is granted by this handoff.

The independent reviewer subsequently confirmed the P2 finding resolved with
no new actionable findings. Removing only the new reissue-reset line reproduced
the exact previously reviewed ApprovalsView hash; App and header hashes stayed
unchanged. The reviewer inspected C11's held/failed/successful logout and fresh
Bob recovery assertions, verified retained RED/GREEN hashes and source
invariance, and ran no tests or edits. The completed governance 25/25 and
TypeScript results are recorded above. This is technical source review, not a
new human governance approval. The five candidate paths are now frozen for
root-owned signing, final hosted gates and actual post-merge verification.
