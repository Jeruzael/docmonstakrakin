# PR #86 — Scenario 47 diagnosis and bounded test readiness correction

Date: 2026-10-24 (Asia/Taipei). Status: test/evidence candidate; independent human review and explicit integration authorization remain required. This record is agent-authored under the operator's bounded Scenario 47 instruction, not a GitHub human approval.

## Revision and failure preservation

| Evidence | Exact identity / result |
| --- | --- |
| Refreshed master | `796adced2b0e9795b801c808359dee9c8839d7c4`; tree `1afa1bda64e1dd43243603faa5cffa6a6bc57db6` |
| Original signed PR #86 | `8950479055a3d63689d5e73b29185bf8f6923242`; tree `cb21f9d0a7f909cf8951cfa6fd2a378f056cf904` |
| Failed hosted run | [40043247470, attempt 1](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40043247470), unchanged, not rerun |
| Linux synthetic checkout | `6593a6599a4c6f78418206a2668b91769ec3c6b8`, parents master796adced and candidate8950479; same tree `cb21f9d0a7f909cf8951cfa6fd2a378f056cf904` |
| Original hosted results | Quality SUCCESS; Controlled Documents SUCCESS; Windows Native SUCCESS; Complete Regression FAILURE: 139/140 suites, 2773/2774 checks, 1 failed, 0 skipped |
| Original failure | Version-sync suite 49 pass/1 fail at Scenario47 initial Export visibility assertion, line3786; no readiness trace was captured by that original run |
| Original artifact | [12540208323](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40043247470/artifacts/12540208323), 439289 bytes; SHA-256 `9c4f2aa762980f9d426c07c003414bc5d7d13da83f3432e8962c6c969949356e` |

The original artifact is also included byte-for-byte in the archive below. Earlier master audit failure40036517930 and the original body-parser before/after evidence remain unchanged in [the security remediation record](BODY_PARSER_SECURITY_REMEDIATION_20261024.md) and its archives. Passing later CI does not erase or independently diagnose either failure.

## Supported cause and boundary

The unchanged harness returns after the project-list-derived title is visible. In App, that metadata can render while the separate complete project load is pending. The loader combines14 resource responses, validates them, and only then invokes App's snapshot acceptance. App also requires a matching selected project, no loading/error, and a certified snapshot version at least as new as its accepted version floor before rendering Export.

