# Authorization Sprint 2 evidence context

Target repository: Jeruzael/docmonstakrakin. Revision: `f35fa7bcd9fb00942c1bba76741a22a5cc7c80b8`; initial remote master matched exactly. No application-source drift. Scope is verification, additive documentation and a proposed design, not implementation or a sealed scan.

## Integrity inventory

Collection SHA-256: `1962ac92e9722d39185daecd99ad565b08c319bb38de8b27024bc517bb998864` over the UTF-8 [evidence manifest](evidence-manifest.json). Source hashes describe exact Git blob bytes at the recorded revision, independent of checkout line endings. Job-log hashes describe decoded captured log text. Probe hashes describe actual generated/executed bytes and observed results.

| Evidence item | Kind | SHA-256 |
| --- | --- | --- |
| `docs/00_control/MASTER_WBS.md` | source | `0ae57b33099a05f7d78445cfbd888797babffef259e967c04c96179afa17ea8f` |
| `docs/00_control/MASTER_WBS.yaml` | source | `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d` |
| `evidence/characterization-results.json` | experiment | `ea9a4e7c6aa72ae11d8bc46ab72789c8871f615806f4450b5fb22c1f74b5a241` |
| `evidence/characterization.log` | experiment | `c79c5bad94579ac2d4ec82e56fbe77d3d59c310217c431e68f28885196b6da16` |
| `evidence/probe-authorization-gaps.ts.txt` | experiment | `d4bc35ac64b8dbe1bd78c70ce891c790fb7f3e8310f0f61b292fcb15e539aa9a` |
| `github-actions/39190812393/job-117862968736.log` | decoded_job_log | `8da56aadcf7ca83e00b2bdeb9be4ef86ab1f5aee7c63585015808d49fde05d18` |
| `github-actions/39190812393/job-117862968788.log` | decoded_job_log | `50144fdd1b2c87665ed80fd06d36957ed100b3e99396fbdb4971cf4fa5e2b149` |
| `github-actions/39190812393/job-117862968907.log` | decoded_job_log | `a07c35362dcfdf13fd5845ebe8654165be5cf0a8df9bbca5c2f1cec467572e74` |
| `server.ts` | source | `8afda07a5fc8fdce00cb2c417219f48be41e9353b95452a786a14d55e00bcd5c` |
| `server/docs/controlledDocsRouter.ts` | source | `7fa11ece5291a09708eaa6f7d67f85c396e76c9ab5656b58808600911a56519a` |
| `server/projectPersistence.ts` | source | `2b4527819c151182df2dded78b86281d491abcfa00c20b3b2b6cc06188f49759` |
| `server/proposals/identity.ts` | source | `5dd62f2f16cac0fca7532e1a7274e5f27a18558866e1c7ffcf9ba935b5394297` |
| `server/proposals/review.ts` | source | `6cceff1dd4b98b46f43d969b31f22f9f9119034bf8ef1299f61beba6b2ab5a1f` |
| `server/proposals/signoff.ts` | source | `93d98cfde1edf42e11a212f2e9fa93b8c1f9f317c027a836440dae0a399f6622` |
| `server/release/releaseGateEvaluator.ts` | source | `24f87b06c064eeaaca986c72a2654e5a6e707e9010ee22f0a6c84b3dde71e626` |
| `server/security/apiRoutePolicy.ts` | source | `d0beb09d2068336bd1df10722e45da577ad11fac7a8a16c9297ae683e209d419` |

## Additional primary references

- [Actual APPROVED review](https://github.com/Jeruzael/docmonstakrakin/pull/46#pullrequestreview-5566365362): jianzhihuoxin, final HEAD `48c68ec46fa335504bb06c6a8d04a1e72dc7c78a`, `2026-10-19T02:36:17Z`.
- [Merge commit](https://github.com/Jeruzael/docmonstakrakin/commit/f35fa7bcd9fb00942c1bba76741a22a5cc7c80b8): `2026-10-19T02:37:01Z`, 44 seconds after approval.
- [Post-merge CI](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39190812393): push event on that exact merge, all 3 jobs successful.
- [PR #34](https://github.com/Jeruzael/docmonstakrakin/pull/34): open/unmerged at inspection, head `5912185a005df3e0469dd46392d7d0dbb0378b68`; read-only ownership/dependency evidence. Current master does not contain DMK-209–214 registration.
- Existing `docs/00_control/LOCAL_AUTH_WBS_OWNERSHIP_CANDIDATE.md`, `docs/06_planning/LOCAL_AUTH_ROLE_DELEGATION_TRACKING_CANDIDATE.md`, Stage B2b2-A candidates, and Agent Center v0.3 security-resolution matrix were inspected as planning constraints, not ratified production policy.

## Limits and assumptions

All 69 registrations were source-inventoried. Fifteen disposable actual-server characterization cases were run; not all routes were dynamically probed. General membership does not exist, so no actual operator membership was invented. Thirty-minute expiry was not time-travel tested. Performance/resource budgets and browser-HTTPS certificate trust remain unapproved. No new code, credentials, provider execution or runtime reconciliation is activated.
