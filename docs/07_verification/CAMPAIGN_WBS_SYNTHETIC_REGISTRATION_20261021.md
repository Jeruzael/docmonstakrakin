# Workstream C — synthetic registration verification

Starting master: `148be8892b37aaf1944aca0c0671b6a948192f38`. This is a non-activating code/test candidate under the Autonomous Completion Campaign. It is not a human appointment, policy ratification, operational registration receipt or production-readiness attestation.

## Exact candidate inventory

| Path | Purpose |
| --- | --- |
| `scripts/lib/syntheticWbsRegistration.ts` | TESTONLY pinned acquisition, signed provenance, ordinary/elevated composition and non-applying preview |
| `scripts/lib/syntheticWbsTransaction.ts` | Private disposable SQLite atomic snapshots, consumption, replay, idempotency, protected CAS and recovery |
| `scripts/lib/syntheticWbsGit.ts` | Bounded raw Git object and unchanged first-parent descendant proof |
| `scripts/fixtures/syntheticWbsCeremony.ts` | Ephemeral public-root/person/clock/witness/receipt fixtures; private keys never retained |
| `scripts/fixtures/syntheticWbsCrashWorker.ts` | Actual child-process exits and coordinator concurrency fixtures |
| `scripts/testSyntheticWbsRegistration.ts` | Positive, negative, actual filesystem/Git, replay, concurrency and crash tests; automatic full-run discovery |
| `.github/workflows/ci.yml` | Run this focused qualification after both fresh Windows npm and Bun installations; retain the four existing jobs |
| `docs/06_planning/CAMPAIGN_WBS_SYNTHETIC_REGISTRATION_CONTRACT.md` | Exact boundary, resource/compatibility constraints, rollback and pending human decisions |
| `docs/07_verification/CAMPAIGN_WBS_SYNTHETIC_REGISTRATION_20261021.md` | This additive evidence record |

The exact inventory is nine paths. No dependencies, lockfiles, normal server routes, runtime, canonical WBS, historical receipts or original portfolio files are changed. The only CI additions are the two fail-fast Windows focused invocations above. No production source imports the new modules.

## Verification evidence