Scenario47 incorrectly assumed harness return established that stronger precondition. Its immediate `isVisible()` assertion does not wait for readiness ([Playwright API](https://playwright.dev/docs/api/class-locator#locator-is-visible)). Deterministically holding the initial project response reproduced title `v120` with no certification and no Export on both master and candidate. Releasing that response allowed the unchanged app to certify120 and expose Export. This establishes a test-precondition defect consistent with the hosted assertion failure; the exact original hosted scheduling cannot be reconstructed without its missing trace.

Every `/api/**` request in this browser scenario is mocked by the existing route handler, including session, project list, project resources, document save and audit. Unmatched API requests receive mocked404. Vite serves the real UI/assets; the application backend and body-parser are not in this scenario's request path. The separate actual-server/parser security tests remain necessary and passed. No parser or production authorization defect was demonstrated by this browser investigation.

## Fixed diagnostic matrix and outcomes

One invocation per cell; no retry-until-green. Diagnostic-only App console instrumentation recorded actual readiness, loading, error, version floor and certified version without setting them. Generated test-overlay hashes and exact checkout identities appear in `matrix.json`. The App instrumentation was removed before corrected qualification.

| Mode | Master796adced | Candidate8950479 |
| --- | --- | --- |
| Ordinary original Scenario47 | FAIL before assertion: initial `page.goto` domcontentloaded exceeded existing8000ms; not counted as readiness reproduction | PASS1/1 |
| Hold initial complete snapshot, inspect title/absence, release, run lifecycle | PASS: title visible, original visibility precondition false, real snapshot acceptance restores readiness | Same PASS |
| Missing initial snapshot | Expected bounded readiness timeout; 8016ms measured | Expected timeout; 8006ms |
| Invalid snapshot stateVersion | Expected bounded readiness timeout; 8016ms measured | Expected timeout; 8009ms |

In the held runs, observed milestones after process-local measurement start:

| Milestone | Master ms / Export | Candidate ms / Export |
| --- | --- | --- |
| Harness title-only return | 2674.78 / absent | 2877.72 / absent |
| Accepted initial120 snapshot | 2766.00 / present | 2981.75 / present |
| Save acknowledgment121, certification still120 | 3657.00 / absent | 4000.40 / absent |
| Stale120 snapshot rejected | 4050.51 / absent | 4406.80 / absent |
| Accepted complete121 snapshot | 4149.18 / present | 4499.39 / present |

These timings describe synthetic scheduling, not performance budgets. Negative-control PASS means the wait failed as required; it does not mean readiness was granted.

Captured browser logs include Vite WebSocket/HMR connection failures and aborted mocked session/document requests; none was demonstrated to cause the hosted assertion failure. The ordinary baseline navigation timeout remains an unresolved diagnostic limitation. Clone creation initially reported Windows path-length omissions; clone-local `core.longpaths=true`, restore, and an empty tracked status were required before experiments. No SDK or machine-wide settings were changed.

## Minimal correction

Only `scripts/testControlledDocVersionSync.ts`, inside Scenario47:

1. Await Export visibility using `packageBtn.waitFor({state:'visible'})` before the original initial assertions. It inherits the existing8000ms timeout and does not grant readiness.
2. Replace the existing300ms stale-retry sleep with the actual project GET response and the retry control's settled, enabled state.

All original lifecycle assertions remain: initial certified Export; save acknowledgment alone insufficient; stale snapshot insufficient; accepted complete current snapshot required. Missing/invalid readiness stays bounded and fails. No shared harness behavior, application state, permission check, dependency version, request limit, global timeout, assertion or other scenario changed. Other scenarios deliberately retain loading/empty/failed/stale fixtures.

## Local qualification and reproducibility

Both disposable clones used their own regular copies of retained dependencies.329 installed lock records matched the corresponding versions; Express4.22.3, body-parser1.20.8 versus1.20.9, Vite6.4.4, Playwright1.63.0, TypeScript5.8.3, tsx4.23.13, qualified portable Node22.23.3, Chrome155.0.8059.85, Windows10.0.26300/x64. This is matched diagnostic provenance, not clean-install or native lifecycle qualification. No operator dependency junction was used or modified.

Corrected qualification used uninstrumented application source at candidate8950479 plus the test overlay SHA-256 `b4cd3e452d30dd43dc314d38b73dafed224656141209d9e547924e677773f6a5`. Exact timestamps, commands, commit/tree and outputs are archived. The source file in the new signed commit must match that overlay.

| Command / scope | Actual local outcome |
| --- | --- |
| Focused Scenario47 extraction using unchanged harness | 1 pass, 0 fail |
| `node --import tsx scripts/testControlledDocVersionSync.ts` | 50 pass, 0 fail, no skipped scenarios; approximately78s |
| `node --import tsx scripts/testBodyParserSecurity.ts` | 7 pass, 0 fail |
| `node --import tsx scripts/testWorkspaceEnforcedServer.ts` | 8 pass, 0 fail |
| `node --import tsx scripts/testSecurityPerimeter.ts` | 52 pass, 0 fail |
| `node --import tsx server/security/testSecurityRegression.ts` | 34 pass, 0 fail |
| `node --import tsx server/security/testServerSecurityIntegration.ts` | 7 pass, 0 fail |
| Retained TypeScript compiler `--noEmit --project <disposable>/tsconfig.json` | Exit0 |

[Diagnostic and qualification archive](body-parser-security-20261024/scenario47-evidence.zip): 484744 bytes; SHA-256 `4b9db6c1c2aee28cadd255ad1f293b496278d3a69ce7b49cb8dca8e4d76b3daa`. It includes the fixed plan, preparation/diagnosis/qualification helpers, environment inventory, all eight traces/outcomes, local qualification logs, publication manifest and original failure artifact. Paths in helpers are explicit recorded disposable paths; adapt them to another isolated environment before reproducing. Do not run them against an operator checkout. Published trace copies redact only disposable Vite query tokens; raw and published hashes are separately retained. No real credentials or operator data were captured.

## Publication, acceptance and rollback

This follow-up is a distinct signed test/evidence commit on PR86; original8950479 remains in history. At document capture, new-HEAD hosted qualification is PENDING. The PR must record the final signed HEAD, actual Linux synthetic merge identity/tree, all four CI jobs, full version-sync and complete-regression counts, npm/frozen-Bun audits and Windows qualification. Fresh hosted installs are the installation evidence; local retained copies cannot substitute. No original failure is silently retried.

Independent reviewer `jianzhihuoxin` must review the final HEAD and this delta as well as the dependency correction. Review request is not approval, and approval of8950479 would not automatically cover this change. Keep86 draft and85 unchanged/unmerged. Any failed final gate must remain recorded and evaluated rather than retried just for green.

Rollback before integration can drop/revert this isolated test correction through an ordinary reviewed commit; doing so restores the known readiness race and is not a green qualification strategy. Do not revert the dependency patch as part of this correction.

Canonical WBS, historical receipts, bootstrap-pinned documents, runtime code, dependency files, original operator state and prior evidence are unchanged by this follow-up. Missing local SDK, historical WS04 and4096-entry capacity remain separate unresolved scopes. No real enrollment, operational synchronization, production trust, privileged-route or agent activation, Gate7, release or merge is authorized.
