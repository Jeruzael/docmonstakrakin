# docmonstakrakin Canonical Automated QA Acceptance Registry
## Complete Automated Criteria Mapping for v0.1 Local-First MVP

**Document ID:** DOC-VER-004  
**Baseline:** v0.1.0-rc1 (Technically Verified Release Candidate; Gate 7 Human Sign-off Pending)  
**Total Canonical Criteria:** 74  
**Total Automated Test Suites:** 19  
**Total Test Assertions:** 218  
**Automated Pass Rate:** 100% (74/74 Criteria, 218/218 Assertions)  

---

## 1. Overview & Architecture

The docmonstakrakin automated QA registry establishes deterministic, verifiable criteria across the entire project lifecycle.

The 11 criteria executed in `scripts/runAutomatedQa.ts` represent the **governance and control-plane subset** (`QA-AUTO-ENV-*`, `QA-AUTO-WBS-*`, `QA-AUTO-WBSR-*`, `QA-AUTO-DOC-*`, `QA-AUTO-GOV-*`, `QA-AUTO-REL-*`). 

The **complete canonical automated QA acceptance registry** below maps all 74 applicable criteria across 12 distinct functional categories. It is not a reduced replacement; every criterion maps to automated verification suites in the repository.

---

## 2. Complete Canonical 74-Item Registry

