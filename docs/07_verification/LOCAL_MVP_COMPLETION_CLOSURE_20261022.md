# Eight-workstream local MVP closure — 2026-10-22

This additive checkpoint records actual engineering integration. It supersedes the pending execution instructions in the earlier local-MVP candidate documents while preserving their historical evidence. It does not change canonical task status, establish actual human independence, ratify governance policy or authorize production activation.

## Integration identity and chronology

- Starting master: `d503323aad1002f7325ba3a45faf4bee261686a9`.
- [PR #80](https://github.com/Jeruzael/docmonstakrakin/pull/80) signed candidate: `818fc28357f7b381d34e46f5faf799aad26acbd4`; GitHub signature `verified: true`, reason `valid`.
- Candidate and actual merged tree: `45d51f48c68a91bd5233569c6301b44c786b1e15`; effective scope 84 files, with no dependency/lockfile, workflow, canonical WBS or historical receipt changes.
- Agent-invoked ordinary GitHub merge through Jeruzael at `2026-10-22T04:21:45Z`, under the operator's explicit autonomous development authorization and ordinary-review waiver. No GitHub human APPROVED review exists for this candidate; no retrospective approval is claimed.
- Actual master merge: `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`, with valid GitHub signature and ordered parents `d503323aad1002f7325ba3a45faf4bee261686a9` and `818fc28357f7b381d34e46f5faf799aad26acbd4`.
- Fresh pre-merge checks found unchanged master/HEAD, four successful required checks, no review threads and clean mergeability. The ordinary merge endpoint used the exact expected HEAD; no force, protection change, bypass or auto-merge was used.

## Qualification

Candidate [run 39720882220](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39720882220) passed all four jobs. Its Linux jobs checked synthetic merge `b2d7aed5dcd8f6c097464b892baddd537577ea94`; independently verified parents and tree matched the same baseline/candidate and tree above. Windows explicitly checked candidate `818fc283`. Candidate association and actual checked-out commit are distinct facts.

The second Windows-local run, from `2026-10-22T04:10:39.0435216Z` to `2026-10-22T04:21:02.8450322Z`, passed **114/114 suites and 2,481/2,481 runner-reported checks**, with zero failures/skips; WBS integrity, TypeScript and production build exited 0. Every tracked source hash remained unchanged. The synthetic root snapshot SHA-256 before/after was `DB02065EC9F6950B9ACF9DCBD817F7C409EEA3A61C3BC85DE454BD3495B8D826`. This used retained task-owned packages, not a clean operator installation.

Supplemental raw-file SHA-256 digests: complete output `83954B34E69C2C0A21524EBD7D1BB3A8B767362367D9A8F9E6E71EE463D2B2BC`, quality output `A05D0137AFA6645D338C37EA86C264A79F483F56B4449752BFF39D79047C253D`, verification receipt `B73873936361638FBFAB400499DB2964C4203EBAA4E251BF9745A389730E7099`. These identify the retained supplemental local files; the public CI and committed tests establish reproducible execution evidence without requiring Codex temporary paths.

An additional local smoke at `04:27:29.493Z`–`04:27:30.836Z` launched the actual built `dist/server.cjs`, served the production static UI, checked health/anonymous setup, created an ordinary synthetic project and restarted with the exact persisted snapshot digest `a8bff24f1e504b769a416b1e3b9183f18a85bfa63cf285d11b75f211f1ccb5b1`. It used Node 22.23.3, retained task-owned dependencies, a fresh owned temporary working directory, no inherited roster/provider credentials and an explicit preload denying native credential subprocess acquisition. It qualifies the built-server path under that isolation, not normal access to the operator's native credential store. The first smoke harness incorrectly expected `authenticated: false` instead of the actual `identity: null` response; its failed receipt is retained. Correcting only that assertion produced the five-check pass. The public committed nine-stage App/server test remains the independently reproducible end-to-end qualification; this ad hoc built-server run is supplemental evidence.

Actual master [post-merge run 39721949800](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800), on `7c20c82856bd7a3be2d97d8f1bb6c59fe3459732`:

| Actual job | Result and inspected log evidence |
| --- | --- |
| [Complete Regression — 119637197680](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800/job/119637197680) | SUCCESS; **114/114 suites, 2,481/2,481 reported checks**, zero failures/skips. Both nine-stage product journeys, perimeter52, verification94, portable history25, controlled version/audit50, coherence11, source-map36, Vite21, continuity68 and envelope88 passed. Source/index cleanliness checks passed. |
| [Quality & Build — 119637197789](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800/job/119637197789) | SUCCESS; fresh npm install/audit reports zero vulnerabilities, WBS zero drift, TypeScript/build, native provenance and fresh frozen Linux Bun checks passed. Native foundations35, process recovery24, session capacity18 and store paths7 passed. |
| [Controlled Docs — 119637197818](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800/job/119637197818) | SUCCESS; 11/11 focused suites with336 measured assertions, 40/40 core probes and29/29 supplemental probes. Snapshot/source cleanliness checks passed. |
| [Windows Native Qualification — 119637197780](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39721949800/job/119637197780) | SUCCESS; fresh npm install/audit zero, frozen Bun install in a separate exact checkout, lifecycle inventory20, native foundations35, process recovery24, session capacity18 and ownership/path7 passed for both installed profiles. Actual default TEMP/8dot3 alias qualification passed. |

The workflow completed successfully at the actual merge commit; master was independently reconfirmed unchanged afterward. These are actual push/master checks, not substituted candidate checks. Native observations remain synthetic compatibility evidence: better-sqlite3 13.0.3/SQLite3.53.4 and Argon2 0.45.1 on Node22.23.3. Bun disclosed blocked non-native `@google/genai` preinstall and `protobufjs` postinstall hooks; `nativeLifecycleBlocked` and `lifecycleTrustChanged` were both false. This is not full upstream lifecycle compatibility acceptance.

Counts use the current runner's reporting contract. Focused suites can contain more semantic assertions than runner-counted output lines; do not reinterpret 2,481 as a count of every possible assertion. Earlier 107/114 full-run failures and their corrections remain in [the integration record](LOCAL_MVP_INTEGRATION_20261022.md). Later green runs do not rewrite those failures.

## Eight requested workstreams

| Workstream | Delivered behavior and acceptance |
| --- | --- |
| 1. Dashboard | Catalog-normalized wizard-aware discovery gates shared by dashboard and recommendations; visible formula and denominator; removed stored 70/40 measurement claims. Scoped observer rejects stale, malformed and deadline-expired responses. |
| 2. Reviewer setup | Aggregate diagnostics and bounded session recovery without exposing roster values, creating defaults or enrolling people. Actual authorization remains server-resolved. |
| 3. Evidence workflow | Task/criteria/commit/build/environment binding, bounded immutable submitted bytes/digests, expected-reviewer binding, distinct-person SO/LA local attestations, CAS/replay/rollback and summary/detail separation. No task/WBS/release apply. |
| 4. Project documents | Ordinary-project create/edit/diff/validate/save, server-generated IDs and virtual paths, content/version CAS, durable request IDs, separate creation/update audit contracts and atomic persistence. Original self-project registry remains compatible. |
| 5. Scoped progress | Explicit current-release task selection; lifecycle counts and local review counts remain distinct from authenticated production evidence, security assurance and release permission. Status-only Gate 3/signoff returns 412. |
| 6. Complete journey | Real App/API/persistence nine-stage test passed: discovery/linked work, managed content/audit, scope, submission/self-review denial, separate synthetic SO/LA review, production denial without mutation, package import/export and restart/session expiry. No fake successful writes, browser errors or outside-origin requests. |
| 7. Reproducibility | Cross-platform normal-checkout commands, explicit production mode, persistence/recovery paths and package boundaries documented. Fresh configured Windows/Linux npm/frozen Bun native qualification is separate from retained local packages and the untouched original workstation. |
| 8. Records and handoff | This signed additive closure, current-state/plan/handoff updates and public PR/CI evidence preserve historical failures and exact identities. No canonical completion receipts are manufactured. |

## Compatibility, residual risks and next executable actions

Ordinary legacy project access remains local and unscoped. The 78 API registrations comprise 45 legacy local/unscoped, 16 specialized reviewer, three reviewer-session and 14 blocked privileged routes. All nine new routes require the existing configured reviewer authority. This is a local MVP, not authorization for shared or remote deployment.

Local `personId` bindings are assertions, not verified independent people. A submitter and two other locally asserted SO/LA reviewers exercise the local workflow; their attestations remain `trustedProductionEvidence: false`. Imported verification is `UNTRUSTED_IMPORTED_HISTORY` and cannot become active review authority. A public package hash is content integrity, not human authority.

Verification admission remains 100 active-plus-archived sessions/project, 500 total, 1 MiB/session, 8 MiB/project, 32 MiB total compact JSON and 100 archive batches, reserving one batch when active sessions exist. These are engineering admission constraints, not production memory/capacity acceptance. Documents retain 128 KiB content, 2 MiB/project, 100 documents and 1,024 request IDs/document. HTTP input remains 10 MiB; maximum combined content is not a qualified import profile. Over-limit history requires deliberate recovery rather than truncation.

Fresh hosted Windows tests use the runner's existing compatible SDK and actual default TEMP, including native 8dot3-alias qualification. The older unaliased-TEMP workaround is historical. The original operator Node/SDK/dependency junction remains untouched and its clean installation is unqualified. A successful retained-package local run cannot resolve that limitation. Bun qualification retains lifecycle scripts and the fail-closed native inventory guard; non-native upstream blocked-script disclosures remain distinct.

The production UI build still reports a chunk-size advisory (approximately 1.145 MB uncompressed main bundle); build succeeds, but no broad-device performance or operational capacity acceptance is claimed. Security is not inferred from a stored status or passing synthetic test.

Next safe actions are to use the [normal-checkout runbook](../08_handoff/LOCAL_MVP_REPRODUCIBILITY_20261022.md), perform the named operator browser acceptance with non-sensitive ordinary-project content, and separately qualify a fresh original-workstation install if desired. Any actual roster appointment/enrollment, production identity/access architecture, authenticated evidence acquisition, trust roots/custody, crash-safe canonical registration and resource acceptance need separately attributable decisions. Preserve the prior task ledger; these eight engineering deliverables do not complete every canonical WBS entry.

Canonical WBS stays 69 items: 23 VERIFIED, 14 IMPLEMENTED, three VERIFICATION_PENDING, one IN_PROGRESS, one READY, six BACKLOG and 21 PROPOSED. Historical receipts, original S2-A portfolio and PRs #34/#52 remain unchanged. No real credential/signer/grant/root enrollment, production authentication/trust, receipt consumption, privileged-route activation, live agents, Gate 7 or release promotion occurred.

Rollback uses an ordinary reviewed revert. Preserve a stopped snapshot, managed content, evidence/archive history, audit and private recovery material before selecting older code that lacks these collections; never delete locks/history or let an older writer overwrite the only copy. This closure publication is documentation on a separate branch, not another runtime integration or automatic canonical apply.

The primary operator checkout was fast-forwarded normally to actual verified master after all four post-merge jobs passed. Its persisted project-state hash, original untracked PR #53 note and original dependency junction were verified unchanged. No original-host installation, credential setup, service startup or SDK repair was performed. The final nine-path documentation checkpoint additionally passed whitespace/diff checks, 66 relative-link existence checks, WBS integrity and all35 controlled-document validator checks; the pre-existing state/handoff historical tails were verified byte-equivalent after line-ending normalization. These documentation checks are separate from the runtime CI above.
