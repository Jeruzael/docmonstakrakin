# docmonstakrakin Release Roadmap & Milestones
## Release Scheduling, Milestones, and Execution Horizon

**Document ID:** DOC-CTRL-004  
**Authoritative Baseline:** v0.1.0-rc1 (Technically Verified Release Candidate; Gate 7 Human Sign-off Pending)  
**Principle:** WBS defines *WHAT* work exists; Roadmap defines *WHEN* work is scheduled.  

---

## 1. Release Milestones & Phase Sequence

```
v0.1.0-rc1 Local-First MVP [TECHNICALLY VERIFIED RELEASE CANDIDATE — Gate 7 Human Sign-off Pending]
├── Milestone 1: Engineering Core & Requirements Baseline [VERIFIED]
│   ├── Phase 0: Foundation & Infrastructure
│   ├── Phase 1: Canonical Project Core
│   └── Phase 2: Requirements & Discovery Engine
│
├── Milestone 2: Governance & Architecture Baseline [VERIFIED]
│   ├── Phase 3: A-SSDLC Lifecycle, Risk & Policy Engine
│   ├── Phase 4: Standards Registry & Pinned Controls
│   └── Phase 5: Prompt Compiler & Structured Validation
│
├── Milestone 3: AI Gateway & Evidence Ledger [VERIFIED]
│   ├── Phase 6: AI Gateway (Codex & Gemini Adapters)
│   ├── Phase 7: Work Management Projections
│   ├── Phase 8: Repository & Command Safety
│   └── Phase 9: Evidence Ledger & Audit Chain
│
└── Milestone 4: Standards Migration, Secrets & v0.1 Release Gate [VERIFIED]
    ├── Phase 10: Standards Update Engine
    ├── Phase 11: Dashboard & Guided Safe Action
    └── Phase 12: Forms, Export, Secrets & Release Gate (Gates 1-6 Passed, Gate 7 Pending)

v0.2 Connected Governance & Team Workspaces [PLANNING STATE — Implementation Gated]
├── Milestone 5: Peer Trust & Multi-Agent Identity [PROPOSED]
│   └── Phase 13: Epic 14 - Multi-Agent Collaboration & Peer Trust (DMK-166 to DMK-171)
│
├── Milestone 6: Encrypted Sync & Conflict Engine [PROPOSED]
│   └── Phase 14: Epic 15 - Encrypted Sync Gateway & Transport Abstraction (DMK-172 to DMK-178)
│
├── Milestone 7: Post-MVP Ecosystem Bridges [PROPOSED]
│   └── Phase 15: Epic 16 - Post-MVP Integrations & Extensibility (DMK-179 to DMK-184)
│
└── Milestone 8: Multi-Node DoD Review & Release Gate [PROPOSED]
    └── Phase 16: Epic 17 - v0.2 Governance, Verification & Closure (DMK-185)
```

---

## 2. Sprint Cadence & Allocation Status

*Note: Sprints are temporary scheduling vehicles. Tasks whose sprint assignment has not been formally approved by the Project Lead remain `UNASSIGNED`.*

| Milestone / Cadence | Target Scope | Assigned DMK Tasks | Status |
| :--- | :--- | :--- | :--- |
| **Historical Sprints 0–12** | Foundation, Core, Requirements, Lifecycle, Standards, Prompts, Gateway, Work, Repo, Evidence, Dashboard | `DMK-001` through `DMK-149` | **COMPLETED / RATIFIED** |
| **Milestone 4 (Sprint Cadence A)** | SecretStore & Credential Hardening | `DMK-157` (`DMK-157.1`–`157.5`), `DMK-158` | **VERIFIED** (`EV-157`, `EV-158`) |
| **Milestone 4 (Sprint Cadence B)** | Forms, Portable Packages & Ingestion | `DMK-150`, `DMK-151`, `DMK-152`, `DMK-153`, `DMK-156` | **VERIFIED** (`EV-156`) |
| **Milestone 4 (Sprint Cadence C - Final)** | Security Regression, Golden Projects & v0.1 DoD Gate | `DMK-159`, `DMK-160`, `DMK-161`, `DMK-162`, `DMK-163`, `DMK-165` | **VERIFIED** (`EV-159`, `EV-165`) |
| **Milestone v0.2 Kickoff (Planning)** | Team Collaboration, Encrypted Sync Gateway & Multi-Agent Gateways | `DMK-166` through `DMK-185` (Unassigned to Sprints) | **PLANNING ONLY (Entry Gated)** |


---

## 3. Post-v0.1 Roadmap (Explicitly Deferred Beyond MVP)

As defined in Section 64 of the Master Plan, the following capabilities are explicitly out of scope for v0.1 and deferred to post-MVP releases:
- Multi-user team collaboration, organizations, and RBAC.
- SaaS cloud database synchronization (PostgreSQL / Managed Cloud).
- Commercial billing, subscriptions, and tenant isolation.
- Direct automated production deployments to third-party clouds.
- Third-party issue tracker integrations (Jira, Linear, GitHub Issues sync).
- Fully autonomous agent execution loops without human gates.
