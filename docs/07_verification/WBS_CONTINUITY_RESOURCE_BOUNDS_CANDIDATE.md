# WBS continuity resource bounds and canonical-prefix candidate

Candidate only; implementation/draft publication authorized by the operator on 2026-10-20. New numeric admission limits require explicit independent human compatibility acceptance. No operational budget or registration authority is ratified by this document.

## Baseline, scope and preservation

GitHub master was independently checked before edits: `2af6637aa639c18e31795355d68b1454be22f389`, tree `9e7831344b185bbdf2d25d71711dfb78a28e40dd`. A new `codex/wbs-proof-resource-bounds` branch starts there. PR #34 remains open/unapplied at `5912185a005df3e0469dd46392d7d0dbb0378b68`; PR #52 remains an unchanged archival draft at `89b1527f75dfdd69a3e49bda752b64d4edd70a54`.

Exactly eight candidate paths are necessary:

| Path | Reason |
| --- | --- |
| `scripts/wbsEvidenceContinuity.ts` | Early fixed resource admission; reuse canonical prefixes and consumed-ID storage |
| `scripts/planWbsRegistrationTransaction.ts` | Strictly parsed, byte-identical canonical prefix digest helper; existing parser/serializer unchanged |
| `scripts/testWbsEvidenceContinuity.ts` | Admission boundaries, adversarial evidence, historical/current separation and unchanged trust denials |
| `scripts/testPlanWbsRegistrationTransaction.ts` | Every-prefix SHA-256 equivalence, seeded varied examples and unchanged parser contracts |
| `scripts/benchmarkWbsEvidenceContinuity.ts` | Explicit synthetic isolated-worker benchmark; never auto-discovered as a test |
| `docs/07_verification/WBS_CONTINUITY_RESOURCE_BOUNDS_CANDIDATE.md` | Measured evidence, compatibility and risk assessment; retained prior checkpoint |
| `docs/00_control/PROJECT_STATE.md` | Additive current status |
| `docs/00_control/LAST_HANDOFF.md` | Additive review handoff |

No runtime/server, dependencies/locks, workflow, signed schema/v2 verifier, canonical WBS, historical receipt/snapshot, trust root, application/consumption engine or S2-A path is changed. The previous local closure-proposal file stays untouched and uncommitted; its exact text is retained below so publication does not require a ninth path. Raw evidence and execution ledger are retained externally under managed `artifacts/r11`.

## Verification and complexity

The new helper calls the unchanged strict parser, then derives genesis and every prefix SHA-256 using copied streaming hash state and the original serializer for each single entry's exact framing. It does not change key order, indentation, escaping, domain separators, receipt digests or accepted canonical ledger bytes. Tests compare every output with SHA-256 of the original full serializer over that prefix. Prefix validation never treats an invalid ledger as normalized evidence.

Previously, the audit serialized/hashes prefixes `i` and `i+1` at each link: **n² entry encodings** across the two prefix computations, with proportional quadratic encoded/hash input for fixed-size entries. Candidate prefix work is **O(B+n)** for ledger bytes B and n entries, with O(n) digests retained. Strict parsing still performs its original full canonical comparison. Work counters include that comparison's encoded bytes; `encodedEntries` counts subsequent prefix entry encoding only. The target is encoded + hashed input ≤4B+4 KiB.

Previously consumed IDs were rebuilt with `slice(0,i).map(...)`, allocating n(n−1)/2 ID references. A local append-only array now supplies the identical PRE-consumption list to the unchanged synchronous v2 call; the ID is pushed only after that call succeeds. New issuance/replay checks are unchanged. V2 `.includes` still scans the prefix, and growing WBS parsing/semantic comparison remains superlinear. **The complete audit is not claimed to be linear or faster in every sample.**

Every returned verification result remains `mayApply:false`. Signed-but-unapplied intent, invalid/revoked authority, stale epochs/checkpoints and wrong applied Git identities still reject. Later protected master descendants remain conservatively rejected; no ancestry support is added. Pinned historical snapshot verification remains 27 items; original legacy adapters retain their historical assertions, without a claim of complete independent historical receipt attestation.

## Resource admission and compatibility decisions

| Bound | Candidate behavior | Compatibility / rationale |
| --- | --- | --- |
| Ledger bytes / entries | Existing **2 MiB / 5,000** strict parser limits unchanged | Canonical ledger parse/preview contracts preserved; consumer below is stricter |
| Each retained raw receipt | Existing **2 MiB** unchanged | Rejected before UTF-8 decoding / JSON parsing |
| Authority freshness | Existing **at most 60 seconds** unchanged | No widening of authority or revocation acceptance |
| Forward links / application records | New **256** each | Candidate capacity admission, not permission to apply or truncate a chain; previously accepted larger valid proofs may now reject |
| Every historical/current/link WBS snapshot | New **2 MiB** | Bounds raw WBS admitted to semantic parsing; historical pin remains unchanged |
| Aggregate logical proof bytes | New **64 MiB** | Historical/current/link buffers, ledger, retained raw receipt, semantic receipt, policy and authority JSON; repeated references count at each logical occurrence |
| Raw and materialized JSON nesting | New **64 container levels** | Early raw framing scan and bounded object walk; existing schema/duplicate-key/UTF-8 checks still decide validity |

Additional numbers are **review candidates**, not ratified operational budgets. Logical bytes include exact compact UTF-8 JSON representation of receipt/policy/context; outer transport envelopes and object allocator overhead are not counted as input bytes. Escaping, surrogate pairs/lone surrogates, punctuation and repeated aliases are tested against actual `JSON.stringify` byte length. Cycles, non-JSON values, hidden/accessor/symbol properties and non-plain objects reject without invoking their serialization hooks. This narrows acceptance of executable/non-JSON acquisition objects; acquisition providers must supply inert materialized JSON data. The typed envelope and required collection accesses assume inert acquisition data. This is not a JavaScript sandbox: hostile getters on envelope fields, arbitrary proxies or a malicious trusted callback can execute before/inside admission. No production provider exists here.

On early admission failure, optional current/ledger digests and current scope fields may be absent; error reporting never hashes an oversized current snapshot merely to populate metadata, including acquisition-failure paths. This observable metadata omission is an explicit compatibility point for human review.

Historical bytes are bounded and independently verified before current/forward admission; an oversized current proof preserves valid historical closure while failing the current-state gate. Admission does not authorize evidence: malformed, incomplete, reordered or replayed chains still reject after size admission. No silent truncation, ledger reset, alternate genesis, caller-selectable budget/mode, signature/quorum relaxation or fallback to historical-only success exists.

The boundary operates on already acquired buffers/objects. It cannot bound upstream filesystem/network buffering, callback allocations, V8/native overhead, all YAML parser worst cases or aggregate concurrent audits. The 60 s watchdog and Linux cgroup are **benchmark harness controls**, not a production worker timeout or service resource policy. There is no production trust/acquisition adapter or writer.

## Reproduction and measurement method

Use disposable clones from the exact baseline and candidate, with matching locked dependencies. Copy this benchmark file unchanged to the baseline clone; do not copy candidate verifier code there. Synthetic Ed25519 seeds are deliberately public fixture constants, never enrolled identities. Each link appends one PROPOSED EPIC-13 item to an in-memory copy, supplies real synthetic signatures, canonical consumed ledger entries and synthetic authenticated application records. No application is performed and no product routes, credentials, network or canonical writes are used by the benchmark.

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmarkWbsEvidenceContinuity.ts --suite LABEL
node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmarkWbsEvidenceContinuity.ts --prefix 256
```

On Windows the import loader must be a `file:///C:/.../tsx/dist/loader.mjs` URL. Fixed grid: 1,8,32,128,256 links; five sequential fresh-process samples per size and implementation/platform. Setup/fixture serialization time is recorded separately and excluded from audit wall/CPU time. Peak RSS is process-lifetime `resourceUsage.maxRSS`, including Node/loader/fixture setup; no baseline memory subtraction. Heap is the maximum GC trace `total_size_before/after` plus pre/post `heapUsed`: a **GC-observed high-water**, not a guaranteed instantaneous peak. Synchronous execution prevents timer sampling during the audit. GC tracing is enabled for both sides and can affect latency.

Report p50 as the middle of five samples and p95 by nearest rank (the maximum), plus min/max/variation; five samples do not establish a stable tail-latency distribution. CPU is process user/system time during the audit, including threads, so it can exceed wall time. Parent/worker watchdog is 60 s for each fresh process, including setup. Failed/timed-out samples must remain failures, not successful latency observations.

Proposed reference acceptance: max admitted-grid p95 ≤30 s; process peak RSS ≤512 MiB. Linux reference quota is 2 CPU /1 GiB with swap disabled. These are synthetic review targets, never production capacity claims. Full proof latency includes unchanged YAML/crypto semantics; isolated prefix timing is recorded separately from the old-serializer equivalence pass.

### Actual Windows/Linux synthetic results

Both use Node **22.21.1**, x64, AMD Ryzen 5 5600G (12 logical CPUs) on the same shared desktop. Windows release 10.0.26300 has 32 GiB host RAM, no worker cgroup. Linux is Ubuntu 24.04.3 / WSL2 kernel 6.18.54.1, with 16 GiB visible host RAM and verified `cpu.max=200000 100000`, `memory.max=1073741824`, `memory.swap.max=0`. Actual parent/worker `/proc/.../cgroup` membership was verified. Linux service cgroup peak (including supervisor/children) was 437,886,976 bytes baseline and 433,782,784 bytes candidate; no OOM/limit event. End-of-service systemd summary can report a reset low value; use the retained in-service kernel `memory.peak`/events. Passive Linux load snapshot during candidate run was 1.63/1.63/1.17; no per-sample background load, exclusive cores, CPU-frequency or thermal control is claimed.

The temporary Linux Node archive SHA-256 `680d3f30b24a7ff24b98db5e96f294c0070f8f9078df658da1bce1b9c9873c88` matched official Node 22.21.1 SHASUMS256. These are separate OS measurements on shared hardware, not independent deployment hosts.

All **100 full-audit samples** passed with `mayApply:false`, no timeout, and exact cross-platform/baseline/candidate input hashes. Audit worker logic and fixture profiles are identical across grids. A later diagnostic-only driver change separated prefix timing from its reference-equivalence pass; the separate final prefix grids below use that final driver. Older `diagnosticMs` rows in full-grid raw logs are not used as prefix timings.

| Links | Logical bytes | Serialized bytes | Ledger bytes | Largest WBS bytes | Fixed input SHA-256 |
| --- | --- | --- | --- | --- | --- |
| 1 | 311381 | 331297 | 876 | 76424 | `484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d` |
| 8 | 1422540 | 1513478 | 5776 | 77033 | `a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5` |
| 32 | 5297044 | 5641158 | 22598 | 79121 | `5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938` |
| 128 | 21800094 | 23306672 | 89922 | 87523 | `4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf` |
| 256 | 46325022 | 49754288 | 179778 | 98787 | `57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42` |

Audit wall times exclude setup. RSS/heap high-water include setup. CPU is user + system during audit.

| Platform/version | Links | Wall p50 / p95 ms | Wall min–max ms | CV % | CPU p50 ms | Max worker RSS MiB | GC-observed heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| windows baseline | 1 | 263.38 / 263.81 | 254.19–263.81 | 1.39 | 531.00 | 110.95 | 29.93 |
| windows baseline | 8 | 868.04 / 907.41 | 854.24–907.41 | 2.15 | 1579.00 | 147.32 | 69.32 |
| windows baseline | 32 | 2736.93 / 2854.67 | 2671.89–2854.67 | 2.65 | 3845.00 | 170.10 | 88.44 |
| windows baseline | 128 | 12379.21 / 12481.04 | 12204.01–12481.04 | 0.92 | 15422.00 | 502.58 | 403.68 |
| windows baseline | 256 | 25171.48 / 26937.35 | 23486.20–26937.35 | 5.23 | 31672.00 | 382.49 | 189.72 |
| windows candidate | 1 | 249.53 / 265.80 | 221.72–265.80 | 5.87 | 594.00 | 112.71 | 29.90 |
| windows candidate | 8 | 843.28 / 944.73 | 816.57–944.73 | 5.51 | 1484.00 | 143.09 | 64.29 |
| windows candidate | 32 | 2784.58 / 2877.76 | 2732.00–2877.76 | 1.98 | 3796.00 | 167.36 | 86.51 |
| windows candidate | 128 | 11981.79 / 12244.77 | 11933.36–12244.77 | 0.92 | 15188.00 | 500.53 | 403.42 |
| windows candidate | 256 | 24888.73 / 25909.97 | 23714.38–25909.97 | 2.99 | 32015.00 | 382.51 | 189.76 |
| linux baseline | 1 | 225.63 / 236.07 | 211.53–236.07 | 4.02 | 441.86 | 106.72 | 21.77 |
| linux baseline | 8 | 715.69 / 780.89 | 660.17–780.89 | 6.24 | 1205.16 | 116.98 | 27.07 |
| linux baseline | 32 | 2312.48 / 2400.90 | 2248.93–2400.90 | 2.16 | 3434.84 | 122.73 | 29.69 |
| linux baseline | 128 | 10193.21 / 11138.36 | 9126.62–11138.36 | 6.32 | 14799.48 | 237.53 | 92.94 |
| linux baseline | 256 | 21860.34 / 23433.21 | 20343.19–23433.21 | 4.61 | 31766.32 | 402.20 | 188.42 |
| linux candidate | 1 | 214.49 / 223.07 | 206.70–223.07 | 2.59 | 432.75 | 105.49 | 21.74 |
| linux candidate | 8 | 740.68 / 796.65 | 685.88–796.65 | 5.32 | 1240.10 | 116.92 | 27.31 |
| linux candidate | 32 | 2314.16 / 2350.88 | 2213.26–2350.88 | 2.10 | 3460.92 | 123.28 | 30.06 |
| linux candidate | 128 | 9394.38 / 9540.27 | 9042.67–9540.27 | 1.94 | 13710.39 | 239.42 | 92.94 |
| linux candidate | 256 | 21121.91 / 22796.73 | 20471.24–22796.73 | 4.49 | 30958.18 | 402.04 | 188.44 |

