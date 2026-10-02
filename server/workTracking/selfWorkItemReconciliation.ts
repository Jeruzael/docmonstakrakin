import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { WorkItem, Project, AuditEvent } from '../../src/types.ts';
import { ProjectStore } from '../projectStore.ts';
import {
  readProjectSnapshot,
  hydrateProjectStoreFromSnapshot,
  snapshotProjectStore,
  writeProjectSnapshotAtomic,
  projectSnapshotDigest,
  type ProjectStateSnapshot,
} from '../projectPersistence.ts';
import {
  getScopedCanonicalWbsItems,
  computeMasterWbsSha256,
  readCanonicalWbs,
  parseCanonicalWbsBytes,
  type CanonicalWbsItem,
} from './canonicalWbs.ts';
import {
  mapCanonicalStatus,
  mapCanonicalType,
  mapCanonicalPriority,
  mapCanonicalRisk,
} from './wbsMapping.ts';
import { canonicalizeJson } from '../../src/data/selfBootstrapContract.ts';
import { sanitizeAndHashAudit } from '../security/sanitizedAudit.ts';
import { verifyAuditLedgerChain, GENESIS_AUDIT_HASH } from '../security/auditImmutability.ts';

export const PLAN_FORMAT_VERSION = 'DMK_SELF_WBS_SYNC_V2' as const;
export type PlanFormatVersion = typeof PLAN_FORMAT_VERSION;

export type ReconciliationCategory =
  | 'SYNCED'
  | 'MISSING_RUNTIME'
  | 'STATUS_DRIFT'
  | 'METADATA_DRIFT'
  | 'STATUS_AND_METADATA_DRIFT'
  | 'RUNTIME_ONLY'
  | 'BLOCKED';

export type ReconciliationAction =
  | 'NOOP'
  | 'CREATE'
  | 'UPDATE_STATUS'
  | 'UPDATE_METADATA'
  | 'UPDATE_STATUS_AND_METADATA'
  | 'BLOCKED'
  | 'WARN_RUNTIME_ONLY';

export interface WorkItemSyncRow {
  id: string;
  wbsPath?: string;
  title: string;
  canonicalStatus?: string;
  runtimeStatus?: string;
  canonicalType?: string;
  runtimeType?: string;
  category: ReconciliationCategory;
  differences?: ('STATUS_DRIFT' | 'METADATA_DRIFT')[];
  action: ReconciliationAction;
  details?: string;
  proposedResult?: string;
}

export interface ReconciliationSummary {
  canonicalItems: number;
  runtimeItems: number;
  synced: number;
  missingRuntime: number;
  statusDrift: number;
  metadataDrift: number;
  runtimeOnly: number;
  blocked: number;
}

export interface WorkItemUpdateDiff {
  id: string;
  before: Partial<WorkItem>;
  after: Partial<WorkItem>;
}

export interface ReconciliationPlan {
  formatVersion: 'DMK_SELF_WBS_SYNC_V2';
  planId: string;
  operationId: string;
  projectId: 'PRJ-DOCMONSTAKRAKIN';
  scope: 'EPIC-13';
  actor: string;
  timestamp: string;
  wbsSha256: string;
  beforeSnapshotSha256: string;
  stateVersion: number;
  auditCount: number;
  summary: ReconciliationSummary;
  rows: WorkItemSyncRow[];
  proposedCreations: WorkItem[];
  proposedUpdates: WorkItemUpdateDiff[];
  runtimeOnlyWarnings: string[];
  blockedReasons: Record<string, string>;
  auditEvent: AuditEvent | null;
  candidateSnapshotDigest: string;
  planDigest: string;
}

export interface ApplyReconciliationResult {
  status: 'APPLIED' | 'ALREADY_APPLIED' | 'ALREADY_SYNCHRONIZED';
  mutationCount: 0 | 1;
  newStateVersion: number;
  auditEventId?: string;
  newSnapshotSha256: string;
}

/**
 * Computes a SHA-256 digest over recursively canonicalized JSON.
 */
export function digestCanonical(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalizeJson(value)).digest('hex');
}

/**
 * Serializes a ProjectStateSnapshot in the canonical on-disk representation.
 */
export function serializeSnapshot(snapshot: ProjectStateSnapshot): string {
  return JSON.stringify(snapshot, null, 2) + '\n';
}

