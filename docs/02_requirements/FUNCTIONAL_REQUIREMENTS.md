# docmonstakrakin Functional Requirements
## System Functional Capability Specifications

**Document ID:** DOC-REQ-001  
**Baseline:** v0.1 Local-First MVP  
**Standard:** IEEE 830 / ISO/IEC/IEEE 29148  

---

## 1. Project Management & Core Domain (FR-PRJ)

- **FR-PRJ-01 (Multi-Profile Project Aggregate):** The system SHALL maintain a unified `Project` aggregate supporting multi-profile selection (`WEB`, `MOBILE`, `BACKEND_API`, `DESKTOP`, `AI`, `AGENTIC_AI`), delivery methodology, deployment intent, and data sensitivity.
- **FR-PRJ-02 (State Versioning & Optimistic Concurrency):** The system SHALL assign a monotonic `stateVersion` integer to every project aggregate and reject conflicting concurrent mutations.
- **FR-PRJ-03 (Creation Wizard):** The system SHALL provide a multi-step project wizard that configures project metadata without requiring active internet access or external AI provider credentials.

---

## 2. Requirements & Discovery Engine (FR-REQ)

- **FR-REQ-01 (Adaptive Questionnaire Graph):** The system SHALL evaluate dynamic conditional dependencies (`required_when`) across discovery questions to display only relevant branches based on profile and prior answers.
- **FR-REQ-02 (Readiness & Blocker Severity):** The system SHALL compute a mathematical Requirements Readiness percentage ($0$–$100\%$) and classify unanswered questions as `BLOCKING`, `REQUIRED_BEFORE_IMPLEMENTATION`, or `RECOMMENDED`.
- **FR-REQ-03 (Deterministic Requirement Generation):** The system SHALL deterministically generate structured requirement records (`REQ-xxx`) from approved discovery answers.
- **FR-REQ-04 (Requirements Review & Baseline Ratification):** The system SHALL support formal human sign-off on requirements baselines before lifecycle advancement.

---

## 3. A-SSDLC Lifecycle & Governance Engine (FR-GOV)

- **FR-GOV-01 (15-Phase Lifecycle Machine):** The system SHALL orchestrate 15 distinct development phases from Project Creation to Feedback with machine-readable entry and exit rules.
- **FR-GOV-02 (Deterministic Gate Evaluator):** The system SHALL evaluate gate exit criteria using deterministic rule logic and prohibit advancement when blocking criteria remain unmet.
- **FR-GOV-03 (Mandatory Risk Floors):** The system SHALL automatically enforce minimum inherent risk floors (e.g. `HIGH` or `CRITICAL`) when high-risk project capabilities are active.
- **FR-GOV-04 (Auditable Overrides):** The system SHALL permit authorized users to override non-fatal gates by recording the actor identity, acknowledged risk, rationale, and expiration timestamp in an immutable ledger.
- **FR-GOV-05 (Deterministic Next Action):** The system SHALL compute and display exactly one recommended next safe engineering action based on active blockers, phase status, and dependency graphs.

---

## 4. Prompt Compiler & Validation Pipeline (FR-AI)

- **FR-AI-01 (Scoped Context Package Compilation):** The system SHALL assemble minimal, role-specific context packages containing only the task, applicable requirements, pinned standards, path masks, and output schemas.
- **FR-AI-02 (Strict JSON Schema Validation):** The system SHALL validate all AI-generated responses against canonical JSON schemas before presenting proposals to the user.
- **FR-AI-03 (Independent Second-Agent Review):** The system SHALL provide an automated dual-agent review workflow where an independent verifier evaluates candidate proposals without shared private scratchpad context.
- **FR-AI-04 (Manual Copy/Paste Workflow):** The system SHALL support a fully offline workflow allowing users to copy compiled prompts to external models and paste back structured JSON responses for validation.

---

## 5. Work Management & Projections (FR-WRK)

- **FR-WRK-01 (Unified WorkItem Model):** The system SHALL maintain a single canonical `WorkItem` entity powering Kanban Board, Hierarchical WBS, Tabular Product Backlog, and Sprint Backlog views.
- **FR-WRK-02 (Evidence-Aware Status Enforcement):** The system SHALL prohibit any work item from achieving `VERIFIED` status unless linked to an authenticated `Evidence` artifact.
- **FR-WRK-03 (Traceability Linkages):** The system SHALL maintain bidirectional links between work items, requirements, risks, architecture components, tests, and evidence.

---

## 6. Repository, Command Safety & Evidence (FR-SEC)

- **FR-SEC-01 (Filesystem Allow/Deny Masking):** The system SHALL evaluate file paths against explicit allow/deny patterns (`src/**` allowed; `secrets/**` denied) with deny precedence.
- **FR-SEC-02 (Structured Command Runner):** The system SHALL represent proposed terminal commands as structured objects with risk ratings and mandatory human confirmation before execution.
- **FR-SEC-03 (Append-Only Cryptographic Audit Ledger):** The system SHALL record all state mutations, overrides, and agent executions as append-only audit events secured by SHA-256 hash chaining.
- **FR-SEC-04 (OS Keyring Credential Abstraction):** The system SHALL store API keys and credentials in native OS credential stores with zero plaintext persistence in `.env` files or application logs.
