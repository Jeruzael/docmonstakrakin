import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ProjectStore } from '../projectStore.ts';
import {
  readProjectSnapshot,
  hydrateProjectStoreFromSnapshot,
  snapshotProjectStore,
  writeProjectSnapshotAtomic,
  resolveProjectStatePath,
  PROJECT_STATE_SCHEMA_VERSION,
  type WriteSnapshotAtomicOptions,
} from '../projectPersistence.ts';
import {
  verifySelfBootstrapIntegrity,
  type SelfBootstrapIntegrityResult,
} from './selfBootstrapIntegrity.ts';
import {
  canonicalizeJson,
  type SelfBootstrapManifest,
} from '../../src/data/selfBootstrapContract.ts';
import {
  GENESIS_AUDIT_HASH,
  computeAuditEventHash,
  verifyAuditLedgerChain,
} from '../security/auditImmutability.ts';
import { sanitizeAndHashAudit } from '../security/sanitizedAudit.ts';
import type { AuditEvent } from '../../src/types.ts';

export type SelfBootstrapStatus =
  | 'SAFE_TO_REVIEW'
  | 'EXECUTED'
  | 'INVALID_MANIFEST'
  | 'PROJECT_ALREADY_EXISTS'
  | 'INVALID_EXISTING_SNAPSHOT'
  | 'PRESERVATION_CHECK_FAILED'
  | 'AUDIT_VALIDATION_FAILED'
  | 'UNAUTHORIZED_EXECUTION'
  | 'MANIFEST_DIGEST_MISMATCH';

export interface SelfBootstrapOptions {
  workspaceRoot?: string;
  manifestPath?: string;
  mode: 'DRY_RUN' | 'EXECUTE';
  confirmProjectId?: string;
  confirmManifestDigest?: string;
  authEnvValue?: string;
  actor?: string;
  clock?: () => string;
  generateAuditId?: () => string;
  // Test hook for simulating mutation/preservation failures
  simulateUnrelatedMutation?: boolean;
  writeAtomicOptions?: WriteSnapshotAtomicOptions;
}

export interface SelfBootstrapReport {
  status: SelfBootstrapStatus;
  errors: string[];
  warnings: string[];
  mode: 'DRY_RUN' | 'EXECUTE';
  manifestSchemaVersion: string;
  projectStateSchemaVersion: number;
  schemaVersion: number;
  bootstrapMode: string;
  projectToCreate: string;
  manifestDigest: string | null;
  snapshot: {
    path: string;
    existedBefore: boolean;
    wouldWriteSnapshot: boolean;
    wouldCreateSnapshot: boolean;
    wouldReplaceSnapshot: boolean;
    targetProjectExists: boolean;
  };
  existingProjects: {
    ids: string[];
    count: number;
  };
  preservation: {
    preservedProjectIds: string[];
    preservedProjectCount: number;
    unrelatedStateEquivalent: boolean;
    beforeUnrelatedStateHash: string;
    candidateUnrelatedStateHash: string;
  };
  candidate: {
    projectCountAfterBootstrap: number;
    featuresCount: number;
    requirementsCount: number;
    risksCount: number;
    threatsCount: number;
    adrCount: number;
    componentCount: number;
    workItemCount: number;
    evidenceCount: number;
    documentCount: number;
  };
  emptyInitializedCollections: string[];
  plannedAudit: {
    action: string;
    actor: string;
    target: string;
    persisted: boolean;
  };
  auditLedgerValid: boolean;
  governance: {
    approvalsInjected: number;
    releaseSignoffInjected: boolean;
    gate7Executed: boolean;
  };
  filesystem: {
    snapshotWritten: boolean;
    tempFilesCreated: number;
  };
  mutationCount: number;
}

export const EMPTY_INITIALIZED_COLLECTIONS = [
  'questions',
  'standards',
  'overrides',
  'approvals',
  'agentRoles',
  'agentRuns',
  'derivations',
  'importSessions',
];

