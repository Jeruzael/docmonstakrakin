# ADR-0006: Multi-Agent Peer Identity and Trust Boundary Model

**Status:** PROPOSED (Pending Human Architecture Review)  
**Date:** 2026-09-15  
**Deciders:** Security Officer, Lead Architect  
**Technical Component:** `CMP-07` (Peer Trust & Identity Subsystem)  

---

## Context & Problem Statement
In v0.1, the application assumed a single local human operator commanding local AI invocations. In v0.2, multiple human team members and distributed autonomous agents will collaborate on the same project. We must establish:
1. How peer workstations authenticate without centralized corporate directory lock-in.
2. How autonomous AI agents are distinguished from human project owners.
3. How to prevent an untrusted or compromised agent from impersonating a human security officer or forging release sign-offs.

## Decision Options
- **Option 1: Centralized OAuth / OpenID Connect Identity Provider** — Mandates an external SaaS auth service (e.g. Google, GitHub, Auth0).
- **Option 2: Decentralized Identifiers (DIDs) & Verifiable Credentials** — W3C DID infrastructure.
- **Option 3: Cryptographic Ed25519 Peer Keyring with Scoped Agent Delegation** — Local keypair per human; human owner signs scoped sub-keys for autonomous agents.

## Preferred Candidate Recommendation (Proposed Decision)
We recommend **Option 3: Cryptographic Ed25519 Peer Keyring with Scoped Agent Delegation** as the preferred candidate for human architecture review and ratification.
- Every human collaborator generates an Ed25519 keypair during project initialization.
- Project membership is governed by a project member keyring file (`.docmonstakrakin/team.json`) containing public keys and assigned roles (e.g. `OWNER`, `SECURITY_LEAD`, `ARCHITECT`, `DEVELOPER`).
- Autonomous AI agents receive **Delegated Agent Keys** signed by a human member key. The delegation payload specifies:
  1. Permitted scopes (e.g. `WORKITEM_UPDATE`, `DRAFT_REQUIREMENT`).
  2. Forbidden scopes (e.g. `GATE_OVERRIDE`, `PHASE_EXIT_SIGNOFF`, `SECRET_ACCESS`).
  3. Strict expiration timestamp ($TTL \le 7\text{ days}$).
- SEC-CTRL-020 invariant is enforced cryptographically: Gate sign-off events (`RELEASE_GATE_APPROVED`) must carry a signature from a key with `OWNER` or `SECURITY_LEAD` human role. Signatures from agent delegation keys are rejected by the validator.

## Consequences
- **Positive:**
  - Fully local-first and decentralized: works in air-gapped environments without external SaaS dependencies.
  - Cryptographic non-repudiation for all human approvals and agent actions.
  - Provably prevents AI agents from self-authorizing release gates or phase transitions.
- **Negative:**
  - Key distribution and revocation require exchange of signed membership records.
  - Lost private keys require out-of-band recovery ceremonies.
