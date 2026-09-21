# Step 5 / DMK-193: Trusted Self-Bootstrap Execution & Verification Plan

**Document ID**: `DOC-VER-005`  
**Status**: `PREPARED_FOR_OPERATOR_EXECUTION`  
**Target Work Item**: `DMK-193` — Execute Trusted Self-Bootstrap & Verify Canonical State  
**WBS Status**: `IN_PROGRESS` (Prepared; Awaiting Human Operator Execution)  
**Preceding Work Item**: `DMK-192` — `VERIFIED` (Dry-Run Approved by Human Operator)  
**Next Stage (Gated)**: Gate 7 Human Sign-Off / Batch 2 Implementation (**STRICTLY BLOCKED**)  
**Supported Environments**: `GIT` (Authoritative local clone) | `AI_STUDIO_WORKSPACE` (Sandbox container)  
**Target Project ID**: `PRJ-DOCMONSTAKRAKIN`  
**Authoritative Manifest**: `bootstrap/docmonstakrakin.self-bootstrap.json`  
**Reviewed Canonical Manifest SHA-256 Digest**:  
`229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36`

---

## 1. Governance Boundary & Execution Authority

In accordance with `docs/00_control/SELF_BOOTSTRAP_CONTRACT.md` and explicit human operator directives:

1. **Human Operator Execution Exclusivity**:
   - The AI assistant is **STRICTLY PROHIBITED** from executing the live self-bootstrap (`npm run bootstrap:self -- --execute ...`).
   - The real self-bootstrap ceremony MUST be performed manually by the authorized human operator.
2. **Read-Only Assistant Scope**:
   - Step 5A is strictly limited to developing, testing, and documenting the post-execution verification tooling (`scripts/verifySelfBootstrapExecution.ts`) and this execution plan.
   - All verification tooling is 100% read-only (`mutationCount: 0`).
3. **Source Control Boundary**:
   - All Git operations (`git commit`, `git push`, `git checkout`, etc.) are 100% owned by the human operator.
4. **WBS Transition Integrity**:
   - `DMK-192` has transitioned to `VERIFIED` following operator approval of Step 4.
   - `DMK-193` is currently `IN_PROGRESS`. It MUST NOT transition to `VERIFIED` until the operator has executed the real bootstrap and post-execution verification passes with zero errors.
5. **Downstream Blocks**:
   - Gate 7, Batch 2, and v0.2 implementation remain **STRICTLY BLOCKED** until DMK-193 verification is complete.

---

## 2. Invariant Specifications for DMK-193 Execution

An authorized live self-bootstrap execution must satisfy the following strict invariants:

| Invariant Category | Constraint | Verification Metric |
| :--- | :--- | :--- |
| **Execution Gating** | Triple-lock confirmation required | `DMK_SELF_BOOTSTRAP_EXECUTE=PRJ-DOCMONSTAKRAKIN`, `--confirm-project-id PRJ-DOCMONSTAKRAKIN`, `--confirm-manifest-digest 229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36` |
| **Conflict Check** | CREATE_ONLY semantics | Fails closed if `PRJ-DOCMONSTAKRAKIN` already exists in `.local/project-state.json` |
| **State Preservation** | Zero drift of unrelated projects | `baselineUnrelatedStateHash === currentUnrelatedStateHash` |
| **Entity Counts** | Exact 1:1 manifest reflection | Features (15), Requirements (24), Risks (6), Threats (8), ADRs (7), Components (6), WorkItems (13), Evidence (4), Documents (28) |
| **Clean Discovery** | Zero synthetic wizard state | 8 collections strictly empty `[]`: `questions`, `standards`, `overrides`, `approvals`, `agentRoles`, `agentRuns`, `derivations`, `importSessions` |
| **Zero Governance Injection** | No fabricated approvals | `approvals: []`, `releaseSignoffInjected: false`, Gate 7 strictly unexecuted |
| **Audit Chaining** | Single genesis bootstrap event | `action: PROJECT_BOOTSTRAPPED`, `actor: docmonstakrakin-bootstrap-cli`, `previousHash: 000...000`, `manifestDigest: 229215...` |
| **Anti-TOCTOU** | Manifest immutability | Manifest on disk must compute exactly `229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36` |

---

## 3. Step-by-Step Operator Execution Instructions

The human operator should execute the ceremony following these sequential phases:

### Phase 1: Pre-Execution Baseline Capture

Before running the real bootstrap, preserve an exact byte-for-byte baseline snapshot of the pre-execution project state.

In the repository root:

```bash
# If .local/project-state.json exists:
mkdir -p .local
cp .local/project-state.json .local/project-state.baseline-backup.json

# If .local/project-state.json does not yet exist (using built-in default baseline):
# Generate a pristine baseline snapshot from the current in-memory baseline store:
npx tsx -e "
import fs from 'node:fs';
import path from 'node:path';
import { initialStore } from './server/projectStore.ts';
import { PROJECT_STATE_SCHEMA_VERSION } from './server/projectPersistence.ts';
fs.mkdirSync('.local', { recursive: true });
fs.writeFileSync('.local/project-state.baseline-backup.json', JSON.stringify({
  schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
  state: initialStore
}, null, 2));
console.log('Baseline snapshot created at .local/project-state.baseline-backup.json');
"
```

