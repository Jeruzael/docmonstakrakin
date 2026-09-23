# DMK-194 — Projects Workspace & Reliable Project Switching

Implementation evidence dated 2026-09-22. **VERIFICATION_PENDING. NOT human-verified.** This record does not authorize release, downstream implementation, or approval transitions.

## Scope, inspection and plan

Inspected App, Sidebar, TopBar, Project fields, project creation, search/dialog consumers, project API routes, ProjectStore/persistence and the existing tsx test conventions. The Projects navigation item existed but rendered a placeholder. App already owned the selection and loaded fourteen resources with a request sequence guard. Existing problems included seeded UI fallback data, stale header/dialog state, old mutation callbacks superseding a newer load, missing search props, and a GET questions handler that materialized discovery data in the canonical store.

Plan used: add a presentational Projects workspace; reuse App selection; strengthen request ordering, resets and readiness gating; verify with existing dependencies; make only the minimal read-side server fix needed for mutation-free switching; record evidence and leave human review pending. No new architecture or dependency was introduced.

Requirement: REQ-UX-PROJECTS-001, recorded from the supplied instruction in `docs/02_requirements/PROJECTS_WORKSPACE_REQUIREMENTS.md`. Component CMP-01; control SEC-CTRL-004. The historical reviewed bootstrap input remains unchanged.

## Files created

- `src/components/ProjectsView.tsx` — canonical project cards and loading/error/empty states.
- `src/data/projectWorkspace.ts` — typed complete payload loading, list retrieval and request coordination; no independent active-project model.
- `server/projectQueries.ts` — pure discovery catalog projection.
- `scripts/testProjectsWorkspace.ts` — 14 focused checks.
- `scripts/fixtures/projectsWorkspaceHttp.ts` — actual-server fixture in a generated temporary workspace.
- `docs/02_requirements/PROJECTS_WORKSPACE_REQUIREMENTS.md` — supplied requirement and testable criteria.
- This evidence record.

Ignored runtime helpers under `runtime/dmk-194/` retain pre-edit file hashes and the no-Git QA runner/copied control files. They are verification helpers, not application features.

## Files modified

- `src/App.tsx` — workspace route, sole selection handler, async coordination, loading/error recovery, empty initialization, scoped resets, creation/import integration and search props.
- `src/components/TopBar.tsx` — selected-project loading/error status and disabled search while scoped data is unavailable; existing visual structure retained.
- `server.ts` — discovery reads use a pure catalog projection; explicit answer saves still materialize the catalog transactionally.
- `package.json` — adds `test:projects-workspace`; no dependency or lockfile change.
- `scripts/renderWbs.ts` — Phase 12 now reflects IN_PROGRESS or VERIFICATION_PENDING instead of claiming technical completion while DMK-194 awaits review.
- `docs/00_control/MASTER_WBS.yaml` — DMK-194 only: BACKLOG → IN_PROGRESS → VERIFICATION_PENDING, expanded supplied criteria and actual evidence paths. No human_approved_by field added.
- `docs/00_control/MASTER_WBS.md` — regenerated, never manually edited.
- `docs/00_control/PROJECT_STATE.md` and `LAST_HANDOFF.md` — current task and safe resume point; prior bootstrap material retained as historical.

## Behavior and isolation

ProjectsView receives the canonical list, active ID, loading/error values and callbacks. It does not fetch project payloads or store its own selection. Cards show actual available name, ID, description, profiles, lifecycle, owner, release, sensitivity, delivery method, version, repository state, timestamps and health/readiness. Absent optional metadata is omitted. Emerald styling identifies the ready active project.

Both workspace and TopBar call App's `handleSelectProject`. Selection from Projects opens the overview; TopBar selection preserves the current scoped view. Successful creation updates the list, uses that same handler, closes the existing wizard and opens the overview. Import selection also uses the handler. The wizard itself is unchanged.

Flow: selector → App selection/reset → complete fourteen-resource GET load → one guarded commit of identity and all scoped collections → ready views. The selection ref mirrors App's choice only for synchronous race checks; it is not a second UI selection model. The loader owns only request sequencing/cancellation.

