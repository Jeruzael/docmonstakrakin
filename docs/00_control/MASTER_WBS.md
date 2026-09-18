# docmonstakrakin Master Work Breakdown Structure (WBS)
## Authoritative Engineering Task & Decomposition Catalog

> **AUTO-GENERATED FILE — DO NOT EDIT MANUALLY**  
> Generated deterministically from canonical structured source: [`docs/00_control/MASTER_WBS.yaml`](./MASTER_WBS.yaml)  
> Run `npm run wbs:render` to regenerate, or `npm run wbs:check` to verify synchronization.

**Document ID:** DOC-CTRL-003  
**Machine-Readable Source of Truth:** [`docs/00_control/MASTER_WBS.yaml`](./MASTER_WBS.yaml)  
**Baseline:** v0.1.0-rc1 (Technically Verified Release Candidate; Gate 7 Human Sign-off Pending)  
**Release Status:** `TECHNICALLY_VERIFIED_RELEASE_CANDIDATE`  
**Gate 7 Status:** `HUMAN_APPROVAL_REQUIRED`  
**Manual QA Status:** `NOT_READY_FOR_SIGNOFF`  
**Remediation Status:** `READY_FOR_RETEST`  
**Status Standard:** `PROPOSED` | `READY` | `IN_PROGRESS` | `BLOCKED` | `IMPLEMENTED` | `VERIFICATION_PENDING` | `VERIFIED` | `DEFERRED` | `CANCELLED`  

---

## 1. WBS Architecture & Hierarchy

The Master WBS follows a strict 6-tier decomposition:
$$\text{Project} \longrightarrow \text{Phase} \longrightarrow \text{Epic/Capability} \longrightarrow \text{Feature} \longrightarrow \text{Work Package} \longrightarrow \text{Atomic Task}$$

Permanent **DMK IDs** identify tasks immutably across re-organizations. The **WBS Path** (e.g. `13.03.01.01`) represents the current hierarchical location within the lifecycle.

---

## 2. Phase & Epic Summary

| WBS Prefix | Phase ID | Capability / Epic | Focus Area | Status Summary |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Phase 0 | `EPIC-01` | Foundation & Engineering Baseline | `IMPLEMENTED` (Test harness in `READY`) |
| **02** | Phase 1 | `EPIC-02` | Canonical Project Core | `IMPLEMENTED` |
| **03** | Phase 2 | `EPIC-03` | Requirements & Discovery Engine | `IMPLEMENTED` / `VERIFIED` |
| **04** | Phase 3 | `EPIC-04` | A-SSDLC Lifecycle & Risk Engine | `IMPLEMENTED` |
| **05** | Phase 4 | `EPIC-05` | Standards Registry & Pinning | `IMPLEMENTED` |
| **06** | Phase 5 | `EPIC-06` | Prompt Compiler & Validation | `IMPLEMENTED` |
| **07** | Phase 6 | `EPIC-07` | AI Gateway (Codex & Gemini) | `IMPLEMENTED` |
| **08** | Phase 7 | `EPIC-08` | Work Management Projections | `IMPLEMENTED` |
| **09** | Phase 8 | `EPIC-09` | Repository, Git & Command Safety | `IMPLEMENTED` / `VERIFIED` |
| **10** | Phase 9 | `EPIC-10` | Evidence, Audit & Traceability | `IMPLEMENTED` / `VERIFIED` |
| **11** | Phase 10 | `EPIC-11` | Standards Update & Migration | `IMPLEMENTED` / `VERIFIED` |
| **12** | Phase 11 | `EPIC-12` | Dashboard & Next Safe Action | `IMPLEMENTED` |
| **13** | Phase 12 | `EPIC-13` | Forms, Export, Secrets & Release | `VERIFIED` (Automated remediation); human retest `READY`; Gate 7 pending |
| **14** | Phase 13 | `EPIC-14` | Multi-Agent Collaboration & Peer Trust | `PROPOSED` (Planning Milestone) |
| **15** | Phase 14 | `EPIC-15` | Encrypted Sync Gateway & Transport Abstraction | `PROPOSED` (Planning Milestone) |
| **16** | Phase 15 | `EPIC-16` | Post-MVP Integrations & Extensibility | `PROPOSED` (Planning Milestone) |
| **17** | Phase 16 | `EPIC-17` | v0.2 Governance, Verification & Milestone Closure | `PROPOSED` (Planning Milestone) |

