# S2-A synthetic foundations: bounded development record

This additive record covers one disconnected code/test candidate under the operator's fast-track instruction. It is not cryptographic WBS sign-off, human-role appointment, production policy ratification, task registration or authentication activation. Historical proposals and receipts retain their original status.

## Authority and baseline

The attributable operator instruction is the fast-track request supplied in this chat on 2026-10-21. Its attached source SHA-256 is `c10312cead9e08ce3cc4bf89dcd1af848793281b1c83b2019b1e13b35a63705c`. The agent observed and processed that instruction on 2026-10-21; an exact human-message submission timestamp has not been independently acquired.

The development exception ends at the final human decision on its single implementation PR, or **2026-11-04T00:00:00Z**, whichever comes first. The date-based cutoff is conservative: it is earlier than fourteen days after the observed instruction. Expiry authorizes no cleanup of evidence and no operational action. A future extension requires a new attributable operator decision.

Verified starting master: `5d10299cc0aa6f93b4f2861bf1bdd5167cbfba09`, the PR #56 merge. Its parents are `06f6efaa4229fc593abc5765bdcdac1ea4bfec3d` and reviewed HEAD `e7f094a20ce8a6d992b69e7c6768d4109944d020`. Its tree `4307d814c88604c0bb79188417d9a80d1d1f11e8` equals the reviewed tree; GitHub verifies the merge signature. Independent human approval preceded the ordinary GitHub merge, which the agent invoked under this explicit operator authorization using the expected-head guard. This was not a fabricated manual human merge.

[Actual post-merge CI 39534416134](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39534416134) passed all three jobs on that exact merge: 69/69 suites and 1,856 reported checks, with controlled documents 40/40 core, 29/29 additional and 11/11 focused. The original 88 focused envelope passes versus 87 runner-counted outputs qualification remains intact.

## Implementation boundary

New modules live under `server/security/syntheticFoundations/`; one discovered regression entrypoint lives at `scripts/testSyntheticSecurityFoundations.ts`. Dependency declarations and both lockfiles carry exact development-only candidates `better-sqlite3@13.0.3` and `argon2@0.45.1`. No production module imports these foundations. The public factory is disabled by default; importing it or supplying ambient environment variables must create no store, worker, KDF work or authority.

An explicit fixture invocation may use only a fresh private disposable temporary directory. It must not accept an operator database, arbitrary SQL, caller-selected native binding, external key, certificate, live identity, production grant or HTTP registration. Synthetic human and non-human principals are fixture assertions, not enrolled human identities or governance roles.

The SQLite connection belongs to one worker. Commands are fixed, validated and parameterized; WAL, FULL synchronization, foreign keys, a versioned schema and 100 ms busy timeout are checked. Mutations and their sanitized audit append commit together. Unknown commands/schema, corruption, unavailable worker, transaction failure and unsupported platform fail closed without an in-memory or anonymous fallback.

The password profile is Argon2id v19, memoryCost 32768 KiB, timeCost 3, parallelism 1, 32-byte output and 16 random salt bytes. Canonical PHC type/version/parameters/base64/length validation precedes native verification. The pinned package serializes parameters as `m,p,t`; the validator uses that exact order. Hash and verify share per-verifier admission of at most two active operations and four queued operations, with a 2,000 ms queue timeout and 1,024-byte UTF-8 password limit. This bounds one fixture instance, not all independently created instances or total process memory. A canceled response cannot release an active slot while native work is still running. There is no weaker KDF fallback.

Opaque session tokens contain 32 random bytes; only a SHA-256 digest reaches storage and worker messages. Rotation invalidates the old token atomically and retains the original absolute expiry. Synthetic parameters are ten minutes idle and thirty minutes absolute expiry, with equality expired. Revocation, disabled identity, credential/policy revision, worker restart generation and time rollback deny acceptance.

Central policy defaults deny for unknown identities/actions/resources, stale revisions, absent authority and missing matching permission. Explicit deny wins. A session alone grants no resource access. Non-human principals cannot satisfy a human-only fixture action; no Security Officer/Lead Architect quorum mapping or display-name inference is implemented.

Audit events have fixed sanitized fields, deterministic serialization and a checked hash chain. Passwords, PHC values, session tokens and session digests must not appear in audits or errors. This local fixture audit is not authenticated production application evidence or a substitute for the WBS trust adapter.

