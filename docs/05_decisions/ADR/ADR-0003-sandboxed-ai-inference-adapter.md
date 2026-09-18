# ADR-0003: Sandboxed Server-Side AI Inference Adapter & Egress Boundary

**Status:** ACCEPTED  
**Date:** 2026-09-15  
**Deciders:** Lead Architect, Security Officer  
**Technical Component:** `CMP-05` (Sandboxed AI Inference Adapter)  

---

## Context & Problem Statement
Integrating AI models (such as Google Gemini and OpenAI Codex) directly from client browser code introduces severe security risks: API keys are exposed via DevTools, network traffic is vulnerable to interception, and untrusted model output can trigger arbitrary script execution in the user's browser session. Furthermore, agents may suffer from sycophantic confirmation bias if they review their own proposals.

## Decision
We decide to mandate:
1. **Server-Side Inference Exclusively:** All calls to external model APIs must execute inside the Node.js/Express server (`server.ts` / `CMP-05`). The client browser UI (`CMP-01`) communicates only with local `/api/*` endpoints.
2. **Strict Egress Whitelist:** Egress network traffic from `CMP-05` is restricted to authorized provider endpoints (`*.googleapis.com`).
3. **Dual-Agent Verification:** Proposals involving High or Critical risk items must trigger an independent secondary verifier model without shared scratchpad context before being presented to the user.

## Consequences
- **Positive:**
  - API keys never touch the browser DOM or local browser storage.
  - Mitigates prompt injection attacks attempting to access internal project secrets.
  - Dual-agent verification catches subtle security flaws and bias in primary agent code proposals.
- **Negative:**
  - Increased local server footprint to handle streaming proxy connections.
