# docmonstakrakin Data Architecture
## Canonical Knowledge Graph, Entity Schemas & Storage Strategy

**Document ID:** DOC-ARC-002  
**Baseline:** v0.1 Local-First MVP  

---

## 1. The Canonical Knowledge Graph

All system state is organized into an interconnected directed graph:

```
Project
  ├── Profiles (Primary & Specialized)
  ├── Questions ──► Answers ──► Requirements
  │                                │
  │                                ├──► Risks (Inherent & Residual)
  │                                ├──► Threats (STRIDE)
  │                                ├──► Controls (NIST/OWASP)
  │                                ├──► Architecture Components & ADRs
  │                                └──► WorkItems (Epics & Tasks)
  │                                        │
  │                                        ├──► Tests
  │                                        └──► Evidence (Hashed)
  ├── Overrides (Audited)
  └── Audit Ledger (Chained)
```

---

## 2. Core Domain Entity Schemas

### 2.1 Project Aggregate
Stores project identity, profiles, delivery method, target release, lifecycle phase, and multi-dimensional readiness scores:
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  profiles: ProjectProfile[];
  deliveryMethod: DeliveryMethod;
  deploymentIntent: string;
  dataSensitivity: DataSensitivity;
  lifecyclePhase: LifecyclePhase;
  stateVersion: number;
  owner: string;
  targetRelease: string;
  createdAt: string;
  updatedAt: string;
  repoPath: string;
  repoStatus: 'CLEAN' | 'DIRTY' | 'DISCONNECTED';
  healthScore: number;
  progress: ProjectProgress;
}
```

### 2.2 WorkItem
Single unified entity powering Kanban, WBS, Product Backlog, and Sprints:
```typescript
interface WorkItem {
  id: string; // e.g. DMK-157
  parentEpicId?: string;
  type: 'FEATURE' | 'SECURITY' | 'ARCHITECTURE' | 'BUG' | 'DOCS';
  title: string;
  description: string;
  status: 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'VERIFICATION' | 'VERIFIED';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sprint?: number;
  requirements: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  checklist: { text: string; done: boolean }[];
  tests: string[];
  evidence: string[]; // Evidence IDs
  owner: string;
  updatedAt: string;
}
```

### 2.3 Evidence Record
Immutable proof of completion:
```typescript
interface Evidence {
  id: string; // EV-xxx
  type: 'TEST_RUN' | 'COMMIT' | 'DIFF' | 'SCAN_REPORT' | 'SECURITY_REVIEW';
  title: string;
  workItemId: string;
  result: 'PASSED' | 'FAILED' | 'FLAGGED';
  command?: string;
  commitHash?: string;
  producer: string;
  createdAt: string;
  sha256Hash: string;
  details: string;
}
```

---

## 3. Storage Evolution Strategy

- **v0.1 Local-First MVP:** In-memory state synchronized with SQLite local storage (`docmonstakrakin.db`) and exported as standalone `.docmonstakrakin` JSON bundles.
- **Post-MVP Hosted Mode:** PostgreSQL relational database with tenant isolation and cryptographic row-level audit validation. All domain entities use globally unique IDs (`UUIDv4` or prefixed canonical IDs) to ensure zero ID collision during future cloud migrations.
