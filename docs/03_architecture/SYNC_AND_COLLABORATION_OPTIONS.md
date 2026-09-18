# docmonstakrakin Synchronization & Collaboration Architecture Options
## Evaluation of Sync Protocols, Collaboration Models & Storage Topologies for v0.2

**Document ID:** DOC-ARCH-006  
**Milestone:** v0.2 Planning Gate  
**Status:** PROPOSED ARCHITECTURAL ANALYSIS  
**Component:** `CMP-06` (Distributed Sync & Peer Gateway)  

---

## 1. Architectural Topology & Layering

The v0.2 synchronization engine is designed as a non-intrusive abstraction layer wrapped around the existing sovereign v0.1 local state engine:

```
+-------------------------------------------------------------------------+
|                       docmonstakrakin Client Application                |
|  (Local-First UI, Kanban, Requirements Engine, Risk Matrix, Gate Engine)|
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                  Local Sovereign State Engine (v0.1)                     |
|  - In-Memory Redux / Context State Store                                |
|  - AES-256-GCM Encrypted Local File Fallback (.docmonstakrakin/state)   |
|  - SecretStore (OS Keychain / Local Vault)                              |
|  - Cryptographic Audit Ledger (Append-Only Head)                         |
+-------------------------------------------------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
+-----------------------------------+   +---------------------------------+
|  Offline Mutation Queue (Outbox)  |   | Inbound Validation Engine       |
|  - Local Vector Clock Generator   |   | - Ed25519 Peer Signature Check  |
|  - State Delta Encapsulation      |   | - Schema & Sanity Assertion     |
|  - Zero-Knowledge Cipher Envelope |   | - Merkle DAG Ingestion          |
+-----------------------------------+   +---------------------------------+
                    |                               ^
                    +---------------+---------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                    Sync Abstraction Adapter Interface                   |
+-------------------------------------------------------------------------+
           |                                             |
           v                                             v
+---------------------------------------+   +-----------------------------+
|    User-Managed / Self-Hosted Relay   |   |    Optional Hosted Relay    |
| - Lightweight Go/Rust/Node Container  |   | - Multi-tenant WebSocket    |
| - Zero-Knowledge Ciphertext Storage   |   | - Encrypted Blob Storage    |
| - Zero Secret Decryption Capability   |   | - Blind PubSub Delivery     |
+---------------------------------------+   +-----------------------------+
```

---

## 2. Comparative Evaluation of Synchronization Models

| Synchronization Model | Latency & UX | Complexity | Offline Autonomy | Conflict Handling | SSDLC Artifact Fit | Verdict for v0.2 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Event / Log Synchronization** | High throughput, low network payload | Moderate | High (Append local log, replay on connect) | Log reordering requires deterministic tie-breaking | Excellent for audit ledger and status events | **RECOMMENDED FOR AUDIT & EVENT LOGS** |
| **2. Full Snapshot Synchronization** | High bandwidth overhead on large repos | Lowest | Poor (Last-write-wins overwrites concurrent work) | Destructive unless manual branching used | Poor for fine-grained work items | **REJECTED (Too coarse, data loss risk)** |
| **3. CRDTs (Conflict-Free Replicated Data Types)** | Zero sync conflicts, eventual consistency | Very High (State bloat, metadata tombstone overhead) | High | Automatic mathematical convergence | Overkill for structured discrete SSDLC entities; breaks explicit human approval gates | **REJECTED AS PRIMARY (Over-engineered for structured SSDLC data)** |
| **4. Operational Transformation (OT)** | Millisecond character-level sync | Extreme | Very Poor (Requires central authoritative coordinator) | Centralized transform server required | Terrible for local-first; requires continuous server connection | **REJECTED (Violates local-first mandate)** |
| **5. Server-Authoritative Sync** | Simple consistency model | Low | Zero (Rejects writes made while disconnected) | Server rejects conflicting versions with HTTP 409 | Unacceptable for local-first offline development | **REJECTED (Fails offline requirement)** |
| **6. Hybrid Local-First 3-Way Semantic Merge** | Responsive local writes, async reconciliation | Moderate | Complete local autonomy with local outbox queue | Deterministic 3-way merge on field level; manual fork review for semantic conflicts | **Ideal fit for requirements, risks, work items, and ADRs** | **PREFERRED CANDIDATE (RECOMMENDED PRIMARY MODEL)** |

---

## 3. Preferred Candidate: Recommended Hybrid Architecture for v0.2

> **Governance Notice:** The architecture options described below represent **Preferred Candidate recommendations** under active architectural planning (`ADR-0005` and `ADR-0006`). They remain in **`PROPOSED`** status and have NOT received human stakeholder ratification. They must not be treated as approved or finalized specifications until formally ratified.

1. **Dual Synchronization Strategy (Preferred Candidate):**
   - **Structured Artifacts (Requirements, WorkItems, Risks, ADRs):** State-based delta synchronization utilizing **Deterministic 3-Way Semantic Merging** indexed by Vector Clocks. If non-overlapping fields differ, merge automatically; if identical fields are modified concurrently, fork into an explicit conflict resolution work package (`DMK-CR`).
   - **Audit Trails:** **Merkle Directed Acyclic Graph (DAG)**. Multiple concurrent writers append signed audit leaves with parent hashes; sync reconciles DAG branches without requiring linear re-basing.
2. **Transport & Relay Design:**
   - **Zero-Knowledge Blind Relay:** Sync relays (whether self-hosted or cloud-hosted) operate strictly as blind encrypted message stores. Payloads are encrypted with X25519-ChaCha20-Poly1305 before transmission.
   - **No Plaintext in Transit or At Rest:** The relay cannot read project titles, requirements, work items, or code paths.
3. **Identity & Authority:**
   - Each collaborator possesses an Ed25519 cryptographic key pair.
   - All proposed changes are signed by the originating author (`originAuthorId` + `signature`).
   - Autonomous AI sub-agents operate under a scoped sub-key signed by the human project owner.
