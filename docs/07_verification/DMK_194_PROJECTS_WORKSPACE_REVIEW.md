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
