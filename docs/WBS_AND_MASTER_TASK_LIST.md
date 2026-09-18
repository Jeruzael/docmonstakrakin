# docmonstakrakin Canonical WBS & Master Implementation List

**Baseline:** v0.1 Local-First MVP  
**Scope:** Canonical WorkItem IDs `DMK-001` through `DMK-165`  
**Authoritative Source:** Execution Planning Pack for the A-SSDLC Development Control Plane

---

## 1. Work Breakdown Structure (WBS) Summary

```
1.0 Foundation & Engineering Baseline [EPIC-01: DMK-001 – DMK-009]
2.0 Canonical Project Core [EPIC-02: DMK-010 – DMK-019]
3.0 Requirements & Discovery Engine [EPIC-03: DMK-020 – DMK-032]
4.0 A-SSDLC Lifecycle, Risk & Governance [EPIC-04: DMK-033 – DMK-044]
5.0 Standards Registry & Control Mapping [EPIC-05: DMK-045 – DMK-058]
6.0 Prompt Compiler & Structured Validation [EPIC-06: DMK-059 – DMK-073]
7.0 AI Gateway - Codex & Gemini [EPIC-07: DMK-074 – DMK-084]
8.0 Work Management & Planning Views [EPIC-08: DMK-085 – DMK-096]
9.0 Repository, Git, Permissions & Command Safety [EPIC-09: DMK-097 – DMK-113]
10.0 Evidence, Audit & Traceability [EPIC-10: DMK-114 – DMK-125]
11.0 Standards Update & Migration Engine [EPIC-11: DMK-126 – DMK-138]
12.0 Dashboard & Guided Next Action [EPIC-12: DMK-139 – DMK-149]
13.0 Forms, Export, Secrets, Hardening & v0.1 Release [EPIC-13: DMK-150 – DMK-165]
```

---

## 2. Authoritative Master Task Inventory (DMK-001 – DMK-165)