Every measured candidate profile met the proposed **worker** p95 30 s and worker RSS 512 MiB targets. The largest Windows worker RSS was **500.53 MiB at 128 links**, only 11.47 MiB below the proposed ceiling, and GC-observed heap reached 403.42 MiB. Memory is non-monotonic with chain size because of allocation/GC behavior. Windows supervisor/esbuild process-tree RSS and exact instantaneous heap peak were not measured; do not reinterpret worker RSS as aggregate service memory. Linux cgroup accounting supplies a separate aggregate kernel high-water. Thus a stronger operational “total memory” acceptance remains unresolved.

The largest fixed profile is 46,325,022 logical bytes (below 64 MiB), a 98,787-byte WBS (below 2 MiB) and 256 links. These measurements support testing the proposed link ceiling, **not worst-case capacity for every admitted 64-MiB / 2-MiB-snapshot shape**, concurrent audits or hostile YAML. The snapshot allowance is substantially above measured snapshots. Fixtures share policy references and adjacent snapshot buffers, while logical admission charges every occurrence; independently allocated real acquisition objects can consume more memory. Depth 64 and exact byte limits are admission boundary tests, not stress-tested production budgets. New limits still require human compatibility acceptance.

### Canonical prefix work and isolated latency

Five fresh processes per row; strict parsing included in prefix timing. Reference-equivalence time is excluded. Baseline counters include strict-parser serialization plus its repeated prefix encodings. Candidate counters include strict-parser comparison and once-per-entry prefix encoding.

| Platform/version | Links | Prefix p50 / p95 ms | Encoded bytes | Hashed bytes | Prefix entry encodings |
| --- | --- | --- | --- | --- | --- |
| windows baseline | 1 | 0.29 / 0.30 | 1926 | 1050 | 1 |
| windows baseline | 8 | 0.56 / 0.74 | 53390 | 47614 | 64 |
| windows baseline | 32 | 4.27 / 4.46 | 751144 | 728546 | 1024 |
| windows baseline | 128 | 36.73 / 39.82 | 11618484 | 11528562 | 16384 |
| windows baseline | 256 | 146.69 / 149.52 | 46229940 | 46050162 | 65536 |
| windows candidate | 1 | 0.46 / 0.52 | 1926 | 880 | 1 |
| windows candidate | 8 | 0.59 / 0.65 | 12958 | 5829 | 8 |
| windows candidate | 32 | 1.26 / 1.55 | 50826 | 22819 | 32 |
| windows candidate | 128 | 2.92 / 2.99 | 202370 | 90815 | 128 |
| windows candidate | 256 | 3.76 / 5.15 | 404610 | 181567 | 256 |
| linux baseline | 1 | 0.26 / 0.48 | 1926 | 1050 | 1 |
| linux baseline | 8 | 0.48 / 0.74 | 53390 | 47614 | 64 |
| linux baseline | 32 | 3.93 / 4.29 | 751144 | 728546 | 1024 |
| linux baseline | 128 | 27.21 / 27.23 | 11618484 | 11528562 | 16384 |
| linux baseline | 256 | 126.37 / 133.92 | 46229940 | 46050162 | 65536 |
| linux candidate | 1 | 0.47 / 0.68 | 1926 | 880 | 1 |
| linux candidate | 8 | 0.46 / 0.48 | 12958 | 5829 | 8 |
| linux candidate | 32 | 1.06 / 1.66 | 50826 | 22819 | 32 |
| linux candidate | 128 | 2.16 / 2.51 | 202370 | 90815 | 128 |
| linux candidate | 256 | 3.72 / 3.87 | 404610 | 181567 | 256 |

At 256 links, prefix entry encodings fall **65,536 →256**, and encoded+hashed work **92,280,102 →586,177 bytes** (3.26× the 179,778-byte ledger, below 4B+4 KiB). Windows isolated prefix p50 is 146.69 →3.76 ms; Linux 126.37 →3.72 ms. Full-audit gains are modest and some small-grid candidate samples are slower; YAML validation, cryptography, replay membership and host variation dominate. No whole-audit asymptotic improvement is claimed.

### Raw accepted evidence

Each full-grid file has environment metadata and all 25 raw samples. Final prefix files contain all 50 raw samples per platform. The same fixture/input hashes bind all platforms/versions. Parent timing, setup, user/system CPU, process RSS, heap observations, success and errors are retained. These hashes name captured external files (including original line endings); embedded text is for independent inspection.

<details><summary>windows-baseline.jsonl — SHA-256 1787d8eea85eb3c297621b4ef0a0447eca943b1bff6f6aefe1c05000b36a59b7</summary>

```text
{"kind":"environment","label":"windows-baseline","timestamp":"2026-10-20T08:37:10.614Z","node":"v22.21.1","platform":"win32","arch":"x64","release":"10.0.26300","cpu":"AMD Ryzen 5 5600G with Radeon Graphics         ","logicalCpus":12,"hostMemoryBytes":34221330432,"watchdogMs":60000,"grid":[1,8,32,128,256],"samples":5,"heapMetric":"GC-observed high-water plus pre/post heapUsed; not exact instantaneous peak","limits":"External cgroup/host limits recorded by operator"}
{"kind":"sample","label":"windows-baseline","count":1,"sample":1,"exitCode":0,"signal":null,"processMs":878.0480000000001,"gcObservedHeapBytes":31288504,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":9.409099999999967,"wallMs":263.3795,"cpuUserMs":563,"cpuSystemMs":78,"peakRssKiB":113452,"heapBefore":11304360,"heapAfter":25504056,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":1,"sample":2,"exitCode":0,"signal":null,"processMs":860.7222000000002,"gcObservedHeapBytes":31173904,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":9.070299999999975,"wallMs":254.1871,"cpuUserMs":406,"cpuSystemMs":125,"peakRssKiB":113608,"heapBefore":11344128,"heapAfter":25773584,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":1,"sample":3,"exitCode":0,"signal":null,"processMs":892.1098999999999,"gcObservedHeapBytes":31263096,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":9.403599999999983,"wallMs":263.40059999999994,"cpuUserMs":610,"cpuSystemMs":93,"peakRssKiB":112504,"heapBefore":11345896,"heapAfter":25519872,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":1,"sample":4,"exitCode":0,"signal":null,"processMs":883.3934000000004,"gcObservedHeapBytes":31379640,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":9.129199999999969,"wallMs":261.87980000000005,"cpuUserMs":312,"cpuSystemMs":93,"peakRssKiB":113460,"heapBefore":11373088,"heapAfter":25329752,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":1,"sample":5,"exitCode":0,"signal":null,"processMs":897.8384999999998,"gcObservedHeapBytes":31225536,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":10.248300000000086,"wallMs":263.8144000000001,"cpuUserMs":360,"cpuSystemMs":140,"peakRssKiB":113248,"heapBefore":11342000,"heapAfter":25588480,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-baseline","count":1,"exitCode":0,"output":"PREFIX_RESULT {\"count\":1,\"ledgerBytes\":876,\"encodedBytes\":1050,\"hashedBytes\":1050,\"encodedEntries\":1,\"diagnosticMs\":0.09190000000000964}\n","stderr":""}
{"kind":"sample","label":"windows-baseline","count":8,"sample":1,"exitCode":0,"signal":null,"processMs":1497.3988,"gcObservedHeapBytes":68377432,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":25.797699999999963,"wallMs":854.2438,"cpuUserMs":1266,"cpuSystemMs":156,"peakRssKiB":147288,"heapBefore":14874104,"heapAfter":58157784,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":8,"sample":2,"exitCode":0,"signal":null,"processMs":1510.0166,"gcObservedHeapBytes":68342584,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":25.50249999999994,"wallMs":868.0378999999999,"cpuUserMs":1484,"cpuSystemMs":266,"peakRssKiB":147280,"heapBefore":14870152,"heapAfter":44799736,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":8,"sample":3,"exitCode":0,"signal":null,"processMs":1541.2837000000018,"gcObservedHeapBytes":68337304,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":24.363800000000083,"wallMs":907.4077000000001,"cpuUserMs":1282,"cpuSystemMs":297,"peakRssKiB":147276,"heapBefore":14871040,"heapAfter":44829560,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":8,"sample":4,"exitCode":0,"signal":null,"processMs":1528.7181999999993,"gcObservedHeapBytes":72689480,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":25.954400000000078,"wallMs":873.1344999999999,"cpuUserMs":1469,"cpuSystemMs":172,"peakRssKiB":150852,"heapBefore":14838184,"heapAfter":51331176,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":8,"sample":5,"exitCode":0,"signal":null,"processMs":1490.7043999999987,"gcObservedHeapBytes":68279600,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":24.748500000000035,"wallMs":858.6358,"cpuUserMs":1266,"cpuSystemMs":141,"peakRssKiB":147204,"heapBefore":14872880,"heapAfter":58210592,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-baseline","count":8,"exitCode":0,"output":"PREFIX_RESULT {\"count\":8,\"ledgerBytes\":5776,\"encodedBytes\":47614,\"hashedBytes\":47614,\"encodedEntries\":64,\"diagnosticMs\":0.30970000000002074}\n","stderr":""}
{"kind":"sample","label":"windows-baseline","count":32,"sample":1,"exitCode":0,"signal":null,"processMs":3543.5789000000004,"gcObservedHeapBytes":85868872,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":84.03470000000004,"wallMs":2815.2725,"cpuUserMs":3610,"cpuSystemMs":235,"peakRssKiB":167892,"heapBefore":29939496,"heapAfter":65633104,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":32,"sample":2,"exitCode":0,"signal":null,"processMs":3338.7181999999993,"gcObservedHeapBytes":82241176,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":67.41269999999997,"wallMs":2671.8932,"cpuUserMs":3469,"cpuSystemMs":188,"peakRssKiB":162692,"heapBefore":29952688,"heapAfter":75685800,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":32,"sample":3,"exitCode":0,"signal":null,"processMs":3358.230599999999,"gcObservedHeapBytes":92734600,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":71.61090000000002,"wallMs":2679.2133000000003,"cpuUserMs":3297,"cpuSystemMs":266,"peakRssKiB":174180,"heapBefore":29937688,"heapAfter":39853832,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":32,"sample":4,"exitCode":0,"signal":null,"processMs":3465.809799999999,"gcObservedHeapBytes":90648616,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":70.26679999999999,"wallMs":2736.9289,"cpuUserMs":3907,"cpuSystemMs":265,"peakRssKiB":174128,"heapBefore":29937456,"heapAfter":55276736,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":32,"sample":5,"exitCode":0,"signal":null,"processMs":3535.7497000000003,"gcObservedHeapBytes":82251104,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":68.75150000000008,"wallMs":2854.6664,"cpuUserMs":4078,"cpuSystemMs":204,"peakRssKiB":163100,"heapBefore":29937552,"heapAfter":18916448,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-baseline","count":32,"exitCode":0,"output":"PREFIX_RESULT {\"count\":32,\"ledgerBytes\":22598,\"encodedBytes\":728546,\"hashedBytes\":728546,\"encodedEntries\":1024,\"diagnosticMs\":5.427599999999984}\n","stderr":""}
{"kind":"sample","label":"windows-baseline","count":128,"sample":1,"exitCode":0,"signal":null,"processMs":13419.719599999997,"gcObservedHeapBytes":235966600,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":273.1264,"wallMs":12481.044000000002,"cpuUserMs":14578,"cpuSystemMs":1062,"peakRssKiB":326556,"heapBefore":98236224,"heapAfter":25732600,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":128,"sample":2,"exitCode":0,"signal":null,"processMs":13334.373800000001,"gcObservedHeapBytes":235355984,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":273.6966,"wallMs":12443.191900000002,"cpuUserMs":14203,"cpuSystemMs":891,"peakRssKiB":326032,"heapBefore":98410616,"heapAfter":30170072,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":128,"sample":3,"exitCode":0,"signal":null,"processMs":13255.178899999999,"gcObservedHeapBytes":423293632,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":264.11789999999996,"wallMs":12379.2127,"cpuUserMs":14344,"cpuSystemMs":906,"peakRssKiB":514644,"heapBefore":97690880,"heapAfter":45969344,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":128,"sample":4,"exitCode":0,"signal":null,"processMs":13166.583400000003,"gcObservedHeapBytes":236011704,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":268.63660000000004,"wallMs":12223.4263,"cpuUserMs":15188,"cpuSystemMs":1282,"peakRssKiB":326716,"heapBefore":98242936,"heapAfter":33944424,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":128,"sample":5,"exitCode":0,"signal":null,"processMs":13082.055999999997,"gcObservedHeapBytes":235922216,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":269.05779999999993,"wallMs":12204.0056,"cpuUserMs":14391,"cpuSystemMs":1031,"peakRssKiB":325892,"heapBefore":98207280,"heapAfter":25078816,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-baseline","count":128,"exitCode":0,"output":"PREFIX_RESULT {\"count\":128,\"ledgerBytes\":89922,\"encodedBytes\":11528562,\"hashedBytes\":11528562,\"encodedEntries\":16384,\"diagnosticMs\":37.42470000000003}\n","stderr":""}
{"kind":"sample","label":"windows-baseline","count":256,"sample":1,"exitCode":0,"signal":null,"processMs":27774.3508,"gcObservedHeapBytes":198931232,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":631.142,"wallMs":26515.730600000003,"cpuUserMs":31406,"cpuSystemMs":2015,"peakRssKiB":391108,"heapBefore":198908008,"heapAfter":63290736,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":256,"sample":2,"exitCode":0,"signal":null,"processMs":28177.723800000007,"gcObservedHeapBytes":198931216,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":614.4209,"wallMs":26937.3499,"cpuUserMs":32875,"cpuSystemMs":1531,"peakRssKiB":391672,"heapBefore":198907992,"heapAfter":63998384,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":256,"sample":3,"exitCode":0,"signal":null,"processMs":25611.676799999987,"gcObservedHeapBytes":198930064,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":740.1175000000001,"wallMs":24177.953299999997,"cpuUserMs":29875,"cpuSystemMs":1094,"peakRssKiB":390932,"heapBefore":198906840,"heapAfter":23567240,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":256,"sample":4,"exitCode":0,"signal":null,"processMs":24609.516000000003,"gcObservedHeapBytes":198931504,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":577.068,"wallMs":23486.204299999998,"cpuUserMs":29172,"cpuSystemMs":281,"peakRssKiB":391520,"heapBefore":198908280,"heapAfter":23530760,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-baseline","count":256,"sample":5,"exitCode":0,"signal":null,"processMs":26323.64929999999,"gcObservedHeapBytes":198931288,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":587.2431999999999,"wallMs":25171.481099999997,"cpuUserMs":31172,"cpuSystemMs":500,"peakRssKiB":390564,"heapBefore":198908064,"heapAfter":66969152,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-baseline","count":256,"exitCode":0,"output":"PREFIX_RESULT {\"count\":256,\"ledgerBytes\":179778,\"encodedBytes\":46050162,\"hashedBytes\":46050162,\"encodedEntries\":65536,\"diagnosticMs\":137.8515}\n","stderr":""}

```

