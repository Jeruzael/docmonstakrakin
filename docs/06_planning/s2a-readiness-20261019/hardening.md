# Security Hardening Review: AZ-08 and S2-A readiness

## Evidence Basis

PR #48 at e33f5ea7869db34654c831550c91029e2236b789 has an actual exact-commit approval by jianzhihuoxin (review 5567032372, 2026-10-19T04:43:25Z), three successful GitHub CI jobs and a fresh 105-case actual-server pass. I recommend the bounded AZ-08 merge after separate operator authorization. It remains unmerged; no post-merge closure is fabricated.

We also reproduced PR #34's three historical verification failures, prepared a structurally valid unapplied dependency revision, and measured the proposed SQLite/Argon2/session/TLS/recovery primitives on Windows and Linux. The [evidence context](context.md), [inventory](evidence-manifest.json) and [structured analysis](hardening.json) distinguish observations from proposals.

## Constraints

Option 2 central authorization remains selected. This package changes documentation only. No application identity service or auth cutover, canonical WBS application, operator enrollment/migration/grants, production certificate/trust activation, live agent execution, Gate 7 or release promotion is authorized or performed.

Master remains bf5d617fa5bb76323714cc21cc20270acd826616; PR #48's reviewed branch remains unchanged. The status endpoint's permitted operations remain unauthenticated. This is a domain fix plus a preparation package, not full requirement authorization or tenant isolation.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Owned authorization foundations | Exact-head AZ-08 review, 69-route legacy boundary and 34 Windows/34 Linux primitive checks | 1 route-local; 2 central principal/action/resource; 3 separate OS broker | Retain selected Option 2; approve exact bounded code scope only after its gates | [Measured foundations](proposals/s2a-foundations.md) |
| Forward WBS continuity and sequencing | Three reproduced count/digest failures; revised additive PREVIEW, negative controls and acyclic graph | Separate historical/current evidence plus reviewed dependency revision; bounded preparatory exception as alternative | Prefer durable verifier bridge and revised definitions; no apply authority | [Governance resolution](GOVERNANCE_RESOLUTION.md) |

## Recommendation Summary

We have enough evidence to make concrete decisions. The [PR #48 assessment](PR48_MERGE_READINESS.md) recommends merge with residual risks disclosed. Its actual approval is separate from operator merge permission, and a merge would still require an exact-head/policy check and independent post-merge CI before closure.

For S2-A, I recommend better-sqlite3@13.0.3 in an owned worker and argon2@0.45.1 with 32 MiB/t3/p1, bounded 2 active + 4 queued. Verification p95 was 68.4 ms Windows/72.1 ms Linux; all 34 primitive checks passed per platform. The [measured decision matrix](proposals/s2a-foundations.md#validation-plan) records other profiles, memory/event-loop/SQLite/TLS results, methods, proposed thresholds and missing acceptance. Minimal Linux install failed without native build tooling; a build-capable disposable image succeeded. These facts support feasibility, not production readiness.

The [unapplied registration candidate](governance/registration-proposal.json) makes DMK-211 depend on architecture DMK-210 and moves full DMK-209 authorization after DMK-210/211/212, while preserving all full-authorization acceptance criteria and every existing item. Its PREVIEW succeeds and its graph is acyclic. The actual historical/forward verifier bridge and ratified application transaction remain future governed work.

## Next Decisions

1. **PR #48 merge only:** explicitly authorize or decline merging exact HEAD e33f5ea7869db34654c831550c91029e2236b789 by the ordinary policy-compliant process. Only after authorization, verify actual master/post-merge CI and add a new checkpoint. Halt on reviewed-head/material drift or failed CI.
2. **Governance preparation:** approve/revise the dependency definitions and authorize a separate historical/current verification-bridge candidate. Do not merge PR #34 or apply canonical bytes/receipts. Alternatively, explicitly decide the [bounded exception proposal](governance/preparatory-exception-proposal.json); it is unsigned and unapproved.
3. **S2-A code scope:** separately authorize the [implementation handoff](implementation/central-policy.md), exact private-store/native build/profile, browser issuer/trust/disabled boundary, offline authority/recovery custody, WBS prerequisites/exception, input/throttle/session rules, budgets and reviewer. Operational activation/enrollment/migration/grants/cutovers remain separate.

All 14 privileged registrations remain denied, live agents disabled, Gate 7 unexecuted and release unpromoted. No reviewer recommendation is treated as unrestricted implementation authority.