---

## 3. Active & Pending Task Catalog (Epics 01 through 13)

### Epic 13: Forms, Export, Secrets & Release

#### `DMK-190` — Explicit external proposal schema 1.1 and MODIFY target validation
- **WBS Path:** `13.06.04`
- **Type:** `BUG` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-RC-190, docs/07_verification/rc-regression/results.json`)
- **Dependencies:** `DMK-188`
- **Requirements:** `REQ-RC-190` | **Architecture:** `CMP-01`, `CMP-02`, `CMP-04` | **Controls:** `SEC-CTRL-013`, `SEC-CTRL-017`, `SEC-CTRL-020`
- **Acceptance Criteria:**
  - "Prose validation, distinct proposal/target IDs, scoped manifests, typed targets, structured errors, v1.0 compatibility and immutable proposed amendments"
- **Verification Method:** scripts/testProposalContract.ts; scripts/testCryptoDemonIntegration.ts; npm run lint; npm run build; npm run test

#### `DMK-191` — Gio CryptoDemon human browser retest
- **WBS Path:** `13.06.05`
- **Type:** `QUALITY` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `READY`
- **Dependencies:** `DMK-187`, `DMK-188`, `DMK-189`, `DMK-190`
- **Requirements:** `REQ-RC-189`, `REQ-RC-190` | **Architecture:** `CMP-01`, `CMP-04` | **Controls:** `SEC-CTRL-020`
- **Acceptance Criteria:**
  - "Human repeats supplied CryptoDemon wizard, discovery, import/review and sign-off checks; records new evidence without executing Gate 7"
- **Verification Method:** docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md human retest checklist

#### `DMK-187` — CryptoDemon project initialization and derivation remediation
- **WBS Path:** `13.06.01`
- **Type:** `BUG` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-RC-187, docs/07_verification/rc-regression/results.json`)
- **Dependencies:** `DMK-186`
- **Requirements:** `REQ-RC-187` | **Architecture:** `CMP-01`, `CMP-04` | **Controls:** `SEC-CTRL-004`, `SEC-CTRL-020`
- **Acceptance Criteria:**
  - "User QA specification A-J: isolated inputs, 8 proposed features, honest discovery and validated derivation"
- **Verification Method:** scripts/testCryptoDemon.ts and HTTP regression

#### `DMK-188` — External AI review sessions and explicit human sign-off remediation
- **WBS Path:** `13.06.02`
- **Type:** `BUG` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-RC-188, docs/07_verification/rc-regression/results.json`)
- **Dependencies:** `DMK-120`
- **Requirements:** `REQ-RC-188` | **Architecture:** `CMP-01`, `CMP-02`, `CMP-04` | **Controls:** `SEC-CTRL-013`, `SEC-CTRL-020`
- **Acceptance Criteria:**
  - "User QA specification K-Q: durable staging, per-change review, provenance, proposed artifacts, distinct human quorum"
- **Verification Method:** scripts/testCryptoDemonIntegration.ts

#### `DMK-189` — CryptoDemon task context and release regression verification
- **WBS Path:** `13.06.03`
- **Type:** `QUALITY` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-RC-189, docs/07_verification/rc-regression/results.json`)
- **Dependencies:** `DMK-187`, `DMK-188`
- **Requirements:** `REQ-RC-189` | **Architecture:** `CMP-01`, `CMP-04` | **Controls:** `SEC-CTRL-020`
- **Acceptance Criteria:**
  - "User QA specification R-U: linked implementation context, complete automated battery and honest pending human retest"
