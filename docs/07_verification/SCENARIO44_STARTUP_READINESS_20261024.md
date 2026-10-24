# Scenario 44 — bounded startup-readiness diagnosis

Date: 2026-10-24 (Asia/Taipei). Agent-authored test/evidence candidate under the operator's Scenario 44 authorization. This is not human review, merge permission, operator acceptance or production authorization.

## Baseline and preserved failure

| Record | Verified identity |
| --- | --- |
| Refreshed master | `46efc65d48c8e2057e500e3d8a805e650eff0c8c` |
| PR #86 reviewed HEAD | `a42586570869b8e19414f487840c7a8222079025` |
| Both source trees | `9a7a101e0d3c0543b83d2574e0e157d5c047ffec`; different commit identities do not imply different source |
| Human review | [jianzhihuoxin, APPROVED review 5636194781](https://github.com/Jeruzael/docmonstakrakin/pull/86#pullrequestreview-5636194781), 2026-10-24T01:34:57Z, exact a425865 HEAD |
| Actual protected merge | 2026-10-24T01:36:09Z; GitHub merger Jeruzael; agent executed under explicit operator authorization; parents `796adced2b0e9795b801c808359dee9c8839d7c4` and a425865; signature valid |
| Failed actual-master run | [40050545096, attempt 1](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40050545096): Quality, Controlled Docs and Windows Native SUCCESS; Complete Regression FAILURE |
| Original results | 139/140 suites, 2773/2774 reported checks; version-sync 49 pass / 1 fail; Scenario 44 initial Export assertion at original line 3537; Scenario 47 passed |
| Failure artifact | [12543337386](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40050545096/artifacts/12543337386), 439319 bytes, 145 members, SHA-256 `db30db619014261c64a26de5a432cb780e431c8a12a9f3cf15913fe95cb08fb6`; original ZIP included unchanged in this candidate's archive |

[The actual integration checkpoint](https://github.com/Jeruzael/docmonstakrakin/pull/86#issuecomment-6378416892), [body-parser remediation](BODY_PARSER_SECURITY_REMEDIATION_20261024.md), and [Scenario 47 diagnosis](SCENARIO47_READINESS_DIAGNOSIS_20261024.md) remain historical records. Run 40036517930, run 40043247470/artifact 12540208323, and candidate run 40046897011 are not replaced or retried. The dismissed review of 8950479 is not approval of any subsequent revision.

## Supported cause and minimal correction

`createHarness()` returns after the selected project title is visible. Project-list metadata can supply that title and v120 before the complete project snapshot exists. `createProjectLoader()` independently fetches and validates 14 resources; App accepts the complete snapshot, records its certified version, and requires matching selection, no loading/error, and certification at least equal to the accepted version floor before exposing Export.

Scenario 44 immediately called `isVisible()` after the title check. That immediate observation does not wait for certification. Controlled response scheduling reproduces the same assertion failure on both reviewed and merged source trees: title v120, floor 120, loading true, certification absent, Export absent. Releasing the existing valid response permits normal loader validation and App acceptance; no application defect was demonstrated by this investigation. The original hosted run did not capture this timeline, so its precise scheduling remains unknown.

Only Scenario 44 in `scripts/testControlledDocVersionSync.ts` changes: move the existing Export locator before the initial assertions and await `packageBtn.waitFor({ state: 'visible' })`, inheriting the unchanged 8000 ms timeout. Keep both original initial assertions and every subsequent list-advance, stale-retry and recovery assertion. No shared harness wait, runtime change, altered response, timeout inflation, skip, eventual negative assertion or new sleep. Existing later timing waits are outside this startup correction and remain unchanged.

The browser uses the real App, loader and TopBar. Existing `/api/**` fixtures intercept all API calls, including list, session and complete snapshot resources; unknown API routes return mocked 404. Vite serves UI/assets. No application backend or body-parser is reached by these browser experiments. Separate actual-server/security regressions remain necessary.

## Whole-suite startup inventory

All 50 test entries were inspected (Scenario 1 & 2 is one entry; 35b is separate). Full names and line references appear in the archive's `inventory-source.json`. This is a startup-precondition review, not a claim that every later timing assumption is proven race-free.

| Scenarios / entries | Actual initial prerequisite and how established | Disposition |
| --- | --- | --- |
| 1 & 2, 3–4, 6–7, 9–27, 29–40, 45 (37 entries) | Shared save workflow waits for the mounted controlled-docs workspace and document/editor/modal controls before performing save; title checks alone only assert safe metadata. Post-save assertions deliberately exercise errors, stale data, pending audit and invalidation. | Unchanged; no same-pattern immediate certified-Export assumption demonstrated. |
| 5, 8 (2) | Inline document workflows await/actionability-check their snapshot-dependent document controls. 5 deliberately has a signed-out reviewer; 8 holds a later save and switches projects. | Unchanged; do not normalize those denial/in-flight phases. |
| 28 (1) | Evidence & Audit tab and SYNCHRONIZED badge must render before asserting initial audit data. | Unchanged. |
| 35b (1) | Intentionally empty initial project list; waits for the empty-state UI. | Unchanged; a universal readiness wait would be wrong. |
| 41–43 (3) | List/selector metadata, list-version floors and explicit warning/recovery waits; initial A certification is not an assertion prerequisite. 42 deliberately switches to stale B after accepting its higher list floor. | Unchanged. |
| 44 (1) | Immediately assumes certified Export from list-derived v120 title. | **Only corrected entry**, supported by both-tree controlled reproduction. |
| 46 (1) | New-project wizard is available without initial certification; subsequent assertions concern creation metadata/floor and invalid creation rejection. | Unchanged. |
| 47, 48, 50 (3) | Existing explicit Export visibility wait; later phases intentionally invalidate certification, hold snapshots/reports or reject stale responses. 48 also runs its certification source-contract negative controls. | Unchanged; held-startup experiments complete with existing barriers. |
| 49 (1) | Existing controlled-docs workspace wait blocks before release-report navigation; current incomplete-report visibility is additionally awaited. The introductory title comment alone is not its effective readiness barrier. | Unchanged; held-startup experiment completes after the first existing barrier. |

Failed/invalid save and audit fixtures start from usable document state; they are not permission to globally force their later failed/stale/loading states ready. No source edits were made to the other 49 entries or Scenario 47's correction.

## Fixed experiment set and outcomes

The archived PLAN was written before execution. Twelve cells were planned, followed by exactly two documented supplemental cells to resolve diagnostic infrastructure/design limitations. Each outcome remains recorded; no retry-until-green qualification occurred.

| Experiment | Reviewed a425865 | Merged 46efc65 |
| --- | --- | --- |
| Original Scenario 44, initial project response held | First run timed out at initial `page.goto` (8000 ms), before assertion. One documented supplemental run reaches and **fails the exact original Export assertion**. | **Fails the exact original Export assertion**. |
| Scenario-specific barrier, same held response | Barrier stays pending; release permits full original lifecycle assertions to pass. | Same pass. |
| Missing initial snapshot | Expected readiness timeout, measured 8012.69 ms. | Expected timeout, 8013.31 ms. |
| Invalid initial snapshot stateVersion | Loader rejects response; expected readiness timeout, 8009.32 ms. | Same rejection and timeout, 8005.77 ms. |
| Existing 47/48/50 held-startup controls | Not duplicated. | Each completes its original full scenario after existing barrier releases. |
| Existing 49 held-startup control | Not duplicated. | First diagnostic release trigger was too late: the earlier workspace wait correctly blocked and timed out at 8000 ms. One documented supplemental run releases at that first existing wait and completes the full scenario. |

Negative-control pass means readiness **failed** within its original bound, not that readiness was granted. The two infrastructure/design limitations remain in raw logs and matrix results. They were not relabeled as successful scenario executions. A PowerShell quoting error while generating the supplemental helper occurred before any experiment; the saved Python generator replaced that invalid invocation without changing application/test policy.

Measured process-relative milestones, synthetic timing only:

| Milestone | Reviewed ms / Export | Merged ms / Export |
| --- | --- | --- |
| Original assertion point, title v120 | 2223.48 / absent | 2447.54 / absent |
| Initial complete snapshot 120 accepted | 2329.60 / present | 2554.29 / present |
| List 121 invalidates certified 120 | 2556.59 / absent | 2783.17 / absent |
| Stale 120 retry rejected, floor remains 121 | 2913.00 / absent | 3160.11 / absent |
| Complete current 121 accepted | 2968.21 / present | 3227.40 / present |

Trace events record list metadata, requests/responses, each resource validation, App commit/acceptance, loading/error, floor/certification, DOM and exact assertion/wait points. Read-only console instrumentation was confined to disposable clones and removed before qualification. Recorded browser errors include Vite HMR/WebSocket failures and aborted intercepted requests; these were not demonstrated to cause the original hosted assertion failure. No real credentials were used. Published trace copies redact only ephemeral Vite query tokens, preserving raw/published hashes separately.

## Environment, qualification and publication

Fresh disposable reviewed/merged clones used their own regular copies of the same retained dependency fixture. All 329 installed lock records checked match: Node 22.23.3, Windows 10.0.26300 x64, Chrome 155.0.8059.85, Vite 6.4.4, Playwright 1.63.0, TypeScript 5.8.3, tsx 4.23.13, Express 4.22.3 and body-parser 1.20.9. npm lock SHA-256 `9f3922109682ea890fd3c241e6836995e7d223231b87e6b48452c665cd862d86` matches both. Local runs qualify diagnostic/test behavior, not clean installation, native lifecycle or the original operator workstation. Hosted Linux/Windows runners have separately recorded environments.

Qualification is recorded against master 46efc65 plus the exact corrected test overlay SHA-256 `02c996df249a72db911d53725a5d3cfc1ad5da6f2dbe34ccc1ac261adad91283`, with uninstrumented runtime source. Local qualification ran from 2026-10-24T02:13:24Z through 02:15:46Z, once per command:

| Command / scope | Actual result |
| --- | --- |
| Focused 44/47/48/49/50 selection, existing harness | 5 pass / 0 fail; other entries excluded only in this disposable focused runner |
| `node --import tsx scripts/testControlledDocVersionSync.ts` | 50 pass / 0 fail, no skipped entries |
| `node --import tsx scripts/testBodyParserSecurity.ts` | 7 pass / 0 fail |
| `node --import tsx scripts/testWorkspaceEnforcedServer.ts` | 8 pass / 0 fail |
| `node --import tsx scripts/testSecurityPerimeter.ts` | 52 pass / 0 fail |
| `node --import tsx server/security/testSecurityRegression.ts` | 34 pass / 0 fail |
| `node --import tsx server/security/testServerSecurityIntegration.ts` | 7 pass / 0 fail |
| `node --import tsx scripts/renderWbs.ts --check` | PASS, zero drift |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |

[Evidence archive](scenario44-readiness-20261024/evidence.zip): 547718 bytes, 53 members, SHA-256 `38f1f5a3587f10bb27693138ddb7ade77eab46809e004c1a1dc3bee5aa10fa35`. Contains plan/amendment, reproducible preparation/diagnosis/qualification helpers, both environment inventories, all 14 diagnostic outcomes/traces, full-suite inventory, qualification logs, original failure ZIP and raw/published digest manifest. Helper paths identify disposable environments; adapt paths to another isolated checkout, never an operator installation. A packaging comparison initially used Windows' default text encoding and falsely reported an outside-scenario delta; explicit UTF-8 comparison confirms all content outside Scenario 44 is byte-equivalent after newline normalization. No product source was changed to resolve that validation-tool error.

Hosted qualification is **PENDING at this document's capture**. The PR's additive evidence record must identify the signed PR HEAD, actual synthetic merge checkout/tree, all four jobs, complete-regression and controlled-document counts, and npm/frozen-Bun qualification. Do not interpret this local table or a future candidate run as actual post-merge master qualification.

## Review, rollback and retained boundaries

Request independent review from `jianzhihuoxin` on the new exact signed HEAD, including this narrow test diff, failure preservation, diagnostic limitations and untouched negative assertions. Approval of merged #86 does not approve this candidate. Merge is not authorized. A reviewed rollback may revert this isolated test correction; it would restore the known missing precondition and must not be called a green qualification strategy. Do not revert the body-parser correction.

PR #85 stays unchanged, draft and unmerged at `58ac7c4ae82490fc61ae72ea43f0024379aadf46`. Only a separately authorized correction merge followed by successful actual-master four-job CI permits its combined-candidate qualification to resume. Canonical WBS, historical receipts, five bootstrap-pinned documents, dependency files, runtime code and original operator installation/data/junction remain intact. No SDK work, historical WS04 activation, audit-capacity/retention policy, enrollment, task registration, runtime synchronization, feature implementation, privileged/live-agent activation, Gate 7 or release is authorized.