</details>

<details><summary>windows-candidate.jsonl — SHA-256 223d5cf8d51d91b7641f9eefb37f6c570ba899e1f7151ce34d81b3555ede486e</summary>

```text
{"kind":"environment","label":"windows-candidate","timestamp":"2026-10-20T08:41:29.062Z","node":"v22.21.1","platform":"win32","arch":"x64","release":"10.0.26300","cpu":"AMD Ryzen 5 5600G with Radeon Graphics         ","logicalCpus":12,"hostMemoryBytes":34221330432,"watchdogMs":60000,"grid":[1,8,32,128,256],"samples":5,"heapMetric":"GC-observed high-water plus pre/post heapUsed; not exact instantaneous peak","limits":"External cgroup/host limits recorded by operator"}
{"kind":"sample","label":"windows-candidate","count":1,"sample":1,"exitCode":0,"signal":null,"processMs":841.1062999999999,"gcObservedHeapBytes":31133536,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.989500000000021,"wallMs":253.89260000000007,"cpuUserMs":515,"cpuSystemMs":94,"peakRssKiB":113516,"heapBefore":11399112,"heapAfter":26063440,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":1,"sample":2,"exitCode":0,"signal":null,"processMs":770.0108999999998,"gcObservedHeapBytes":31349632,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.737500000000011,"wallMs":221.72099999999995,"cpuUserMs":453,"cpuSystemMs":110,"peakRssKiB":113568,"heapBefore":11303136,"heapAfter":25680152,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":1,"sample":3,"exitCode":0,"signal":null,"processMs":801.462,"gcObservedHeapBytes":31119896,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.693399999999997,"wallMs":249.53150000000005,"cpuUserMs":500,"cpuSystemMs":94,"peakRssKiB":115412,"heapBefore":11379080,"heapAfter":26105536,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":1,"sample":4,"exitCode":0,"signal":null,"processMs":797.7532000000001,"gcObservedHeapBytes":30890560,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":8.157800000000009,"wallMs":244.7305,"cpuUserMs":328,"cpuSystemMs":188,"peakRssKiB":113528,"heapBefore":11385000,"heapAfter":26670744,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":1,"sample":5,"exitCode":0,"signal":null,"processMs":929.6856000000002,"gcObservedHeapBytes":31240432,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":10.474100000000021,"wallMs":265.8029,"cpuUserMs":609,"cpuSystemMs":172,"peakRssKiB":113336,"heapBefore":11324576,"heapAfter":25890800,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-candidate","count":1,"exitCode":0,"output":"PREFIX_RESULT {\"count\":1,\"ledgerBytes\":876,\"encodedBytes\":1926,\"hashedBytes\":880,\"encodedEntries\":1,\"diagnosticMs\":0.36369999999999436}\n","stderr":""}
{"kind":"sample","label":"windows-candidate","count":8,"sample":1,"exitCode":0,"signal":null,"processMs":1579.6630999999998,"gcObservedHeapBytes":67365344,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":40.408500000000004,"wallMs":892.7577,"cpuUserMs":1406,"cpuSystemMs":78,"peakRssKiB":145420,"heapBefore":14939000,"heapAfter":54765264,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":8,"sample":2,"exitCode":0,"signal":null,"processMs":1454.8855999999996,"gcObservedHeapBytes":65972688,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.902199999999993,"wallMs":843.2849,"cpuUserMs":1234,"cpuSystemMs":125,"peakRssKiB":144664,"heapBefore":14895384,"heapAfter":54509304,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":8,"sample":3,"exitCode":0,"signal":null,"processMs":1703.0463,"gcObservedHeapBytes":65871560,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.966499999999996,"wallMs":944.7325,"cpuUserMs":1406,"cpuSystemMs":235,"peakRssKiB":143896,"heapBefore":14909536,"heapAfter":54549232,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":8,"sample":4,"exitCode":0,"signal":null,"processMs":1452.1118000000006,"gcObservedHeapBytes":67410728,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.009000000000015,"wallMs":816.5733999999999,"cpuUserMs":1313,"cpuSystemMs":234,"peakRssKiB":146528,"heapBefore":14926176,"heapAfter":45211328,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":8,"sample":5,"exitCode":0,"signal":null,"processMs":1466.733400000001,"gcObservedHeapBytes":67408624,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":23.07280000000003,"wallMs":827.3276999999999,"cpuUserMs":1250,"cpuSystemMs":188,"peakRssKiB":145956,"heapBefore":14877016,"heapAfter":54332032,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-candidate","count":8,"exitCode":0,"output":"PREFIX_RESULT {\"count\":8,\"ledgerBytes\":5776,\"encodedBytes\":12958,\"hashedBytes\":5829,\"encodedEntries\":8,\"diagnosticMs\":0.6879000000000133}\n","stderr":""}
{"kind":"sample","label":"windows-candidate","count":32,"sample":1,"exitCode":0,"signal":null,"processMs":3589.8602999999985,"gcObservedHeapBytes":90714632,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":69.27120000000002,"wallMs":2854.2939,"cpuUserMs":3625,"cpuSystemMs":250,"peakRssKiB":171380,"heapBefore":29959544,"heapAfter":64192520,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":32,"sample":2,"exitCode":0,"signal":null,"processMs":3462.7754999999997,"gcObservedHeapBytes":89210784,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":73.5340000000001,"wallMs":2784.5796,"cpuUserMs":3687,"cpuSystemMs":187,"peakRssKiB":170148,"heapBefore":29959544,"heapAfter":63505080,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":32,"sample":3,"exitCode":0,"signal":null,"processMs":3435.640800000001,"gcObservedHeapBytes":82557928,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":70.2795000000001,"wallMs":2759.8648,"cpuUserMs":3562,"cpuSystemMs":234,"peakRssKiB":163080,"heapBefore":29960184,"heapAfter":26027776,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":32,"sample":4,"exitCode":0,"signal":null,"processMs":3567.842199999999,"gcObservedHeapBytes":84499128,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":73.4778,"wallMs":2877.7595,"cpuUserMs":3328,"cpuSystemMs":234,"peakRssKiB":164872,"heapBefore":29959528,"heapAfter":25445528,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":32,"sample":5,"exitCode":0,"signal":null,"processMs":3370.9401,"gcObservedHeapBytes":84440280,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":67.90540000000004,"wallMs":2731.9988,"cpuUserMs":3250,"cpuSystemMs":281,"peakRssKiB":164516,"heapBefore":29959312,"heapAfter":70971112,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-candidate","count":32,"exitCode":0,"output":"PREFIX_RESULT {\"count\":32,\"ledgerBytes\":22598,\"encodedBytes\":50826,\"hashedBytes\":22819,\"encodedEntries\":32,\"diagnosticMs\":2.2905000000000086}\n","stderr":""}
{"kind":"sample","label":"windows-candidate","count":128,"sample":1,"exitCode":0,"signal":null,"processMs":12820.671999999999,"gcObservedHeapBytes":236059960,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":272.6852,"wallMs":11933.358,"cpuUserMs":14625,"cpuSystemMs":563,"peakRssKiB":327040,"heapBefore":98182440,"heapAfter":63059568,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":128,"sample":2,"exitCode":0,"signal":null,"processMs":12929.932800000002,"gcObservedHeapBytes":236799016,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":277.6549,"wallMs":12003.9542,"cpuUserMs":14734,"cpuSystemMs":422,"peakRssKiB":327740,"heapBefore":98228600,"heapAfter":70224112,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":128,"sample":3,"exitCode":0,"signal":null,"processMs":13192.420199999993,"gcObservedHeapBytes":235105672,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":275.1518,"wallMs":12244.773200000001,"cpuUserMs":15875,"cpuSystemMs":516,"peakRssKiB":326024,"heapBefore":98203360,"heapAfter":54426216,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":128,"sample":4,"exitCode":0,"signal":null,"processMs":12897.03899999999,"gcObservedHeapBytes":423014784,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":276.41240000000005,"wallMs":11981.785300000001,"cpuUserMs":14625,"cpuSystemMs":438,"peakRssKiB":512544,"heapBefore":97712776,"heapAfter":45819616,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":128,"sample":5,"exitCode":0,"signal":null,"processMs":12902.380900000004,"gcObservedHeapBytes":236762512,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":301.5307,"wallMs":11972.3657,"cpuUserMs":15047,"cpuSystemMs":453,"peakRssKiB":328132,"heapBefore":98181856,"heapAfter":62005096,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-candidate","count":128,"exitCode":0,"output":"PREFIX_RESULT {\"count\":128,\"ledgerBytes\":89922,\"encodedBytes\":202370,\"hashedBytes\":90815,\"encodedEntries\":128,\"diagnosticMs\":23.97199999999998}\n","stderr":""}
{"kind":"sample","label":"windows-candidate","count":256,"sample":1,"exitCode":0,"signal":null,"processMs":27211.06850000001,"gcObservedHeapBytes":198951376,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":608.3598,"wallMs":25909.966,"cpuUserMs":31984,"cpuSystemMs":578,"peakRssKiB":390752,"heapBefore":198928872,"heapAfter":83776808,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":256,"sample":2,"exitCode":0,"signal":null,"processMs":25027.04299999999,"gcObservedHeapBytes":198972696,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":618.5294,"wallMs":23714.3838,"cpuUserMs":29485,"cpuSystemMs":453,"peakRssKiB":390488,"heapBefore":198950192,"heapAfter":39422040,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":256,"sample":3,"exitCode":0,"signal":null,"processMs":25995.2996,"gcObservedHeapBytes":198952624,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":559.9719,"wallMs":24888.728000000003,"cpuUserMs":31563,"cpuSystemMs":562,"peakRssKiB":391588,"heapBefore":198930120,"heapAfter":29770872,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":256,"sample":4,"exitCode":0,"signal":null,"processMs":26327.41650000002,"gcObservedHeapBytes":198951272,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":604.7030000000001,"wallMs":25049.284900000002,"cpuUserMs":30406,"cpuSystemMs":375,"peakRssKiB":390916,"heapBefore":198928768,"heapAfter":59121344,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"windows-candidate","count":256,"sample":5,"exitCode":0,"signal":null,"processMs":25413.565199999983,"gcObservedHeapBytes":198954856,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":557.2019,"wallMs":24288.2071,"cpuUserMs":31390,"cpuSystemMs":625,"peakRssKiB":391692,"heapBefore":198932352,"heapAfter":85023792,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"windows-candidate","count":256,"exitCode":0,"output":"PREFIX_RESULT {\"count\":256,\"ledgerBytes\":179778,\"encodedBytes\":404610,\"hashedBytes\":181567,\"encodedEntries\":256,\"diagnosticMs\":95.82040000000006}\n","stderr":""}

```

