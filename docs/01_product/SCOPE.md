# docmonstakrakin Product Scope
## In-Scope vs. Explicitly Deferred Capabilities

**Document ID:** DOC-PROD-002  
**Baseline:** v0.1 Local-First MVP  
**Reference:** Master Plan §63 (MVP Definition) & §64 (Explicitly Deferred)  

---

## 1. In-Scope for v0.1 Local-First MVP

1. **Project Core:** Project creation wizard, 6 primary profiles (`WEB`, `MOBILE`, `BACKEND_API`, `DESKTOP`, `AI`, `AGENTIC_AI`), local storage, state versioning, portable export/import.
2. **Requirements Engine:** Conditional adaptive questionnaire graph, blocker severity rules, requirements taxonomy, assumptions/constraints registers, requirements baseline approvals.
3. **A-SSDLC & Risk Engine:** 15-phase lifecycle state machine, inherent/residual risk scoring, mandatory risk floors, human approval gates, auditable gate overrides.
4. **Standards Registry:** Pinned NIST SSDF, OWASP ASVS, MASVS, AISVS, SAMM controls; source trust levels; manual update checking with semantic diff previews.
5. **Prompt Compiler & Validation:** Scoped context packages ($Role + State + Phase + Task + Standards + Risk + Permissions$), JSON Schema response validation, manual paste/import workflow.
6. **AI Gateway:** Server-side Gemini API adapter, Codex adapter contract, AgentRun history persistence, dual-agent independent cross-review.
7. **Work Management:** Canonical WorkItem aggregate powering Kanban, WBS, Product Backlog, Sprint Backlog, and Master Task list projections.
8. **Repository & Command Safety:** Safe path resolution, path allow/deny boundary evaluation (`src/**` allowed, `secrets/**` denied), Git status/log/diff inspection, structured command execution with risk confirmation.
9. **Evidence & Audit:** SHA-256 evidence records, test/commit linkage, append-only cryptographically chained audit ledger, full RTM traceability.
10. **Dashboard & Guided Next Action:** Deterministic next-safe-action recommendation, 5-question above-the-fold layout, multi-dimensional health metrics.
11. **Offline Mode:** Full local project management, requirements editing, work tracking, and standards browsing without internet.
12. **Secrets Management Baseline:** Native OS credential manager abstraction with encrypted local fallback.

---

## 2. Explicitly Deferred Beyond MVP (Post-v0.1)

As codified in Master Plan §64, the following items are **strictly out of scope** for v0.1:
- Multi-user real-time collaboration and team organization accounts;
- Centralized SaaS cloud database synchronization (PostgreSQL / Cloud SQL);
- Commercial subscription billing and enterprise tenant isolation;
- Direct automated production deployment pipelines to cloud infrastructure;
- Third-party issue tracker integrations (Jira, Linear, Notion, GitHub Issues sync);
- Enterprise SSO (SAML/Okta);
- Autonomous coding agent loops without human-in-the-loop review;
- Native mobile companion application;
- Advanced cryptographic hardware token signing (Sigstore/TUF live key infrastructure).
