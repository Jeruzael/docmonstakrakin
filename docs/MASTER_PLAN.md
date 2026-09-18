# docmonstakrakin
## A-SSDLC Development Control Plane
### Master Product, Architecture, Security, and Implementation Plan

**Plan Version:** 0.1 Draft  
**Initial Product Mode:** Local-first web application  
**Future Mode:** Optional hosted backend / SaaS  
**Initial Users:** Individual developers  
**Future Users:** Development teams and organizations  
**Primary AI Providers:** OpenAI/Codex and Google Gemini  
**Primary Project Types:** Web, Mobile, Backend/API, Desktop, AI, Agentic AI  

---

## 1. Product Vision
docmonstakrakin is a development guidance and control platform designed to help developers build software according to a modern Agentic Secure Software Development Lifecycle (A-SSDLC).  
The application is not merely a documentation generator, prompt library, project-management board, or AI wrapper.  
It acts as the project's engineering control plane.  
It maintains structured knowledge about:
- what is being built;
- why it is being built;
- what requirements exist;
- what remains unresolved;
- which security and engineering standards apply;
- what risks exist;
- what architectural decisions were made;
- what work remains;
- which agents may perform which actions;
- what evidence proves that work is complete;
- what humans approved;
- what standards versions were used;
- and what the safest recommended next action is.

The system should always be capable of answering:
*Why does this task exist, which requirement created it, which risk or standard affects it, which implementation satisfies it, what evidence verifies it, and what must happen next?*

---

## 2. Core Product Principles
### 2.1 One Canonical Project State
The application must maintain a single structured source of truth.  
Documents are generated representations of project state rather than independent competing sources.  
The canonical system contains:
```
Project
├── Project Profile
├── Stakeholders
├── Objectives
├── Requirements
├── Constraints
├── Assumptions
├── Questions
├── Decisions
├── Risks
├── Threats
├── Controls
├── Architecture
├── Standards
├── Work Items
├── Tests
├── Evidence
├── Prompts
├── Agent Runs
├── Approvals
└── Audit Events
```
Markdown, JSON, YAML, backlogs, implementation plans, questionnaires, WBS views, and reports are generated from this state.

---

## 3. A-SSDLC Philosophy
A-SSDLC is the mandatory assurance framework. Delivery methodology remains configurable:
```
            A-SSDLC
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  Scrum       Kanban     Iterative
```
Scrum, Kanban, Scrumban, milestone-based delivery, and similar approaches may alter how work is organized. They may not remove mandatory controls required by project risk.  
The A-SSDLC lifecycle is:
```
PROJECT CREATION
      ↓
DISCOVERY
      ↓
REQUIREMENTS
      ↓
REQUIREMENTS REVIEW
      ↓
RISK ASSESSMENT
      ↓
THREAT MODELING
      ↓
ARCHITECTURE
      ↓
ARCHITECTURE REVIEW
      ↓
PLANNING
      ↓
IMPLEMENTATION
      ↓
VERIFICATION
      ↓
SECURITY REVIEW
      ↓
RELEASE APPROVAL
      ↓
DEPLOYMENT
      ↓
OPERATIONS
      ↓
FEEDBACK ──↺
```
Each transition has machine-readable entry and exit criteria.

---

## 4. Standards Foundation
docmonstakrakin does not invent its security framework from scratch. Its A-SSDLC model maps project controls against trusted external standards:
- **NIST SSDF:** Secure development lifecycle baseline
- **OWASP SAMM:** Software assurance maturity
- **OWASP ASVS:** Web/backend/API verification
- **OWASP MASVS:** Mobile application security
- **OWASP AISVS:** AI and agentic AI security (v1.0 stable)
- **OWASP API Security:** API-specific risks
- **OWASP Agentic Guidance:** Agent security
- **NIST AI RMF:** AI risk management
- **OpenSSF / SLSA:** Software supply-chain assurance
- **CWE:** Weakness classification
- **CISA Guidance:** Secure-by-design practices
- **TUF Principles:** Secure update design
- **Sigstore/OpenSSF:** Artifact provenance/signing

---

## 5. Project Profiles
Projects activate multiple profiles:
- `WEB_APPLICATION`
- `MOBILE_APPLICATION`
- `BACKEND_API`
- `DESKTOP_APPLICATION`
- `AI_APPLICATION`
- `AGENTIC_AI_APPLICATION`

Profiles determine: questionnaire branches, applicable standards, security controls, risk modifiers, default testing requirements, and required lifecycle gates.

---

## 6. Specialized Profiles
Early specialized profiles:
- Financial / FinTech
- Healthcare
- Education
- E-Commerce
- Personal Data / PII
- Internal Business Tool
- Public Internet Service
- AI Assistant
- Autonomous Agent
- Developer Tool

---

## 7. Project Creation Flow
```
Create Project
    ↓
Project Name & Description
    ↓
Select Project Profiles
    ↓
Select Delivery Method & Deployment Intent
    ↓
Select Data Sensitivity
    ↓
Adaptive Discovery Questionnaire
    ↓
Initial Risk Calculation
    ↓
Requirements Readiness Assessment
    ↓
A-SSDLC Lifecycle Begins
```
No AI integration is required to create or manage a project.

---

## 8. Adaptive Questionnaire Engine
Questionnaires behave as conditional graphs rather than static forms. Dynamic branching, importance levels (`BLOCKING`, `REQUIRED_BEFORE_IMPLEMENTATION`, `RECOMMENDED`), and standard associations drive readiness.

