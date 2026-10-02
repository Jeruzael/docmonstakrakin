import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { WorkItem, Project } from '../../src/types.ts';
import { ProjectStore } from '../projectStore.ts';
import {
  readProjectSnapshot,
  hydrateProjectStoreFromSnapshot,
  snapshotProjectStore,
  writeProjectSnapshotAtomic,
  projectSnapshotDigest,
} from '../projectPersistence.ts';
import {
  getScopedCanonicalWbsItems,
  computeMasterWbsSha256,
  type CanonicalWbsItem,
} from './canonicalWbs.ts';
import {
  mapCanonicalStatus,
  mapCanonicalType,
  mapCanonicalPriority,
  mapCanonicalRisk,
} from './wbsMapping.ts';

export type ReconciliationCategory =
  | 'SYNCED'
  | 'MISSING_RUNTIME'
  | 'STATUS_DRIFT'
  | 'METADATA_DRIFT'
  | 'RUNTIME_ONLY'
  | 'BLOCKED';

export type ReconciliationAction =
  | 'NOOP'
  | 'CREATE'
  | 'UPDATE_STATUS'
  | 'UPDATE_METADATA'
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
  formatVersion: 'DMK_SELF_WBS_SYNC_V1';
  planId: string;
  projectId: 'PRJ-DOCMONSTAKRAKIN';
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
  planDigest: string;
  candidateSnapshotDigest: string;
  auditEventPreview: {
    action: 'WORK_ITEMS_WBS_SYNCHRONIZED';
    target: 'PRJ-DOCMONSTAKRAKIN';
    reason: string;
    details: any;
  };
}

/**
 * Computes a deterministic SHA-256 digest of a plan object.
 */
