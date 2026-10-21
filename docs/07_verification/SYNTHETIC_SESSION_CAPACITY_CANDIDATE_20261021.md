# Inactive synthetic session-capacity candidate — 2026-10-21

Baseline: signed master `b4004c167e5a377a324f7eaa21f877d3d71ae33d`. This is a bounded Workstream B development candidate under the renewed autonomous engineering instruction. It changes only the disconnected synthetic foundations. It neither requires nor integrates unmerged PR #60 or #64, and it does not activate authentication or protect the ordinary product APIs.

## Reproduced behavior

The existing worker permits at most 256 session rows. Logout marks a row revoked; expiry, credential reset, policy revision and worker-generation changes invalidate sessions without deleting their rows. Consequently, 256 retained unusable sessions exhaust issuance capacity even when no corresponding session can authenticate. Rotation already replaces its own old row, but does not address unrelated retained rows.

A new actual-worker suite was written and run before changing implementation. Its original RED result was **2 passed / 13 failed** in **49,072 ms**. Both the repeated logout and expiry scenarios reached `STORE_CAPACITY` when fresh issuance should have become possible. The existing active-session ceiling and audit-capacity fail-closed checks passed. Trigger/clock scenarios failed before reaching their intended cleanup path because the missing reclamation still stopped at capacity. Original output is retained locally at `runtime/session-capacity/red.txt`, SHA-256 `51e3d65c06eea1bad264559e75452f7bd6844e708aa93a4077f38369cd70f952`. This is original failure evidence, not final-source validation.

## Exact implementation boundary

`issueSession` retains its existing immediate SQLite transaction. After accepted monotonic fixture time, current principal and optional credential/generation CAS checks, it examines capacity. Only at the existing 256-row ceiling does it inspect at most 256 rows, in digest order, and remove rows whose validated state proves they are permanently unusable:

- Explicit revocation or disabled principal.
- Strictly older session generation, policy revision or credential revision, under the existing increment-only contracts.
- Inclusive ten-minute idle or thirty-minute absolute expiry at the already accepted worker clock.

The candidate preserves active rows byte for byte. Malformed identity/session fields, unsupported principal state, invalid revisions, revisions ahead of current authority, future timestamps and inconsistent timestamp ordering remain untouched. A denied session is not automatically eligible for deletion. Unusable rows below the ceiling remain retained until issuance needs space.

Deletion, a sanitized `SESSIONS_RECLAIMED` event, new-session insertion and `SESSION_ISSUED` remain one transaction. The cleanup event uses target `fixture` and reason `INACTIVE_SESSION_CAPACITY`; it contains no session token or digest. Insertion, trigger, audit or capacity failure rolls the entire operation back. The worker's existing in-memory observed-clock high-water remains outside rollback, so a failed transaction cannot revive a session by moving the fixture clock backwards. Worker restart still advances generation.

No audit entry is deleted. The 256-session and 4,096-audit limits are unchanged. No schema, migration, command, factory option, trust adapter, normal server import, production dependency or certificate change is included. The default factory remains inactive.

## Candidate compatibility changes requiring review

1. Successful issuance that performs reclamation consumes **two audit slots**, one for cleanup and one for issuance. If only one slot remains, all cleanup and issuance roll back. At a full audit ledger, authentication work continues to fail closed; this candidate does not implement audit retention or archival.
2. Reclaimed unusable tokens no longer have a row. Their later `revokeSession`/synthetic logout returns false, where a retained previously revoked row could formerly return true. Acceptance, rotation and authorization remain denied. No operational client or HTTP route is changed by this candidate.
3. A future incompatible implementation must not decrement authority revisions or restore old session rows. Normal reviewed reversion of this code leaves existing remaining sessions within the same schema, but cannot reconstruct reclaimed session metadata. Original audit history remains retained.

Replay tests exercise `SyntheticSessions`, which generates fresh cryptographic bearer tokens and derives their digests. The trusted internal `issueSession` worker command accepts a supplied digest; this candidate does not add a durable global digest-consumption registry or make deliberate trusted-command reuse of an old digest impossible. No HTTP caller acquires that worker command.

PR #60 and #64 use the same existing session issuance/revision contract. Their public APIs require no adaptation, but compatibility is a source-level expectation until a normal reconciled tree runs their actual focused suites and full regression. This candidate does not bypass the independent #66 recovery/integration hold or reuse approvals for changed HEADs.

## Verification contract

Run `node --import tsx scripts/testSyntheticSessionCapacity.ts`. The suite uses one real Argon2 verifier hash, then actual owned SQLite worker/session operations. Its 15 named compound checks cover revoked and idle/absolute-expired saturation; byte-preservation of active rows; unchanged active capacity; reset, disable, policy and generation fences; conservative retention of malformed/future/ahead-of-authority rows; invalid issuance preconditions; faults before/after deletion, insertion and both audit events; expiry observed across rollback/restart; both serialized request orders of competing rotation/issuance; and actual worker writes to the 4,095/4,096 audit boundaries.

