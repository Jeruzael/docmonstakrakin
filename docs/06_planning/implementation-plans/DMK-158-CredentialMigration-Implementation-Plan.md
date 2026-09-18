# Implementation Plan: DMK-158 OS Credential Migration & Key Rotation Ceremony

**Work Item ID:** `DMK-158`  
**WBS Path:** `13.03.02`  
**Priority:** `P2` | **Risk:** `MEDIUM`  
**Target Milestone:** Milestone 4 (v0.1 Local-First MVP)  
**Parent Epic:** `EPIC-13` (Forms, Export, Secrets & Release Hardening)  
**Status:** `VERIFIED` (Evidence: `EV-158`)  
**Dependencies:** `DMK-157` (`VERIFIED`)  
**Requirements:** `REQ-SEC-014`  
**Security Controls:** `SEC-CTRL-017`  

---

## 1. Objectives & Scope

With `DMK-157` (`SecretStore Capability & OS Credential Abstraction`) fully verified, `DMK-158` provides the automated operational utilities for:
1. **Automated Credential Migration:**
   - Scanning `.env` files or runtime environment maps for sensitive keys (`GEMINI_API_KEY`, `*_SECRET`, `*_TOKEN`, `*_KEY`).
   - Securely importing values into the active `SecretStore` (OS Keychain or authenticated AES-256-GCM fallback).
   - Purging plaintext secret values from disk files, replacing them with safe references (`# MIGRATED_TO_SECRETSTORE`).
   - Supporting `--dry-run` inspection mode.
2. **Key Rotation Ceremony:**
   - Structured key rotation execution capturing `previousFingerprint`, `newFingerprint`, `rotatedBy`, and `timestamp`.
   - Dynamic update of the `defaultRedactor` registered secrets table.
   - Cryptographic audit ledger entry (`SECRET_ROTATED`) recording tamper-evident state hashes.
3. **Verification & Proof Generation:**
   - Verification utility validating zero plaintext credentials remain on disk.
   - Generation of cryptographic audit proofs (`EV-158`).

---

## 2. Technical Architecture

- **Core Module:** `server/secrets/credentialMigration.ts`
  - `migrateEnvironmentFile(envFilePath, secretStore, options)`
  - `executeKeyRotationCeremony(key, newValue, rotatedBy, reason, secretStore)`
  - `verifyZeroPlaintextResidual(filePath, migratedKeys)`
  - `computeFingerprint(value)`
  - `isSensitiveKey(keyName)`
- **REST Endpoints in `server.ts`:**
  - `POST /api/secrets/migrate`: Run environment migration ceremony.
  - `POST /api/secrets/rotate`: Execute structured key rotation ceremony.
  - `GET /api/secrets/rotations`: Retrieve historical rotation audit trail.
- **Verification Suite:** `server/secrets/testCredentialMigration.ts` & `server/secrets/testMigrationServerIntegration.ts`
  - Automated tests asserting dry-run safety, live migration, file sanitization, zero plaintext residual, rotation ceremony, and cryptographic proof verification (11/11 tests passing).

---

## 3. Definition of Done
- [x] Automated migration utility parses and transfers sensitive keys to SecretStore.
- [x] Plaintext secrets are purged from the target `.env` file with zero data leakage.
- [x] Key rotation ceremony records `SecretRotationEvent` and sanitized `AuditEvent`.
- [x] REST API endpoints exposed and verified with integration test.
- [x] Full test suite passing without regression (11/11 across 2 suites; 52/52 cumulative).
- [x] Evidence record `EV-158` attached and WBS updated to `VERIFIED`.
