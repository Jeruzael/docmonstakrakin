# Trusted Self-Bootstrap Contract & Schema Specification

**Document Identifier:** `DOC-CTRL-BOOTSTRAP-001`  
**Status:** APPROVED DESIGN CONTRACT (Step 2A — Hardened Contract & Schema)  
**Schema Identifier:** `SELF_BOOTSTRAP_V1`  
**Bootstrap Mode:** `TRUSTED_LOCAL_BOOTSTRAP`  
**Repository:** `Jeruzael/docmonstakrakin`  
**Authoritative Baseline Commit:** `ab3cdda66f59b1e0acef3299d6107cfa09d5efa7`  
**Target Project ID:** `PRJ-DOCMONSTAKRAKIN`  
**Runtime Implementation Status:** CONTRACT ONLY — NO RUNTIME INJECTION EXECUTED  

---

## 1. Executive Summary & Purpose

The purpose of the Trusted Self-Bootstrap contract is to establish a deterministic, verifiable, and strictly hardened mechanism for initializing docmonstakrakin's own development history, architecture, requirements, risks, verification evidence, and documentation into its canonical project store (`.local/project-state.json`).

docmonstakrakin is an A-SSDLC (Agentic Secure Software Development Life Cycle) control plane. In order to govern its own continuing development—including the governance remediation sequence, future verification batches, and release management—the application must hold its own canonical structured state as an existing project (`EXISTING_PROJECT`), dogfooding its own data structures and governance engines without compromising audit, security, or release gates.

**THIS SPECIFICATION IS CONTRACT AND DESIGN ONLY.**
Under this Step 2A contract:
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
|  | Verification: Status = VERIFICATION |   | Verification: Marked UNTRUSTED     | |
|  | Status: CREATE_ONLY (PRJ-DOC...)    |   | Status: Preserves ID (conflict     | |
|  |                                     |   |         unless overwrite: true)    | |
|  +-------------------------------------+   +------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

### Critical Separation Rules:
1. **Never Repurpose the Portable Package Importer (`POST /api/projects/package/import`)**:
   The portable package importer is explicitly engineered for untrusted cross-machine package imports. Under `SEC-CTRL-018`, imported packages must have all approval signatures, credentials, and governance state stripped or marked `UNTRUSTED`. Repurposing this endpoint for local self-bootstrap would violate security boundaries or require loosening untrusted package defenses.
2. **Package Import Preserves Project ID with Conflict Safeguard**:
   Production portable-package import preserves the incoming project ID. If that project ID already exists in the store, the import halts with a conflict error by default; overwrite requires an explicit `overwrite: true` parameter.
3. **Explicit Trusted-Local Boundary**:
   The Self-Bootstrap mechanism operates via a dedicated local command/service executing in `TRUSTED_LOCAL_BOOTSTRAP` mode. It ingests verified documentation and technical evidence produced during local development.
4. **No Network Egress or Remote Fetching**:
   The self-bootstrap process reads exclusively from local file paths within the current repository workspace.

---

## 3. Allowed Canonical Collections & Closed Root Schema

The bootstrap manifest supports validated arrays for the core canonical entities defined in `src/types.ts`.
SELF_BOOTSTRAP_V1 enforces a **closed root schema**. The ONLY permitted root properties are:

```typescript
export const PERMITTED_ROOT_KEYS: readonly string[] = [
  'schemaVersion',
  'mode',
  'provenance',
  'project',
  'features',
  'requirements',
  'risks',
  'threats',
  'adrs',
  'components',
  'workItems',
  'evidence',
  'documents',
];
```

Any unknown or extraneous root properties (e.g., `approvals`, `auditLogs`, `releaseSignoff`, `credentials`, `runtimeState`) cause immediate validation failure.

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
| `documents` | `ControlledDocumentReference[]` | Validated repository Markdown documentation files. |

---

