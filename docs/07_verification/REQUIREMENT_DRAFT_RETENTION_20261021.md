# Manual requirement draft retention — 2026-10-21

## Scope and baseline

Baseline: `ef160d4dea3122309687b1f44bb8972c07e879a5`. This bounded correction owns exactly four paths:

- `src/App.tsx`
- `src/components/RequirementsView.tsx`
- `scripts/testRequirementDraftRetention.ts`
- `docs/07_verification/REQUIREMENT_DRAFT_RETENTION_20261021.md`

Before combined qualification, the unpublished branch fast-forwarded normally to verified master `9a0054cd7875cd836ffde990607bb0d788806707`. Its seven incoming Reports paths were disjoint from this four-path patch. All 167 captured candidate/runtime files remained byte-identical through the fast-forward; the evidence is retained in `runtime/final-requirement-draft-gates/reconciliation`.

An independent signoff-recovery test race was then repaired in PR #72. With root authorization, this unpublished branch fast-forwarded again to `80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e` for qualification. **This baseline was an UNMERGED REPAIR CANDIDATE during the full run, not verified master.** All five incoming paths were disjoint, and all 170 captured candidate/runtime files remained byte-identical; see `runtime/final-requirement-draft-gates/repair-candidate-reconciliation`. Integration remains gated on the repair's actual post-merge CI; a clearly labeled dependent candidate may be published for CI before that gate. The focused results below remain tied to the original baseline; combined results identify the repair candidate explicitly.

The ordinary manual creation callback resolves on rejected HTTP responses and swallows transport failures. The form interprets resolution as success, clears the title, statement and rationale, and closes. A title containing `{{value}}` passes the form's nonempty check but is rejected by the existing server text validator. Category and priority must also survive a rejected submission.

The correction propagates unsuccessful creation, retains the complete draft with an actionable error, admits one submission synchronously, and clears the draft only after server acknowledgement. Pending fields and cancellation are disabled to avoid losing edits made while the submitted snapshot is in flight. The create POST has a 20-second client deadline; timeout restores the controls and qualifies the uncertain server outcome. Completion does not affect a replacement component or another project's form. No automatic POST retry is introduced.

No server endpoint, status transition, signoff writer, authentication policy, canonical document or WBS changes are in scope. Network failure can leave the server outcome unknown; this UI correction does not add server idempotency or claim exactly-once delivery.

## Verification design

`scripts/testRequirementDraftRetention.ts` mounts the actual App and RequirementsView through the existing isolated Vite fixture. It intercepts the API boundary, blocks off-origin browser requests, and uses no application server, credentials or native store. The 422 payload comes from the actual shared `validateText`/`DerivationError` implementation; this is not a claim that the browser suite executes the server route.

Eight cases cover all five draft fields under structured 422, non-JSON 503 and network abort; two synchronous submit events before React rerender; a held successful retry; late originating-project failure and success after selecting another project; and completion after a view unmount/remount. Background navigation deliberately dispatches DOM button clicks to exercise lifecycle boundaries through the actual App. It does not claim that an ordinary pointer can pass through the modal overlay.

The final suite adds two held-request cases: deadline while the original form is mounted, and deadline after App has unmounted it by selecting another project. The test declares the expected 20,000 ms policy, controls the actual browser AbortController signal instead of waiting 20 wall-clock seconds, and genuinely holds the API response. It then simulates a server committing after client cancellation. The edited draft and uncertainty message remain; another project's draft receives neither the originating result nor its error. Every control, including Cancel, is enabled after timeout. This verifies abort handling and declared timeout policy; it does not claim a wall-clock timing benchmark.

The browser cases require ordinary manual creation to remain `PROPOSED` with empty evidence and relationship arrays. Existing project loader/remount protections are exercised rather than replaced.

## Results

The initial mounted run reported 0/8 passing: five intended product failures plus three fixture-navigation failures. Playwright's forced pointer clicks still hit the modal overlay. The initial log is retained unchanged at `runtime/final-requirement-draft-gates/red/focused.log` (SHA-256 `e0c06e0c6b2327df606782e145f6b33bd5cfe586e262ea33aa93b01f5861306a`).

After correcting only fixture navigation to dispatch actual DOM button clicks, the full pre-implementation RED run reported **3/8 passing, 5/8 failing, exit 1**. The three lifecycle cases passed. The failures proved draft loss for 422, 503 and network rejection, two POST calls from same-turn submit events, and absence of the draft needed for retry. Log: `runtime/final-requirement-draft-gates/red-corrected-fixture/focused.log`, SHA-256 `5b2cd60950d0d6545304ad30fed589f5c7399840d07b8dd7a89096c257c98bce`; results JSON: `678ed9c276a7420863916679aba46ef149c1a104d18ef5f084a66f167f78e97e`.

Both runs used unchanged baseline production bytes: App SHA-256 `a5513e063560e46cf48cdf0f8eb998606651457d5b7562d8d8c2eb086f4108d4`; RequirementsView SHA-256 `3701ba1bdd768e7be87cd7283c94f73aa7af544b4c8a6e037e86ea786e32a829`. The original 627-file manifest is retained in `red/source-before.json`, SHA-256 `28168b2f6589dce78f74a331616624d5bbe2ff3fb1798c7323b1a24f5ccd70bd`.

Implementation began only after that RED run. The first GREEN passed **8/8**, and TypeScript passed with no diagnostics. Log SHA-256: `b74629710ae34a859c8d2894ff70db0fe68ff7d387a7e7633f42e27f5c921e96`; results SHA-256: `936ee3655f1af4bdc3087202d947aaf1c02be697e52004f616c9ac75225e6230`. Its complete source copy and 627-file manifest remain under `runtime/final-requirement-draft-gates/green` (manifest SHA-256 `8991e66403b156c4c2a0614875aaaa5d1ed31ac311269e2392238fb3b34edbe9`). TypeScript produced no output, so PowerShell Tee-Object created no empty log; the observed exit 0 is recorded in `green/execution.json` rather than represented as a missing diagnostics file.

