# docmonstakrakin Security Controls Catalog
## Technical & Governance Security Controls

**Document ID:** DOC-SEC-004  
**Baseline:** v0.1 Local-First MVP  
**Standards Cross-Reference:** NIST SP 800-218 (SSDF) / OWASP ASVS v4.0.3 / OWASP AISVS v1.0  

---

## 1. Technical Security Controls

| Control ID | Control Name | Enforcement Component | Standard Reference | Mechanism & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **`SEC-CTRL-001`** | Port Binding Restriction | `server.ts` | NIST SSDF PO.3.1 | Bind server strictly to designated port (3000) on 0.0.0.0; reject unauthorized ports. |
| **`SEC-CTRL-002`** | Ingress Token Verification | `CMP-02` | OWASP ASVS V3.1 | Inspect and validate all inbound API requests; strip unexpected headers. |
| **`SEC-CTRL-004`** | Automated Regression Suite | CI / Test Harness | NIST SSDF RV.1.1 | Enforce automated regression test execution before release gate promotion. |
| **`SEC-CTRL-005`** | Deterministic Lifecycle Gate Evaluator | `CMP-02` | NIST SSDF PW.1.1 | Block phase progression if open blockers exist or risk exceeds phase tolerance. |
| **`SEC-CTRL-006`** | Mandatory Risk Floor Enforcer | `CMP-02` | OWASP AISVS G3.2 | Lock minimum inherent risk floor based on high-risk application capabilities. |
| **`SEC-CTRL-007`** | Auditable Override Engine | `CMP-02` | NIST SSDF PO.2.2 | Enforce expiration timestamps, recorded rationale, and audit events for gate bypasses. |
| **`SEC-CTRL-010`** | Data At-Rest Encryption & Masking | `CMP-04` | OWASP ASVS V8.2 | Field-level masking of PII and AES-256-GCM encryption for stored state archives. |
| **`SEC-CTRL-011`** | Path Boundary & Traversal Defense | `CMP-02` | OWASP ASVS V12.3 | Canonicalize file paths; evaluate allow/deny masks with deny precedence (`secrets/**`). |
| **`SEC-CTRL-012`** | Structured Command Confirmation | `CMP-02` | OWASP ASVS V5.3 | Ban raw string shell execution; require structured command confirmation from user. |
| **`SEC-CTRL-013`** | Cryptographic Audit Hash Chaining | `CMP-04` | NIST SSDF PO.1.3 | Every audit event links to the preceding event's SHA-256 hash. |
| **`SEC-CTRL-014`** | Server-Side AI Secret Isolation | `CMP-05` | OWASP AISVS M1.1 | Zero provider secrets exposed to browser client; proxy all inference server-side. |
| **`SEC-CTRL-015`** | Dual-Agent Zero-Leakage Verifier | `CMP-05` | OWASP AISVS G4.1 | Independent model cross-checks candidate outputs without scratchpad leakage. |
| **`SEC-CTRL-016`** | Standards Checksum & Tamper Proofing | `CMP-04` | OpenSSF SLSA v1.0 | Pinned SHA-256 checksums on all NIST and OWASP standards rule catalogs. |
| **`SEC-CTRL-017`** | OS Keyring Credential Abstraction | `CMP-02` | OWASP ASVS V2.10 | Driver interface for macOS Keychain, Windows Credential Manager, and Linux libsecret (`DMK-157`). |
| **`SEC-CTRL-018`** | Portable Package Integrity Sealing | `CMP-04` | OpenSSF SLSA v1.0 | Generate and verify SHA-256 package envelope signatures on `.docmonstakrakin` archives. |
| **`SEC-CTRL-019`** | Anomaly Revocation Interceptor | `CMP-02` | OWASP ASVS V3.7 | Invalidate active tokens and refresh-tokens immediately on anomalous session detection. |
| **`SEC-CTRL-020`** | Definition-of-Done Gate Ratification | `CMP-02` | NIST SSDF RV.3.2 | Formal multi-point audit checklist verification before production release tagging. |