## 4. Controlled Document References & Path Traversal Defense

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
  sha256Digest?: string;    // Optional 64-character hex SHA-256 digest of document file at baseline
}
```

### Strict Path Traversal Defense:
The `path` property of every document reference is subjected to strict path validation:
- Must be a non-empty string;
- Must be repository-relative and strictly under `docs/` (i.e. starts with `docs/`);
- Must be free from `..` directory traversal segments;
- Cannot be an absolute POSIX path (must not start with `/`);
- Cannot be an absolute Windows path (no `C:\...` or UNC `\\...`);
- Cannot escape the repository root.

If `sha256Digest` is present, it must be a valid 64-character hexadecimal SHA-256 string (`/^[0-9a-fA-F]{64}$/`).

---

## 5. Governance Invariants & Recursive Governance Scanning

Self-bootstrap initializes project knowledge, **not governance approvals.** The bootstrap contract enforces strict invariants to prevent unauthorized privilege escalation:

### Prohibited Governance Fields (Recursive Scan):
A recursive scanner inspects the entire manifest across all object depths and nested arrays. Any occurrence of the following keys is rejected immediately:
- `approvals`
- `approvalsCollected`
- `signatures`
- `releaseSignoff`
- `releaseSignOff`
- `gate7Approval`
- `authorizedBy`

**Error Hygiene**: The validation error reports only the property path (e.g., `Governance field 'documents[0].approvals' is strictly forbidden in bootstrap manifests`). The value is never output.

### Governance-Bearing Entity Status Invariants:
1. **Requirements**: Cannot have status `APPROVED` during bootstrap. Permitted: `PROPOSED`, `UNDER_REVIEW`, `REJECTED`, `DEFERRED`, `VERIFIED`.
2. **ADRs**: Cannot have status `ACCEPTED` during bootstrap; formal ratification requires human sign-off. Permitted: `PROPOSED`, `REJECTED`, `DEPRECATED`, `SUPERSEDED`.
3. **Features**: Cannot have status `APPROVED` during bootstrap. Permitted: `PROPOSED`, `UNDER_REVIEW`, `DEFERRED`, `REJECTED`.
4. **Gate 7**: Release Gate 7 must remain `HUMAN_APPROVAL_REQUIRED` / `NOT EXECUTED`.
5. **No Synthetic Approvals**: No approval records may be generated or back-filled to justify historical state.

---

## 6. Historical Work State & WorkItem Governance Semantics

Completed technical work from prior milestones (Batch 1, Batch 1.5) must be represented accurately without simulating human governance ceremonies:

### WorkItem Status Rules:
- **Allowed WorkItem Bootstrap Statuses**:
  - `PROPOSED`
  - `BACKLOG`
  - `READY`
  - `IN_PROGRESS`
  - `VERIFICATION`
  - `DEFERRED`
- **Forbidden WorkItem Bootstrap Statuses**:
  - `VERIFIED`
  - `APPROVED`
  - `RELEASED`

### Invariant: Technical Evidence Exists ≠ Human Verification Occurred:
In docmonstakrakin:
- `VERIFIED` on a `WorkItem` represents an authenticated human verification ceremony.
- `APPROVED` and `RELEASED` represent authenticated human release gate sign-offs.
- Completed technical work must therefore be imported as `status = 'VERIFICATION'` accompanied by legitimate `Evidence` records in `manifest.evidence`.
- `Evidence` records may carry `result = 'PASSED'` or `result = 'VERIFIED'` reflecting real technical automated test outcomes. Evidence result values represent technical execution outputs, not human governance authority.

### Removal of Text Heuristics:
Evidence relationships cannot be established by regex matching on plain prose (e.g., `EVID-`, `rc-regression`). All evidence links must use explicit foreign keys in `workItem.evidence` that resolve to existing `Evidence` records in `manifest.evidence`.

---

## 7. Runtime Enum Validation

TypeScript compile-time types do not enforce runtime boundary safety on external JSON. `validateSelfBootstrapManifest` enforces explicit runtime allowlists for all domain enums:

- **Project**:
  - `maturity`: `['GREENFIELD', 'EXISTING_PROJECT', 'MIGRATION', 'EXTENSION']`
  - `profiles`: `['WEB_APPLICATION', 'MOBILE_APPLICATION', 'BACKEND_API', 'BACKEND_SERVICE', 'FULL_STACK', 'API_SERVICE', 'DATA_PIPELINE', 'DESKTOP_APPLICATION', 'DESKTOP_GUI', 'EMBEDDED_SYSTEM', 'AI_APPLICATION', 'AGENTIC_AI_APPLICATION']`
  - `specializedProfiles`: `['FINANCIAL', 'HEALTHCARE', 'EDUCATION', 'ECOMMERCE', 'PII', 'INTERNAL_TOOL', 'PUBLIC_INTERNET', 'AI_ASSISTANT', 'AUTONOMOUS_AGENT', 'DEVELOPER_TOOL', 'AGENTIC_AI_EXPERIMENTATION', 'AI_ENGINEERING', 'DATA_PLATFORM']`
  - `deliveryMethod`: `['ITERATIVE', 'SCRUM', 'KANBAN', 'SCRUMBAN']`
  - `dataSensitivity`: `['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']`
  - `lifecyclePhase`: `['DISCOVERY', 'REQUIREMENTS', 'REQUIREMENTS_REVIEW', 'RISK_ASSESSMENT', 'THREAT_MODELING', 'ARCHITECTURE', 'ARCHITECTURE_REVIEW', 'PLANNING', 'IMPLEMENTATION', 'VERIFICATION', 'SECURITY_REVIEW', 'RELEASE_APPROVAL', 'DEPLOYMENT', 'OPERATIONS', 'FEEDBACK']`
- **Feature**:
  - `priority`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'P0', 'P1', 'P2']`
  - `status`: `['PROPOSED', 'UNDER_REVIEW', 'DEFERRED', 'REJECTED']` (Forbidden: `APPROVED`)
  - `source`: `['DISCOVERY', 'MANUAL_ENTRY', 'AI_PROPOSED', 'REQUIREMENT', 'WIZARD', 'PRODUCT_BASELINE']`
