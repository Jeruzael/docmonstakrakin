# Local MVP dashboard and discovery-gate correction

Baseline: `d503323aad1002f7325ba3a45faf4bee261686a9`. This is workstream 1 of the [eight-task implementation plan](../06_planning/LOCAL_MVP_COMPLETION_20261022.md), not closure of the full DMK-207 evidence/health contract or a canonical WBS mutation.

## Behavior and decisions

- The gauge measures applicable required discovery decisions. It exposes its numerator, denominator, formula and `DISCOVERY_COVERAGE/1` version. Stored health/security planning percentages are not measurement inputs.
- Implementation, verification, security and release dimensions explicitly remain unavailable until their scoped evidence inputs are admitted. No weighted overall-health percentage is invented.
- One shared discovery projection handles catalog requiredness, wizard-covered answers, deferred mandatory questions and unresolved project-setup metadata. Server recommendations and dashboard lists use it.
- Legacy saved response data is overlaid on current catalog definitions without writing to the saved project. Known catalog metadata cannot be replaced by an old incomplete row. This fixes the reproduced 21/20 = 105% calculation; it does not clamp percentages.
- Recommendation priority uses its actual severity. Project-level recommendations and questionnaire links navigate to discovery rather than opening a task with a project ID.
- New projects retain numeric legacy wire fields at zero for compatibility; those fields are not used as measured health. Existing persisted projects and historical records are not migrated.
- The project list and generated PRD stop advertising stored health percentages. Selecting and saving setup/release inputs is a later workstream-5 integration; this intermediate candidate identifies the open setup decisions without claiming they are resolved.

## Test-first evidence

The original three projection checks passed. Six added behavior checks failed on the original dashboard, then passed after the bounded correction. Four independent-review findings were reproduced as additional failures: legacy 105% coverage, fixed CRITICAL badge, project-ID task misnavigation and the questionnaire footer. The unchanged behavior checks then passed: **13 named checks**.

The first intermediate run also retained one overbroad test assertion that rejected legitimate measured 0% discovery along with unmeasured dimensions. It was corrected to assert each of the four unmeasured dimensions individually. A TypeScript fixture initially omitted required ProductBaseline arrays and was completed without changing behavior assertions. Raw outputs remain under `runtime/local-mvp-dashboard/`; no failed output is replaced with a successful label.

Full, compatibility, browser and hosted results must be recorded against their actual tested candidate/merge. Focused passes alone are not final integration qualification. The published PR and additive checkpoints will hold those later outcomes.

The first complete run was stopped after a genuine browser failure: a legacy recommendation without `targetEntityId` crashed the new target-dependent button label. Source hashes were unchanged during that run; its partial logs and interruption receipt remain under `runtime/local-mvp-dashboard/full-1/`. An added regression failed before the guarded fallback and then passed. The focused projection now has **14 passing checks**, the updated projects-workspace suite has **14 passing checks**, and the actual controlled-document version/audit browser suite has **50/50 passing cases** after the correction. The projects test now checks the discovery/evidence explanation instead of the removed stored health percentage. A quality-run fixture narrowing error was corrected by giving the deliberately mixed legacy-question array its actual `Question[]` type; behavior assertions remain intact. No partial full run is claimed as complete.

## Boundaries and rollback

Pre-integration `npm run ci:quality` passed after the fixture type correction: synchronized WBS rendering, TypeScript and production browser/server builds. The existing bundle-size warning remains. Full regression and hosted CI are pending on the combined integration candidate; no production capacity or operational release claim follows from this local result.

This changes local read-only projections and default planning fields only. It does not create evidence, approve requirements, enroll identities, change quorum, mutate canonical WBS/history, activate privileged routes/agents, execute Gate 7 or authorize release. A normal revert restores prior UI/projection/default wording; no data migration is required. Original failed verification evidence remains retained.
