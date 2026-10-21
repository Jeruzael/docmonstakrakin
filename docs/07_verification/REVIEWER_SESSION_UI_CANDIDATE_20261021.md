# Reviewer session display and request sequencing candidate — 2026-10-21

## Scope and authority

This candidate is prepared on `codex/final-reviewer-session-ui` from verified
master `59fea80b9374a7e90b0d4f855df6ede09aa350c8`. It changes only
`src/components/ReviewerSession.tsx`, adds `scripts/testReviewerSessionUi.ts`,
and records this verification note. It is not yet a published or merged result.

The existing `/api/governance/session` contract and server-controlled reviewer
roster remain authoritative. GET returns an identity or null; successful POST
returns an identity; successful DELETE returns null. POST can reject with
401/403/429, and DELETE can reject with 403. This patch changes no endpoint,
credential, cookie, session duration, role assignment, quorum or authorization
policy. It neither installs nor activates the disconnected authentication pilot.

## Changed behavior

- A response must have successful HTTP status and a valid display identity:
  nonempty string name and string-array roles. POST additionally requires a
  non-null identity, and DELETE requires null. Only name and roles enter display
  state; malformed JSON and malformed shapes produce a bounded visible error.
- Starting a mutation invalidates the initial GET generation and aborts that
  read. The generation check remains decisive even when cancellation is ignored.
  Effect cleanup also invalidates obsolete responses, including React Strict
  Mode's repeated setup/cleanup.
- An immediate ref guard serializes mutations before React rerenders. Pending
  controls are disabled. Submitted passwords are cleared when the POST body is
  captured, and again on completion; the deadline follow-up below bounds waiting.
  Server response error strings are not reflected into the UI.
- Failed or uncertain logout preserves the last observed display identity with
  a **Last confirmed reviewer** label and an explicit unconfirmed-outcome error.
  It does not claim that a session definitely remains active: the server might
  have committed logout before its response was lost. Retry remains available.
- An initial read failure is visible as unknown session status. Fixed sign-in
  messages preserve credential, origin-rejection and throttling guidance without
  accepting arbitrary server error text.

## Test-first evidence

The new suite bundles and renders the actual component with React in a real
headless browser. Only fetch is substituted with deferred responses; cancellation
is deliberately ineffective to test the generation fence. All actual network
requests are blocked. No application server, configured roster, session cookie,
operator identity, application store or persisted authority is created.

The suite reports 15 named compound checks covering:

1. Late initial signed-out response after successful sign-in.
2. Late initial identity after successful sign-in and sign-out.
3. Non-success GET containing a plausible identity.
4. Six malformed identity shapes, including non-array and non-string roles.
5. Four malformed successful POST responses, including null and invalid JSON.
6. Six failed POST responses, including 401/403/429, arbitrary error text and a
   lost response; password clearing and retry are checked.
7. Same-turn duplicate form submissions.
8. Pending input, submit and form-toggle controls.
9. HTTP 403/500 logout failures retaining explicitly uncertain identity.
10. Four lost or malformed DELETE responses.
11. Duplicate DELETE clicks followed by confirmed successful logout.
12. Unmount/remount with an obsolete read.
13. Strict Mode cleanup with an obsolete read.
14. Display-only fields and the username/password-only POST request contract.
15. Network and invalid-JSON initial read failures.

RED ran against the unchanged baseline component from
`2026-10-21T13:34:42.8882641Z` to `2026-10-21T13:34:54.1239714Z`:
**2 passed, 13 failed, exit 1**. The failures reproduce the expected defects;
unmount/remount isolation and display-only successful request behavior already
passed. Implementation began only after this run completed.

Evidence is retained without overwriting older PR60 evidence at
`runtime/reviewer-session-ui-20261021/`:

| Artifact | SHA-256 |
| --- | --- |
| Unchanged baseline component, before and after RED | `b3423c16c11d6b6c8f03d0f28de33b761b421870010e19025b31acbba281d7ec` |
| Test source, before and after RED | `a32d0c779a3a84430367d178b3405596538694aebc6c68d2a7daef567d0a95f5` |
| `red.txt` | `551ed5511347a3c6e925b667c73e8db1fcd90c1351447d31937b7d70c096daa3` |