- **Verification Method:** npm test, complete server battery, lint, build, wbs:check

#### `DMK-150` — Define Google Forms export mapping from internal question types
- **WBS Path:** `13.01.01`
- **Type:** `FEATURE` | **Priority:** `P1` | **Risk:** `MEDIUM`
- **Status:** `PROPOSED`
- **Dependencies:** `DMK-020`
- **Requirements:** `REQ-EXT-001` | **Architecture:** `CMP-02`
- **Description:** Mapping internal question schemas to Google Forms JSON structure.
- **Acceptance Criteria:**
  - "Specification mapping question options to Google Forms payload"
- **Verification Method:** Schema mapping unit test

#### `DMK-156` — Implement portable .docmonstakrakin project package
- **WBS Path:** `13.02.03`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-156`)
- **Dependencies:** `DMK-010`, `DMK-114`
- **Requirements:** `REQ-DATA-004` | **Architecture:** `CMP-04` | **Controls:** `SEC-CTRL-018`
- **Description:** Single-file bundle containing full project state, standards locks, and audit chains.
- **Acceptance Criteria:**
  - "Export/import roundtrip produces identical SHA-256 state hash"
- **Verification Method:** Deterministic state hash serialization & server integration test suite passed (16/16)

#### `DMK-157` — SecretStore Capability & OS Credential Abstraction
- **WBS Path:** `13.03.01`
- **Type:** `SECURITY` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `VERIFIED` (Evidence: `EV-157`)
- **Dependencies:** `DMK-007`
- **Requirements:** `REQ-SEC-014` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-017`
- **Description:** Pluggable driver interface for OS keychain, Windows Credential Manager, and Linux libsecret with fallback.
- **Acceptance Criteria:**
  - "Pluggable SecretStore interface"
  - "Zero plaintext secrets in .env or logs"
- **Verification Method:** Secret storage test
- **Atomic Subtask Decomposition:**
  1. **`DMK-157.1` (`VERIFIED` / P0 / HIGH):** Define SecretStore domain contract and metadata model in TypeScript (Evidence: `EV-157-1`).
  2. **`DMK-157.2` (`VERIFIED` / P0 / HIGH):** Implement encrypted local file fallback driver with AES-256-GCM (Evidence: `EV-157-2`).
  3. **`DMK-157.3` (`VERIFIED` / P1 / HIGH):** Implement OS native keychain adapter interface (Evidence: `EV-157-3`).
  4. **`DMK-157.4` (`VERIFIED` / P0 / HIGH):** Integrate SecretStore driver factory and environment resolution (Evidence: `EV-157-4`).
  5. **`DMK-157.5` (`VERIFIED` / P0 / CRITICAL):** Add secret redaction filters to server logging and audit pipelines (Evidence: `EV-157-5`).

#### `DMK-158` — OS Credential Migration & Key Rotation Ceremony
- **WBS Path:** `13.03.02`
- **Type:** `SECURITY` | **Priority:** `P2` | **Risk:** `MEDIUM`
- **Status:** `VERIFIED` (Evidence: `EV-158`)
- **Dependencies:** `DMK-157`
- **Requirements:** `REQ-SEC-014` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-017`
- **Description:** Automated migration script to transition legacy environment variables into SecretStore with audit verification.
- **Acceptance Criteria:**
  - "Zero plaintext secrets remaining in .env"
  - "Cryptographic proof of migration recorded in audit ledger"
- **Verification Method:** Credential migration dry-run and server integration test suite passed (11/11)

#### `DMK-159` — Security Regression Test Suite
- **WBS Path:** `13.04.01`
- **Type:** `QUALITY` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `VERIFIED` (Evidence: `EV-159`)
- **Dependencies:** `DMK-157`, `DMK-110`
- **Requirements:** `REQ-TEST-002` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-004`, `SEC-CTRL-011`, `SEC-CTRL-012`, `SEC-CTRL-013`
- **Description:** Automated regression tests covering path boundaries, command sandboxing, and audit immutability.
- **Acceptance Criteria:**
  - "Passes path traversal attack suite"
  - "Passes command injection attack suite"
  - "Passes cryptographic audit hash chain verification suite"
