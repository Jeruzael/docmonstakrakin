# docmonstakrakin A-SSDLC Phase Gate Catalog
## 15-Phase Lifecycle State Machine & Machine-Readable Gate Criteria

**Document ID:** DOC-PLAN-001  
**Baseline:** v0.1 Local-First MVP  

---

## 1. Lifecycle Phase Overview

```
[1. Discovery] ──► [2. Requirements] ──► [3. Req Review] ──► [4. Risk Assessment]
                                                                      │
[8. Planning] ◄── [7. Arch Review] ◄── [6. Architecture] ◄── [5. Threat Modeling]
      │
      ▼
[9. Implementation] ──► [10. Verification] ──► [11. Security Review] ──► [12. Release]
                                                                              │
[15. Feedback] ◄────── [14. Operations] ◄────── [13. Deployment] ◄───────────┘
```

---

## 2. Gate Definitions & Exit Criteria

### Gate 1: Discovery &rarr; Requirements
- **Entry Criteria:** Project profile and delivery methodology selected.
- **Exit Criteria:** Core discovery questionnaire answered ($\ge 80\%$ complete); zero unanswered `BLOCKING` questions.
- **Status:** **SATISFIED / PASSED**

### Gate 2: Requirements &rarr; Requirements Review
- **Entry Criteria:** Structured requirements catalog generated (`REQ-xxx`).
- **Exit Criteria:** All requirements categorized by taxonomy; non-functional constraints attached.
- **Status:** **SATISFIED / PASSED**

### Gate 3: Requirements Review &rarr; Risk Assessment
- **Entry Criteria:** Requirements baseline review requested.
- **Exit Criteria:** Formal stakeholder / Security Lead sign-off (`APV-001`, `APV-002`).
- **Status:** **SATISFIED / PASSED** (`AUD-910`)

### Gate 4: Risk Assessment &rarr; Threat Modeling
- **Entry Criteria:** Project capabilities and data sensitivity declared.
- **Exit Criteria:** Inherent risks calculated; mandatory risk floors applied.
- **Status:** **SATISFIED / PASSED**

### Gate 5: Threat Modeling &rarr; Architecture
- **Entry Criteria:** High/Critical inherent risks identified.
- **Exit Criteria:** STRIDE threats mapped; mitigating technical controls assigned.
- **Status:** **SATISFIED / PASSED**

### Gate 6: Architecture &rarr; Architecture Review
- **Entry Criteria:** Component boundaries, trust zones, and ADRs drafted.
- **Exit Criteria:** Ingress/egress rules defined; 100% of P0 requirements mapped to components.
- **Status:** **SATISFIED / PASSED** (`AUD-911`)

### Gate 7: Architecture Review &rarr; Planning
- **Entry Criteria:** Architecture baseline review requested.
- **Exit Criteria:** 4 of 4 architecture gate criteria satisfied; zero unmitigated critical design flaws.
- **Status:** **ACTIVE / READY TO ADVANCE**

### Gate 8: Planning &rarr; Implementation
- **Entry Criteria:** WBS decomposed to atomic work items; dependencies identified.
- **Exit Criteria:** Sprint/Cadence backlog assigned; acceptance criteria defined for every P0 work item.
- **Status:** **QUEUED**

### Gates 9–15: Implementation through Feedback
- Governed by automated test run evidence (`TEST_RUN`), security scans, dual-agent sign-offs, and final DoD ratification (`DMK-165`).
