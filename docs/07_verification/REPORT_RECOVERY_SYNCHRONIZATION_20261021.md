# Report recovery synchronization repair — 2026-10-21

Actual master baseline: `31fbb412792f2327adeee50cf306e8e26ed900d6`.
Last fully green predecessor: `9a0054cd7875cd836ffde990607bb0d788806707`.
Scope is exactly this verification record and
`scripts/testControlledDocVersionSync.ts`. No application, release predicate,
sign-off writer, policy, dependency, canonical WBS or historical receipt changes.

## Actual failure and integration halt

PR #69's signed candidate `f50e605886771030d8a3d2538c35fdc7868ce901`
passed all four jobs in
[39611561100](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39611561100),
86 suites / 2,155 checks. Its ordinary merge at 13:58:31Z produced `31fbb41`,
whose parents are `9a0054c` and `f50e605`, with valid GitHub signature and exactly
the candidate tree `168b4f1af459c91d7688a66bcf6623ecda640741`.

The actual [post-merge run 39612706919](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39612706919)
failed Complete Regression job `119265484673`: **85/86 suites and 2,154/2,155
checks**. The sole failing suite was `testControlledDocVersionSync.ts`, **49/50**;
scenario 50 asserted `Sign-off entry button must be visible after recovery`.
Quality, Controlled Docs and Windows Native Qualification passed. Further
integrations were paused; the failed master was not declared green or reverted.

Separately, PR #71 candidate `aba1afb72eea0f86802fd8dbc6e96a1dca626df0`
failed the same assertion in
[39612237785](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39612237785),
job `119263812164`: **85/86 suites and 2,141/2,142 checks**. Its checked-out
synthetic merge `bdb08a56c3a3e48b88663b40a431ef909e49f29f` has parents
`9a0054c` and `aba1afb` and exactly the candidate tree
`d8db142a26cadc0dbb4b0dd0b3376a9d5f9f840e`. It did not contain PR #69's
release-claims correction. Earlier passing combined/local runs remain genuine
historical observations; they do not cancel either actual failure.

| Preserved hosted failure artifact | Uploaded ZIP SHA-256 |
| --- | --- |
| [Master artifact 12351117677](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39612706919/artifacts/12351117677) | `213810095ac9beb2a18d6b944d0a49bf581bd4fe83553c6b53bd11e5b67648f5` |
| [PR #71 artifact 12351502083](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39612237785/artifacts/12351502083) | `dc300649fa44ab8fc232da0f1188e72c2847136ed48eefe29b8c82d956c4bef5` |

Captured UTF-8 text logs are retained under ignored
`runtime/report-recovery-synchronization/`. Their digests are
`c86aeb3ccca043314d711ccd879ce503ddbcf56fd7825715eee570dc45200c24`
(master job) and
`03c8a342299bcf2d24c6e20e92f4fa9f1a79f2d3890ee11fce98cbdf4a64375c`
(PR #71 job). These captured-text digests are distinct from the hosted ZIPs.
The public [failure checkpoint](https://github.com/Jeruzael/docmonstakrakin/pull/69#issuecomment-6318085893)
records the chronology without relabeling either result.

## Root cause and intended correction

Scenario 50 waits for the stale-snapshot warning to disappear, then calls
non-waiting `isVisible()` on the sign-off entry. `DocumentsView` invalidates its
previous report synchronously when the version/readiness scope changes and
loads a separate current release report asynchronously. Snapshot recovery alone
therefore does not establish report availability. A correctly unavailable entry
can fail the test before the valid report arrives. Independent agent source
inspection confirmed this ordering; deterministic browser reproduction follows.

The test harness can now hold the release-report response independently of the
canonical snapshot. The original immediate positive assertion remains in the
first deterministic RED. The correction will explicitly verify no sign-off
entry, no open modal and zero sign-off POSTs while the new report is pending;
after releasing that response, it will wait within the existing eight-second
locator deadline before retaining the original visible/enabled/zero-POST
assertions. No assertion will be deleted or made optional. No arbitrary sleep,
retry-until-green policy, stale-report fallback or production behavior change is
part of the correction. The complete suite remains 50 named scenarios.

## Boundaries and rollback

All API responses and identities in this browser harness are synthetic. The
existing real evaluator supplies the complete report shape from inert Atlas
inputs; identity remapping does not establish actual project readiness. All
sign-off POST counts must remain zero; no Gate 7 writer or human decision runs.

The operator's ordinary development-review waiver permits a normal guarded
repair merge after signed-head CI and independent agent review; it is not a human
APPROVED review or operational ratification. Canonical WBS, trust, enrollment,
credentials, privileges, agents, PR #34/#52 and release restrictions are intact.
Rollback is a normal two-path revert, retaining this failure history; it restores
the known timing assumption and therefore requires explicit risk consideration.
Actual master CI after the repair is required before resuming integration.

## Completed deterministic browser qualification

On exact baseline `31fbb41`, the deliberately held recovery response reproduced
**49/50, exit 1**, including the exact original failure, from
14:08:29.0789654Z to 14:09:40.0791357Z. Its tested-source SHA-256 stayed
`c585dddf2c2cdb91f860ac176f10158d72aece1464600d1fef796e1af8f209a3`
before/after. RED log SHA-256:
`916c8515a29a05f49b98e1ac37d0c4d72d89bce5bc488d856800a6687a9efe33`.

The corrected full 50-scenario browser suite passed **50/50, exit 0**, from
14:10:06.2911218Z to 14:11:18.0346156Z, followed by **TypeScript exit 0**
and `git diff --check` exit 0. GREEN log SHA-256:
`d2d1e75c5a13864038573e0c6c488fc74cc803eb54f0f52246b6fb00215220f3`.
The final tested-source SHA-256 stayed
`250986d384df8670e9c9c186ab36dfe4a2a508756f9da2517d04e4361f8fd630`
before/after. Each immutable run directory retains tested source, log and receipt.

Independent agent review verified every original assertion is byte-for-byte
preserved; the only deleted test line is a comment. The new pending-state
assertions and bounded response wait strengthen the asynchronous contract.
Production source is unchanged. This is agent review, not human approval.

Commands used the existing qualified portable Node 22.23.3 and task-owned
dependencies, with no installation:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testControlledDocVersionSync.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

No new local complete-regression result is claimed for this two-path test-only
repair. Required exact-head hosted CI will independently run complete regression,
build/WBS checks, controlled documents and fresh native qualification. Actual
post-merge CI must then verify the repaired master before another PR merges.
The failed `31fbb41` run will remain failed historical evidence even if the
successor passes. The final record-only addition follows the tested source.