Final-source focused command on Windows NT 10.0.26300.0 / Node 22.21.1 x64:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testSyntheticWbsRegistration.ts
56 named compound checks passed, 0 failed
```

The checks use actual Ed25519 signatures, private synthetic SQLite databases and real disposable Git objects. Ordinary and elevated proofs pass only with their exact distinct-person/profile assertions. Tests cover untrusted/missing roots, person reuse, AGENT claims, revoked keys, epoch/predecessor/freshness rollback, nonce/receipt replay, stale state, canonical duplicate keys/Base64, malformed/oversized evidence, signed-but-unapplied intent, raw acquisition/Git accessors, caller Buffer mutation, final revocation drift, duplicate idempotency keys, retained raw before/after snapshots, audit tampering, actual directory replacement, dangling native database links and fixture marker links. They do not prove that fixture people are real independent humans.

Two coordinator processes compete for one protected fixture revision; exactly one commits, while the other receives bounded lock/CAS rejection. Actual child-process exits at AFTER_BEGIN, AFTER_STATE, AFTER_RECEIPT, BEFORE_COMMIT and AFTER_COMMIT prove durable all-or-nothing recovery. These are process-crash tests, not power-loss or device durability certification. The actual offline Git ceremony binds a reviewed receipt, precreated application object, committed fixture consumption and later unchanged Git descendants. It performs no protected remote-ref update.

The executing fixture loaded `better-sqlite3` **13.0.3**, SQLite **3.53.4**, with actual Windows binary SHA-256 `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a`. Runtime provenance verified WAL, FULL=2, busy timeout 100 ms, max page count 16384 and 4096-byte pages. This is retained qualified fixture-runtime evidence, not a fresh dependency installation. Both committed lockfiles and declarations remain unchanged; clean Windows/Linux installation qualification belongs to the separate compatibility workstream and required GitHub checks.

### Fixed small-proof measurement

One final-source focused Windows run used eight successive elevated policy epochs with actual signatures and committed fixture consumption. Final WBS was 76,833 bytes; ledger 5,755 bytes. Per-commit samples in milliseconds:

```json
[164.7047,157.2828,164.0266,166.7442,175.6645,175.6998,195.2706,157.8241]
```

p50 **164.7047 ms**, p95/max **195.2706 ms** for this eight-sample profile. Process RSS was 152,031,232 bytes before and 165,101,568 bytes after; end heap used 60,555,120 bytes. Node-reported `maxRSS` was 162208. CPU delta was 1,593,000 user / 203,000 system microseconds. These are observations from a process that also ran the other focused cases, not isolated process-tree peak memory or production capacity. Earlier contested-host runs ranged from p50 177.0738–273.7894 ms and p95 250.5341–317.3029 ms; they are preserved as environmental variability, not substituted by the faster run. Worst-case admitted proof/resource acceptance remains pending human review.

### Final serial gates

Final serial run, completed `2026-10-21T08:44:39.257Z`:

| Gate | Actual outcome |
| --- | --- |
| Focused synthetic registration | 56/56 named checks, exit 0 |
| `npm run ci:quality` | WBS integrity, TypeScript and production build passed; existing bundle-size advisory retained |
| `npm run ci:controlled-docs` | 40/40 core, 29/29 additional, 11/11 focused (332 assertions); live snapshot mutation NONE |
| `npm run ci:regression` | **72/72 suites, 1,960/1,960 reported checks, 0 failed, 0 skipped**, exit 0 |
| Protected evidence | Every full-run `changedEvidence` list empty; canonical and historical blobs unchanged |

The final full run included security perimeter 51, native foundations 35, trusted registration v2 22, status-audit receipt 60 and the new governance 56. Its observed counting convention remains named output lines/compound checks, not an invented count of individual Node assertions. All four actual GitHub CI jobs and independent human review must still be verified on the exact published signed HEAD; local green does not predeclare future CI or approval.

Final raw evidence SHA-256:

| Artifact | SHA-256 |
| --- | --- |
| Quality | `3ab0dec7236805d0c2ec358d48adac951fcd88cbc1eb55ec0106d26a6463091f` |
| Controlled docs | `8d39cf05698ab28c36b755f78106cd6cd93684789bc4646cb7fdd52082dc0df1` |
| Complete regression | `acfec0f26c9e2ccfb91566ac387bd51327097e3b1297f0dcf1a075a5dde6dfc1` |
| Focused | `03554e1fe07a9af8abe908519d534544e0479d21c4f73d55abe07c9f70bfd21d` |
| Full results JSON | `96f628b3f0052b56c644dd76e5657710afb33947b297ea88c69d636637b5be59` |

## Genuine initial failures and corrections

- Acceptance RED: no trusted synthetic API, then ordinary/elevated proofs rejected until composition existed; no durable transaction/Git entrypoints until implemented.
- An implementation SQL placeholder error produced `operations has 10 columns but 11 values were supplied`; fixed the explicit binding count without weakening assertions. Current insertion names every column, including retained snapshots.
- Valid noncanonical Base64 pad bits were accepted by the first acquisition signature check. Decode/reencode equality now rejects the same cryptographically valid bytes in a noncanonical representation.
- A durable authority floor without a stored predecessor initially accepted a missing historical envelope link. Exact persisted predecessor identity now rejects it.
- Revocation between preflight and commit initially went unchecked; final signed acquisition revalidation under the local SQLite transaction now rejects drift. Input Buffers are snapshotted so caller mutation cannot rewrite committed evidence.
- Raw acquisition/Git metadata getters initially executed. Exact inert descriptor admission now rejects them without execution.
- Acquisition expiry initially failed to account for the signed clock uncertainty interval. Expiry inside that interval now rejects.
- Actual root substitution before the original identity capture adopted a replacement directory. Lexical root plus exact BigInt parent/root identities are now pinned before provisioning, and replaced targets survive failure cleanup.
- `existsSync` ignored a dangling native database symlink. A real Windows test showed a new test-owned outside-root SQLite file was created before later rejection. Direct `lstat` admission now rejects dangling links before native open; the outside test file was removed after verified temp-contained cleanup.
- A linked Git fixture marker initially passed. Descriptor/native-path/size admission and bounded opened-file identity checks now reject marker links before target reads. Owner markers likewise use fixed bounded descriptor reads.

The first concurrent campaign full run failed **4 of 72 suites**, with **1,778 passed / 4 failed / 0 skipped** reported checks. Failures were `testAccountProvisioning.ts` (Windows PowerShell Security module autoload), `testControlledDocVersionSync.ts` (shared port 5173), `testControlledDocs.ts` (focused view shared port 5173), and `testStatusAuditReceipt.ts` (child fatal `out of memory: Zone`, followed by `Pinned earlier historical Git bytes unavailable`). The new governance suite passed its then-current 50 checks. No historical assertion or port/process protection was weakened. Subsequent validation uses a coordinated exclusive heavy-test window and WindowsPowerShell module path; unrelated listeners/processes are not killed.

An additional preexisting reporting weakness was observed in the **unchanged** `testRequirementSignoff.ts`: its Playwright catch only logs an error, so the contested initial run reported that suite PASSED with 8 named checks while the serial run executed all 15. The unchanged file's Git blob is `b5296dab786b0dcf20cac3d4fe80ca5d0b440718`. This candidate neither hides that incomplete initial browser coverage nor calls it a canonical/historical failure. The separate product-verification workstream is responsible for making setup errors and missing scenarios fail explicitly; no historical result is rewritten here.

Initial report/raw-log SHA-256 digests, preserved before any rerun:

| Artifact | SHA-256 |
| --- | --- |
| Initial full results JSON | `5593c74fec6526cd338597417da3d6fd719d5cca5bc9b53dfed2c47f5e63ade4` |
| Account provisioning failure | `df3d9f05baa79ba79631e64204b56cae256cba75561da59c66866f5a1673bf1a` |
| Controlled-document failure | `4f75e9921da04ba074a9827d4cd1b412d221b49cd8f7e9cf7c8d284813e64f36` |
| Controlled version-sync failure | `4efd4f08696b03689ebdfbf3e707b64ce3de27ba3e6546adaadd60a9da94ab08` |
| Status audit/OOM failure | `489cf917acf4d7bd403f4e92bbc17bb2ed8a4efd32a222f9a633066e6d5f0ba5` |
| Actual pre-pin replacement RED | `c4c31b26c09a59156ebb5b874b1e8e0e0e7f82b16950b7e78b557b26384c9ba5` |
| Raw acquisition getter RED | `0958b8082c491c43ebb23d1ef1718b8ebbc6e82b8a6d2458c380a51295e8d410` |
| Dangling native database path RED | `ad21187365b334ce62cd01e6fffdfc4454a687d8c66c14e2cc2aa355ff1b41ac` |

Tests and the exact commands above reproduce the acceptance claims from a normal checkout; temporary artifacts are supplementary rather than the only specification/evidence. The raw initial campaign logs remain retained locally for audit and publication supplements.

Fourteen original failure/RED artifacts are also retained without byte changes in a persistent gzip JSON bundle (each entry contains its original filename, byte length, SHA-256 and Base64 bytes). Bundle SHA-256: `607061a2b24ae59b2e993097946984fc38a122005457a013bb471bf2c31b8693`. This supplements the public executable tests and evidence, rather than requiring inaccessible temporary artifacts to understand or reproduce the candidate.

## Protected evidence and remaining decisions

Canonical YAML and pinned historical snapshot still share SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d` / Git blob `7b24876c3ccaae98ad4938c4a4264f2b35cb316a`. Canonical Markdown remains SHA-256 `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f` / Git blob `857287d213be07055a8055471235c0d50c34cead`. Existing historical verification preserves the original 27-item scope.

Independent human review remains required for this candidate's exact signed HEAD and all resource/compatibility choices. No real Lead Architect, Independent Human Approver, root/checkpoint witness, enrollment verifier or recovery custodian is appointed: all are **PENDING** in the [decision package](../06_planning/CAMPAIGN_WBS_SYNTHETIC_REGISTRATION_CONTRACT.md). Gio's existing charter responsibilities do not provide a second person.

Remaining engineering/human gates include production authority acquisition, person enrollment/custody, policy/revocation/time ratification, external rollback anchors, full historical cryptographic/as-of attestation, protected remote-ref atomicity, recovery/root rotation, full-DAG ancestry and worst-case capacity. `snapshot()` only proves local hash consistency; it cannot resist coherent database rollback or coordinated same-account rewriting. A code review/merge is not operational authority.

No PR #34/#52 merge, canonical WBS registration, real receipt consumption, trust/bootstrap enrollment, privileged route, live agent, Gate 7 or release action is included. Rollback is a reviewed revert of this additive, disconnected code/test/docs candidate; never erase real consumed evidence or downgrade quorum to make a future verifier pass.
