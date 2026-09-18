# ADR-0005: Synchronization Protocol and Conflict Resolution Model

**Status:** PROPOSED (Pending Human Architecture Review)  
**Date:** 2026-09-15  
**Deciders:** Lead Architect, Security Officer, Project Lead  
**Technical Component:** `CMP-06` (Distributed Sync & Peer Gateway)  

---

## Context & Problem Statement
docmonstakrakin v0.1 operates as an isolated, single-workstation local application. To support team environments in v0.2, project state must synchronize across multiple human developers and autonomous AI agents. The synchronization model must preserve:
1. Complete offline read/write capabilities without network connectivity.
2. Zero data loss when two collaborators make concurrent offline modifications.
3. Integrity of governance gates (e.g. human approvals cannot be overwritten by automated agent writes).
4. Simplicity and audibility over opaque mathematical convergence.

## Decision Options
- **Option 1: CRDTs (Yjs / Automerge)** — Full state CRDTs for all domain entities.
- **Option 2: Centralized Server-Authoritative Database** — Cloud database (e.g. Postgres / Firestore) with optimistic concurrency locks.
- **Option 3: Hybrid Local-First 3-Way Semantic Merge + Merkle DAG Ledger** — Local outbox mutation queue, field-level 3-way merge indexed by vector clocks, and Merkle DAG audit reconciliation.

## Preferred Candidate Recommendation (Proposed Decision)
We recommend **Option 3: Hybrid Local-First 3-Way Semantic Merge + Merkle DAG Ledger** as the preferred candidate for human architecture review and ratification.
- All writes execute immediately against the local store and append to a local outbox.
- When network connectivity is established, local deltas are transmitted as zero-knowledge encrypted payloads to the sync relay.
- Field-level changes are merged automatically if non-conflicting.
- Conflicting edits on sensitive fields (e.g. requirement status, gate approvals, risk scores) trigger an explicit **Conflict Resolution Work Item** requiring human intervention.
- Audit events are structured as a Merkle DAG, allowing multi-writer concurrent leaves without breaking chain integrity.

## Consequences
- **Positive:**
  - 100% offline autonomy preserved; no remote server dependencies for local development.
  - Zero-knowledge transport: sync relays cannot inspect project data.
  - Critical governance gates cannot be silently overwritten by automated convergence.
- **Negative:**
  - Requires implementing a deterministic 3-way merge engine for SSDLC JSON schemas.
  - Conflicts on critical requirements require human review in the UI.