The scoped payload includes questions, requirements, risks, work, evidence, audit, next action, ADRs, components, approvals, features, standards and threats. Question/requirement/work selections, requirement subtab, search, override and package dialogs reset on selection. Scoped components/dialogs unmount while unready and remount for the ready project. Search receives that project's actual collections. Old requests cannot publish a result or error after another selection; even a late mutation-completion refresh is rejected before it can invalidate the current load.

The TopBar identifies the selected project and labels loading/unavailable status; old content is hidden until identity matches and all responses pass validation. Loading has a 20-second request bound. Errors expose retry and leave both selectors available. Project-list failure does not manufacture demo projects. Zero projects offers explicit creation; simply opening Projects never opens the wizard. Existing explicit `drawer=new-project` URL behavior remains intact.

The server change is necessary for the read-only selection invariant: previously GET `/questions` assigned the expanded catalog into `store.questions`. It now returns a detached projection, including saved answers, without canonical mutation. Coverage and next-action reads use the same projection so concurrent reads agree. POST `/answers` projects the catalog before validating and saving the explicit answer, preserving discovery for empty bootstrap collections without requiring a preceding GET. No new endpoint, governance change or persistence schema change was made.

## Automated verification

| Check | Command actually executed | Result |
| --- | --- | --- |
| Focused workspace regression | `npm.cmd run test:projects-workspace` | PASS, 14 named checks |
| TypeScript lint | `npm.cmd run lint` | PASS |
| Production build | `npm.cmd run build` | PASS; non-blocking bundle-size warning (~746 kB frontend bundle) |
| WBS generation | `npm.cmd run wbs:render` | PASS |
| WBS synchronization | `npm.cmd run wbs:check` | PASS, zero drift |
| Control-plane QA | `node --import ./node_modules/tsx/dist/loader.mjs runtime/dmk-194/qa-no-git.mjs` | PASS, 11 criteria |
| Bootstrap contract | `npm.cmd run test:bootstrap:contract` | PASS, 19 named checks |
| Bootstrap executor regression | `npm.cmd run test:bootstrap:executor` | PASS, 16 checks in temporary workspaces |
| Bootstrap execution-verifier regression | `npm.cmd run test:bootstrap:execution-verifier` | PASS, 20 checks in temporary workspaces |

The plain `npx tsx scripts/runAutomatedQa.ts` was deliberately not invoked at the repository root: its environment detector invokes Git there. The ignored runner copies only the current control documents, AGENT_BOOTSTRAP and renderer into a directory without its own `.git`, changes working directory, then invokes the unchanged QA script. Environment checks report that copied workspace's non-Git mode; this is not verification of the human checkout's branch. No QA assertion was removed or bypassed.

Initial focused runs failed while the new modules did not exist. Lint also caught test-fixture typing errors, which were corrected. Several sandboxed tsx invocations failed with esbuild `spawn EPERM`; authorized reruns passed. Tests were not weakened to suppress these failures.

Focused coverage: canonical list/metadata/active identity; empty and absent optional values; GET-only list reads; A→B→A full payloads; stale success; late mutation refresh; rapid A→B→C with stale failures; partial failure/retry; malformed response and wrong identity rejection; loading/error readiness; TopBar identity/status; App callback/reset/search wiring; pure catalog projection; and real HTTP switching with empty canonical questions. The HTTP test starts the actual server in a temporary directory, compares canonical exports and snapshot bytes before/after switching, then proves an explicit A answer persists while B remains intact. Synthetic fixture data is not a human approval or a live bootstrap execution.

The App wiring assertion checks source integration; static React rendering checks visible markup. Neither is represented as a browser interaction test. All human UI checks below remain pending.

## Protected state and boundaries

Before editing, file hashes were captured without Git. The integrity comparison found zero changes among 62 protected files/state files captured at that checkpoint, including the live `.local` snapshots, secrets, reviewed bootstrap manifest, retained execution evidence/review, operator reference, bootstrap/verifier implementation, approvals/quorum, release, SecretStore, portable package code, retained CryptoDemon evidence and `temp.txt`. No live application server or live bootstrap was started for verification. The HTTP regression used its own temporary directory and synthetic snapshot.