Verify that `.local/project-state.baseline-backup.json` exists and is non-empty.

---

### Phase 2: Authoritative Self-Bootstrap Execution

Execute the trusted self-bootstrap ceremony using the triple-gated CLI command:

```bash
DMK_SELF_BOOTSTRAP_EXECUTE=PRJ-DOCMONSTAKRAKIN \
npm run bootstrap:self -- \
  --execute \
  --confirm-project-id PRJ-DOCMONSTAKRAKIN \
  --confirm-manifest-digest 229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36
```

#### Expected CLI Output:
```text
================================================================
docmonstakrakin - TRUSTED SELF-BOOTSTRAP CLI (DMK-192 / DMK-193)
================================================================
Execution Mode:          EXECUTE
Target Project ID:       PRJ-DOCMONSTAKRAKIN
Manifest Digest:         229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36
Overall Status:          EXECUTED
Snapshot Path:           .../.local/project-state.json
Preserved Projects:      ...
Unrelated State:         VERIFIED (100% unchanged)
...
================================================================
>>> BOOTSTRAP EXECUTION COMPLETE: Canonical project PRJ-DOCMONSTAKRAKIN persisted.
```

---

### Phase 3: Post-Execution Verification

Run the read-only post-execution verification tool against the saved baseline snapshot:

```bash
npm run verify:bootstrap:execution -- --baseline-snapshot .local/project-state.baseline-backup.json
```

Or for machine-readable JSON output:

```bash
npm run verify:bootstrap:execution -- --baseline-snapshot .local/project-state.baseline-backup.json --json
```

#### Expected Verification Output:
```text
================================================================
docmonstakrakin - POST-BOOTSTRAP EXECUTION VERIFIER (DMK-193)
================================================================
Status:                     BOOTSTRAP_VERIFIED
Target Project ID:          PRJ-DOCMONSTAKRAKIN
Baseline Snapshot Path:     .../.local/project-state.baseline-backup.json
Current Snapshot Path:      .../.local/project-state.json
Baseline Project Count:     N
Current Project Count:      N+1
Newly Added Project IDs:    ["PRJ-DOCMONSTAKRAKIN"]
Unrelated State Preserved:  VERIFIED
Manifest Digest:            229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36
----------------------------------------------------------------
ENTITY COUNTS (PRJ-DOCMONSTAKRAKIN):
  Features:                 15 (expected 15)
  Requirements:             24 (expected 24)
  Risks:                    6 (expected 6)
  Threats:                  8 (expected 8)
  ADRs:                     7 (expected 7)
  Components:               6 (expected 6)
  Work Items:               13 (expected 13)
  Evidence Artifacts:       4 (expected 4)
  Controlled Documents:     28 (expected 28)
----------------------------------------------------------------
Empty Collections Verified: YES
Bootstrap Audit Events:     1 (expected 1)
Audit Ledger Valid:         YES
Approvals Injected:         0 (expected 0)
Release Signoff Injected:   NO
Gate 7 Executed:            NO
Filesystem Mutations:       0 (Strictly Read-Only)
================================================================
>>> POST-EXECUTION VERIFICATION PASSED: State is CANONICAL & TRUSTED.
```

---

### Phase 4: Post-Verification Operational Transition

Once Phase 3 passes with `BOOTSTRAP_VERIFIED`:

1. **Live WBS Update**:
   - In `docs/00_control/MASTER_WBS.yaml`, transition `DMK-193` from `IN_PROGRESS` to `VERIFIED`.
   - Record `verified_by: "npm run verify:bootstrap:execution"` and execution date.
   - Run `npm run wbs:render` and verify `npm run wbs:check`.
2. **Project State Update**:
   - In `docs/00_control/PROJECT_STATE.md` and `docs/00_control/LAST_HANDOFF.md`, record Step 5 completion and canonical state activation.
3. **Save Post-Execution Verification Evidence**:
   - Capture the output of `npm run verify:bootstrap:execution -- --baseline-snapshot ... --json > docs/07_verification/self-bootstrap-execution-verification.json`.
4. **Subsequent Milestones**:
   - Gate 7 review and Batch 2 implementation become unblocked only after these operational steps are complete.

---

## 4. Rollback & Fail-Safe Recovery

If any failure occurs during execution or verification:

1. **Restore Baseline Snapshot**:
   ```bash
   cp .local/project-state.baseline-backup.json .local/project-state.json
   ```
2. **Investigate Discrepancy**:
   - Check CLI error output for specific validation or integrity failures.
   - Run `npm run test:bootstrap:contract`, `npm run test:bootstrap:manifest`, and `npm run test:bootstrap:executor` to confirm baseline tooling integrity.
3. **Preserve Audit Trail**:
   - Never force-overwrite snapshots without diagnosing the root cause.