- **Verification Method:** Security test suite execution

#### `DMK-165` — v0.1 Definition-of-Done Review & Release Gate
- **WBS Path:** `13.05.01`
- **Type:** `RELEASE` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `VERIFIED` (Evidence: `EV-165`)
- **Dependencies:** `DMK-159`, `DMK-156`
- **Requirements:** `REQ-REL-001` | **Architecture:** `CMP-01`, `CMP-02` | **Controls:** `SEC-CTRL-020`
- **Description:** Formal sign-off of all 25 core capabilities from Master Plan §68 before v0.1 release tagging.
- **Acceptance Criteria:**
  - "100% of 25 MVP capabilities verified with evidence"
  - "Release sign-off recorded in audit ledger"
- **Verification Method:** Release gate checklist audit

### Epic 01: Foundation & Engineering Baseline

#### `DMK-001` — Create monorepo and root project conventions
- **WBS Path:** `01.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `IMPLEMENTED`
- **Requirements:** `REQ-OPS-001` | **Architecture:** `CMP-01` | **Controls:** `SEC-CTRL-001`
- **Description:** Establish project folder layout, Vite/Express server configurations, and TypeScript configs.
- **Acceptance Criteria:**
  - "Project tree matches approved structure"
  - "TypeScript strict compilation succeeds"
- **Verification Method:** tsc --noEmit && npm run build

#### `DMK-002` — Scaffold Express backend application service
- **WBS Path:** `01.01.02`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-001`
- **Requirements:** `REQ-OPS-001` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-002`
- **Description:** Node/Express backend serving REST APIs on port 3000 with Vite middleware.
- **Acceptance Criteria:**
  - "Server listens on 0.0.0.0:3000"
  - "API endpoints return JSON responses"
- **Verification Method:** Health endpoint check

#### `DMK-003` — Scaffold React TypeScript frontend application
- **WBS Path:** `01.01.03`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-001`
- **Requirements:** `REQ-UX-001` | **Architecture:** `CMP-01`
- **Description:** Vite React 19 SPA with Tailwind CSS design tokens and responsive shell.
- **Acceptance Criteria:**
  - "React shell renders without console errors"
  - "Theme tokens adhere to calm enterprise design spec"
- **Verification Method:** Browser rendering inspection

#### `DMK-004` — Configure persistent data schema and in-memory store
- **WBS Path:** `01.01.04`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-002`
- **Requirements:** `REQ-DATA-001` | **Architecture:** `CMP-04` | **Controls:** `SEC-CTRL-010`
- **Description:** Establish initial domain data structures in initialData.ts with deterministic ID schemas.
- **Acceptance Criteria:**
  - "Canonical schemas cover projects, questions, requirements, risks, work items, and evidence"
- **Verification Method:** TypeScript type check and data schema validation

#### `DMK-005` — Establish automated test harness
- **WBS Path:** `01.01.05`
- **Type:** `INFRASTRUCTURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `READY`
- **Dependencies:** `DMK-002`, `DMK-003`
- **Requirements:** `REQ-TEST-001` | **Architecture:** `CMP-01`, `CMP-02` | **Controls:** `SEC-CTRL-004`
- **Description:** Configure unit and integration testing framework.
- **Acceptance Criteria:**
  - "Vitest/Jest harness configured with npm test script"
- **Verification Method:** npm test command execution

#### `DMK-007` — Implement typed configuration and environment handling
- **WBS Path:** `01.02.01`
- **Type:** `SECURITY` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-157`)
- **Dependencies:** `DMK-002`
- **Requirements:** `REQ-OPS-001`, `REQ-SEC-014` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-017`
- **Description:** Implement typed configuration schemas, process.env validation, and environment isolation.
- **Acceptance Criteria:**
  - "Configuration is strongly typed"
  - "Missing required environment variables fail fast"
  - "Zero plaintext secrets leakage"
