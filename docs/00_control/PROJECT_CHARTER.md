# docmonstakrakin Project Charter
## Control Plane for the Agentic Secure Software Development Lifecycle (A-SSDLC)

**Document ID:** DOC-CTRL-001  
**Authoritative Status:** Approved Baseline  
**Classification:** Internal Engineering Control  
**Version:** 0.1  
**Last Reconciled:** September 2026  

---

## 1. Executive Summary & Purpose

Software engineering is undergoing a tectonic shift toward autonomous and semi-autonomous AI coding agents (OpenAI Codex, Google Gemini, Anthropic Claude, Claude Code, GitHub Copilot Workspace, etc.). While agents dramatically accelerate code generation, they introduce unprecedented risks:
- Unvetted architectural decisions and hallucinated assumptions silently committed as facts;
- Vulnerability amplification through prompt injection, insecure dependencies, and bypass of least-privilege security controls;
- Lack of verifiable lineage between what stakeholders asked for and what models produced;
- Misleading task statuses where an agent declaring "task complete" is accepted without deterministic CI, static analysis, or cryptographic evidence.

**docmonstakrakin** is a local-first engineering control plane that governs and guides software development according to an Agentic Secure Software Development Lifecycle (A-SSDLC). It enforces human-in-the-loop governance, strict boundary isolation, deterministic policy evaluation, and cryptographic proof of completion across all stages of development.

---

## 2. Core Objectives

1. **Deterministic Lifecycle Governance:** Enforce mathematical and policy-driven entry/exit criteria across 15 discrete development phases, preventing premature phase advancement.
2. **Strict Authority vs. Role Separation:** Separate an agent's intended role (e.g. Architect, Tester, Security Reviewer) from its granted authority (filesystem allow/deny masks, command execution rules, secret access).
3. **Single Canonical State Model:** Ensure all views (Kanban, WBS, Backlogs, PRDs, Threat Models) are deterministic projections of one unified project knowledge graph.
4. **Evidence-Backed Verification:** Enforce that work cannot achieve `VERIFIED` status without verifiable cryptographic evidence (test run hashes, diff signatures, security scans, or human sign-off).
5. **Calm Developer Experience:** Deliver an offline-capable, responsive developer console free of decorative "AI slop" or synthetic marketing metrics.

---

## 3. Product Principles

| Principle | Description | Implementation Rule |
| :--- | :--- | :--- |
| **One Canonical State** | All project knowledge resides in one unified model. | Documents are generated projections, never standalone sources of truth. |
| **Evidence Before Confidence** | Status cannot be updated on trust alone. | A work item requires a linked, hashed `Evidence` artifact before transitioning to `VERIFIED`. |
| **Deterministic Over Statistical** | Security and policy rules are deterministic. | Gate approvals, risk floors, and next actions must evaluate using rule engines, not LLM prompts. |
| **Dual-Agent Independence** | Verifiers cannot share primary agent scratchpads. | Second-agent verification must receive candidate proposals in isolation to prevent confirmation bias. |
| **Zero Plaintext Secrets** | Credentials never touch project storage. | Secrets must be abstracted through OS native credential managers with encrypted local fallback. |

---

## 4. Stakeholder Matrix & Governance Authority

- **Project Lead / Security Officer (Gio):** Sole authority to ratify architecture decisions, accept high/critical residual risks, and execute release gates.
- **AI Agent - Primary (Gemini/Codex):** Authorized to analyze requirements, draft code changes within `src/**` and `tests/**`, and propose work items under `PROPOSE` authority mode.
- **AI Agent - Independent Verifier:** Authorized to cross-evaluate proposed architectural changes and code diffs against pinned security standards without execute authority.
- **Developer / Contributor:** Local operator running the development control plane locally.
