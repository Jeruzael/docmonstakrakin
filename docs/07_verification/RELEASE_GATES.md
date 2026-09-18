# docmonstakrakin Release Gates
## Formal Entry & Exit Criteria for Release Milestones

**Document ID:** DOC-VER-003  
**Baseline:** v0.1 Local-First MVP  

---

## 1. Release Gate Criteria for v0.1 Local-First MVP

To achieve official v0.1 release status, the following non-negotiable gates must be satisfied:

1. **Gate 1: Zero Unresolved Blocker Questions**
   - All questions marked `BLOCKING` in active profiles must be answered or formally deferred with risk acceptance.
2. **Gate 2: 100% Core Requirements Verification**
   - Every P0 requirement in `REQUIREMENTS_REGISTER.md` must link to an authenticated `Evidence` record with result `PASSED`.
3. **Gate 3: Secret Store Integration Complete (`DMK-157`)**
   - Zero plaintext API keys or credentials remaining in repository files, `.env`, or server logs.
4. **Gate 4: Security Regression Passing (`DMK-159`)**
   - 100% pass rate on path traversal, symlink escape, and command injection test suites.
5. **Gate 5: Golden Reference Project Execution**
   - Successfully create, configure, plan, and verify a complete reference project (e.g. Web + AI Assistant) using docmonstakrakin.
6. **Gate 6: Cryptographic Audit Ledger Integrity**
   - All audit ledger records must verify cleanly against their SHA-256 hash chains with zero detected breaks.
7. **Gate 7: Security Lead DoD Sign-off (`DMK-165`)**
   - Explicit human sign-off recorded in the audit ledger by the Project Lead.
