# Batch A v2 implementation boundary

Owner: Codex, implementing the user's explicit 2026-09-23 Stage A request. Stable WBS ownership ID remains unassigned pending human allocation; this work does not claim DMK-194 or create/change DMK-195+. No WBS task status is changed by this implementation.

Repository authority remains the precedence in AGENT_BOOTSTRAP.md. MASTER_WBS.yaml describes repository development. The persisted ProjectStore describes operational runtime state. Packages are transport; the bootstrap manifest and its verification records are historical initialization evidence. The full WBS is never generated from runtime WorkItems.

The reconciliation projection maps the existing 13 runtime IDs DMK-187 through DMK-199 explicitly. Only DMK-192, DMK-193 and DMK-194 can be changed by this ceremony. Older differences are reported as observe-only. DMK-195+ remain observe-only even if their WBS status later changes.

Implementation sequence: guarded atomic persistence; retained-evidence validation and deterministic proposal; explicit apply with exact review binding; independent post-bootstrap verifier; WorkItem UI/server correction; disposable failure-injection/HTTP/browser regressions; read-only live proposal and preservation inventory. This is the Stage A scope authorized by the user. Historical apply remains unauthorized.

No startup migration or reconciliation HTTP endpoint exists. The CLI is a trusted local administrative tool. An explicit project confirmation, saved plan digest and DMK_RECONCILIATION_EXECUTE environment authorization are required for apply. An actor label records local operator attribution; it does not authenticate an identity or grant release authority.

The saved plan binds raw snapshot bytes, project stateVersion (including legacy absence), every evaluated WBS/evidence input, timestamp, actor, exact changes, audit event and candidate digest. Changing any proposal field invalidates its digest. Apply recomputes the projection, revalidates evidence immediately before rename, and compares snapshot bytes under an exclusive writer lock. Changes and the audit event share one snapshot rename. A repeated identical apply returns ALREADY_APPLIED without writing. A fresh no-change proposal also writes nothing.

The persistence writer is shared by the CLI and current server. A running current server with stale disk state rejects mutations until restart. Stop all servers and other snapshot writers before any future historical apply, especially processes running older code that do not participate in the writer protocol. Do not manually edit bound inputs during the ceremony. The protocol protects cooperating writers; it is not a filesystem access-control boundary against an administrator replacing files independently.

If a process crashes while holding .local/project-state.write.lock, the next write fails closed. Stop and verify the owner process, inspect the snapshot, and remove only that stale lock manually before restarting. Locks are never stolen automatically. Snapshot rename provides transaction atomicity; no claim of power-loss durability is made.

Read-only commands:

```text
npm run reconcile:canonical -- --dry-run --actor "Named operator"
npm run verify:reconciliation -- --before <reviewed-before-snapshot> --after <applied-snapshot> --plan <reviewed-plan.json>
```

Both emit stdout only. Saving a new report is a separate explicit action. The post-reconciliation verifier checks the complete before/after transformation, including untouched unknown fields, prior audit history, approvals and unrelated projects. It does not replace or relax scripts/verifySelfBootstrapExecution.ts.

Retained DMK-192 evidence: exact reviewed dry-run report, retained manifest-validation report, current pure manifest integrity checks and canonical WBS evidence/provenance. Retained DMK-193 evidence: exact execution review, semantic invariants in the execution verification report, its published LF-text digest, raw-byte review binding and WBS human-ceremony provenance. The execution JSON is currently CRLF; its published LF digest is retained verbatim. No historical evidence or historical expected hash is regenerated.

WorkItem updates use server validation and existing human authentication for VERIFIED/APPROVED/RELEASED. Rejection propagates to the UI; the drawer derives values from canonical props. Successful status/checklist changes persist with audit and increment the target stateVersion. Concurrent mutating HTTP requests fail with retryable 409 rather than sharing rollback state.

Stage A verification and the exact live dry-run are recorded separately in docs/07_verification/BATCH_A_RECONCILIATION_REVIEW.md. Before historical apply, allocate WBS ownership, review a fresh proposal with the named operator, explicitly authorize that exact digest, preserve the reviewed before snapshot, then run the separate verifier and retain new evidence. Do not execute the historical apply as part of Stage A.
