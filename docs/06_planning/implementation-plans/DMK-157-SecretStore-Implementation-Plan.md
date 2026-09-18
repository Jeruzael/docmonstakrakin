# Implementation Plan: DMK-157 SecretStore Capability & OS Credential Abstraction

**Work Item ID:** `DMK-157`  
**WBS Path:** `13.03.01`  
**Priority:** `P0` | **Risk:** `CRITICAL`  
**Target Milestone:** Milestone 4 (v0.1 Local-First MVP)  
**Parent Epic:** `EPIC-13` (Forms, Export, Secrets & Release Hardening)  

---

## 1. Problem Statement & Objectives

Currently, API keys (such as `GEMINI_API_KEY`) rely on standard `.env` configuration files or server process environment variables. In an environment with autonomous coding agents, plaintext `.env` files risk being accidentally inspected, logged, committed to version control, or leaked via error stacks.

`DMK-157` establishes a secure credential abstraction (`SecretStore`) that:
1. Provides a unified programmatic interface: `getSecret(key)`, `setSecret(key, value)`, `deleteSecret(key)`, `listSecretMetadata()`.
2. Connects to OS native keystores (macOS Keychain, Windows Credential Manager, Linux SecretService) when available.
3. Provides an encrypted local file fallback utilizing AES-256-GCM authenticated encryption when running in headless containers or environments without a desktop keyring.
4. Adds automatic redaction filters to all server-side logging and audit records.

---

## 2. Work Breakdown & Subtasks

### Subtask 1: `DMK-157.1` — Domain Contracts & Types (`VERIFIED` - Evidence: `EV-157-1`)
- Define `SecretStore` interface in `src/types.ts`.
- Define `SecretMetadata` (`key`, `description`, `lastRotated`, `provider`, `isConfigured`, `fingerprint`).
- Define `SecretRotationEvent` and `SecretRedactionRule`.
- Verification: `npm run lint` (`tsc --noEmit`) compiles cleanly with 0 errors.

### Subtask 2: `DMK-157.2` — AES-256-GCM Encrypted Fallback Driver (`VERIFIED` - Evidence: `EV-157-2`)
- Implement `EncryptedFileSecretStore` in `server/secrets/encryptedFileStore.ts`.
- Derive encryption key using PBKDF2 (100,000 iterations) with local salt.
- Encrypt payloads with AES-256-GCM including 16-byte auth tag.
- Implement atomic file replacement (.tmp -> rename) for crash resilience.
- Verification: 9-stage automated test suite verifying encrypt/decrypt roundtrip, tamper rejection via GCM auth tag, and zero disk leakage.

### Subtask 3: `DMK-157.3` — OS Keyring Adapter Interface (`VERIFIED` - Evidence: `EV-157-3`)
- Implement `OSKeychainSecretStore` in `server/secrets/osKeychainStore.ts`.
- Define adapter bindings for desktop operating systems (macOS Keychain, Windows Credential Manager, Linux SecretService).
- Include graceful, seamless fallback detection when headless, containerized, or non-interactive.
- Verification: 9-stage automated test suite verifying platform detection, container detection, active provider resolution, and encrypted fallback delegation.

### Subtask 4: `DMK-157.4` — Driver Factory & Server Integration (`VERIFIED` - Evidence: `EV-157-4`)
- Create `createSecretStore()` factory in `server/secrets/secretStoreFactory.ts`.
- Integrate SecretStore bootstrap lifecycle into `server.ts`.
- Wire Gemini client lazy initialization to resolve credentials from `SecretStore` (`resolveSecret`).
- Provide `/api/secrets/metadata` endpoint for secure credential readiness inspection without value disclosure.
- Provide `/api/secrets` and `/api/secrets/:key` for secure credential rotation and deletion.
- Verification: 12 automated tests passed across factory and server integration suites.

### Subtask 5: `DMK-157.5` — Logging & Audit Redaction Filters (`VERIFIED` - Evidence: `EV-157-5`)
- Implement middleware interceptor that scans log messages and audit event payloads (`server/secrets/redactionFilter.ts`).
- Automatically replace known secret tokens and credential regex patterns with `[REDACTED_SECRET]`.
- Implement dynamic secret registration for store-managed credentials and console interceptor protection.
- Verification: 11 automated unit and integration tests passed across regex, object traversal, audit logs, and console streams.

---

## 3. Definition of Done for DMK-157
- [x] TypeScript interfaces defined without lint errors (`DMK-157.1`).
- [x] Fallback encrypted store successfully encrypts and decrypts test secrets with AES-256-GCM (`DMK-157.2`).
- [x] OS native keyring adapter defined with fallback detection (`DMK-157.3`).
- [x] Server initializes without crashing if zero secrets are configured (`DMK-157.4`).
- [x] Secrets never appear in console logs or audit JSON payloads (`DMK-157.5`).
- [x] Evidence record `EV-157` created and attached to `DMK-157` (41/41 cumulative tests passing).