export function hashProjectsState(store: ProjectStore | any, projectIds: string[]): string {
  const payload: Record<string, any> = {};
  const sortedIds = [...projectIds].sort();
  for (const pid of sortedIds) {
    payload[pid] = {
      project: store.projects.find(p => p.id === pid),
      questions: store.questions[pid] || [],
      requirements: store.requirements[pid] || [],
      risks: store.risks[pid] || [],
      threats: store.threats[pid] || [],
      standards: store.standards[pid] || [],
      workItems: store.workItems[pid] || [],
      evidence: store.evidence[pid] || [],
      adrs: store.adrs[pid] || [],
      components: store.components[pid] || [],
      overrides: store.overrides[pid] || [],
      approvals: store.approvals[pid] || [],
      agentRoles: store.agentRoles[pid] || [],
      agentRuns: store.agentRuns[pid] || [],
      features: store.features[pid] || [],
      derivations: store.derivations[pid] || [],
      importSessions: store.importSessions[pid] || [],
      documents: store.documents?.[pid] || [],
      auditLogs: store.auditLogs[pid] || [],
    };
  }
  return crypto.createHash('sha256').update(canonicalizeJson(payload)).digest('hex');
}

/**
 * Executes a trusted self-bootstrap or read-only dry-run according to SELF_BOOTSTRAP_CONTRACT.md.
 * In DRY_RUN mode, performs 100% of candidate validation and state projection with 0 mutations.
 */
