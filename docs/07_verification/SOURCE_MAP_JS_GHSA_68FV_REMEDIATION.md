# source-map-js GHSA-68fv-2mgg-jv7q remediation candidate

## Scope and disposition

**FIXED_IN_CANDIDATE / INDEPENDENT_HUMAN_REVIEW_REQUIRED.** Base: `cfca39902d6fd4bc0d4c5bdaf351b0522c780466`. This candidate resolves the installed vulnerable dependency in both maintained lockfiles. It does not assert that master is patched before human merge, that all possible source-map resource exhaustion is eliminated, or that application-level attacker exploitability was established.

[GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) identifies source-map-js >=1.0.0 <1.2.2 and first patched 1.2.2. The [upstream patch cf7658058ceeaa8619d5ae0ec90be6905209d016](https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016) is incorporated by [release 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2). Evidence is preserved in [source-map-js-remediation-20261019/](source-map-js-remediation-20261019/), indexed by the [evidence manifest](source-map-js-remediation-20261019/evidence-manifest.json).

## Dependency paths and affected behavior

The baseline records one deduplicated source-map-js 1.2.1 installation:

- vite 6.4.3 → postcss 8.5.28 → source-map-js 1.2.1.
- @tailwindcss/vite 4.3.3 → @tailwindcss/node 4.3.3 → that same source-map-js.
- autoprefixer 10.6.1 consumes PostCSS through its peer dependency.

Both requiring packages permit `^1.2.1`, so 1.2.2 requires no parent upgrade, direct dependency, override or package.json change. The separate Bun lock also pinned 1.2.1 and is corrected; leaving it unchanged would preserve an alternate vulnerable install. Other @jridgewell packages are distinct implementations, not extra copies to upgrade here.

The vulnerable IndexedSourceMapConsumer accepts malformed/excessive section offset coordinates and recursively indexed maps. Those quantities flow into generated positions; SourceNode can advance line-by-line after generated input is exhausted, and generator serialization constructs gap separators. Source maps can arrive as parsed objects or JSON strings, including nested sections.

The upstream repair validates nonnegative safe-integer line/column coordinates, limits direct and cumulative nested line offsets to 10,000,000, caches nested sources getters, avoids exhausted-input SourceNode work and flattens generator gap construction. Large legal columns are not incorrectly given that line limit. Invalid/excessive maps now reject: this is the intended security compatibility change.

## Repository reachability and limits

There are no direct source-map-js API calls found in src/, server/, scripts/ or server.ts before the new regression test. Tooling reachability is established: vite.config.ts enables Tailwind, src/main.tsx imports src/index.css, and that CSS imports Tailwind. The installed PostCSS and Tailwind callers resolve the same package.

PostCSS PreviousMap recognizes indexed maps and accepts explicit `map.prev` object/JSON maps, inline base64/URI JSON sourceMappingURL comments and permitted local .map annotations. Input constructs a consumer; downstream mapping work may construct a generator. PostCSS's same-directory/extension checks protect implicit file access, not offset quantities. The inspected Tailwind caller uses SourceMapGenerator for generated mappings.

Vite dev source-map output defaults off, but the inspected PostCSS call omits map options in that case instead of setting `prev:false`; this does not prove prior-map parsing disabled. server.ts enables Vite middleware when NODE_ENV is not production and otherwise serves static assets. npm start does not itself set NODE_ENV. Build/dev mode and CSS/plugin/repository inputs therefore matter.

An attacker-controlled application request path to this sink was **not established**. The tests demonstrate library and PostCSS input-boundary behavior, not a network exploit. Existing loopback/Host/Origin controls do not validate source-map files, and are not removed. This is not an exhaustive supply-chain or deployed-runtime exploitability assessment.

## Exact correction and provenance

- package-lock.json: only `packages["node_modules/source-map-js"]` version, resolved tarball and integrity change from 1.2.1 to 1.2.2.
- bun.lock: only the matching source-map-js version/integrity tuple changes.
- [scripts/testSourceMapDependency.ts](../../scripts/testSourceMapDependency.ts): 36 bounded real-library/PostCSS checks, automatically included by the existing complete-suite discovery.
- This report, manifest and captured verification evidence are additive. No application runtime source, workflow, package.json, historical receipt or canonical WBS change.

