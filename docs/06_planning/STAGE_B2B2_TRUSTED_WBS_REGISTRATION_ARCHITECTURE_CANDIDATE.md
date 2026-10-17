# Stage B2b2 — Trusted WBS Registration Architecture Candidate

**Status:** DESIGN_CANDIDATE / NO EXECUTION AUTHORITY  
**Baseline:** `master` `ab8feea59454ee68f1b84f96af2b0205fbd4ca0d` (PR #39 technical corrective merge)  
**Scope:** Designing the future protected canonical WBS registration pathway. **No implementation, credentials, enrollment, receipt issuance, WBS mutation, runtime apply or approval is authorized by this document.**

## Problem and existing verified boundary

Stage B2a verifies context-bound signed v2 registration evidence but receives purportedly trusted context from its caller. Stage B2b1 now validates canonical receipts, byte-exact ledger formats, acyclic WBS digest chains, and planned sequential registration with `mayApply: false`. These functions provide mathematics, **not a production trust root or transactional authorization**. Remaining empirical limitations: A13 duplicate raw JSON keys, B07 unverified historic ledger signatures, B09 stale snapshot replay, C07 non-atomic same-base candidates, and D01 caller-controlled trust context.

Historical DMK-196/197/208 governance receipts and 27-item EPIC-13 audit must remain immutable. PR #34's six proposed items DMK-209..214 and prospective 33-item WBS scope remain **blocked**.

## Proposed components and trust boundaries

| Component | Responsibility | Must never trust |
| --- | --- | --- |
| Policy authority | Independently ratified versioned policy SHA, required roles/quorum, per-human Ed25519 public keys, validity/revocation | Editable PR files, self-declared roles, agent-generated keys |
| Authentication boundary | Independently attribute **actual human** signer enrollment, custody and separation of duties | Multiple key IDs as proof of different humans |
| Evidence reader | Strict raw UTF-8 JSON with duplicate-key detection; canonical receipt digest and signature verification | Last-wins parsed JSON, extra keys, Git PR supplied expected context |
| Git provenance resolver | Authenticated repository ID, PR/base/head/tree, protected target branch HEAD and reviewer event | Self-supplied workflow dispatch variables, unchecked merge refs |
| Trusted clock | Explicitly authenticated clock snapshot and approval window | Caller-supplied `nowIso`, commit author timestamps as security oracle |
| Full-chain auditor | Check genesis, unique IDs, acyclic states, retained receipts and all historical signatures/policies | Ledger entries as sufficient cryptographic proof |
| Transaction authorizer | Fail-closed decision separate from `EVIDENCE_VERIFIED`, irreversible authorization receipt | `valid: true` or `mayApply:false` transformed to permission |
| CAS Git writer | Atomic protected-ref conditional update of WBS YAML, generated MD, canonical ledger and retained receipt | Unconditional push, self-approval, rebased approvals |
| Post-merge auditor | Independently verify branch tree, receipt/ledger SHA, WBS digests, CI, chronology | Caller-declared merge success |
| Runtime reconciler | Separate approved exact-candidate workitem preview/apply | PR merge or canonical WBS append as runtime authorization |

## Authoritative policy bootstrap / human ceremony (unresolved)

1. Ratify the human roles required for **this operation and risk tier**. Current charter identifies the Project Lead / Security Officer; a separate human Lead Architect co-signatory is not presently proven as ratified in the charter.
2. Authenticate and enroll physically distinct human principals with Ed25519 keys held outside the repository. Store **public** enrollment and revocation evidence separately from signing private keys.
3. Pin an independently ratified policy digest out of PR-controlled content. If using a GitHub Environment, ensure the authorized environment reviewer cannot be bypassed by PR workflows; define token scopes and access controls.
4. Decide policy rotation, emergency recovery, independent reviewer substitution and quorum changes; no single person can change both policy and registration without an independent control.

No production ceremony occurs until the above are independently reviewed and signed off. Test keys are not production keys.

## Authenticated PR provenance and race-safe transaction

1. Trigger an authorization workflow from trusted protected-branch code. Treat an ordinary `pull_request` CI run as **untrusted**, especially fork/PR changes to workflow/scripts. Restrict elevated job/token/secret access to a protected environment with independently approved entry.
2. Snapshot expected protected `master` full commit SHA and tree SHA, exact pre-WBS raw bytes and canonical ledger bytes/digests; verify signed intent's repository, PR number, reviewed candidate commit SHA and tree SHA from authenticated GitHub APIs.
3. Obtain human signatures on an **immutable reviewed registration intent** before attempting the write. Any modification, merge skew, target-branch divergence or policy change requires fresh review and signatures.
4. Run full-chain integrity audit against independently archived historical policy/receipt files; verify every entry's signature and WBS transition. Reject missing archive, differing signatures, stale/revoked status under the applicable historical policy, mismatched hashes, cycles and stale current state.
5. Generate complete proposed commit tree containing `docs/00_control/MASTER_WBS.yaml`, rendered `MASTER_WBS.md`, versioned `docs/00_control/consumed_wbs_receipts.json`, and `docs/07_verification/wbs-registration-receipts/<receiptId>.json`, with reviewed SHA and post-merge validation contract. Ledger genesis starts with the historical pinned `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`.
6. Conditional CAS against the exact protected master ref head: **one verified Git commit/tree update and one ref transition**. GitHub protected branch rules and status checks must govern any update. A local `git update-ref` CAS does **not** atomically update remote GitHub's branch; design an authorized remote protected-branch mechanism with actual ref-freshness enforcement. Do not use a privileged bypass of branch rules as a convenience.
7. If ref moved, abort; do not re-use original approvals or append ledger on a stale branch. Require re-review and a fresh exact signed intent after divergence. Reject a consumed `receiptId` atomically with the branch update.
8. Post-merge independently verify the deployed `master` commit/tree, exact receipt/ledger digests, current WBS, full-chain attestation and historical evidence unchanged. Leave runtime changes behind a separate governance gate.

**Avoid circular provenance**: Signed reviewed candidate head/tree refers to the approved pre-application tree; resulting commit/tree including receipt is distinct and must be post-attested. These identifiers must be explicitly versioned.

## B2b2 acceptance matrix (all fail-closed)

| ID | Scenario | Required decision |
| --- | --- | --- |
| TRUST-01 | PR changes or forges its own pinned policy | REJECT |
| TRUST-02 | One person signs with two distinct keys | REJECT without independently authenticated human identity/quorum |
| TRUST-03 | Revoked, expired, impersonated or missing required human | REJECT |
| GIT-01 | Caller swaps PR number / reviewed head / tree / target branch | REJECT |
| GIT-02 | Protected branch changes between preview and conditional write | CAS FAIL; no partial files |
| GIT-03 | PR-supplied workflow/code runs with elevated write secret | DENY by workflow architecture |
| TIME-01 | Expired approval or untrusted time source | REJECT |
| JSON-01 | Raw signed receipt has duplicate keys / BOM / noncanonical form | REJECT |
| LEDGER-01 | Historical receipt missing, forged or policy digest mismatched | REJECT |
| LEDGER-02 | Cyclic/disconnected hash chain or repeated receipt ID | REJECT |
| LEDGER-03 | Concurrent two receipts for same base | Exactly one eligible CAS; other ABORT |
| APPLY-01 | No human approval despite valid math | REJECT |
| APPLY-02 | WBS and ledger updated but retained receipt missing | REJECT transaction; no partial state |
| APPLY-03 | PR attempts unrelated changes or 27->33 without six approved items | REJECT |
| AFTER-01 | Post-merge tree/WBS hash or artifact differs from approved candidate | FAIL and block further applies |
| HIST-01 | Old DMK-196/197/208 snapshot receipt verifiers run on new 33-item WBS | Validate pinned historical bytes independently; preserve chronology |
| BOARD-01 | Newly registered YAML items silently mutate live local WorkItems | BLOCKED until separate exact human-approved reconciliation |

## Sequencing and authorization checkpoints

**B2b2-A — Trust & identity ADR:** human role/quorum ratification, independent policy pin/key lifecycle, root-of-trust threat model. Read-only planning and synthetic tests only.

**B2b2-B — Historical adapter & full-chain audit:** snapshot-grounded legacy receipt verification, retained signed-receipt schema and denial matrix. No canonical WBS changes.

**B2b2-C — Authenticated Git / clock / raw JSON:** trusted runner boundaries, provenance resolution, duplicate-key parse, clock evidence, negative tests. No high-privilege executor.

**B2b2-D — Transaction design & shadow mode:** propose CAS writer interface, atomic tree state proof, replay/idempotence and crash recovery using disposable synthetic Git fixtures only. Writer must be disabled against real `master`.

**B2b2-E — Production ratification:** separately signed human trust policy, enrolled distinct approvers, independently reviewed ruleset/permissions. Explicit go/no-go for controlled executor enablement.

**B2b2-F — PR #34 exact registration:** refresh six-item candidate, rebase/review/sign exact bytes, 33-item prospective UI tests and historical compatibility. Execute only under separately authorized application ceremony. Live runtime reconciliation is a further independent decision.

## Open architectural decisions requiring humans

1. Human co-signer identity/quorum, role independence and emergency recovery.
2. Which independent control protects the policy digest and enrolled key roster, including rotation and retention.
3. GitHub server-side protected-branch CAS feasibility under configured active ruleset (avoid assuming local `git update-ref` provides remote atomicity).
4. Exact ledger path: Stage B2b1 proposes `docs/00_control/consumed_wbs_receipts.json`; earlier report examples mention `docs/07_verification/wbs-receipt-ledger.json`. **Ratify one canonical path and one receipt schema** before implementation.
5. How to bind reviewed pre-application Git tree to resulting receipt-bearing commit without self-reference.
6. Historical signer revocation policy (verification at signing time versus present revocation).
7. Approval expiry and trusted time evidence under local-first operation.
8. Branch rule coverage (active ruleset exists but current branch endpoint shows `protected:false`, with a ruleset ref-condition ambiguity); independently confirm rules actually apply to `master` before enabling an executor.

**Decision:** `ARCHITECTURE_REVIEW_CANDIDATE / ALL_PRODUCTION_EXECUTION_BLOCKED`. No Stage B2b2 implementation or PR #34 registration authorized.