---

## 9. Requirement Readiness System
Unanswered questions do not have equal severity:
- `BLOCKING`
- `REQUIRED_BEFORE_IMPLEMENTATION`
- `RECOMMENDED`
- `DEFERRED_WITH_JUSTIFICATION`
- `NOT_APPLICABLE`
- `RESOLVED`

Users may override gates when policy permits. Every override becomes an auditable risk-acceptance event.

---

## 10. Project Knowledge Model
Entities receive permanent identifiers (`REQ-xxx`, `QUESTION-xxx`, `RISK-xxx`, `THREAT-xxx`, `CTRL-xxx`, `ADR-xxx`, `WORK-xxx`, `TEST-xxx`, `EV-xxx`, `PROMPT-xxx`, `RUN-xxx`, `APV-xxx`, `AUD-xxx`). Traceability connects questions through requirements, risks, architecture, work items, and verification evidence.

---

## 11–20. Core Engine Specifications
- **Requirements Model:** Functional, Non-functional, Security, Privacy, Operational, AI-specific, etc.
- **Assumption and Unknown Register:** AI agents may never silently convert guesses into project facts. Structured outputs require explicit `assumptions`, `unknowns`, `conflicts`, `recommendations`, `decisions_required`.
- **Architecture Decision Records (ADRs):** Immutable historical records (`PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`, `DEPRECATED`).
- **Risk Engine:** $Score = Likelihood \times Impact$ (1–5 scale). Inherent and residual risk tracking.
- **Mandatory Risk Floors:** Non-negotiable floors based on project capabilities (e.g. autonomous agent + production access = CRITICAL minimum).
- **Human Approval Framework:** Multi-tier authorization matching risk severity. Explicit human gates for destructive actions, secret expansions, and production releases.
- **Overrides & Risk Acceptance:** Auditable override records with actor, justification, and expiration.
- **A-SSDLC State Machine:** 15 discrete lifecycle phases with machine-readable entry/exit criteria.
- **Canonical WorkItem Model:** Single WorkItem aggregate powering Kanban, WBS, Product Backlog, Sprint Backlog, and Master Task views.
- **Prompt Registry:** Versioned, evaluated engineering assets with draft, testing, approved, recommended, deprecated states.

---

## 21–30. AI and Verification Architecture
- **Prompt Compiler:** Scoped context packaging ($Role + State + Phase + Task + Standards + Risk + Permissions$).
- **Agent Roles:** Clear distinction between Role (intent) and Permissions (authority).
- **AI Authority Modes:** `ADVISORY`, `PROPOSE`, `EXECUTE`.
- **Agent Permission Model:** Scoped filesystem paths (allow/deny with deny precedence), terminal commands, network, and secrets.
- **AI Provider Architecture:** Neutral gateway abstraction supporting Gemini, Codex, and future providers.
- **Manual AI Workflow:** Full offline copy/paste structured JSON workflow without direct API connectivity.
- **Structured Output Validation:** 6-stage pipeline: Syntax &rarr; JSON Schema &rarr; Semantic &rarr; Project State &rarr; Policy &rarr; Human Review.
- **Second-Agent Verification:** Dual-agent cross-review without shared private scratchpad context.

---

## 31–40. Governance, Repository & Standards
- **Repository Integration:** Scoped filesystem read/write, canonical path boundary enforcement, safe search, Git log/diff inspection.
- **Evidence Ledger:** Separate statuses for `IMPLEMENTED`, `VERIFIED`, `APPROVED`, `RELEASED`, `DEPLOYED`. SHA-256 hashed evidence artifacts.
- **Audit Ledger:** Append-only, cryptographically hashed audit chain for all project state mutations.
- **Standards Registry & Update Engine:** Trusted source curation, version pinning, immutable snapshots, semantic diffs, impact analysis, and rollback.

---

## 41–50. Product Capabilities & Operations
- **Built-in Forms & Google Forms Export:** Internal conditional forms with export to Google Forms and structured response import.
- **Project Templates:** Versioned starter templates for Web, Mobile, REST API, AI, FinTech, etc.
- **Generated Documentation:** Real-time projection of canonical state to Markdown, JSON, and YAML.
- **Local Project Package (`.docmonstakrakin`):** Portable single-file/folder package containing full project state.
- **Dashboard & Guided Next Action:** Deterministic next safe action recommendation based on lifecycle state, blockers, risk, and missing evidence.
- **Offline Mode:** Complete functionality without internet for all non-AI features.

---

## 51–60. Security, Stack & Architecture
- **Secrets Management:** OS Credential Store abstraction (macOS Keychain, Windows Credential Manager, Linux libsecret) with encrypted local fallback. Zero plaintext secrets in project data.
- **Command Safety:** Structured command representation with risk classification and mandatory confirmation.
- **Application Architecture:** Local-first architecture (Frontend UI + Application Server + Local Storage/OS Keyring).
- **Supply-Chain Controls:** SBOM, pinned dependencies, artifact integrity, TUF-inspired update verification.

---

## 61–74. Verification, DoD, and Governance
- **MVP Definition (v0.1):** 25 core capabilities enabling end-to-end A-SSDLC execution locally.
- **Implementation Program:** Phases 0 through 12.
- **Definition of Done (DoD):** Acceptance criteria, passing tests, documentation, evidence, review, audit event.
- **Application Self-Governance:** docmonstakrakin manages its own development using its own A-SSDLC control plane.
