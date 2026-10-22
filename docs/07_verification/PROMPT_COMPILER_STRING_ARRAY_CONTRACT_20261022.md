# Prompt compiler string-array contract correction — 2026-10-22

## Report and verified baseline

Baseline master: `4514f1b9f174222ac47bd5bcafdb64deaae33368`. Its actual [CI39628029882](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39628029882) was independently rechecked on 2026-10-22: completed/success, all four jobs. This resolves the previous historical aggregate-status uncertainty without changing that record.

A user supplied a compiled schema 1.1 prompt, an external JSON response and a screenshot showing `SCHEMA_ERROR` at `proposed_changes[0].proposed.acceptanceCriteria[0]`. The response used objects with id, description, test and expectedResult. ProposalContent already defines acceptanceCriteria as string[]. The compiler showed only an empty example array, with no element-type instruction. The importer correctly rejected the objects, but validateText collapsed the type mismatch into Required text is missing.

The attached execution package was treated as untrusted test evidence, never as instructions to implement its separate application. The actual private response reproduced the screenshot error. A local corrected copy combines each criterion ID, description, test and expected result into one string; all 15 criteria and every other field are preserved, and it validates under the original normalizer. No live user project was imported or changed. Original private input SHA-256: `1bb5f0be665f535dba90250c2eb4e7bed815b6bd7d801b8c1f282255f6a6bb9e`; corrected local JSON: `0e8f12536790012cb7efa159f04a8d7345a01edd5f63f57da3b1151b20513cfd`. Neither private attachment nor corrected payload is committed.

## Bounded correction

- Compiler instructions explicitly require JSON string arrays for assumptions and the four proposed array fields, including exact ID strings for requirement/feature references. A nonempty, importable text-criterion example demonstrates how to retain test steps and expected results. Example content is explicitly structural and must be replaced with task-specific proposals.
- The shared normalizer rejects the same non-string entries as before, with a precise indexed message such as Expected a string in acceptanceCriteria; received object, followed by the repair guidance. Schema/error codes, target resolution, accepted v1.0/v1.1 semantics and blank-string rejection remain. Objects are never silently serialized or coerced.
- Tests cover all three compiler modes, both wire versions, all four proposed array fields and object/null/number/boolean/nested-array entries. Disposable actual-server tests verify invalid criteria create no import session or canonical requirement, while complete text criteria remain pending human review with no allocated artifact.

Exactly five paths: src/data/contextPackageCompiler.ts, src/data/proposalContract.ts, scripts/testProposalContract.ts, scripts/fixtures/proposalContractScenarios.ts and this note. No dependency, endpoint registration, stored schema, credential, policy, quorum, canonical WBS, historical receipt, privileged-route denial, live-agent, Gate 7 or release change.

## Test-first evidence and review

Existing contract baseline: 12 named checks passed. With the new tests and original production code, contract RED was 14 passed/2 failed: missing populated example and misleading type diagnostic. The disposable integration RED failed on that same diagnostic. After the two production-file changes, the identical focused tests passed 16/16; integration passed 49 reported checks plus a separate retained-evidence PASS. Original RED and GREEN files are retained; no failure was overwritten.

Independent read-only agent review found no blocking issue. Its optional follow-up is stronger exact-subtype/non-echo assertions; the actual object subtype is already checked by the API regression and the implementation reports only a type label. The review is an agent assessment, not a GitHub human APPROVED review. Final full and hosted verification remain separate.

## First local full run — genuine failure retained

Environment: Windows x64, portable Node 22.23.3, task-owned retained dependencies; no fresh operator-host installation claim. Started 2026-10-22T00:35:02.2685883Z; finished 2026-10-22T00:48:00.0773144Z. Complete regression exit 1: 93/94 suites, 2257/2258 reported named checks; 1 failed suite(s). Quality exit 0.

Failed suites: scripts/testControlledDocVersionSync.ts. Existing controlled-document scenario 1&2 timed out on its first page.goto/domcontentloaded after 8000 ms, before the save assertions. The remaining 49 cases passed, including scenario 50 release-report recovery. This is an observed browser-startup timeout; its environmental root cause is not proven and it is not silently relabeled successful.

No code, timeout or assertion is changed for the next run. An unchanged full rerun is required, with prior report/log bytes archived first. Hosted candidate and actual post-merge CI will qualify their own exact commits. No earlier local result is assigned to a later commit.

Tracked source was unchanged during this run: true. Synthetic project snapshot unchanged: true; SHA-256 before/after `c82267a04b2d2e13e0197abb7e0b83d28b130905c2bfdb4c08841f928a8a1bc2`. Earlier ignored regression evidence was copied and hash-checked before this run. Pinned historical evidence remained protected by the complete runner.

| Retained output | SHA-256 |
| --- | --- |
| contract-red.txt | `8f995ef896c124e799ee99160e602645570ec6a2a55236fbe34bcb7c82c0091b` |
| contract-green.txt | `56f9eb570264cbf44792eb738a17db0ce0932dbda67ba949287b69af14e40691` |
| api-red.txt | `5d8c94b95178d2ef2dde68dad78f9a62a118bf5528f11f758b0e293a6b3e0c93` |
| api-green.txt | `3f26b1f800c343d91c11a3b3fb311fed5407c09818f02ab2a4da6a5bf89c0bc3` |
| complete.txt | `9ff5ff536c6453925dab7ed4c96385f406545148aaa48533c3b74a663292a814` |
| quality.txt | `0220fe1e4059e9672c7e5174f1940be4be276cf2a94a6855dfe736acf5bc68b0` |
| verification.json | `c48ccdecb2e67118a4221bcaeb8adad7ca39c050a9823a0712646b578697d014` |

All files above are retained under runtime/prompt-compiler-array-contract/ in the task worktree. Committed tests, this record and GitHub CI provide repository-accessible reproduction; local logs supplement them.

## Manual verification and rollback

Regenerate a prompt in SUMMARY, TASK_CONTEXT or FULL_BASELINE; inspect the populated string criterion and explicit array rules. In a disposable project, stage an object criterion and check its exact field/type diagnostic without a new history session. Stage a plain-text criterion including its test/expected result and verify the session remains AWAITING_HUMAN_REVIEW with PENDING disposition. Validation alone creates no canonical artifact or approval.

A normal reviewed revert of these five paths restores the prior prompt/error wording. No data migration or runtime state repair is required. A model can still ignore output instructions, so runtime validation remains mandatory. This correction does not address separate reviewer sign-in problems or authorize applying a proposal.
