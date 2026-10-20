# S2-A readiness portfolio — current-master review entry point

## 2026-10-20 — current integration context; original evidence retained

The sections below preserve the original publication context and measured evidence. **Actual verified master is now `6f9e822ad9fd85f42a81b505259ca0013aa815b7`: PR #51 patched source-map-js in both application lockfiles, then the human operator merged approved PR #49.** PR #49's exact-master workflow [39360943211](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39360943211) passed all three jobs, 67 suites/1,672 reported outputs and controlled docs 40+29+11. Its PR #48 closure files are now inherited from master, along with PR #51's separate remediation evidence.

PR #50 was reconciled by a normal merge preserving approved `83b52b9586cbdb73a6bd6097398ea38b7bad9c42` as an ancestor. Both current-summary conflicts are resolved additively. **All 29 original portfolio files, all 20 captured input hashes and this publication's original evidence index remain unchanged.** Statements below such as “ready for review”, “separate unmerged candidate” and “does not contain PR #49's closure files” describe the original `cfca399` publication baseline, not current master. The historical 66-suite PR #48 results and recorded vulnerability remain historical; later 67-suite results and the dependency fix are separate evidence.

See the [new integration/reconciliation checkpoint](../../07_verification/PR49_POST_MERGE_AND_PR50_RECONCILIATION_20261020.md) for actual chronology, immutable-file checks and fresh local verification. The changed #50 HEAD requires fresh exact-HEAD GitHub CI and renewed independent human review; its older approval is not approval of this reconciliation. Review request, actual approval and merge remain distinct. PR #52 remains a separate unchanged draft.

Publication and reconciliation grant no canonical registration, preparatory exception, S2-A implementation/activation, live grants, credentials, transport trust or release authority. Existing quorum, 14 privileged denials, disabled agents and Gate 7 remain unchanged.

## Status and source preservation

**DOCUMENTATION_REVIEW_CANDIDATE / WBS_UNAPPLIED / EXCEPTION_NOT_GRANTED / S2A_IMPLEMENTATION_NOT_AUTHORIZED.** The operator authorized publication for independent inspection, not the proposed implementation or governance transaction.

This candidate is based on actual master `cfca39902d6fd4bc0d4c5bdaf351b0522c780466`. The original local branch `codex/az08-readiness-s2a-governance` remains at signed commit `1f8a3674f76445c4a1a6bb1c460e140442ece15b`. All **29 original portfolio files** are copied byte-for-byte under [s2a-readiness-20261019](../s2a-readiness-20261019/README.md). This entry point and the [evidence index](evidence-index.json) are additive.

The original portfolio describes the historical master `bf5d617fa5bb76323714cc21cc20270acd826616` and an unmerged PR #48 at its capture time. Those statements remain historical. [PR #48](https://github.com/Jeruzael/docmonstakrakin/pull/48) subsequently merged the exact reviewed feature HEAD `e33f5ea7869db34654c831550c91029e2236b789` at `2026-10-19T05:30:31Z`, producing the current base. Reviewed and merged tree `511e8616d252ad204ff870f70fcbbac0e2d92433` are identical. Its exact-merge [workflow 39204923024](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39204923024) passed all three jobs, 66 suites and 1,636 reported outputs. [PR #49](https://github.com/Jeruzael/docmonstakrakin/pull/49) records the additive closure; its exact `fa7929627fd412dd4e0fe1503927f5217ddb1c0e` is ready for review, with an actual request from Jeruzael to jianzhihuoxin at `2026-10-19T06:11:48Z`. A request is not an approval.

The historical `PR48_MERGE_READINESS.md` and pending-merge dispositions are therefore superseded **for current PR #48 status only**. No original timestamp, result or historical authorization is rewritten. The broad human merge-message statement is not substituted for missing exact S2-A decisions.

The base delta contains the 13 approved AZ-08 code/test/documentation paths; canonical WBS and the three historical verifier implementations are unchanged. AZ-08 closes validation only. The status endpoint remains unauthenticated; 14 privileged registrations remain denied. This documentation candidate deliberately does not contain PR #49's closure files or the separate dependency correction.

## Review map