**Git boundary exception:** the initial attachment-read command also ran `git status --short`, `git branch --show-current` and `git log -1 --oneline` before the no-Git restriction was read. This violated the instruction; “no Git commands executed” cannot truthfully be confirmed. No subsequent Git command, Git mutation, branch creation, commit, push or merge occurred. The supplied working branch and starting master commit are operator-provided context, not additional Git inspection.

No self-bootstrap execution against canonical live state occurred. The specifically requested executor/verifier tests execute only isolated fixture ceremonies. No DMK-195+ implementation occurred. No human reviewer, quorum, release authorization or canonical bootstrap content was changed.

## Human UI checklist — all pending

- [ ] Open Projects from Sidebar; confirm every current canonical project appears, including PRJ-DOCMONSTAKRAKIN.
- [ ] Inspect actual metadata/lifecycle; confirm missing optional fields are not fabricated.
- [ ] Open A; confirm active styling and TopBar identity; note data in Requirements or Work.
- [ ] Return to Projects; open B; confirm B identity and B data, with A's selected IDs and dialogs absent.
- [ ] Switch rapidly A→B→another project using the selectors; confirm the final selection wins, including with delayed network responses.
- [ ] Switch back to A; confirm canonical data is intact.
- [ ] During loading, confirm old scoped content/search/package actions are unavailable; simulate a failed request and verify explicit error, retry and selecting another project.
- [ ] Verify the zero-project state in a disposable fixture; creation opens only by explicit action.
- [ ] If manually testing creation, confirm the existing wizard succeeds, the new project joins the list and becomes active without reloading.
- [ ] Verify switching alone adds no canonical questions, approvals, audits, signoffs or other writes.
- [ ] Inspect responsive layout, keyboard selection, search and dialog resets in the browser.
- [ ] Confirm Gate 7 is untouched; record human findings before any status approval.

This checklist is DMK-194 review preparation; DMK-191 CryptoDemon human retest has not been performed.

## Final lifecycle and next action

DMK-193 remains VERIFIED. DMK-194 is VERIFICATION_PENDING, **not VERIFIED and not human-approved**. DMK-195 through DMK-199 remain BACKLOG. DMK-191 remains BACKLOG. Gate 7 is HUMAN_APPROVAL_REQUIRED / NOT EXECUTED. Batch 2 is NOT STARTED. v0.1.0-rc1 remains RELEASE_CANDIDATE; v0.2 remains PLANNING / NOT READY.

Next safe action: human review of DMK-194 Projects Workspace and project-switching behavior. Do not advance this task to DMK-195. The existing large-bundle warning and visual/interaction verification are the remaining limitations recorded here.

## 2026-09-23 — Pre-merge regression remediation

The preceding 2026-09-22 record is retained unchanged as historical evidence. Its readiness-based unmounting description is superseded by the corrections below. **DMK-194 remains VERIFICATION_PENDING. No human approval or release authorization is recorded.**

### Audit and baseline

Audited the local Windows/PowerShell workspace with Node v22.21.1. Read AGENT_BOOTSTRAP, control/WBS/requirements/evidence, App and the requested components, loader, existing status/workspace tests, HTTP fixture, package scripts, and runner side effects before implementation. No applicable AGENTS.md was found in the repository/ancestor locations checked. Both defects were still present; neither path was reimplemented over an existing correction.

The active no-Git restriction was honored throughout this remediation, including indirect helper calls. Target branch `dmk-194-projects-workspace`, reviewed head `13a2d26f469210fcd730adf713ca43bff3794ff1`, and reviewed master `99d935064f70c790f77db160c018b56098863289` are **user-supplied, UNVERIFIED checkpoints**. Current branch, commit and uncommitted/committed classification cannot be confirmed without Git. No reset or branch switch occurred.

File inspection found the existing DMK-194 implementation, pure server discovery projection, and historical control/evidence updates. Comparing the available earlier hash inventory with the new starting inventory found only the eight previously recorded changed paths among comparable files; no additional difference outside that earlier recorded change list. This is bounded file continuity evidence, not proof of a clean Git checkout. The previous inventory did not include root `server.ts`; it was included in this session's inventory and left unchanged.

