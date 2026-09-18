# Implementation Plan: DMK-156 Portable .docmonstakrakin Project Package

**Work Item ID:** `DMK-156`  
**Title:** Implement portable `.docmonstakrakin` project package  
**Priority:** `P0` | **Risk:** `HIGH`  
**Target Milestone:** Milestone 4 (v0.1 Local-First MVP)  
**Parent Epic:** `EPIC-13` (Forms, Export, Secrets & Release Hardening)  
**Status:** `VERIFIED`  
**Dependencies:** `DMK-010` (`VERIFIED`), `DMK-114` (`VERIFIED`)  
**Requirements:** `REQ-DATA-004` (Standalone Portable Project Package Envelope)  
**Security Controls:** `SEC-CTRL-018` (Portable Package Integrity Sealing), `SEC-CTRL-013` (Cryptographic Audit Hash Chaining)  
**Verification Method:** Roundtrip serialization test (`TEST-156`) producing identical SHA-256 state hash across unit & server integration suites.  
**Verification Evidence:** `EV-156` (16/16 tests passing, export/import roundtrip state hash identity verified)

---

## 1. Context & Objectives
As defined in Master Plan §45 and Requirements Register `REQ-DATA-004`, docmonstakrakin must provide a portable, standalone, single-file archive format (`.docmonstakrakin`) containing the entire project state, standards locks, knowledge aggregates, and cryptographic audit chains.

### Key Objectives
1. **Canonical Sealed Envelope:** Structure `.docmonstakrakin` single-file package with magic header `DOCMONSTAKRAKIN_PACKAGE`, schemaVersion `0.1.0`, timestamp, manifest, full knowledge aggregate, standards locks, and cryptographic security seal.
2. **Deterministic SHA-256 State Hash:** Compute deterministic canonical state hash via sorted key traversal ensuring that any export/import roundtrip yields an identical state hash (`AC-1`).
3. **Cryptographic Integrity & Tamper Detection (`SEC-CTRL-018`):** Verify package envelope hash, canonical state hash, and bidirectional audit ledger hash chains on every import, rejecting tampered or corrupted files.
4. **Server Export, Verify, and Import Endpoints:** Expose `GET /api/projects/:id/package/export`, `POST /api/projects/package/verify`, and `POST /api/projects/package/import`.
5. **UI Integration:** Provide single-click export with file download and file upload/import modal with realtime cryptographic verification inspection.
6. **Automated Verification:** Comprehensive test suite asserting 100% roundtrip fidelity, tamper resistance, and API integration (`EV-156`).

---

## 2. Technical Architecture & Component Breakdown

### 2.1 Package Module (`server/package/portablePackage.ts`)
- `DocmonstakrakinPackage`: Type-safe package envelope with manifest, knowledge aggregate, audit ledger, and cryptographic seal.
- `computeCanonicalStateHash`: Deterministic recursive sorting serializer with SHA-256 digest.
- `createPortablePackage`: Encapsulates canonical project state, computes state and envelope digests, verifies audit chain, and returns sealed package.
- `verifyPortablePackage`: Verifies magic, schema version, state hash, envelope hash, and cryptographic audit chain.
- `serializePortablePackage` & `parsePortablePackage`: Serialization and deserialization utilities.

### 2.2 Server Endpoints (`server.ts`)
- `GET /api/projects/:id/package/export`: Generates sealed package and triggers file download.
- `POST /api/projects/package/verify`: Accepts `.docmonstakrakin` JSON payload and returns cryptographic verification report.
- `POST /api/projects/package/import`: Verifies payload, updates in-memory canonical `store`, writes `PACKAGE_IMPORTED` audit event, and returns imported project.

### 2.3 User Interface Integration
- `DocumentsView.tsx`: Export card/button with SHA-256 seal details and direct file download.
- `TopBar.tsx` / `PackageImportModal.tsx`: Import package action allowing drag-and-drop or selection of `.docmonstakrakin` files, displaying instant verification details and completing ingestion.

---

## 3. Definition of Done
- [x] Portable package data models, deterministic state hashing, and cryptographic sealing implemented in `server/package/portablePackage.ts`.
- [x] Package verification with tamper detection (state hash, envelope hash, and audit chain verification) implemented.
- [x] Server endpoints (`/api/projects/:id/package/export`, `/api/projects/package/verify`, `/api/projects/package/import`) wired in `server.ts`.
- [x] Unit test suite (`server/package/testPortablePackage.ts`) asserting export/import roundtrip identical state hash and tamper rejection (9/9 passed).
- [x] Server integration test suite (`server/package/testPackageServerIntegration.ts`) asserting HTTP endpoints (7/7 passed).
- [x] UI export and import workflows implemented and tested (`PackageTransferModal.tsx`).
- [x] Evidence record `EV-156` created and all governance ledgers updated.
