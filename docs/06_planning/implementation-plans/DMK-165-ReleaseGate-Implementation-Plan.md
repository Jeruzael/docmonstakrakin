# DMK-165: v0.1 Definition-of-Done Review & Release Gate Implementation Plan
## Authoritative Engineering Execution Plan for v0.1 Release Gate

**Document ID:** PLAN-DMK-165  
**Work Item ID:** `DMK-165`  
**WBS Path:** `13.05.01`  
**Priority:** `P0` | **Risk:** `CRITICAL`  
**Target Milestone:** Milestone 4 (v0.1 Local-First MVP)  
**Parent Epic:** `EPIC-13` (Forms, Export, Secrets & Release Hardening)  
**Status:** `IN_PROGRESS`  
**Dependencies:** `DMK-159` (`VERIFIED`), `DMK-156` (`VERIFIED`)  
**Requirements:** `REQ-REL-001` (A-SSDLC v0.1 Definition-of-Done Release Gate)  
**Security Controls:** `SEC-CTRL-020` (Formal Multi-Party Release Sign-off & Audit Chain Certification)  
**Verification Method:** Release gate checklist audit, cryptographic audit chain verification, and automated evaluation suite (`TEST-165`).  

---

## 1. Scope and Objectives

Formally verify that docmonstakrakin v0.1 satisfies all 25 core MVP capabilities (Master Plan §68) and passes all 7 release gates (RELEASE_GATES.md):
1. **Gate 1:** Zero Unresolved Blocker Questions (All blocking discovery items resolved).
2. **Gate 2:** 100% Core Requirements Verification (All P0 requirements mapped to passing evidence).
3. **Gate 3:** Secret Store Integration Complete (`DMK-157` active with OS credential abstraction and zero plaintext leaks).
4. **Gate 4:** Security Regression Passing (`DMK-159` 41/41 passing).
5. **Gate 5:** Golden Reference Project Execution (`PRJ-ATLAS-01` canonical baseline complete).
6. **Gate 6:** Cryptographic Audit Ledger Integrity (`verifyAuditLedgerChain` with 0 breaks).
7. **Gate 7:** Security Lead DoD Sign-off (`DMK-165` signed into the immutable audit ledger).

---

## 2. Architectural Design & Deliverables

### A. Backend Gate Evaluation Engine (`server/release/releaseGateEvaluator.ts`)
- `evaluateReleaseGates(store, projectId)`: Evaluates all 7 gates deterministically against the in-memory canonical state.
- `executeReleaseSignoff(store, projectId, actor, notes)`: Verifies prerequisites, appends a cryptographically chained `RELEASE_GATE_APPROVED` audit event (`SEC-CTRL-013`), updates `DMK-165` to `VERIFIED`, and sets `releaseReadiness` to 100%.

### B. Express REST API Routes (`server.ts`)
- `GET /api/projects/:id/release/gates`: Retrieve the live 7-gate audit status and capability assessment.
- `POST /api/projects/:id/release/signoff`: Execute formal release sign-off by an authorized role (e.g. Project Lead / Security Lead).

### C. Automated Test Battery (`server/release/testReleaseGate.ts`)
- Unit and integration tests validating that:
  - All 7 gates evaluate correctly against the golden project state.
  - Artificially introducing an unresolved blocking question fails Gate 1.
  - Missing evidence on a requirement fails Gate 2.
  - Corrupting an audit event fails Gate 6.
  - Formal sign-off commits a tamper-evident audit record and achieves 100% release readiness.

### D. Frontend Presentation & Interaction
- In `DocumentsView.tsx`: Add a `RELEASE` projection tab displaying the live Markdown release readiness assessment and an interactive Release Gate Evaluation panel with one-click sign-off.
- Real-time refresh of project health and Recommended Next Action.

---

## 3. Definition of Done
- [ ] Release gate evaluator engine implemented in `server/release/releaseGateEvaluator.ts`.
- [ ] REST API routes `/api/projects/:id/release/gates` and `/api/projects/:id/release/signoff` wired in `server.ts`.
- [ ] Automated release gate test suite `server/release/testReleaseGate.ts` implemented and passing (100%).
- [ ] UI integration in `DocumentsView.tsx` with live 7-gate status and sign-off flow.
- [ ] Governance ledgers (`RELEASE_GATES.md`, `RELEASE_READINESS.md`, `RELEASE_HISTORY.md`, `MASTER_WBS.yaml`, `MASTER_WBS.md`, `PROJECT_STATE.md`) updated and synchronized.
- [ ] Evidence record `EV-165` created and formal sign-off audit event `AUD-920` committed.
