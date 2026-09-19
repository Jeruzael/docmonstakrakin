# Trusted Self-Bootstrap Contract & Schema Specification

**Document Identifier:** `DOC-CTRL-BOOTSTRAP-001`  
**Status:** APPROVED DESIGN CONTRACT (Step 2 — Contract & Design Only)  
**Schema Identifier:** `SELF_BOOTSTRAP_V1`  
**Bootstrap Mode:** `TRUSTED_LOCAL_BOOTSTRAP`  
**Repository:** `Jeruzael/docmonstakrakin`  
**Baseline Commit:** `0a54283cdd4f0d26bc138d01c037ad1dee5bc018`  
**Target Project ID:** `PRJ-DOCMONSTAKRAKIN`  
**Runtime Implementation Status:** CONTRACT ONLY — NO RUNTIME INJECTION EXECUTED  

---

## 1. Executive Summary & Purpose

The purpose of the Trusted Self-Bootstrap contract is to establish a deterministic, verifiable, and strictly controlled mechanism for initializing docmonstakrakin's own development history, architecture, requirements, risks, verification evidence, and documentation into its canonical project store (`.local/project-state.json`).

docmonstakrakin is an A-SSDLC (Agentic Secure Software Development Life Cycle) control plane. In order to govern its own continuing development—including the governance remediation sequence, future verification batches, and release management—the application must hold its own canonical structured state as an existing project (`EXISTING_PROJECT`), dogfooding its own data structures and governance engines without compromising audit, security, or release gates.

**THIS SPECIFICATION IS CONTRACT AND DESIGN ONLY.**
Under this Step 2 contract:
- No bootstrap execution takes place;
- No project record is written to `.local/project-state.json`;
- No canonical mutations occur;
- No project selection UI is modified;
- Batch 2 implementation is not started;
- Release Gate 7 is not executed and remains `HUMAN_APPROVAL_REQUIRED`.

---

## 2. Trust Boundary & Separation from Portable Package Importer

docmonstakrakin defines two distinct ingestion boundaries with fundamentally different threat models:

```
+-----------------------------------------------------------------------------------+
|                              DOCMONSTAKRAKIN STORE                                |
|                                                                                   |
|  +-------------------------------------+   +------------------------------------+ |
|  |     TRUSTED LOCAL SELF-BOOTSTRAP    |   |     PORTABLE PACKAGE IMPORTER      | |
|  |       (SELF_BOOTSTRAP_V1)           |   |       (SEC-CTRL-018 / REQ-DATA-004)| |
|  +-------------------------------------+   +------------------------------------+ |
|  | Boundary: Trusted Local Repository  |   | Boundary: Untrusted External File  | |
|  | Trigger: CLI (bootstrap:self)       |   | Trigger: REST (POST /api/.../import| |
|  | Ingests: Curated local repository   |   | Ingests: External .docmonstakrakin | |
|  | Authority: Curated canonical seed   |   | Authority: Untrusted external data | |
|  | Governance: approvals = []          |   | Governance: All approvals stripped | |
|  | Verification: TECHNICALLY_VERIFIED  |   | Verification: Marked UNTRUSTED     | |
|  | Status: CREATE_ONLY (PRJ-DOC...)    |   | Status: New random ID generated    | |
|  +-------------------------------------+   +------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

### Critical Separation Rules:
1. **Never Repurpose the Portable Package Importer (`POST /api/projects/package/import`)**:
   The portable package importer is explicitly engineered for untrusted cross-machine package imports. Under `SEC-CTRL-018`, imported packages must have all approval signatures, credentials, and governance state stripped or marked `UNTRUSTED`. Repurposing this endpoint for local self-bootstrap would violate security boundaries or require loosening untrusted package defenses.
2. **Explicit Trusted-Local Boundary**:
   The Self-Bootstrap mechanism operates via a dedicated local command/service executing in `TRUSTED_LOCAL_BOOTSTRAP` mode. It ingests verified documentation and technical evidence produced during local development.
3. **No Network Egress or Remote Fetching**:
   The self-bootstrap process reads exclusively from local file paths within the current repository workspace.

---

## 3. Allowed Canonical Collections

The bootstrap manifest supports validated arrays for the core canonical entities defined in `src/types.ts`. Only collections with mature, stable domain schemas and clear semantics are permitted:

| Collection | Schema Interface | Description & Canonical Role |
| :--- | :--- | :--- |
| `project` | `Project` | Root project metadata, baselines, and lifecycle phase. |
| `features` | `Feature[]` | High-level capabilities and feature definitions. |
| `requirements` | `Requirement[]` | Functional, security, operational, and architectural requirements. |
| `risks` | `Risk[]` | Inherent and residual risk assessments, drivers, and mitigations. |
| `threats` | `Threat[]` | STRIDE / attack-surface threat model entities with mitigations. |
| `adrs` | `ADR[]` | Architectural Decision Records with context, decision, and consequences. |
| `components` | `ArchitectureComponent[]` | System architecture components, trust zones, and data classifications. |
| `workItems` | `WorkItem[]` | WBS work items, tasks, epics, and engineering milestones. |
| `evidence` | `Evidence[]` | Test runs, verification logs, and integrity hashes. |
| `documents` | `ControlledDocumentReference[]` | References to repository Markdown documentation files. |

Any collection whose semantics are not canonically defined in the existing store (such as speculative multi-tenant partitions or unverified external sync mappings) is strictly disallowed.

---

## 4. Controlled Document References

Repository Markdown documents represent vital human-readable rationale, procedural guidelines, and compliance records. However, **Markdown documents must never silently supersede canonical structured state.**

All repository documents referenced by the bootstrap manifest must be explicitly registered via typed `ControlledDocumentReference` records:

```typescript
export type ControlledDocumentKind =
  | 'CONTROL'
  | 'PRODUCT'
  | 'REQUIREMENTS'
  | 'ARCHITECTURE'
  | 'SECURITY'
  | 'VERIFICATION'
  | 'OPERATIONS';

