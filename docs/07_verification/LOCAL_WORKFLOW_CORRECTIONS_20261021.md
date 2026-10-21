# Local workflow discovery corrections — 2026-10-21

This is a bounded non-security frontend correction candidate on `codex/local-workflow-corrections`, based on `5d10299cc0aa6f93b4f2861bf1bdd5167cbfba09`. It changes the existing questionnaire and its regression coverage. It does not register or complete WBS items, change canonical or historical records, grant authority, or activate an external integration.

## Reproduced defects and resulting behavior

1. An empty domain or unresolved filter fell back to the first question outside that filter. A shrinking list also displayed positions such as `Question 3 of 1`. The questionnaire now renders its existing empty state and clamps both the displayed position and subsequent navigation to the filtered list.
2. Returning to a saved structured technical answer coerced it to `[object Object]` and selected User Specified regardless of its recorded mode. The questionnaire now uses the existing `normalizeTechChoice` contract to restore accepted recommendations, structured user selections and their selected-option badge. Legacy string selections remain editable; deferred legacy decisions restore Unknown / Defer. Restoration never submits an answer or ratifies an architecture decision. The existing accepted recommendation payload retains `NOT_RATIFIED`.
3. The readiness card and domain navigation independently counted raw question states, ignoring wizard contributions and the mandatory-question denominator already used by the coverage projection. A two-question synthetic fixture with one wizard-resolved mandatory question showed 0% instead of 50%. These displays now consume the existing `calculateDiscoveryCoverage` result. The Blockers filter uses the existing mandatory-question and wizard-coverage helpers to show unresolved question blockers consistently with that projection. The coverage engine, server acceptance rules and governance actions are unchanged.

Existing requirement context: DMK-027 / REQ-UX-003 describes interactive readiness updates; DMK-186 / REQ-REQ-001 describes valid adaptive navigation. These references describe existing functionality only; no canonical status transition is made by this candidate.

## Test isolation and assumptions

`scripts/testDiscoveryQuestionnaireUi.ts` bundles the actual React component with esbuild in memory and mounts it in a headless Playwright browser. It exercises real browser events, React state and effects. Its only persistence substitute is an in-memory `onAnswerQuestion` callback that records the component's payload and returns it as refreshed question state. It does not claim to test HTTP persistence, authorization, derivation or the complete project journey.

- No application HTTP server or loopback listener is started.
- Every browser request is aborted; each passing case also asserts that no request occurred and that no browser runtime error occurred.
- Synthetic project/question fixtures use the existing catalog and types. The project has an explicit local source-control selection, avoiding an unrelated open metadata prerequisite in the hand-calculated readiness cases.
- The test launches `DMK_TEST_BROWSER`, a detected local Chrome/Edge executable, or Playwright's installed Chromium. It writes no browser or application state to the repository.
- Dependencies were installed physically in this managed worktree with `npm ci --ignore-scripts --no-audit --no-fund` (316 packages). The primary checkout's dependency junction was not used. Installation emitted the existing `node-domexception@1.0.0` deprecation warning.
- The existing complete-regression runner discovers `test*.ts`; no manifest, lockfile or runner edit is needed.

## RED and GREEN evidence

Before changing the component, the new script exited 1 with **1 passed / 8 failed**. The failures were:

| Case | Observed failure |
| --- | --- |
| D1 empty domain | Existing empty-state count was 0 instead of 1 |
| D2 empty unresolved filter | Existing empty-state count was 0 instead of 1 |
| D3 shrinking list | `Question 3 of 1` instead of `Question 1 of 1` |
| T1 recommendation round trip | User-specified custom input remained visible after navigation |
| T3 structured user selection | `[object Object]` instead of the saved custom runtime |
| T4 deferred legacy decision | Unknown mode was not selected |
| R1 wizard contribution | Readiness showed 0% instead of 50% |
| R2 mandatory denominator | Readiness showed 0% instead of 100% |

T2, the legacy string compatibility case, already passed. After the first correction, these nine cases passed. An additional T5 visual regression then exited 1 with **9 passed / 1 failed** because a known structured selection lacked its selected-option badge. Normalizing the saved selection for that badge addressed the same restoration defect.

Final focused verification in the isolated Windows worktree:

| Command | Result |
| --- | --- |
| `node --import tsx scripts/testDiscoveryQuestionnaireUi.ts` | PASS: 10 named cases, zero failures |
| `node --import tsx scripts/testDiscoveryRemediation.ts` | PASS: 36 criteria, zero failures |
| `node --import tsx scripts/testTechnicalBaseline.ts` | PASS: 10 criteria, zero failures |
| `npm run lint` | PASS: TypeScript, exit 0 |
| `git diff --check` | PASS, exit 0 |

No remaining focused test failure was observed. Full Windows/Linux regression, build, independent review, exact publication HEAD, remote CI and integration are separate parent workstream checks; this record does not claim those checks have completed.

## Existing local journey and deliberate boundaries

The following is a source trace of existing behavior, not a live-operator acceptance run:

- Project creation initializes profile-filtered discovery, product-baseline features, an initial READY WorkItem, and audit state. Discovery answers can derive PROPOSED requirements and refresh coverage. The corrected questionnaire displays and navigates this existing state truthfully.
- Work Management exposes existing WorkItems, status updates and checklists. It has no manual WorkItem-creation form. Existing external proposal review can create linked proposed WorkItems, subject to its reviewer authority.
- Controlled documents expose catalog/read/diff/validation behavior. Committing a controlled-document save retains its specialized reviewer requirement.
- Prompt compilation is deterministic client behavior and does not require a Gemini key. Summary and Full Baseline modes produce context. Task Context deliberately blocks implementation handoff for the initially unlinked WorkItem until governing requirements or features are linked.
- Evidence Center displays existing evidence and audit entries. This candidate adds no evidence-attachment endpoint or verification authority.
- External proposal acceptance, controlled-document saves and release sign-off retain their existing reviewer gates. Agent dispatch, repository access, secret administration and AI-status access remain deliberately unavailable under the existing route policy.

No credential, backend route, protected action, policy, live agent, enrollment, operator state, Gate 7 or release-promotion change is included.