| Question | Review source |
| --- | --- |
| Forward-compatible PR #34 strategy and failure causes | [Governance resolution](../s2a-readiness-20261019/GOVERNANCE_RESOLUTION.md) |
| Exact proposed registration/dependency bytes | [Registration JSON](../s2a-readiness-20261019/governance/registration-proposal.json), [unapplied YAML text](../s2a-readiness-20261019/governance/proposed-MASTER_WBS.yaml.txt) |
| Architecture alternatives and measurable decision matrix | [Foundations proposal](../s2a-readiness-20261019/proposals/s2a-foundations.md), [hardening summary](../s2a-readiness-20261019/hardening.md) |
| Exact S2-A code/API boundary, acceptance and rollback | [Implementation boundary](../s2a-readiness-20261019/implementation/central-policy.md) |
| Experimental inputs and commands | [Reproducibility](../s2a-readiness-20261019/evidence/REPRODUCIBILITY.md), retained benchmark/worker helpers and dependency lock |
| Original platform outputs and 34 named checks each | [Windows JSON](evidence/windows-results-raw.json), [Linux JSON](evidence/linux-results-raw.json), [Windows log](evidence/windows-benchmark.log), [Linux log](evidence/linux-benchmark.log) |
| Every historical evidence input and digest | [Publication evidence index](evidence-index.json), original [20-input inventory](../s2a-readiness-20261019/evidence-manifest.json) |
| Alternative bounded exception for a future human decision | [Unsigned exception proposal](../s2a-readiness-20261019/governance/preparatory-exception-proposal.json) |

All 20 historical inputs are now available as exact publication copies, including seven previously retained only in managed evidence storage. Raw diagnostics include synthetic temporary paths, local machine/account/ACL metadata and public GitHub identities; no private fixture key, session token, verifier or operator credential was identified. The inventory's managed paths identify original retention, while this index maps them to repository copies. These digests are evidence integrity, not authorization signatures or operational trust.

## Proposed dependency resolution — not canonical registration

| Item | Exact revised proposed dependencies |
| --- | --- |
| DMK-209 full route authorization | DMK-210, DMK-211, DMK-212 |
| DMK-210 architecture | none |
| DMK-211 identity/session foundations | DMK-210 |
| DMK-212 scoped permissions | DMK-210, DMK-211 |
| DMK-213 agent identity/delegation | DMK-212 |
| DMK-214 integration/migration verification | DMK-209, DMK-211, DMK-212, DMK-213 |

Only the two still-unregistered candidate definitions DMK-209 and DMK-211 change dependencies. Original acceptance criteria, stable IDs, existing canonical items and PROPOSED statuses are retained. The order is `210 → 211 → 212 → {209,213} → 214`. Existing loopback containment is an implementation precondition, not completion of full DMK-209. No item becomes READY/VERIFIED by publication.

The retained failures remain explicit: DMK-208 observes 33 scoped candidate items against the historical 27; DMK-197 and DMK-196 reject a candidate current digest that is not their historical authenticated state. The plan is a shared resolver with distinct `historicalValid` and `currentForwardChainValid` outcomes: evaluate immutable historical receipts against pinned historical bytes, then require a complete separately authorized successor chain for current state. Missing/invalid current evidence still denies. Do not replace historical hashes/counts, insert a bypass boolean or treat preview validation as authority.

