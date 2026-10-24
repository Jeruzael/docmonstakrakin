# Package13 first slice — trusted prompt assets and operation-bound retrieval

Authority: ACCEL-20261024, OPERATOR_DELEGATED_DECISION; HUMAN_REVIEW_WAIVED_BY_OPERATOR. Basefec902620145e1526861b20c2c2400d198a1779d. Owners EXT-CAND-03/DMK-171/209. This component is developed before live adapter activation; it does not complete all package13 criteria or authorize a client.

## Exact files before implementation

- `src/data/initialData.ts`: extend the existing prompt-role catalog with a bounded task-read instruction asset, zero fictional run counts and no provider requirement. Existing templates retained.
- New `src/data/skillRegistry.ts`: pure published metadata/version/action mapping derived from that catalog. One registry, source-published versions/revocation, no user-imported asset admission or authority.
- New `server/skills/admission.ts`: bounded host-only HMAC retrieval receipts requiring fresh authenticated AGENT context. Description consultation precedes required content retrieval for the exact action/body/operation/revision/session/grant; action admission validates current registry/policy/expiry and context. Restart/close invalidates receipts. No permission decision or mutation here; the existing authority must independently recheck every actual operation.
- New `scripts/testTrustedSkillRegistry.ts` and `scripts/testSkillAdmission.ts`: source reuse, hash/version changes, revocation, no provider dependency, inert schemas, altered context, wrong actor/session/grant, expired/stale policy/revision, bootstrap ordering, restart and clock rollback denials.
- New `docs/07_verification/ACCEL_SKILL_ADMISSION_20261024.md`: actual red/green outcomes and limitations. HTTP/CLI/client integration is a subsequent separately described delta.

## Decisions and boundaries

Considered arbitrary runtime skills and unversioned once-per-install acknowledgment; rejected because neither gives current trusted instructions per operation. Select a bundled source-published registry extending existing prompt assets. Protected repository publication is the current asset trust channel; this is unrelated to independent WBS signer authority. No untrusted skill can choose capabilities or policy.

Fixed public protocol discovery may expose static metadata without project data. Authenticated bootstrap description/content retrieval is the explicit nonrecursive exemption: it needs a current agent session/grant, not a prior retrieval receipt. Every project operation still needs its applicable current description/content receipts plus independent worker authorization. Retrieval proves delivery only, never model understanding. Immutable content may be cached by digest but requires a new operation-bound consultation.

Initial operation is `task:read` with exact request schema1, UUID, project/task IDs and expected snapshot revision. Candidate receipt lifetime60seconds, at most4096 encoded characters and exact canonical fields; no project content, raw session token or credentials. Bounds are delegated development constraints, not operational capacity ratification. Actor, client, session, grant/revision, project/scope, policy/snapshot revision, exact request hash and registry/content versions bind the receipt. Missing, stale, revoked, wrong-body or wrong-context receipts deny. Local monotonic high-water rejects clock rollback; this is not authenticated external time acquisition.

Implementation adds inert candidate admission bounds(depth8,16384 nodes,1MiB aggregate strings/keys,128 assets/revocation IDs), deterministic field-order-independent scope binding and per-instance monotonic publication epochs/digests. Material publication changes need an increased epoch. These are local component constraints and do not establish durable currentness across deployment rollback. Existing catalog entries remain in original order; the new instruction is appended.

Receipts are an instruction-admission component, not durable operation consumption or result idempotency. The common authority/action layer must enforce operation identity, current authorization, exact result/replay and concurrency. No live adapter is claimed complete until those pieces and actual client qualification are integrated. HUMAN/manual compiler imports retain their own provenance and authority; this component cannot convert them into authenticated live-agent output.

Rollback before activation: remove the new adapter/component and catalog asset; no persisted project or authority migration occurs. After any later activation, key/registry version changes revoke outstanding retrieval receipts and clients must bootstrap again. All14 privileged denials, human quorum, original operator installation, canonical WBS, receipts, Gate7 and release restrictions remain.