export function executeSelfBootstrap(options: SelfBootstrapOptions): SelfBootstrapReport {
  const workspaceRoot = options.workspaceRoot || process.cwd();
  const manifestRelPath = options.manifestPath || 'bootstrap/docmonstakrakin.self-bootstrap.json';
  const manifestAbsPath = path.isAbsolute(manifestRelPath)
    ? manifestRelPath
    : path.resolve(workspaceRoot, manifestRelPath);
  const mode = options.mode;
  const snapshotPath = resolveProjectStatePath(workspaceRoot);
  const snapshotExistedBefore = fs.existsSync(snapshotPath);

  const errors: string[] = [];
  const warnings: string[] = [];

  const defaultReport = (status: SelfBootstrapStatus): SelfBootstrapReport => ({
    status,
    errors,
    warnings,
    mode,
    manifestSchemaVersion: 'SELF_BOOTSTRAP_V1',
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    bootstrapMode: 'TRUSTED_LOCAL_BOOTSTRAP',
    projectToCreate: 'PRJ-DOCMONSTAKRAKIN',
    manifestDigest: null,
    snapshot: {
      path: snapshotPath,
      existedBefore: snapshotExistedBefore,
      wouldWriteSnapshot: false,
      wouldCreateSnapshot: !snapshotExistedBefore,
      wouldReplaceSnapshot: snapshotExistedBefore,
      targetProjectExists: false,
    },
    existingProjects: {
      ids: [],
      count: 0,
    },
    preservation: {
      preservedProjectIds: [],
      preservedProjectCount: 0,
      unrelatedStateEquivalent: false,
      beforeUnrelatedStateHash: '',
      candidateUnrelatedStateHash: '',
    },
    candidate: {
      projectCountAfterBootstrap: 0,
      featuresCount: 0,
      requirementsCount: 0,
      risksCount: 0,
      threatsCount: 0,
      adrCount: 0,
      componentCount: 0,
      workItemCount: 0,
      evidenceCount: 0,
      documentCount: 0,
    },
    emptyInitializedCollections: EMPTY_INITIALIZED_COLLECTIONS,
    plannedAudit: {
      action: 'PROJECT_BOOTSTRAPPED',
      actor: options.actor || 'docmonstakrakin-bootstrap-cli',
      target: 'PRJ-DOCMONSTAKRAKIN',
      persisted: false,
    },
    auditLedgerValid: false,
    governance: {
      approvalsInjected: 0,
      releaseSignoffInjected: false,
      gate7Executed: false,
    },
    filesystem: {
      snapshotWritten: false,
      tempFilesCreated: 0,
    },
    mutationCount: 0,
  });

  // STEP 1: Read local manifest
  if (!fs.existsSync(manifestAbsPath)) {
    errors.push(`Manifest file not found: ${manifestAbsPath}`);
    return defaultReport('INVALID_MANIFEST');
  }

  let manifest: SelfBootstrapManifest;
  try {
    const raw = fs.readFileSync(manifestAbsPath, 'utf-8');
    manifest = JSON.parse(raw) as SelfBootstrapManifest;
  } catch (err: unknown) {
    errors.push(`Failed to parse manifest JSON: ${String(err)}`);
    return defaultReport('INVALID_MANIFEST');
  }

  const targetProjectId = manifest.project?.id || 'PRJ-DOCMONSTAKRAKIN';

  // STEP 2: Pure manifest & filesystem integrity validation
  const integrityResult: SelfBootstrapIntegrityResult = verifySelfBootstrapIntegrity(manifest, workspaceRoot);
  if (!integrityResult.valid) {
    errors.push(...integrityResult.errors);
    warnings.push(...integrityResult.warnings);
    return defaultReport('INVALID_MANIFEST');
  }
  warnings.push(...integrityResult.warnings);

  // STEP 3: Construct the effective current canonical base store
  // Start from fresh ProjectStore containing built-in baseline state (PRJ-ATLAS-01)
  const baseStore = new ProjectStore();
  if (snapshotExistedBefore) {
    try {
      const snapshot = readProjectSnapshot(workspaceRoot);
      if (!snapshot) {
        errors.push('Existing snapshot could not be loaded');
        return defaultReport('INVALID_EXISTING_SNAPSHOT');
      }
      hydrateProjectStoreFromSnapshot(baseStore, snapshot);
    } catch (snapErr: unknown) {
      errors.push(`Failed to load existing project state snapshot: ${String(snapErr)}`);
      return defaultReport('INVALID_EXISTING_SNAPSHOT');
    }
  }

  const existingProjectIds = baseStore.projects.map(p => p.id);
  const targetProjectAlreadyExists = baseStore.projects.some(p => p.id === targetProjectId);

  // STEP 4: CREATE_ONLY conflict check
  if (targetProjectAlreadyExists) {
    errors.push(`Project '${targetProjectId}' already exists in canonical store. Self-bootstrap is CREATE_ONLY.`);
    const conflictReport = defaultReport('PROJECT_ALREADY_EXISTS');
    conflictReport.manifestSchemaVersion = manifest.schemaVersion;
    conflictReport.projectStateSchemaVersion = PROJECT_STATE_SCHEMA_VERSION;
    conflictReport.bootstrapMode = manifest.mode;
    conflictReport.snapshot.targetProjectExists = true;
    conflictReport.manifestDigest = integrityResult.manifestDigest;
    conflictReport.existingProjects = {
      ids: existingProjectIds,
      count: existingProjectIds.length,
    };
    return conflictReport;
  }

  // STEP 5: Build a COMPLETE in-memory candidate state
  const candidate = new ProjectStore();
  // Copy all baseStore state into candidate
  hydrateProjectStoreFromSnapshot(candidate, snapshotProjectStore(baseStore));

  // Append new self-project
  candidate.projects.push(structuredClone(manifest.project));
  candidate.features[targetProjectId] = structuredClone(manifest.features);
  candidate.requirements[targetProjectId] = structuredClone(manifest.requirements);
  candidate.risks[targetProjectId] = structuredClone(manifest.risks);
  candidate.threats[targetProjectId] = structuredClone(manifest.threats);
  candidate.adrs[targetProjectId] = structuredClone(manifest.adrs);
  candidate.components[targetProjectId] = structuredClone(manifest.components);
  candidate.workItems[targetProjectId] = structuredClone(manifest.workItems);
  candidate.evidence[targetProjectId] = structuredClone(manifest.evidence);
  candidate.documents[targetProjectId] = structuredClone(manifest.documents);

  // Initialize empty canonical collections for self-project
  candidate.questions[targetProjectId] = [];
  candidate.standards[targetProjectId] = [];
  candidate.overrides[targetProjectId] = [];
  candidate.approvals[targetProjectId] = [];
  candidate.agentRoles[targetProjectId] = [];
  candidate.agentRuns[targetProjectId] = [];
  candidate.derivations[targetProjectId] = [];
  candidate.importSessions[targetProjectId] = [];

  // Simulate deliberate unrelated mutation if requested by test
  if (options.simulateUnrelatedMutation && existingProjectIds.length > 0) {
    const firstPid = existingProjectIds[0];
    if (candidate.projects.find(p => p.id === firstPid)) {
      candidate.projects.find(p => p.id === firstPid)!.description += ' (UNAUTHORIZED MUTATION)';
    }
  }

  // STEP 6: Target candidate references verification
  // Verified by integrityResult; ensure candidate collections match counts exactly
  const countsMatch =
    candidate.features[targetProjectId].length === integrityResult.counts.features &&
    candidate.requirements[targetProjectId].length === integrityResult.counts.requirements &&
    candidate.risks[targetProjectId].length === integrityResult.counts.risks &&
    candidate.threats[targetProjectId].length === integrityResult.counts.threats &&
    candidate.adrs[targetProjectId].length === integrityResult.counts.adrs &&
    candidate.components[targetProjectId].length === integrityResult.counts.components &&
    candidate.workItems[targetProjectId].length === integrityResult.counts.workItems &&
    candidate.evidence[targetProjectId].length === integrityResult.counts.evidence &&
    candidate.documents[targetProjectId].length === integrityResult.counts.documents;

  if (!countsMatch) {
    errors.push('Candidate state collections do not match manifest entity counts');
    return defaultReport('PRESERVATION_CHECK_FAILED');
  }

  // STEP 7: Retain deterministic manifest digest
  const manifestDigest = integrityResult.manifestDigest;

  // STEP 8: Construct exactly ONE audit event in candidate state
  const auditActor = options.actor || 'docmonstakrakin-bootstrap-cli';
  const auditTimestamp = options.clock ? options.clock() : new Date().toISOString();
  const auditId = options.generateAuditId
    ? options.generateAuditId()
    : `AUD-BOOT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const rawAuditEvent: AuditEvent = {
    id: auditId,
    actor: auditActor,
    timestamp: auditTimestamp,
    action: 'PROJECT_BOOTSTRAPPED',
    target: targetProjectId,
    reason: 'Trusted local self-bootstrap from reviewed SELF_BOOTSTRAP_V1 manifest',
    stateHash: '',
    previousHash: GENESIS_AUDIT_HASH,
    details: {
      schemaVersion: manifest.schemaVersion,
      bootstrapMode: manifest.mode,
      manifestDigest,
      sourceRepository: manifest.provenance.repository,
      sourceBaselineCommit: manifest.provenance.baselineCommit,
      entityCounts: integrityResult.counts,
    },
  };

  const hashedAuditEvent = sanitizeAndHashAudit(rawAuditEvent);
  candidate.auditLogs[targetProjectId] = [hashedAuditEvent];

  // STEP 9: Verify candidate audit chain
  const auditLedgerResult = verifyAuditLedgerChain(candidate.auditLogs[targetProjectId], 'REVERSE_CHRONOLOGICAL');
  if (!auditLedgerResult.valid) {
    errors.push(`Candidate audit ledger failed cryptographic verification: ${auditLedgerResult.error}`);
    return defaultReport('AUDIT_VALIDATION_FAILED');
  }

  // STEP 10: Verify preservation of unrelated state
  const beforeHash = hashProjectsState(baseStore, existingProjectIds);
  const candidateHash = hashProjectsState(candidate, existingProjectIds);
  const unrelatedStateEquivalent = beforeHash === candidateHash;

  if (!unrelatedStateEquivalent) {
    errors.push('Unrelated project state was modified during candidate construction. Fail-closed.');
    const failPreserveReport = defaultReport('PRESERVATION_CHECK_FAILED');
    failPreserveReport.manifestDigest = integrityResult.manifestDigest;
    failPreserveReport.existingProjects = {
      ids: existingProjectIds,
      count: existingProjectIds.length,
    };
    failPreserveReport.preservation = {
      preservedProjectIds: existingProjectIds,
      preservedProjectCount: existingProjectIds.length,
      unrelatedStateEquivalent: false,
      beforeUnrelatedStateHash: beforeHash,
      candidateUnrelatedStateHash: candidateHash,
    };
    return failPreserveReport;
  }

  // STEP 11: DRY_RUN mode handling
  if (mode === 'DRY_RUN') {
    return {
      status: 'SAFE_TO_REVIEW',
      errors: [],
      warnings,
      mode: 'DRY_RUN',
      manifestSchemaVersion: manifest.schemaVersion,
      projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
      schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
      bootstrapMode: manifest.mode,
      projectToCreate: targetProjectId,
      manifestDigest,
      snapshot: {
        path: snapshotPath,
        existedBefore: snapshotExistedBefore,
        wouldWriteSnapshot: true,
        wouldCreateSnapshot: !snapshotExistedBefore,
        wouldReplaceSnapshot: snapshotExistedBefore,
        targetProjectExists: false,
      },
      existingProjects: {
        ids: existingProjectIds,
        count: existingProjectIds.length,
      },
      preservation: {
        preservedProjectIds: existingProjectIds,
        preservedProjectCount: existingProjectIds.length,
        unrelatedStateEquivalent: true,
        beforeUnrelatedStateHash: beforeHash,
        candidateUnrelatedStateHash: candidateHash,
      },
      candidate: {
        projectCountAfterBootstrap: candidate.projects.length,
        featuresCount: candidate.features[targetProjectId].length,
        requirementsCount: candidate.requirements[targetProjectId].length,
        risksCount: candidate.risks[targetProjectId].length,
        threatsCount: candidate.threats[targetProjectId].length,
        adrCount: candidate.adrs[targetProjectId].length,
        componentCount: candidate.components[targetProjectId].length,
        workItemCount: candidate.workItems[targetProjectId].length,
        evidenceCount: candidate.evidence[targetProjectId].length,
        documentCount: candidate.documents[targetProjectId].length,
      },
      emptyInitializedCollections: EMPTY_INITIALIZED_COLLECTIONS,
      plannedAudit: {
        action: 'PROJECT_BOOTSTRAPPED',
        actor: auditActor,
        target: targetProjectId,
        persisted: false,
      },
      auditLedgerValid: true,
      governance: {
        approvalsInjected: 0,
        releaseSignoffInjected: false,
        gate7Executed: false,
      },
      filesystem: {
        snapshotWritten: false,
        tempFilesCreated: 0,
      },
      mutationCount: 0,
    };
  }

  // STEP 12: EXECUTE mode handling
  // Verify execution authorization guard (Section 13)
  const envAuth = options.authEnvValue || process.env.DMK_SELF_BOOTSTRAP_EXECUTE;
  const isAuthorized =
    options.confirmProjectId === targetProjectId &&
    envAuth === targetProjectId;

  if (!isAuthorized) {
    errors.push(
      `Execution authorization guard failed. Required: --confirm-project-id ${targetProjectId} and DMK_SELF_BOOTSTRAP_EXECUTE=${targetProjectId}`
    );
    const unauthReport = defaultReport('UNAUTHORIZED_EXECUTION');
    unauthReport.manifestSchemaVersion = manifest.schemaVersion;
    unauthReport.projectStateSchemaVersion = PROJECT_STATE_SCHEMA_VERSION;
    unauthReport.bootstrapMode = manifest.mode;
    unauthReport.manifestDigest = manifestDigest;
    unauthReport.existingProjects = {
      ids: existingProjectIds,
      count: existingProjectIds.length,
    };
    unauthReport.preservation = {
      preservedProjectIds: existingProjectIds,
      preservedProjectCount: existingProjectIds.length,
      unrelatedStateEquivalent: true,
      beforeUnrelatedStateHash: beforeHash,
      candidateUnrelatedStateHash: candidateHash,
    };
    return unauthReport;
  }

  // Verify reviewed manifest digest guard
  if (!options.confirmManifestDigest || options.confirmManifestDigest.toLowerCase() !== (manifestDigest ?? '').toLowerCase()) {
    errors.push(
      `Manifest digest confirmation mismatch or missing. Required: --confirm-manifest-digest matching reviewed manifest digest (${manifestDigest})`
    );
    const mismatchReport = defaultReport('MANIFEST_DIGEST_MISMATCH');
    mismatchReport.manifestSchemaVersion = manifest.schemaVersion;
    mismatchReport.projectStateSchemaVersion = PROJECT_STATE_SCHEMA_VERSION;
    mismatchReport.bootstrapMode = manifest.mode;
    mismatchReport.manifestDigest = manifestDigest;
    mismatchReport.existingProjects = {
      ids: existingProjectIds,
      count: existingProjectIds.length,
    };
    mismatchReport.preservation = {
      preservedProjectIds: existingProjectIds,
      preservedProjectCount: existingProjectIds.length,
      unrelatedStateEquivalent: true,
      beforeUnrelatedStateHash: beforeHash,
      candidateUnrelatedStateHash: candidateHash,
    };
    return mismatchReport;
  }

  // Atomically persist candidate state snapshot
  const snapshotToPersist = snapshotProjectStore(candidate);
  writeProjectSnapshotAtomic(snapshotToPersist, workspaceRoot, options.writeAtomicOptions);

  return {
    status: 'EXECUTED',
    errors: [],
    warnings,
    mode: 'EXECUTE',
    manifestSchemaVersion: manifest.schemaVersion,
    projectStateSchemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    bootstrapMode: manifest.mode,
    projectToCreate: targetProjectId,
    manifestDigest,
    snapshot: {
      path: snapshotPath,
      existedBefore: snapshotExistedBefore,
      wouldWriteSnapshot: true,
      wouldCreateSnapshot: !snapshotExistedBefore,
      wouldReplaceSnapshot: snapshotExistedBefore,
      targetProjectExists: false,
    },
    existingProjects: {
      ids: existingProjectIds,
      count: existingProjectIds.length,
    },
    preservation: {
      preservedProjectIds: existingProjectIds,
      preservedProjectCount: existingProjectIds.length,
      unrelatedStateEquivalent: true,
      beforeUnrelatedStateHash: beforeHash,
      candidateUnrelatedStateHash: candidateHash,
    },
    candidate: {
      projectCountAfterBootstrap: candidate.projects.length,
      featuresCount: candidate.features[targetProjectId].length,
      requirementsCount: candidate.requirements[targetProjectId].length,
      risksCount: candidate.risks[targetProjectId].length,
      threatsCount: candidate.threats[targetProjectId].length,
      adrCount: candidate.adrs[targetProjectId].length,
      componentCount: candidate.components[targetProjectId].length,
      workItemCount: candidate.workItems[targetProjectId].length,
      evidenceCount: candidate.evidence[targetProjectId].length,
      documentCount: candidate.documents[targetProjectId].length,
    },
    emptyInitializedCollections: EMPTY_INITIALIZED_COLLECTIONS,
    plannedAudit: {
      action: 'PROJECT_BOOTSTRAPPED',
      actor: auditActor,
      target: targetProjectId,
      persisted: true,
    },
    auditLedgerValid: true,
    governance: {
      approvalsInjected: 0,
      releaseSignoffInjected: false,
      gate7Executed: false,
    },
    filesystem: {
      snapshotWritten: true,
      tempFilesCreated: 1,
    },
    mutationCount: 1,
  };
}