Fault triggers and deliberately malformed rows exist only in each newly minted disposable fixture. Tests never accept an operator database path. Audit saturation uses the worker's actual authorization command rather than fabricated ledger entries. The rotation cases test competing messages serialized by the sole SQLite worker; they do not claim arbitrary multi-process ownership or power-loss coverage.

The complete regression runner discovers the new test automatically. CI adds it to existing fresh Windows npm/Bun and Linux npm/Bun qualification sequences. Existing foundation, ownership, lifecycle inventory, controlled-document and product assertions remain required.

Local worker syntax and TypeScript checks passed. The final focused GREEN passed **15/15 named checks in 46,819 ms**, followed by existing foundations **35/35** on Windows x64 portable Node **22.23.3**, better-sqlite3 **13.0.3** / SQLite **3.53.4** and Argon2 **0.45.1**. The first GREEN required no further source or assertion correction. A test name was clarified after RED to describe session issuance rather than suggest repeated password login; its assertions were unchanged. These elapsed times describe suite execution, not a service performance budget.

Retained local output digests (SHA-256 of the actual files):

| Output | SHA-256 |
| --- | --- |
| `runtime/session-capacity/green.txt` | `31caae45f2f443ae35355ab84640e9d739fd3414205aca1320863dfae70ba77e` |
| `runtime/session-capacity/foundations.txt` | `d2c879d363c9ab6e405dbbe4ee73d7976669ea49ae21e7475b524b2af875ff23` |

The tested worker SHA-256 is `95494ff1907f3a9e1d2ecf345964aab50189e657ac11194ca5aee22fe8c94b63`; the focused script is `82f2c55adcc01dba91662791946da032e23be525daecae01d81518ba36d4c4d5`; the workflow is `09b7401a0774dfb2fe0eafad9a0994cf4ee28210058c2b2ae4011e5d51b1fa4d`. These are local file bytes before any subsequent Git line-ending conversion or reconciliation, not a claim of a signed final commit.

Exact-source full quality/controlled-document/regression results remain to be recorded by the verification owner. Fresh four-job exact-HEAD hosted CI, acceptance under the current operator authorization and repository policy, and actual post-merge verification are separate prerequisites. Operational human-governance decisions remain separate. A local retained-package run is not clean operator-host installation proof or an operational capacity budget.

## Scope, rollback and remaining limits

Exactly four intended paths: `server/security/syntheticFoundations/privateStoreWorker.mjs`, `scripts/testSyntheticSessionCapacity.ts`, `.github/workflows/ci.yml`, and this record. The task-owned dependency junction is used only for testing; no install, original node_modules change, SDK change or credential operation occurs.

Before integration, leave the candidate unmerged. After an eligible merge, a reviewed ordinary revert removes reclamation without changing schema or historical audit records; disposed session metadata stays disposed and old tokens remain denied. Preserve evidence and do not restore old stores to recreate authority.

Durable abuse controls, audit retention/external anchoring, trusted time, arbitrary-crash recovery, operational store acquisition, bootstrap/enrollment, schema migration and project/document authorization remain separate work. This candidate does not raise the supported concurrent-session capacity or eliminate the finite audit ceiling. The ordinary route inventory and all 14 privileged denials, human-only quorum, canonical WBS/history, live-agent prohibition, Gate 7 and release gates remain in force.

## Recovery reconciliation — 2026-10-21

The effective preparation baseline is now
`21da1d5bebaecf58b5037c255561c8b8315b429d`, the PR #66 recovery merge whose
actual post-merge CI was verified by the integration owner. The earlier PR #66
hold in this record describes the pre-reconciliation state; recovery is now
complete. This does not establish compatibility with PR #60 or #64.

This worktree advanced from `b4004c1` by an ordinary fast-forward, retaining its
uncommitted four-path candidate. The only overlapping file was
`.github/workflows/ci.yml`: recovery added the campaign PR trigger near the
top, while this candidate added eight qualification lines in separate hunks.
The exact local workflow patch and original bytes were saved and verified before
temporarily restoring that one file; after the fast-forward, the patch applied
cleanly. Its exact eight additions and all recovery content are retained.
The current workflow raw SHA-256 is
`d0ead7aef6ec7a46df50105337951e95e27414ca0c662aec3af00dab7dca1a40`.

The worker, focused test and all three retained RED/GREEN/foundations logs stayed
byte-for-byte identical to their pre-reconciliation hashes above. The original
verification record is preserved as this section's unchanged prefix. Supplementary
local manifests and the saved patches are retained under the ignored
`runtime/reconciliation-21da1d5-20261021/` directory.