- **Requirement**:
  - `category`: `['FUNCTIONAL', 'SECURITY', 'PRIVACY', 'DATA', 'OPERATIONAL', 'COMPLIANCE', 'AI_SPECIFIC', 'AGENT_SPECIFIC', 'ARCHITECTURE']`
  - `status`: `['PROPOSED', 'UNDER_REVIEW', 'REJECTED', 'DEFERRED', 'VERIFIED']` (Forbidden: `APPROVED`)
  - `priority`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
  - `source.type`: `['questionnaire_answer', 'stakeholder', 'standard_control', 'threat_mitigation', 'wizard_baseline', 'ai_derivation', 'EXTERNAL_AI_PROPOSAL']`
- **Risk**:
  - `inherentLevel`, `residualLevel`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
  - `treatment`: `['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID']`
- **Threat**:
  - `riskLevel`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
  - `mitigations[].status`: `['RESOLVED', 'IN_PROGRESS', 'UNRESOLVED']`
- **ADR**:
  - `status`: `['PROPOSED', 'REJECTED', 'DEPRECATED', 'SUPERSEDED']` (Forbidden: `ACCEPTED`)
- **ArchitectureComponent**:
  - `category`: `['CLIENT', 'GATEWAY', 'SERVICE', 'DATASTORE', 'EXTERNAL']`
  - `trustZone`: `['INTERNET', 'DMZ', 'INTERNAL_SECURE', 'RESTRICTED_DATA']`
  - `dataClassification`: `['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']`
- **WorkItem**:
  - `type`: `['EPIC', 'FEATURE', 'TASK', 'SECURITY', 'VERIFICATION', 'RELEASE']`
  - `status`: `['PROPOSED', 'BACKLOG', 'READY', 'IN_PROGRESS', 'VERIFICATION', 'DEFERRED']` (Forbidden: `VERIFIED`, `APPROVED`, `RELEASED`)
  - `priority`: `['P0', 'P1', 'P2']`
  - `risk`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
- **Evidence**:
  - `type`: `['TEST_RUN', 'COMMIT', 'DIFF', 'SECURITY_SCAN', 'HUMAN_REVIEW', 'AGENT_REVIEW', 'DEPLOYMENT_RECORD']`
  - `result`: `['PASSED', 'FAILED', 'VERIFIED', 'UNTRUSTED']`
- **ControlledDocumentReference**:
  - `kind`: `['CONTROL', 'PRODUCT', 'REQUIREMENTS', 'ARCHITECTURE', 'SECURITY', 'VERIFICATION', 'OPERATIONS']`
  - `authority`: `['REFERENCE', 'GENERATED_PROJECTION']`

**Security Invariant**: Error messages report the offending property path and expected allowlist, never reflecting unvalidated raw values.

---

## 8. Complete Referential Integrity

The validator enforces 100% referential integrity across all relationships:
1. `feature.requirements` -> must resolve to `Requirement` IDs
2. `feature.dependencies` -> must resolve to `Feature` IDs
3. `requirement.riskLinks` -> must resolve to `Risk` IDs
4. `requirement.threatLinks` -> must resolve to `Threat` IDs
5. `requirement.linkedFeatureId` -> must resolve to `Feature` ID (if present)
6. `requirement.workItems` -> must resolve to `WorkItem` IDs
7. `requirement.evidence` -> must resolve to `Evidence` IDs
8. `adr.linkedRequirements` -> must resolve to `Requirement` IDs
9. `adr.linkedRisks` -> must resolve to `Risk` IDs
10. `workItem.requirements` -> must resolve to `Requirement` IDs
11. `workItem.features` -> must resolve to `Feature` IDs
12. `workItem.evidence` -> must resolve to `Evidence` IDs
13. `workItem.dependencies` -> must resolve to `WorkItem` IDs
14. `evidence.workItemId` -> must resolve to `WorkItem` ID
15. `component.assignedRequirements` -> must resolve to `Requirement` IDs
16. `component.linkedADRs` -> must resolve to `ADR` IDs