</details>

<details><summary>linux-baseline.jsonl — SHA-256 84684b860a2230c0e9145ff9054092d9395b4bda166a7c7fb45387bc09d9fda1</summary>

```text
Running as unit: dmk-r11-bench-baseline.service; invocation ID: 9d3bcf0074894b89b77b9823e4a9366d
CGROUP /user.slice/user-1000.slice/user@1000.service/app.slice/dmk-r11-bench-baseline.service
200000 100000
1073741824
0
{"kind":"environment","label":"linux-baseline","timestamp":"2026-10-20T08:45:57.366Z","node":"v22.21.1","platform":"linux","arch":"x64","release":"6.18.54.1-microsoft-standard-WSL2","cpu":"AMD Ryzen 5 5600G with Radeon Graphics","logicalCpus":12,"hostMemoryBytes":16702550016,"watchdogMs":60000,"grid":[1,8,32,128,256],"samples":5,"heapMetric":"GC-observed high-water plus pre/post heapUsed; not exact instantaneous peak","limits":"External cgroup/host limits recorded by operator"}
{"kind":"sample","label":"linux-baseline","count":1,"sample":1,"exitCode":0,"signal":null,"processMs":503.73523599999993,"gcObservedHeapBytes":22576176,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.614998999999983,"wallMs":236.07464099999999,"cpuUserMs":428.468,"cpuSystemMs":29.615,"peakRssKiB":104788,"heapBefore":10105400,"heapAfter":22021752,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":1,"sample":2,"exitCode":0,"signal":null,"processMs":460.651289,"gcObservedHeapBytes":22526960,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.046604000000002,"wallMs":220.29989600000002,"cpuUserMs":407.268,"cpuSystemMs":34.593,"peakRssKiB":109236,"heapBefore":10118216,"heapAfter":22177016,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":1,"sample":3,"exitCode":0,"signal":null,"processMs":464.770994,"gcObservedHeapBytes":22738736,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.430644999999998,"wallMs":211.52791600000003,"cpuUserMs":420.588,"cpuSystemMs":19.956,"peakRssKiB":109284,"heapBefore":10086880,"heapAfter":21906000,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":1,"sample":4,"exitCode":0,"signal":null,"processMs":485.8678269999998,"gcObservedHeapBytes":22751488,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":6.655704000000014,"wallMs":234.242427,"cpuUserMs":419.323,"cpuSystemMs":25.029,"peakRssKiB":107948,"heapBefore":10083312,"heapAfter":21904976,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":1,"sample":5,"exitCode":0,"signal":null,"processMs":481.17432199999985,"gcObservedHeapBytes":22831152,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":7.197270000000003,"wallMs":225.63086800000002,"cpuUserMs":404.903,"cpuSystemMs":30.231,"peakRssKiB":105876,"heapBefore":10123872,"heapAfter":21878464,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-baseline","count":1,"exitCode":0,"output":"PREFIX_RESULT {\"count\":1,\"ledgerBytes\":876,\"encodedBytes\":1926,\"hashedBytes\":1050,\"encodedEntries\":1,\"diagnosticMs\":0.07050599999999463}\n","stderr":""}
{"kind":"sample","label":"linux-baseline","count":8,"sample":1,"exitCode":0,"signal":null,"processMs":1022.6393680000001,"gcObservedHeapBytes":28216768,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":21.629232000000002,"wallMs":774.36276,"cpuUserMs":1186.174,"cpuSystemMs":119.783,"peakRssKiB":119520,"heapBefore":14560888,"heapAfter":15443248,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":8,"sample":2,"exitCode":0,"signal":null,"processMs":1013.5593520000002,"gcObservedHeapBytes":28273712,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.24536999999998,"wallMs":715.690006,"cpuUserMs":1112.595,"cpuSystemMs":92.563,"peakRssKiB":119372,"heapBefore":14583184,"heapAfter":13693728,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":8,"sample":3,"exitCode":0,"signal":null,"processMs":955.5960210000003,"gcObservedHeapBytes":28346952,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":20.629424,"wallMs":703.904434,"cpuUserMs":1113.072,"cpuSystemMs":73.097,"peakRssKiB":119280,"heapBefore":14604520,"heapAfter":15707856,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":8,"sample":4,"exitCode":0,"signal":null,"processMs":1072.094078,"gcObservedHeapBytes":28276040,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.975075999999973,"wallMs":780.8867890000001,"cpuUserMs":1213.742,"cpuSystemMs":86.383,"peakRssKiB":119792,"heapBefore":14561776,"heapAfter":15227176,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":8,"sample":5,"exitCode":0,"signal":null,"processMs":909.8942809999999,"gcObservedHeapBytes":28384160,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":20.70384999999999,"wallMs":660.1653709999999,"cpuUserMs":1049.344,"cpuSystemMs":74.305,"peakRssKiB":117656,"heapBefore":14598616,"heapAfter":13005248,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-baseline","count":8,"exitCode":0,"output":"PREFIX_RESULT {\"count\":8,\"ledgerBytes\":5776,\"encodedBytes\":53390,\"hashedBytes\":47614,\"encodedEntries\":64,\"diagnosticMs\":0.2351799999999855}\n","stderr":""}
{"kind":"sample","label":"linux-baseline","count":32,"sample":1,"exitCode":0,"signal":null,"processMs":2660.834634,"gcObservedHeapBytes":30788712,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":75.93489599999998,"wallMs":2342.790602,"cpuUserMs":3236.581,"cpuSystemMs":236.3,"peakRssKiB":125672,"heapBefore":29652864,"heapAfter":26607760,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":32,"sample":2,"exitCode":0,"signal":null,"processMs":2623.44211,"gcObservedHeapBytes":31131568,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":73.50539000000003,"wallMs":2312.4845809999997,"cpuUserMs":3208.949,"cpuSystemMs":225.894,"peakRssKiB":123996,"heapBefore":29653080,"heapAfter":26625264,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":32,"sample":3,"exitCode":0,"signal":null,"processMs":2609.8038430000015,"gcObservedHeapBytes":30802592,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":70.13300699999996,"wallMs":2300.433915,"cpuUserMs":3250.967,"cpuSystemMs":174.758,"peakRssKiB":123668,"heapBefore":29652576,"heapAfter":26882256,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":32,"sample":4,"exitCode":0,"signal":null,"processMs":2776.2279629999994,"gcObservedHeapBytes":29676680,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":108.16924999999998,"wallMs":2400.900286,"cpuUserMs":3375.85,"cpuSystemMs":216.59,"peakRssKiB":121908,"heapBefore":29652776,"heapAfter":26005368,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":32,"sample":5,"exitCode":0,"signal":null,"processMs":2574.6536269999997,"gcObservedHeapBytes":31128008,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":72.46841800000001,"wallMs":2248.926155,"cpuUserMs":3184.366,"cpuSystemMs":187.975,"peakRssKiB":121568,"heapBefore":29654264,"heapAfter":25715856,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-baseline","count":32,"exitCode":0,"output":"PREFIX_RESULT {\"count\":32,\"ledgerBytes\":22598,\"encodedBytes\":751144,\"hashedBytes\":728546,\"encodedEntries\":1024,\"diagnosticMs\":2.682288}\n","stderr":""}
{"kind":"sample","label":"linux-baseline","count":128,"sample":1,"exitCode":0,"signal":null,"processMs":10739.651837000001,"gcObservedHeapBytes":97426120,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":302.701028,"wallMs":10193.209229,"cpuUserMs":13908.074,"cpuSystemMs":911.585,"peakRssKiB":240644,"heapBefore":97402216,"heapAfter":20210168,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":128,"sample":2,"exitCode":0,"signal":null,"processMs":10772.491188999997,"gcObservedHeapBytes":97426376,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":295.397431,"wallMs":10212.828710000002,"cpuUserMs":14025.133,"cpuSystemMs":774.344,"peakRssKiB":241188,"heapBefore":97402472,"heapAfter":18240816,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":128,"sample":3,"exitCode":0,"signal":null,"processMs":10545.627062,"gcObservedHeapBytes":97426280,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":303.77397800000006,"wallMs":9992.777659000001,"cpuUserMs":13769.194,"cpuSystemMs":790.215,"peakRssKiB":240808,"heapBefore":97402376,"heapAfter":17562968,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":128,"sample":4,"exitCode":0,"signal":null,"processMs":9677.126970999998,"gcObservedHeapBytes":97426352,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":299.840052,"wallMs":9126.616295,"cpuUserMs":12642.178,"cpuSystemMs":708.418,"peakRssKiB":241144,"heapBefore":97402448,"heapAfter":17593016,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":128,"sample":5,"exitCode":0,"signal":null,"processMs":11678.583654000002,"gcObservedHeapBytes":97457064,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":299.078583,"wallMs":11138.360772,"cpuUserMs":15137.985,"cpuSystemMs":953.435,"peakRssKiB":243232,"heapBefore":97433160,"heapAfter":18435056,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-baseline","count":128,"exitCode":0,"output":"PREFIX_RESULT {\"count\":128,\"ledgerBytes\":89922,\"encodedBytes\":11618484,\"hashedBytes\":11528562,\"encodedEntries\":16384,\"diagnosticMs\":28.212488000000008}\n","stderr":""}
{"kind":"sample","label":"linux-baseline","count":256,"sample":1,"exitCode":0,"signal":null,"processMs":23320.338440000007,"gcObservedHeapBytes":197569400,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":826.373173,"wallMs":22214.94764,"cpuUserMs":30506.977,"cpuSystemMs":1678.357,"peakRssKiB":409280,"heapBefore":197545632,"heapAfter":20726376,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":256,"sample":2,"exitCode":0,"signal":null,"processMs":22387.946605000005,"gcObservedHeapBytes":197570296,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":683.7364600000001,"wallMs":21439.203260000002,"cpuUserMs":29150.319,"cpuSystemMs":1839.574,"peakRssKiB":408976,"heapBefore":197546528,"heapAfter":20261840,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":256,"sample":3,"exitCode":0,"signal":null,"processMs":22790.884097000016,"gcObservedHeapBytes":197569560,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":658.4652389999999,"wallMs":21860.336793000002,"cpuUserMs":29776.518,"cpuSystemMs":1989.8,"peakRssKiB":411148,"heapBefore":197545792,"heapAfter":23650848,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":256,"sample":4,"exitCode":0,"signal":null,"processMs":24528.25734499999,"gcObservedHeapBytes":197570224,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":768.2238960000001,"wallMs":23433.206531,"cpuUserMs":32367.975,"cpuSystemMs":1906.285,"peakRssKiB":411852,"heapBefore":197546456,"heapAfter":18061864,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-baseline","count":256,"sample":5,"exitCode":0,"signal":null,"processMs":21374.38527300002,"gcObservedHeapBytes":197567632,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":747.351143,"wallMs":20343.192854,"cpuUserMs":28044.581,"cpuSystemMs":1654.568,"peakRssKiB":411304,"heapBefore":197543864,"heapAfter":16724272,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-baseline","count":256,"exitCode":0,"output":"PREFIX_RESULT {\"count\":256,\"ledgerBytes\":179778,\"encodedBytes\":46229940,\"hashedBytes\":46050162,\"encodedEntries\":65536,\"diagnosticMs\":124.82251099999996}\n","stderr":""}
CGROUP_FINAL
437886976
usage_usec 278775025
user_usec 258451136
system_usec 20323888
nice_usec 0
nr_periods 1902
nr_throttled 50
throttled_usec 1051525
nr_bursts 0
burst_usec 0
low 0
high 0
max 0
oom 0
oom_kill 0
oom_group_kill 0
Finished with result: success
Main processes terminated with: code=exited/status=0
Service runtime: 3min 10.166s
CPU time consumed: 4min 38.776s
Memory peak: 512.0K
Memory swap peak: 0B

```

</details>

<details><summary>linux-candidate.jsonl — SHA-256 88c20d644baf1d137e3eb35d8329caab8ea55755775ea5175a1664445ceda5b6</summary>

