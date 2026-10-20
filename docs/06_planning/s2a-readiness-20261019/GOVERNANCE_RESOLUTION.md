# PR #34 governance resolution proposal

## Decision requested

**REVIEWABLE CANDIDATE ONLY — canonical WBS, historical receipts, PR #34 and live state remain unchanged.** We can resolve the sequencing mismatch in proposed definitions before registration, then repair the boundary between historical verification and current authorized state. I recommend that route over declaring partial containment complete.

The [revised six-item proposal](governance/registration-proposal.json) and [unapplied candidate YAML](governance/proposed-MASTER_WBS.yaml.txt) are review material. The .yaml.txt file is deliberately outside the canonical path. No authorization receipt or signature was generated; mayApply remains false.

## Reproduced failures and their actual causes

PR [#34](https://github.com/Jeruzael/docmonstakrakin/pull/34) is OPEN/UNMERGED at `5912185a005df3e0469dd46392d7d0dbb0378b68`, forked from `84dabf513354ad469e3ae3fdb3a95bfd111badbe`. Current master is `bf5d617fa5bb76323714cc21cc20270acd826616`. Its WBS files render consistently, but that does not satisfy governance or historical verification.

I reran the current verifiers against a disposable current-master clone containing only PR #34's exact two WBS blobs:

| Verifier | Observed failure | Source boundary requiring repair |
| --- | --- | --- |
| DMK-208 status audit | Scoped EPIC-13 item count 33 != expected 27 | scripts/verifyDmk208StatusAudit.ts:214–219 obtains current scoped items and applies the historical candidate's fixed count |
| DMK-197 closure | Current WBS digest e166f467… differs from historical post-closure 53050b92… | scripts/verifyDmk197Closure.ts:445–459 hashes current WBS against immutable closure evidence |
| DMK-196 closure | Current WBS digest e166f467… differs from historical post-apply c4bf5011… | scripts/verifyDmk196Closure.ts:173–194 permits the specific authenticated DMK-197 successor to 53050b92…, but no later registration successor |

These failures protect meaningful evidence. Changing 27 to 33 or replacing historical digests would make historical claims describe events that never happened. The current code conflates two questions: did a past closure verify against its actual snapshot, and is today's WBS an authorized successor? We should give each question an explicit result.

Existing tooling helps but is not an application authority. `verifyForwardWbsEvidence.ts` is a historical/v1 bridge; `verifyTrustedWbsRegistrationV2.ts` checks independently pinned policy, exact Git identity, time, distinct enrolled nonrevoked humans and replay ledger context, returning EVIDENCE_VERIFIED with mayApply=false. `planWbsRegistrationTransaction.ts` is preflight only, not an atomic consume/apply engine. The current Stage B2b2 operational trust/enrollment proposals remain unratified. Do not adopt them implicitly or use a GitHub APPROVED review as a WBS signature.

## Proposed forward-compatible verification strategy

We can introduce one shared historical/current evidence resolver, with explicit immutable inputs and no caller-selected “accept old state” escape hatch:

1. Load the existing historical post-DMK-197 snapshot and verify its pinned raw SHA-256 `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d`. Preserve all original receipts, candidate hashes, chronology and the DMK-196→197 transition chain byte-for-byte.
2. Evaluate each historical closure/audit against that verified historical view, keeping its original 27-item scope, status modes and receipt rules. DMK-196's existing c4bf5011…→53050b92… authenticated successor remains part of that historical proof. Do not point historical verifiers at a new unpinned snapshot or silently override live root paths.
3. Independently validate the current WBS. Unchanged 53050b92… may use HISTORICAL mode. Any successor must supply a complete contiguous chain of separately approved operations binding every pre/post byte digest, exact added item definitions, reviewed Git HEAD/tree/base, policy epoch, authentic signer/revocation/time context and consumed-receipt ledger.
4. For this registration, require additive-only semantics: unchanged root metadata and every existing item's complete canonical value; exactly six approved new IDs/paths/parents/requirements/dependencies, all PROPOSED. Derive today's EPIC-13 scope from those approved additions:27 historical + 6 registered = 33. A fixed total 33 alone is never approval evidence.
5. Return separate `historicalValid` and `currentForwardChainValid` results with their snapshot/chain digests. A valid past closure plus missing/invalid current evidence must fail the current-state gate. Shared resolver APIs should take validated evidence handles, not a general bypass boolean.
6. Wire DMK-196, DMK-197 and DMK-208 verifiers to that shared contract without loosening their receipt/signature checks. Re-render/check current Markdown separately. Any change to an existing item, dependency, status, trust policy or receipt requires its own authorized operation; ADD_WBS_ITEMS cannot smuggle those changes.
7. Only after separate implementation/security review, ratified trust/enrollment and exact transaction authorization may the governed CAS/atomic apply path consume a receipt and publish both WBS and ledger. A preview or pure verifier remains non-applying. Never manually project runtime WorkItems or treat canonical registration as live reconciliation.

The attractive part is continuity: we can preserve the old facts and still authorize new facts. The cost is owning the chain, trust-root resolver and cross-file transaction rather than sprinkling hash exceptions across three scripts. If the approved operation/schema cannot represent a proposed change, we must stop rather than reinterpret it as an additive registration.

## Exact dependency revision for human review

| Item | PR #34 proposal | Revised candidate | Consequence |
| --- | --- | --- | --- |
| DMK-209 full local API route authorization | dependencies [] | dependencies DMK-210/211/212 | Full authorization is a later acceptance milestone; loopback containment alone never satisfies it |
| DMK-210 architecture | dependencies [] | unchanged | Requires its own reviewed architecture/acceptance evidence; Option 2 selection is not canonical completion |
| DMK-211 persistent human identity/session | dependencies DMK-209/210 | dependencies DMK-210 | Removes dependency on final route cutover; existing verified perimeter containment is an explicit implementation precondition, not full DMK-209 completion |
| DMK-212 scoped RBAC/custom restrictions | dependencies DMK-210/211 | unchanged | Identity precedes membership/permission cutover |
| DMK-213 agent identity/delegation | dependencies DMK-212 | unchanged | Agent Center execution prerequisites remain additional gates |
| DMK-214 integration/migration verification | dependencies DMK-209/211/212/213 | unchanged | Final cross-workstream acceptance still requires full route authorization |

Human-readable IDs above mean DMK-210/211/212, etc.; the exact JSON/YAML uses complete IDs. All original stable IDs, paths, descriptions, acceptance criteria, requirement/security links, evidence fields and PROPOSED statuses are preserved. Only dependencies on the two still-unregistered candidate items DMK-209 and DMK-211 change. Once registered, future changes to them would need a separately governed update operation.

The resulting order is `DMK-210 → DMK-211 → DMK-212 → {DMK-209,DMK-213} → DMK-214`. This resolves the practical DMK-211 → DMK-209 cycle in the proposal without asserting that any item is READY, implemented or accepted.

## Concrete preview evidence

| Bytes | SHA-256 |
| --- | --- |
| Canonical master before | `53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d` |
| Original PR #34 candidate | `e166f4679a71e8cec45ec5e0c5dc60f0b12c8ade0ada4696339662e258132273` |
| Revised unapplied candidate | `a3d7de535fddd4ad2521335e8f9f333eabe1bde5a67747cf5fb466bb54a88ae9` |

The existing repository PREVIEW validator accepts the revised additive candidate: 69 → 75 top-level items, exactly DMK-209–214 added. A graph check finds no cycle. Negative checks reject missing approval evidence, a changed existing DMK-197 status and a manifest missing one addition. These are structural previews and negative controls, not a signed forward-chain acceptance or proof that the three historical verifiers have been repaired.

## Proposed implementation and acceptance gates

Prepare a separate verifier-only candidate first: shared historical/current resolver, explicit output semantics, integration in the three verifiers, and no canonical edits. Require tests for the unchanged historical baseline, historical receipt/snapshot tamper, missing/gapped/reordered chain, altered pre/post bytes, wrong reviewed HEAD/base/tree, expired/revoked/replayed/untrusted signer, missing ratified policy/clock/ledger, extra/missing/modified item and count-only substitution. An approved synthetic fixture may exercise cryptographic verification, but must be labeled test evidence and never installed as real governance authority.

Then review the exact registration bytes and generated Markdown under the applicable ratified governance process. Before applying, run all current historical and forward verifiers, WBS rendering, complete regression and independent human review against the final HEAD. Stage B2b2's actual apply/consume transaction and trust ceremonies remain separate prerequisites. Failures stop registration; do not edit historical receipts.

Canonical ownership remains DMK-197 VERIFICATION_PENDING, DMK-198 IN_PROGRESS (depends on DMK-197), DMK-206 BACKLOG (depends on DMK-197/198/208), and DMK-208 VERIFIED. Access-control work does not replace evidence adjudication, reviewer UX, canonical lifecycle or nondelegable human quorum. Release, Gate 7, live reconciliation and Agent Center remain untouched.

## Bounded exception alternative

If a properly authorized governance owner chooses preparation before registration, the [unsigned exception proposal](governance/preparatory-exception-proposal.json) limits a future authorization to one S2-A code/test PR with synthetic data, pinned dependencies, disabled operational behavior and an expiry. It grants no operator identity, live permission, migration, certificate installation, route cutover or canonical completion. It is not currently approved, and no receipt or signatures exist.

I recommend the dependency revision plus verifier bridge as the durable resolution. A narrowly bounded exception can only authorize its exact stated preparation after a separate competent human decision; it cannot ratify trust policy, lower human quorum or turn a missing canonical task into VERIFIED.