No new test run, commit, publication or merge of this candidate occurred during
this preparation. The earlier focused results remain evidence for their stated
source/baseline, not a new combined-tree result. Actual PR #60/#64 focused
compatibility and combined regression still await coordinated verification;
fresh candidate CI and post-merge verification remain separate. Effective scope
is still exactly the four paths listed above, with this additive record update.
No operational identity, trust, canonical WBS, receipt, Gate 7 or release action
follows from recovery or this fast-forward.

## Verified authentication recovery baseline and schema2 interaction preparation

The integration owner has now verified actual PR #64 master
`ef160d4dea3122309687b1f44bb8972c07e879a5` (tree
`698644cc31444d79cf93f576706cba8f2a3fcf42`), including all
four jobs of actual post-merge run `39608076350` and complete regression
**83 suites / 2,109 checks**. This is baseline evidence, not a passing result for
the combined capacity candidate.

This candidate advanced normally from `21da1d5` to that exact commit by
fast-forward. Its tracked patch and original test/document bytes were preserved
under `runtime/reconciliation-ef160d4-20261021/` before temporarily restoring
the two overlapping tracked files. The worker patch reapplied cleanly. Two
Windows workflow insertion conflicts were resolved additively: pilot, recovery,
capacity, path and WBS checks all remain. The resulting runtime/workflow delta
is still exactly the original **27 worker additions and 8 workflow additions**;
the added lines were compared with the saved pre-reconciliation patch and match
exactly. No recovery worker behavior was rewritten.

The three original RED/GREEN/foundations logs retain their recorded byte hashes.
The original 15 test cases retain their assertions. Their fixture helper now
optionally creates explicit schema2 stores and retains detached managers for
safe lifecycle cleanup. Three additional compound checks have been authored:

1. Fill 256 rows, prepare and claim a transfer, prove the old owner cannot issue
   or delete the successor root, reclaim obsolete-generation rows, preserve the
   full audit prefix and consumed receipt rows, reject old tokens, and perform
   another actual claim over a ledger containing the new reclamation event.
2. Under a claimed schema2 owner, preserve one active row while 255 revoked rows
   saturate capacity. Fault each reclamation/issuance audit insertion and verify
   complete rollback of session bytes, audit, metadata, lease and receipts across
   the owner transaction and nested savepoint. A lower clock after the failed
   observation must still deny; a later successful cleanup must preserve the
   active row and custody bytes.
3. Use bounded actual worker authorization denials to reach 4,092 audit entries;
   prepare and claim consume the next three. At 4,095 and 4,096, issuance needing
   reclamation must fail closed without changing sessions, audit or custody.

These additional cases use distinct actual workers in one test process and the
existing single KDF fixture. They do not substitute for the existing 24-case
recovery suite's separate-process coverage, and they add no production root,
identity, principal enrollment or startup wiring. Their extra audit saturation
loop must run only in the coordinated native-test slot.

Prepared raw SHA-256 values before these new cases have executed:

| File | SHA-256 |
| --- | --- |
| Worker on verified recovery baseline | `1fdb122171d47943884aea1677552e698bc7601df50fe761892746e0bf8f6449` |
| Focused script with 18 checks | `bfa64a481cedb3211dfa9d5b90f5e52403a33fe7977293a8aa4101db32e59235` |
| Reconciled workflow | `02d819712cf796c5f65d86ea100381df7e7710d3357f10eedc8cd94f71f75dfa` |

At this preparation checkpoint the 18-case focused result and combined
full/quality/hosted results remained pending. Original focused evidence remains
attributed to its earlier baseline. Subsequent focused compatibility evidence is
recorded below; no final commit, candidate publication or activation follows
from this preparation.

### Focused schema2 compatibility result

The first focused run on the verified `ef160d4` baseline passed **18/18 named
checks, 0 failed, exit 0**. Process timestamps were
`2026-10-21T13:44:55.4736544Z` through
`2026-10-21T13:46:09.1310961Z`; the suite reported **73,185 ms**. It used portable
Node v22.23.3, `CI=true`, an empty process `GEMINI_API_KEY`, and the existing
task-owned dependency junction. No source correction or assertion adjustment
was required. The worker, focused script and workflow retained exactly the three
prepared hashes above before and after execution.

The original 15 cases still pass, and the three added schema2 checks directly
observed old-owner denial and nondeleting close, preserved consumed receipts,
a second claim over a ledger containing reclamation, nested transactional
rollback with an in-memory clock high-water fence, active-row preservation, and
fail-closed issuance at 4,095/4,096 audit entries after a real claim. This extends
the original test-first reclamation evidence with combined recovery coverage;
it is not a separate new implementation change.