export type ControlledDocumentAuthority =
  | 'REFERENCE'             // Repository Markdown is supporting reference documentation
  | 'GENERATED_PROJECTION'; // Markdown is a generated projection of canonical state (e.g. MASTER_WBS.md)

export interface ControlledDocumentReference {
  id: string;               // Unique document reference identifier (e.g. DOC-CTRL-001)
  path: string;             // Repository-relative path (e.g. docs/00_control/PROJECT_STATE.md)
  kind: ControlledDocumentKind;
  authority: ControlledDocumentAuthority;
  title?: string;
  description?: string;
  sha256Digest?: string;    // SHA-256 digest of document file at baseline
}
```

### Hierarchy of Authority:
- **Canonical Structured State**: The structured JSON data in the bootstrap manifest is the authoritative system of record for requirements, work items, risks, and architecture.
- **Reference Documents (`authority: REFERENCE`)**: Supporting context, design rationale, and procedural guides. If a discrepancy exists between reference Markdown prose and canonical structured fields, the validated structured state governs.
- **Projections (`authority: GENERATED_PROJECTION`)**: Markdown documents generated deterministically from canonical source (such as `MASTER_WBS.md` rendered from `MASTER_WBS.yaml` by `scripts/renderWbs.ts`).

---

## 5. Governance Restrictions & Invariants

Self-bootstrap initializes project knowledge, **not governance approvals.** The bootstrap contract enforces strict invariants to prevent unauthorized privilege escalation or governance bypass:

1. **Zero Approval Injection (`approvals = []`)**:
   The bootstrap manifest must not contain an `approvals` array, or it must be strictly empty. No pre-approved sign-offs for requirements, gates, or releases may be imported.
2. **Gate 7 Human Approval Invariant (`SEC-CTRL-020`)**:
   Release Gate 7 must remain `HUMAN_APPROVAL_REQUIRED` / `NOT EXECUTED`. The bootstrap manifest cannot set Gate 7 to `APPROVED` or `PASSED`.
3. **Release Signoff Forbidden**:
   Properties such as `releaseSignoff`, `releaseSignOff`, `gate7Approval`, or `authorizedBy` are strictly prohibited in the manifest root and child entities.
4. **No Credential or Key Injection**:
   The manifest must not inject reviewer passwords, password verifiers, machine tokens, API keys, or SecretStore master keys.
5. **Fail Closed**:
   Any manifest containing governance bypass fields or unauthorized approval claims fails validation immediately with zero mutations.

---

## 6. Historical Work State Semantics

The self-bootstrap manifest will represent existing completed milestones (such as Batch 1 and Batch 1.5):

### Rule of Technical Verification vs. Release Authorization:
```
+-----------------------------------------------------------------------------------+
|                              WORK ITEM STATUS HIERARCHY                           |
|                                                                                   |
|  [ PROPOSED ] ---> [ IN_PROGRESS ] ---> [ VERIFIED ]       [ APPROVED / RELEASED ]|
|                                                |                       |          |
|                                                v                       X          |
|                                      Technically Verified     Requires Human Gate |
|                                      (Permitted with Evidence)(STRICTLY FORBIDDEN)|
+-----------------------------------------------------------------------------------+
```

- **Permitted**: Setting work items (e.g., DMK-157, DMK-190) to `VERIFIED`, provided that:
  1. The work item explicitly references valid supporting evidence IDs in its `evidence` array or `acceptanceCriteria`;
  2. The referenced evidence records exist within the manifest's `evidence` collection and cite verifiable test runs or commit digests (e.g. `rc-regression/results.json`).
- **Forbidden**: Setting any work item to `APPROVED` or `RELEASED`. In docmonstakrakin, `APPROVED` and `RELEASED` represent human release authorization ceremonies, which can never be back-filled via an automated bootstrap manifest.

---

## 7. Audit Rules & Prohibition of Fabricated Historical Audit Events

Historical audit logs must reflect honest execution events occurring within the runtime environment.

### Prohibitions:
- The bootstrap manifest **MUST NOT** fabricate retroactive historical audit events (e.g., inventing simulated events for actions performed in prior days or on other developer machines).
- Historical Git commits, PR merges, and documentation updates are preserved as `evidence` records and `documents` references, not synthesized into the runtime audit ledger.

### The Single Bootstrap Audit Event:
Upon successful atomic commit of a self-bootstrap manifest, exactly **one** new canonical audit event is recorded:

```typescript
{
  id: "AUD-BOOTSTRAP-<TIMESTAMP>",
  actor: "CLI:trusted-self-bootstrap",
  timestamp: "<ISO-8601-TIMESTAMP>",
  action: "PROJECT_BOOTSTRAPPED",
  target: "PRJ-DOCMONSTAKRAKIN",
  reason: "Initial trusted self-bootstrap of docmonstakrakin canonical project knowledge",
  stateHash: "<CANONICAL-STATE-HASH-AFTER-BOOTSTRAP>",
  previousHash: "<PREVIOUS-AUDIT-ROOT-HASH>",
  details: {
    projectId: "PRJ-DOCMONSTAKRAKIN",
    schemaVersion: "SELF_BOOTSTRAP_V1",
    mode: "TRUSTED_LOCAL_BOOTSTRAP",
    manifestSha256: "<SHA-256-DIGEST-OF-CANONICAL-MANIFEST>",
    sourceRepository: "Jeruzael/docmonstakrakin",
    baselineCommit: "0a54283cdd4f0d26bc138d01c037ad1dee5bc018",
    entityCounts: {
      features: 1,
      requirements: 1,
      risks: 1,
      threats: 1,
      adrs: 1,
      components: 1,
      workItems: 1,
      evidence: 1,
      documents: 1
    }
  }
}
```

No secrets, keys, or sensitive values are recorded in the audit event details.

---

## 8. Stable Identity & Idempotency Behavior

### Stable Identity:
The canonical self-project must always use the fixed identifier:
```
Project ID: PRJ-DOCMONSTAKRAKIN
```
This guarantees deterministic reference integrity across configuration, documentation, tests, and CLI scripts.

### Idempotency Behavior (`CREATE_ONLY`):
- Default behavior: **`CREATE_ONLY`**.
- If a project with ID `PRJ-DOCMONSTAKRAKIN` already exists in `.local/project-state.json`:
  1. The bootstrap process halts immediately with an explicit conflict error: `PROJECT_ALREADY_EXISTS: Project 'PRJ-DOCMONSTAKRAKIN' is already present in canonical store.`
  2. Exactly **zero** mutations are made to the store.
  3. No secondary or randomized project ID is generated.
  4. Existing project data is never silently overwritten.
- Any future update or synchronization capability (e.g. `RECONCILE` or `UPDATE`) requires an explicit, separate design contract and flag.

---

## 9. Referential Integrity Rules

The entire bootstrap manifest must pass 100% referential integrity validation before any state transition is attempted:

1. **Entity ID Uniqueness**:
   Every entity ID across all collections (`features`, `requirements`, `risks`, `threats`, `adrs`, `components`, `workItems`, `evidence`, `documents`) must be unique within its respective collection.
2. **Work Item -> Requirement Resolution**:
   Every requirement ID cited in `workItem.requirements` must resolve to an existing `Requirement` in `manifest.requirements`.
3. **Work Item -> Feature Resolution**:
   Every feature ID cited in `workItem.features` must resolve to an existing `Feature` in `manifest.features`.
4. **Work Item -> Evidence Resolution**:
   Every evidence ID cited in `workItem.evidence` must resolve to an existing `Evidence` record in `manifest.evidence`.
5. **Requirement -> Risk Resolution**:
   Every risk ID cited in `requirement.riskLinks` must resolve to an existing `Risk` in `manifest.risks`.
6. **Requirement -> Threat Resolution**:
   Every threat ID cited in `requirement.threatLinks` must resolve to an existing `Threat` in `manifest.threats`.
7. **Requirement -> Feature Resolution**:
   Every feature ID cited in `requirement.linkedFeatureId` must resolve to an existing `Feature` in `manifest.features`.
8. **Component -> Requirement & ADR Resolution**:
   Every requirement ID cited in `component.assignedRequirements` must resolve to an existing `Requirement`. Every ADR ID in `component.linkedADRs` must resolve to an existing `ADR`.
9. **No Cross-Project Reference Contamination**:
   Entities containing a `projectId` field must match `manifest.project.id`. Entities with foreign project IDs are rejected.
10. **Domain Enum Conformance**:
    All status, category, priority, trustZone, and classification values must strictly conform to existing TypeScript domain types in `src/types.ts`.

---

## 10. Security Rules & Structural Sensitive-Key Scanner

### Prohibited Data:
The bootstrap manifest must not contain:
- Passwords or passphrases;
- SecretStore encryption keys or machine tokens;
- Authentication tokens or bearer tokens;
- API keys (Gemini, third-party);
- Reviewer password verifiers or salt hashes;
- Private keys or cryptographic key material.

### Structural Sensitive-Key Scanner:
A recursive structural scanner inspects all keys in the manifest before any parsing or entity creation. Any key matching the following regular expressions causes immediate failure:
```regexp
/password/i
/secret/i
/apikey/i
/api_key/i
/token/i
/privatekey/i
/private_key/i
/machinetoken/i
/machine_token/i
/credential/i
/verifier/i
/passphrase/i
/auth_tag/i
```

### Sensitive Error Hygiene:
**Critical security invariant**: When a prohibited key is detected, the error message reports only the object property path (e.g. `Prohibited sensitive key detected at 'project.apiKey'`). **Under no circumstances is the property's value printed, logged, or included in error messages.**

---

## 11. Provenance Requirements

The bootstrap manifest must record safe, verifiable provenance attributing the source of the bootstrap data:

```typescript
export interface BootstrapProvenance {
  repository: string;      // "Jeruzael/docmonstakrakin"
  baselineCommit: string;  // "0a54283cdd4f0d26bc138d01c037ad1dee5bc018"
  source: 'LOCAL_REPOSITORY_DOCUMENTATION';
  preparedAt?: string;     // ISO-8601 timestamp
  preparer?: string;       // Identity or script generating manifest
  notes?: string;
}
```

### Invariant on Baseline Commit:
`baselineCommit` represents the verified baseline checkpoint *before* the bootstrap execution begins. It is an input reference, not an eternally self-updating HEAD. This avoids recursive documentation loops where a commit hash change invalidates its own documentation.

---

## 12. Manifest Integrity & Deterministic Canonical Hashing

To ensure tamper evidence and reproducible verification:
1. **Deterministic Canonical JSON Serialization**:
   The manifest is serialized using the established `canonicalizeJson` helper (key-sorted, whitespace-normalized, array-ordered).
2. **Manifest Digest**:
   The SHA-256 digest is computed over the canonical string:
   $$\text{Manifest Digest} = \text{SHA-256}(\text{canonicalizeJson}(\text{manifest}))$$
3. **Digest Persistence**:
   The calculated digest is stored in the resulting `PROJECT_BOOTSTRAPPED` audit event.

---

## 13. Dry-Run Contract

Future bootstrap tooling must provide a safe dry-run mode:
```bash
npm run bootstrap:self -- --dry-run
```

### Dry-Run Execution Semantics:
1. Parse and validate the manifest against all schema, referential integrity, security, and governance rules.
2. Resolve all references and compute entity counts.
3. Compute the canonical manifest SHA-256 digest.
4. Output a comprehensive dry-run report.
5. **Invariant**: Make **ZERO** mutations to disk or memory (`mutationCount: 0`).

### Dry-Run Report Shape:
```typescript
export interface BootstrapDryRunReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mode: 'TRUSTED_LOCAL_BOOTSTRAP';
  projectToCreate: {
    id: string;
    name: string;
    maturity?: string;
    profiles: string[];
    specializedProfiles: string[];
    lifecyclePhase: string;
  } | null;
  counts: BootstrapEntityCounts;
  manifestDigest: string | null;
  governanceRestrictions: string[];
  unresolvedReferenceErrors: string[];
  mutationCount: 0;
}
```

---

## 14. Atomic Execution Contract

When bootstrap execution is eventually implemented, it must follow an atomic transaction flow:

```
[ STEP 1: VALIDATE EVERYTHING ]
       |  (Schema, sensitive keys, governance prohibition, enums)
       v
