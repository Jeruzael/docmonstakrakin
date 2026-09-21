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

In the repository root:

```bash
# Preferred path: preserve the real existing canonical snapshot.
if [ -f ".local/project-state.json" ]; then
  mkdir -p .local
  cp .local/project-state.json \
    .local/project-state.baseline-backup.json

  echo "Existing canonical snapshot copied to baseline backup."

# Fallback only when no persisted canonical snapshot exists.
else
  echo "No .local/project-state.json found."
  echo "Generating baseline from a fresh ProjectStore."

  npx tsx -e "
import fs from 'node:fs';
import { ProjectStore } from './server/projectStore.ts';
import {
  snapshotProjectStore,
  PROJECT_STATE_SCHEMA_VERSION
} from './server/projectPersistence.ts';

const store = new ProjectStore();

fs.mkdirSync('.local', { recursive: true });

fs.writeFileSync(
  '.local/project-state.baseline-backup.json',
  JSON.stringify({
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    state: snapshotProjectStore(store)
  }, null, 2)
);

console.log('Baseline snapshot created at .local/project-state.baseline-backup.json');
"
fi
```

Verify that the baseline snapshot exists:

```bash
test -s .local/project-state.baseline-backup.json \
  && echo "PASS: baseline snapshot exists and is non-empty" \
  || { echo "STOP: baseline snapshot missing or empty"; exit 1; }
```
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
4. **Subsequent Controlled Sequence**:

   Completion of `DMK-193` does not directly authorize Batch 2 or Gate 7.

   The next controlled work items remain:

   1. `DMK-194` — Projects Workspace & Reliable Project Switching
   2. `DMK-195` — Controlled Documentation Workspace
   3. `DMK-196` — Batch 2 Formal Requirement Sign-Off UX
   4. `DMK-197` — Batch 3 Approval Inbox & Canonical Quorum Synchronization
   5. `DMK-198` — Batch 4 Reviewer Provisioning / Governance Setup Usability
   6. `DMK-199` — Batch 5 Full Regression & Evidence Cleanup
   7. `DMK-191` — Human Browser Retest
   8. Gate 7 Human Release Approval

   Gate 7 remains `NOT EXECUTED`.

   Batch 2 remains blocked until its prerequisite work items are reached through the controlled sequence above.

---

## 4. Failure Preservation & Controlled Recovery

If the self-bootstrap execution or post-execution verification fails, the operator MUST fail closed.

### 4.1 Immediate Failure Response

Do **not** rerun the bootstrap.

Do **not** immediately restore the baseline over the current snapshot.

The potentially failed post-bootstrap snapshot is evidence and must be preserved before any rollback decision is made.

Immediately:

1. Stop further bootstrap execution.
2. Preserve the current post-execution snapshot.
3. Preserve the pre-execution baseline snapshot.
4. Record SHA-256 hashes of both files.
5. Preserve terminal output and verifier errors.
6. Diagnose the discrepancy before deciding whether rollback is appropriate.

### 4.2 Preserve Failure Evidence

Create a recovery directory:

```bash
mkdir -p .local/recovery
```

Preserve the current post-bootstrap snapshot:

```bash
cp .local/project-state.json \
  .local/recovery/step5-failed-postbootstrap-project-state.json
```

Preserve the original baseline:

```bash
cp .local/project-state.baseline-backup.json \
  .local/recovery/step5-baseline-project-state.json
```

Record SHA-256 hashes:

```bash
FAILED_SHA="$(sha256sum .local/recovery/step5-failed-postbootstrap-project-state.json | awk '{print $1}')"
BASELINE_SHA="$(sha256sum .local/recovery/step5-baseline-project-state.json | awk '{print $1}')"

echo "Failed/Post-Bootstrap Snapshot SHA-256: $FAILED_SHA"
echo "Baseline Snapshot SHA-256:              $BASELINE_SHA"
```

Do not delete or overwrite either preserved file while the discrepancy is under investigation.

### 4.3 Diagnostic Verification

Before rollback, inspect the failure using the read-only verification and existing bootstrap tests:

```bash
npm run verify:bootstrap:execution -- \
  --baseline-snapshot .local/project-state.baseline-backup.json
```

Then, where appropriate:

```bash
npm run test:bootstrap:contract
npm run test:bootstrap:manifest
npm run test:bootstrap:executor
npm run test:bootstrap:execution-verifier
```

Record all failure output before modifying canonical state.

### 4.4 Deliberate Rollback

Rollback is an explicit operator recovery action, not the automatic response to a failed verification.

Only after the failed/current snapshot has been preserved and the operator deliberately chooses rollback:

```bash
cp .local/project-state.baseline-backup.json \
  .local/project-state.json
```

Then verify that the restored snapshot matches the preserved baseline:

```bash
RESTORED_SHA="$(sha256sum .local/project-state.json | awk '{print $1}')"
BASELINE_SHA="$(sha256sum .local/project-state.baseline-backup.json | awk '{print $1}')"

echo "Restored SHA-256: $RESTORED_SHA"
echo "Baseline SHA-256: $BASELINE_SHA"

test "$RESTORED_SHA" = "$BASELINE_SHA" \
  && echo "PASS: baseline snapshot restored byte-identically" \
  || { echo "FAIL: restored snapshot does not match baseline"; exit 1; }
```

### 4.5 No Automatic Retry

After any partial, failed, or suspicious execution:

- do not rerun `bootstrap:self -- --execute`;
- do not use a force or overwrite mechanism;
- do not modify the manifest to bypass the failure;
- do not delete the failed snapshot evidence;
- do not advance `DMK-193` to `VERIFIED`.

A new execution attempt requires root-cause analysis and a fresh explicit operator decision.
