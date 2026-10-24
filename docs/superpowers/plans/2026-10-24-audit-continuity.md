# Package 6 offline audit continuity implementation plan

> Execute this isolated lane under the operator's ACCEL-20261024 delegation. Routine human review is HUMAN_REVIEW_WAIVED_BY_OPERATOR. Root is sole integrator; no shared core, schema, authority enrollment or valuable-data activation is authorized in this lane.

**Goal:** Implement an evidence-preserving, bounded offline successor staging and anchor-CAS recovery protocol with real SQLite/filesystem fault tests.

**Architecture:** An admitted original readonly ext4 schema-1 image becomes an exact retained segment. Every staged successor contains the complete bounded segment inventory, an exact replay index, copied state/revocation material, an empty active-session set, advanced epoch/generation and a genesis bound to the seal. A separate challenge-bound Ed25519 anchor interface governs monotonic currentness/CAS; no production anchor provider/bootstrap is supplied. A private SQLite phase journal records PREPARING → PREPARED → COMMIT_CONFIRMED → FINALIZED. Files/directories are flushed before external CAS. Lost acknowledgments reconcile by exact transition and intent hashes; no silent retry/rollback.

**Tech stack:** Existing Node 22.23.3+, better-sqlite3 13.0.3 / SQLite 3.53.4; plain CJS modules plus existing TypeScript test conventions. No dependency or existing workspace-schema change.

**Spec:** ACCEL-20261024 package 6; AUDIT-CONTINUITY-01 at e026f5a; DMK-120 linked CAPACITY-FOLLOWUP-01 extension, REQ-OPS-001 / REQ-SEC-014. Read complete mandate and historical proposal before planning. Historical NOT_AUTHORIZED planning labels are superseded only for delegated engineering, not absent real custody/production authority.

## Delivered baseline and residual criteria

- Baseline 3e314f93e6053b5f90253e8a02c85168ffa34a80 / PR88 remains unchanged on its branch. It supplies read-only original schema-1 admission and complete capacity/image validation. Existing store/backup behavior and full-4096 refusal remain.
- This lane delivers complete retained image bytes, append-only manifest lineage, bounded exact replay inventory/query, staged state/revocation/session fences, signed-anchor challenge/CAS verification, local durable phase ordering, lost-ack reconciliation, and synthetic process/I/O/concurrency tests.
- Runtime startup/write/session/replay hooks and schema-2 adapters are owned by root and remain INCOMPLETE. v1/v2 activation adapters are unsupported here. No successful API result activates a workspace.
- Independent custody/root bootstrap, real signer appointment, current-anchor acquisition, physical power-loss guarantees, Windows durability, privileged/root/backing-device adversaries and maximum-size performance remain BLOCKED/NOT_RUN unless actually qualified.

## File ownership and interfaces

Create only:
- server/security/workspaceAccess/continuity/contracts.cjs: exact formats, canonical serialization/digests, immutable bounds and sanitized errors.
- server/security/workspaceAccess/continuity/anchor.cjs: configured-key Ed25519 receipt verification and bounded observe/CAS/resolve calls, fresh random challenge and expiry/revocation/scope checks.
- server/security/workspaceAccess/continuity/verify.cjs: private filesystem admission; complete segment/manifest/index/successor verification; exact replay query. Consumes existing pure capacityImage parser; no normal store open.
- server/security/workspaceAccess/continuity/stage.cjs: prepareTransition, commitTransition, recoverTransition and append-only local phase journal. Consumes injected anchor interface, never provisions trust.
- scripts/testWorkspaceAuditContinuity.ts: discovery-compatible pure/synthetic anchor and unsupported-input checks.
- scripts/fixtures/auditContinuitySynthetic.cjs: visibly synthetic Ed25519 signer backed by genuine SQLite CAS/currentness journal; fixture-only.
- scripts/fixtures/auditContinuityQualification.cjs and auditContinuityFaultProbe.cjs: real native/file lifecycle, lost acknowledgments, fault boundaries, concurrency and source invariance assertions.
- scripts/fixtures/qualifyAuditContinuity.sh: explicit root fixture launcher, always private mount namespace; own new source/output images and unprivileged observer.
- docs/07_verification/AUDIT_CONTINUITY_ACCEL_20261024.md: exact results, limitations, resumable handoff and delegated decisions.

No existing core/inspector/workflow file edits. A dedicated CI workflow may be proposed separately after local qualification.

