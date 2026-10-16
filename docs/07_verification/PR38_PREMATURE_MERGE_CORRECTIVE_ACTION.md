# PR #38 Premature Merge — Corrective Action Record

**Status:** PREMATURE_MERGE / CORRECTIVE_ACTION_PENDING  
**Project:** PRJ-DOCMONSTAKRAKIN  
**Original PR:** https://github.com/Jeruzael/docmonstakrakin/pull/38  
**Original merged PR head:** `75e9dfb9dfafa2a65bf8954ca697be80624f37a5`  
**Actual merge commit:** `dfa1e170c5aae6e12824e7d75fcab53baa38fe17`  
**Merge type:** Ordinary Git merge commit with two parents (`ab6c1da2731da3290ee7f52fccf8272fc2f031ae` and `75e9dfb9dfafa2a65bf8954ca697be80624f37a5`), not a squash merge  
**GitHub merged_at (UTC):** `2026-10-16T01:41:19Z`  
**GitHub PR review submissions observed:** 0 (as of this assessment)  
**Original post-merge CI:** https://github.com/Jeruzael/docmonstakrakin/actions/runs/38836463384 — SUCCESS  
**Corrective PR:** https://github.com/Jeruzael/docmonstakrakin/pull/39  
**Corrective PR reviewed HEAD:** `9a7b52fac6d0df4c9e5536c07cfd831641ff7ec7`  
**Corrective PR CI evidence:** https://github.com/Jeruzael/docmonstakrakin/actions/runs/38910028915 — SUCCESS (Quality & Build: SUCCESS, Controlled Docs: SUCCESS, Complete Regression: SUCCESS; 62/62 suites, 1,440/1,440 assertions)  

## What occurred

PR #38 was merged using an ordinary Git merge commit with two parents (`dfa1e170c5aae6e12824e7d75fcab53baa38fe17`) before the previously identified security review corrections were incorporated into its merged head and before a recorded formal independent human review. The merged code remained a read-only preflight with unconditional `mayApply: false`; no production trust authority, runtime reconciliation or canonical WBS registration was part of that PR. The merged code nevertheless lacked strict canonical signed-receipt serialization, complete malformed-input handling, strict ledger schema checks, and successful multi-registration regression coverage.

The developer/agent later committed the corrections to the *already-merged feature branch* at `0da47fc772e5e2377f6cc80f73877b634467ed40` and `3f4cf5c7eff5dd051b9c1dfa7b11ffaae4ef5fe0`. Those commits were **not** included in PR #38's actual merge. Their separate workflow run https://github.com/Jeruzael/docmonstakrakin/actions/runs/38837622627 succeeded (62/62 suites, 1,440/1,440 recorded checks).

## Containment and corrective action

- Chosen recovery: forward-fix branch from merged `master`, not revert or rewrite history. The read-only helper has no applied WBS/receipt mutation pathway in this PR; this is not evidence of a production compromise.
- Corrective branch: `fix/pr38-postmerge-preflight-canonicalization-20261016`.
- Forward-port the **exact verified correction file bytes** for `scripts/planWbsRegistrationTransaction.ts`, `scripts/testPlanWbsRegistrationTransaction.ts`, and `docs/06_planning/WBS_REGISTRATION_TRANSACTION_PREFLIGHT_B2B1.md` from the agent's corrected branch commit `3f4cf5c7eff5dd051b9c1dfa7b11ffaae4ef5fe0`.
- Preserve the canonical WBS, original DMK-196/197/208 receipts, 27-item historical evidence, Gate 7, and release state unchanged.
- Corrective PR: https://github.com/Jeruzael/docmonstakrakin/pull/39. Evaluated HEAD: `9a7b52fac6d0df4c9e5536c07cfd831641ff7ec7`. GitHub CI run 38910028915 succeeded across all 3 jobs (Quality & Build, Controlled Docs, Complete Regression: 62/62 suites, 1,440/1,440 assertions). It is for independent technical and governance review, **not** self-approved.

## Remaining decision gates

1. Confirm exact corrective PR HEAD and GitHub Quality & Build, Controlled Docs, Complete Regression all PASS; compare corrected bytes to the source remediation.
2. Review canonical receipt/hash normalization, malformed inputs, strict ledger keys/order and two-successive-registration/replay tests.
3. Record actual human Security Officer/Lead Architect governance decisions according to ratified policy; **none may be fabricated, implied by CI, or backdated**.
4. Formal human review of the procedural deviation, documented corrective merge approval and closure decision.
5. Actual production key enrollment, authenticated policy trust root, atomic CAS receipt ledger and retained approval artifact remain Stage B2b blockers. PR #34 (DMK-209–214) remains unmerged; no local runtime synchronization permitted.

**Disposition:** `PREMATURE_MERGE / CORRECTIVE_ACTION_PENDING / HUMAN_GOVERNANCE_PENDING`. Green CI does not retrospectively authorize the original merge.