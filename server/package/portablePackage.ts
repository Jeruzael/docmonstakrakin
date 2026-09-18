import crypto from 'node:crypto';
import type {
  Project,
  Question,
  Requirement,
  Risk,
  WorkItem,
  Evidence,
  AuditEvent,
  ADR,
  ArchitectureComponent,
  GateOverride,
  ApprovalItem,
  AgentRole,
  AgentRunLog,
  Feature,
  DerivationRecord,
} from '../../src/types.js';
import { verifyAuditLedgerChain, GENESIS_AUDIT_HASH } from '../security/auditImmutability.js';

/**
 * REQ-DATA-004: Standalone Portable Project Package Envelope
 * SEC-CTRL-018: Portable Package Integrity Sealing
 * OpenSSF SLSA v1.0 / NIST SSDF PO.1.3
 *
 * Implements a single-file portable archive (.docmonstakrakin) containing full
 * canonical project state, standards locks, knowledge aggregates, and cryptographic
 * audit chains, sealed with deterministic SHA-256 state and envelope hashes.
 */

export const DOCMONSTAKRAKIN_PACKAGE_MAGIC = 'DOCMONSTAKRAKIN_PACKAGE' as const;
export const CURRENT_PACKAGE_SCHEMA_VERSION = '0.1.0' as const;

export interface DocmonstakrakinPackageManifest {
  magic: typeof DOCMONSTAKRAKIN_PACKAGE_MAGIC;
  schemaVersion: typeof CURRENT_PACKAGE_SCHEMA_VERSION;
  format: 'PORTABLE_ENVELOPE';
  exportedAt: string;
  exporter: string;
  tool: string;
  sourceEnvironment: string;
}

export interface DocmonstakrakinPackageKnowledge {
  project: Project;
  questions: Question[];
  requirements: Requirement[];
  risks: Risk[];
  threats: any[];
  standards: any[];
  workItems: WorkItem[];
  evidence: Evidence[];
  adrs: ADR[];
  components: ArchitectureComponent[];
  overrides: GateOverride[];
  approvals: ApprovalItem[];
  agentRoles?: AgentRole[];
  agentRuns?: AgentRunLog[];
  features?: Feature[];
  derivations?: DerivationRecord[];
  importSessions?: import('../../src/proposalTypes.js').ImportSession[];
}

export interface DocmonstakrakinPackageSeal {
  algorithm: 'SHA-256';
  canonicalStateHash: string;
  envelopeHash: string;
  auditRootHash: string;
  auditEventsCount: number;
  auditIntegrityVerified: boolean;
  sealedAt: string;
  sealerIdentity: string;
}

export interface DocmonstakrakinPackage {
  manifest: DocmonstakrakinPackageManifest;
  knowledge: DocmonstakrakinPackageKnowledge;
  auditLedger: AuditEvent[];
  seal: DocmonstakrakinPackageSeal;
}

export interface PackageVerificationResult {
  valid: boolean;
  errors: string[];
  canonicalStateHash?: string;
  envelopeHash?: string;
  auditVerified?: boolean;
  auditEventsCount?: number;
  manifest?: DocmonstakrakinPackageManifest;
  projectId?: string;
  projectName?: string;
}

/**
 * Deterministically canonicalizes any JavaScript value into a sorted, whitespace-normalized JSON string.
 * This guarantees that state comparison produces identical SHA-256 hashes across runtimes and exports.
 */
export function canonicalizeJson(val: any): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  const pairs: string[] = [];
  for (const k of keys) {
    if (val[k] !== undefined) {
      pairs.push(JSON.stringify(k) + ':' + canonicalizeJson(val[k]));
    }
  }
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes the canonical SHA-256 state hash across the entire project knowledge aggregate.
 */
export function computeCanonicalStateHash(knowledge: DocmonstakrakinPackageKnowledge): string {
  const canonicalString = canonicalizeJson(knowledge);
  return crypto.createHash('sha256').update(canonicalString, 'utf-8').digest('hex');
}

/**
 * Computes the envelope integrity hash across manifest, state hash, and audit chain root.
 */
