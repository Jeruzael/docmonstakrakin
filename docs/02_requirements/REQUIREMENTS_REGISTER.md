# docmonstakrakin Canonical Requirements Register
## Master Register of System & Assurance Requirements

**Document ID:** DOC-REQ-003  
**Baseline:** v0.1.0-rc1 (Technically Verified Release Candidate; Gate 7 Human Sign-off Pending)  
**Status Taxonomy:** `PROPOSED` | `UNDER_REVIEW` | `APPROVED` | `DEFERRED` | `REJECTED`  

---

## 1. Master Requirements Register

| ID | Title | Category | Priority | Risk | Origin / Source | Verification Test | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`REQ-DATA-001`** | Canonical Project State Aggregate | Data / Domain | P0 | HIGH | Master Plan §2.1 | `TEST-001` | **APPROVED** |
| **`REQ-DATA-002`** | Optimistic Concurrency & State Versioning | Data / Integrity | P0 | HIGH | Master Plan §2.1 | `TEST-002` | **APPROVED** |
| **`REQ-DATA-003`** | Field-level Data Masking for Sensitive PII | Privacy / Security | P0 | CRITICAL | Stakeholder Discovery | `TEST-101` | **APPROVED** |
| **`REQ-DATA-004`** | Standalone Portable Project Package Envelope | Data / Export | P0 | HIGH | Master Plan §45 | `TEST-156` | **APPROVED** |
| **`REQ-REQ-001`** | Conditional Questionnaire Dependency Graph | Requirements | P0 | HIGH | Master Plan §8 | `TEST-020` | **APPROVED** |
| **`REQ-GOV-001`** | Deterministic 15-Phase Lifecycle Gate Enforcement | Governance | P0 | CRITICAL | Master Plan §18 | `TEST-035` | **APPROVED** |
| **`REQ-GOV-002`** | Auditable Gate Overrides with Expiration | Governance | P0 | CRITICAL | Master Plan §17 | `TEST-041` | **APPROVED** |
| **`REQ-SEC-001`** | Mandatory Risk Floors for Dangerous Capabilities | Security / Risk | P0 | CRITICAL | Master Plan §15 | `TEST-038` | **APPROVED** |
| **`REQ-SEC-014`** | Single-Use Password Reset & Token Expiry ($T \le 900s$) | Security / Auth | P0 | CRITICAL | OWASP ASVS v4.0.3 | `TEST-099` | **APPROVED** |
| **`REQ-SEC-019`** | Concurrent Session Anomaly & Refresh-Token Revocation | Security / Auth | P0 | CRITICAL | NIST SSDF v1.1 | `TEST-081` | **APPROVED** |
| **`REQ-AI-001`** | Server-Side AI Inference Gateway & Token Isolation | AI / Architecture | P0 | CRITICAL | Master Plan §25 | `TEST-079` | **APPROVED** |
| **`REQ-AI-007`** | Independent Dual-Agent Cross-Review Orchestration | AI / Safety | P0 | CRITICAL | OWASP AISVS v1.0 | `TEST-081` | **APPROVED** |
| **`REQ-OPS-001`** | Workspace Path Boundary & Command Sandbox Policy | Operations / Sec | P0 | CRITICAL | Master Plan §52 | `TEST-110` | **APPROVED** |
| **`REQ-REL-001`** | v0.1 Definition-of-Done Release Gate Verification | Release / QA | P0 | CRITICAL | Master Plan §68 | `TEST-165` | **APPROVED** |

---

## 2. Milestone v0.2 Candidate Requirements (Planning Phase - Unapproved)

The following requirements have been discovered during v0.2 milestone planning. In accordance with governance policies, all new requirements remain in **`PROPOSED`** or **`UNDER_REVIEW`** status until explicitly ratified by human project authorities.

| ID | Title | Category | Priority | Risk | Origin / Rationale | Verification Strategy | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`REQ-SYNC-001`** | End-to-End Encrypted Project State Sync Protocol | Sync / Transport | P0 | CRITICAL | v0.2 Charter §4 (`CAP-v02-01`) | `TEST-201` (Encrypted payload roundtrip) | **PROPOSED** |
| **`REQ-SYNC-002`** | Offline Mutation Queue & Delta Synchronization | Sync / Offline | P0 | HIGH | v0.2 Charter §6 | `TEST-202` (Simulated network partition) | **PROPOSED** |
| **`REQ-COLLAB-001`** | Multi-Peer Ed25519 Cryptographic Identity Model | Identity / Auth | P0 | CRITICAL | v0.2 Charter §4 (`CAP-v02-02`) | `TEST-203` (Peer signature validation) | **PROPOSED** |
| **`REQ-COLLAB-002`** | Autonomous Agent Origin Attestation & Role Scoping | AI / Safety | P0 | CRITICAL | v0.2 Charter §13 | `TEST-204` (Agent privilege boundaries) | **PROPOSED** |
| **`REQ-DATA-005`** | Distributed Merkle DAG Audit Ledger Extension | Data / Audit | P0 | CRITICAL | v0.2 Charter §4 (`CAP-v02-03`) | `TEST-205` (Multi-writer DAG reconciliation) | **PROPOSED** |
| **`REQ-REL-002`** | Deterministic 3-Way Merge for SSDLC Entities | Data / Integrity | P0 | HIGH | v0.2 Charter §4 (`CAP-v02-04`) | `TEST-206` (Concurrent conflict resolution) | **UNDER_REVIEW** |
| **`REQ-SEC-021`** | Zero-Knowledge Sync Relay Isolation | Security / Privacy | P0 | CRITICAL | v0.2 Charter §7 | `TEST-207` (Ciphertext inspection test) | **PROPOSED** |
| **`REQ-SEC-022`** | Peer Eviction & Forward-Secrecy Key Rotation | Security / Crypto | P1 | HIGH | v0.2 Charter §14 (`RISK-022`) | `TEST-208` (Key ratchet simulation) | **PROPOSED** |
| **`REQ-INT-001`** | External Git Remote & Issue Tracker Projection Bridge | Integration | P1 | MEDIUM | v0.2 Charter §4 (`CAP-v02-05`) | `TEST-209` (Mock GitHub Issues bridge) | **PROPOSED** |
| **`REQ-PERF-002`** | Sub-500ms Local Read/Write Overhead During Active Sync | Performance | P1 | MEDIUM | v0.2 Charter §2 | `TEST-210` (Async sync benchmark) | **PROPOSED** |
| **`REQ-REC-001`** | Offline Conflict Non-Destructive Fork Recovery | Recovery | P0 | HIGH | v0.2 Charter §6 | `TEST-211` (Divergent branch salvage) | **PROPOSED** |