Fixture admission also bounds RPCs to eight primitive fields, 8 KiB serialized size, 1,024-character string fields and sixteen in-flight calls. Persistent cardinality limits are 128 principals, 128 resources, 512 rules, 256 sessions and 4,096 audit entries. Capacity rejection does not silently evict records, truncate an audit or grant access. These finite fixture limits require human review before any different operational design; they are not production retention policy.

## Dependency and platform evidence

Both exact pins are development dependencies. Existing npm package records remain unchanged, including Vite 6.4.4 and source-map-js 1.2.2. The npm lock adds nineteen records: thirteen in the native dependency closure and six optional nested WASM resolver records. The Bun lock adds only the native dependency closure; no prior package version is upgraded. Baseline and updated-lock npm audits reported zero findings. Audit absence does not establish native-library safety or production suitability.

Registry package integrity is pinned by both managers:

- `better-sqlite3@13.0.3`: `sha512-RbOBxmLBG8uvFUc15X9+9SFemKcQ0WBuISBVkpuiaUB2qblC8UWlHEjdWVoZ8AdhSwmoEgsiXKfopX0CQxaACQ==`.
- `argon2@0.45.1`: `sha512-skm+/WCjkGqCQxF7FG1LuZXM5yvbFjgbfiCGsud2oLgaDhh6b6dbH0b1EkghbM+xx4Bj8Ape+KKgixoIlWZicQ==`.

Ordinary fresh Windows `npm ci` and Bun 1.4.2 frozen installation both failed implicit SQLite node-gyp compilation because the Windows SDK is absent. Python 3.11.9 and VS2026/v145 C++ core were detected. No global SDK was installed and no lifecycle script was disabled to manufacture installer success. Original installer logs are retained.

Separately qualified runtime tests used the integrity-pinned packaged files retained by the failed installation, with Node 22.21.1 on Windows x64. The actual loader imported SQLite 3.53.4 from the package prebuild (SHA-256 `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a`) and Argon2 0.45.1 from its package prebuild (SHA-256 `7d1716c8eafe32d54a12af5c0d3024cd715a7e1fdc8092eea84fd369d267075c`). Runtime success is not a successful clean Windows install. A clean Linux npm installation, actual binary provenance and exact-head hosted jobs are separate publication requirements.

The SQLite connection uses fixed SQL and accepts no database import, arbitrary statement or extension loading. Embedded native-library advisories, platform support and package provenance remain review obligations beyond JavaScript audit output. Only tested Node 22 x64 Windows/Linux targets are candidate-supported; no 32-bit compatibility or production capacity is claimed.

## Acceptance and execution evidence