/**
 * Validates reviewer actor identity.
 */
export function validateActor(actor: string): void {
  if (!actor || typeof actor !== 'string') {
    throw new Error('INVALID_REVIEW_ACTOR: Actor must be a non-empty string');
  }
  const trimmed = actor.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new Error('INVALID_REVIEW_ACTOR: Actor length must be between 2 and 100 characters');
  }
  if (!/^[A-Za-z0-9\s()._-]+$/.test(trimmed)) {
    throw new Error(`INVALID_REVIEW_ACTOR: Actor "${trimmed}" contains invalid characters`);
  }
}

/**
 * Validates ISO-8601 review timestamp.
 */
export function validateTimestamp(timestamp: string): void {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new Error('INVALID_REVIEW_TIMESTAMP: Timestamp must be a non-empty string');
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime()) || d.toISOString() !== timestamp) {
    throw new Error(
      `INVALID_REVIEW_TIMESTAMP: Timestamp "${timestamp}" must be a valid ISO-8601 string that round-trips through Date.toISOString()`
    );
  }
}

/**
 * Computes a deterministic recursive canonical plan digest.
 */
export function computePlanDigest(planPayload: Record<string, any>): string {
  const clone = { ...planPayload };
  delete clone.planDigest;
  return digestCanonical(clone);
}

/**
 * Verifies verification provenance for VERIFIED canonical items.
 * Fails closed on missing or pending human approvals.
 */
export function hasValidVerificationProvenance(item: CanonicalWbsItem): boolean {
  if (item.status !== 'VERIFIED') return true;

  const verifiedBy = item.verifiedBy?.trim() ?? '';
  const verificationStatus = item.verificationStatus?.trim().toUpperCase() ?? '';
  const humanApproval = item.humanApprovedBy?.trim() ?? '';

  const hasCompletedHumanApproval =
    humanApproval.length > 0 &&
    !/\bPENDING\b/i.test(humanApproval);

  return (
    verifiedBy.length > 0 &&
    verificationStatus === 'VERIFIED' &&
    hasCompletedHumanApproval &&
    Array.isArray(item.evidence) &&
    item.evidence.length > 0
  );
}

/**
 * Pure projection function for self-workitem reconciliation.
 * Given snapshot bytes, WBS bytes, actor, and timestamp, returns the exact
 * deterministic plan and anticipated candidate snapshot without any mutations.
 */
