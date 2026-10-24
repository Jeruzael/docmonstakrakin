# body-parser security remediation candidate — 2026-10-24

Status at source capture: **REVIEW CANDIDATE; exact-HEAD hosted qualification PENDING**. This record is additive. It grants no merge, registration, enrollment, activation, retention-policy or release authority. Later CI results must identify the exact signed candidate in the PR conversation; a local fixture or an earlier green revision cannot supply that qualification.

## Baseline and preserved failure

Refreshed master: `796adced2b0e9795b801c808359dee9c8839d7c4`, PR #82 documentation merge. PR #80/#81/#82 are credited and unchanged. [Actual master CI 40036517930](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40036517930) failed its [Windows audit job 120697225535](https://github.com/Jeruzael/docmonstakrakin/actions/runs/40036517930/job/120697225535); the other three jobs passed. Fresh Windows npm installation succeeded, audit reported one high finding, then native runtime/Bun checks were not reached. That run used Node22.23.4 and Python3.15.1. Its audit registry configuration was not explicitly logged; committed tarball URLs use registry.npmjs.org.

[Original preserved integration/failure archive](body-parser-security-20261024/ci-40036517930-windows.zip): 24229 bytes, SHA-256 `641caf596a26e76f270cc0e319e4531f3cb6e8044ef9441a447f3c24c2196894`. Its Windows member is connector-decoded UTF-8 with original CRLF and leading U+FEFF retained, 44440 bytes/SHA-256 `34c75940cf2fdfde33b407ef302b5ed2b0445d278d4832e7b6071cfb19917c2c`; it is not the original HTTP ZIP representation. This archive is copied byte-for-byte, not rewritten.

The dependency finding is separate from the missing operator SDK, historical WS04 permission-admission failure and 4096-entry audit capacity. None is fixed or reclassified here. PR #85 remains unchanged and unmerged at `58ac7c4ae82490fc61ae72ea43f0024379aadf46`.

## Advisory, paths and exposure