```text
Running as unit: dmk-r11-bench-candidate.service; invocation ID: c67a35066d3046c9bc713a1b94ddf443
CGROUP /user.slice/user-1000.slice/user@1000.service/app.slice/dmk-r11-bench-candidate.service
200000 100000
1073741824
0
{"kind":"environment","label":"linux-candidate","timestamp":"2026-10-20T08:49:16.162Z","node":"v22.21.1","platform":"linux","arch":"x64","release":"6.18.54.1-microsoft-standard-WSL2","cpu":"AMD Ryzen 5 5600G with Radeon Graphics","logicalCpus":12,"hostMemoryBytes":16702550016,"watchdogMs":60000,"grid":[1,8,32,128,256],"samples":5,"heapMetric":"GC-observed high-water plus pre/post heapUsed; not exact instantaneous peak","limits":"External cgroup/host limits recorded by operator"}
{"kind":"sample","label":"linux-candidate","count":1,"sample":1,"exitCode":0,"signal":null,"processMs":480.86466400000006,"gcObservedHeapBytes":22502912,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":10.355319000000009,"wallMs":215.29337599999997,"cpuUserMs":417.448,"cpuSystemMs":27.217,"peakRssKiB":104944,"heapBefore":10151304,"heapAfter":22253896,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":1,"sample":2,"exitCode":0,"signal":null,"processMs":471.91513900000007,"gcObservedHeapBytes":22552792,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":6.846641000000005,"wallMs":223.06751900000003,"cpuUserMs":413.637,"cpuSystemMs":23.053,"peakRssKiB":105996,"heapBefore":10149040,"heapAfter":22208296,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":1,"sample":3,"exitCode":0,"signal":null,"processMs":447.882697,"gcObservedHeapBytes":22792424,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":6.602902,"wallMs":206.70116299999998,"cpuUserMs":382.241,"cpuSystemMs":46.332,"peakRssKiB":108020,"heapBefore":10153608,"heapAfter":22173968,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":1,"sample":4,"exitCode":0,"signal":null,"processMs":448.3671599999998,"gcObservedHeapBytes":22696904,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":6.963891000000018,"wallMs":214.48975799999997,"cpuUserMs":401.18,"cpuSystemMs":25.321,"peakRssKiB":107180,"heapBefore":10150368,"heapAfter":22024168,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":1,"sample":5,"exitCode":0,"signal":null,"processMs":450.7332019999999,"gcObservedHeapBytes":22778128,"logicalBytes":311381,"serializedBytes":331297,"inputSha256":"484c2b5dcd1be475d3cd26129ce55d087803b6b30580ddf269c99d0fe51d815d","ledgerBytes":876,"maxSnapshotBytes":76424,"setupMs":6.676714000000004,"wallMs":210.055522,"cpuUserMs":403.853,"cpuSystemMs":28.898,"peakRssKiB":105328,"heapBefore":10135960,"heapAfter":22061480,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-candidate","count":1,"exitCode":0,"output":"PREFIX_RESULT {\"count\":1,\"ledgerBytes\":876,\"encodedBytes\":1926,\"hashedBytes\":880,\"encodedEntries\":1,\"diagnosticMs\":0.2876489999999876}\n","stderr":""}
{"kind":"sample","label":"linux-candidate","count":8,"sample":1,"exitCode":0,"signal":null,"processMs":1072.054623,"gcObservedHeapBytes":28487384,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":24.36148300000002,"wallMs":796.645436,"cpuUserMs":1278.794,"cpuSystemMs":88.098,"peakRssKiB":119572,"heapBefore":14577424,"heapAfter":14021080,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":8,"sample":2,"exitCode":0,"signal":null,"processMs":1025.5797059999995,"gcObservedHeapBytes":27952760,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":22.585133000000013,"wallMs":740.6822050000001,"cpuUserMs":1185.242,"cpuSystemMs":54.862,"peakRssKiB":118360,"heapBefore":14620936,"heapAfter":15230976,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":8,"sample":3,"exitCode":0,"signal":null,"processMs":943.9944820000001,"gcObservedHeapBytes":28180672,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":24.56946499999998,"wallMs":685.879323,"cpuUserMs":1120.921,"cpuSystemMs":42.382,"peakRssKiB":119728,"heapBefore":14625432,"heapAfter":15689840,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":8,"sample":4,"exitCode":0,"signal":null,"processMs":953.1051150000003,"gcObservedHeapBytes":28631928,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":20.865028999999993,"wallMs":703.6467580000001,"cpuUserMs":1096.906,"cpuSystemMs":90.098,"peakRssKiB":118976,"heapBefore":14610200,"heapAfter":15603760,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":8,"sample":5,"exitCode":0,"signal":null,"processMs":1050.9323170000007,"gcObservedHeapBytes":28235496,"logicalBytes":1422540,"serializedBytes":1513478,"inputSha256":"a453d82aada985158dd92632771eef70ba1abf8043e4df19cdb920e825afedf5","ledgerBytes":5776,"maxSnapshotBytes":77033,"setupMs":24.588176999999973,"wallMs":756.623472,"cpuUserMs":1205.951,"cpuSystemMs":56.771,"peakRssKiB":118784,"heapBefore":14631264,"heapAfter":14866248,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-candidate","count":8,"exitCode":0,"output":"PREFIX_RESULT {\"count\":8,\"ledgerBytes\":5776,\"encodedBytes\":12958,\"hashedBytes\":5829,\"encodedEntries\":8,\"diagnosticMs\":0.5591619999999864}\n","stderr":""}
{"kind":"sample","label":"linux-candidate","count":32,"sample":1,"exitCode":0,"signal":null,"processMs":2641.8146270000007,"gcObservedHeapBytes":30817592,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":77.22252900000001,"wallMs":2314.162312,"cpuUserMs":3170.21,"cpuSystemMs":290.708,"peakRssKiB":126236,"heapBefore":29674568,"heapAfter":26257776,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":32,"sample":2,"exitCode":0,"signal":null,"processMs":2670.0174229999993,"gcObservedHeapBytes":31183120,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":74.58408800000001,"wallMs":2350.875506,"cpuUserMs":3270.8,"cpuSystemMs":220.288,"peakRssKiB":125268,"heapBefore":29674808,"heapAfter":25553704,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":32,"sample":3,"exitCode":0,"signal":null,"processMs":2658.3302550000008,"gcObservedHeapBytes":31525056,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":74.18216900000002,"wallMs":2337.645989,"cpuUserMs":3293.345,"cpuSystemMs":190.872,"peakRssKiB":122676,"heapBefore":29674720,"heapAfter":20876640,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":32,"sample":4,"exitCode":0,"signal":null,"processMs":2625.068908000001,"gcObservedHeapBytes":30630784,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":73.63815700000004,"wallMs":2311.3281869999996,"cpuUserMs":3239.775,"cpuSystemMs":180.995,"peakRssKiB":121648,"heapBefore":29675000,"heapAfter":24557440,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":32,"sample":5,"exitCode":0,"signal":null,"processMs":2527.6965259999997,"gcObservedHeapBytes":31191120,"logicalBytes":5297044,"serializedBytes":5641158,"inputSha256":"5cd06504dc1aeba0bdb7ea998f474779dfa562b57f9ca5621e05e9ee10a4f938","ledgerBytes":22598,"maxSnapshotBytes":79121,"setupMs":71.25238399999998,"wallMs":2213.2567440000003,"cpuUserMs":3055.539,"cpuSystemMs":242.882,"peakRssKiB":123912,"heapBefore":29675056,"heapAfter":26815688,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-candidate","count":32,"exitCode":0,"output":"PREFIX_RESULT {\"count\":32,\"ledgerBytes\":22598,\"encodedBytes\":50826,\"hashedBytes\":22819,\"encodedEntries\":32,\"diagnosticMs\":2.0799900000000093}\n","stderr":""}
{"kind":"sample","label":"linux-candidate","count":128,"sample":1,"exitCode":0,"signal":null,"processMs":9767.206315,"gcObservedHeapBytes":97449848,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":299.206107,"wallMs":9226.820169,"cpuUserMs":12852.763,"cpuSystemMs":857.626,"peakRssKiB":245168,"heapBefore":97426816,"heapAfter":16677680,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":128,"sample":2,"exitCode":0,"signal":null,"processMs":10052.732909999999,"gcObservedHeapBytes":97447800,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":311.3143160000001,"wallMs":9481.096542000001,"cpuUserMs":13324.29,"cpuSystemMs":736.25,"peakRssKiB":240884,"heapBefore":97424768,"heapAfter":18151536,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":128,"sample":3,"exitCode":0,"signal":null,"processMs":10114.054604999998,"gcObservedHeapBytes":97448304,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":318.39777699999996,"wallMs":9540.270238,"cpuUserMs":12801.871,"cpuSystemMs":812.271,"peakRssKiB":241228,"heapBefore":97425272,"heapAfter":19576192,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":128,"sample":4,"exitCode":0,"signal":null,"processMs":9975.840856000003,"gcObservedHeapBytes":97447408,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":327.79848400000003,"wallMs":9394.376567,"cpuUserMs":12869.963,"cpuSystemMs":741.521,"peakRssKiB":240908,"heapBefore":97424376,"heapAfter":16646616,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":128,"sample":5,"exitCode":0,"signal":null,"processMs":9593.917204000005,"gcObservedHeapBytes":97447408,"logicalBytes":21800094,"serializedBytes":23306672,"inputSha256":"4f74c0208ad863f16eafe51537f5f6cee2dd9997fb32c2c514e37931f9220aaf","ledgerBytes":89922,"maxSnapshotBytes":87523,"setupMs":306.337635,"wallMs":9042.666443,"cpuUserMs":12936.127,"cpuSystemMs":784.024,"peakRssKiB":241760,"heapBefore":97424376,"heapAfter":17616840,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-candidate","count":128,"exitCode":0,"output":"PREFIX_RESULT {\"count\":128,\"ledgerBytes\":89922,\"encodedBytes\":202370,\"hashedBytes\":90815,\"encodedEntries\":128,\"diagnosticMs\":14.531880000000001}\n","stderr":""}
{"kind":"sample","label":"linux-candidate","count":256,"sample":1,"exitCode":0,"signal":null,"processMs":21451.60858,"gcObservedHeapBytes":197594472,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":720.102418,"wallMs":20471.240633,"cpuUserMs":28456.453,"cpuSystemMs":1718.384,"peakRssKiB":410656,"heapBefore":197571424,"heapAfter":22728520,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":256,"sample":2,"exitCode":0,"signal":null,"processMs":22204.52468999999,"gcObservedHeapBytes":197592160,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":712.161376,"wallMs":21121.91185,"cpuUserMs":28433.464,"cpuSystemMs":1925.538,"peakRssKiB":408248,"heapBefore":197569112,"heapAfter":16973648,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":256,"sample":3,"exitCode":0,"signal":null,"processMs":21982.86892199998,"gcObservedHeapBytes":197591176,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":750.017897,"wallMs":20935.474325000003,"cpuUserMs":29150.237,"cpuSystemMs":1807.942,"peakRssKiB":411688,"heapBefore":197568128,"heapAfter":18567696,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":256,"sample":4,"exitCode":0,"signal":null,"processMs":23757.391505000007,"gcObservedHeapBytes":197592736,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":693.7872890000001,"wallMs":22796.728424,"cpuUserMs":31110.483,"cpuSystemMs":1817.82,"peakRssKiB":408336,"heapBefore":197569688,"heapAfter":23311784,"valid":true,"mayApply":false,"errors":[]}
{"kind":"sample","label":"linux-candidate","count":256,"sample":5,"exitCode":0,"signal":null,"processMs":23774.210833999998,"gcObservedHeapBytes":197591744,"logicalBytes":46325022,"serializedBytes":49754288,"inputSha256":"57febe605fa57ca87d74c24e11483c7c956a117dca40771a72ebfaa934af0f42","ledgerBytes":179778,"maxSnapshotBytes":98787,"setupMs":726.082199,"wallMs":22756.922889999998,"cpuUserMs":31063.781,"cpuSystemMs":1897.254,"peakRssKiB":409728,"heapBefore":197568696,"heapAfter":22289984,"valid":true,"mayApply":false,"errors":[]}
{"kind":"prefix","label":"linux-candidate","count":256,"exitCode":0,"output":"PREFIX_RESULT {\"count\":256,\"ledgerBytes\":179778,\"encodedBytes\":404610,\"hashedBytes\":181567,\"encodedEntries\":256,\"diagnosticMs\":69.64595199999997}\n","stderr":""}
CGROUP_FINAL
444968960
usage_usec 271924833
user_usec 251860075
system_usec 20064757
nice_usec 0
nr_periods 1847
nr_throttled 47
throttled_usec 877682
nr_bursts 0
burst_usec 0
low 0
high 0
max 0
oom 0
oom_kill 0
oom_group_kill 0
Finished with result: success
Main processes terminated with: code=exited/status=0
Service runtime: 3min 4.788s
CPU time consumed: 4min 31.925s
Memory peak: 413.6M
Memory swap peak: 0B

```

</details>