export function computeEnvelopeHash(
  manifest: DocmonstakrakinPackageManifest,
  stateHash: string,
  auditRootHash: string,
  auditEventsCount: number
): string {
  const payload = [
    manifest.magic,
    manifest.schemaVersion,
    manifest.exportedAt,
    manifest.tool,
    stateHash,
    auditRootHash,
    String(auditEventsCount),
  ].join('::');

  return crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');
}

/**
 * Creates a cryptographically sealed .docmonstakrakin portable package from raw project state.
 */
export function createPortablePackage(params: {
  project: Project;
  questions?: Question[];
  requirements?: Requirement[];
  risks?: Risk[];
  threats?: any[];
  standards?: any[];
  workItems?: WorkItem[];
  evidence?: Evidence[];
  adrs?: ADR[];
  components?: ArchitectureComponent[];
  overrides?: GateOverride[];
  approvals?: ApprovalItem[];
  agentRoles?: AgentRole[];
  agentRuns?: AgentRunLog[];
  auditLogs?: AuditEvent[];
  actor?: string;
  sourceEnvironment?: string;
  features?: Feature[];
  derivations?: DerivationRecord[];
  importSessions?: import('../../src/proposalTypes.js').ImportSession[];
}): DocmonstakrakinPackage {
  const exportedAt = new Date().toISOString();
  const actor = params.actor || 'docmonstakrakin A-SSDLC Control Plane';

  const manifest: DocmonstakrakinPackageManifest = {
    magic: DOCMONSTAKRAKIN_PACKAGE_MAGIC,
    schemaVersion: CURRENT_PACKAGE_SCHEMA_VERSION,
    format: 'PORTABLE_ENVELOPE',
    exportedAt,
    exporter: 'docmonstakrakin-package-engine/v0.1',
    tool: 'docmonstakrakin A-SSDLC Control Plane',
    sourceEnvironment: params.sourceEnvironment || 'Local-First MVP Runtime',
  };

  const knowledge: DocmonstakrakinPackageKnowledge = {
    project: params.project,
    questions: params.questions || [],
    requirements: params.requirements || [],
    risks: params.risks || [],
    threats: params.threats || [],
    standards: params.standards || [],
    workItems: params.workItems || [],
    evidence: params.evidence || [],
    adrs: params.adrs || [],
    components: params.components || [],
    overrides: params.overrides || [],
    approvals: params.approvals || [],
    agentRoles: params.agentRoles || [],
    agentRuns: params.agentRuns || [],
    ...(params.features ? {features: params.features} : {}),
    ...(params.derivations ? {derivations: params.derivations} : {}),
    ...(params.importSessions ? {importSessions: params.importSessions} : {}),
  };

  // Ensure audit events are ordered chronologically (oldest to newest)
  let rawAudit = params.auditLogs || [];
  let auditLedger: AuditEvent[] = [];
  if (rawAudit.length > 0) {
    // If the first event is newer than the last event, reverse it to chronological
    const firstTs = new Date(rawAudit[0].timestamp).getTime();
    const lastTs = new Date(rawAudit[rawAudit.length - 1].timestamp).getTime();
    if (firstTs > lastTs) {
      auditLedger = [...rawAudit].reverse();
    } else {
      auditLedger = [...rawAudit];
    }
  }

  // Verify audit chain
  const auditVerification = verifyAuditLedgerChain(auditLedger, 'CHRONOLOGICAL');
  const auditRootHash = auditLedger.length > 0
    ? auditLedger[auditLedger.length - 1].stateHash
    : GENESIS_AUDIT_HASH;

  // Compute canonical state hash
  const canonicalStateHash = computeCanonicalStateHash(knowledge);

  // Compute envelope seal hash
  const envelopeHash = computeEnvelopeHash(
    manifest,
    canonicalStateHash,
    auditRootHash,
    auditLedger.length
  );

  const seal: DocmonstakrakinPackageSeal = {
    algorithm: 'SHA-256',
    canonicalStateHash,
    envelopeHash,
    auditRootHash,
    auditEventsCount: auditLedger.length,
    auditIntegrityVerified: auditVerification.valid,
    sealedAt: exportedAt,
    sealerIdentity: actor,
  };

  return {
    manifest,
    knowledge,
    auditLedger,
    seal,
  };
}