export function projectSelfWorkItemReconciliation(params: {
  workspaceRoot?: string;
  wbsBytes?: Buffer;
  snapshotBytes?: Buffer;
  actor: string;
  timestamp: string;
}): { plan: ReconciliationPlan; candidate: ProjectStateSnapshot } {
  const root = params.workspaceRoot || process.cwd();
  validateActor(params.actor);
  validateTimestamp(params.timestamp);

  const actor = params.actor.trim();
  const timestamp = params.timestamp;

  // 1. Read / resolve snapshot bytes & digest
  let snapshot: ProjectStateSnapshot;
  let beforeSnapshotSha256: string;

  if (params.snapshotBytes) {
    beforeSnapshotSha256 = crypto.createHash('sha256').update(params.snapshotBytes).digest('hex');
    snapshot = JSON.parse(params.snapshotBytes.toString('utf8'));
  } else {
    const liveDigest = projectSnapshotDigest(root);
    if (!liveDigest) {
      throw new Error('Project snapshot (.local/project-state.json) not found');
    }
    beforeSnapshotSha256 = liveDigest;
    const snap = readProjectSnapshot(root);
    if (!snap) {
      throw new Error('Could not read project snapshot');
    }
    snapshot = snap;
  }

  const store = new ProjectStore();
  hydrateProjectStoreFromSnapshot(store, snapshot);

  const dmkProject = store.projects.find((p: Project) => p.id === 'PRJ-DOCMONSTAKRAKIN');
  if (!dmkProject) {
    throw new Error('Project PRJ-DOCMONSTAKRAKIN not found in snapshot');
  }

  const stateVersion = dmkProject.stateVersion;
  const existingAuditLogs = store.auditLogs['PRJ-DOCMONSTAKRAKIN'] || [];
  const auditCount = existingAuditLogs.length;

  // 2. Read / resolve WBS bytes & digest
  let wbsSha256: string;
  let scopedItems: CanonicalWbsItem[];

  if (params.wbsBytes) {
    const doc = parseCanonicalWbsBytes(params.wbsBytes);
    wbsSha256 = doc.rawSha256;
    scopedItems = doc.items.filter((i) => i.epic === 'EPIC-13' || i.parentId === 'EPIC-13');
  } else {
    const scoped = getScopedCanonicalWbsItems(root, 'EPIC-13');
    wbsSha256 = scoped.wbsSha256;
    scopedItems = scoped.scopedItems;
  }

  const runtimeItems: WorkItem[] = store.workItems['PRJ-DOCMONSTAKRAKIN'] || [];
  const runtimeMap = new Map<string, WorkItem>(runtimeItems.map((item) => [item.id, item]));

  const rows: WorkItemSyncRow[] = [];
  const proposedCreations: WorkItem[] = [];
  const proposedUpdates: WorkItemUpdateDiff[] = [];
  const runtimeOnlyWarnings: string[] = [];
  const blockedReasons: Record<string, string> = {};

  let syncedCount = 0;
  let missingCount = 0;
  let statusDriftCount = 0;
  let metadataDriftCount = 0;
  let blockedCount = 0;

  for (const cItem of scopedItems) {
    const rItem = runtimeMap.get(cItem.id);

    // Provenance validation for VERIFIED items
    if (cItem.status === 'VERIFIED' && !hasValidVerificationProvenance(cItem)) {
      blockedCount++;
      const reason = `Missing required canonical verification provenance for VERIFIED status (requires verified_by, verification_status, human_approved_by, evidence)`;
      blockedReasons[cItem.id] = reason;
      rows.push({
        id: cItem.id,
        wbsPath: cItem.wbsPath,
        title: cItem.title,
        canonicalStatus: cItem.status,
        runtimeStatus: rItem ? rItem.status : 'MISSING',
        canonicalType: cItem.type,
        runtimeType: rItem ? rItem.type : undefined,
        category: 'BLOCKED',
        action: 'BLOCKED',
        details: reason,
        proposedResult: 'BLOCKED: Require canonical verification evidence',
      });
      continue;
    }

    const mappedStatus = mapCanonicalStatus(cItem.status);
    const mappedType = mapCanonicalType(cItem.type);
    const mappedPriority = mapCanonicalPriority(cItem.priority);
    const mappedRisk = mapCanonicalRisk(cItem.risk);

    if (!rItem) {
      // Missing in runtime
      missingCount++;
      const newWorkItem: WorkItem = {
        id: cItem.id,
        parentEpicId: cItem.parentId || cItem.epic,
        type: mappedType,
        title: cItem.title,
        description: cItem.description,
        status: mappedStatus,
        priority: mappedPriority,
        risk: mappedRisk,
        sprint: 0,
        requirements: [...cItem.requirements],
        dependencies: [...cItem.dependencies],
        acceptanceCriteria: [...cItem.acceptanceCriteria],
        checklist: cItem.acceptanceCriteria.map((text) => ({ text, done: false })),
        tests: [],
        evidence: [...cItem.evidence],
        updatedAt: timestamp,
        canonicalManaged: true,
        canonicalWbsPath: cItem.wbsPath,
        canonicalWbsStatus: cItem.status,
        canonicalWbsType: cItem.type,
        canonicalSource: 'MASTER_WBS',
      };
      proposedCreations.push(newWorkItem);
      rows.push({
        id: cItem.id,
        wbsPath: cItem.wbsPath,
        title: cItem.title,
        canonicalStatus: cItem.status,
        runtimeStatus: 'MISSING',
        canonicalType: cItem.type,
        runtimeType: undefined,
        category: 'MISSING_RUNTIME',
        action: 'CREATE',
        details: `Create runtime WorkItem with mapped status ${mappedStatus}`,
        proposedResult: `CREATE → ${mappedStatus}`,
      });
      continue;
    }

    // Item exists: evaluate multi-dimensional drift
    const hasStatusDrift = rItem.status !== mappedStatus;
    const hasMetadataDrift =
      rItem.title !== cItem.title ||
      rItem.description !== cItem.description ||
      rItem.priority !== mappedPriority ||
      rItem.risk !== mappedRisk ||
      JSON.stringify(rItem.requirements.slice().sort()) !== JSON.stringify(cItem.requirements.slice().sort()) ||
      JSON.stringify(rItem.dependencies.slice().sort()) !== JSON.stringify(cItem.dependencies.slice().sort()) ||
      JSON.stringify(rItem.acceptanceCriteria) !== JSON.stringify(cItem.acceptanceCriteria) ||
      !rItem.canonicalManaged ||
      rItem.canonicalWbsStatus !== cItem.status ||
      rItem.canonicalWbsType !== cItem.type;

    const differences: ('STATUS_DRIFT' | 'METADATA_DRIFT')[] = [];
    if (hasStatusDrift) {
      differences.push('STATUS_DRIFT');
      statusDriftCount++;
    }
    if (hasMetadataDrift) {
      differences.push('METADATA_DRIFT');
      metadataDriftCount++;
    }

    if (differences.length > 0) {
      const isBoth = hasStatusDrift && hasMetadataDrift;
      const cat: ReconciliationCategory = isBoth
        ? 'STATUS_AND_METADATA_DRIFT'
        : hasStatusDrift
        ? 'STATUS_DRIFT'
        : 'METADATA_DRIFT';
      const act: ReconciliationAction = isBoth
        ? 'UPDATE_STATUS_AND_METADATA'
        : hasStatusDrift
        ? 'UPDATE_STATUS'
        : 'UPDATE_METADATA';

      const updateDiff: WorkItemUpdateDiff = {
        id: cItem.id,
        before: {
          status: rItem.status,
          title: rItem.title,
          priority: rItem.priority,
          risk: rItem.risk,
          canonicalWbsStatus: rItem.canonicalWbsStatus,
          canonicalManaged: rItem.canonicalManaged,
        },
        after: {
          status: mappedStatus,
          title: cItem.title,
          description: cItem.description,
          priority: mappedPriority,
          risk: mappedRisk,
          requirements: [...cItem.requirements],
          dependencies: [...cItem.dependencies],
          acceptanceCriteria: [...cItem.acceptanceCriteria],
          evidence: Array.from(new Set([...rItem.evidence, ...cItem.evidence])),
          canonicalManaged: true,
          canonicalWbsPath: cItem.wbsPath,
          canonicalWbsStatus: cItem.status,
          canonicalWbsType: cItem.type,
          canonicalSource: 'MASTER_WBS',
          updatedAt: timestamp,
        },
      };
      proposedUpdates.push(updateDiff);
      rows.push({
        id: cItem.id,
        wbsPath: cItem.wbsPath,
        title: cItem.title,
        canonicalStatus: cItem.status,
        runtimeStatus: rItem.status,
        canonicalType: cItem.type,
        runtimeType: rItem.type,
        category: cat,
        differences,
        action: act,
        details: isBoth
          ? `Runtime status and canonical metadata both drift from WBS`
          : hasStatusDrift
          ? `Runtime status "${rItem.status}" drifts from canonical "${cItem.status}" (mapped: "${mappedStatus}")`
          : 'Canonical metadata attributes differ from runtime state',
        proposedResult: isBoth
          ? `STATUS & METADATA → ${mappedStatus}`
          : hasStatusDrift
          ? `STATUS → ${mappedStatus}`
          : 'METADATA_UPDATE',
      });
    } else {
      syncedCount++;
      rows.push({
        id: cItem.id,
        wbsPath: cItem.wbsPath,
        title: cItem.title,
        canonicalStatus: cItem.status,
        runtimeStatus: rItem.status,
        canonicalType: cItem.type,
        runtimeType: rItem.type,
        category: 'SYNCED',
        action: 'NOOP',
        details: 'Canonical WBS and runtime WorkItem are synchronized',
        proposedResult: 'SYNCED',
      });
    }
  }

  // Runtime only detection
  const canonicalIdSet = new Set(scopedItems.map((c) => c.id));
  let runtimeOnlyCount = 0;
  for (const rItem of runtimeItems) {
    if (!canonicalIdSet.has(rItem.id)) {
      runtimeOnlyCount++;
      const warning = `Runtime item "${rItem.id}" ("${rItem.title}") is not in scoped canonical WBS EPIC-13; preserved untouched.`;
      runtimeOnlyWarnings.push(warning);
      rows.push({
        id: rItem.id,
        title: rItem.title,
        runtimeStatus: rItem.status,
        runtimeType: rItem.type,
        category: 'RUNTIME_ONLY',
        action: 'WARN_RUNTIME_ONLY',
        details: warning,
        proposedResult: 'PRESERVED (No mutation)',
      });
    }
  }

  const summary: ReconciliationSummary = {
    canonicalItems: scopedItems.length,
    runtimeItems: runtimeItems.length,
    synced: syncedCount,
    missingRuntime: missingCount,
    statusDrift: statusDriftCount,
    metadataDrift: metadataDriftCount,
    runtimeOnly: runtimeOnlyCount,
    blocked: blockedCount,
  };

  const reviewCore = {
    formatVersion: PLAN_FORMAT_VERSION,
    projectId: 'PRJ-DOCMONSTAKRAKIN' as const,
    scope: 'EPIC-13' as const,
    actor,
    timestamp,
    wbsSha256,
    beforeSnapshotSha256,
    stateVersion,
    auditCount,
    summary,
    rows,
    proposedCreations,
    proposedUpdates,
    runtimeOnlyWarnings,
    blockedReasons,
  };

  const operationId = digestCanonical(reviewCore);
  const planId = `PLAN-WBS-SYNC-${operationId.slice(0, 16).toUpperCase()}`;

  // Deterministic candidate construction
  const candidateStore = new ProjectStore();
  hydrateProjectStoreFromSnapshot(candidateStore, snapshot);
  const candidateDmk = candidateStore.projects.find((p) => p.id === 'PRJ-DOCMONSTAKRAKIN')!;

  const targetWorkItems = [...(candidateStore.workItems['PRJ-DOCMONSTAKRAKIN'] || [])];
  for (const created of proposedCreations) {
    targetWorkItems.push(structuredClone(created));
  }
  for (const update of proposedUpdates) {
    const idx = targetWorkItems.findIndex((w) => w.id === update.id);
    if (idx !== -1) {
      targetWorkItems[idx] = { ...targetWorkItems[idx], ...update.after };
    }
  }
  candidateStore.workItems['PRJ-DOCMONSTAKRAKIN'] = targetWorkItems;

  let auditEvent: AuditEvent | null = null;
  const hasChanges = proposedCreations.length > 0 || proposedUpdates.length > 0;
  if (hasChanges) {
    candidateDmk.stateVersion += 1;
    const existingLogs = candidateStore.auditLogs['PRJ-DOCMONSTAKRAKIN'] || [];
    const previousHash = existingLogs[0]?.stateHash ?? GENESIS_AUDIT_HASH;
    auditEvent = sanitizeAndHashAudit({
      id: `AUD-WBS-${operationId.slice(0, 16).toUpperCase()}`,
      actor,
      timestamp,
      action: 'WORK_ITEMS_WBS_SYNCHRONIZED',
      target: 'PRJ-DOCMONSTAKRAKIN',
      reason: 'Reconcile canonical WBS EPIC-13 items to PRJ-DOCMONSTAKRAKIN runtime WorkItems',
      previousHash,
      stateHash: '',
      details: {
        operationId,
        wbsDigest: wbsSha256,
        beforeSnapshotDigest: beforeSnapshotSha256,
        scope: 'EPIC-13',
        counts: summary,
        createdIds: proposedCreations.map((c) => c.id),
        updatedIds: proposedUpdates.map((u) => u.id),
        runtimeOnlyWarnings,
      },
    });
    candidateStore.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [auditEvent, ...existingLogs];
  }

  const candidateSnapshot = snapshotProjectStore(candidateStore);
  const candidateSerialized = serializeSnapshot(candidateSnapshot);
  const candidateSnapshotDigest = crypto
    .createHash('sha256')
    .update(candidateSerialized)
    .digest('hex');

  const sealedWithoutPlanDigest = {
    ...reviewCore,
    operationId,
    planId,
    auditEvent,
    candidateSnapshotDigest,
  };

  const planDigest = digestCanonical(sealedWithoutPlanDigest);
  const plan: ReconciliationPlan = {
    ...sealedWithoutPlanDigest,
    planDigest,
  };

  return {
    plan,
    candidate: candidateSnapshot,
  };
}

