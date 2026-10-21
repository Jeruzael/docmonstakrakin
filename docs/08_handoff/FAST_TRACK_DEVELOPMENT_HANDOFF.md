# Subscription-independent development handoff

## Latest integration hold — PR #59 merged; CI guard correction required

Current signed master is **`3705f67b2be4c0506a0933ee6c8d6976b0edda9c`**. The last fully accepted baseline remains **`148be8892b37aaf1944aca0c0671b6a948192f38`** until the newly found CI qualification defect is resolved. This section supersedes the preparation-time current-state claims below without rewriting them.

`jianzhihuoxin` [approved PR #59 exact HEAD `fe638ab3b536324c4b9a6e5532db4446b42b870f`](https://github.com/Jeruzael/docmonstakrakin/pull/59#pullrequestreview-5597514916) at **2026-10-21T09:19:13Z**. After four reported-successful checks, zero review threads and clean mergeability, the agent invoked one ordinary expected-HEAD protected merge at **09:45:04Z** under the standing authorization; GitHub records actor `Jeruzael`. Actual merge parents are `148be8892b37aaf1944aca0c0671b6a948192f38` and that reviewed HEAD, signature valid, reviewed/merged tree **`a3282aebc1305e374dfcb8e6960250f298a5b4d2`**, exactly eight authorized paths. No other campaign PR is merged at preparation of this supplement.

[Actual master CI 39579372748](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39579372748) reports four successful jobs: Windows119152871279, Regression119152871722, Quality119152871750, Controlled119152871929. Actual logs report **72/72 suites, 1,911/1,911 checks**, controlled40/29/11(332), Windows fresh npm/Bun native35/path7 each, audit0. **Qualification failed despite provider-green status:** the Linux Bun lifecycle guard called missing `rg` inside an `if` pipeline, which treated tool failure as no match. The post-merge Quality log records `rg: command not found` at **09:45:43.7292154Z**, raw SHA256 **`1a6bd1bbd90e3fc8d5f07cd63f3d76381331795d7d056e8dca5f8e8269f89cd8`**. The manual inventory and subsequent native tests do not establish execution of that guard. [Public failure/chronology checkpoint](https://github.com/Jeruzael/docmonstakrakin/pull/59#issuecomment-6313053678) and [completed job evidence](https://github.com/Jeruzael/docmonstakrakin/pull/59#issuecomment-6313131511) preserve the original truth.

**Further master integrations are stopped.** A seventh bounded development candidate, branch `codex/campaign-bun-lifecycle-guard`, replaces the external-tool dependency with a shared dependency-free Node guard, subprocess positive/negative tests, Windows/Linux calls and a directly related failure/rollback record. Its eventual signed HEAD, CI and independent human review must be verified on the [PR #59 follow-up thread](https://github.com/Jeruzael/docmonstakrakin/pull/59) and current campaign PRs. No automatic revert, force push, package upgrade, lifecycle trust expansion or production change is authorized by this correction.

PR #60 also has [actual APPROVED review5597545070](https://github.com/Jeruzael/docmonstakrakin/pull/60#pullrequestreview-5597545070), covering exact `65af90b57c84188b63809ee282d6f36fd72da88f` at **2026-10-21T09:21:45Z**. Preserve that exact historical approval. It cannot authorize a changed reconciliation HEAD, clear the integration hold or replace renewed checks/review after necessary changes. #61/#62 human reviews remain pending. #63 and #64 remain separate stacked candidates; the latter inherited the missing-guard defect and remains draft pending correction/requalification. Recheck actual GitHub dispositions rather than treating this snapshot as a future approval.

The signed [combined source `7c31fb3`](https://github.com/Jeruzael/docmonstakrakin/tree/7c31fb3b2899ba65c1551eb456df6d3fc526b5b1), tree **`1c3e8d304fde7c7ef24ab7935ac4caee6fbba292`**, normally composes all six original candidate heads without integrating master. Sequential local WBS/TypeScript/build, controlled40/29/11(332) and **81/81 suites, 2,074/2,074 checks** passed on portable Node22.23.3 from **09:43:26.2316006Z–09:52:59.6615453Z**. The complete tracked-source manifest SHA256 was identical before/after: **`c2c07f8c5a80a92c68b402f1f6c4eaa426be1db40adb9635e75f8af4ab556871`**. [Committed summary and raw/published log digests](../07_verification/campaign-combined-evidence/summary-7c31fb3.json) and adjacent logs make the evidence usable from normal GitHub/checkout access. This Windows retained-package application preflight does **not** execute or excuse the faulty Linux guard, establish clean host installation, post-merge verification or operational readiness. The correction's new tests/CI remain separate until actually verified.

## Campaign continuation checkpoint — 2026-10-21

This additive checkpoint supersedes earlier current-state descriptions while preserving every historical snapshot below. Last verified master is **`148be8892b37aaf1944aca0c0671b6a948192f38`**. No campaign candidate is merged at preparation of this checkpoint. Recheck GitHub before using any recorded review or CI state.

PR #58 closed after `jianzhihuoxin` [approved exact HEAD `d4dc8908370300301c48beb9010a2ffd0ddf0d3d`](https://github.com/Jeruzael/docmonstakrakin/pull/58#pullrequestreview-5595940588) at **2026-10-21T06:51:23Z**. The agent invoked one ordinary guarded merge under operator authorization at **07:04:27Z**; GitHub records actor `Jeruzael`. This was not a manual human merge. Merge `148be8892b37aaf1944aca0c0671b6a948192f38` has parents `c729df39cbdfe292287b9344b060e7d4022c2eae` and that reviewed HEAD, valid GitHub signature and identical reviewed/merged tree **`e055ae011b3aeb5d7e5e7c056b5e2b6649d07642`**. [Actual master CI 39559475919](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39559475919) passed four jobs, **71/71 suites and 1,904/1,904 reported checks**, controlled documents **40/40 core, 29/29 additional, 11/11 focused (332 assertions)**, Windows npm/Bun native **35/35 each**, audit zero. [Public closure evidence](https://github.com/Jeruzael/docmonstakrakin/pull/58#issuecomment-6310296597) preserves the exact chronology.

The earlier two-PR permission is exhausted. The new [standing campaign authorization](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-windows-compat/docs/06_planning/AUTONOMOUS_CAMPAIGN_AUTHORIZATION_20261021.md) permits up to **eight scoped development PRs**, until completion, an unresolvable gate or **2026-11-04T00:00:00Z**. Routine engineering and eligible ordinary protected merges require no repeated operator permission. **Every final signed HEAD still requires an actual independent human APPROVED review, successful exact-HEAD CI, no blocking threads, clean permitted mergeability and a freshly verified master.** Each merge requires actual post-merge CI before another integration. Agent reviews and synthetic governance signatures are not human GitHub approval or operational authority. Administrative branch-rule reads returned 403; ordinary protected endpoints enforce policy, and no administrative rules audit is claimed.

### Published engineering and review dependencies

| Candidate | Exact published HEAD / scope | Actual candidate evidence and next gate |
|---|---|---|
| [#59 Windows compatibility](https://github.com/Jeruzael/docmonstakrakin/pull/59) | `fe638ab3b536324c4b9a6e5532db4446b42b870f`; 8 paths | [39571091516](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39571091516), four jobs green; **72 suites / 1,911 checks**. Ready; independent human review requested, not approved at this checkpoint. |
| [#60 inactive authentication pilot](https://github.com/Jeruzael/docmonstakrakin/pull/60) | `65af90b57c84188b63809ee282d6f36fd72da88f`; 22 paths | [39572312570](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39572312570), four green; **72 / 1,945**. Ready; human review pending. |
| [#61 synthetic governance transactions](https://github.com/Jeruzael/docmonstakrakin/pull/61) | `b5fb3c41c309e36567b0838da9ce146e54b235a1`; 9 paths | [39572487978](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39572487978), four green; **72 / 1,960**. Ready; human review pending. |
| [#62 fixture isolation](https://github.com/Jeruzael/docmonstakrakin/pull/62) | `9f0a61c0694f059b8c541127a4afc9a6eade9be3`; 15 paths | [39576844675](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39576844675), four green; **73 / 1,911**, isolation **6/6**, all **15/15** signoff scenarios. Ready; human review pending. |
| [#63 product journey and this handoff](https://github.com/Jeruzael/docmonstakrakin/pull/63) | Branch `codex/campaign-product-demo`; final HEAD and checks are recorded on the PR | Stacked on #62, not yet integrated. The current signed commit includes this checkpoint; its future CI cannot be predeclared here. Require all four exact-HEAD jobs and human review. |
| [#64 authentication recovery](https://github.com/Jeruzael/docmonstakrakin/pull/64) | `ab20b3026fba1200d5acd54ab04c9efd0862ba14`; 26 paths, separate from immutable #60 | Composed review base `21287d672af5bb1b567fcf5e6cfa8d594a10e5d9` includes #59, #60 and corrected #62. Local final **76 / 1,983**, native35/path7/pilot41/recovery24 pass. Published draft; four-job CI and human review must be checked separately. |

#63 targets `codex/campaign-test-fixture-isolation`; recovery targets `codex/campaign-auth-recovery-base`. These are review dependency branches, not master integrations or additional authorities. Campaign branch PR triggers run the same four existing jobs without expanding workflow permissions. Before either stacked candidate is eligible for master, verify its dependencies' actual merges/post-merge CI, retarget to master and reconcile normally without rewriting history. Renew exact-HEAD CI and human review whenever HEAD changes; review the final effective diff even if only the base changes. Review #59/#62 before dependent native/recovery integration; #60 and #61 remain independently inspectable. Resolve overlapping CI/handoff changes additively, retaining every focused suite and historical record. Never infer combined integration from isolated green PRs.

### Implemented behavior and remaining boundaries

**A:** Native realpath canonicalization, original lexical-parent ownership and BigInt directory identities reject substituted directories, links, hardlinks and copied markers. Actual Windows short/long aliases and seven adversarial cases are tested. Hosted default-TEMP Windows fresh npm and frozen Bun installs pass native35 + path7 each; Linux fresh installs are separately checked. PowerShell 7 is a Windows alias-test prerequisite. Bun still blocks its default untrusted `protobufjs` postinstall; this is not full lifecycle compatibility acceptance. [A qualification record](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-windows-compat/docs/07_verification/WINDOWS_NATIVE_COMPATIBILITY_20261021.md).

**B:** Owned/versioned SQLite, bounded Argon2id, hostile PHC/input checks, HUMAN/AGENT separation, lifecycle/CAS, digest-only sessions, rotation/revocation/restart fences, audit and server-owned default-deny resource policy are implemented in an inactive pilot. A separately created loopback HTTPS server exercises actual TLS, Host/Origin, cookies, CSRF and six session registrations; ordinary startup does not import/mount it. Actual browser tests use a process-specific ephemeral SPKI exception, not an installed trust root. Loopback cookies are not port-isolated. The ordinary **69-route inventory remains 45 legacy unauthenticated, 14 blocked privileged, 7 reviewer-gated and 3 session routes**: the pilot protects none of those legacy routes. [Pilot record and public evidence](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-auth-pilot/docs/07_verification/AUTH_PILOT_CANDIDATE_20261021.md).

Recovery adds an explicit TESTONLY schema2 service with signed bounded transfer proofs, durable ACTIVE/QUIESCED generation leases, exact CAS/audit/receipt transactions and stale-owner fencing. Actual service recovery preserves synthetic credentials/READ policy, fences old sessions/CSRF, and tests password change/rotation/logout. Default schema1 remains unchanged. The private fixture key is held by the supervisor, never an operational signer; no arbitrary operator database is admitted. Process crash/restart evidence does not establish power-loss, external rollback resistance, production custody or capacity. [Recovery contract and evidence](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-auth-recovery/docs/07_verification/AUTH_PILOT_PROCESS_HANDOFF_CANDIDATE_20261021.md).

**C:** TESTONLY pinned acquisition, person-role/policy/epoch/revocation/time/witness checks, ordinary/elevated proof composition, actual synthetic SQLite WBS/ledger/receipt/replay/idempotency/CAS transactions, five crash points and two-process races are implemented. Bounded raw Git object/first-parent descendant verification preserves unchanged WBS/ledger paths. It is not a remote Git-ref-and-database atomic transaction. Local reopen/hash consistency is not independent historical crypto reattestation or external rollback protection. Synthetic roots/people never ratify a policy or appoint humans. Real Lead Architect, additional independent approver, custodians, witnesses, enrollment verifiers and recovery roles remain **PENDING**; Gio is one person. [Contract/decision package](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-governance-transactions/docs/06_planning/CAMPAIGN_WBS_SYNTHETIC_REGISTRATION_CONTRACT.md) and [measured evidence](https://github.com/Jeruzael/docmonstakrakin/blob/codex/campaign-governance-transactions/docs/07_verification/CAMPAIGN_WBS_SYNTHETIC_REGISTRATION_20261021.md).

**D:** Real project/discovery APIs and browser flow create server-owned PROPOSED linked tasks, preserve reciprocal links during re-answering, enforce state-version CAS and expose honest planning/readiness labels. A current-version re-derivation is idempotent; replaying the old version returns409. Actual synthetic reviewer sessions exercise controlled living-document validation/save, audit display and restart fencing. External controlled-document creation exists only in a separate disconnected fixed-fixture pilot; ordinary creation remains unavailable. Credential-free prompt compilation makes no external-provider request. Sample coverage is **1/22 (5%)**, evidence **UNTRUSTED**, `releaseReady=false`, `signedOff=false`; read-only evaluation leaves Gate 7 HUMAN_APPROVAL_REQUIRED. [Normal-checkout demo](LOCAL_PRODUCT_DEMO.md) and [acceptance matrix](../07_verification/LOCAL_PRODUCT_DEMO_ACCEPTANCE_20261021.md) distinguish working, inactive and unavailable behavior.

### Reproducibility, preserved failures and continuation

Use a **fresh disposable clone**, committed lockfiles, Node22.23.3 x64 or a separately qualified patched Node22 runtime, Python and a compatible native SDK/toolchain. Install normally with `npm ci`, inspect `npm ls vite source-map-js better-sqlite3 argon2` and `npm audit --json`, then `npx playwright install chromium`. For Bun, use the committed pinned installer/workflow and `bun install --frozen-lockfile`, retaining its default blocked-script inventory; do not expand trust or skip lifecycle scripts to report success. Run `npm run ci:quality`, `npm run ci:controlled-docs`, then `npm run ci:regression` **sequentially** on a constrained machine. Follow the demo guide for actual browser/API runs. Inspect the workflow's Windows npm/Bun and Linux qualification steps for exact commands/provenance.

The operator host lacks a Windows SDK; observed free disk fell below the official minimum plus cache/recovery allowance. No SDK was installed, elevation bypassed, reboot requested or unrelated service stopped. Its original node_modules junction retains **Vite6.4.3/source-map-js1.2.1** and was not modified. Committed locks remain patched **6.4.4/1.2.2**, native **13.0.3/0.45.1**. Local native results used separately retained, integrity-checked packages, not a clean host installation. A private official SHA/Authenticode-verified portable Node22.23.3 enabled patched-runtime tests without replacing host Node22.21.1 or changing system PATH. Node22.21.1 is not security-qualified by npm audit; Node's fixed excessive-header handling returns431 before older middleware's403. Both rejections must leave synthetic authority state unchanged.

Preserved failures include missing-SDK installs, short-name TEMP mismatch, Windows PowerShell5.1 helper timeout, port5173/OOM fixture collisions, signoff's prior false-green8-of15 run, constructor-side-effect credential fixture initialization, lossy requirement-ID hashing and the Node403/431 difference. An earlier isolation test created a64-byte token file in the task worktree at **2026-10-21T08:38:54.2770357Z**; only metadata was inspected, no contents were read/printed/deleted, and the original operator checkout was untouched. The corrected six-case test requires zero ordinary-cwd filesystem probes before its explicit inert fallback. Earlier runs are not represented as isolated. The historical D **77/1,943** local run predates final ID/isolation corrections; final exact-HEAD checks must establish the corrected candidate. Repeated-run metrics without retained raw files are explicitly labeled transcribed; no raw digest is invented.

Candidate limits/performance are review proposals, not production ratification: retained chain/resource bounds, logical byte budgets, recovery proof/session limits and observed RSS/latency need human compatibility acceptance and worst-case capacity work. Synthetic process tests do not cover all disk-full/power-loss/kernel faults, hostile same-user rollback or total process-tree memory. Preserve failures and evidence digests when reconciling branches. CI artifacts and linked committed evidence are accessible from GitHub; temporary Codex paths are not the sole reproduction source.

Next executable work: inspect each final PR's diff/signature/four checks; obtain genuine exact-HEAD APPROVED reviews; ordinary guarded sequential integrations only while the standing authorization remains valid. Reverify master, merge parents/tree/signature and all actual post-merge jobs after every merge. If a precondition changes, reconcile and renew review rather than bypassing it. If a post-merge gate fails, stop further integrations and preserve a bounded corrective candidate. Complete an all-workstream combined preflight before claiming compatibility; it remains separate from actual master integration.

Production decisions still required: independently authenticated human role-policy ratification/appointments, real root custody/enrollment/revocation/time/witness acquisition, remote Git/database transaction and rollback policy, production identity storage/recovery/certificate/hostname/session/CSRF/throttling budgets, reviewed route cutover and operational authorization. **No real credentials/principals/grants/signers/roots, WBS registration/receipt consumption, quorum change, privileged-route activation, live agents, PR #34/#52 integration, Gate 7, release promotion or deployment occurred under these candidates.**

## Current integration checkpoint — PR #57 merged, PR #58 reconciliation

This additive checkpoint supersedes the current-state claims in the original snapshot below while preserving that snapshot and its historical evidence. The operator has conditionally authorized only PR #57 followed by PR #58, subject to actual independent exact-HEAD approval, required CI and ordinary protected merge conditions. It grants no future unrelated merge or production authority.

Verified master is **`c729df39cbdfe292287b9344b060e7d4022c2eae`**. [PR #57](https://github.com/Jeruzael/docmonstakrakin/pull/57) is merged: `jianzhihuoxin` [approved](https://github.com/Jeruzael/docmonstakrakin/pull/57#pullrequestreview-5595690737) exact signed HEAD `f4fbede5088eaae0147ee912499089b623ebc267` at **2026-10-21T06:20:48Z**; GitHub records merger `Jeruzael` at **06:26:33Z**. This verification did not perform that merge or invent a separate prior authorization. Merge parents are `5d10299cc0aa6f93b4f2861bf1bdd5167cbfba09` and `f4fbede5088eaae0147ee912499089b623ebc267`. The valid GitHub-signed merge tree `f5b913481fe159e40ab4d48061dfa18dd24a1ead` equals the reviewed candidate tree, with exactly its three authorized files.

Actual master push [39555424164](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39555424164) succeeded on `c729df3`: Complete Regression `119073963497`, Quality & Build `119073963718`, Controlled Docs `119073964046`. Inspected logs report **70/70 suites, 1,869/1,869 checks, zero failures/skips**, WBS/TypeScript/build success, controlled documents **40/40 core, 29/29 additional, 11/11 focused**, and synthetic fixture state unchanged.

PR #58 is being reconciled by a normal signed merge with ordered parents `920fc47182732f329b6da98ae1dbe5d6ca3fac80` and `c729df39cbdfe292287b9344b060e7d4022c2eae`. The conflict-free source union before this handoff supplement is tree **`48d03117da03b1de8177da8748337c1e38c28b78`**, identical to the earlier 71-suite/1,904-check candidate preflight. All original PR #58 implementation, dependency and evidence blobs are retained; all three PR #57 paths match actual master. This handoff supplement is the only additional content change. Earlier preflight remains historical evidence and does not substitute for new exact-HEAD or post-merge CI.

`jianzhihuoxin` [approved the old PR #58 HEAD](https://github.com/Jeruzael/docmonstakrakin/pull/58#pullrequestreview-5595711490) `920fc47182732f329b6da98ae1dbe5d6ca3fac80` at **06:23:34Z**. That approval does **not** authorize a changed reconciliation HEAD. The reconciled signed HEAD needs all **four** jobs (Quality & Build, Complete Regression, Controlled Docs, Windows Native Qualification) and renewed actual exact-HEAD APPROVED review. At this commit's preparation, those future results and renewed approval have not been established. Inspect [current checks](https://github.com/Jeruzael/docmonstakrakin/pull/58/checks) and the [additive PR #58 integration handoff](https://github.com/Jeruzael/docmonstakrakin/pull/58) for the subsequently verified exact HEAD, final disposition, actual merge/master identities and post-merge job/log evidence. These public records supplement this file without rewriting signed history or requiring a closure-only PR.

Windows qualification remains conditional: the original operator installation lacks a Windows SDK and is untouched; hosted clean npm installation uses an already provisioned compatible SDK. The fixture requires an explicitly unaliased, owned TEMP/TMP parent; the default short-name canonicalization defect remains unfixed and fails closed. Bun's default blocked `protobufjs` postinstall remains disclosed. Retained-binary runtime success is not clean-install support, and configured hosted success does not establish default-Windows compatibility. The independent reviewer must assess these limitations together with native provenance, PHC validation, session fencing, SQLite transaction/audit behavior, worker lifecycle and human/agent separation.

Next executable work: verify the reconciled signed HEAD and four-job CI, obtain renewed human approval, then recheck actual master/mergeability/threads/protected boundaries immediately before any conditional PR #58 merge. A valid old approval, candidate preflight or signed commit alone cannot satisfy that gate. After an authorized merge, inspect actual exact-master combined regression, native qualification and controlled-document jobs before calling integration complete. Stop on any failed or changed gate. After PR #58 is adjudicated, this two-PR merge authorization expires. Any Windows canonicalization correction or further development needs separate bounded authorization.

Synthetic foundations remain disconnected and default-disabled. No real humans, credentials or grants are enrolled; no authentication/security routes, canonical WBS, governance receipts, quorum, live agents, Gate 7 or release state are changed. PR #34 and PR #52 remain separate. The original measurements, receipts, timestamps and qualifications below remain historical records.

## Original final-gate snapshot — preserved

Snapshot: 2026-10-21. This file describes development candidates and existing boundaries. It conveys no new merge permission, WBS signature, identity appointment, grant or production activation authority. Recheck GitHub before relying on a recorded PR state.

Final review/integration checkpoint: [FAST_TRACK_FINAL_GATE_20261021.md](../07_verification/FAST_TRACK_FINAL_GATE_20261021.md). It includes committed public evidence, the successful configured Windows npm/Bun qualification, the unresolved short-name TEMP limitation, the combined **71-suite / 1,904-check** preflight, actual merge status and the next human decisions. Neither candidate is integrated into master. A local retained-package preflight is distinct from clean installation and actual master integration.

## Start here

Verified current master is **`5d10299cc0aa6f93b4f2861bf1bdd5167cbfba09`**. PR #56 integrated reviewed HEAD `e7f094a20ce8a6d992b69e7c6768d4109944d020`; the merge tree is `4307d814c88604c0bb79188417d9a80d1d1f11e8`. Independent `jianzhihuoxin` approval at 2026-10-21T02:17:28Z preceded the agent-invoked ordinary GitHub merge under explicit operator authorization at 02:41:28Z. The account recorded by GitHub is Jeruzael. This is not a claim of a manual human merge or cryptographic governance approval.

[Actual post-merge CI 39534416134](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39534416134) passed all three jobs on that merge: **69/69 suites, 1,856 reported checks**, zero failures/skips; controlled documents **40/40 core, 29/29 additional, 11/11 focused**, synthetic state unchanged. The reviewed/merged trees and valid signature were independently checked.

The merge used the ordinary exact-head GitHub endpoint, with no protection change or explicit bypass. Administrative branch-protection inspection returned HTTP 403 for the integration account, so this record does not claim an independent audit of the repository's administrative rule configuration.

The fast-track instruction authorizes one disconnected S2-A foundations candidate and one separate local-workflow correction candidate. It permits routine implementation/testing/debugging/evidence/draft publication. It does not authorize merging either candidate. The S2-A development exception expires at the earlier of its final human PR decision or the conservative cutoff **2026-11-04T00:00:00Z**. Future development beyond that boundary needs renewed operator authorization. No runtime clock or module can stand in for an attributable human decision.

| Record | State at this snapshot | Resume location |
| --- | --- | --- |
| PR #34 | Open, unapplied; HEAD `5912185a005df3e0469dd46392d7d0dbb0378b68` | Proposed DMK-209–214 registration; no merge/apply authority |
| PR #52 | Separate archival draft; HEAD `89b1527f75dfdd69a3e49bda752b64d4edd70a54` | Historical closure candidate; do not alter automatically |
| PR #56 | Merged and post-merge verified | Vite 6.4.4 correction; preserve original evidence |
| [PR #57](https://github.com/Jeruzael/docmonstakrakin/pull/57) local workflow | Ready for formal review, unmerged; `codex/local-workflow-corrections`, unchanged signed HEAD `f4fbede5088eaae0147ee912499089b623ebc267`; `jianzhihuoxin` requested, no actual review recorded at this checkpoint | `LOCAL_WORKFLOW_CORRECTIONS_20261021.md` |
| [PR #58](https://github.com/Jeruzael/docmonstakrakin/pull/58) synthetic foundations | Ready, unmerged; `codex/s2a-synthetic-foundations`; runtime/test/dependency source remains identical to `2665712449b38813e91a18d256fa693ab318d406`; later commits add Windows qualification and public handoff evidence; final changed HEAD requires fresh checks and renewed review | `FAST_TRACK_FINAL_GATE_20261021.md` |

Publication checkpoint: PR #57 is published; [workflow 39539280382](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39539280382) passed all three jobs on its exact HEAD. Quality & Build `119023051806`, Controlled Docs `119023052000`, and Complete Regression `119023052201` report **70/70 suites and 1,869/1,869 checks**, zero failures/skips; controlled documents 40/40 core, 29/29 additional and 11/11 focused (332 assertions), state unchanged. The generated test-merge tree equals the signed candidate tree. Human review is requested and no actual review was recorded at this snapshot.

PR #58 remains the single foundations candidate and has left draft state. Its eleven runtime/test source files and dependency versions remain unchanged; the final gate adds one Windows job beside the three original Linux jobs. This file cannot predeclare its own future CI result: inspect [PR #58 checks](https://github.com/Jeruzael/docmonstakrakin/pull/58/checks) and its verification record for the latest exact signed HEAD, all three required jobs plus Windows qualification, and separately attributable review request/actual review. Neither new candidate has merge authorization. After fetching, `git rev-parse origin/master origin/codex/local-workflow-corrections origin/codex/s2a-synthetic-foundations` resolves current exact tips; compare them with GitHub rather than assuming this dated snapshot is still current.

## Implemented, tested and blocked

The merged application has local project creation, adaptive discovery and answer derivation, existing WorkItem views/checklists/statuses, controlled-document inspection/diff/validation, deterministic external-model context compilation, and read-only progress/evidence views. The existing complete regression exercises these components and synthetic server fixtures. It does not prove an unrestricted operator journey or complete application authorization.

The local-workflow candidate corrects three demonstrated questionnaire defects: empty filtered views escaping their scope, structured technical-answer restoration, and inconsistent readiness projections. A follow-up preserves non-first accepted recommendations and separates question blockers from metadata prerequisites. Its actual React/browser fixture has **13 passing cases** with all network requests blocked; discovery **36/36**, technical baseline **10/10**, TypeScript and a scoped fresh code review passed. Fresh normal Windows and Linux npm installations succeeded with zero audit findings. The final candidate passed **70/70 suites and 1,869/1,869 reported checks**, WBS integrity, TypeScript, build and controlled documents on both platforms. The earlier ten-case candidate is not substituted for the corrected head.

The foundations candidate adds only disconnected fixture primitives: a private owned SQLite worker with fixed commands, bounded Argon2id verification, digest-only opaque sessions, explicit principal/action/resource policy, distinct HUMAN/AGENT types and sanitized deterministic audits. Import/default factory use is inert. Explicit opt-in creates fresh disposable temporary fixtures; no environment variable, existing database, HTTP registration or operator roster can activate these foundations. The final focused corrected source passes **35/35** checks, TypeScript and build. Fresh review identified expiry/rollback and concurrent-worker-lifecycle defects; both were fixed, including a composed audit-failure/clock-rollback case, and the original reviewer confirmed them addressed. Full qualified Windows gates pass **70/70 suites and 1,891/1,891 reported checks**, plus WBS/build/controlled documents. Exact-head Linux publication results are acquired separately. These agent results are not independent human approval, a successful Windows installer or operational acceptance.

Deliberate journey limits remain:

- The initial project WorkItem is unlinked. Task Context correctly refuses an implementation handoff until governing requirements/features are linked. Summary and Full Baseline prompt modes remain usable without a Gemini key.
- There is no manual WorkItem-creation form in the existing Work view. External proposal acceptance and linked item creation retain their specialized reviewer authority.
- Controlled-document catalog/read/diff/validation exist; committing a save retains its reviewer gate. Unregistered handoff files do not become editable controlled documents merely by being added to Git.
- Evidence views display existing evidence/audits; this sprint does not add an attachment endpoint or verification authority.
- DOCMONSTAKRAKIN's API must not be exposed to external models. Copying a generated prompt is not permission to grant an external model API access.

## Code map and architecture boundaries

| Path | Responsibility and boundary |
| --- | --- |
| `server.ts` | Existing routes and middleware; no synthetic-foundation import or authentication cutover |
| `server/security/apiRoutePolicy.ts`, `localPerimeter.ts`, `vitePerimeter.ts` | Existing route denials and loopback/browser containment; containment is not identity authentication |
| `src/components/QuestionnaireView.tsx` | Existing discovery navigation and display; canonical coverage remains in existing derivation helpers |
| `src/data/derivationEngine.ts` | Requirements and readiness projection; questionnaire fixes do not rewrite these rules |
| `server/proposals/` | External proposal review/acceptance and specialized reviewer requirements |
| `server/security/syntheticFoundations/` | New disconnected, fixture-only store/KDF/session/policy/audit family |
| `scripts/testSyntheticSecurityFoundations.ts` | Actual worker/native integration, deterministic negative and fault tests; no production listener |
| `scripts/testDiscoveryQuestionnaireUi.ts` | In-memory actual React/Playwright regression; no HTTP persistence claim |
| `scripts/runCompleteRegression.ts` | Discovers `test*.ts` under scripts/server and counts named outputs; retains pinned historical evidence |
| `scripts/verifyWbsGovernanceEnvelope.ts`, `scripts/wbsEvidenceContinuity.ts` | Offline/synthetic governance contracts; do not establish operational roots or actual application authority |
| `docs/06_planning/s2a-readiness-20261019/` | Original 29-file portfolio and historical feasibility measurements; preserve unchanged |

The production trust adapter, trusted provenance/clock/revocation acquisition, independent real human enrollment, durable receipt consumption, atomic WBS-and-ledger apply engine and applied-to-current descendant semantics remain separate gates. The offline envelope and verifier contracts do not replace them. Original SO/Lead Architect human-only quorum remains intact; an AGENT or two keys controlled by one person cannot satisfy independent humans.

## Dependency and native-runtime inventory

Use **Node 22 x64**. The observed Windows runtime is 22.21.1/npm 11.7.0/Bun 1.4.2; current Linux CI uses Node 22.23.3/npm 10.9.9. The synthetic store opens only on the tested Node-22 x64 Windows/Linux targets. Other platforms/runtimes are unaccepted, not silently supported.

| Dependency | Exact selected version | Notes |
| --- | --- | --- |
| Vite | 6.4.4 in both existing declarations and both locks | Three launch-editor advisories absent from fresh merged-base audit |
| source-map-js | 1.2.2 in both locks | Preserve the prior security correction |
| better-sqlite3 | 13.0.3, development-only candidate | Embedded SQLite observed 3.53.4; packaged binary can take precedence over a local build |
| argon2 | 0.45.1, development-only candidate | Argon2id v19; this package's canonical PHC parameter order is `m,p,t` |

Synthetic KDF parameters are 32768 KiB, t3, p1, 32-byte hash and 16 random salt bytes, with two active/four queued work items. Session tokens contain 32 random bytes and persist only as SHA-256 digests. Idle/absolute lifetimes are ten/thirty minutes. These are fixture parameters, not ratified production budgets, password policy or browser session acceptance. RPC/cardinality/admission bounds and their exact negatives are documented with the candidate.

**Windows native installation qualification:** ordinary npm ci and frozen Bun install both attempted implicit node-gyp compilation and failed because this machine has no Windows SDK. Python 3.11.9 and VS2026/v145 C++ core were detected. No SDK, certificate or system tool was installed by the agent, and no lifecycle script was disabled to claim installer success. A separately labeled probe loaded integrity-pinned packaged binaries left by the failed installation: SQLite 3.53.4 and Argon2 0.45.1. Code/runtime tests using those retained files do not make either installer successful.

Observed Windows prebuild SHA-256 values: SQLite `e21e5efd71fba66578e95b62554d9028064a80dafd7221bf8a8ef155de8d240a`; Argon2 `7d1716c8eafe32d54a12af5c0d3024cd715a7e1fdc8092eea84fd369d267075c`. Recompute actual loaded binary paths/digests on every target; a build log alone does not establish what the loader imported. Fresh Linux npm installation and exact-head CI are required separately.

The final gate subsequently qualified fresh npm and frozen Bun installations on GitHub's already provisioned Windows2022 SDK image, with the same actual native binary digests and 35/35 checks for each install. The operator host remains missing its SDK. The hosted fixture needs an explicitly unaliased, job-owned TEMP/TMP: default `RUNNER~1` and native-expanded parent paths disagree under the source's strict canonical check. No path check was relaxed. Bun's existing blocked `protobufjs` postinstall remains a disclosed default-trust qualifier; its result is not all-dependency-lifecycle proof. See the committed gate record and logs, not an inaccessible Codex temporary directory, for exact evidence.

The original operator checkout has a node_modules junction with stale Vite 6.4.3/source-map-js 1.2.1. It was deliberately untouched. Do not run npm ci through that junction or stop operator services without separate maintenance authorization.

## Reproducible setup and verification

Use a fresh disposable clone and synthetic configuration. Do not copy an operator `.local`, credential store, `.env`, certificate, roster or database into a fixture. Inspect branch/HEAD and lockfiles before installation. The frontend-only branch does not require the new native dependencies; the foundations branch requires a working native toolchain for a clean installer result.

Windows PowerShell, after independently provisioning the supported Node/native prerequisites:

```powershell
$ErrorActionPreference = 'Stop'
git -c core.autocrlf=false clone https://github.com/Jeruzael/docmonstakrakin.git dmk-check
if ($LASTEXITCODE -ne 0) { throw 'Clone failed; stop here.' }
Set-Location dmk-check
git switch --track origin/codex/s2a-synthetic-foundations
if ($LASTEXITCODE -ne 0) { throw 'Branch selection failed; stop here.' }
$taskFixtureTemp = Join-Path (Get-Location).Path '.synthetic-fixture-temp'
New-Item -ItemType Directory -Path $taskFixtureTemp -Force | Out-Null
$env:TEMP = $taskFixtureTemp
$env:TMP = $taskFixtureTemp
node --input-type=module -e "import fs from 'node:fs'; import os from 'node:os'; if(fs.realpathSync(os.tmpdir()) !== await fs.promises.realpath(os.tmpdir())) process.exit(1);"
if ($LASTEXITCODE -ne 0) { throw 'Select an unaliased disposable temporary parent; do not weaken path checks.' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Clean installation failed; do not continue using retained files.' }
npx.cmd playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed; stop here.' }
Import-Module Microsoft.PowerShell.Utility
$env:PSModulePath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/Modules'
$env:CI = 'true'
$env:GEMINI_API_KEY = ''
npm.cmd run ci:quality
if ($LASTEXITCODE -ne 0) { throw 'Quality verification failed.' }
node --import tsx scripts/testSyntheticSecurityFoundations.ts
if ($LASTEXITCODE -ne 0) { throw 'Foundations verification failed.' }
npm.cmd run ci:controlled-docs
if ($LASTEXITCODE -ne 0) { throw 'Controlled-document verification failed.' }
npm.cmd run ci:regression
if ($LASTEXITCODE -ne 0) { throw 'Complete regression failed.' }
git diff --exit-code
if ($LASTEXITCODE -ne 0) { throw 'Tracked files changed during verification.' }
```

Import Utility before changing the process-only module search path. This avoids a known Windows PowerShell 5.1 account-test incompatibility when launched from PowerShell 7. Private fixture ACL tests require the ordinary current-user token; an AppContainer can lose its own capability when inherited ACLs are removed. That failure is retained, not addressed by weakening ACLs. Do not run the fixture as a production account or redirect it to an operator path.

Linux in a disposable build-capable Ubuntu/container environment, with Python, make and a C++ compiler installed by that environment's operator:

```bash
set -euo pipefail
git clone https://github.com/Jeruzael/docmonstakrakin.git dmk-check
cd dmk-check
git switch --track origin/codex/s2a-synthetic-foundations
npm ci
npx playwright install --with-deps chromium
export CI=true GEMINI_API_KEY=
npm run ci:quality
node --import tsx scripts/testSyntheticSecurityFoundations.ts
npm run ci:controlled-docs
npm run ci:regression
git diff --exit-code
```

For the frontend candidate, select `codex/local-workflow-corrections` and run `node --import tsx scripts/testDiscoveryQuestionnaireUi.ts` instead of the absent foundations script. Run the same quality/controlled/full gates. Linux `--with-deps` installs system browser dependencies: use it in the disposable environment, not as implicit host-administration permission.

Before a merge, verify actual GitHub review against the exact signed HEAD and all three required jobs. A later master merge needs its own new push workflow; candidate PR CI is not post-merge CI. The original envelope qualification remains **88 focused passes versus 87 runner-counted outputs** because a passing test name contains “skipped”; no assertion is silently skipped.

## Next ten engineering tasks

| Priority | Entry conditions | Bounded scope and acceptance | Dependencies |
| --- | --- | --- | --- |
| 1. Review the disconnected foundations candidate | Existing single-PR development exception still valid; final signed HEAD and all required checks | Inspect clock/audit failure composition, lifecycle bounds, native provenance and fixture-only separation; actual human security review, then separate operator integration decision | No production activation; review request is not approval |
| 2. Review and integrate local workflow correction | Final signed candidate, full CI and actual human approval | Confirm three fixes and preserved reviewer gates; separate operator merge; actual new-master CI | No automatic merge authorization from this handoff |
| 3. Decide Windows portability and installer constraints | Review final hosted qualification and retained default-TEMP failure | Accept the documented SDK/unaliased-TEMP/default-Bun-trust scope, or separately authorize a narrow consistent-canonicalization candidate with alias/symlink/cleanup negatives | Operator host SDK provisioning remains separately authorized; no silent path-check relaxation |
| 4. Triage residual editor TAB/ADS hypothesis | Independent bounded security-investigation authority | Inert source/platform evidence first; establish legality/parsing/reachability before any new finding or remediation scope | Vite remains 6.4.4; no live exploit or unrelated upgrade |
| 5. Ratify operational WBS authority and custody | Competent charter humans explicitly decide roles, independence, policy epochs, custody/recovery | Attributable appointments/acceptances and approved public decision evidence; no agent-appointed signers | Existing charter, R13/R14 and offline-envelope records |
| 6. Implement authenticated acquisition candidate | Accepted human trust/custody decisions and separate exact scope | Provenance, trusted time/revocation/checkpoint acquisition; reject stale/untrusted inputs; independent review | Task 5; no synthetic authority presented as production |
| 7. Prepare atomic registration/application candidate | Accepted authority/acquisition and separately authorized engine design | CAS, crash-safe WBS/ledger/receipt transaction, replay/recovery and descendant semantics; exact registration bytes reviewed | Tasks 5–6; retain proposed DMK-210→211→212→209 sequence; PR #34 unapplied |
| 8. Decide operational S2-A transport/bootstrap/recovery | Reviewed foundations plus explicit new implementation authority | Approved issuer/hostname, cookie/CSRF browser contract, independent enrollment/recovery and rollback tests | No certificates, principals or live sessions under current exception |
| 9. Complete a governed end-to-end product journey | Explicit reviewer test authority and accepted route/identity prerequisites | Synthetic project→discovery→linked WorkItems→document save→task prompt→evidence; distinguish all actual server gates | Existing APIs first; new UI only when missing authority is resolved |
| 10. Reconcile candidates and package a portable resume | Separate human integration decisions and successful post-merge CI | Verify combined tree/locks, update this snapshot, reproduce Windows/Linux commands and copy-ready prompts | Never force-push, weaken checks, run Gate 7 or promote release implicitly |

## Risks and deferred proof

No production authorization, transport, real bootstrap/recovery, enrollment, credential migration, session cookies/CSRF, public listener or route cutover is implemented. Real disk-full, read-only-volume and crash-mid-owned-transaction durability are outside the measured fixture proof. Local audit tail-truncation detection needs an independently retained head anchor; internal chain consistency is not authenticated production evidence. Synthetic measurements do not establish capacity or accepted operational SLOs.

The fresh dependency audit and native loader evidence are time-specific. SQLite release/advisory history continues to evolve; current compatibility claims are x64 only. Vite's legitimate percent-containing Windows editor arguments now reject, and WSL editor behavior is simulated. The pre-existing TAB/NTFS-ADS argument-splitting hypothesis remains unconfirmed and is not reported as RCE.

All **14 privileged registrations remain blocked**, live agents remain disabled, human-only quorum and canonical WBS/historical receipts remain unchanged, Gate 7 remains unexecuted and release remains blocked. No file in this handoff is an instruction to grant or bypass any of those gates.

## Copy-ready resumption prompts

**State audit:** “Read docs/08_handoff/FAST_TRACK_DEVELOPMENT_HANDOFF.md and its linked verification records. Inspect Git status without discarding changes, fetch current master and open PRs, and verify exact signed heads/reviews/CI. Report implemented/tested/deferred/blocked state and the next human decision. Do not infer new authority from the handoff.”

**Frontend continuation:** “Inspect the local-workflow correction PR and its exact final HEAD. Reproduce the three questionnaire behaviors and the non-first recommendation/metadata-blocker cases using the actual isolated React fixture. Preserve all server/helper/reviewer gates. Implement only corrections currently authorized by the operator, run required gates, sign normally and obtain renewed review for a changed HEAD.”

**Native qualification:** “Inspect the foundations candidate's installer failures and actual binary provenance. Use disposable Node-22 x64 environments. Verify normal clean npm/Bun installation and record SDK/compiler/Python requirements; do not install global toolchains or skip lifecycle scripts without a new explicit operator decision. Keep retained-package runtime results separate from clean-install acceptance.”

**Governance preparation:** “Read the historical/current WBS verifier and offline envelope records plus the published registration strategy. Identify the remaining competent-human decisions for authority, independent signers, trusted acquisition, atomic application and descendant semantics. Prepare only the separately authorized next slice; do not alter canonical WBS, receipts, quorum, roots or live state.”
