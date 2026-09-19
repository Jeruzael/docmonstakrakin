# External proposal schema 1.1 remediation report

Date: 2026-09-19. WBS: DMK-190. Evidence: EV-RC-190. Technical completion only; human retest remains pending.

## 1. Root causes

Text validation confused ordinary JavaScript words with unresolved templates. The legacy wire field `id` meant an external proposal ID for CREATE and a canonical target for MODIFY. Compiler guidance did not distinguish editable targets from other references. Import errors lost their field/type context in the UI. Historical sessions also needed a tolerant display path when current validation became stricter.

## 2. Files changed

Protocol implementation: `src/data/generationValidation.ts`, `src/data/proposalContract.ts` (new), `src/proposalTypes.ts`, `src/types.ts`, `src/data/contextPackageCompiler.ts`, `server/proposals/review.ts`, `server/proposals/targetResolution.ts` (new), `src/components/ImportReviewView.tsx`, `src/components/PromptCompilerView.tsx`.

Tests: `scripts/testProposalContract.ts` (new), `scripts/fixtures/proposalContractScenarios.ts` (new), `scripts/testCryptoDemon.ts`, `scripts/testCryptoDemonIntegration.ts`, `package.json`.

The continuing remediation also updates control records, evidence, QA registry and their checks in `scripts/runAutomatedQa.ts` and `scripts/renderWbs.ts`. Pre-existing `test.json` is tracked and preserved.

## 3. Schema v1.1 design

Each change has a unique response-local `proposal_id`, one supported `artifact_type`, an `action`, explicit `target`, and a `proposed` content object. CREATE permits null/absent target and cannot choose its eventual canonical ID. MODIFY supplies an exact canonical ID/type pair. Server-generated canonical IDs are allocated only after authenticated human acceptance.

Supported proposal types remain REQUIREMENT, ADR, RISK, WORK_ITEM and CODE_MODIFICATION. Features remain reference-only. CODE_MODIFICATION creates proposed work; modifications of existing work use WORK_ITEM.

The compiler emits a machine-readable `editable_artifacts` manifest for its current scope and schema 1.1 only. The contract requires copying target IDs verbatim and forbids constructing, inferring, transforming or guessing them. A reference elsewhere in the context is not permission to modify it.

## 4. Backward compatibility

Both 1.0 and 1.1 normalize to distinct internal proposal identity, artifact type and target fields. Legacy CREATE keeps `id` as its proposal identity. Legacy MODIFY keeps `id` as its target and derives `LEGACY-MODIFY-<index>` as its session-local proposal identity. Original wire JSON and changes remain intact; normalization is additive.

Previously stored sessions without normalized data remain readable. Entries that do not satisfy current rules show preserved JSON and a read-only diagnostic rather than crashing the page. New staging and acceptance still enforce current validation; corrected content can be submitted in a new session. No destructive data migration was introduced.

## 5. Text validation

`NaN`, `null`, `undefined`, `Infinity`, `infinite`, `true` and `false` are legal strings, including standalone words. Actual numeric NaN/infinities remain invalid. JSON null is not globally rejected; required string/object/array fields enforce their own schema.

Serialization markers `[object Object]` / `[object Array]`, moustache templates, `${...}`, ERB templates and `__PLACEHOLDER__` remain invalid. Template failures use `INVALID_TEMPLATE_ARTIFACT` with an indexed content path.

## 6. Target resolution

Targets are resolved from the current project's canonical collections. Missing/cross-project targets return `TARGET_NOT_FOUND`; IDs found in a different collection return `TARGET_TYPE_MISMATCH`, including a FEATURE incorrectly submitted as a REQUIREMENT. No invalid MODIFY is converted to CREATE.

Compiler-origin UI imports submit their mode/work-item context. The server recomputes and records the editable manifest; acceptance revalidates both canonical identity/type and that saved scope. A manual API import without compiler context uses supported current-project canonical targets; it does not prove that a target was present in a particular earlier prompt. Human review is required in both paths. The manifest governs amendment proposals, not direct writes to originals.

## 7. UI diagnostics

The review page displays error code, message, field path, proposal ID, target ID and expected/received type when available. Diagnostic context is restricted to strings so malformed object-valued IDs cannot crash React. No stack trace is rendered. The compiler footer now says `proposal-v1.1`.

## 8. Tests added

The focused suite has 12 named checks: requested A–J behavior plus malformed diagnostic values and historical display compatibility. Ten additional HTTP checks exercise production routes for staged CREATE, authenticated acceptance, immutable MODIFY, indexed missing/type errors, duplicate IDs, compiler scope, governance injection, legacy MODIFY and template rejection. The full HTTP suite now has 47 checks.

Original JSON, provider/model, digest, timestamp, proposal/target IDs, assumptions, reviewer identity, disposition, resulting IDs and audit remain preserved. Authentication/quorum and portable trust checks remain in the integration suite.

## 9. Commands executed

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test
node_modules/.bin/tsx.cmd scripts/testProposalContract.ts
node_modules/.bin/tsx.cmd scripts/testCryptoDemonIntegration.ts
node_modules/.bin/tsx.cmd scripts/runCompleteRegression.ts
node_modules/.bin/tsx.cmd scripts/renderWbs.ts
node_modules/.bin/tsx.cmd scripts/renderWbs.ts --check
git diff --check
```

The first sandboxed npm test attempt stopped at an esbuild `spawn EPERM`; the authorized rerun passed. This restriction did not justify changing or removing tests. Final command and suite logs are retained under `rc-regression/`.

## 10. Results

Lint, production build, npm test and the complete regression inventory pass. Final inventory: 22 suites; 310 observed named checks passed, 0 failures, 0 skipped. Authoritative current evidence is in `rc-regression/results.json`. (An earlier historical run recorded 21 suites / 291 checks). Counts are named result lines, not individual assert-call counts. The QA registry separately maps 93 automated criteria: 93 PASS, 0 FAIL, 0 BLOCKED, 0 N/A. Human browser retest is outside those counts.

Independent bounded protocol review initially found two P2 display issues and one P3 label issue. All were fixed, independently re-reviewed and tested. Final unresolved protocol findings: P0 0 / P1 0 / P2 0 / P3 0.

## 11. Risks and follow-up

Gio must still perform the manual browser retest. Local reviewer accounts require operator configuration; there are no default human credentials. Scope binding for manual imports without compiler context is project-wide as described above. Legacy nonconforming history is viewable but must be resubmitted in a corrected session for new review. The build retains a non-blocking large-bundle warning. No FEATURE mutation, unrelated architecture redesign, real Gate 7 execution or v0.2 implementation was added.

## 12. Git summary

Historical execution context: Initial protocol closeout was conducted against host path `C:/Users/HomePC/dev/docmonstakrakin` (branch `master`, starting HEAD `7363da9ef4f0d7f3bf0be296c8662976253eb6e7`). Earlier remediation was already included by external/user commits.

Current review state:
- Repository: Jeruzael/docmonstakrakin
- Review branch: gaistudio
- Review checkpoint: 93ea030aa34e493cb7480df4b2e5d2ed6a326dda
- Target branch: master

Review the Git diff for tracked changes.