/**
 * Generates a dry-run reconciliation plan between canonical WBS and runtime WorkItems.
 * Performs ZERO writes. Requires an explicit reviewed actor identity.
 */
export function generateReconciliationPlan(params: {
  workspaceRoot?: string;
  projectId?: string;
  actor: string;
  timestamp?: string;
}): ReconciliationPlan {
  const root = params.workspaceRoot || process.cwd();
  const projectId = (params.projectId || 'PRJ-DOCMONSTAKRAKIN') as 'PRJ-DOCMONSTAKRAKIN';
  if (projectId !== 'PRJ-DOCMONSTAKRAKIN') {
    throw new Error(`Self-project reconciliation is only supported for PRJ-DOCMONSTAKRAKIN; received "${projectId}"`);
  }

  validateActor(params.actor);
  const actor = params.actor.trim();
  const timestamp = params.timestamp || new Date().toISOString();

  const result = projectSelfWorkItemReconciliation({
    workspaceRoot: root,
    actor,
    timestamp,
  });

  return result.plan;
}

/**
 * Applies a previously reviewed reconciliation plan atomically.
 * Enforces strict V2 validation, exact candidate equality, anti-TOCTOU guards,
 * and true idempotent replay.
 */
export function applyReconciliationPlan(params: {
  workspaceRoot?: string;
  plan: ReconciliationPlan;
  actor?: string;
  confirmProjectId: string;
  confirmPlanDigest: string;
  hooks?: { beforeRename?: () => void };
}): ApplyReconciliationResult {
  const root = params.workspaceRoot || process.cwd();

  // 1. Authorization checks
  if (process.env.DMK_WBS_SYNC_EXECUTE !== 'PRJ-DOCMONSTAKRAKIN') {
    throw new Error(
      'UNAUTHORIZED_SYNC_EXECUTION: Environment variable DMK_WBS_SYNC_EXECUTE=PRJ-DOCMONSTAKRAKIN is required to apply synchronization'
    );
  }

  // 2. Format version validation (reject V1 plans)
  if (params.plan.formatVersion !== PLAN_FORMAT_VERSION) {
    throw new Error(
      `UNSUPPORTED_RECONCILIATION_PLAN_VERSION: Expected ${PLAN_FORMAT_VERSION}, got "${params.plan.formatVersion || 'unknown'}"`
    );
  }

  // 3. Project confirmation
  if (params.confirmProjectId !== 'PRJ-DOCMONSTAKRAKIN' || params.plan.projectId !== 'PRJ-DOCMONSTAKRAKIN') {
    throw new Error(`INVALID_PROJECT_CONFIRMATION: Expected PRJ-DOCMONSTAKRAKIN, received "${params.confirmProjectId}"`);
  }

  // 4. Plan confirmation digest
  if (params.confirmPlanDigest !== params.plan.planDigest) {
    throw new Error('PLAN_DIGEST_MISMATCH: Confirmation digest does not match reviewed plan digest');
  }

  // 5. Verify plan's own recursive canonical digest
  const expectedPlanDigest = computePlanDigest(params.plan);
  if (params.plan.planDigest !== expectedPlanDigest) {
    throw new Error('TAMPERED_PLAN: Plan digest mismatch against recursively canonicalized plan payload');
  }

  // 6. Actor binding: Apply actor cannot differ from reviewed plan actor
  if (params.actor && params.actor.trim() !== params.plan.actor.trim()) {
    throw new Error(
      `APPLY_ACTOR_MISMATCH: Provided actor "${params.actor}" does not match reviewed plan actor "${params.plan.actor}"`
    );
  }

  // 7. Blocked items rejection
  if (params.plan.summary.blocked > 0) {
    throw new Error(
      `RECONCILIATION_BLOCKED_ITEMS_PRESENT: Plan contains ${params.plan.summary.blocked} blocked item(s): ${Object.keys(
        params.plan.blockedReasons
      ).join(', ')}`
    );
  }

  // 8. Pre-check current WBS hash
  const currentWbsSha256 = computeMasterWbsSha256(root);
  if (currentWbsSha256 !== params.plan.wbsSha256) {
    throw new Error('WBS_TOCTOU_MISMATCH: MASTER_WBS.yaml has changed since plan generation; re-run dry-run');
  }

  // 9. Inspect current snapshot hash
  const currentSnapshotSha256 = projectSnapshotDigest(root);

  // CASE A: Already synchronized (no changes proposed in plan)
  if (
    params.plan.proposedCreations.length === 0 &&
    params.plan.proposedUpdates.length === 0
  ) {
    const snapshot = readProjectSnapshot(root);
    if (!snapshot) {
      throw new Error('Could not read project snapshot');
    }
    const dmkProject = snapshot.state?.projects?.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');
    return {
      status: 'ALREADY_SYNCHRONIZED',
      mutationCount: 0,
      newStateVersion: dmkProject.stateVersion,
      auditEventId: undefined,
      newSnapshotSha256: currentSnapshotSha256,
    };
  }

  // CASE B: Idempotent Retry — Plan with changes was already applied
  if (currentSnapshotSha256 === params.plan.candidateSnapshotDigest) {
    const snapshot = readProjectSnapshot(root);
    if (!snapshot) {
      throw new Error('Could not read project snapshot');
    }
    const dmkProject = snapshot.state?.projects?.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');
    const auditLogs = snapshot.state?.auditLogs?.['PRJ-DOCMONSTAKRAKIN'] || [];
    const chainCheck = verifyAuditLedgerChain(auditLogs, 'REVERSE_CHRONOLOGICAL');
    if (!chainCheck.valid) {
      throw new Error(`IDEMPOTENT_VERIFICATION_FAILED: Existing audit chain is invalid: ${chainCheck.error}`);
    }

    if (params.plan.auditEvent) {
      const matchingEvents = auditLogs.filter((a: any) => a.id === params.plan.auditEvent!.id);
      if (matchingEvents.length !== 1) {
        throw new Error(
          `IDEMPOTENT_VERIFICATION_FAILED: Expected audit event ${params.plan.auditEvent.id} to exist exactly once, found ${matchingEvents.length}`
        );
      }
      if (matchingEvents[0].stateHash !== params.plan.auditEvent.stateHash) {
        throw new Error('IDEMPOTENT_VERIFICATION_FAILED: Audit event stateHash mismatch');
      }
    }

    return {
      status: 'ALREADY_APPLIED',
      mutationCount: 0,
      newStateVersion: dmkProject.stateVersion,
      auditEventId: params.plan.auditEvent?.id,
      newSnapshotSha256: currentSnapshotSha256,
    };
  }

  // CASE C: Normal Apply — Snapshot matches beforeSnapshotSha256
  if (currentSnapshotSha256 === params.plan.beforeSnapshotSha256) {
    // Recompute projection using current state
    const recomputed = projectSelfWorkItemReconciliation({
      workspaceRoot: root,
      actor: params.plan.actor,
      timestamp: params.plan.timestamp,
    });

    if (
      recomputed.plan.planDigest !== params.plan.planDigest ||
      recomputed.plan.candidateSnapshotDigest !== params.plan.candidateSnapshotDigest ||
      recomputed.plan.operationId !== params.plan.operationId
    ) {
      throw new Error('TAMPERED_PLAN: Recomputed reconciliation projection diverges from reviewed plan');
    }

    // Atomic write with pre-rename WBS anti-TOCTOU validation
    const newSnapshotSha256 = writeProjectSnapshotAtomic(recomputed.candidate, root, {
      expectedDigest: params.plan.beforeSnapshotSha256,
      beforeRename: () => {
        if (params.hooks?.beforeRename) {
          params.hooks.beforeRename();
        }
        const preRenameWbsSha = computeMasterWbsSha256(root);
        if (preRenameWbsSha !== params.plan.wbsSha256) {
          throw new Error(
            `WBS_TOCTOU_MISMATCH: MASTER_WBS.yaml changed before commit (expected ${params.plan.wbsSha256}, got ${preRenameWbsSha})`
          );
        }
      },
    });

    const candidateDmk = recomputed.candidate.state.projects.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN')!;

    return {
      status: 'APPLIED',
      mutationCount: 1,
      newStateVersion: candidateDmk.stateVersion,
      auditEventId: params.plan.auditEvent?.id,
      newSnapshotSha256,
    };
  }

  // CASE D: Stale snapshot
  throw new Error('STALE_SNAPSHOT: Current snapshot SHA does not match plan beforeSnapshotSha256 or candidateSnapshotDigest');
}
