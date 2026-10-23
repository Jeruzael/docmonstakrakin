# docmonstakrakin Agent Architecture
## Agent Roles, Authority Modes, Scoped Context & Dual-Agent Verification

**Document ID:** DOC-ARC-003  
**Baseline:** v0.1 Local-First MVP  
**Reference:** Master Plan §21–§31  

---

## 1. Separation of Role vs. Authority

A fundamental architectural law of docmonstakrakin is:
$$\text{Role (Intent / Persona)} \neq \text{Permission (Authority / Power)}$$

- **Role:** Describes what the model is asked to think about (e.g. `Architect`, `Developer`, `Threat Modeler`, `Security Reviewer`).
- **Authority:** Defines what operations the model is cryptographically or programmatically permitted to perform (e.g. read paths, write paths, shell execution, secret usage).

---

## 2. Three Authority Modes

1. **`ADVISORY`:** The agent analyzes context and suggests ideas in text. No proposed mutations or file actions are permitted.
2. **`PROPOSE`:** The agent returns structured proposed project changes (new requirements, tasks, or code diffs). The control plane validates them against schemas and policies; the user selectively accepts or rejects.
3. **`EXECUTE`:** An authorized agent may execute tightly scoped actions (e.g. edit files within `src/**`, run read-only terminal commands). Every action produces an immutable audit record and requires prior policy validation.

---

## 3. Scoped Context Packaging

To prevent prompt injection and reduce token costs, agents are never fed the entire project database. The **Prompt Compiler (`CMP-03`)** builds a scoped context package containing only:
- The target WorkItem and its acceptance criteria;
- Pinned requirements and standards controls specifically linked to that task;
- Explicit filesystem allow/deny masks;
- Expected output JSON Schema.

---

## 4. Dual-Agent Cross-Review Engine (`DMK-081`)

For security-critical tasks (`Risk = HIGH` or `CRITICAL`), the control plane automatically triggers an independent secondary agent:

```
Primary Agent (e.g. Gemini 2.5 Pro)
       │
       ▼ Generates Proposal (Architecture / Code Diff)
Proposal Quarantine Pipeline
       │
       ▼ Strips primary scratchpad & reasoning tokens
Secondary Verifier Agent (e.g. Specialized Security Verifier)
       │
       ▼ Evaluates against Pinned Security Rules & Trust Boundaries
Cross-Review Verdict Card (PASSED / CONCERNS_FLAGGED)
       │
       ▼
Human Approver Review & Final Ratification
```

The secondary reviewer evaluates the proposal without seeing the primary agent's intermediate chain of thought, eliminating sycophantic agreement and shared reasoning bias.