[ STEP 2: BUILD CANDIDATE STATE ]
       |  (In-memory candidate structures)
       v
[ STEP 3: VERIFY REFERENCES ]
       |  (Cross-collection link resolution, foreign project check)
       v
[ STEP 4: COMPUTE MANIFEST DIGEST ]
       |  (Deterministic SHA-256 of canonical manifest)
       v
[ STEP 5: IDEMPOTENCY CHECK ]
       |  (Fail closed if PRJ-DOCMONSTAKRAKIN exists)
       v
[ STEP 6: ATOMIC COMMIT ]
       |  (Write candidate state to .local/project-state.json.tmp -> renameSync)
       v
[ STEP 7: RECORD AUDIT EVENT ]
          (Append PROJECT_BOOTSTRAPPED to audit ledger)
```

**Atomicity Guarantee**: Any failure, exception, or validation error at Steps 1 through 6 halts execution immediately and results in **ZERO canonical state changes.**

---

## 15. Known Usability Gap: `PROJECTS_WORKSPACE_REQUIRED`

### Context:
Currently, the docmonstakrakin user interface operates primarily against a single active project loaded in session state. While multiple projects can be stored in `.local/project-state.json`, the UI lacks a dedicated Projects workspace to browse, create, inspect, archive, or switch between multiple projects.

### Usability Model Target:
- **Top-Bar Project Selector**: Compact dropdown in the header for quick switching between available projects.
- **Projects Workspace**: Dedicated view (`/projects` or tab) allowing operators to:
  - Browse all local and imported projects;
  - Inspect project metadata, health scores, and lifecycle phases;
  - Initiate new greenfield projects;
  - Import portable packages or trigger trusted self-bootstrap;
  - Archive or export project packages.

### Scope Boundary for Step 2:
This usability gap is explicitly noted as **`PROJECTS_WORKSPACE_REQUIRED`**. It is out of scope for Step 2 and will be addressed after self-bootstrap contract definition and manifest preparation are complete.

---

## 16. Illustrative (Non-Executed) Project Identity

For clarity of reference, the target self-project identity is defined as:

```json
{
  "id": "PRJ-DOCMONSTAKRAKIN",
  "name": "docmonstakrakin",
  "description": "A-SSDLC Development Control Plane",
  "maturity": "EXISTING_PROJECT",
  "profiles": [
    "WEB_APPLICATION",
    "BACKEND_API"
  ],
  "specializedProfiles": [
    "DEVELOPER_TOOL",
    "INTERNAL_TOOL"
  ],
  "deliveryMethod": "ITERATIVE",
  "deploymentIntent": "Containerized Web Application on Cloud Run",
  "dataSensitivity": "CONFIDENTIAL",
  "lifecyclePhase": "IMPLEMENTATION",
  "owner": "docmonstakrakin-core",
  "targetRelease": "v0.1.0-rc1"
}
```

*Note: This illustrative definition is non-executed. Creation of this project record occurs only in subsequent controlled steps.*