**Cross-Project Containment**: Any entity with a `projectId` field must strictly equal `manifest.project.id`. External project IDs cause immediate failure.
Collections outside of SELF_BOOTSTRAP_V1 (such as `standardLinks`, `tests`) are not cross-validated against missing manifest tables.

---

## 9. Structural Sensitive-Key Scanner

A recursive scanner checks all property keys in the manifest against prohibited patterns:
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
When a prohibited key is detected, the error reports only the property path. Values are never printed or logged.

---

## 10. Provenance & Identity Validation

The bootstrap manifest must declare strict provenance:
```typescript
export interface BootstrapProvenance {
  repository: string;      // Exactly "Jeruzael/docmonstakrakin"
  baselineCommit: string;  // 40-character hexadecimal Git commit SHA
  source: 'LOCAL_REPOSITORY_DOCUMENTATION';
  preparedAt?: string;
  preparer?: string;
  notes?: string;
}
```

- `project.id` must be exactly `'PRJ-DOCMONSTAKRAKIN'`.
- `provenance.repository` must be exactly `'Jeruzael/docmonstakrakin'`.
- `provenance.baselineCommit` must be a valid 40-character hexadecimal SHA (`/^[0-9a-fA-F]{40}$/`).

---

## 11. Canonical JSON Compatibility & State Hashing

The self-bootstrap implementation uses `canonicalizeJson` to achieve deterministic key-sorted, whitespace-normalized serialization.
The SHA-256 digest is computed deterministically:
$$\text{Manifest Digest} = \text{SHA-256}(\text{canonicalizeJson}(\text{manifest}))$$

Test suites verify 100% serialization equivalence between the self-bootstrap helper and the portable package canonicalizer in `server/package/portablePackage.ts`.

---

## 12. Correct Atomic Execution Contract

When bootstrap execution is eventually implemented in a future step, it must follow this exact atomic transaction sequence:

```
[ STEP 1: VALIDATE MANIFEST ]
       |  (Schema, closed root, recursive governance, sensitive keys, enums)
       v
[ STEP 2: CHECK CREATE_ONLY CONFLICT ]
       |  (Fail closed with PROJECT_ALREADY_EXISTS if PRJ-DOCMONSTAKRAKIN exists)
       v
[ STEP 3: BUILD COMPLETE CANDIDATE STORE ]
       |  (Construct candidate store preserving all existing projects)
       v
[ STEP 4: VERIFY ALL REFERENCES ]
       |  (Cross-collection link resolution across candidate state)
       v
[ STEP 5: COMPUTE MANIFEST DIGEST ]
       |  (Deterministic SHA-256 of canonical manifest)
       v
[ STEP 6: CONSTRUCT PROJECT_BOOTSTRAPPED AUDIT EVENT INSIDE CANDIDATE STATE ]
       |  (Audit event created and sealed inside candidate ledger BEFORE commit)
       v
[ STEP 7: VERIFY CANDIDATE AUDIT LEDGER AND STATE ]
       |  (Verify state hash and hash chain continuity)
       v
[ STEP 8: ONE ATOMIC SNAPSHOT WRITE ]
       |  (Write candidate to temp file and renameSync onto .local/project-state.json)
       v
[ STEP 9: SUCCESS ]
```

### Invariants:
1. **Pre-Persistence Audit Sealing**: The `PROJECT_BOOTSTRAPPED` audit event is constructed and included in the candidate state *before* persistence. There is **no separate post-commit mutation**.
2. **Preservation of Pre-Existing Projects**:
   Self-bootstrap creates only `PRJ-DOCMONSTAKRAKIN`. It must preserve all pre-existing projects and their associated entities. The executor must not:
   - reset the store;
   - replace the entire state with the manifest;
   - delete existing projects;
   - clear unrelated collections;
   - rewrite unrelated audit ledgers.
3. **Atomicity Guarantee**: If any failure or exception occurs prior to the final atomic rename, the existing canonical store remains completely untouched with **zero mutations**.

---

## 13. Node-Specific Code Placement & Architecture

`src/data/selfBootstrapContract.ts` defines the contract and validation logic for CLI/server-side execution (`npm run bootstrap:self`).
- It is intentionally not imported by the client Vite SPA bundle (`src/main.tsx`).
- Browser UI components interact with project data exclusively via the Express REST API (`/api/projects`).
- Production frontend and server builds (`npm run build`) remain clean and free from browser-bundling hazards.

---

## 14. Known Usability Gap: `PROJECTS_WORKSPACE_REQUIRED`

The application requires a dedicated Projects workspace (`PROJECTS_WORKSPACE_REQUIRED`) to inspect and switch projects once multiple projects exist. This remains an explicit, tracked gap to be addressed after bootstrap preparation.