/**
 * Cryptographically verifies a .docmonstakrakin package envelope,
 * re-checking canonical state hashes, envelope integrity, and sequential audit hash chains.
 */
export function verifyPortablePackage(pkg: any): PackageVerificationResult {
  const errors: string[] = [];

  if (!pkg || typeof pkg !== 'object') {
    return { valid: false, errors: ['Package payload is not a valid object'] };
  }

  // 1. Verify Manifest
  if (!pkg.manifest) {
    errors.push('Missing package manifest');
  } else {
    if (pkg.manifest.magic !== DOCMONSTAKRAKIN_PACKAGE_MAGIC) {
      errors.push(
        `Invalid magic header: expected "${DOCMONSTAKRAKIN_PACKAGE_MAGIC}", got "${pkg.manifest.magic}"`
      );
    }
    if (pkg.manifest.schemaVersion !== CURRENT_PACKAGE_SCHEMA_VERSION) {
      errors.push(
        `Unsupported schema version: "${pkg.manifest.schemaVersion}". Expected "${CURRENT_PACKAGE_SCHEMA_VERSION}"`
      );
    }
  }

  // 2. Verify Knowledge
  if (!pkg.knowledge || typeof pkg.knowledge !== 'object') {
    errors.push('Missing package knowledge aggregate');
  } else if (!pkg.knowledge.project || !pkg.knowledge.project.id) {
    errors.push('Package knowledge missing valid project entity');
  }

  // 3. Verify Seal Presence
  if (!pkg.seal || typeof pkg.seal !== 'object') {
    errors.push('Package is unsealed (missing cryptographic seal block)');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 4. Verify Canonical State Hash
  const recomputedStateHash = computeCanonicalStateHash(pkg.knowledge);
  if (recomputedStateHash !== pkg.seal.canonicalStateHash) {
    errors.push(
      `Canonical state hash mismatch! Sealed: ${pkg.seal.canonicalStateHash}, Computed: ${recomputedStateHash}. Knowledge payload has been tampered with or corrupted.`
    );
  }

  // 5. Verify Audit Ledger Integrity
  const auditEvents: AuditEvent[] = Array.isArray(pkg.auditLedger) ? pkg.auditLedger : [];
  const auditVerification = verifyAuditLedgerChain(auditEvents, 'CHRONOLOGICAL');
  if (!auditVerification.valid) {
    errors.push(
      `Cryptographic audit chain verification failed at event index ${auditVerification.brokenIndex ?? 'unknown'}: ${
        auditVerification.error || 'broken hash sequence'
      }`
    );
  }

  // 6. Verify Envelope Hash
  const auditRootHash = auditEvents.length > 0
    ? auditEvents[auditEvents.length - 1].stateHash
    : GENESIS_AUDIT_HASH;

  const recomputedEnvelopeHash = computeEnvelopeHash(
    pkg.manifest,
    recomputedStateHash,
    auditRootHash,
    auditEvents.length
  );

  if (recomputedEnvelopeHash !== pkg.seal.envelopeHash) {
    errors.push(
      `Package envelope hash mismatch! Sealed: ${pkg.seal.envelopeHash}, Computed: ${recomputedEnvelopeHash}. Envelope manifest or seal parameters violated.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    canonicalStateHash: recomputedStateHash,
    envelopeHash: recomputedEnvelopeHash,
    auditVerified: auditVerification.valid,
    auditEventsCount: auditEvents.length,
    manifest: pkg.manifest,
    projectId: pkg.knowledge?.project?.id,
    projectName: pkg.knowledge?.project?.name,
  };
}

/**
 * Serializes package to standard JSON string with consistent UTF-8 encoding.
 */
export function serializePortablePackage(pkg: DocmonstakrakinPackage, pretty: boolean = true): string {
  return pretty ? JSON.stringify(pkg, null, 2) : JSON.stringify(pkg);
}

/**
 * Parses and verifies syntax of a package JSON string.
 */
export function parsePortablePackage(jsonString: string): DocmonstakrakinPackage {
  const parsed = JSON.parse(jsonString);
  return parsed as DocmonstakrakinPackage;
}