Command: portable Node v22.23.3 with `CI=true`, an empty process
`GEMINI_API_KEY`, `--import ./node_modules/tsx/dist/loader.mjs`, and
`scripts/testReviewerSessionUi.ts`. No dependency installation or mutation was
performed. At the RED checkpoint, GREEN and broader checks were still pending;
the subsequent focused result is recorded below.
The complete runner discovers this new `test*.ts` suite without configuration
changes.

## Focused GREEN and independent source review

The first GREEN ran from `2026-10-21T13:43:02.6463804Z` to
`2026-10-21T13:43:15.8244756Z`: **15 passed, 0 failed, exit 0**. All response
matrix variants executed. No assertion or implementation correction was needed
after the RED-to-implementation change. Source and test hashes were identical
before and after GREEN; the test hash is also identical to RED.

| Artifact | SHA-256 |
| --- | --- |
| Tested component | `eebb2f60b4c516303c2a0eabfdadff6c26e64bcdd3b562c19a9e856c1c5dc5fc` |
| Unchanged test source | `a32d0c779a3a84430367d178b3405596538694aebc6c68d2a7daef567d0a95f5` |
| `runtime/reviewer-session-ui-20261021/green.txt` | `4d45647168ba78a850cbe63f7219271d4f6400ae2a4da13cba0b88419b9dde48` |

An independent agent reviewed the actual server contract, request and cleanup
fences, mutation guard, null/non-null admission, bounded messages, password
clearing, uncertainty label and retained RED evidence. No actionable source
issue was found; that read-only review ran no tests and is not human approval.
The 13.178-second local browser observation is not an operational performance
budget. Typecheck, complete regression, quality/build, final baseline
reconciliation and exact-candidate hosted CI remain pending and root-owned.

## Limits and remaining integration work

These are UI contract tests, not end-to-end authentication or server logout
proof. The component cannot determine a committed server outcome from a lost
reply. Serialization and sequencing cover this mounted component; cross-tab,
other-component and obsolete unmounted mutation cookie effects require server
authority and are not changed here. No automatic credential retry is introduced.

`ApprovalsView` maintains separate session display state, performs its own GET,
and joins roles independently. Its validation and refresh behavior remain outside
this three-path patch. This candidate does not claim a synchronized global
session store, live expiration detection, or corrected state in other views.

The operator's ordinary code-review waiver is not a new reviewer approval of
this candidate. Root retains commit, publication, merge and final verification
ownership; production activation and operational authority decisions remain
excluded.

## Initial complete qualification and bounded-wait follow-up

The three candidate files retained identical bytes during an ordinary
fast-forward from `59fea80` to verified actual master
`ef160d4dea3122309687b1f44bb8972c07e879a5`. A fresh task-owned synthetic CI
runtime was prepared. Previous current-run logs were moved into a separate
archive, preserving the earlier PR60 evidence and process npm shim.

This first complete run, before the bounded-wait follow-up below, ran from
`2026-10-21T13:49:46.9466574Z` to `2026-10-21T13:56:52.5492268Z`:
**84/84 suites and 2,124/2,124 named checks passed**, with zero failures/skips.
Prepare, regression, WBS, TypeScript, frontend build and server build all exited
0. Current report entries include reviewer UI 15, auth pilot 41, recovery 24,
native foundations 35, path protection 7 and synthetic WBS 56. The controlled
document suite also passed and retained its zero-mutation snapshot result.

The full tracked and untracked candidate source/index manifest SHA-256 was
`6b69018bd36619479e45e4bf639ce2ded6467bb622d85742c9c19b8206c57ed6`
both before and after. The prepared project snapshot SHA-256 remained
`c82267a04b2d2e13e0197abb7e0b83d28b130905c2bfdb4c08841f928a8a1bc2`.
All **94** recorded artifact hashes were independently recomputed without a
mismatch. Complete stdout, all 84 current report-listed suite logs, results,
manifests and quality output are retained under
`runtime/reviewer-session-full-ef160d4-20261021/`; its `verification.json`
SHA-256 is `75b6fc0f1e9ca7eea8cabfa15edaaaf1423666944cfddef45f30fdd4a7d802d8`.