`runtime/dmk-194-remediation/before-hashes.json` records 209 files, including source, server, scripts, control documents, retained evidence, bootstrap input and live state/credential files. It was captured after installing the browser dependency but before application edits. An unmodified application-source baseline was copied without `.git`, live state, credentials or environment files for comparison runs. The installation output separately records two added packages; dependency installation is not concealed as baseline application work.

### Batch A — Same-project refresh and actual selection

Root cause: `projectReady` became false on every save refresh, so App removed RequirementsView/QuestionnaireView and their local state. A project-ID key cannot preserve state after removal. Error retry also called the selection handler, resetting context.

App now distinguishes a last-complete payload matching the selected ID (`projectMounted`) from action readiness (`projectReady`). `projectContentReady()` and the existing loader are unchanged. A same-project refresh keeps the tree mounted and shows refreshing status, with scoped content made inert. A refresh failure keeps those nodes mounted but hidden and inert, including their fixed drawers/overlays; an explicit error and keyboard-operable retry remain outside the hidden tree. Retry calls only `fetchProjectData`, never the successful mutation or selection-reset path. Successful complete payload commits update the canonical requirement shown in the retained drawer.

The current source has no `createPortal` calls: scoped drawers are rendered inside the gated view tree; search and override overlays have a separately gated container. Both containers cover their existing overlays/actions. No stale overlay remains interactive after failure. No unsupported claim about independently hosted future portal roots is made.

Actual project changes clear the previous payload and reset scoped selections/dialogs through the same App selection handler. Same-ID selection refreshes without resetting context. Explicit package restore/overwrite calls that handler with baseline replacement requested, including for the same ID. Cancellation, timeout, complete fourteen-resource commits, latest-request protection, and rejection of old-project refresh callbacks remain intact. App is still the sole selection owner. ProjectWizard, RequirementsView, QuestionnaireView, projectWorkspace loader and server/projectQueries were not changed.

**Pre-fix reproduction:** real App and real children mounted in Chrome. `batch-a-red.log` records 2 passes / 3 defect failures: A1 drawer node count became 0 during delayed GETs; A3 question 2 disappeared after answer refresh; A4 the drawer node count became 0 after refresh failure. A2 rejected mutation and A5 late selection isolation already passed. Fixture startup/selector errors from harness construction and sandbox `spawn EPERM` failures are not counted as defect reproductions.

**Post-fix Batch A:** all 5 passed before Batch B implementation. Final browser coverage also checks a legitimate unresolved-question filter change selects an applicable remaining question, inert refresh actions, keyboard retry, canonical final status, filter/search/tab preservation, and late A/B success/error responses after C is ready.

### Batch B — Global import and scoped export

Root cause: App supplied the package entry point and mounted PackageTransferModal only while `projectReady`; empty and failed workspaces therefore could not import.

TopBar now exposes an explicit **Import** action independently of readiness. It opens the existing importer in import mode. The package modal is mounted by explicit open state, outside scoped readiness gates, and keyed for intentional project-boundary resets. Its honest `Project | null` export prop receives only App's fully loaded, matching, ready selected project. With no such project it shows import and disables export; the export handler itself also guards absence and duplicate export-in-progress. No dummy project or non-null assertion was introduced for package access. File selection is keyboard accessible.

Successful import refetches the canonical project list and uses App's existing selection path with baseline replacement. The old delayed selection timer was removed so it cannot fire after an intentional modal/project reset. Existing package verification, invalid-package rejection, conflict handling, explicit overwrite checkbox and fresh-local-signoff policy are unchanged. No server package/security/schema behavior changed.

**Pre-fix reproduction:** `batch-b-red.log` records 0 passes / 4 grouped failures: explicit import absent in empty and failed workspaces, preventing B1/B2/B3 and the delayed-switch import portion of B4. The existing ready-project export was reached first in B4. No missing dependency or compilation failure is counted as this reproduction.

