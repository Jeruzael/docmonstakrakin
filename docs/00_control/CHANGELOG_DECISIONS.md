# docmonstakrakin Control Plane Decision Changelog
## Architectural & Governance Baseline Decision Audit Trail

**Document ID:** DOC-CTRL-006  
**Baseline:** v0.1 Local-First MVP  
**Standard:** Immutable Historical Audit Log  

---

## 1. Decision History

| Date | Actor | Event / Decision | Impact / Summary | Canonical Reference |
| :--- | :--- | :--- | :--- | :--- |
| **2026-09-19** | Bootstrap Security Architect / Lead | **Step 4A Self-Bootstrap Security & Review-Binding Correction Implemented — Human Review Pending (`DMK-192`)** | Hardened self-bootstrap executor: eliminated code-level document bypass heuristics in favor of manifest-declared unpinned living control documents (`DOC-CTRL-002`, `003`, `004`, `006`); enforced reviewed manifest digest execution binding (`229215f6...`) with anti-TOCTOU protection; removed arbitrary production `--manifest` CLI selection; verified atomic pre-rename failure protection; introduced explicit snapshot create/replace reporting; separated manifest schema (`SELF_BOOTSTRAP_V1`) and project state schema (`1`) CLI reporting; removed synthetic EV reference leaving only retained document evidence; updated DMK-192 status to `VERIFICATION_PENDING`. | `REQ-BOOT-001`, `DMK-192`, DOC-CTRL-003, DOC-CTRL-007 |
| **2026-09-16** | QA Lead / Build Master | **Automated QA Remediation Pass Ratified** | Remediated QA-AUTO-WBS-004 (historical dependencies DMK-007, 105, 110, 114, 120, 126 restored with EV evidence), QA-AUTO-WBSR-001 (deterministic renderer `npm run wbs:render`), and QA-AUTO-WBSR-002 (zero-drift validator `npm run wbs:check`). Synchronized canonical baseline metadata to v0.1.0-rc1. | `DMK-007`, `DMK-105`, `DMK-110`, `DMK-114`, `DMK-120`, `DMK-126`, DOC-CTRL-003 |
| **2026-09-15** | Project Lead / Security Officer | **Canonical Documentation Hierarchy Ratified** | Established formal documentation structure under `docs/00_control/` through `08_release/` and preserved Master Plan as design baseline. | DOC-CTRL-001 |
| **2026-09-15** | Lead Architect | **Dual-Agent Review Engine Ratified (`DMK-081`)** | Codified independent reviewer invocation in `server.ts` and UI cards in `AgentCenterView.tsx`; attached `EV-106`. | `DMK-081`, `EV-106` |
| **2026-09-15** | Security Officer | **CMP-05 Egress Controls Ratified** | Formalized zero model memory spooling, server-only proxy token, and Google GenAI egress restriction to `googleapis.com`. | `ADR-0003`, `AUD-911` |
| **2026-09-15** | Lead Architect | **REQ-SEC-019 Mapped to CMP-02** | Connected refresh-token revocation policy to Ingress/Policy Interceptor component, passing Architecture Gate criteria 4/4. | `CMP-02`, `AUD-911` |
| **2026-09-15** | Security Officer | **Requirements Gate Ratified (`APV-001`, `APV-002`)** | Approved functional, security, and data protection baselines; transitioned project to Architecture phase. | `AUD-910` |
| **2026-08-20** | Project Lead | **Single Canonical WorkItem Model Accepted** | Banned separate backlog and checklist stores in favor of unified `WorkItem` projection. | `ADR-0002` |
| **2026-08-15** | Architecture Team | **Local-First SQLite / In-Memory Storage Selected** | Selected offline local-first storage for v0.1 MVP; deferred PostgreSQL to post-MVP SaaS phase. | `ADR-0001` |