<details><summary>windows-prefix-final.jsonl — SHA-256 4729d6482ffa670ed4f6b58815be662ae8221c666003df3da924a1536ee739fe</summary>

```text
{"platform":"windows","label":"baseline","count":1,"sample":1,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.2886999999999489,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":1,"sample":2,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.2817999999999756,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":1,"sample":3,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.27789999999998827,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":1,"sample":4,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.29750000000001364,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":1,"sample":5,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.2988000000000284,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":8,"sample":1,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.5509999999999877,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":8,"sample":2,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.5506000000000313,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":8,"sample":3,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.5631000000000199,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":8,"sample":4,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.6020000000000323,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":8,"sample":5,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.740600000000029,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":32,"sample":1,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.464800000000025,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":32,"sample":2,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.272899999999993,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":32,"sample":3,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.262200000000007,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":32,"sample":4,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":3.987699999999961,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":32,"sample":5,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.291100000000029,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":128,"sample":1,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":36.75780000000003,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":128,"sample":2,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":36.58100000000002,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":128,"sample":3,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":36.72550000000007,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":128,"sample":4,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":39.817100000000096,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":128,"sample":5,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":35.67539999999997,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":256,"sample":1,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":146.68989999999997,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":256,"sample":2,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":149.5213,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":256,"sample":3,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":145.36969999999997,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":256,"sample":4,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":140.46669999999995,"equivalenceMs":0}
{"platform":"windows","label":"baseline","count":256,"sample":5,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":148.3348000000001,"equivalenceMs":0}
{"platform":"windows","label":"candidate","count":1,"sample":1,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.4233999999999014,"equivalenceMs":0.03139999999996235}
{"platform":"windows","label":"candidate","count":1,"sample":2,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.46399999999999864,"equivalenceMs":0.032399999999995543}
{"platform":"windows","label":"candidate","count":1,"sample":3,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.44769999999999754,"equivalenceMs":0.03260000000000218}
{"platform":"windows","label":"candidate","count":1,"sample":4,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.5206000000000017,"equivalenceMs":0.032199999999988904}
{"platform":"windows","label":"candidate","count":1,"sample":5,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.5069000000000301,"equivalenceMs":0.03989999999998872}
{"platform":"windows","label":"candidate","count":8,"sample":1,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.5615000000000236,"equivalenceMs":0.11850000000004002}
{"platform":"windows","label":"candidate","count":8,"sample":2,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.5889999999999986,"equivalenceMs":0.11889999999999645}
{"platform":"windows","label":"candidate","count":8,"sample":3,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.5538000000000238,"equivalenceMs":0.11649999999997362}
{"platform":"windows","label":"candidate","count":8,"sample":4,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.6536000000000399,"equivalenceMs":0.11840000000000828}
{"platform":"windows","label":"candidate","count":8,"sample":5,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.5886000000000422,"equivalenceMs":0.17369999999999663}
{"platform":"windows","label":"candidate","count":32,"sample":1,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.5460999999999672,"equivalenceMs":1.5048999999999637}
{"platform":"windows","label":"candidate","count":32,"sample":2,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.3480000000000132,"equivalenceMs":1.443399999999997}
{"platform":"windows","label":"candidate","count":32,"sample":3,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.1632000000000176,"equivalenceMs":1.5621000000000436}
{"platform":"windows","label":"candidate","count":32,"sample":4,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.1595000000000368,"equivalenceMs":1.5838999999999714}
{"platform":"windows","label":"candidate","count":32,"sample":5,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.258100000000013,"equivalenceMs":1.488900000000001}
{"platform":"windows","label":"candidate","count":128,"sample":1,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.9610999999999876,"equivalenceMs":16.48689999999999}
{"platform":"windows","label":"candidate","count":128,"sample":2,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.922700000000077,"equivalenceMs":17.137699999999995}
{"platform":"windows","label":"candidate","count":128,"sample":3,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.3156999999999925,"equivalenceMs":17.34820000000002}
{"platform":"windows","label":"candidate","count":128,"sample":4,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.993499999999983,"equivalenceMs":16.647299999999973}
{"platform":"windows","label":"candidate","count":128,"sample":5,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.3344000000000165,"equivalenceMs":17.50980000000004}
{"platform":"windows","label":"candidate","count":256,"sample":1,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.8360999999999876,"equivalenceMs":75.25070000000005}
{"platform":"windows","label":"candidate","count":256,"sample":2,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.7268000000000256,"equivalenceMs":90.24549999999999}
{"platform":"windows","label":"candidate","count":256,"sample":3,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.7008999999999332,"equivalenceMs":73.60359999999991}
{"platform":"windows","label":"candidate","count":256,"sample":4,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.7601999999999407,"equivalenceMs":88.2056}
{"platform":"windows","label":"candidate","count":256,"sample":5,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":5.149999999999977,"equivalenceMs":83.20240000000001}

```

</details>

<details><summary>linux-prefix-final.jsonl — SHA-256 c8b8bdb217acad192e59123e7479c2a517a3d6ff275fb0266b8f6e02d23473f0</summary>

```text
Running as unit: dmk-r11-prefix-final.service; invocation ID: b6ce5a5c16bf47ab98da94f80904ec20
CGROUP /user.slice/user-1000.slice/user@1000.service/app.slice/dmk-r11-prefix-final.service
200000 100000
1073741824
{"platform":"linux","label":"baseline","count":1,"sample":1,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.4802400000000091,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":1,"sample":2,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.2559050000000127,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":1,"sample":3,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.29762599999997974,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":1,"sample":4,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.2183780000000013,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":1,"sample":5,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":1050,"encodedEntries":1,"prefixMs":0.22123199999998633,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":8,"sample":1,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.46778900000001045,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":8,"sample":2,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.7390670000000057,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":8,"sample":3,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.46833600000002207,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":8,"sample":4,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.48380399999999213,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":8,"sample":5,"exitCode":0,"ledgerBytes":5776,"encodedBytes":53390,"hashedBytes":47614,"encodedEntries":64,"prefixMs":0.5592300000000137,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":32,"sample":1,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.158490999999998,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":32,"sample":2,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":4.2902229999999975,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":32,"sample":3,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":3.933318999999983,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":32,"sample":4,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":3.711031999999989,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":32,"sample":5,"exitCode":0,"ledgerBytes":22598,"encodedBytes":751144,"hashedBytes":728546,"encodedEntries":1024,"prefixMs":3.356436000000002,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":128,"sample":1,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":26.91719299999997,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":128,"sample":2,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":27.230143999999996,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":128,"sample":3,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":27.22500999999997,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":128,"sample":4,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":27.207799000000023,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":128,"sample":5,"exitCode":0,"ledgerBytes":89922,"encodedBytes":11618484,"hashedBytes":11528562,"encodedEntries":16384,"prefixMs":26.470780999999988,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":256,"sample":1,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":126.36818599999998,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":256,"sample":2,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":125.72303500000004,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":256,"sample":3,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":133.92400700000002,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":256,"sample":4,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":125.45350300000001,"equivalenceMs":0}
{"platform":"linux","label":"baseline","count":256,"sample":5,"exitCode":0,"ledgerBytes":179778,"encodedBytes":46229940,"hashedBytes":46050162,"encodedEntries":65536,"prefixMs":133.130353,"equivalenceMs":0}
{"platform":"linux","label":"candidate","count":1,"sample":1,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.47455199999998854,"equivalenceMs":0.03360000000000696}
{"platform":"linux","label":"candidate","count":1,"sample":2,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.6755399999999838,"equivalenceMs":0.05373599999998646}
{"platform":"linux","label":"candidate","count":1,"sample":3,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.60923200000002,"equivalenceMs":0.0528240000000153}
{"platform":"linux","label":"candidate","count":1,"sample":4,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.42599899999999025,"equivalenceMs":0.029503000000005386}
{"platform":"linux","label":"candidate","count":1,"sample":5,"exitCode":0,"ledgerBytes":876,"encodedBytes":1926,"hashedBytes":880,"encodedEntries":1,"prefixMs":0.3898930000000007,"equivalenceMs":0.028762999999997874}
{"platform":"linux","label":"candidate","count":8,"sample":1,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.4429760000000158,"equivalenceMs":0.10265400000000113}
{"platform":"linux","label":"candidate","count":8,"sample":2,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.47403399999998896,"equivalenceMs":0.1012139999999988}
{"platform":"linux","label":"candidate","count":8,"sample":3,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.4561160000000086,"equivalenceMs":0.10382400000000302}
{"platform":"linux","label":"candidate","count":8,"sample":4,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.47960999999997966,"equivalenceMs":0.10454400000000419}
{"platform":"linux","label":"candidate","count":8,"sample":5,"exitCode":0,"ledgerBytes":5776,"encodedBytes":12958,"hashedBytes":5829,"encodedEntries":8,"prefixMs":0.44845699999999056,"equivalenceMs":0.12682899999998654}
{"platform":"linux","label":"candidate","count":32,"sample":1,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.3475389999999834,"equivalenceMs":2.1165870000000098}
{"platform":"linux","label":"candidate","count":32,"sample":2,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.6631200000000206,"equivalenceMs":2.606437999999997}
{"platform":"linux","label":"candidate","count":32,"sample":3,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":0.9395549999999844,"equivalenceMs":1.8131079999999997}
{"platform":"linux","label":"candidate","count":32,"sample":4,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.056162999999998,"equivalenceMs":1.522057999999987}
{"platform":"linux","label":"candidate","count":32,"sample":5,"exitCode":0,"ledgerBytes":22598,"encodedBytes":50826,"hashedBytes":22819,"encodedEntries":32,"prefixMs":1.064752000000027,"equivalenceMs":1.6226000000000056}
{"platform":"linux","label":"candidate","count":128,"sample":1,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.5053959999999904,"equivalenceMs":12.603594999999984}
{"platform":"linux","label":"candidate","count":128,"sample":2,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.156815999999992,"equivalenceMs":12.662848999999994}
{"platform":"linux","label":"candidate","count":128,"sample":3,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.153872000000007,"equivalenceMs":13.648204000000021}
{"platform":"linux","label":"candidate","count":128,"sample":4,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.0635799999999733,"equivalenceMs":12.98702099999997}
{"platform":"linux","label":"candidate","count":128,"sample":5,"exitCode":0,"ledgerBytes":89922,"encodedBytes":202370,"hashedBytes":90815,"encodedEntries":128,"prefixMs":2.4818280000000073,"equivalenceMs":12.642836999999986}
{"platform":"linux","label":"candidate","count":256,"sample":1,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.241452000000038,"equivalenceMs":64.59295300000002}
{"platform":"linux","label":"candidate","count":256,"sample":2,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.8700380000000223,"equivalenceMs":68.62181299999997}
{"platform":"linux","label":"candidate","count":256,"sample":3,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.7193430000000376,"equivalenceMs":67.68214900000004}
{"platform":"linux","label":"candidate","count":256,"sample":4,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.7266099999999938,"equivalenceMs":66.41539899999998}
{"platform":"linux","label":"candidate","count":256,"sample":5,"exitCode":0,"ledgerBytes":179778,"encodedBytes":404610,"hashedBytes":181567,"encodedEntries":256,"prefixMs":3.180402000000015,"equivalenceMs":63.258605999999986}
Finished with result: success
Main processes terminated with: code=exited/status=0
Service runtime: 14.146s
CPU time consumed: 20.119s
Memory peak: 512.0K
Memory swap peak: 0B

```

</details>



## Tests and retained failures

The host rerun, without assertion changes or resource-limit relaxation, passed **68/68 suites, 1,757 named outputs, zero failed/skipped**, at 2026-10-20T09:10:42.093Z. This is the complete **pre-final-correction** run: continuity67, prefix/preflight37, v2 trust22, security perimeter51, human quorum86 and lifecycle105. Controlled documents separately passed **40 core +29 additional +11 focused**, no live-snapshot mutation. These controlled counts overlap the complete run and are not added to its total. TypeScript, production build, WBS zero-drift check and DMK-196 closure/post-merge, DMK-197 closure and DMK-208 audit CLI checks all passed; historical/current gates remain valid on unchanged pinned WBS with mayApply:false. Historical PR #53's 68/1,726 record remains unchanged.

A fresh read-only agent review raised one P2: suite exit did not propagate prefix-worker errors. End-to-end child-outcome injection reproduced RED for nonzero exit, timeout, missing output and malformed JSON, with a valid zero-exit control. The corrected harness now rejects invalid status/error/result records; **38/38 prefix/preflight checks** and TypeScript passed. This tests the public CLI; its injected worker records are explicitly synthetic controls, never performance evidence. Accepted real prefix evidence was independently checked by the external grid, so it is not invalidated.

An additional negative error-path audit reproduced hashing of an oversized current snapshot when authority acquisition threw. Error metadata now omits that digest above the same snapshot limit, preserving historical validity and rejection. Final **68/68 continuity checks** and TypeScript passed, including durable application-count 255/256/257 coverage. These final changes affect the benchmark supervisor, tests and an acquisition-error branch; measured successful audit/prefix code paths and fixture inputs are unchanged. Final exact-HEAD complete/build/controlled verification is a required GitHub publication gate, recorded in the PR metadata; the earlier host count is not relabeled as final-head CI.