- **Verification Method:** SecretStore configuration bootstrap tests & environment validation

### Epic 02: Canonical Project Core

#### `DMK-010` — Define Project aggregate and canonical project schema
- **WBS Path:** `02.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-004`
- **Requirements:** `REQ-DATA-001` | **Architecture:** `CMP-04`
- **Description:** Unified TypeScript Project interface in src/types.ts with profiles, intent, and health metrics.
- **Acceptance Criteria:**
  - "Complete Project schema covering all required lifecycle metadata"
- **Verification Method:** Type-check verification

#### `DMK-017` — Build project creation wizard UI with multi-step flow
- **WBS Path:** `02.01.02`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-010`
- **Requirements:** `REQ-UX-002` | **Architecture:** `CMP-01`
- **Description:** Interactive modal in ProjectWizard.tsx supporting name, profiles, delivery method, and sensitivity.
- **Acceptance Criteria:**
  - "Multi-step modal captures profile flags and initializes project aggregate"
- **Verification Method:** UI creation flow inspection

### Epic 03: Requirements & Discovery Engine

#### `DMK-020` — Define Question, QuestionGroup, condition, and response schemas
- **WBS Path:** `03.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-010`
- **Requirements:** `REQ-REQ-001` | **Architecture:** `CMP-04`
- **Description:** Conditional question graph model with importance levels and blocker classification.
- **Acceptance Criteria:**
  - "Question schemas include required_when conditional logic and standards links"
- **Verification Method:** Graph evaluation test

#### `DMK-027` — Build adaptive questionnaire UI with 70/30 split layout
- **WBS Path:** `03.01.02`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-020`
- **Requirements:** `REQ-UX-003` | **Architecture:** `CMP-01`
- **Description:** QuestionnaireView.tsx displaying question prompts, context side-panel, and blocker tags.
- **Acceptance Criteria:**
  - "70% question form, 30% contextual guidance panel"
  - "Answering questions updates project readiness score dynamically"
- **Verification Method:** Interactive questionnaire testing

#### `DMK-186` — Implement Adaptive Question Navigation & Dynamic Branch Evaluation Engine
- **WBS Path:** `03.01.03`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `MEDIUM`
- **Status:** `VERIFIED` (Evidence: `EV-186`)
- **Dependencies:** `DMK-020`, `DMK-027`
- **Requirements:** `REQ-REQ-001` | **Architecture:** `CMP-01`, `CMP-04` | **Controls:** `SEC-CTRL-004`
- **Description:** Build dynamic condition-based question skipping, profile-aware filtering, and branch navigation for discovery interviews.
- **Acceptance Criteria:**
  - "Questions skip deterministically when dynamic conditions evaluate to false"
  - "Branch navigation updates current question pointer without invalid state transitions"
  - "Derived requirements reflect active answers only with honest provenance"
- **Verification Method:** Automated discovery test suite (scripts/testDiscoveryRemediation.ts) (EV-186)

### Epic 04: A-SSDLC Lifecycle & Risk Engine