Independent review identified a related pending-lock problem: an unbounded create request combined with disabled Cancel could trap the form. Before changing timeout behavior, the expanded suite reported **8/10 passing, 2/10 failing, exit 1**, both on the absent deadline. This RED is retained in `timeout-red/focused.log` (SHA-256 `ac1c8d5613e8ea2ff092a1b9d2854f29e81bcbc5afc0c30a44839106f86401bf`) and `timeout-red/results.json` (`89821d42d3f522b4e70a4ba269be1ceee6308b9b722306fbe7de47fd2539746f`).

After adding only the bounded POST signal and explicit timeout wording, final focused verification passed **10/10**, with **TypeScript exit 0** and **git diff --check exit 0**. Network and timeout messages explicitly say the saved outcome is unconfirmed and require refreshing/checking requirements before a manual retry. No endpoint or governance behavior changed.

| Final evidence | SHA-256 |
| --- | --- |
| `timeout-green/focused.log` | `7577cf2017fbe09c6f9c6fcda257afe353e20cb93ad43c27fe759b42d013f306` |
| `timeout-green/results.json` | `b6b035e31a7a452cf920fa237a620ea6a817b6f85a092027bec282ddd0bc2a00` |
| `timeout-green/execution.json` | `166db1be709d512dad613dc759d2b6c1b22439efdc795b0658ff76f097dde3d1` |
| `timeout-green/source-tested.json` (627 files, before this results-only addition) | `375e2d7d8c3db47bff708865c2c79b662c5f5d16b680af415241e6246c1eee9a` |
| `src/App.tsx` | `8e81e2b9e99c866fb9169d76111c17a50fb679ea4ef01440d3bf86b8cfe09e3a` |
| `src/components/RequirementsView.tsx` | `2ddfd32e626d1c96da409fbc1fb2584e7a19240a0d81a3f1909d6fb5e5b0ef88` |
| `scripts/testRequirementDraftRetention.ts` | `eaa5154dc3a32b6ffe5c6149933a779e7434fe5ffa9cf59165a8b6629017e017` |

Commands used the qualified portable Node 22.23.3 executable with existing dependencies: `node --import ./node_modules/tsx/dist/loader.mjs scripts/testRequirementDraftRetention.ts`, followed by `node node_modules/typescript/bin/tsc --noEmit`.

## Combined qualification on the unmerged repair candidate

The sequential run on `80b5eaaec09bcf31747d8c1e0acc83f6d6ccac1e` started at **2026-10-21 14:16:29 UTC** and finished at **14:23:33 UTC**. It used process-only `CI=true`, an empty provider key, portable Node 22.23.3 first in PATH, and the established Windows PowerShell module-path repair. Prior runtime outputs and `.local` were copied into owned backup directories before fresh synthetic preparation. No dependencies were installed.

- Complete regression: **87/87 suites, 2,165/2,165 checks, zero failures or skips**, exit 0.
- WBS synchronization, TypeScript, Vite build, server bundle and diff checks: **all exit 0**.
- Actual combined compatibility: requirement draft **10/10**, controlled version synchronization **50/50**, Reports **14/14** and projection **11/11**, release claims **21/21**; the existing local product journey also passed **9/9**.
- The controlled-document run reported **40/40 core**, **29/29 additional**, **11/11 focused**, all **28 registered documents untouched**, and **no snapshot mutation**. It was already part of the complete regression; no duplicate controlled-document run was performed.
- All **634 tracked/candidate source files** matched before and after. The fresh synthetic snapshot remained `5d6cf0c7c08e9f7d33607ec0fd88dbdf7901d06db2b60fc62f08ad2addf4f5fb`; state version 1, zero audit entries and zero active transactions remained unchanged. All **37 focused evidence files** and **131 historical runtime backup files** passed their byte-preservation checks.

Artifacts are under `runtime/final-requirement-draft-gates/full-repair-candidate`:

| Artifact | SHA-256 |
| --- | --- |
| `complete.log` | `4835e508f2a279c0c0ff1db961c4a8345900e14cecae5fd5dbaa27bffa1ee74d` |
| `rc-regression/results.json` | `bfb947dea48a6dc58dd30817ca22c75735c6ebcd71a6713fff5246f20765e1a6` |
| `execution.json` | `897bd8f14818bac40f4a0d83e5f6eca1680542603c8f960e272b8f387906a338` |
| `source-before.json` and `source-after.json` | `4ac4847fc5cb66480b7ea1fedcebc37750fe3dccff289029bd04fde661035d8a` |
| `wbs.log` | `ac0e7cb1e9ccf9843d12673ea6ea0d31c5df0d4b3183798b46896951c53e9f95` |
| `typescript.log` (empty, no diagnostics) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `vite-build.log` | `4a17134dac64e0bd815cb9bb1ede6e9cf34854d211624455d8e0059e757cbe90` |
| `server-build.log` | `d7f1ca92af39271b42e3991e6630a7c84f4927cc6f650e12b806e4e353e9dae7` |

Only this verification record received the results after the run. Runtime and test source stayed frozen. Independent read-only review closed the pending-lock issue and found no further actionable findings within this four-path scope. The results establish local candidate qualification, not merge approval or production activation.

Historical campaign evidence remains in its original runtime locations. New focused outputs use `runtime/requirement-draft-retention`; immutable run copies and source digests are retained under `runtime/final-requirement-draft-gates`. No dependency installation, package changes or publication is part of this record.