A future verifier-only implementation, operational trust/enrollment ratification, real apply/consume transaction and exact registration authorization remain separate gates. [PR #34](https://github.com/Jeruzael/docmonstakrakin/pull/34) is not merged or modified here. Canonical WBS raw digests remain `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d` (YAML) and `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f` (Markdown).

## What was measured

These are **existing synthetic primitive results**, not fresh measurements on this publication branch or acceptance of application authentication.

| Metric | Windows x64 | Linux x64, Docker 2 CPU/1 GiB |
| --- | --- | --- |
| Named primitive checks | 34/34 | 34/34 |
| Argon2id 32 MiB/t3/p1 serial p95 | 68.40 ms | 72.08 ms |
| Six admitted KDF jobs, total-latency p95 | 216.84 ms | 214.66 ms |
| Indexed SQLite read p95 | 0.0068 ms | 0.00545 ms |
| SQLite worker RPC p95 | 0.154 ms | 0.204 ms |
| FULL/WAL transaction write p95 | 2.916 ms | 6.037 ms |
| Whole-probe peak RSS | 123.24 MiB | 215.13 MiB |
| Event-loop delay p95 | 18.63 ms | 10.64 ms |

Exact candidates were better-sqlite3 13.0.3 / SQLite 3.53.4 and argon2 0.45.1 on Node 22.21.1. The bounded fixture admitted six and rejected four of ten concurrent KDF submissions, with at most two active and four queued. Additional 19 MiB/t2 and 64 MiB/t3 profiles and all detailed metrics remain in the original matrix/raw outputs.

The checks exercise synthetic rollback, read-only/corrupt/busy store behavior, uncommitted process exit, KDF correct/wrong/malformed inputs, session expiration/rotation/revocation/generation, 10,000 token samples and digest-only storage, backup integrity/encryption/tamper/exclusive lock, and TLS trust/hostname/Host/Origin negatives. Linux slim installation failed without Python for native compilation; the pinned build-capable image succeeded. Both outcomes remain visible.

There are only 20 samples per KDF profile; this p95 method equals the sample maximum. Platforms ran sequentially on one Windows/WSL2 host with uncontrolled host load. RSS covers the whole probe, not a single KDF profile or app delta. Linux is quota-constrained Docker, not bare metal. Busy timing includes setup. Native build provenance, deployment filesystem, browser trust and production resource budgets are unaccepted.

## Choices versus untested alternatives

| Area | Measured/recommended candidate | Alternatives and decision still required |
| --- | --- | --- |
| Private store | Worker-owned better-sqlite3; WAL/FULL, foreign keys, 100 ms busy timeout | OS account/private path/parent-DB-WAL-SHM-backup ACLs and native-build provenance remain decisions. Other SQLite bindings or built-in APIs were not benchmarked; no automatic substitution |
| KDF | Async Argon2id 32 MiB/t3/p1, two active/four queued | Approve input/parameter bounds, throttling, latency/RSS budgets; other measured profiles have tradeoffs. No weaker fallback or unbounded queue |
| Sessions | Stateful 32-byte opaque tokens, SHA-256 digest-only storage; proposed 10-minute idle/30-minute absolute | Lifetimes/restart invalidation and concurrency require acceptance. Self-contained tokens were not selected or tested as a revocation replacement |
| Loopback transport | Node HTTPS/TLS 1.3 with explicit synthetic client trust | Prefer an operator-provisioned leaf under an authorized issuer. Direct self-signed trust was measured only in a Node client; OS/browser trust, dedicated hostname, key custody and renewal are untested. Any proxy/alternate deployment needs separate review; keep the browser pilot disabled absent approved trust |
| Bootstrap | Offline stopped-service CLI, exclusive lock, SQLite transaction/backup primitives | Actual authority/identity ceremony and last-admin behavior are unapproved. Creating a workspace administrator must not imply project or reviewer grants |
| Recovery | AES-256-GCM synthetic backup, separate 32-byte key, tamper denial and generation revocation | Approve recovery authentication, key custody/location, RTO/RPO and applicable existing human controls. OS-keychain or other custody integration is untested; no implicit recovery bypass |

Option 2 remains centralized, default-deny principal/action/resource authorization. Unknown/unavailable authority denies. A worker is neither a privilege boundary nor complete crash isolation. The selected same-process design and separately owned broker alternative retain the tradeoffs and diagrams in the original portfolio.

## Exact human decision and implementation limits

Before a future S2-A implementation candidate, approve a revision-bound scope and either resolved canonical prerequisites or a competent, explicitly bounded preparatory exception. The unsigned exception is an alternative **proposal** for one synthetic code/test PR, disabled operational behavior, expiring at its final human decision or 14 days after explicit authorization. Publication does not grant it.

Required decisions are private-store account/path/schema and build provenance; exact KDF binding/profile/limits and measured budgets; session expiry/revocation; transport hostname/issuer/key/trust model; offline bootstrap/recovery authority/custody; acceptance/evidence and rollback/stop conditions; named independent human reviewer; and later distinct merge/activation gates. The [existing decision fields](../SECURITY_S2A_IMPLEMENTATION_DECISION.md) remain applicable.

Any authorized first slice must stay within private identity/verifier/session and pure default-deny/coordinator primitives, offline ceremony tooling and a disabled synthetic pilot as enumerated in the original boundary. Existing-route cutovers, privileged capabilities and agent delegation are separate later slices. Cross-store intent/recovery and revocation-at-commit semantics must be proven, not inferred from SQLite ACID.

Proposed acceptance requires actual server/resource/policy negatives, hostile/malformed verifiers, bounded queue saturation, session/CSRF/replay tests, crash/revocation races at every publication boundary, unavailable/corrupt/disk-full authority, ACL/backup checks, Windows/Linux build compatibility, unchanged quorum and denials, all GitHub CI and exact-HEAD independent human security/architecture review. Numeric proposed budgets are not accepted merely because the experiment met some of them.

Rollback disables the pilot/cutover, revokes generations and restores reviewed private state offline while retaining audit. It never restores anonymous access, weaker KDFs or inferred grants. Halt for source/requirements drift, failed CI or unexpected state changes and renew review.

No canonical WBS apply, dependency exception, S2-A implementation, credential migration, enrollment, grant, certificate installation, authentication activation, privileged-route re-enablement, live agent execution, Gate 7 or release promotion is performed. Stop at independent human review.
