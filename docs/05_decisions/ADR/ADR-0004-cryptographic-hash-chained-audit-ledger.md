# ADR-0004: Cryptographic Hash-Chained Audit Ledger

**Status:** ACCEPTED  
**Date:** 2026-09-15  
**Deciders:** Security Officer, Project Lead  
**Technical Component:** `CMP-04` (Isolated Project State Repository)  

---

## Context & Problem Statement
In an agentic development environment where autonomous tools modify files and transition task statuses, standard logging is insufficient. A compromised agent or malicious script could edit or truncate audit logs to conceal unauthorized code changes, unvetted gate bypasses, or secret access.

## Decision
We decide to implement an **append-only, cryptographically hash-chained audit ledger**.
Every audit event is serialized with a canonical timestamp, actor ID, action type, target entity ID, and the SHA-256 hash of the immediately preceding event:
$$\text{Hash}_n = \text{SHA-256}(\text{Event}_n \,\|\, \text{Hash}_{n-1})$$
Any retroactive alteration, deletion, or insertion breaks the chain and triggers an immediate tampering alert.

## Consequences
- **Positive:**
  - Non-repudiation for all gate transitions, overrides, and security reviews.
  - Complete tamper evidence without requiring an external distributed blockchain.
  - Provable audit history can be exported and cryptographically verified offline.
- **Negative:**
  - Requires deterministic serialization of event objects prior to hashing.