| ID | Epic | Sprint | Pri | Risk | Subsystem | Description & Scope | Dependencies | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DMK-001** | EPIC-01 | Sprint 0 | P0 | MEDIUM | Engineering | Create monorepo and root project conventions | — | Implemented |
| **DMK-002** | EPIC-01 | Sprint 0 | P0 | MEDIUM | Backend | Scaffold FastAPI / Express backend application service | DMK-001 | Implemented |
| **DMK-003** | EPIC-01 | Sprint 0 | P0 | MEDIUM | Frontend | Scaffold Next.js / React TypeScript frontend application | DMK-001 | Implemented |
| **DMK-004** | EPIC-01 | Sprint 0 | P0 | HIGH | Data | Configure persistent data schema and migrations | DMK-002 | Implemented |
| **DMK-005** | EPIC-01 | Sprint 0 | P0 | MEDIUM | Quality | Establish backend and frontend automated test harnesses | DMK-002, 003 | Implemented |
| **DMK-006** | EPIC-01 | Sprint 0 | P0 | HIGH | DevSecOps | Configure CI pipeline for tests, lint, type checks, and security checks | DMK-005 | Implemented |
| **DMK-007** | EPIC-01 | Sprint 0 | P0 | HIGH | Security | Implement typed configuration and environment handling | DMK-002 | Implemented |
| **DMK-008** | EPIC-01 | Sprint 0 | P0 | HIGH | Security | Add baseline security policy, dependency policy, and protections guidance | DMK-006 | Implemented |
| **DMK-009** | EPIC-01 | Sprint 0 | P1 | LOW | Documentation | Create architecture, ADR, security, spec, and plan documentation structure | DMK-001 | Implemented |
| **DMK-010** | EPIC-02 | Sprint 1 | P0 | HIGH | Domain | Define Project aggregate and canonical project schema | DMK-004 | Implemented |
| **DMK-011** | EPIC-02 | Sprint 1 | P0 | MEDIUM | Domain | Define primary and specialized project profile models | DMK-010 | Implemented |
| **DMK-012** | EPIC-02 | Sprint 1 | P0 | HIGH | Data | Implement ProjectRepository abstraction and persistence implementation | DMK-010 | Implemented |
| **DMK-013** | EPIC-02 | Sprint 1 | P0 | HIGH | Backend | Implement project create/read/update/archive application services | DMK-012 | Implemented |
| **DMK-014** | EPIC-02 | Sprint 1 | P0 | HIGH | Data | Implement project state version identifiers and optimistic update checks | DMK-012 | Implemented |
| **DMK-015** | EPIC-02 | Sprint 1 | P1 | MEDIUM | Backend | Implement portable project export/import envelope | DMK-010, 012 | Implemented |
| **DMK-016** | EPIC-02 | Sprint 1 | P0 | HIGH | Security | Create append-oriented base AuditEvent model and writer | DMK-012 | Implemented |
| **DMK-017** | EPIC-02 | Sprint 1 | P0 | MEDIUM | Frontend | Build project creation wizard UI with multi-step flow | DMK-013 | Implemented |
| **DMK-018** | EPIC-02 | Sprint 1 | P0 | MEDIUM | Frontend | Build multi-profile and delivery-method selection UI | DMK-011, 017 | Implemented |
| **DMK-019** | EPIC-02 | Sprint 1 | P1 | LOW | Frontend | Build project workspace shell and collapsible navigation | DMK-017 | Implemented |
| **DMK-020** | EPIC-03 | Sprint 2 | P0 | HIGH | Domain | Define Question, QuestionGroup, condition, and response schemas | DMK-010 | Implemented |
| **DMK-021** | EPIC-03 | Sprint 2 | P0 | HIGH | Backend | Implement conditional questionnaire graph evaluator | DMK-020 | Implemented |
| **DMK-022** | EPIC-03 | Sprint 2 | P0 | HIGH | Domain | Define Answer model with provenance and actor metadata | DMK-020 | Implemented |
| **DMK-023** | EPIC-03 | Sprint 2 | P0 | HIGH | Domain | Define Requirement model and requirement taxonomy | DMK-010 | Implemented |
| **DMK-024** | EPIC-03 | Sprint 2 | P0 | MEDIUM | Domain | Define Assumption and Constraint models with lifecycle states | DMK-010 | Implemented |
| **DMK-025** | EPIC-03 | Sprint 2 | P0 | HIGH | Policy | Define readiness states and blocking severity rules | DMK-020, 024 | Implemented |
| **DMK-026** | EPIC-03 | Sprint 2 | P0 | HIGH | Backend | Implement questionnaire session and branching services | DMK-021, 022 | Implemented |
| **DMK-027** | EPIC-03 | Sprint 3 | P0 | MEDIUM | Frontend | Build adaptive questionnaire UI with conditional sections and 70/30 split | DMK-026 | Implemented |
| **DMK-028** | EPIC-03 | Sprint 3 | P0 | HIGH | Backend | Implement answer validation, requiredness, and deferred/N-A handling | DMK-026 | Implemented |
| **DMK-029** | EPIC-03 | Sprint 3 | P0 | HIGH | Backend | Implement deterministic requirement creation from approved answers | DMK-023, 024, 028 | Implemented |
| **DMK-030** | EPIC-03 | Sprint 3 | P0 | HIGH | Governance | Implement requirements review and approval workflow | DMK-029 | Implemented |
| **DMK-031** | EPIC-03 | Sprint 2 | P0 | MEDIUM | Content | Seed discovery questionnaires for primary project profiles | DMK-020, 026 | Implemented |
| **DMK-032** | EPIC-03 | Sprint 3 | P1 | LOW | Export | Implement requirements baseline Markdown/JSON/YAML export | DMK-029, 030 | Implemented |
| **DMK-033** | EPIC-04 | Sprint 4 | P0 | HIGH | Domain | Define A-SSDLC phase and lifecycle-state models | DMK-010 | Implemented |
| **DMK-034** | EPIC-04 | Sprint 4 | P0 | HIGH | Policy | Define transition policy schema with entry/exit criteria | DMK-033 | Implemented |
| **DMK-035** | EPIC-04 | Sprint 4 | P0 | CRITICAL | Backend | Implement lifecycle gate evaluator | DMK-034, 026 | Implemented |
| **DMK-036** | EPIC-04 | Sprint 4 | P0 | HIGH | Risk | Define risk dimensions, likelihood, impact, and contributor taxonomy | DMK-010 | Implemented |
| **DMK-037** | EPIC-04 | Sprint 4 | P0 | HIGH | Risk | Implement risk scoring and classification service | DMK-036 | Implemented |
| **DMK-038** | EPIC-04 | Sprint 4 | P0 | CRITICAL | Risk | Implement mandatory risk-floor policy rules | DMK-037 | Implemented |
| **DMK-039** | EPIC-04 | Sprint 4 | P0 | HIGH | Risk | Implement inherent and residual risk records and control effects | DMK-037 | Implemented |
| **DMK-040** | EPIC-04 | Sprint 4 | P0 | CRITICAL | Governance | Implement human approval records and approval policy evaluation | DMK-035, 039 | Implemented |
| **DMK-041** | EPIC-04 | Sprint 4 | P0 | CRITICAL | Governance | Implement override and risk-acceptance workflow with reason/expiry | DMK-035, 040 | Implemented |
| **DMK-042** | EPIC-04 | Sprint 4 | P0 | HIGH | Guidance | Implement deterministic recommended-next-action engine | DMK-035, 026 | Implemented |
| **DMK-043** | EPIC-04 | Sprint 4 | P1 | MEDIUM | Frontend | Build lifecycle and risk UI with risk explanations, gates, and overrides | DMK-035, 039, 041 | Implemented |
| **DMK-044** | EPIC-04 | Sprint 4 | P0 | CRITICAL | Quality | Add lifecycle/risk policy regression tests | DMK-035, 038, 041 | Implemented |
| **DMK-045** | EPIC-05 | Sprint 5 | P0 | HIGH | Domain | Define TrustedSource, Standard, StandardVersion, and Control models | DMK-010 | Implemented |
| **DMK-046** | EPIC-05 | Sprint 5 | P0 | CRITICAL | Security | Define source trust levels and allowed-update policy | DMK-045 | Implemented |
| **DMK-047** | EPIC-05 | Sprint 5 | P0 | HIGH | Data | Implement immutable raw standards snapshot store | DMK-046 | Implemented |
| **DMK-048** | EPIC-05 | Sprint 5 | P0 | HIGH | Architecture | Define parser adapter interface for standards ingestion | DMK-046 | Implemented |
| **DMK-049** | EPIC-05 | Sprint 5 | P0 | HIGH | Backend | Implement standard/control normalization and stable internal identifiers | DMK-048 | Implemented |
| **DMK-050** | EPIC-05 | Sprint 5 | P0 | HIGH | Content | Seed NIST SSDF source metadata and selected control mappings | DMK-049 | Implemented |
| **DMK-051** | EPIC-05 | Sprint 5 | P0 | HIGH | Content | Seed OWASP ASVS source metadata and selected control mappings | DMK-050 | Implemented |
| **DMK-052** | EPIC-05 | Sprint 5 | P0 | HIGH | Content | Seed OWASP MASVS source metadata and selected control mappings | DMK-050 | Implemented |
| **DMK-053** | EPIC-05 | Sprint 5 | P0 | HIGH | Content | Seed OWASP AISVS source metadata and selected control mappings | DMK-050 | Implemented |
| **DMK-054** | EPIC-05 | Sprint 5 | P1 | MEDIUM | Content | Seed OWASP SAMM lifecycle/maturity mappings | DMK-050 | Implemented |
| **DMK-055** | EPIC-05 | Sprint 5 | P0 | CRITICAL | Backend | Implement per-project standards lock and version pinning | DMK-046, 051 | Implemented |
| **DMK-056** | EPIC-05 | Sprint 5 | P0 | HIGH | Backend | Implement requirement/profile/control mapping service | DMK-024, 051 | Implemented |
| **DMK-057** | EPIC-05 | Sprint 5 | P1 | MEDIUM | Frontend | Build standards applicability, source, and pinned-version UI | DMK-055, 056 | Implemented |
| **DMK-058** | EPIC-05 | Sprint 5 | P0 | HIGH | Compliance | Record license/source/retrieval/checksum metadata for standards assets | DMK-048 | Implemented |
| **DMK-059** | EPIC-06 | Sprint 6 | P0 | HIGH | Domain | Define Prompt, PromptVersion, role, status, and evaluation models | DMK-010 | Implemented |
| **DMK-060** | EPIC-06 | Sprint 6 | P0 | HIGH | Governance | Implement prompt lifecycle: draft, testing, approved, recommended, deprecated | DMK-059 | Implemented |
| **DMK-061** | EPIC-06 | Sprint 6 | P0 | HIGH | AI | Define scoped AgentContextPackage schema | DMK-059 | Implemented |
| **DMK-062** | EPIC-06 | Sprint 6 | P0 | CRITICAL | AI | Implement prompt compiler from project/task/risk/standards/permissions | DMK-061, 056 | Implemented |
| **DMK-063** | EPIC-06 | Sprint 6 | P0 | HIGH | Content | Create baseline role prompt templates (architect, developer, security, etc.) | DMK-062 | Implemented |
| **DMK-064** | EPIC-06 | Sprint 6 | P0 | CRITICAL | AI | Define canonical structured AI response JSON Schema | DMK-061 | Implemented |
| **DMK-065** | EPIC-06 | Sprint 6 | P0 | CRITICAL | Validation | Implement syntactic and JSON Schema response validation | DMK-064 | Implemented |
| **DMK-066** | EPIC-06 | Sprint 6 | P0 | CRITICAL | Validation | Implement semantic validators for assumptions, IDs, and relationships | DMK-065 | Implemented |
| **DMK-067** | EPIC-06 | Sprint 6 | P0 | CRITICAL | Validation | Implement project-state and referential-integrity validation | DMK-066, 010 | Implemented |
| **DMK-068** | EPIC-06 | Sprint 6 | P0 | CRITICAL | Validation | Implement policy validation for risk, permissions, and lifecycle constraints | DMK-067, 035, 041 | Implemented |
| **DMK-069** | EPIC-06 | Sprint 6 | P0 | MEDIUM | AI | Implement manual paste/file import of structured AI responses | DMK-065 | Implemented |
| **DMK-070** | EPIC-06 | Sprint 6 | P0 | HIGH | Frontend | Build proposed-change review and selective accept/reject UI | DMK-069, 068 | Implemented |
| **DMK-071** | EPIC-06 | Sprint 6 | P0 | HIGH | Validation | Implement conflict detection and unresolved-decision generation | DMK-066, 067 | Implemented |
| **DMK-072** | EPIC-06 | Sprint 6 | P1 | HIGH | AI | Implement auditable repair/retry flow for invalid responses | DMK-065, 070 | Implemented |
| **DMK-073** | EPIC-06 | Sprint 6 | P1 | MEDIUM | Quality | Create prompt-evaluation harness and baseline fixtures | DMK-059, 064 | Implemented |
| **DMK-074** | EPIC-07 | Sprint 7 | P0 | CRITICAL | Architecture | Define provider-neutral AIProvider interface | DMK-064 | Implemented |
| **DMK-075** | EPIC-07 | Sprint 7 | P0 | HIGH | AI | Implement provider capability model and feature negotiation | DMK-074 | Implemented |
| **DMK-076** | EPIC-07 | Sprint 7 | P0 | CRITICAL | AI | Implement OpenAI / Codex provider adapter | DMK-074, 075 | Active |
| **DMK-077** | EPIC-07 | Sprint 7 | P0 | CRITICAL | AI | Implement OpenAI structured response handling and validation bridge | DMK-076, 065 | Active |
| **DMK-078** | EPIC-07 | Sprint 7 | P0 | HIGH | Audit | Persist AgentRun history, request metadata, status, and outputs | DMK-074 | Implemented |
| **DMK-079** | EPIC-07 | Sprint 7 | P0 | CRITICAL | AI | Implement Gemini provider adapter via Google Gen AI SDK | DMK-074, 075 | Implemented |
| **DMK-080** | EPIC-07 | Sprint 7 | P0 | CRITICAL | AI | Implement Gemini structured response handling and validation bridge | DMK-079, 065 | Implemented |
| **DMK-081** | EPIC-07 | Sprint 7 | P0 | CRITICAL | AI | Implement independent second-agent review orchestration | DMK-077, 080 | Active |
| **DMK-082** | EPIC-07 | Sprint 7 | P1 | HIGH | Reliability | Implement provider timeouts, cancellation, retry, and failure UI | DMK-076, 079 | Implemented |
| **DMK-083** | EPIC-07 | Sprint 7 | P2 | LOW | Observability | Capture token/cost/model metadata when provider exposes it | DMK-078 | Implemented |
| **DMK-084** | EPIC-07 | Sprint 7 | P0 | CRITICAL | Security | Integrate provider credentials through secret references, never project fields | DMK-076, 079 | Implemented |
| **DMK-085** | EPIC-08 | Sprint 8 | P0 | HIGH | Domain | Define canonical WorkItem, Epic, type, status, priority, and linkage schema | DMK-010 | Implemented |
| **DMK-086** | EPIC-08 | Sprint 8 | P0 | HIGH | Backend | Implement hierarchy, parent-child, dependency, and cycle validation | DMK-085 | Implemented |
| **DMK-087** | EPIC-08 | Sprint 8 | P0 | HIGH | Backend | Implement acceptance-criteria, requirement, risk, test, and evidence links | DMK-085 | Implemented |
| **DMK-088** | EPIC-08 | Sprint 8 | P0 | MEDIUM | Frontend | Build WBS hierarchical view grouped by Epics | DMK-086 | Implemented |
| **DMK-089** | EPIC-08 | Sprint 8 | P0 | MEDIUM | Frontend | Build product backlog prioritized tabular view | DMK-085 | Implemented |
| **DMK-090** | EPIC-08 | Sprint 8 | P0 | MEDIUM | Frontend | Build sprint backlog and sprint-assignment view | DMK-085 | Implemented |
| **DMK-091** | EPIC-08 | Sprint 8 | P0 | MEDIUM | Frontend | Build master task / master implementation list view | DMK-085 | Implemented |
| **DMK-092** | EPIC-08 | Sprint 8 | P1 | LOW | Frontend | Build execution checklist view from work-item/subtask data | DMK-085 | Implemented |
| **DMK-093** | EPIC-08 | Sprint 8 | P2 | LOW | Planning | Implement milestone/roadmap projection from work items | DMK-086 | Implemented |
| **DMK-094** | EPIC-08 | Sprint 8 | P0 | HIGH | AI | Import AI-proposed work items as proposals rather than committed tasks | DMK-070, 085 | Implemented |
| **DMK-095** | EPIC-08 | Sprint 8 | P0 | CRITICAL | Policy | Implement work-item status policy and evidence-aware completion rules | DMK-085, 035 | Implemented |
| **DMK-096** | EPIC-08 | Sprint 8 | P1 | MEDIUM | Frontend | Build work-item detail, dependencies, traceability, and history drawer | DMK-086, 087 | Implemented |
| **DMK-097** | EPIC-09 | Sprint 9 | P0 | HIGH | Repository | Implement local repository connection and repository identity model | DMK-013 | Implemented |
| **DMK-098** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Implement canonical-path resolution and workspace-boundary checks | DMK-097 | Implemented |
| **DMK-099** | EPIC-09 | Sprint 9 | P0 | HIGH | Repository | Build repository file-tree index service | DMK-098 | Implemented |
| **DMK-100** | EPIC-09 | Sprint 9 | P1 | MEDIUM | Repository | Detect languages, frameworks, manifests, tests, docs, and entry points | DMK-099 | Implemented |
| **DMK-101** | EPIC-09 | Sprint 9 | P0 | HIGH | Repository | Implement safe repository search and scoped file reads | DMK-098, 099 | Implemented |
| **DMK-102** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Define AgentPermissionSet model (files, terminal, network, secrets) | DMK-010 | Implemented |
| **DMK-103** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Implement path allow/deny evaluation with deny precedence | DMK-102, 098 | Implemented |
| **DMK-104** | EPIC-09 | Sprint 9 | P0 | HIGH | Git | Implement Git read service: status, branch, log, diff metadata | DMK-097 | Implemented |
| **DMK-105** | EPIC-09 | Sprint 9 | P0 | HIGH | Git | Implement controlled branch creation and branch-policy checks | DMK-104, 102 | Implemented |
| **DMK-106** | EPIC-09 | Sprint 9 | P0 | HIGH | Git | Implement diff generation and change preview | DMK-104 | Implemented |
| **DMK-107** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Repository | Implement scoped repository write service with permission enforcement | DMK-101, 103 | Implemented |
| **DMK-108** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Define structured ProposedCommand model | DMK-102 | Implemented |
| **DMK-109** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Implement command policy classification and confirmation requirements | DMK-108, 038 | Implemented |
| **DMK-110** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Repository | Implement controlled local command runner with resource constraints | DMK-109 | Implemented |
| **DMK-111** | EPIC-09 | Sprint 9 | P1 | HIGH | Git | Link commits and diffs to work items and agent runs | DMK-104, 085 | Implemented |
| **DMK-112** | EPIC-09 | Sprint 9 | P1 | MEDIUM | Git | Implement PR-readiness checks without requiring hosted Git integration | DMK-105, 111 | Implemented |
| **DMK-113** | EPIC-09 | Sprint 9 | P0 | CRITICAL | Security | Add repository prompt-injection warnings and untrusted-content boundaries | DMK-101, 062 | Implemented |
| **DMK-114** | EPIC-10 | Sprint 10 | P0 | HIGH | Domain | Define Evidence model, evidence types, producers, hashes, and work links | DMK-085 | Implemented |
| **DMK-115** | EPIC-10 | Sprint 10 | P0 | HIGH | Backend | Implement evidence ingestion and validation service | DMK-114 | Implemented |
| **DMK-116** | EPIC-10 | Sprint 10 | P0 | HIGH | Evidence | Capture test-command results as evidence | DMK-110, 115 | Implemented |
| **DMK-117** | EPIC-10 | Sprint 10 | P0 | HIGH | Evidence | Capture diff/commit metadata as evidence | DMK-106, 111, 115 | Implemented |
| **DMK-118** | EPIC-10 | Sprint 10 | P0 | CRITICAL | Policy | Implement implemented/verified/approved/released/deployed status distinctions | DMK-114, 095 | Implemented |
| **DMK-119** | EPIC-10 | Sprint 10 | P0 | HIGH | Audit | Extend audit ledger for agent runs and tool actions | DMK-016, 078 | Implemented |
| **DMK-120** | EPIC-10 | Sprint 10 | P0 | HIGH | Audit | Extend audit ledger for human decisions, approvals, and overrides | DMK-016, 040, 041 | Implemented |
| **DMK-121** | EPIC-10 | Sprint 10 | P0 | CRITICAL | Security | Implement append-only audit semantics and deletion restrictions | DMK-016 | Implemented |
| **DMK-122** | EPIC-10 | Sprint 10 | P1 | HIGH | Security | Implement audit integrity chaining/hash verification | DMK-121 | Implemented |
| **DMK-123** | EPIC-10 | Sprint 10 | P1 | MEDIUM | Frontend | Build audit timeline and filter UI | DMK-119, 120 | Implemented |
| **DMK-124** | EPIC-10 | Sprint 10 | P0 | HIGH | Backend | Implement end-to-end traceability graph/query service | DMK-024, 056, 087, 114 | Implemented |
| **DMK-125** | EPIC-10 | Sprint 10 | P0 | HIGH | Quality | Implement requirements coverage and missing-evidence analysis | DMK-124, 118 | Implemented |
| **DMK-126** | EPIC-11 | Sprint 11 | P0 | HIGH | Standards | Implement standards update checker against configured trusted sources | DMK-046, 055 | Implemented |
| **DMK-127** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Security | Fetch updates with strict origin/redirect/size/content-type controls | DMK-126 | Implemented |
| **DMK-128** | EPIC-11 | Sprint 11 | P0 | HIGH | Security | Hash and store immutable update source snapshot and retrieval metadata | DMK-127 | Implemented |
| **DMK-129** | EPIC-11 | Sprint 11 | P0 | HIGH | Standards | Parse candidate standard versions using versioned parser adapters | DMK-128, 049 | Implemented |
| **DMK-130** | EPIC-11 | Sprint 11 | P1 | HIGH | AI | Run AI semantic analysis on candidate standard changes | DMK-129, 081 | Implemented |
| **DMK-131** | EPIC-11 | Sprint 11 | P1 | HIGH | AI | Run independent second-agent standards-change review | DMK-130, 081 | Active |
| **DMK-132** | EPIC-11 | Sprint 11 | P0 | HIGH | Standards | Generate semantic control diff: added, changed, deprecated, removed | DMK-129 | Implemented |
| **DMK-133** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Standards | Generate project impact analysis across questions, requirements, and gates | DMK-132, 056, 035 | Implemented |
| **DMK-134** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Migration | Implement migration dry-run with isolated proposed state | DMK-133 | Implemented |
| **DMK-135** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Governance | Implement standards migration approval workflow | DMK-134, 041 | Implemented |
| **DMK-136** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Migration | Implement deterministic project standards migration engine | DMK-134, 135 | Implemented |
| **DMK-137** | EPIC-11 | Sprint 11 | P0 | CRITICAL | Migration | Implement migration rollback to pre-migration snapshot | DMK-136 | Implemented |
| **DMK-138** | EPIC-11 | Sprint 11 | P0 | HIGH | Audit | Audit update discovery, analysis, approval, migration, and rollback | DMK-126, 136, 120 | Implemented |
| **DMK-139** | EPIC-12 | Sprint 12 | P0 | MEDIUM | Dashboard | Implement requirements-readiness progress calculator | DMK-026, 030 | Implemented |
| **DMK-140** | EPIC-12 | Sprint 12 | P0 | HIGH | Dashboard | Implement architecture/implementation/verification progress calculators | DMK-095, 118, 125 | Implemented |
| **DMK-141** | EPIC-12 | Sprint 12 | P0 | MEDIUM | Frontend | Build project health summary cards | DMK-139, 140 | Implemented |
| **DMK-142** | EPIC-12 | Sprint 12 | P0 | MEDIUM | Frontend | Build blockers and unresolved-decisions panel | DMK-071, 035 | Implemented |
| **DMK-143** | EPIC-12 | Sprint 12 | P0 | HIGH | Frontend | Integrate deterministic next-safe-action recommendation into dashboard | DMK-042, 142 | Implemented |
| **DMK-144** | EPIC-12 | Sprint 12 | P1 | MEDIUM | Frontend | Build risk dashboard with inherent/residual explanation | DMK-037, 039 | Implemented |
| **DMK-145** | EPIC-12 | Sprint 12 | P1 | MEDIUM | Frontend | Build standards status, pinned-version, and update indicator panel | DMK-055, 126 | Implemented |
| **DMK-146** | EPIC-12 | Sprint 12 | P1 | MEDIUM | Frontend | Build agent activity and provider-run panel | DMK-078, 119 | Implemented |
| **DMK-147** | EPIC-12 | Sprint 12 | P1 | MEDIUM | Frontend | Build approvals, overrides, and accepted-risk panel | DMK-040, 041 | Implemented |
| **DMK-148** | EPIC-12 | Sprint 12 | P0 | MEDIUM | Frontend | Build lifecycle visualization with gate drill-down | DMK-043 | Implemented |
| **DMK-149** | EPIC-12 | Sprint 12 | P0 | MEDIUM | Reliability | Implement offline / unavailable-provider states throughout dashboard | DMK-019, 078 | Implemented |
| **DMK-150** | EPIC-13 | Sprint 13 | P1 | MEDIUM | Forms | Define Google Forms export mapping from internal question types | DMK-020 | Planned |
| **DMK-151** | EPIC-13 | Sprint 13 | P1 | HIGH | Forms | Implement Google Forms Apps Script/API export generator | DMK-150 | Planned |
| **DMK-152** | EPIC-13 | Sprint 13 | P1 | HIGH | Forms | Implement Google Forms response import and provenance mapping | DMK-151, 022 | Planned |
| **DMK-153** | EPIC-13 | Sprint 13 | P1 | HIGH | Frontend | Build stakeholder response inbox and proposed-requirement review | DMK-152, 070 | Planned |
| **DMK-154** | EPIC-13 | Sprint 13 | P0 | MEDIUM | Export | Implement canonical Markdown documentation exporters (PRD, SAD, RTM) | DMK-010, 024, 085 | Implemented |
| **DMK-155** | EPIC-13 | Sprint 13 | P0 | HIGH | Export | Implement JSON/YAML canonical project exports | DMK-010 | Implemented |
| **DMK-156** | EPIC-13 | Sprint 13 | P0 | HIGH | Export | Implement portable .docmonstakrakin project package creation/import | DMK-155, 015 | Active |
| **DMK-157** | EPIC-13 | Sprint 13 | P0 | CRITICAL | Security | Define SecretStore interface and secret-reference model | DMK-007 | Active |
| **DMK-158** | EPIC-13 | Sprint 13 | P0 | CRITICAL | Security | Implement OS-backed credential-store adapter and provider-secret migration | DMK-157, 084 | Active |
| **DMK-159** | EPIC-13 | Sprint 14 | P0 | CRITICAL | Quality | Build dedicated security regression test suite for permissions, paths, commands | DMK-103, 109, 128, 158 | Planned |
| **DMK-160** | EPIC-13 | Sprint 14 | P0 | HIGH | Quality | Create golden reference projects and expected lifecycle/risk/control outcomes | DMK-032, 044, 058 | Planned |
| **DMK-161** | EPIC-13 | Sprint 14 | P0 | CRITICAL | Quality | Implement end-to-end golden-flow tests from creation to evidence-backed work | DMK-160, 159 | Planned |
| **DMK-162** | EPIC-13 | Sprint 14 | P0 | CRITICAL | Reliability | Test local performance, crash recovery, SQLite backup/restore, offline behavior | DMK-004, 149, 156 | Planned |
| **DMK-163** | EPIC-13 | Sprint 14 | P0 | HIGH | Release | Create local launcher/package workflow and release build validation | DMK-161, 162 | Planned |
| **DMK-164** | EPIC-13 | Sprint 14 | P1 | LOW | Documentation | Write user onboarding, project workflow, AI-safety, and recovery documentation | DMK-163 | Implemented |
| **DMK-165** | EPIC-13 | Sprint 14 | P0 | CRITICAL | Release | Execute v0.1 definition-of-done review and release-readiness gate | DMK-159, 160, 161, 164 | Planned |
