# Implementation Plan: DMK-159 Security Regression Test Suite

**Work Item ID:** `DMK-159`  
**WBS Path:** `13.04.01`  
**Priority:** `P0` | **Risk:** `CRITICAL`  
**Target Milestone:** Milestone 4 (v0.1 Local-First MVP)  
**Parent Epic:** `EPIC-13` (Forms, Export, Secrets & Release Hardening)  
**Status:** `VERIFIED` (Evidence: `EV-159`)  
**Dependencies:** `DMK-157` (`VERIFIED`), `DMK-110` (`VERIFIED`)  
**Requirements:** `REQ-TEST-002`, `REQ-OPS-001`  
**Security Controls:** `SEC-CTRL-004`, `SEC-CTRL-011`, `SEC-CTRL-012`, `SEC-CTRL-013`  

---

## 1. Objectives & Scope

`DMK-159` implements the comprehensive automated security regression test suite and enforcement mechanisms defending the control plane against:
1. **Path Traversal Attacks (`SEC-CTRL-011` / OWASP ASVS V12.3):**
   - Assert workspace boundary containment for all file and repository operations.
   - Enforce deny-precedence rules (`secrets/**`, `.test_secret_store/**`, `private_keys/**`, `.env`, `.git/config`, `/etc/**`).
   - Defend against standard `../`, Windows `..\\`, URL-encoded `%2e%2e`, double URL-encoded, null-byte `\0`, and symlink breakouts.
2. **Command Injection & Shell Sandboxing (`SEC-CTRL-012` / OWASP ASVS V5.3):**
   - Eliminate raw shell string interpolation by utilizing structured argument arrays (`execFileSync`) with `shell: false`.
   - Validate and sanitize branch names, commit messages, and commit authors against injection metacharacters (`;`, `&&`, `||`, `|`, `$()`, backticks, newlines).
   - Prevent Git flag injections (e.g., `--upload-pack`, `--output`).
3. **Audit Ledger Immutability (`SEC-CTRL-013` / NIST SSDF PO.1.3):**
   - Enforce cryptographic SHA-256 hash chaining across consecutive audit events.
   - Detect and reject retroactive alterations, forged records, omitted sequence numbers, or payload tampering.
4. **Automated Regression Verification (`SEC-CTRL-004` / NIST SSDF RV.1.1):**
   - Execute full attack suites and REST endpoint security assertions with zero regressions.

---

## 2. Technical Architecture

- **Path Boundary Module:** `server/security/pathBoundary.ts`
  - `sanitizeAndResolvePath(rawPath, workspaceRoot)`
  - `assertWorkspacePath(rawPath, workspaceRoot)`
  - `matchesDenyPattern(relativePath)`
- **Command Sandboxing Module:** `server/security/commandSandbox.ts`
  - `sanitizeBranchName(name)`
  - `sanitizeCommitAuthor(author)`
  - `sanitizeCommitMessage(message)`
  - `executeSandboxedGit(args, options)`
- **Audit Immutability Module:** `server/security/auditImmutability.ts`
  - `computeAuditEventHash(event)`
  - `createChainedAuditEvent(params)`
  - `verifyAuditLedgerChain(events)`
- **Server Integration (`server.ts`):**
  - Integrate `pathBoundary` and `commandSandbox` in `/api/repo/stage`, `/api/repo/unstage`, `/api/repo/diff`, `/api/repo/branch`, `/api/repo/commit`.
  - Update `ProjectStore.addAuditEvent` to compute deterministic SHA-256 hash chaining.
  - Expose `GET /api/projects/:id/audit/verify` endpoint.
- **Verification Suite:** `server/security/testSecurityRegression.ts`
  - Path traversal attack vectors suite.
  - Command injection attack vectors suite.
  - Audit immutability and tamper detection suite.
  - Server REST endpoint attack rejection suite.

---

## 3. Definition of Done
- [x] Path boundary enforcement module implemented with deny-precedence rules.
- [x] Command sandboxing module implemented with structured array execution and input sanitization.
- [x] Cryptographic audit hash chaining and verification algorithm implemented.
- [x] Server repository endpoints and audit store wired with security defenses.
- [x] Comprehensive automated test suite passing all path traversal, command injection, and tamper detection tests.
- [x] Evidence record `EV-159` attached and canonical tracking ledgers updated to `VERIFIED`.