Positive unchanged-baseline, one/multiple applied successors and historical adapter behavior are retained. Negative evidence covers exact byte/link/application/aggregate/depth boundaries; repeated aliases; malformed/deep/duplicate JSON; missing/reordered/replayed chains; signed-but-unapplied intent; raw/semantic/approved-item and Git mismatches; altered statuses/dependencies/root metadata; invalid/revoked/non-human/same-human signatures; stale policy/revocation/freshness; descendant identities; acquisition failure; mutation attempts and non-mutation. Strict parser 2 MiB/5,000 limits remain independently tested. Admission alone never makes invalid evidence valid.

| Captured local evidence | SHA-256 |
| --- | --- |
| complete-results.json | `a17569482b5877a47a0f2c5a46253d11107852a39f7c67f95bffb116a7240ca7` |
| controlled-validation.log | `db09efb6855514c600c304819c04ebfb741cb13ea38c9ed8b0c4fed3a51f54df` |
| green-prefix-failure-propagation.log | `950f3ef668669a792d3325b542d136ce10d145bd8732eb6f3926eb44e033da7e` |
| final-continuity.log | `a1e8ec3eb7f073e5d50d547b4a4c767d338d305ba4ae6b75b709ee50525cc26c` |
| final-typecheck.log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| red-prefix-failure-propagation.log | `c96351ca28b20960a9a475b815d8766219eecac2d8786a9af70a8fe04b72d3c4` |
| red-acquisition-error-budget.log | `83a0bd17594930d384141642ef75f2d8d956a56eeea44b65ebbb1991654074ec` |
| failed-sandbox/complete-results.json | `0da347186b473bce75c07355aa0a14d15f56e4925946ab18c40337c91f33fa2f` |


The initial complete Windows run inside the restricted AppContainer failed: **35/68 suites passed, 33 failed; 916 passed /188 failed observed outputs**. Actual failures include loopback `EACCES` / browser `ERR_NETWORK_ACCESS_DENIED` and temporary-symlink/atomic-rename `EPERM`, synthetic Git HEAD write permission denial and inferred server-readiness failures. No code/assertion was changed in response. The same filesystem suite (34/34) and loopback security integration (7/7) passed outside that sandbox in the disposable clone, isolating the environmental boundary. All failed per-suite logs and summary remain under `artifacts/r11/failed-sandbox`; the authorized host verification is recorded separately below. Windows performance workers ran in the restricted context but use no sockets or symlinks, and all benchmark results remain retained with that environmental qualification.

Initial RED tests demonstrated missing prefix/admission APIs on baseline. A subsequent RED demonstrated that current-resource rejection initially erased historical validity; the candidate now establishes historical validity first. Another RED reproduced acceptance of a hidden accessor property; inert-data admission now rejects it without invocation. Genuine logs are retained. Initial Windows GC/result output interleaving caused missing structured measurements; corrected separate descriptors and rerun results supply the accepted grid. The failed instrumentation run is retained, excluded from success statistics.

Linux setup initially lacked cached matching esbuild binaries and its installer stalled. It was stopped in the disposable clone. Recovery used the exact locked 0.25.12/0.28.2 Linux packages with SHA-512 integrity checked against the unchanged lockfile, an offline script-disabled install, then the original esbuild installation/validation scripts. This changes no source or dependencies and is not a claim that the initial plain offline install passed. GitHub CI separately performs ordinary `npm ci`.

## Review, residual risk and rollback

Source capture precedes signed publication. The draft PR publication record must bind the actual SSH-signed candidate HEAD, GitHub signature validity, all three exact-HEAD jobs and actual jianzhihuoxin review-request event. No human approval or merge is claimed here. The final human review must inspect the corrected candidate, not substitute the earlier PR #53 review. No auto-merge.

The independent reviewer must accept/reject the four new numerical limits and non-JSON acquisition-object compatibility denials, inspect exact serializer equality, consumed-ID PRE-consumption semantics, incomplete/applied evidence denials and measured limitations. A request, agent review, signed commit or green CI is not an APPROVED human review.

Ordinary code rollback requires a separate human integration decision and is safe only while canonical WBS remains pinned `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`. Once a separately authorized successor exists, require a separately reviewed compatible rollback. Never restore old WBS bytes, delete ledger/receipts, relax denials or rewrite receipts to pass verification.

No production policy/root/enrollment, authenticated clock/revocation/provenance provider, descendant proof or atomic remote application/receipt-consumption mechanism is supplied. DMK-209–214 remain unregistered; the 210 →211 →212 →209 dependency sequence remains a proposal. PR #34 and #52, current human-only Security Officer/Lead Architect quorum, 14 privileged-route denials, disabled live agents, Gate 7 and release restrictions remain unchanged. No S2-A implementation or activation is authorized. Stop at independent human review and a separate operator merge decision.

## Retained PR53 closure checkpoint

The exact pre-implementation local checkpoint is retained verbatim below; its SHA-256 is `7080cbaf778e4b40e08c803eb9599acba0e703998d588a717505ea30e65d3eb9`. Statements that implementation was not yet authorized describe its original capture time and are superseded only by the subsequent bounded authorization and this candidate. No chronology, historical hash, timestamp or prior verification result is retroactively changed.

<details><summary>Original closure and proposed next gate (verbatim)</summary>

# PR #53 closure and next governance gate — 2026-10-20

Status: **PR53_POST_MERGE_VERIFIED / REGISTRATION_BLOCKED / NEXT_IMPLEMENTATION_NOT_AUTHORIZED**.

This additive local checkpoint records independently retrieved GitHub evidence and a decision proposal. It does not publish a new PR, ratify policy, enroll signers, consume receipts, register tasks or authorize implementation. Earlier records retain their original capture times and findings. The operator reported the completed manual merge before this verification instruction; the agent did not perform it and does not invent a separate prior merge authorization.

## Verified approval, identity and merge

All local times below are Asia/Taipei on 2026-10-20; original GitHub UTC timestamps are retained.