export function computePlanDigest(planPayload: Record<string, any>): string {
  const clone = { ...planPayload };
  delete clone.planDigest;
  delete clone.candidateSnapshotDigest;
  const canonicalString = JSON.stringify(clone, Object.keys(clone).sort(), 2);
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Verifies verification provenance for VERIFIED canonical items.
 */
export function hasValidVerificationProvenance(item: CanonicalWbsItem): boolean {
  if (item.status !== 'VERIFIED') return true;
  return Boolean(
    item.verifiedBy &&
    item.verificationStatus &&
    item.humanApprovedBy &&
    Array.isArray(item.evidence) &&
    item.evidence.length > 0
  );
}

/**
 * Generates a dry-run reconciliation plan between canonical WBS and runtime WorkItems.
 * Performs ZERO writes.
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

  const timestamp = params.timestamp || new Date().toISOString();
  const beforeSnapshotSha256 = projectSnapshotDigest(root);
  if (!beforeSnapshotSha256) {
    throw new Error('Project snapshot (.local/project-state.json) not found');
  }

  const snapshot = readProjectSnapshot(root);
  if (!snapshot) {
    throw new Error('Could not read project snapshot');
  }

  const store = new ProjectStore();
  hydrateProjectStoreFromSnapshot(store, snapshot);

  const dmkProject = store.projects.find((p: Project) => p.id === projectId);
  if (!dmkProject) {
    throw new Error(`Project ${projectId} not found in snapshot`);
  }

  const stateVersion = dmkProject.stateVersion;
  const existingAuditLogs = store.auditLogs[projectId] || [];
  const auditCount = existingAuditLogs.length;

  const { wbsSha256, scopedItems } = getScopedCanonicalWbsItems(root, 'EPIC-13');
  const runtimeItems: WorkItem[] = store.workItems[projectId] || [];
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

  // Process all scoped canonical items
  for (const cItem of scopedItems) {
    const rItem = runtimeMap.get(cItem.id);

    // Provenance validation for VERIFIED items
    if (cItem.status === 'VERIFIED' && !hasValidVerificationProvenance(cItem)) {
      blockedCount++;
      blockedReasons[cItem.id] = 'Missing required canonical verification provenance for VERIFIED status (requires verified_by, verification_status, human_approved_by, evidence)';
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
        details: blockedReasons[cItem.id],
        proposedResult: 'BLOCKED: Require canonical verification evidence',
      });
      continue;
    }

    const mappedStatus = mapCanonicalStatus(cItem.status);
    const mappedType = mapCanonicalType(cItem.type);
    const mappedPriority = mapCanonicalPriority(cItem.priority);
    const mappedRisk = mapCanonicalRisk(cItem.risk);

    if (!rItem) {
      // MISSING_RUNTIME
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

    // Item exists in runtime: Check status and metadata drift
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

    if (hasStatusDrift) {
      statusDriftCount++;
      const updateDiff: WorkItemUpdateDiff = {
        id: cItem.id,
        before: {
          status: rItem.status,
          title: rItem.title,
          priority: rItem.priority,
          risk: rItem.risk,
          canonicalWbsStatus: rItem.canonicalWbsStatus,
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
        category: 'STATUS_DRIFT',
        action: 'UPDATE_STATUS',
        details: `Runtime status "${rItem.status}" drifts from canonical "${cItem.status}" (mapped: "${mappedStatus}")`,
        proposedResult: `STATUS → ${mappedStatus}`,
      });
    } else if (hasMetadataDrift) {
      metadataDriftCount++;
      const updateDiff: WorkItemUpdateDiff = {
        id: cItem.id,
        before: {
          title: rItem.title,
          priority: rItem.priority,
          risk: rItem.risk,
          canonicalManaged: rItem.canonicalManaged,
        },
        after: {
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
        category: 'METADATA_DRIFT',
        action: 'UPDATE_METADATA',
        details: 'Canonical metadata attributes differ from runtime state',
        proposedResult: 'METADATA_UPDATE',
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

  // Detect runtime-only items in PRJ-DOCMONSTAKRAKIN
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

  const planId = `PLAN-WBS-SYNC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const planPayloadWithoutDigests = {
    formatVersion: 'DMK_SELF_WBS_SYNC_V1' as const,
    planId,
    projectId,
    actor: params.actor,
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
    auditEventPreview: {
      action: 'WORK_ITEMS_WBS_SYNCHRONIZED' as const,
      target: projectId,
      reason: 'Reconcile canonical WBS EPIC-13 items to PRJ-DOCMONSTAKRAKIN runtime WorkItems',
      details: {
        wbsDigest: wbsSha256,
        beforeSnapshotDigest: beforeSnapshotSha256,
        counts: summary,
        createdIds: proposedCreations.map((c) => c.id),
        updatedIds: proposedUpdates.map((u) => u.id),
        runtimeOnlyWarnings,
      },
    },
  };

  const planDigest = computePlanDigest(planPayloadWithoutDigests);

  // Compute candidate snapshot digest in memory
  const candidateStore = new ProjectStore();
  hydrateProjectStoreFromSnapshot(candidateStore, snapshot);
  const candidateDmk = candidateStore.projects.find((p) => p.id === projectId)!;

  // Apply in candidate store
  const targetWorkItems = [...(candidateStore.workItems[projectId] || [])];
  for (const created of proposedCreations) {
    targetWorkItems.push(structuredClone(created));
  }
  for (const update of proposedUpdates) {
    const idx = targetWorkItems.findIndex((w) => w.id === update.id);
    if (idx !== -1) {
      targetWorkItems[idx] = { ...targetWorkItems[idx], ...update.after };
    }
  }
  candidateStore.workItems[projectId] = targetWorkItems;

  const hasChanges = proposedCreations.length > 0 || proposedUpdates.length > 0;
  if (hasChanges) {
    candidateDmk.stateVersion += 1;
    candidateStore.addAuditEvent(
      projectId,
      params.actor,
      'WORK_ITEMS_WBS_SYNCHRONIZED',
      projectId,
      'Reconcile canonical WBS EPIC-13 items to PRJ-DOCMONSTAKRAKIN runtime WorkItems',
      {
        planDigest,
        wbsDigest: wbsSha256,
        beforeSnapshotDigest: beforeSnapshotSha256,
        counts: summary,
        createdIds: proposedCreations.map((c) => c.id),
        updatedIds: proposedUpdates.map((u) => u.id),
        runtimeOnlyWarnings,
      }
    );
  }

  const candidateSnapshot = snapshotProjectStore(candidateStore);
  const candidateSnapshotDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify(candidateSnapshot, null, 2) + '\n')
    .digest('hex');

  return {
    ...planPayloadWithoutDigests,
    planDigest,
    candidateSnapshotDigest,
  };
}

/**
 * Applies a previously reviewed reconciliation plan atomically.
 * Fails closed on any TOCTOU divergence or missing authorization.
 */
export function applyReconciliationPlan(params: {
  workspaceRoot?: string;
  plan: ReconciliationPlan;
  actor: string;
  confirmProjectId: string;
  confirmPlanDigest: string;
}): {
  success: boolean;
  newStateVersion: number;
  auditEventId?: string;
  newSnapshotSha256: string;
} {
  const root = params.workspaceRoot || process.cwd();

  // 1. Authorization checks
  if (process.env.DMK_WBS_SYNC_EXECUTE !== 'PRJ-DOCMONSTAKRAKIN') {
    throw new Error('UNAUTHORIZED_SYNC_EXECUTION: Environment variable DMK_WBS_SYNC_EXECUTE=PRJ-DOCMONSTAKRAKIN is required to apply synchronization');
  }

  if (params.confirmProjectId !== 'PRJ-DOCMONSTAKRAKIN' || params.plan.projectId !== 'PRJ-DOCMONSTAKRAKIN') {
    throw new Error(`INVALID_PROJECT_CONFIRMATION: Expected PRJ-DOCMONSTAKRAKIN, received "${params.confirmProjectId}"`);
  }

  const expectedPlanDigest = computePlanDigest(params.plan);
  if (params.plan.planDigest !== expectedPlanDigest) {
    throw new Error('TAMPERED_PLAN: Plan digest mismatch against calculated digest');
  }

  if (params.confirmPlanDigest !== params.plan.planDigest) {
    throw new Error(`PLAN_DIGEST_MISMATCH: Confirmation digest does not match reviewed plan digest`);
  }

  // 2. Anti-TOCTOU validation: WBS and Snapshot hashes
  const currentWbsSha256 = computeMasterWbsSha256(root);
  if (currentWbsSha256 !== params.plan.wbsSha256) {
    throw new Error('WBS_TOCTOU_MISMATCH: MASTER_WBS.yaml has changed since plan generation; re-run dry-run');
  }

  const currentSnapshotSha256 = projectSnapshotDigest(root);
  if (currentSnapshotSha256 !== params.plan.beforeSnapshotSha256) {
    throw new Error('STALE_SNAPSHOT: .local/project-state.json has changed since plan generation; re-run dry-run');
  }

  // 3. Load snapshot and apply
  const snapshot = readProjectSnapshot(root);
  if (!snapshot) {
    throw new Error('Could not read project snapshot');
  }

  const store = new ProjectStore();
  hydrateProjectStoreFromSnapshot(store, snapshot);

  const dmkProject = store.projects.find((p: Project) => p.id === 'PRJ-DOCMONSTAKRAKIN');
  if (!dmkProject) {
    throw new Error('PRJ-DOCMONSTAKRAKIN not found in snapshot');
  }

  if (dmkProject.stateVersion !== params.plan.stateVersion) {
    throw new Error(`STATE_VERSION_MISMATCH: Expected stateVersion ${params.plan.stateVersion}, got ${dmkProject.stateVersion}`);
  }

  const targetWorkItems = [...(store.workItems['PRJ-DOCMONSTAKRAKIN'] || [])];

  for (const created of params.plan.proposedCreations) {
    targetWorkItems.push(structuredClone(created));
  }

  for (const update of params.plan.proposedUpdates) {
    const idx = targetWorkItems.findIndex((w) => w.id === update.id);
    if (idx !== -1) {
      targetWorkItems[idx] = { ...targetWorkItems[idx], ...update.after };
    }
  }

  store.workItems['PRJ-DOCMONSTAKRAKIN'] = targetWorkItems;

  const hasChanges = params.plan.proposedCreations.length > 0 || params.plan.proposedUpdates.length > 0;
  let auditEventId: string | undefined;

  if (hasChanges) {
    dmkProject.stateVersion += 1;
    const auditEvent = store.addAuditEvent(
      'PRJ-DOCMONSTAKRAKIN',
      params.actor,
      'WORK_ITEMS_WBS_SYNCHRONIZED',
      'PRJ-DOCMONSTAKRAKIN',
      'Reconcile canonical WBS EPIC-13 items to PRJ-DOCMONSTAKRAKIN runtime WorkItems',
      {
        planDigest: params.plan.planDigest,
        wbsDigest: params.plan.wbsSha256,
        beforeSnapshotDigest: params.plan.beforeSnapshotSha256,
        counts: params.plan.summary,
        createdIds: params.plan.proposedCreations.map((c) => c.id),
        updatedIds: params.plan.proposedUpdates.map((u) => u.id),
        runtimeOnlyWarnings: params.plan.runtimeOnlyWarnings,
      }
    );
    auditEventId = auditEvent.id;
  }

  const updatedSnapshot = snapshotProjectStore(store);

  // 4. Atomic write with exclusive lock and anti-TOCTOU guard
  const newSnapshotSha256 = writeProjectSnapshotAtomic(updatedSnapshot, root, {
    expectedDigest: params.plan.beforeSnapshotSha256,
  });

  return {
    success: true,
    newStateVersion: dmkProject.stateVersion,
    auditEventId,
    newSnapshotSha256,
  };
}