#### `DMK-033` — Define A-SSDLC phase and lifecycle-state models
- **WBS Path:** `04.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-010`
- **Requirements:** `REQ-GOV-001` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-005`
- **Description:** 15 discrete lifecycle phases with machine-readable entry and exit criteria.
- **Acceptance Criteria:**
  - "Phase transitions validate blocker questions and risk thresholds"
- **Verification Method:** State machine policy tests

#### `DMK-038` — Implement mandatory risk-floor policy rules
- **WBS Path:** `04.01.02`
- **Type:** `SECURITY` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-033`
- **Requirements:** `REQ-SEC-001` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-006`
- **Description:** Non-negotiable risk minimums imposed on projects handling PII, financial data, or autonomous agents.
- **Acceptance Criteria:**
  - "Autonomous agent + production access forces CRITICAL risk floor"
- **Verification Method:** Risk engine scoring test

#### `DMK-041` — Implement override and risk-acceptance workflow with reason and expiry
- **WBS Path:** `04.01.03`
- **Type:** `GOVERNANCE` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-033`
- **Requirements:** `REQ-GOV-002` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-007`
- **Description:** OverrideModal.tsx allowing authorized users to temporarily bypass gates with auditable justification.
- **Acceptance Criteria:**
  - "Overrides record actor, expiration timestamp, and acknowledged risks"
  - "Override appends event to audit ledger"
- **Verification Method:** Override creation test

### Epic 07: AI Gateway (Codex & Gemini)

#### `DMK-079` — Implement Gemini provider adapter via Google Gen AI SDK
- **WBS Path:** `07.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-002`
- **Requirements:** `REQ-AI-001` | **Architecture:** `CMP-05` | **Controls:** `SEC-CTRL-014`
- **Description:** Server-side integration in server.ts utilizing @google/genai with structured JSON schema output.
- **Acceptance Criteria:**
  - "Server-only API key handling"
  - "Schema-constrained structured output generation"
- **Verification Method:** Inference API test

#### `DMK-081` — Implement independent second-agent review orchestration
- **WBS Path:** `07.03.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-079`
- **Requirements:** `REQ-AI-007`, `REQ-SEC-019` | **Architecture:** `CMP-05` | **Controls:** `SEC-CTRL-015`
- **Description:** Secondary model evaluation pipeline cross-checking proposals against security rules without scratchpad leakage.
- **Acceptance Criteria:**
  - "Secondary reviewer invoked independently"
  - "Dedicated critique card rendered in AgentCenterView.tsx"
- **Verification Method:** Dual-agent test run EV-106

### Epic 08: Work Management Projections

#### `DMK-085` — Define canonical WorkItem schema and parent-child hierarchy
- **WBS Path:** `08.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `IMPLEMENTED`
- **Dependencies:** `DMK-010`
- **Requirements:** `REQ-WORK-001` | **Architecture:** `CMP-04`
- **Description:** Single unified WorkItem model in src/types.ts powering Kanban, WBS, Product Backlog, and Sprints.
- **Acceptance Criteria:**
  - "Unified WorkItem model with priority, risk, requirements, tests, evidence links"
- **Verification Method:** Type check and view consistency check

### Epic 09: Repository, Git & Command Safety

#### `DMK-105` — Implement controlled branch creation and branch-policy checks
- **WBS Path:** `09.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-103, EV-159`)
- **Dependencies:** `DMK-002`
- **Requirements:** `REQ-OPS-001` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-011`, `SEC-CTRL-012`
- **Description:** Inspect local git status, log, and diff; enforce controlled branch naming and policy checks without unapproved subcommands.
- **Acceptance Criteria:**
  - "Inspect local git status, log, and diff"
  - "Reject invalid branch names, metacharacters, and flag injection"
- **Verification Method:** Git command sandbox & security regression suite (EV-103, EV-159)

#### `DMK-110` — Implement controlled local command runner with resource constraints
- **WBS Path:** `09.02.01`
- **Type:** `SECURITY` | **Priority:** `P0` | **Risk:** `CRITICAL`
- **Status:** `VERIFIED` (Evidence: `EV-103, EV-159`)
- **Dependencies:** `DMK-105`
- **Requirements:** `REQ-OPS-001` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-011`, `SEC-CTRL-012`, `SEC-CTRL-013`
- **Description:** Controlled command runner with path boundary enforcement, command confirmation prompt, and shell injection defense.
- **Acceptance Criteria:**
  - "Command execution confirms before running"
  - "Disallows shell chaining, redirection, and traversal escapes"
- **Verification Method:** Security regression suite & server security integration tests (EV-159)

### Epic 10: Evidence, Audit & Traceability