The [maintainer advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828) identifies compressed-body trailing-byte denial of service in body-parser <1.20.9 and 2.x <2.4.0. The [1.20.9 release](https://github.com/expressjs/body-parser/releases/tag/1.20.9) is the patched 1.x target.

Both project lock graphs have exactly one runtime copy: application → Express4.22.3 → body-parser1.20.8, through Express's existing `~1.20.5` range. The candidate resolves that same path to 1.20.9. `@types/body-parser` is a declaration package, not a second vulnerable implementation. There is no direct application body-parser dependency.

Source trace: [main middleware](../../server.ts) installs local perimeter → API route policy → ENFORCED-only body admission → global `express.json({limit:'10mb'})` → workspace/session/reviewer authority. [Body admission](../../server/security/workspaceAccess/bodyAdmission.ts) rejects non-identity API encodings, but deliberately passes non-/api paths. [Route policy](../../server/security/apiRoutePolicy.ts) also passes non-API paths. Therefore unauthenticated local JSON requests to an unmatched non-API path reach the global parser even in default ENFORCED mode. LOCAL_DEVELOPMENT also uses its default inflation. Host/Origin/forwarded-header containment remains material; this is not a claim of a supported remote listener.

The separate disabled auth pilot uses `express.raw({inflate:false,limit:8192})`; it is not activated. The synthetic document demo and numerous test apps also consume Express's shared parser. No application URL-encoded or text parser was found. The correction covers the shared dependency; it does not add form routes or broaden permissions.

The [upstream reader](https://raw.githubusercontent.com/expressjs/body-parser/1.20.9/lib/read.js) detaches/destroys the completed decoder, handles late errors and drains remaining request bytes. Before-behavior was demonstrated in a disposable Express child; actual-server exposure is source-backed at this capture, with baseline/candidate actual-server checks scheduled in hosted CI. Do not describe that pending execution as a demonstrated application exploit.

## Minimal correction and exact inventory

Package-manager commands:
- `npm update body-parser --package-lock-only --registry=https://registry.npmjs.org`.
- `bun update body-parser --lockfile-only --registry=https://registry.npmjs.org --cache-dir <isolated-cache>`.

Only the body-parser record moves. Version/tarball/integrity change in npm; version/integrity change in Bun. Express4.22.3, raw-body2.5.3, every other dependency record and package.json remain unchanged. Registry-supplied integrity is `sha512-FISIQxV5u91Y9gvuFq3q/tA/qTqLJn3AhRcEvyozyhJTh5OBFFtv827AdHU7Rbyct4r+Ba1/99oFa1Y3yuFsdw==`. Package managers generated both locks; no digest was invented, broad audit-fix command used, direct dependency added or major version migrated.

| Changed path | Necessity |
| --- | --- |
| package-lock.json | Resolve the existing runtime parser to patched1.20.9 |
| bun.lock | Same targeted resolution and authentic integrity |
| scripts/testBodyParserSecurity.ts | Loopback child isolation, normal identity/gzip/deflate controls, malformed/decode error handling, gzip trailing-byte crash regression, split deflate drain/survival, installed provenance |
| scripts/testWorkspaceEnforcedServer.ts | Actual default-server non-API parser/400 control and trailing-byte availability; retain existing setup, denial and credential-log checks |
| .github/workflows/ci.yml | Strict candidate npm/Bun audits, installed dependency trees, focused tests on Windows npm/Bun and Linux frozen Bun, branch-scoped before-evidence in disposable clones |
| docs/07_verification/BODY_PARSER_SECURITY_REMEDIATION_20261024.md | This source/evidence/qualification record |
| docs/07_verification/body-parser-security-20261024/local-evidence.zip | Actual local audit, reproduction, installation/provenance and lock-delta evidence |
| docs/07_verification/body-parser-security-20261024/ci-40036517930-windows.zip | Immutable preceding master failure evidence |

The extra baseline CI step runs only on this remediation PR branch, not future master pushes or unrelated PRs. It installs the exact old master in disposable clones, copies only test probes into those clones, records expected vulnerable behavior and audit failures, and verifies they correspond to this advisory. This diagnostic negative control never waives candidate audits or native gates. No workflow permission, existing timeout, required job, Windows owner control, SDK setup, audit threshold or lifecycle trust policy is relaxed.

## Raw lockfile hashes

All values are SHA-256 over exact Git blob/index bytes; measured working bytes agree. Full values and tool metadata are also in evidence.json inside the local archive.

| File | Baseline | Candidate |
| --- | --- | --- |
| package.json | `06ec2f4fa030077e8541ba799b046e70c4c73e430646d3ece306c6121344a0d3` | unchanged |
| package-lock.json | `14fc25efb722971a956cec1c4ad2808fc09e8ac6ea745152b47fb105e0a21f65` | `9f3922109682ea890fd3c241e6836995e7d223231b87e6b48452c665cd862d86` |
| bun.lock | `7dfb09315ae8a4d48cfe37198202a7ea9246efe464478438713066a649b561ba` | `0d771a99053df6650168b641ec9889eb8007c86eab2c6dd206e0e200956149b8` |

## Measured local evidence and limitations

[Local evidence](body-parser-security-20261024/local-evidence.zip): 11286 bytes, SHA-256 `035414bbf3970c08d6a91175dd7d3644c171aff4bd055cc37848856176d4993e`.

Local toolchain: Windows10.0.26300/x64, qualified portable Node22.23.3 (executable SHA-256 `9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e`), npm11.7.0, Bun1.4.2. Registry was explicitly https://registry.npmjs.org; task-local npm configuration/caches were used without credentials. Git data, real operator identity/credentials and original dependency junction were not used as test state.

| Measurement | Actual outcome |
| --- | --- |
| Project npm lock audit, 2026-10-23T23:53:55.1301743Z | Exit1, one high GHSA-27r3-jxmh-p828 |
| Project Bun lock audit before correction | Exit1, same finding; raw JSON retained |
| Updated project npm lock audit, 2026-10-23T23:55:56.1595909Z | Exit0, zero findings |
| Updated project Bun lock audit | Exit0, empty finding object |
| Fresh lifecycle-enabled npm parser fixture, Express4.22.3/parser1.20.8 | 6 pass/1 fail; gzip tail caused uncaught Z_DATA_ERROR and child unavailability |
| Fresh npm parser fixture, parser1.20.9 | 7 pass/0 fail; legitimate bodies and error/survival controls pass |
| Separate fresh frozen-Bun parser fixture, parser1.20.9 | 7 pass/0 fail; resolved installed tree retained |
| Mechanical lock-delta validation | PASS: every other dependency record and package.json identical |
| Changed-test syntax, workflow YAML/four-job inventory, Bash syntax | PASS; syntax-only, not full application typecheck |
| Full local application installation/native acceptance | NOT_RUN; existing missing-SDK blocker is not repaired |
| Portable WSL Linux setup | Acquisition FAIL: curl28 after180s, 2875320/31001304 bytes; no Node installation or Linux qualification |
| Full hosted installation, typecheck/build, WBS, regression, controlled docs, native checks | PENDING at capture; exact signed candidate and all four results required in PR |

The Express-only fixtures use explicit fixture-only overrides to select old/new parser versions. They are not the full project dependency graph or operator-installation qualification. The original failing child was run once to establish red behavior and once to capture its unchanged failure durably; the failed GitHub workflow was never retried. A first fixture-install console summary reported two high findings; subsequent explicit fixture/project JSON identified one named GHSA. That unclassified summary difference is preserved in evidence metadata, not used as closure evidence.

The initial local syntax helper failed because a Windows absolute import was not a file URL; the corrected helper passed syntax checks. No application assertion was weakened to resolve that tooling failure. Bun's pre-existing duplicate Vite declaration warning is retained; package.json is untouched. Existing Bun lifecycle qualifications remain conditional on their recorded blocked nonnative scripts.

A fresh read-only security/compatibility review found no concrete surviving issue. It is agent analysis, not independent human approval. It prompted the explicit parser-specific actual-server control and hosted baseline-behavior evidence. Full candidate execution remains necessary.

## Acceptance, risks, rollback and human gate

Required publication evidence: valid signed HEAD, all four jobs on that exact candidate; full npm and frozen-Bun installed provenance; strict fresh audits; focused behavior; complete regression; existing security/CSRF/perimeter/session/receive-budget and controlled-document checks; WBS/bootstrap/history preservation. Actual counts and failed attempts must be recorded without substituting an earlier candidate.

Do not merge this PR under documentation authorization. Independent human security review and explicit integration authorization are required. After any separately authorized merge, all four actual exact-master post-merge jobs must pass before PR #85 combined-candidate qualification resumes. A new Windows WS04 failure must remain a separate investigation, not be reclassified as fixed by audit success.

No data migration or runtime/parser configuration change is included. Before merge, abandoning the candidate leaves master unchanged. Reverting the lock correction after merge would restore a known vulnerable parser and must not be called safe recovery; any rollback requires its own reviewed normal commit and failed qualification must remain visible.

Canonical WBS/receipts, five bootstrap-pinned documents, operator state, real humans, trust roots, audit retention/capacity, privileged routes, live agents, Gate7 and release remain unchanged/restricted. This candidate does not authorize SDK installation, hosted WS04 diagnostic activation, enrollment or production operations.