**Post-fix coverage:** B1 keyboard-opens import with zero projects and sends neither project creation nor export; B2 restores a sealed synthetic `PRJ-UI-A` package through the real server, selects it without reloading, and reopens the isolated snapshot to confirm persistence; B3 imports remain accessible after selected-load failure; B4 exports only exact ready IDs and forbids export during switching/refresh. B5 is grouped with B2: invalid packages and existing-ID conflicts preserve snapshot bytes, while explicit overwrite succeeds and resets the old same-ID drawer/filter. Imported approvals remain empty, granting no local signoff.

### Files and verification harness

Changed application files: `src/App.tsx`, `src/components/TopBar.tsx`, `src/components/PackageTransferModal.tsx`. Changed setup: `package.json`, `package-lock.json`. Added `scripts/testProjectsWorkspaceUi.ts` and `scripts/fixtures/projectsWorkspaceUiServer.ts`. Documentation changes are limited to this appended record and directly relevant checkpoint text in PROJECT_STATE/LAST_HANDOFF. WBS YAML/Markdown are unchanged.

Only dev dependency `playwright` was added (resolved 1.63.0, with playwright-core); no runtime dependency or unrelated upgrade was requested. Installation: `npm.cmd install --save-dev playwright --ignore-scripts`, exit 0 after an initial sandbox cache restriction. The lockfile records these additions. The harness uses installed Chrome/Edge on Windows, `DMK_TEST_BROWSER` when supplied, or Playwright's installed Chromium elsewhere. A browser installation is a prerequisite on other machines; startup failures are not test passes.

Named route: `npm run test:projects-workspace:ui`. It is appended to `npm test`; the existing complete runner discovers its `test*.ts` file automatically. The harness renders the real App and real child components, controls only API timing for A/isolated-readiness cases, and proxies B2/B5 API calls to an actual disposable server. Synthetic files are in generated OS temporary directories. The fixture does not inherit provider/reviewer/master-key credentials. The browser smoke uses real Chrome, including keyboard import/file selection and retry. Screenshots of refresh, failed refresh and empty import were inspected; they are automated evidence, not human approval.

### Commands and results

All listed exits are observed. Fresh-copy commands were dispatched by `node runtime/dmk-194-remediation/run-isolated.mjs <baseline|after> <test|complete|manifest|contract|executor|verifier>`. The helper copies only source/configuration/docs, links installed dependencies, and excludes Git metadata, live state, credentials and `.env` files. Each command gets its own disposable copy, so standalone bootstrap checks use the original retained evidence bytes. Logs and per-command JSON records are under `runtime/dmk-194-remediation/`.

| Command | Observed result |
| --- | --- |
| `node_modules/.bin/tsx.cmd scripts/testProjectsWorkspaceUi.ts` before Batch A | Exit 1; 2 passed, 3 reproduced defect failures (`batch-a-red.log`) |
| Same UI runner after Batch A, before Batch B tests | Exit 0; 5/5 |
| UI runner with `DMK_UI_CASE=B`, before Batch B fix | Exit 1; 0 passed, 4 grouped failures (`batch-b-red.log`) |
| `npm.cmd run test:projects-workspace:ui` | Exit 0; 9 grouped checks covering A1–A5/B1–B5; also passes inside final `npm test` and broader run |
| `npm.cmd run test:projects-workspace` | Exit 0; 14 checks, including original real HTTP A–B–A export/snapshot immutability and A-only answer persistence |
| `npm.cmd test` — baseline isolated copy | Exit 0; 137 named checks (`baseline-test.log`) |
| `npm.cmd test` — corrected isolated copy | Exit 0; 146 named checks, including 9 browser checks (`after-test.log`) |
| `npm.cmd run test:bootstrap:contract` — fresh isolated copy | Exit 0; 19 checks (`after-contract.log`) |
| `npm.cmd run test:bootstrap:manifest` — fresh isolated copy | Exit 0; 28 documents checked, 24 pinned hashes verified, 4 unpinned living docs, 4 evidence hashes verified; report written only in copy (`after-manifest.log`) |
| `npm.cmd run test:bootstrap:executor` — fresh isolated copy | Exit 0; 16 fixture-only checks (`after-executor.log`) |
| `npm.cmd run test:bootstrap:execution-verifier` — fresh isolated copy | Exit 0; 20 fixture-only checks (`after-verifier.log`) |
| `npm.cmd run lint` | Exit 0 |
| `npm.cmd run build` | Exit 0; existing non-blocking large-chunk warning, frontend ~747.71 kB / gzip 196.59 kB |
| `npm.cmd run wbs:check` | Exit 0; zero drift; no YAML edit or regeneration needed |
| `node_modules/.bin/tsx.cmd runtime/dmk-194/qa-no-git.mjs` — final documentation check | Exit 0; 11 QA criteria against copied control files without Git metadata; not checkout branch verification |
| `npm.cmd run test:complete` — baseline isolated copy, Git suite excluded | Exit 1; 25 executed suites: 23 passed, 2 failed; 326 passing named checks / 2 failure markers |
| `npm.cmd run test:complete` — corrected isolated copy, Git suite excluded | Exit 1; 26 executed suites: 24 passed, the same 2 failed; 335 passing named checks / 2 failure markers |