Fresh local evidence lives in
`runtime/session-capacity-ef160d4-20261021/focused18.txt` with SHA-256
`e7e515f8afc0c530728ef4cfbb7b3400c0f699e04f4d36709744dd053518034e`.
The adjacent `focused18-receipt.json` records timestamps, process exit and all
before/after hashes. The earlier three RED/GREEN/foundations outputs remain
unchanged in their original directory. The measured duration describes this
bounded local fixture suite, not an operational acceptance budget.

Combined full regression, quality/build, fresh four-profile exact-candidate CI
and actual post-merge verification remain root-owned and pending. No further
native or browser test was started as part of this focused slot.

### Current full-qualification baseline

After the integration owner verified actual PR #68 master
`9a0054cd7875cd836ffde990607bb0d788806707` and all four jobs of actual
post-merge CI `39610190107` (**85 suites / 2,134 checks**), this branch advanced
normally from `ef160d4` to that exact commit. None of the four candidate paths
overlapped the new baseline changes; all four retained identical raw hashes
across the fast-forward. The 18-case focused result above remains attributed to
`ef160d4`; the scheduled complete regression and quality run will qualify the
combined candidate on `9a0054c`.

Independent read-only review found no actionable issue in the exact 27-line
worker delta, four-file scope, schema2 interaction assertions or focused
log/receipt. It checked lease acquisition within the outer transaction, nested
savepoint rollback, clock and revision fences, preservation of active and
conservatively retained rows, audit capacity and custody. That review ran no
tests and is not operational or human-authority approval.

### Complete qualification on 9a0054c

Fresh synthetic preparation, complete regression and sequential quality checks
ran from `2026-10-21T13:59:13.4505376Z` through
`2026-10-21T14:07:36.7432659Z` on the exact `9a0054c` baseline plus this
four-path candidate. **86/86 suites and 2,152/2,152 named checks passed**, with
zero failed or skipped checks. Preparation, regression, WBS drift checking,
TypeScript, Vite build and server build all exited 0.

The current report includes capacity 18, auth pilot 41, recovery 24, native
foundations 35, path protection 7, synthetic WBS 56 and controlled-document
version sync 50. The actual controlled-document log reports 40 core cases,
29 additional security cases and 11 focused suites containing 332 measured
assertions, with no live snapshot mutation. No separate redundant controlled
document run was used to make this claim.

All tracked and untracked candidate files, index entries and working status
were included in the source manifests. Their SHA-256 remained
`1a8fd3405c18e55acada452955acba36d59e089294b46c780649d93e5e4d61c1`.
The fresh synthetic snapshot SHA-256 remained
`f6d082c91da27f42e76e0f1cbd027b60b7f8b76ef62d7b84fb22876da1970860`.
All **95** recorded evidence-file hashes were recomputed and matched. The
verification note's result addition was made only after source comparison and
process completion.

Complete output, quality output, every current report-listed suite log, results,
before/after manifests and the task-local Node/npm process shim are retained in
`runtime/capacity-full-9a0054c-20261021/`. Portable Node v22.23.3, `CI=true`, an
empty process `GEMINI_API_KEY` and the process-only Windows PowerShell module
path were used. Existing dependencies, earlier logs and credentials were not
modified.

| Artifact | SHA-256 |
| --- | --- |
| `verification.json` | `513fdcdbe50f8102f7e0d3a1de598b2839a18e372c7b6a44f438af64b54a5eb1` |
| `complete.txt` | `0720be7088b2165ffc116b627ede2fce7808e668d7b49fdc59a303365d6b5782` |
| `quality.txt` | `0fd1bfa4424bb61736cb780e40b50a86e6cc90a8e1c8d20dbe7f7f11a348861e` |
| `regression/results.json` | `f22c146d421db4c8b3ad01c0e90605352fa926092b7833e2c0f48a55ee3d3625` |

This is complete local qualification of the stated `9a0054c` candidate. It does
not resolve the subsequently observed hosted controlled-document recovery
assertion failure on later master `31fbb412792f2327adeee50cf306e8e26ed900d6`.
The integration owner paused merges for that separate diagnosis. Final current
baseline reconciliation, candidate publication, exact-HEAD hosted CI and actual
post-merge verification remain separate; this record authorizes no operational
identity, trust, recovery activation or release.

### Dependent publication checkpoint

At 2026-10-21 14:31 UTC, the integration owner normally fast-forwarded this
unpublished branch to signed PR #72 repair candidate
`80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e`. It was still **unmerged**; this is
candidate preparation, not a verified-master claim. All four candidate file
hashes matched the frozen handoff across that update. The earlier local full
run remains evidence only for its stated `9a0054c` baseline.

The published dependent candidate requires fresh four-job hosted CI, including
the new capacity suite under fresh npm and Bun installations. Integration waits
for PR #72's actual post-merge CI and then the candidate's own normal merge gates.
No operational capacity or authentication activation is authorized.
