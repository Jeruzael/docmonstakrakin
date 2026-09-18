# docmonstakrakin Canonical Documentation Suite
## Control Plane for the Agentic Secure Software Development Lifecycle (A-SSDLC)

**Baseline:** v0.1 Local-First MVP  
**Standard:** Canonical Documentation & Master WBS Hierarchy  
**Last Reconciled:** September 2026  

---

## 1. Canonical Hierarchy

```
docs/
│
├── README.md (This navigation guide)
├── MASTER_PLAN.md (Baseline Master Product, Architecture, Security & Implementation Plan)
│
├── 00_control/
│   ├── PROJECT_CHARTER.md (Purpose, core objectives, stakeholders, baseline principles)
│   ├── PROJECT_STATE.md (Live operational state, active phase, blockers, recommended next action)
│   ├── MASTER_WBS.md (Human-readable Master Work Breakdown Structure)
│   ├── MASTER_WBS.yaml (Authoritative machine-readable canonical WBS state)
│   ├── ROADMAP.md (Release -> Milestone -> Phase -> Sprint scheduling)
│   ├── TRACEABILITY_MATRIX.md (End-to-end trace: REQ -> ARC -> SEC -> DMK -> TEST -> EV)
│   └── CHANGELOG_DECISIONS.md (Audit trail of ratified architecture and governance decisions)
│
├── 01_product/
│   ├── PRODUCT_VISION.md (Vision, core principles, anti-slop tenets)
│   ├── SCOPE.md (In-scope v0.1 MVP capabilities vs. explicitly deferred post-MVP)
│   └── PERSONAS_AND_USE_CASES.md (Target personas, agent actors, primary workflows)
│
├── 02_requirements/
│   ├── FUNCTIONAL_REQUIREMENTS.md (System functional capability specifications)
│   ├── NON_FUNCTIONAL_REQUIREMENTS.md (Performance, security, reliability, usability)
│   └── REQUIREMENTS_REGISTER.md (Canonical register of system & assurance requirements)
│
├── 03_architecture/
│   ├── SYSTEM_ARCHITECTURE.md (High-level topology, component model CMP-01..05, trust zones)
│   ├── DATA_ARCHITECTURE.md (Canonical knowledge graph, entity schemas, storage evolution)
│   ├── AGENT_ARCHITECTURE.md (Role vs. authority separation, context packaging, dual-agent verification)
│   ├── INTEGRATION_ARCHITECTURE.md (Provider-neutral AI gateway, Gemini adapter, Google Forms)
│   └── DEPLOYMENT_ARCHITECTURE.md (Local-first desktop execution, container runtime, bundling)
│
├── 04_security/
│   ├── SECURITY_ARCHITECTURE.md (Defense-in-depth, security zones, data classifications)
│   ├── THREAT_MODEL.md (STRIDE threat analysis of control plane itself)
│   ├── RISK_REGISTER.md (Inherent & residual risk assessment, mandatory risk floors)
│   └── SECURITY_CONTROLS.md (Catalog of technical and governance controls mapped to standards)
│
├── 05_decisions/ADR/
│   ├── ADR-0001-local-first-storage.md (Local-first SQLite/In-memory storage)
│   ├── ADR-0002-single-canonical-workitem-model.md (Single unified WorkItem aggregate)
│   ├── ADR-0003-sandboxed-ai-inference-adapter.md (Server-side AI inference & egress boundaries)
│   └── ADR-0004-cryptographic-hash-chained-audit-ledger.md (Append-only SHA-256 audit ledger)
│
├── 06_planning/
│   ├── phases/
│   │   └── PHASE_GATE_CATALOG.md (15-phase lifecycle state machine & gate exit criteria)
│   ├── sprints/
│   │   └── SPRINT_CADENCE_AND_RECONCILIATION.md (Sprint history & forward cadence reconciliation)
│   └── implementation-plans/
│       ├── README.md (Directory index for engineering execution specs)
│       └── DMK-157-SecretStore-Implementation-Plan.md (Granular plan for OS Credential Store)
│
├── 07_verification/
│   ├── TEST_STRATEGY.md (Verification philosophy, test levels, invariants, and gap analysis)
│   ├── VERIFICATION_MATRIX.md (Verification status per requirement & security control)
│   └── RELEASE_GATES.md (Formal entry and exit criteria for release milestones)
│
└── 08_release/
    ├── RELEASE_READINESS.md (Evaluation of v0.1 MVP against the 25 core capabilities)
    └── RELEASE_HISTORY.md (Version milestones and release changelog)
```

---

## 2. Baseline Reference Documents

For legacy reference and continuity with previous development sprints:
- [`MASTER_PLAN.md`](./MASTER_PLAN.md) — The complete baseline Master Product, Architecture, Security, and Implementation Plan.
- [`ARCHITECTURE_AND_SPECS.md`](./ARCHITECTURE_AND_SPECS.md) — Detailed UI/UX token specifications, color semantics, and layout guidelines.
- [`WBS_AND_MASTER_TASK_LIST.md`](./WBS_AND_MASTER_TASK_LIST.md) — Comprehensive task inventory covering DMK-001 through DMK-165.
- [`PROGRESS_TRACKER.md`](./PROGRESS_TRACKER.md) — High-level sprint-by-sprint implementation log.
- [`NEXT_TASKS.md`](./NEXT_TASKS.md) — Immediate operational tasks and lifecycle gate status.
