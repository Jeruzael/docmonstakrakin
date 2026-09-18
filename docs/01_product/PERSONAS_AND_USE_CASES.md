# docmonstakrakin Personas & Use Cases
## Target Users, Autonomous Agent Actors, and Core Workflows

**Document ID:** DOC-PROD-003  
**Baseline:** v0.1 Local-First MVP  

---

## 1. Key User Personas

### 1. Solo Software Engineer / Technical Founder
- **Role:** Designs, builds, tests, and deploys applications independently using modern AI coding agents.
- **Pain Points:** AI agents hallucinate requirements, make silent unvetted architectural changes, bypass security controls, or declare features "done" when tests have never been run.
- **Goal:** Maintain complete engineering control, enforce security baselines, and know the exact next safe task to execute.

### 2. Security Engineer / AppSec Lead
- **Role:** Evaluates software security posture, enforces compliance (NIST SSDF, OWASP ASVS/AISVS), and conducts threat modeling.
- **Pain Points:** Developers use LLMs that generate code with hardcoded secrets, weak token expiry, or unescaped terminal commands.
- **Goal:** Establish non-negotiable risk floors, verify requirement-to-test traceability, and require cryptographically signed human approval before gate bypass.

### 3. Lead Architect
- **Role:** Defines system components, trust boundaries, ADRs, and tech stack constraints.
- **Pain Points:** AI agents introduce arbitrary third-party libraries or violate ingress/egress trust boundaries.
- **Goal:** Formally review and ratify ADRs, maintain component-to-requirement coverage, and restrict data zone isolation.

---

## 2. Autonomous & Semi-Autonomous Agent Actors

- **Primary Developer Agent (Gemini/Codex):** Operates under `PROPOSE` or `EXECUTE` authority mode with scoped filesystem permissions (`src/**` allowed, `secrets/**` denied).
- **Independent Verifier Agent:** Specialized adversarial review agent with read-only permissions that cross-evaluates candidate proposals against security policies without scratchpad leakage.
- **Deterministic Policy Engine:** Zero-LLM deterministic evaluator that verifies gate exit criteria, risk floors, and next safe actions.

---

## 3. Primary Use Cases

1. **UC-01: Project Creation & Discovery Baseline:** Engineer creates a new Web/API project, selects profiles, answers adaptive questionnaire questions, and generates an approved requirements baseline.
2. **UC-02: Scoped Context Prompt Generation:** Engineer selects a work item and compiles a minimal-context, role-tailored prompt package enforcing filesystem boundaries and output JSON schemas.
3. **UC-03: Dual-Agent Cross-Review & Acceptance:** Primary agent drafts a complex architecture or security change; independent secondary reviewer flags edge-case vulnerabilities; engineer reviews conflict summary and accepts/rejects.
4. **UC-04: Evidence Ingestion & Gate Advancement:** Automated CI test passes; SHA-256 test run evidence is ingested; work item transitions to `VERIFIED`; lifecycle gate criteria evaluate to passed.
5. **UC-05: Audited Gate Override:** Engineer temporarily bypasses a non-critical gate for prototyping by entering an auditable reason and expiration date.
