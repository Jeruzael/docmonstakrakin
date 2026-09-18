# docmonstakrakin System Architecture
## High-Level Topology, Component Model & Boundary Architecture

**Document ID:** DOC-ARC-001  
**Baseline:** v0.1 Local-First MVP  
**Standard:** IEEE 42010 Architecture Description Standard  

---

## 1. System Topology

docmonstakrakin is structured as a **full-stack, local-first application service** combining a responsive React SPA with a Node.js/Express application service:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    User Browser / Desktop Shell                          │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 React 19 + TypeScript SPA                       │   │
│   │  - DashboardView       - RequirementsView   - ArchitectureView  │   │
│   │  - RiskWorkspaceView   - WorkView           - StandardsView     │   │
│   │  - EvidenceView        - AgentCenterView    - PromptCompiler    │   │
│   │  - RepositoryView      - DocumentsView      - GlobalSearchModal │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │ Local HTTP / REST API (:3000)
┌────────────────────────────────────▼────────────────────────────────────┐
│                  Node.js / Express Application Server                    │
│                                                                         │
│   ┌──────────────────────────┐         ┌───────────────────────────┐    │
│   │  CMP-01: Application UI  │         │  CMP-02: Secure Ingress   │    │
│   │  Asset Server / Vite     │         │  & Policy Interceptor     │    │
│   └──────────────────────────┘         └─────────────┬─────────────┘    │
│                                                      │                  │
│   ┌──────────────────────────┐         ┌─────────────▼─────────────┐    │
│   │  CMP-03: Prompt Compiler │         │  CMP-05: Sandboxed AI     │    │
│   │  & Structured Validator  │         │  Inference Adapter        │    │
│   └──────────────────────────┘         └─────────────┬─────────────┘    │
│                                                      │                  │
│                                        ┌─────────────▼─────────────┐    │
│                                        │ Egress Proxy (googleapis) │    │
│                                        └───────────────────────────┘    │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │           CMP-04: Isolated Project State Repository             │   │
│   │  - In-Memory / SQLite State Store     - SHA-256 Audit Ledger    │   │
│   │  - Pinned Standards Lock              - Evidence Registry       │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                     Local Operating System Services                     │
│                                                                         │
│   ┌──────────────────────────┐         ┌───────────────────────────┐    │
│   │ Local Git Repositories   │         │ OS Native Credential Store│    │
│   │ (Path Boundary Guarded)  │         │ (Keychain / libsecret)    │    │
│   └──────────────────────────┘         └───────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Component Catalog

| Component ID | Name | Trust Zone | Responsibilities | Ingress / Egress Rules |
| :--- | :--- | :--- | :--- | :--- |
| **`CMP-01`** | Application UI & Client Shell | `DMZ` | Serves client assets, handles user interaction, renders lifecycle dashboards. | Ingress from browser port 3000; egress only to internal API. |
| **`CMP-02`** | Secure Ingress & Policy Interceptor | `INTERNAL_SECURE` | Validates API tokens, evaluates lifecycle gates, enforces command policies and path masks. | Ingress from `CMP-01`; egress to `CMP-03`, `CMP-04`, `CMP-05`. |
| **`CMP-03`** | Prompt Compiler & Validator | `INTERNAL_SECURE` | Compiles minimal-context prompts, validates AI output schemas, checks referential integrity. | Internal pipeline only. |
| **`CMP-04`** | Project State Repository | `RESTRICTED_DATA` | Stores project aggregates, requirements, risks, work items, evidence, and audit ledgers. | Internal data store; strictly zero outbound internet access. |
| **`CMP-05`** | Sandboxed AI Inference Adapter | `INTERNAL_SECURE` | Communicates with Google Gemini API, manages API keys server-side, enforces dual-agent reviews. | Outbound internet strictly restricted to `googleapis.com`. |

---

## 3. Trust Boundaries & Data Flow Rules

1. **Client/Server Isolation:** The browser client (`CMP-01`) never receives or stores raw provider secrets (`GEMINI_API_KEY`). All inference requests route through `CMP-02` and `CMP-05`.
2. **Restricted Data Zone (`CMP-04`):** The project state repository has zero outbound network capability, eliminating telemetry leakage.
3. **Egress Firewall Rule:** `CMP-05` is only permitted to initiate egress connections to verified Google GenAI endpoints (`*.googleapis.com`).
