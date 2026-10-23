# docmonstakrakin Risk Register
## Inherent & Residual Risk Assessment and Mandatory Risk Floors

**Document ID:** DOC-SEC-003  
**Baseline:** v0.1 Local-First MVP  
**Methodology:** $Risk = Likelihood \times Impact$ (Scale 1–5; 1–4 Low, 5–9 Medium, 10–16 High, 17–25 Critical)  

---

## 1. Project Risk Register

| Risk ID | Title & Driver | Inherent Likelihood | Inherent Impact | Inherent Score | Applied Controls | Residual Likelihood | Residual Impact | Residual Score | Risk Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`RISK-001`** | Unauthorized Filesystem Traversal | 4 | 4 | **16 (HIGH)** | Canonical path boundary verification, path allow/deny policy interceptor. | 1 | 4 | **4 (LOW)** | Controlled |
| **`RISK-004`** | Indirect Prompt Injection via Repository Code | 4 | 4 | **16 (HIGH)** | Scoped context compiler, zero memory inference, dual-agent verification. | 2 | 3 | **6 (MEDIUM)** | Tolerated with Monitoring |
| **`RISK-019`** | Autonomous Model Secret Access & Exfiltration | 4 | 5 | **20 (CRITICAL)** | Server-side token isolation, OS native Keyring driver (`DMK-157`), secret redaction filters. | 2 | 5 | **10 (HIGH)** | Active Hardening |
| **`RISK-022`** | Arbitrary Command Execution via AI Output | 4 | 5 | **20 (CRITICAL)** | Structured command runner with mandatory user confirmation modal. | 1 | 5 | **5 (MEDIUM)** | Controlled |
| **`RISK-025`** | Audit Ledger Tampering | 3 | 5 | **15 (HIGH)** | Cryptographic SHA-256 hash chaining, append-only event store. | 1 | 5 | **5 (MEDIUM)** | Controlled |

---

## 2. Mandatory Risk Floor Rules

In accordance with Master Plan §15, the risk engine enforces non-negotiable floor constraints:
- **Autonomous Agent Execution:** Imposes a mandatory minimum inherent score of **$\ge 15$ (`HIGH`)**.
- **Production Secret Access:** Imposes a mandatory minimum inherent score of **$\ge 20$ (`CRITICAL`)**.
- **Safety-Critical / Financial Data:** Imposes a mandatory minimum inherent score of **$\ge 20$ (`CRITICAL`)**.
