# docmonstakrakin Test Strategy
## Verification Philosophy, Test Levels & Quality Invariants

**Document ID:** DOC-VER-001  
**Baseline:** v0.1 Local-First MVP  
**Reference:** Master Plan §61 & §62  

---

## 1. Verification Philosophy

In docmonstakrakin, **unverified work is incomplete work**.
Neither human developers nor AI agents may declare a task complete solely on personal assertion.
A work item may only transition to `VERIFIED` when accompanied by a recorded, cryptographically hashed `Evidence` record linking to passing tests, static analysis reports, security scans, or formal human sign-off.

---

## 2. Testing Levels

1. **Static Typing & Linter Level:**
   - Strict TypeScript checking (`tsc --noEmit`) to verify interface compliance and eliminate type coercion defects.
2. **Unit & Domain Rule Level:**
   - Isolated verification of core algorithms: questionnaire condition evaluation, readiness score calculation, risk scoring, and path allow/deny boundary checking.
3. **Integration Level:**
   - Server REST API endpoint tests; validation of state persistence and optimistic concurrency conflict handling.
4. **Security Regression Suite (`DMK-159`):**
   - Negative testing for path traversal attempts (`../../`), symlink escapes, unauthorized command execution, and prompt injection attacks.
5. **Dual-Agent Verification (`DMK-081`):**
   - Independent model cross-evaluation of candidate code diffs and architectural modifications before human review.

---

## 3. Current Test Gap Analysis

- **Current Repository Status:** The repository possesses seeded evidence records (`EV-101` through `EV-106`) representing simulated verification runs, but does not yet have an automated test runner (such as Vitest) installed in `package.json`.
- **Remediation Task:** `DMK-005` (Establish automated test harness) is categorized as `READY` in `MASTER_WBS.yaml` to configure Vitest and automated CI execution.
