# CryptoDemon release candidate remediation plan

**Goal:** Resolve the human QA defects in the supplied A–U specification without promoting the release.
**Architecture:** Shared pure initialization, validation, and applicability functions feed both API and UI. External proposals remain durable review sessions; explicit human dispositions create proposed artifacts through the existing canonical store and audit chain.
**Tech stack:** Existing TypeScript, Express, React, tsx regression harnesses; no new dependencies.
**Spec:** ../../07_verification/CRYPTODEMON_MANUAL_QA_REQUEST.txt

## Constraints

v0.1.0-rc1 remains RELEASE_CANDIDATE. Gate 7 remains HUMAN_APPROVAL_REQUIRED. v0.2 remains PLANNING / NOT READY. Preserve all historical evidence and fixture inputs. New IDs start at DMK-187 after checking the canonical ledger. Execute inline in this session; no Git mutation in the unrelated parent checkout.

## DMK-187 — Initialization and derivation (A–J)

- [ ] Add CryptoDemon fixture and reproduce recovery-question, template, standards and context contamination against production functions.
- [ ] Add maturity, editable assurance, deterministic risk, neutral wizard defaults and explicit technical selection normalization in src/data/projectInitialization.ts and src/types.ts.
- [ ] Centralize standards applicability; seed stable PRODUCT_BASELINE features; retain full project question catalog and filter against only current answers.
- [ ] Validate all textual substitutions before persistence; reject malformed candidates atomically.
- [ ] Add 19-domain coverage UI; remove browser fallback project creation and isolate project fetches.
- [ ] Run scripts/testCryptoDemon.ts and existing discovery/technical suites.

## DMK-188 — Import review and governance (K–Q)

- [ ] Reproduce missing import session API and unsafe duplicate-role quorum with HTTP tests.
- [ ] Add server/proposals/review.ts for parse/schema/semantic/assumption validation, individual disposition and proposed canonical artifact mapping.
- [ ] Preserve original JSON digest, original changes, reviewer modifications and canonical IDs; persist sessions with project state and portable packages.
- [ ] Add session history, review controls and navigation in Prompt Compiler; refresh all canonical consumers after acceptance.
- [ ] Validate sign-off targets, roles and distinct human reviewers; block direct import approval; show explicit Request Sign-Off controls and empty state.
- [ ] Run HTTP import, audit, restart, duplicate and quorum tests.

## DMK-189 — Context, release regression and evidence (R–U)

- [ ] Scope context using linked project features and full requirements; block unlinked implementation handoff; show selected and ratified architecture distinctly.
- [ ] Add isolated ledger work item with relevant fixture links and prove unrelated requirements omitted.
- [ ] Run npm test, every existing server test harness, fixture/inbound/governance/context tests, lint, build and WBS drift.
- [ ] Record exact results, root causes and 18-section report; synchronize WBS, QA registry, traceability, project state and handoff.
- [ ] Leave manual QA NOT_READY_FOR_SIGNOFF; report READY_FOR_RETEST only after checks pass. Human retest remains pending.