#### `DMK-114` — Define Evidence model, evidence types, producers, hashes, and work links
- **WBS Path:** `10.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-101, EV-156`)
- **Dependencies:** `DMK-010`
- **Requirements:** `REQ-DATA-001`, `REQ-DATA-004` | **Architecture:** `CMP-04` | **Controls:** `SEC-CTRL-010`, `SEC-CTRL-018`
- **Description:** Define Evidence model, SHA-256 cryptographic verification, evidence attachment, and status transition guards.
- **Acceptance Criteria:**
  - "Evidence model captures SHA-256 hash, timestamps, producers, and work links"
  - "Tasks cannot transition to VERIFIED without attached evidence"
- **Verification Method:** Data model validation & package verification tests (EV-101, EV-156)

#### `DMK-120` — Extend audit ledger for human decisions, approvals, and overrides
- **WBS Path:** `10.02.01`
- **Type:** `SECURITY` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-159`)
- **Dependencies:** `DMK-114`
- **Requirements:** `REQ-OPS-001`, `REQ-SEC-014` | **Architecture:** `CMP-02` | **Controls:** `SEC-CTRL-019`, `SEC-CTRL-020`
- **Description:** Append-only SHA-256 hash-chained cryptographic audit ledger recording decisions, overrides, and release events.
- **Acceptance Criteria:**
  - "Every audit record contains cryptographic hash linked to previous record"
  - "Tamper detection identifies altered or deleted events"
- **Verification Method:** Cryptographic hash chain verification & tamper test suite (EV-159)

### Epic 11: Standards Update & Migration

#### `DMK-126` — Implement standards update checker against configured trusted sources
- **WBS Path:** `11.01.01`
- **Type:** `FEATURE` | **Priority:** `P0` | **Risk:** `HIGH`
- **Status:** `VERIFIED` (Evidence: `EV-104`)
- **Dependencies:** `DMK-041`
- **Requirements:** `REQ-DATA-001` | **Architecture:** `CMP-04` | **Controls:** `SEC-CTRL-010`
- **Description:** Standards update checker, candidate version parsing, and semantic diff preview modal.
- **Acceptance Criteria:**
  - "Check for standards updates and preview semantic diff (added/modified/deprecated)"
- **Verification Method:** Standards update checker & diff modal tests (EV-104)

---

## 4. Milestone v0.2 Candidate Task Catalog (Epics 14–17 / Planning Phase)

*Note: In accordance with project governance, all v0.2 tasks reside in `PROPOSED` status. No work items may be marked `READY` or `IN_PROGRESS` until the v0.2 Implementation Entry Gate is officially ratified.*

### Epic 14: Multi-Agent Collaboration & Peer Trust
- **`DMK-166` (14.01.01, P0, CRITICAL, `PROPOSED`):** Multi-Peer Ed25519 Identity Model & Keyring (`REQ-COLLAB-001`, `CMP-07`, `SEC-CTRL-021`).
- **`DMK-167` (14.01.02, P0, CRITICAL, `PROPOSED`):** Scoped Agent Delegation Token & Capability Matrix (`REQ-COLLAB-002`, `CMP-07`, `SEC-CTRL-024`).
- **`DMK-168` (14.01.03, P1, HIGH, `PROPOSED`):** Peer Role Authorization & Team Membership Ledger (`REQ-COLLAB-001`, `CMP-07`, `SEC-CTRL-022`, `SEC-CTRL-023`).
- **`DMK-169` (14.02.01, P1, HIGH, `PROPOSED`):** Multi-Agent Sub-Task Assignment & Handshake Protocol (`REQ-COLLAB-002`, `CMP-05`, `CMP-07`, `SEC-CTRL-024`).
- **`DMK-170` (14.02.02, P1, HIGH, `PROPOSED`):** Dual-Agent Asymmetric Verification Gateway (`REQ-AI-007`, `CMP-05`, `SEC-CTRL-015`).
- **`DMK-171` (14.03.01, P0, CRITICAL, `PROPOSED`):** Shared Artifact Prompt Injection Sanitization Filter (`REQ-SEC-033`, `CMP-05`, `SEC-CTRL-033`).

### Epic 15: Encrypted Sync Gateway & Transport Abstraction
- **`DMK-172` (15.01.01, P0, CRITICAL, `PROPOSED`):** End-to-End Zero-Knowledge Encrypted Envelope Protocol (`REQ-SYNC-001`, `REQ-SEC-021`, `CMP-06`, `SEC-CTRL-029`).
- **`DMK-173` (15.01.02, P0, HIGH, `PROPOSED`):** Offline Mutation Outbox & Monotonic Vector Clock Generator (`REQ-SYNC-002`, `CMP-06`, `SEC-CTRL-030`).
- **`DMK-174` (15.02.01, P0, HIGH, `PROPOSED`):** Deterministic 3-Way Semantic Merge Engine (`REQ-REL-002`, `CMP-06`, `SEC-CTRL-026`).
- **`DMK-175` (15.02.02, P0, CRITICAL, `PROPOSED`):** Merkle Directed Acyclic Graph (DAG) Multi-Writer Audit Ledger (`REQ-DATA-005`, `CMP-04`, `CMP-06`, `SEC-CTRL-040`).
- **`DMK-176` (15.03.01, P1, HIGH, `PROPOSED`):** WebSocket & HTTPS Encrypted Delta Sync Transport Adapter (`REQ-SYNC-001`, `CMP-06`, `SEC-CTRL-029`).
- **`DMK-177` (15.03.02, P2, MEDIUM, `PROPOSED`):** Blind Sync Relay Container Reference Implementation (`REQ-SYNC-001`, `CMP-06`, `SEC-CTRL-029`).
- **`DMK-178` (15.04.01, P1, MEDIUM, `PROPOSED`):** Interactive Conflict Resolution UI & Work Item Forking (`REQ-REC-001`, `CMP-01`, `CMP-06`, `SEC-CTRL-026`).

### Epic 16: Post-MVP Integrations & Extensibility
- **`DMK-179` (16.01.01, P1, MEDIUM, `PROPOSED`):** External Git Remote Bidirectional Tracking Bridge (`REQ-INT-001`, `CMP-02`, `SEC-CTRL-011`).
- **`DMK-180` (16.01.02, P2, LOW, `PROPOSED`):** GitHub Issues & Jira Project WorkItem Projection Adapter (`REQ-INT-001`, `CMP-02`, `SEC-CTRL-017`).
- **`DMK-181` (16.02.01, P2, LOW, `PROPOSED`):** Google Forms Dynamic Sync & Ingestion Webhook (`REQ-INT-001`, `CMP-02`, `SEC-CTRL-017`).
- **`DMK-182` (16.03.01, P1, MEDIUM, `PROPOSED`):** Pinned Standards Remote Mirror & Automatic Signature Verification (`REQ-SEC-016`, `CMP-03`, `SEC-CTRL-016`).
- **`DMK-183` (16.04.01, P0, CRITICAL, `PROPOSED`):** Multi-Project Tenant Isolation & Cross-Project Boundary Firewall (`REQ-SEC-032`, `CMP-04`, `SEC-CTRL-032`).
- **`DMK-184` (16.04.02, P1, HIGH, `PROPOSED`):** Peer Eviction & Forward-Secrecy Key Rotation Protocol (`REQ-SEC-022`, `CMP-07`, `SEC-CTRL-036`).

### Epic 17: v0.2 Governance, Verification & Milestone Closure
- **`DMK-185` (17.01.01, P0, CRITICAL, `PROPOSED`):** v0.2 Definition-of-Done Multi-Node Verification & Release Gate (`REQ-REL-002`, `CMP-01`, `CMP-06`, `CMP-07`, `SEC-CTRL-020`, `SEC-CTRL-040`).