During that frozen run, root identified an uncovered limitation: a hung fetch
or response body can keep mutation controls disabled and retain the submitted
password indefinitely. The completed evidence above remains attributed to the
15-case candidate. A narrow follow-up within the same three files is authorized:
20-second deadlines for GET/POST/DELETE, password clearing and usable controls
after timeout, explicit unconfirmed outcomes, cancellation and late-completion
fencing, and no automatic retry. New held-response RED/GREEN tests and a fresh
final complete qualification remain pending. Timeout must never be presented
as proof that the server rejected or rolled back a mutation.

## Deadline follow-up: actual RED and GREEN

Four additional named compound checks retain all original 15 assertions:
held initial GET followed by a successful manual sign-in; held POST followed by
a fresh manual sign-in; held DELETE followed by manual logout and a new sign-in;
and GET/POST/DELETE responses whose headers arrive but JSON bodies never finish.
They check visible uncertainty, released controls, cleared passwords, abort
signals, no automatic retry, and isolation from late replies or bodies. The
browser clock advances 20,001 milliseconds for these deadline observations.
Transport cancellation remains deliberately ineffective in the fixture.

The expanded suite first ran against the unchanged 15-case implementation from
`2026-10-21T14:14:29.4528735Z` to `2026-10-21T14:14:44.2461045Z`:
**15 passed, 4 failed, exit 1**. Each new check reproduced missing visible
uncertainty at the deadline. Only after preserving that RED did implementation
change. The identical expanded test source then ran from
`2026-10-21T14:15:47.8530842Z` to `2026-10-21T14:16:04.0002042Z`:
**19 passed, 0 failed, exit 0**. TypeScript `--noEmit` exited 0 at
`2026-10-21T14:16:18.2252341Z`; `git diff --check` was clean.

The shared local wait now bounds fetch and identity-body decoding together at
20 seconds. Timeout aborts locally and rejects that wait even if the transport
ignores abort. GET, POST and DELETE retain fixed unconfirmed-outcome errors;
only observed HTTP responses select credential/origin/throttle guidance.
Starting a mutation or unmounting aborts the active local wait. Generation and
mounted fences still guard every response-driven state write. A late result
cannot reopen the settled wait or overwrite a later observation. POST clears
the password input as soon as its request body is captured, while retaining the
existing username/password-only request contract. No request is retried
automatically, and abort never claims a rejected or rolled-back server action.

Evidence is retained in `runtime/reviewer-session-deadline-20261021/` with phase
receipts, timestamps and before/after source hashes. The old implementation and
15-case test bytes are also preserved as `component-before-deadline.tsx` and
`test-before-deadline.ts` under the initial focused evidence directory; their
hashes match the historical GREEN entries above. Historical full-run evidence
has not been replaced.