**Broader failures and blocked coverage:** the full unmodified complete route is BLOCKED by `scripts/testEnvironmentFixtures.ts`, which unconditionally runs Git initialization/configuration/commit commands. In each disposable copy only, that file was renamed out of test discovery before invoking the unchanged runner. It was not executed, not counted as passing, and the tracked file was not changed. The runner's emitted totals describe the executed subset; they do not include this additional blocked suite.

The two actual failures in both baseline and corrected broader runs are `scripts/testSelfBootstrapExecutionVerifier.ts` and `scripts/testSelfBootstrapExecutor.ts`. Earlier `testCryptoDemonIntegration.ts` regenerates `cryptodemon-fixture-evidence.json` in that copy; subsequent bootstrap checks correctly reject its mismatch with pinned EV-RC-187 (`INVALID_MANIFEST`). Baseline execution-verifier output explicitly reports that evidence hash mismatch. This is reproduced before the application fixes and has the same failing suite set afterward. Standalone fresh-copy executor/verifier both pass. Pinned artifacts and expected hashes were not rewritten to force a pass; broad runner/evidence-order repair is outside these two corrections.

Raw broader logs/results: `baseline-complete-evidence/` and `after-complete-evidence/` beneath the runtime directory. Browser results/screenshots: `ui/results.json`, `ui/refresh.png`, `ui/refresh-error.png`, `ui/empty-import.png`. Those files are local ignored evidence; the dated counts, failure causes and reproduction details above are retained in this repository document.

### Integrity, limitations and handoff

Hash comparison (`runtime/dmk-194-remediation/final-integrity.json`) checks 201 captured files outside the explicit change allowlist, with zero protected changes. This includes live project snapshot, baseline backup, execution-verification snapshot, machine token, reviewed manifest, retained bootstrap/CryptoDemon evidence, SecretStore/auth/approval/quorum/release/portable-package server code, server bootstrap/verifier code, loader, pure discovery projection, wizard and WBS files. No operator live server or self-bootstrap execution was used. Test imports, writes and fixture signoffs occurred only in disposable workspaces. Current branch/head remain unverified under the no-Git instruction. No Git command, commit, push, pull request, merge, deployment or release occurred in this remediation.

Human checks remain pending; automated Chrome interaction and screenshot inspection do not check these boxes:

- [ ] Human review of requirement row-opened drawer/filter/tab preservation, canonical status and rejected mutations.
- [ ] Human review of questionnaire context and legitimate applicability/filter changes after saves.
- [ ] Human review of failed-refresh hiding, overlay inaccessibility, retry and switching during refresh.
- [ ] Human review of empty/failed-workspace import, exact-project export gating, conflicts and explicit overwrite reset.
- [ ] Human responsive/accessibility review beyond the automated desktop keyboard smoke.

Governance remains unchanged: DMK-193 VERIFIED; DMK-194 VERIFICATION_PENDING; DMK-195–199 BACKLOG; DMK-191 human retest not performed; Batch 2 NOT STARTED; Gate 7 HUMAN_APPROVAL_REQUIRED / NOT EXECUTED; v0.1.0-rc1 RELEASE_CANDIDATE; v0.2 PLANNING / NOT READY. Next action is human DMK-194 review. Stop after this handoff.