| Evidence | Independently observed value |
| --- | --- |
| PR | [#53](https://github.com/Jeruzael/docmonstakrakin/pull/53), merged, exact reviewed HEAD `1ab55bafca0db36b69711cfd795a2f35e7c970d6` |
| Original review request | `Jeruzael` requested `jianzhihuoxin` at 14:31:55 (`2026-10-20T06:31:55Z`), event `33715619136` |
| Ready for formal review | 14:59:29 (`2026-10-20T06:59:29Z`), event `33717250673`; six-point [review handoff](https://github.com/Jeruzael/docmonstakrakin/pull/53#issuecomment-6285301143) followed |
| Actual human approval | `jianzhihuoxin`, [review 5582017566](https://github.com/Jeruzael/docmonstakrakin/pull/53#pullrequestreview-5582017566), **APPROVED** exact HEAD above at 15:32:44 (`2026-10-20T07:32:44Z`) |
| Actual merge | `Jeruzael`, 15:34:11 (`2026-10-20T07:34:11Z`), event `33719491374`, [commit `2af6637aa639c18e31795355d68b1454be22f389`](https://github.com/Jeruzael/docmonstakrakin/commit/2af6637aa639c18e31795355d68b1454be22f389) |
| Merge parents | First: `fd2f6e4e1320ad949adee4cb33a51ab612a1cd4e`; second: exact approved `1ab55bafca0db36b69711cfd795a2f35e7c970d6` |
| Resulting tree | `9e7831344b185bbdf2d25d71711dfb78a28e40dd`, identical to the approved feature HEAD tree |
| Signatures | GitHub reports `verified: true`, `reason: valid` for both candidate and actual merge commit; candidate was SSH-signed |
| Actual master at verification | `2af6637aa639c18e31795355d68b1454be22f389` |

Approval precedes merge by 87 seconds and covers the exact merged feature HEAD. This satisfies the visible exact-HEAD review/chronology condition. The review text is brief and does not itemize six separate attestations; no such itemized attestation, real-person/key-custody independence or historical branch-rule audit is invented. GitHub code approval and merge do not ratify ADR-0007, enroll WBS signing humans or establish production trust. The historical DMK-197 procedural qualification remains unresolved.

## Actual post-merge CI and preservation

[Workflow 39387374368](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39387374368) is a **push/master** run with exact `head_sha` `2af6637aa639c18e31795355d68b1454be22f389`. All three job metadata records and checkout logs identify this real merge commit, not the earlier synthetic PR merge. The run began 15:34:14 and completed 15:39:09. Logs report Ubuntu 24.04.5 / Node 22.23.3.

| Job | Result and inspected evidence | Decoded log SHA-256 |
| --- | --- | --- |
| [Quality & Build — 118510334876](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39387374368/job/118510334876) | SUCCESS; WBS zero drift, TypeScript and production build | `27862048185bea0e00dd8559bee3110089e762b9155e227fe533fbb7d82fb35d` |
| [Controlled Docs — 118510334577](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39387374368/job/118510334577) | SUCCESS; 40/40 core + 29/29 additional + 11/11 focused; unchanged synthetic snapshot; repository cleanliness | `9578a199e2d93d19d97b5c4e44366323e0c0461c52b88f227c41db1cd330e0a9` |
| [Complete Regression — 118510334910](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39387374368/job/118510334910) | SUCCESS; **68/68 suites, 1,726 observed named outputs, zero failed/skipped**; repository cleanliness | `69bb0d0529542db85ace35b47a200a8e355acde64e934b3368f3d66c4aa1c468` |

Actual complete logs include continuity 46, DMK-196 closure 19/post-merge 39, DMK-197 closure 27, DMK-208 audit 60, perimeter 51, human quorum 86 and AZ-08 lifecycle 105, all passing. Controlled-document figures overlap the complete suite and are not added to 1,726. No additional local full-regression rerun is claimed: actual exact-merge CI supplies this closure evidence. No application or CI preparation was run against operator state.

The complete recursive trees were retrieved without truncation. Comparing master before #53 (`ceb1ee43a5ac70f0df518579b6f4dd1285d5dd83`) with the merge tree finds exactly the reviewed 15 changed paths. All 45 selected preservation paths match their prior Git blobs, including the original 29 S2-A portfolio files, historical DMK-196/197/208 receipts/candidates/snapshot and current dependency files. Canonical YAML and Markdown blobs also match the local raw bytes:

- YAML SHA-256: `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`; Git blob `7b24876c3ccaae98ad4938c4a4264f2b35cb316a`.
- Markdown SHA-256: `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f`; Git blob `857287d213be07055a8055471235c0d50c34cead`.

Managed external `artifacts/r10` retains raw API evidence, full decoded job logs, tree comparison and a fresh non-applying registration preview. The evidence JSON digest is `311740ada8e5943c9761accdd0cc5d6e60dc8367e88a30f37e8d62091295c78c`. The local checkout remains at reviewed `1ab55ba`, whose tree equals actual master; only this checkpoint and additive state/handoff notes are newly edited locally. No new commit, push or separate PR is needed for this checkpoint. It is available for inclusion in a later separately authorized change.

## Registration prerequisites: present versus missing

| Prerequisite | Present on verified master | Missing before real registration |
| --- | --- | --- |
| V2 cryptographic evidence and historical/current boundary | Strict v2 intent/policy/signature primitives; exact canonical ledger parser/preflight; #53 historical adapters and applied-chain audit; `mayApply:false` | A valid mathematical result is not a transaction authorization. Pure `historicalValid` checks snapshot hash/scope; adapters add original receipt assertions, not complete independent cryptographic/procedural attestation of all legacy history |
| Ratified policy and actual human signers | ADR-0007, role-policy candidate, enrollment/revocation specification, threat model and unchecked ratification checklist | No verified production policy pin, externally administered root, appointed independent WBS signer roster or enrollment/custody ceremony. GitHub reviewer status and Git SSH keys do not establish WBS signing authority. Preserve technical Security Officer + Lead Architect human-only quorum; proposed different two/three-person profiles are not adopted |
| Authenticated provenance, clock and revocation | Context fields, epoch/version/digest constraints, current-checkpoint comparisons and synthetic acquisition callbacks | Production provider/root/witness/clock sources; immutable repository/owner IDs; trusted protected workflow/source; raw evidence size/depth/encoding handling; independent person mapping; bounded time uncertainty/freshness/high-water marks; compromise adjudication and use-time revocation fencing. #53's checks do not authenticate arbitrary callback data |
| Durable application and receipt consumption | Preflight proposes complete ledger bytes and rejects known replay under its supplied snapshot | No deployed authorizer or crash-safe remote transaction/CAS engine; no authoritative canonical ledger/retention-path ratification. Need one protected atomic tree/ref transition containing YAML, rendered Markdown, ledger and raw receipt, exact-base freshness and revocation fences, idempotence, restart reconciliation and independent post-application audit. Local Git CAS or an unconditional push cannot prove remote protected atomicity |
| Applied versus current Git identity | Exact terminal protected commit/tree must equal last applied record | Authenticated descendant semantics are absent: an unrelated later master commit is currently rejected after an application. Need separately reviewed ancestry/object/path proof binding applied commit to current protected tip while preserving WBS, ledger and retained artifacts. An `isDescendant:true` flag, byte match alone or receipt author date is insufficient |
| Resource/capacity acceptance | Ledger parser caps 2 MiB / 5,000 entries; each raw receipt capped 2 MiB | No aggregate proof/WBS/depth budget or representative capacity acceptance. Prefix serialization/hashing and consumed-prefix construction currently repeat per link; quadratic prefix work is visible in source. Full WBS semantic auditing also has input-size cost. No operational capacity claim follows from 46 small synthetic tests |
| Exact revised six-item candidate | Unapplied revised definitions and bytes preserved; fresh preview passes below | PR #34 is still old HEAD `5912185a005df3e0469dd46392d7d0dbb0378b68`, open/unmerged. Its old dependency graph is not the revised candidate. Future base/head/tree/review, exact raw bytes, human intent signatures, authority and governed application require separate approval; no task is registered/completed now |

The old B2b2-A documents contain design-time gap statements. #53 now supplies a conditional full-chain verifier and retained raw/semantic consistency checks, including duplicate-key rejection on its JSON path. This does not establish a production raw transport/acquisition boundary, a trusted historical clock/roster archive or an application engine. No older gap record is rewritten to claim those production properties.

Human decisions remain prior to production activation: ratify exact existing-quorum interpretation and real-person independence, root custody/recovery and policy location, canonical ledger/raw-receipt paths, clock/revocation/compromise semantics, and an effective policy-compliant remote application mechanism. Existing charter responsibility held by one person is not an independently enrolled two-human signing quorum. Do not infer a new appointment or adopt the proposed three-person bootstrap/profile by merging another code PR.

The durable production order is: explicit authority/schema decisions → separately authorized real enrollment/root provisioning → independently reviewed read-only provenance/clock/revocation acquisition and retained historical adjudication → descendant proof/resource acceptance → shadow transaction/recovery proof and effective remote-protection audit → separately authorized exact registration ceremony. Non-applying resource work may be reviewed before real provisioning; it does not skip any later gate.

The transaction design must distinguish: crash before publication (no externally visible change); successful atomic publication followed by a lost acknowledgment (re-read exact protected objects, establish that receipt ID was consumed once, do not reapply); same-base concurrency (at most one protected transition, loser aborts); and inconsistent or unverifiable publication (freeze further authority for investigation). Revalidate exact review/head, policy epoch, revocation and trusted time at the operation fence. Reviewed pre-application tree/signatures and resulting receipt-bearing application commit are separate identities; avoid a receipt or commit that must cryptographically contain its own final hash. Prove these outcomes with synthetic crash/race fixtures before any real writer enablement.

A future descendant proof must bind a trusted current protected tip back to the authenticated applied commit through exact Git parent/tree objects, then show unchanged ratified WBS/ledger/retained-receipt bindings at every intervening step. Reject forks, missing objects, substituted identities and protected-artifact edits. Policy/authority changes still require their own fresh adjudication; matching WBS bytes do not exempt them. No such ancestry acceptance is implemented or authorized by this checkpoint.

## Exact revised registration proposal, still unapplied

A new read-only preview used the unchanged canonical bytes, the preserved proposal definitions and the existing renderer/validator from a disposable clone with identical source. Rendering occurred only in memory; neither canonical file was written. Preview was valid, total items 69 → 75, EPIC-13 scope 27 → 33. This is structural evidence only, `mayApply:false`, with no authority/receipt/signature issued.

| Item | Exact proposed dependencies |
| --- | --- |
| DMK-210 | none |
| DMK-211 | DMK-210 |
| DMK-212 | DMK-210, DMK-211 |
| DMK-209 | DMK-210, DMK-211, DMK-212 |
| DMK-213 | DMK-212 |
| DMK-214 | DMK-209, DMK-211, DMK-212, DMK-213 |

All six remain PROPOSED, preserving full acceptance criteria, parent EPIC-13, requirements and metadata from the [unapplied proposal](../06_planning/s2a-readiness-20261019/governance/registration-proposal.json). The sequence **210 → 211 → 212 → 209** resolves the practical identity/policy/cutover cycle without treating 14 blocked routes as full DMK-209 authorization. DMK-213 branches after 212; 214 waits for its complete dependency set.

- Original PR #34 YAML SHA-256: `e166f4679a71e8cec45ec5e0c5dc60f0b12c8ade0ada4696339662e258132273`.
- Revised proposal YAML SHA-256: `a3d7de535fddd4ad2521335e8f9f333eabe1bde5a67747cf5fb466bb54a88ae9`.
- Fresh in-memory revised generated Markdown SHA-256: `86842f899cd43b089228c7e22ee446c0b85d42009506fa898e02f111ad0a0919`.
- Fresh preview record SHA-256: `7e66cacf3eea6ff5dbe3f9cb9acc19a50296efb3741629b51528fd052d997305`.

These hashes name current proposed bytes, not authorization. The old proposal's master fields remain historical and unchanged. Any future registration review must bind the then-current actual master, reviewed candidate HEAD/tree, rendered bytes, exact six definitions, authority epoch and approval window anew. PR #53 does not make the existing PR #34 merge eligible.

## Alternatives and recommendation

| Path | Benefit | Required authority / cost | Disposition |
| --- | --- | --- | --- |
| **Durable governance registration, staged read-only first** | One accountable historical/forward chain; reusable prerequisites for future tasks; avoids permanent policy exceptions | Human trust ratification/enrollment; authenticated context; bounded audit/descendant semantics; protected crash-safe transactions; exact registration review/ceremony. Several independent gates remain | **Recommended**. Next code slice is bounded audit-resource hardening below, while humans resolve trust choices |
| Explicit disabled synthetic S2-A preparatory exception | Could develop a single isolated synthetic pilot before canonical dependencies are satisfied | Competent human must separately authorize exact scope, unmet prerequisites, owner, dependency versions, acceptance/rollback and expiry. Original proposal: one PR, expires at final human decision or 14 days after authorization, whichever occurs first. Refresh actual baseline first | Not granted. Not required for the recommended verifier work. It neither registers/closes tasks nor fixes production registration trust |
| Combined production broker + writer + registration + S2-A | Appears to compress the schedule | Combines unratified authority, credentials, remote writes and application security in one review; cannot establish independent gates | Reject as the next slice |

The synthetic exception would require production routes to remain unreachable, private-store/KDF/session choices and current Node/platform compatibility to be freshly accepted, and no real identities, grants, migration, certificates or authentication cutover. Existing 34/34 Windows/Linux primitive results and SQLite/Argon2id measurements are retained feasibility results, not fresh application acceptance. The exception JSON remains unsigned with `receipt:null`, no signatures and `s2aImplementationAuthorized:false`. No exception or S2-A code starts here.

## One proposed next implementation PR: bounded non-applying chain audit

**Proposed title:** `perf(wbs): bound proof resources and reuse canonical ledger prefixes`.

This is the smallest next slice on existing code with concrete offline acceptance and no new authority system. It removes avoidable prefix work and measures/bounds proof processing. It does **not** claim to install the missing production adapter, enable descendants or complete registration. A production context adapter or writer should not be disguised as a small follow-up while trust/provider/transaction decisions are unsettled.

Proposed exact eight-path allowlist (not edits made by this task):

1. `scripts/wbsEvidenceContinuity.ts`: early deterministic proof-size/link/depth guards and reuse verified ledger-prefix digests/consumed-prefix storage; preserve denial and trust semantics.
2. `scripts/planWbsRegistrationTransaction.ts`: a canonical v1 prefix-digest encoding helper, used only after unchanged strict parsing; byte format, existing serialization, parser rejection and preview contracts unchanged.
3. `scripts/testWbsEvidenceContinuity.ts`: budget boundaries, unchanged-baseline/history/forward failures, replay and non-mutation tests.
4. `scripts/testPlanWbsRegistrationTransaction.ts`: byte-identical prefix digest equivalence, random/golden ledgers and unchanged parser/replay behavior.
5. New `scripts/benchmarkWbsEvidenceContinuity.ts`: explicit disposable-fixture benchmark entry point; synthetic keys/data, isolated workers, no product routes, credentials, network or canonical writes.
6. New `docs/07_verification/WBS_CONTINUITY_RESOURCE_BOUNDS_CANDIDATE.md`: actual raw benchmark results, failures, environment and limits.
7. `docs/00_control/PROJECT_STATE.md`: additive status only.
8. `docs/00_control/LAST_HANDOFF.md`: additive status only.

No runtime/server, dependency/lock, workflow, v2 signed schema/verifier, canonical WBS, trust/policy/enrollment or historical receipt path is included. Descendant rejection remains unchanged; an independently reviewed later slice must define and test that proof. If implementation needs another path or relaxed assertion, stop for scope approval.

### Proposed security and measurement acceptance — not measured or authorized yet

- Keep existing ledger 2 MiB/5,000 parser limits and raw receipt 2 MiB limit. Proposed stricter consumer limits: **256 links, 2 MiB per WBS snapshot, 64 MiB aggregate logical proof bytes and JSON nesting depth 64**. Count repeated references as logical bytes; include historical/current/link bytes, receipts and serialized authority/policy context. Validate these limits before expensive decoding/normalization. Oversized/too-deep evidence returns explicit REJECTED with `mayApply:false`; never truncate history, skip links or create a new genesis. These are proposed technical budgets for human acceptance, not present production policy.
- For every canonical prefix, new digest must equal SHA-256 of the existing full v1 serializer over that exact prefix, including genesis. Encode each entry once and use copied streaming hash state plus the exact closing framing. Structural target: total prefix-encoding/hash input at most **4 × ledger bytes + 4 KiB**; record actual work counters. Do not weaken canonical serialization or recompute stored historical hashes.
- Reuse an append-only in-memory consumed-ID prefix where compatible with the unchanged synchronous v2 contract. Its membership scans and growing WBS semantic checks can still contribute superlinear total work. Do not claim the entire audit is linear because prefix encoding is improved; no v2 replay/quorum relaxation is allowed.
- Test limit−1/limit/limit+1 for each bound, valid unchanged baseline, valid one/multiple links, malformed/deep/duplicate JSON, missing/reordered/replayed chains, signed-but-unapplied intent, raw/semantic/Git mismatches, stale trust/revocation and unchanged denials for later descendants. Both acceptance and rejection must preserve input bytes, receipts, ledger and runtime.
- Separate reproducible Windows and Linux synthetic benchmark grids **1, 8, 32, 128, 256** links with five fresh-process samples per size. Record input bytes, prefix work, wall time, peak RSS and host/Node/load information; retain every failure. Linux reference quota: 2 CPU/1 GiB. Proposed max admitted-chain targets: p95 ≤30 s and total peak RSS ≤512 MiB; each worker has a 60 s watchdog. These are proposed candidate ceilings, not achieved measurements or operational service budgets. Never loosen them or reduce the fixture to claim a pass without renewed decision.
- Run WBS integrity, TypeScript/build, complete regression, security/quorum and controlled documents in disposable clones. Preserve current 68-suite/1,726-output historical checkpoint; added tests get fresh observed counts rather than rewriting old evidence. Publish one SSH-signed draft only after separate implementation authorization; verify GitHub signature/all three exact-HEAD jobs and request independent `jianzhihuoxin` security/governance review. No automatic merge.

Rollback: ordinary code revert after separate approval only while current WBS remains pinned 53050b92. If an authorized successor exists later, require separately reviewed compatibility rollback. Never restore an old WBS, delete receipts/ledger or bypass resource denials to obtain green verification. No credential/state migration is part of the proposed slice.

## Exact next operator decision

Approve or revise the proposed eight-path **verifier-resource candidate only**, including the numerical test budgets above. Suggested bounded authorization:

> Authorize one non-applying WBS proof-resource/prefix-performance code/test candidate from freshly reverified master `2af6637aa639c18e31795355d68b1454be22f389`, limited to the eight paths and acceptance/rollback contract above. Use disposable clones, synthetic identities and offline benchmarks; preserve all signed formats, human-only Security Officer/Lead Architect quorum, historical/current proof semantics and descendant rejection. Permit signed draft publication, exact-HEAD CI and independent human review; stop before merge. No production trust adapter/activation, policy ratification or enrollment, writer/receipt consumption, PR #34 registration, S2-A, privileged activation, agents, Gate 7 or release changes.

That authorization has **not** been given by this checkpoint or PR #53's approval/merge. Separately assign competent humans to resolve the trust/authority checklist; no new signer or policy is created by a code authorization. PR #52 remains open as a separate unchanged archival draft at `89b1527f75dfdd69a3e49bda752b64d4edd70a54`.

Stop at this operator decision. Fourteen privileged registrations remain denied, live agents disabled, Gate 7 unexecuted and release unpromoted; general application authorization remains incomplete and ordinary status remains unauthenticated.

</details>