| Artifact | SHA-256 |
| --- | --- |
| Deadline-tested component | `dacba50d0e50dd2c85163a76099bb66a098a439e5c244ebd4de09b28c5ae8d8d` |
| Expanded test, unchanged between RED and GREEN | `bea3cddccc70a22cd8683e5ae6e9c3ea326460067f3d9bd221b31507da8f5ac5` |
| Deadline `red.txt` | `7fe9cd9d2a249dad8513ff999fccf312ef5c1f7256ae3ad7aadad1d8817af2b2` |
| Deadline `green.txt` | `6a410b05ac7cf7ce1acea56bc7be07b0e38b3d815a17733b228f88e23628ea1f` |
| Empty successful `typescript.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

This focused follow-up still uses baseline `ef160d4`; it does not verify a later
combined tree. Independent review of the deadline change, normal reconciliation
to the controlled-document recovery-test repair, final complete regression and
quality, and exact-candidate hosted CI remain pending. Root has separately
paused publication while that unrelated test repair is verified. The 20-second
UI deadline is a local usability bound, not an authentication service-level or
operational capacity acceptance claim.

## Independent deadline review and final-run baseline

An independent agent reviewed the frozen deadline implementation and retained
19-case RED/GREEN evidence without running tests or editing files. No actionable
finding was reported. The review covered fetch-plus-body timeout, local
cancellation when transport ignores abort, stale generation and unmount fences,
password capture/clearing order, and uncertainty-preserving errors. Immediate
password clearing while the request is held was confirmed by code inspection;
the current assertions observe the empty input after rejection or timeout. This
is a disclosed coverage limit, not an additional test claim or human approval.

Before the queued final run, the branch normally fast-forwarded from `ef160d4`
to repair candidate `80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e`. All three
candidate files retained identical bytes through that eleven-path, disjoint
baseline update; the reconciliation receipt is retained in
`runtime/reviewer-session-final-20261021/`. At this checkpoint `80b5eaa` is an
**unmerged repair candidate**, not verified actual master. The source fix for
the controlled-document recovery assertion is available for local qualification,
but publication remains held until root verifies its actual post-merge CI.
Final complete regression and quality have not yet started.

## Final local complete qualification and handoff

The frozen 19-case candidate completed fresh synthetic preparation, complete
regression and sequential quality checks from `2026-10-21T14:35:53.5706133Z`
to `2026-10-21T14:43:08.3028824Z`, on recorded HEAD
`80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e` and unchanged index tree
`d46c1ea467ac6723c37e14159782e76cb2bc3ff5`. **87/87 suites and 2,174/2,174
named checks passed**, with zero failures/skips. Prepare, complete regression,
WBS synchronization, TypeScript, frontend build and server build all exited 0.
The existing frontend chunk-size advisory remains a non-failing build warning.

The current report includes reviewer UI 19, auth pilot 41, recovery 24, native
foundations 35, protected paths 7, synthetic WBS 56 and controlled-document
version synchronization 50. The actual current controlled-document suite log
reports its core matrix **40/40**, additional security **29/29**, focused suites
**11/11**, zero active document transactions and **LIVE SNAPSHOT MUTATION: NONE**.
It was inspected from the full run rather than rerun independently.

The complete source/index manifest remained
`d7fa72803839059027441399149d8903c0ff260e3deb1b3c65ce63e6cfef9f6a`.
The prepared project snapshot remained
`c82267a04b2d2e13e0197abb7e0b83d28b130905c2bfdb4c08841f928a8a1bc2`.
All **100** recorded evidence artifact hashes were independently recomputed
without a mismatch. Current result-listed logs, complete stdout, quality output,
source/index manifests, snapshot evidence and prior-run archives are retained
under `runtime/reviewer-session-final-20261021/`.

| Artifact | SHA-256 |
| --- | --- |
| Final `verification.json` | `0bc8fe14e33b5664e90f98e433042e9caf4cc1f9becdf9ec90c8de6b5029172c` |
| Final `complete.txt` | `4faa7795b72d787497d9752e6d414bc46b67717fe4c524b9948c1e62488d64a8` |
| Final `quality.txt` | `75bd7bd01295279539de0724eadfcd492b4125a2d3c9541a0d9fe9df4077d13d` |
| Final `regression/results.json` | `26819a326469f8cd81b5d6ac843cadf31e1348b2347aac54d654d35b327a1c87` |

The runtime and test retain the deadline GREEN hashes recorded above. Only this
verification note is updated after the source-frozen run. Root subsequently
reported the recovery-test repair normally merged as actual master `2eb7090`,
with all four post-merge jobs in run `39618130544` verified at 14:41:54 UTC;
that supersedes the earlier repair publication hold. The local evidence remains
attributed to its actual `80b5eaa` checkout, not to later integration trees.

Root owns normal reconciliation with the composed WorkView candidate, signed
commit, dependent publication, exact-HEAD hosted checks, normal integration and
actual post-merge verification. Those steps are not claimed by this local
receipt. Production authentication activation, real credentials/principals,
trust, authorization policy, canonical governance and release remain excluded.