[Registry tarball](https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz).

Integrity: `sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==`.

Registry SHA-1: `79fb88d97535a21cb27162cb05d211b67acea4ab`. The main entry, Node >=0.10.0 engine and absence of package dependencies remain compatible. npm ci verifies the lock/tarball integrity; no broad remediation command was used. Manual bounded lock updates were checked against registry metadata and every other npm entry plus the exact old/new Bun tuple.

## Verification

All runtime checks used a new disposable checkout and synthetic CI state on Windows x64 Node 22.21.1; the frozen Bun install used a separate empty disposable directory with Bun 1.4.2. No app, preparation, payload or migration targeted operator state.

| Check | Actual result |
| --- | --- |
| Baseline npm ci | PASS; installed source-map-js 1.2.1 |
| Before npm audit --json | Exit 1; one high advisory, GHSA-68fv-2mgg-jv7q |
| Baseline focused checks | 9 passed / 27 rejection checks failed as expected: old constructors accepted malformed/over-limit inputs |
| Updated npm ci and npm ls --all | PASS; single deduplicated source-map-js 1.2.2 used by both parent paths |
| Bun install --frozen-lockfile --ignore-scripts | PASS; installed 1.2.2; unchanged frozen lock bytes |
| After npm audit --json | Exit 0; zero reported vulnerabilities at capture time |
| Updated focused suite | 36/36 passed |
| TypeScript / production build / WBS check | PASS |
| First complete run | 66/67 suites; 1,671 passed / 1 failed output, no skipped; UI harness timeout documented below |
| Serial complete rerun | PASS: 67/67 suites, 1,672/1,672 reported outputs, 0 failed/skipped; unchanged UI suite 50/50 |
| Separate controlled-document matrix | PASS: 40/40 core + 29/29 additional security + 11/11 focused; synthetic fixture snapshot unchanged |

The bounded negative tests exercise object/JSON coordinates, invalid/unsafe/nonfinite values, excessive direct and cumulative nested line offsets, and inline PostCSS malformed maps. Excessive fixtures invoke constructors only; they are never serialized, iterated or passed to SourceNode on the old version. No large-gap denial-of-service workload or live-service payload was executed.

Positive controls preserve basic queries, valid indexed/nested maps, maximum permitted constructor line offsets, large legal columns, short generator gaps, normal SourceNode reconstruction and actual PostCSS transformation. A fresh read-only investigator and separate candidate reviewer found no concrete surviving alternate-install bypass or introduced regression. This is agent technical review, not human approval.

The first complete run had one 8-second Playwright wait timeout for the project selector while creating the Scenario 4 harness in testControlledDocVersionSync.ts, before its failed-save assertion ran. The other 49 scenarios passed. Another disposable package installation ran concurrently during that initial full test; it is a confounding factor, not a proven cause. Original logs/results are retained. The serial rerun passed all 50 UI scenarios and all 67 suites. It used unchanged application and test code and the original timeout, with no parallel installation or weakened assertion.

## Residual risk and human gate

Audit zero means no advisory reported by that audit at that time, not complete dependency security. Valid maps can still consume resources; this patch is not a general CPU/memory/input-size budget. Real attacker reachability and deployment mode need separate assessment. Legacy general authorization remains incomplete.

The initial local browser-harness timeout remains a disclosed verification observation; no unrelated application/test fix was folded into this correction. Exact signed candidate HEAD, GitHub signature, all three CI jobs and attributable review request belong to the PR publication timeline.

Master Protection, PR #34, canonical WBS, historical evidence, existing distinct HUMAN quorum, 14 privileged denials, disabled live agents, Gate 7 and release remain unchanged. No S2-A implementation, credential migration, certificates, grants or authentication activation is included. Stop for independent human review; no automatic merge.