Public shape: async prepareTransition({sourceWorkspace,destinationBase,transitionId,priorStage?}, anchorClient, trustPolicy) -> staged receipt; commitTransition(stagePath,anchorClient,trustPolicy), recoverTransition(...) -> durable protocol receipt with activated:false and runtimeContinuityComplete:false. verifyStage(stagePath,trustPolicy) returns bounded verified artifacts; lookupReplay(stagePath,kind,value,trustPolicy) reports seen/not-seen-in-verified-sealed-history only, never authorization. AnchorClient consumes fresh nonce, lineage/expected revision/current pointer and exact intent/transition hash for observe/compareAndSwap/resolve. Synthetic keys/providers are identified as SYNTHETIC_ONLY.

## Delegated decisions and constraints

P6-D01 (2026-10-24 Asia/Taipei, Codex, OPERATOR_DELEGATED_DECISION): implement the anchored append-only direction as a staged protocol, not a second live application authority. A successful cryptographic response proves consistency against the configured key; it does not appoint that key or prove independent operational custody.

P6-D02: output only new continuity-UUID children of an already current-owner private .security-backups base, retaining existing private HTTP/Vite perimeter behavior. Sealed files are byte-identical originals; successor.sqlite has distinct CONTINUITY_SUCCESSOR/1 schema and is never placed at .security/authority.sqlite.

P6-D03: caps are 8 sealed segments, 256 MiB each, existing 4,096 entries per segment, 16 MiB replay index, 64 MiB snapshot, bounded manifests/journal and 16 MiB free-space reserve. Complete index includes all operations and used digests; schema-1 historical body hashes stay null. Bounds stop new staging without pruning, truncation or higher runtime ceilings. Bound verification by count/bytes/time; no unlimited per-request history scan is promised.

P6-D04: retain principals, credential revisions/disabled flags, membership DENY/policy and snapshot bytes from the exact anchored source; successor has no active sessions, strictly greater epoch/generation and an explicit fresh-service-key requirement. Concurrent revocation/source/pointer change invalidates CAS.

P6-D05: flush data/index/seal/successor/manifest plus directory before PREPARED; durable external CAS precedes local COMMIT_CONFIRMED and FINALIZED. Unknown remote result remains unavailable until signed exact-intent resolution. Before cutover, cancelling local work does not prove predecessor currentness; after cutover, only forward recovery is allowed. Never delete incomplete artifacts or reactivate predecessor.

## Review focus

1. A hash-valid complete local chain without a fresh trusted current pointer cannot commit or grant authority.
2. Index corruption/missing segment/duplicate replay identifier must never become “not seen.”
3. A crash after remote CAS but before local receipt cannot create a second successor or lose the committed outcome.
4. Concurrent credential/revocation changes and old session/digest reuse must fail current CAS/fences.
5. Partial writes/fsync/disk-full/permissions must retain source/history and withhold completion; process-crash tests are not physical power-loss proof.

## Task sequence

- [ ] Write API/receipt/replay acceptance assertions and observe expected missing-feature failure.
- [ ] Implement exact format and signed-anchor verification with actual SQLite synthetic anchor: nonce, wrong/revoked signer, stale/future receipt, competing CAS, idempotent exact intent and changed-body rejection.
- [ ] Implement complete readonly image staging, exact index/state/genesis verification and immutable manifest lineage. Test 4094/4095/4096 across all three histories, bounds, tamper, missing/truncated/reordered history, privacy and no old-session admission.
- [ ] Implement phase journal, commit/resolve/recovery and controlled faults before/after durable preparation, anchor commit, local commit and acknowledgement. Preserve all failures/artifacts and original bytes.
- [ ] Execute Linux native/private-ext4 qualification; run relevant prior inspector tests and typecheck without competing with reserved Windows heavy work. Propose dedicated hosted CI if needed.
- [ ] Perform separate adversarial code/evidence self-review; document actual residual gaps; sign focused commits and publish draft only when instructed. Root owns all integration.

## Interruption ledger

- Source branch codex/accel-audit-continuity-20261024, clean base 3e314f9; PR88 branch remains at that commit.
- First interrupted pass read the mandate/proposal and created the branch only. No implementation existed.
- Parent approved the new-module staging/anchor-CAS scope and required no implicit trust, no shared core edits, capped complete indexing and honest runtime-incomplete status.
