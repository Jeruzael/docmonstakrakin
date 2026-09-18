# docmonstakrakin Actionable Next Tasks & Execution Plan

**Project Baseline:** Atlas Platform Launch (`PRJ-ATLAS-01`)  
**Current Phase:** Architecture Baseline (`ARCHITECTURE` — Health Score: 96%)  
**Architecture Gate:** Passed 4 of 4 Exit Criteria (ADRs &ge; 3, Risk floors covered, 100% Component-Req coverage, Restricted Isolation)

---

## 1. Phase Gate Transition & Resolution Summary [COMPLETED]

The lifecycle gate blockers and governance quorums have been successfully resolved:
* [x] **`AUTH-Q-014` Resolved:** Signed magic link with 15-minute expiration committed (satisfying OWASP ASVS V2 & NIST SSDF PW.1).
* [x] **`DATA-Q-008` Resolved:** 30-day automated TTL data retention and cryptographic erasure policy committed (satisfying NIST AI-RMF & ASVS V8).
* [x] **`APV-001` Quorum Ratified:** Security Officer (Gio) recorded sign-off; project advanced to `ARCHITECTURE` phase.
* [x] **`APV-002` Ratified:** Product Owner sign-off recorded; `REQ-SEC-019` promoted to `APPROVED`.
* [x] **`ADR-004` Accepted:** Cryptographic Hash-Chained Audit Ledger ratified and activated.
* [x] **`EV-105` Ingested:** Test execution artifact attached to `REQ-SEC-019` (`TEST-104`), achieving 100% RTM coverage.

---

## 2. Architectural Component Review & Egress Boundaries [COMPLETED]

* [x] **`CMP-05` (Sandboxed AI Inference Adapter) Trust Boundaries:** Ratified zero model memory spooling, server-only proxy token, least-context masking, and egress firewall rule (destination restricted to `googleapis.com`).
* [x] **Component-to-Requirement Mappings:** Assigned `REQ-SEC-019` to `CMP-02` (Secure Ingress & Policy Interceptor). All HIGH and CRITICAL requirements (`REQ-DATA-003`, `REQ-SEC-014`, `REQ-SEC-019`, `REQ-AI-007`) now mapped to architecture components.
* [x] **Architecture Gate Passed:** 4 of 4 criteria verified in `ArchitectureView.tsx` (Readiness: 96%).

---

## 3. Sprint 7 AI Safety (`DMK-081` Dual-Agent Cross-Review) [COMPLETED]

* [x] **`DMK-081` Implementation:** Integrated independent secondary reviewer agent orchestration (`dualAgentReview`) into `server.ts` and `types.ts`.
* [x] **Zero-Leakage Review Context:** Reviewer agent evaluates primary candidate proposals against authoritative rules without access to primary agent's private scratchpad.
* [x] **UI Verification Proof:** Added dual-agent review verification card in `AgentCenterView.tsx` with reviewer name, verdict, critique, and audit tracking.
* [x] **Evidence Attached:** Ingested `EV-106` (Dual-Agent Verification Engine Test Suite, `TEST-081`).

---

## 4. Priority 1 (Active): Sprint 13 Security Hardening (`DMK-157` & `DMK-158`)

- **Task `DMK-157`:** Pluggable `SecretStore` Interface & OS Credential Abstraction.
  - Objective: Interface for OS-level credential management (macOS Keychain, Windows Credential Manager, Linux Secret Service API) to completely eliminate plaintext credentials from `.env` and disk configuration.
  - Sub-tasks:
    1. Define `SecretStore` abstract interface in `src/services/secretStore.ts`.
    2. Implement encrypted local file fallback driver with AES-256-GCM.
    3. Expose secret management status in the control plane telemetry.

- **Task `DMK-158`:** OS Credential Migration & Key Rotation Ceremony.
  - Objective: Dry-run and execution pipeline for migrating existing API keys to secure keystore with cryptographic audit ledger record.

---

## 5. Sprint 14 & Release Readiness Roadmap Ahead

| Target Milestone | Tasks | Description |
| :--- | :--- | :--- |
| **Google Forms Exporter** | `DMK-150`–`153` | Generate Google Forms questionnaire from internal JSON schema for non-technical stakeholder discovery. |
| **OS Secret Storage** | `DMK-157`–`158` | Implement OS-level credential storage adapter to isolate provider API keys from file storage. |
| **Security Regression Suite** | `DMK-159` | Execute end-to-end automated test suite covering path boundary checks, command sandboxing, and audit chain verification. |
| **v0.1 Release Gate** | `DMK-165` | Execute formal v0.1 Definition of Done review and generate final offline release package. |