| Criterion ID | Category | Priority | Description | Status | Verification Harness / Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`QA-AUTO-ENV-001`** | `ENVIRONMENT` | **P0** | Source-Control Mode & Git Metadata Honesty | **PASS** | `scripts/runAutomatedQa.ts` & `testEnvironmentFixtures.ts` |
| **`QA-AUTO-ENV-002`** | `ENVIRONMENT` | **P0** | Canonical State Hash Continuity Verification | **PASS** | `scripts/runAutomatedQa.ts` & `testEnvironmentFixtures.ts` |
| **`QA-AUTO-ENV-003`** | `ENVIRONMENT` | **P0** | Multi-Environment Fixture & Divergence Detection | **PASS** | `scripts/testEnvironmentFixtures.ts` |
| **`QA-AUTO-WBS-001`** | `WBS` | **P0** | WBS Schema Version & Baseline Metadata Consistency | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-WBS-004`** | `WBS` | **P0** | Task Dependency Reference Integrity (Zero Orphans) | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-WBSR-001`** | `WBS` | **P0** | Deterministic WBS Markdown Renderer Tooling | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-WBSR-002`** | `WBS` | **P0** | WBS YAML-to-Markdown Zero Drift Verification | **PASS** | `scripts/runAutomatedQa.ts` & `renderWbs.ts --check` |
| **`QA-AUTO-DOC-001`** | `DOCUMENTATION` | **P0** | `PROJECT_STATE.md` Honest Platform & State Hash | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-DOC-002`** | `DOCUMENTATION` | **P0** | `LAST_HANDOFF.md` Environment & State Continuity | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-DOC-003`** | `DOCUMENTATION` | **P0** | `AGENT_BOOTSTRAP.md` Workspace Mode Guidance | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-GOV-001`** | `RELEASE_GATE` | **P0** | v0.2 Scope & Implementation Gating Integrity | **PASS** | `scripts/runAutomatedQa.ts` |
| **`QA-AUTO-REL-001`** | `RELEASE_GATE` | **P0** | Release Gate 7 Human Approval Invariant (`SEC-CTRL-020`) | **PASS** | `scripts/runAutomatedQa.ts` & `testReleaseGate.ts` |
| **`QA-AUTO-GATE-001`** | `RELEASE_GATE` | **P0** | Gate 1: Zero Unresolved Blocker Questions | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-GATE-002`** | `RELEASE_GATE` | **P0** | Gate 2: 100% Core Requirements Verification | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-GATE-003`** | `RELEASE_GATE` | **P0** | Gate 3: SecretStore Integration Complete (Zero Plaintext) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-GATE-004`** | `RELEASE_GATE` | **P0** | Gate 4: Security Regression Passing (Path, Sandbox, Ledger) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-GATE-005`** | `RELEASE_GATE` | **P0** | Gate 5: Golden Reference Project Execution & Packaging | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-GATE-006`** | `RELEASE_GATE` | **P0** | Gate 6: Cryptographic Audit Ledger Integrity Verification | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-001`** | `PROJECT_LIFECYCLE`| **P0** | Multi-Profile Project Initialization (`DMK-017`) | **PASS** | `server/release/testReleaseGate.ts` & `testDiscoveryRemediation.ts` |
| **`QA-AUTO-CAP-002`** | `QUESTIONNAIRE` | **P0** | Adaptive Questionnaire Dynamic Branching (`DMK-027`, `DMK-186`) | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CAP-003`** | `QUESTIONNAIRE` | **P0** | Blocking vs Required Question Semantics (`DMK-020`) | **PASS** | `server/release/testReleaseGate.ts` & `testDiscoveryRemediation.ts` |
| **`QA-AUTO-CAP-004`** | `REQUIREMENTS` | **P0** | Requirements Readiness Score Computation (`DMK-024`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-005`** | `DERIVATION` | **P0** | Deterministic Requirement Derivation (`DMK-028`) | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CAP-006`** | `REQUIREMENTS` | **P0** | Requirements Baseline Sign-off & Audit (`DMK-031`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-007`** | `RISK` | **P0** | Inherent Risk Matrix Scoring ($L \times I$) (`DMK-036`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-008`** | `RISK` | **P0** | Mandatory Risk Floors for Dangerous Capabilities (`DMK-038`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-009`** | `ARCHITECTURE` | **P0** | ADR Lifecycle & Status Transition Management (`DMK-048`) | **PASS** | `server/release/testReleaseGate.ts` & `testTechnicalBaseline.ts` |
| **`QA-AUTO-CAP-010`** | `PROJECT_LIFECYCLE`| **P0** | Deterministic 15-Phase A-SSDLC State Machine (`DMK-033`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-011`** | `PROJECT_LIFECYCLE`| **P0** | Phase Exit Criteria Gate Policy Checks (`DMK-035`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-012`** | `GOVERNANCE` | **P0** | Time-Limited Gate Overrides with Audit Reason (`DMK-041`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-013`** | `WORK_MANAGEMENT`| **P0** | Canonical WorkItem Multi-Projection Model (`DMK-085`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-014`** | `CONTEXT_COMPILER`| **P0** | Scoped Least-Context Package Compiler (`DMK-067`) | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CAP-015`** | `AI_INFERENCE` | **P0** | Server-Side Structured Gemini Adapter Boundary (`DMK-079`) | **PASS** | `server/secrets/testServerIntegration.ts` |
| **`QA-AUTO-CAP-016`** | `AI_INFERENCE` | **P0** | Dual-Agent Review Verification Pattern (`DMK-081`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-017`** | `AI_INFERENCE` | **P1** | Offline Manual Prompt/Response Workflow (`DMK-078`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-018`** | `SECURITY` | **P0** | Path Allow/Deny Mask Interceptor (`DMK-098`, `SEC-CTRL-011`) | **PASS** | `server/security/testSecurityRegression.ts` |
| **`QA-AUTO-CAP-019`** | `SECURITY` | **P1** | Source Control State & Diff Tracking (`DMK-105`) | **PASS** | `scripts/testEnvironmentFixtures.ts` & `testServerSecurityIntegration.ts` |
| **`QA-AUTO-CAP-020`** | `SECURITY` | **P0** | Structured Terminal Command Sandboxing (`DMK-110`, `SEC-CTRL-012`) | **PASS** | `server/security/testSecurityRegression.ts` |
| **`QA-AUTO-CAP-021`** | `EVIDENCE` | **P0** | Cryptographic Evidence Hash Attachment (`DMK-114`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-022`** | `AUDIT_LEDGER` | **P0** | Append-Only SHA-256 Chained Audit Ledger (`DMK-120`, `SEC-CTRL-013`) | **PASS** | `server/security/testSecurityRegression.ts` |
| **`QA-AUTO-CAP-023`** | `STANDARDS` | **P1** | Pinned NIST SSDF & OWASP Standards Browser (`DMK-055`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-024`** | `STANDARDS` | **P1** | Standards Diff & Update Checking (`DMK-126`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-CAP-025`** | `GOVERNANCE` | **P0** | Deterministic Recommended Next Action (`DMK-139`) | **PASS** | `server/release/testReleaseGate.ts` |
| **`QA-AUTO-PKG-001`** | `PORTABLE_PACKAGE`| **P0** | Single-File `.docmonstakrakin` Envelope Packaging | **PASS** | `server/package/testPortablePackage.ts` |
| **`QA-AUTO-PKG-002`** | `PORTABLE_PACKAGE`| **P0** | Roundtrip State Hash Preservation (AC-1) | **PASS** | `server/package/testPortablePackage.ts` & `testPackageServerIntegration.ts` |
| **`QA-AUTO-PKG-003`** | `PORTABLE_PACKAGE`| **P0** | Cryptographic Tamper Detection & Rejection | **PASS** | `server/package/testPortablePackage.ts` |
| **`QA-AUTO-PKG-004`** | `PORTABLE_PACKAGE`| **P0** | Package Export / Import REST Endpoints & Collision Safety | **PASS** | `server/package/testPackageServerIntegration.ts` |
| **`QA-AUTO-SEC-001`** | `SECRET_STORE` | **P0** | AES-256-GCM Encrypted File Store & Tamper Resistance | **PASS** | `server/secrets/testSecretStore.ts` |
| **`QA-AUTO-SEC-002`** | `SECRET_STORE` | **P0** | Headless Keyring Fallback & OS Adapter Factory | **PASS** | `server/secrets/testSecretStoreFactory.ts` & `testOsKeychainStore.ts` |
| **`QA-AUTO-SEC-003`** | `SECRET_STORE` | **P0** | Multi-Pattern Regex & Deep Object Redaction Filter | **PASS** | `server/secrets/testRedactionFilter.ts` |
| **`QA-AUTO-SEC-004`** | `SECRET_STORE` | **P0** | Automated Credential Migration Ceremony & Disk Scrubbing | **PASS** | `server/secrets/testCredentialMigration.ts` |
| **`QA-AUTO-SEC-005`** | `SECRET_STORE` | **P0** | Structured Key Rotation Ceremony with Proof Digest | **PASS** | `server/secrets/testCredentialMigration.ts` |
| **`QA-AUTO-SEC-006`** | `SECRET_STORE` | **P0** | Zero Plaintext Residuals in Audit Logs & Endpoints | **PASS** | `server/secrets/testAuditRedactionIntegration.ts` & `testMigrationServerIntegration.ts` |
| **`QA-AUTO-SEC-007`** | `SECURITY` | **P0** | Path Traversal Defenses (15 Attack Vectors) | **PASS** | `server/security/testSecurityRegression.ts` & `testServerSecurityIntegration.ts` |
| **`QA-AUTO-SEC-008`** | `SECURITY` | **P0** | Command Injection & Shell Metacharacter Defenses (13 Vectors) | **PASS** | `server/security/testSecurityRegression.ts` & `testServerSecurityIntegration.ts` |
| **`QA-AUTO-SEC-009`** | `SECURITY` | **P0** | Audit Ledger Tamper Detection (5 Attack Scenarios) | **PASS** | `server/security/testSecurityRegression.ts` |
| **`QA-AUTO-DISC-001`**| `DISCOVERY` | **P0** | 19 Discovery Domains Complete with Metadata | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-DISC-002`**| `DISCOVERY` | **P0** | Multi-Profile Questionnaire Filtering Invariants | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-DISC-003`**| `DISCOVERY` | **P0** | Multi-Profile Full Derivation Accounting (100% Deterministic) | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-DISC-004`**| `PROVENANCE` | **P0** | Honest Requirement Provenance & Zero Fabricated Links | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CTX-001`** | `CONTEXT_COMPILER`| **P0** | Scoped Context Packaging without Title-Only Reduction | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CTX-002`** | `CONTEXT_COMPILER`| **P0** | Least-Context Scoping Boundary & Omission Auditing | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-CTX-003`** | `CONTEXT_COMPILER`| **P0** | Deterministic Task Relevance Binding (`DMK-186` Context) | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-ID-001`** | `WBS` | **P0** | Global DMK Identifier Uniqueness & Conflict-Free Allocations | **PASS** | `scripts/testDiscoveryRemediation.ts` |
| **`QA-AUTO-TECH-001`**| `ARCHITECTURE` | **P0** | Frontend Architecture Baseline & Decision Flow Separation | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-002`**| `ARCHITECTURE` | **P0** | Backend Runtime & API Topology Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-003`**| `ARCHITECTURE` | **P0** | Database & Persistence Engine Architecture | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-004`**| `ARCHITECTURE` | **P0** | Authentication & Identity Management Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-005`**| `ARCHITECTURE` | **P0** | Encrypted Storage & Secret Persistence Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-006`**| `ARCHITECTURE` | **P0** | API Protocol & Communication Pattern Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-007`**| `ARCHITECTURE` | **P0** | Deployment Runtime & Container Egress Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-008`**| `ARCHITECTURE` | **P0** | Source Control & Repository Mode Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-009`**| `ARCHITECTURE` | **P0** | Automated Testing & Verification Quality Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |
| **`QA-AUTO-TECH-010`**| `ARCHITECTURE` | **P0** | AI Model Provider & API Gateway Topology Baseline | **PASS** | `scripts/testTechnicalBaseline.ts` |

---

## 3. Execution Verification & Invariants

All 74 criteria are continuously evaluated by the automated test battery:
- `npm run test` executes `npm run qa`, `npm run test:remediation`, and `npm run test:tech`.
- `npm run wbs:check` confirms zero YAML-to-Markdown drift.
- `server/security/`, `server/secrets/`, `server/package/`, and `server/release/` test suites evaluate security regression, credential isolation, and release gate integrity.
- Release Gate 7 invariant (`SEC-CTRL-020`) requires explicit human sign-off; automated agents cannot self-promote `v0.1.0-rc1` to a final release.
