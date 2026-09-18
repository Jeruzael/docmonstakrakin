# docmonstakrakin Security Architecture
## Defense-in-Depth, Security Zones & Control Topology

**Document ID:** DOC-SEC-001  
**Baseline:** v0.1 Local-First MVP  
**Reference:** NIST SP 800-218 (SSDF) / OWASP ASVS 4.0.3 / OWASP AISVS 1.0  

---

## 1. Security Philosophy: Defense-in-Depth

docmonstakrakin treats all external inputs—including AI model outputs and local repository files—as potentially untrusted. Security is enforced through layered controls:

```
Layer 1: Network & Ingress (Localhost binding, reverse proxy, token isolation)
   │
Layer 2: Policy Interceptor (Deterministic lifecycle gates & risk floor rules)
   │
Layer 3: Filesystem & Command Sandboxing (Path allow/deny masks with deny precedence)
   │
Layer 4: AI Output Validation (Syntax, JSON Schema, Semantic & Dual-Agent checks)
   │
Layer 5: Cryptographic Assurance (SHA-256 evidence hashing & audit hash chaining)
```

---

## 2. Trust Zones & Data Classifications

### Trust Zones
1. **`ZONE_DMZ`:** Client UI browser context (`CMP-01`). Untrusted presentation layer.
2. **`ZONE_INTERNAL_SECURE`:** Server application process (`CMP-02`, `CMP-03`, `CMP-05`). Executes validation policies, manages provider keys, and proxies inference.
3. **`ZONE_RESTRICTED_DATA`:** Project state storage (`CMP-04`). Zero outbound network connectivity.

### Data Classifications
- `PUBLIC`: Published standards specifications (NIST SSDF, OWASP ASVS).
- `INTERNAL`: Project objectives, WBS tasks, and documentation templates.
- `CONFIDENTIAL`: Project source code diffs, architecture diagrams, and requirements registers.
- `RESTRICTED`: Provider API keys, secret credentials, and audit hash seeds.