- [x] Default-disabled/no-side-effect, strict fixture ownership and malformed worker-input negatives; original missing-module RED evidence is retained.
- [x] Actual SQLite worker transactions, paired mutation/audit rollback, reopen, unsupported schema, corruption, busy writer and worker-death failures without operational data. Real read-only volumes, disk-full and crash-mid-transaction durability are **not measured** by this candidate.
- [x] Real pinned Argon2id success/failure and hostile PHC rejection before any native call.
- [x] Shared two-active/four-queued admission, overload, queue timeout/abort, active cancellation and native-failure cleanup with deterministic inert controls.
- [x] Session boundary expiry, rotation/replay, revocation, credential/policy/disabled/restart changes and raw-secret omission from database sidecars.
- [x] Exact principal/action/resource matching, human/non-human separation and deterministic/tamper-negative audits. Detecting audit-tail truncation requires an independently retained head anchor; startup's internal consistency check does not supply that anchor.
- [x] Attempt ordinary fresh npm/Bun installation and preserve both Windows SDK failures; audit before/updated-lock results are zero. Record actual native binary paths/digests and embedded SQLite version separately from installer success.
- [x] Final focused corrected source: **35/35** checks, TypeScript and production build pass in the qualified Windows runtime environment. Final full Windows gates also pass: **70/70 suites and 1,891/1,891 reported checks**, zero failures/skips; WBS integrity; controlled documents **40/40 core, 29/29 additional, 11/11 focused** (332 measured assertions), state unchanged. These full gates retain the failed-install qualification above.
- [x] Publish the single signed [draft PR #58](https://github.com/Jeruzael/docmonstakrakin/pull/58), initial code/evidence commit `c83a5398042c15d8bdf8cc177b60765ec2147d96`, GitHub signature valid. The follow-up publication checkpoint edits only these two new Markdown records; tested code remains byte-identical.
- [ ] Complete exact-final-head Linux fresh installation and all three hosted jobs, then request independent human review. Results and review chronology belong in the PR verification record; this committed document cannot predeclare its own future CI result. A request must not be represented as approval.

A fresh agent security review found two concrete defects before publication: observed expiry could reverse after clock rollback, and concurrent restarts could create an untracked second worker. Executable RED/GREEN evidence is retained. The corrected worker keeps persistent and volatile clock maxima; the latter survives SQLite rollback if a paired authorization audit fails. The failed transaction still preserves exact persisted-state rollback, while later acceptance cannot reverse the observation. Replacing the worker invalidates preceding session generations. Lifecycle transitions reject overlaps, close reserves and joins cleanup, and pending callbacks are bound to their exact worker. A child-process test requires natural code-zero exit, completed cleanup and no surviving worker within twelve seconds. The original reviewer confirmed both findings addressed in a scoped source re-review; this is agent review, not human approval.

Observed combined Windows samples for one hash plus two real verification operations were **169.274 ms** in the initial 30-check pass, **171.555 ms** in the interim 34-check pass and **173.590 ms** in the final 35-check pass. These are separate single samples, not a latency distribution, process-memory measurement or capacity claim. Earlier genuine failures include an assumed PHC parameter order, AppContainer ACL access, the two initial review findings and the audit-failure/clock-rollback composition; none is substituted with an invented successful installer or weakened assertion.

Retained final Windows evidence SHA-256: quality log `fb320de6ad3baf3c9172da987fe30cc99cd93a26c3d9218c7548d5aa442f823f`; controlled-document log `cdc6b48ef73751572e362a400099933edcf097aaefe731763fc47dc36f453766`; full regression log `377c7be13553cbfa405ff04dfa0d3041e74863613aae97259e57ca2f4609d52d`; result JSON `b79d5273c3ba40c86efa92c9fb587228a4025180e9266d1624e532299d082b4d`. The eleven-file tested-source hash manifest is `0c5ec3f5901a4b466c1d817e86bb7c9b2b06688b7c06fc544d8ace4bd66ff636`. Hosted exact-head logs must be inspected independently after publication; this document does not predeclare their result.

These profile values and any additional admission bounds are **synthetic fixture parameters**, not ratified operational limits. Measurements describe the tested fixture and environment, not production capacity. Native support claims are restricted to actually verified Node 22 x64 Windows/Linux environments. SQLite's current advisory/release history and packaged binary provenance remain part of the human security review.

## Rollback and exclusions

Final review/qualification supplement: [FAST_TRACK_FINAL_GATE_20261021.md](../07_verification/FAST_TRACK_FINAL_GATE_20261021.md). PR #58 has left draft state. A bounded added Windows CI job qualifies fresh npm and frozen Bun installations on an already provisioned hosted SDK image; it does not install an operator SDK, change versions or relax SQLite checks. The configured fixture passes with an unaliased job-owned TEMP, while default short-name TEMP compatibility remains unresolved. Bun's existing blocked protobufjs postinstall prevents an all-dependency-lifecycle claim. The disposable combined candidate preflight passed 71 suites / 1,904 checks, distinct from actual master integration. Final CI/review must cover the later signed handoff HEAD; this supplement does not substitute for either.

Before integration, leave a failed candidate unmerged and preserve evidence. The default remains disabled; there is no operational cutover to reverse. Any future code revert or operational use needs its own authorized decision. Do not enroll or migrate real users, create real grants, bootstrap/recover operator authority, install certificates, expose a public listener, consume WBS receipts or change trust roots.

Existing server authentication and all protected routes, project/user stores, human quorum, canonical WBS and historical evidence remain unchanged. All 14 privileged API registrations stay blocked, live agents stay disabled, Gate 7 remains unexecuted and release remains blocked. PR #34 and archival PR #52 receive no merge or modification authority from this exception.
