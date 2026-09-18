# docmonstakrakin Non-Functional Requirements
## Performance, Reliability, Security & Usability Constraints

**Document ID:** DOC-REQ-002  
**Baseline:** v0.1 Local-First MVP  
**Standard:** ISO/IEC 25010 System Quality Model  

---

## 1. Performance & Responsiveness (NFR-PERF)

- **NFR-PERF-01 (Local UI Latency):** All local navigation, view toggling, filter application, and modal transitions SHALL render within $100\,\text{ms}$ on standard developer workstations.
- **NFR-PERF-02 (Deterministic Evaluator Speed):** Lifecycle gate evaluations, risk calculations, and next-safe-action computations SHALL execute in under $50\,\text{ms}$ across project models with $\ge 500$ entities.
- **NFR-PERF-03 (Startup Time):** The local application service and UI shell SHALL complete initialization and become interactive within $3.0\,\text{seconds}$ from a cold start.

---

## 2. Security & Data Protection (NFR-SEC)

- **NFR-SEC-01 (Zero Plaintext Secrets):** API keys, credentials, and authentication tokens SHALL NEVER be written in plaintext to repository files, local database tables, `.env` files, or application logs.
- **NFR-SEC-02 (Path Boundary Isolation):** The repository service SHALL enforce strict workspace root boundary checks; any path containing `..`, absolute traversal, or symbolic link escapes SHALL be rejected with an immediate security audit event.
- **NFR-SEC-03 (Egress Network Boundaries):** Server-side inference proxying SHALL strictly isolate provider tokens and restrict egress traffic to authorized provider domains (e.g. `googleapis.com`).
- **NFR-SEC-04 (Audit Immutability):** Audit records SHALL use SHA-256 hash chaining to ensure that any modification, deletion, or reordering of historical events is immediately detectable.

---

## 3. Reliability & Offline Availability (NFR-REL)

- **NFR-REL-01 (Complete Offline Resilience):** 100% of project management, questionnaire navigation, requirement editing, risk scoring, work tracking, and documentation export features SHALL operate without active network connectivity.
- **NFR-REL-02 (Graceful Degradation):** When external AI providers (Gemini/Codex) are unreachable or rate-limited, the system SHALL transition to offline advisory mode and provide copy/paste prompt packages without throwing fatal errors.
- **NFR-REL-03 (Crash Recovery):** In the event of an unexpected process termination, the system SHALL restore the last consistent project state version without data corruption.

---

## 4. Usability & Ergonomics (NFR-USE)

- **NFR-USE-01 (Anti-Slop Visual Design):** The UI SHALL strictly adhere to the calm enterprise SaaS theme: no purple-to-blue decorative gradients, no neon glow drop-shadows, and no nested cards.
- **NFR-USE-02 (Dual-Indicator Accessibility):** All status badges, risk levels, and gate indicators SHALL include both distinct semantic color and explicit text labels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), passing WCAG AA contrast standards ($\ge 4.5:1$).
- **NFR-USE-03 (Global Keyboard Navigation):** The application SHALL support full keyboard access for core workflows, including `Ctrl+K` / `Cmd+K` global entity search.
