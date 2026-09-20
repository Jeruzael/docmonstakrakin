/**
 * docmonstakrakin - Trusted Self-Bootstrap Contract (Hardened V1)
 * Defines the strongly typed schema, referential-integrity validators,
 * runtime enum validators, security scanners, provenance requirements,
 * and dry-run reporting for bootstrapping docmonstakrakin's own canonical project state.
 *
 * Schema: SELF_BOOTSTRAP_V1
 * Mode: TRUSTED_LOCAL_BOOTSTRAP
 * Stable Self-Project ID: PRJ-DOCMONSTAKRAKIN
 * Repository: Jeruzael/docmonstakrakin
 *
 * Runtime Environment & Bundling Note:
 * This module defines the contract, schema, and validation logic for trusted local
 * self-bootstrap (an administrative CLI and server-side lifecycle contract: npm run bootstrap:self).
 * It is intentionally NOT imported into the client browser bundle (Vite SPA entry).
 * Browser UI components interact with projects via the Express REST API (/api/projects).
 */

import crypto from 'node:crypto';
import type {
  Project,
  Feature,
  Requirement,
  Risk,
  Threat,
  ADR,
  ArchitectureComponent,
  WorkItem,
  Evidence,
} from '../types.js';

export const SELF_BOOTSTRAP_SCHEMA_VERSION = 'SELF_BOOTSTRAP_V1' as const;
export type SelfBootstrapSchemaVersion = typeof SELF_BOOTSTRAP_SCHEMA_VERSION;

export const SELF_BOOTSTRAP_MODE = 'TRUSTED_LOCAL_BOOTSTRAP' as const;
export type SelfBootstrapMode = typeof SELF_BOOTSTRAP_MODE;

export const SELF_BOOTSTRAP_DEFAULT_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN' as const;
export const SELF_BOOTSTRAP_DEFAULT_REPOSITORY = 'Jeruzael/docmonstakrakin' as const;

export const GIT_COMMIT_SHA_REGEX = /^[0-9a-fA-F]{40}$/;
export const SHA256_HEX_REGEX = /^[0-9a-fA-F]{64}$/;

export type ControlledDocumentKind =
  | 'CONTROL'
  | 'PRODUCT'
  | 'REQUIREMENTS'
  | 'ARCHITECTURE'
  | 'SECURITY'
  | 'VERIFICATION'
  | 'OPERATIONS';

export type ControlledDocumentAuthority = 'REFERENCE' | 'GENERATED_PROJECTION';

export interface ControlledDocumentReference {
  id: string;
  path: string;
  kind: ControlledDocumentKind;
  authority: ControlledDocumentAuthority;
  title?: string;
  description?: string;
  sha256Digest?: string;
}

export interface BootstrapProvenance {
  repository: string;
  baselineCommit: string;
  source: 'LOCAL_REPOSITORY_DOCUMENTATION';
  preparedAt?: string;
  preparer?: string;
  notes?: string;
}

export interface BootstrapEntityCounts {
  features: number;
  requirements: number;
  risks: number;
  threats: number;
  adrs: number;
  components: number;
  workItems: number;
  evidence: number;
  documents: number;
}

/**
 * The root canonical manifest for trusted self-bootstrap.
 */
export interface SelfBootstrapManifest {
  schemaVersion: SelfBootstrapSchemaVersion;
  mode: SelfBootstrapMode;
  provenance: BootstrapProvenance;
  project: Project;
  features: Feature[];
  requirements: Requirement[];
  risks: Risk[];
  threats: Threat[];
  adrs: ADR[];
  components: ArchitectureComponent[];
  workItems: WorkItem[];
  evidence: Evidence[];
  documents: ControlledDocumentReference[];
}

/**
 * Result structure returned by manifest validation.
 */
export interface SelfBootstrapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: BootstrapEntityCounts;
  manifestDigest?: string;
}

/**
 * Result structure returned by dry-run execution.
 */
export interface BootstrapDryRunReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mode: SelfBootstrapMode;
  projectToCreate: {
    id: string;
    name: string;
    maturity?: string;
    profiles: string[];
    specializedProfiles: string[];
    lifecyclePhase: string;
  } | null;
  counts: BootstrapEntityCounts;
  manifestDigest: string | null;
  governanceRestrictions: string[];
  unresolvedReferenceErrors: string[];
  mutationCount: 0; // Invariant: dry run makes zero mutations
}

/**
 * Permitted root-level keys for SELF_BOOTSTRAP_V1 closed root schema.
 */
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

/**
 * Prohibited sensitive property name patterns.
 * Structural scanner rejects any object property matching these keys anywhere in the manifest.
 */
export const PROHIBITED_SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /password/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /token/i,
  /privatekey/i,
  /private_key/i,
  /machinetoken/i,
  /machine_token/i,
  /credential/i,
  /verifier/i,
  /passphrase/i,
  /auth_tag/i,
];

/**
 * Prohibited governance injection field names.
 * Scanned recursively across all object depths and arrays.
 */
export const PROHIBITED_GOVERNANCE_FIELD_NAMES: readonly string[] = [
  'approvals',
  'approvalsCollected',
  'signatures',
  'releaseSignoff',
  'releaseSignOff',
  'gate7Approval',
  'authorizedBy',
];

// --- RUNTIME ENUM ALLOWLISTS ---

// Project
export const VALID_PROJECT_MATURITIES = [
  'GREENFIELD',
  'EXISTING_PROJECT',
  'MIGRATION',
  'EXTENSION',
] as const;

export const VALID_PROJECT_PROFILES = [
  'WEB_APPLICATION',
  'MOBILE_APPLICATION',
  'BACKEND_API',
  'BACKEND_SERVICE',
  'FULL_STACK',
  'API_SERVICE',
  'DATA_PIPELINE',
  'DESKTOP_APPLICATION',
  'DESKTOP_GUI',
  'EMBEDDED_SYSTEM',
  'AI_APPLICATION',
  'AGENTIC_AI_APPLICATION',
] as const;

export const VALID_SPECIALIZED_PROFILES = [
  'FINANCIAL',
  'HEALTHCARE',
  'EDUCATION',
  'ECOMMERCE',
  'PII',
  'INTERNAL_TOOL',
  'PUBLIC_INTERNET',
  'AI_ASSISTANT',
  'AUTONOMOUS_AGENT',
  'DEVELOPER_TOOL',
  'AGENTIC_AI_EXPERIMENTATION',
  'AI_ENGINEERING',
  'DATA_PLATFORM',
] as const;

export const VALID_DELIVERY_METHODS = ['ITERATIVE', 'SCRUM', 'KANBAN', 'SCRUMBAN'] as const;

export const VALID_DATA_SENSITIVITIES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;

export const VALID_LIFECYCLE_PHASES = [
  'DISCOVERY',
  'REQUIREMENTS',
  'REQUIREMENTS_REVIEW',
  'RISK_ASSESSMENT',
  'THREAT_MODELING',
  'ARCHITECTURE',
  'ARCHITECTURE_REVIEW',
  'PLANNING',
  'IMPLEMENTATION',
  'VERIFICATION',
  'SECURITY_REVIEW',
  'RELEASE_APPROVAL',
  'DEPLOYMENT',
  'OPERATIONS',
  'FEEDBACK',
] as const;

// Feature
export const VALID_FEATURE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'P0', 'P1', 'P2'] as const;

export const VALID_BOOTSTRAP_FEATURE_STATUSES = [
  'PROPOSED',
  'UNDER_REVIEW',
  'DEFERRED',
  'REJECTED',
] as const;

export const FORBIDDEN_BOOTSTRAP_FEATURE_STATUSES = ['APPROVED'] as const;

export const VALID_FEATURE_SOURCES = [
  'DISCOVERY',
  'MANUAL_ENTRY',
  'AI_PROPOSED',
  'REQUIREMENT',
  'WIZARD',
  'PRODUCT_BASELINE',
] as const;

// Requirement
export const VALID_REQUIREMENT_CATEGORIES = [
  'FUNCTIONAL',
  'SECURITY',
  'PRIVACY',
  'DATA',
  'OPERATIONAL',
  'COMPLIANCE',
  'AI_SPECIFIC',
  'AGENT_SPECIFIC',
  'ARCHITECTURE',
] as const;

export const VALID_BOOTSTRAP_REQUIREMENT_STATUSES = [
  'PROPOSED',
  'UNDER_REVIEW',
  'REJECTED',
  'DEFERRED',
  'VERIFIED',
] as const;

export const FORBIDDEN_BOOTSTRAP_REQUIREMENT_STATUSES = ['APPROVED'] as const;

export const VALID_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const VALID_REQUIREMENT_SOURCE_TYPES = [
  'questionnaire_answer',
  'stakeholder',
  'standard_control',
  'threat_mitigation',
  'wizard_baseline',
  'ai_derivation',
  'EXTERNAL_AI_PROPOSAL',
] as const;

// Risk
export const VALID_RISK_TREATMENTS = ['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID'] as const;

// Threat
export const VALID_MITIGATION_STATUSES = ['RESOLVED', 'IN_PROGRESS', 'UNRESOLVED'] as const;

// ADR
export const VALID_BOOTSTRAP_ADR_STATUSES = ['PROPOSED', 'REJECTED', 'DEPRECATED', 'SUPERSEDED'] as const;

export const FORBIDDEN_BOOTSTRAP_ADR_STATUSES = ['ACCEPTED'] as const;

// ArchitectureComponent
export const VALID_COMPONENT_CATEGORIES = ['CLIENT', 'GATEWAY', 'SERVICE', 'DATASTORE', 'EXTERNAL'] as const;

export const VALID_TRUST_ZONES = ['INTERNET', 'DMZ', 'INTERNAL_SECURE', 'RESTRICTED_DATA'] as const;

export const VALID_DATA_CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;

// WorkItem
export const VALID_WORK_ITEM_TYPES = [
  'EPIC',
  'FEATURE',
  'TASK',
  'SECURITY',
  'VERIFICATION',
  'RELEASE',
] as const;

export const VALID_BOOTSTRAP_WORK_ITEM_STATUSES = [
  'PROPOSED',
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'VERIFICATION',
  'DEFERRED',
] as const;

export const FORBIDDEN_BOOTSTRAP_WORK_ITEM_STATUSES = ['VERIFIED', 'APPROVED', 'RELEASED'] as const;

export const VALID_WORK_ITEM_PRIORITIES = ['P0', 'P1', 'P2'] as const;

export const ALLOWED_WORK_ITEM_KEYS = new Set([
  'id',
  'type',
  'title',
  'description',
  'status',
  'priority',
  'risk',
  'sprint',
  'requirements',
  'dependencies',
  'acceptanceCriteria',
  'checklist',
  'tests',
  'evidence',
  'updatedAt',
  'parentEpicId',
  'owner',
  'features',
]);

// Evidence
export const VALID_EVIDENCE_TYPES = [
  'TEST_RUN',
  'COMMIT',
  'DIFF',
  'SECURITY_SCAN',
  'HUMAN_REVIEW',
  'AGENT_REVIEW',
  'DEPLOYMENT_RECORD',
] as const;

export const VALID_EVIDENCE_RESULTS = ['PASSED', 'FAILED', 'VERIFIED', 'UNTRUSTED'] as const;

export const ALLOWED_EVIDENCE_KEYS = new Set([
  'id',
  'type',
  'title',
  'workItemId',
  'result',
  'producer',
  'createdAt',
  'sha256Hash',
  'details',
  'command',
  'commitHash',
]);

// Documents
export const VALID_DOCUMENT_KINDS = [
  'CONTROL',
  'PRODUCT',
  'REQUIREMENTS',
  'ARCHITECTURE',
  'SECURITY',
  'VERIFICATION',
  'OPERATIONS',
] as const;

export const VALID_DOCUMENT_AUTHORITIES = ['REFERENCE', 'GENERATED_PROJECTION'] as const;

/**
 * Deterministically canonicalizes any JavaScript value into a sorted, whitespace-normalized JSON string.
 * This guarantees that state comparison produces identical SHA-256 hashes across runtimes and exports.
 */
export function canonicalizeJson(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  const pairs: string[] = [];
  for (const k of keys) {
    if ((val as Record<string, unknown>)[k] !== undefined) {
      pairs.push(JSON.stringify(k) + ':' + canonicalizeJson((val as Record<string, unknown>)[k]));
    }
  }
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 in Node.js environment.
 */
export function computeCanonicalSha256(canonicalString: string): string {
  return crypto.createHash('sha256').update(canonicalString, 'utf-8').digest('hex');
}

/**
 * Computes deterministic SHA-256 digest of a self-bootstrap manifest.
 */
export function computeBootstrapManifestDigest(manifest: unknown): string {
  const canonical = canonicalizeJson(manifest);
  return computeCanonicalSha256(canonical);
}

/**
 * Validates an enum against an explicit allowlist.
 * CRITICAL SECURITY INVARIANT: Does NOT expose raw input values in error messages.
 */
function validateEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
  path: string,
  errors: string[],
  required = true
): boolean {
  if (val === undefined || val === null) {
    if (required) {
      errors.push(`Missing required field '${path}'.`);
      return false;
    }
    return true;
  }
  if (typeof val !== 'string' || !allowed.includes(val as T)) {
    errors.push(`Invalid enum value at '${path}'. Expected one of: ${allowed.join(', ')}.`);
    return false;
  }
  return true;
}

/**
 * Recursively scans an object for prohibited sensitive keys.
 * CRITICAL SECURITY INVARIANT: Never prints the sensitive value, only reports the property path.
 */
function scanForSensitiveKeys(obj: unknown, path: string, errors: string[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      scanForSensitiveKeys(obj[i], `${path}[${i}]`, errors);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const currentPath = path ? `${path}.${key}` : key;
    for (const pattern of PROHIBITED_SENSITIVE_KEY_PATTERNS) {
      if (pattern.test(key)) {
        errors.push(
          `Prohibited sensitive key detected at '${currentPath}'. Secrets, passwords, tokens, keys, and credentials are strictly forbidden in bootstrap manifests.`
        );
        break;
      }
    }
    scanForSensitiveKeys(record[key], currentPath, errors);
  }
}

/**
 * Recursively scans an object for prohibited governance field names anywhere in the manifest.
 * CRITICAL SECURITY INVARIANT: Never prints the value, only reports the property path.
 */
function scanForGovernanceFields(obj: unknown, path: string, errors: string[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      scanForGovernanceFields(obj[i], `${path}[${i}]`, errors);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (PROHIBITED_GOVERNANCE_FIELD_NAMES.includes(key)) {
      errors.push(
        `Governance field '${currentPath}' is strictly forbidden in bootstrap manifests. Approvals, signatures, and release signoffs cannot be injected.`
      );
    }
    scanForGovernanceFields(record[key], currentPath, errors);
  }
}

/**
 * Validates a controlled document repository-relative path.
 * Must be non-empty string under docs/, free of directory traversal, and not absolute.
 */
function validateDocumentPath(path: unknown, docId: string, errors: string[]): void {
  if (typeof path !== 'string' || path.trim() === '') {
    errors.push(`Document reference '${docId}' must specify a non-empty string 'path'.`);
    return;
  }
  // No absolute POSIX path
  if (path.startsWith('/')) {
    errors.push(`Document reference '${docId}' path cannot be an absolute POSIX path.`);
    return;
  }
  // No absolute Windows path (e.g. C:\... or \\...)
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\')) {
    errors.push(`Document reference '${docId}' path cannot be an absolute Windows path.`);
    return;
  }
  // Normalize backslashes for traversal check
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.includes('..')) {
    errors.push(`Document reference '${docId}' path contains forbidden '..' directory traversal.`);
    return;
  }
  // Must be strictly under docs/
  if (!normalized.startsWith('docs/')) {
    errors.push(`Document reference '${docId}' path must be repository-relative under 'docs/'.`);
    return;
  }
}

/**
 * Validates a SelfBootstrapManifest against structural, referential-integrity,
 * governance, security, and runtime enum constraints.
 */
export function validateSelfBootstrapManifest(raw: unknown): SelfBootstrapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: BootstrapEntityCounts = {
    features: 0,
    requirements: 0,
    risks: 0,
    threats: 0,
    adrs: 0,
    components: 0,
    workItems: 0,
    evidence: 0,
    documents: 0,
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['Manifest must be a non-null JSON object.'],
      warnings: [],
      counts,
    };
  }

  const m = raw as Partial<SelfBootstrapManifest> & Record<string, unknown>;

  // 1. Closed root schema enforcement
  const rawRootKeys = Object.keys(m);
  const permittedSet = new Set(PERMITTED_ROOT_KEYS);
  for (const k of rawRootKeys) {
    if (!permittedSet.has(k)) {
      errors.push(
        `Unexpected root property '${k}'. SELF_BOOTSTRAP_V1 enforces a closed root schema with no arbitrary extensions.`
      );
    }
  }

  // 2. Sensitive key scanning (recursive)
  scanForSensitiveKeys(raw, '', errors);

  // 3. Recursive governance injection detection
  scanForGovernanceFields(raw, '', errors);

  // 4. Schema & Mode validation
  if (m.schemaVersion !== SELF_BOOTSTRAP_SCHEMA_VERSION) {
    errors.push(
      `Invalid schemaVersion '${String(m.schemaVersion)}'. Expected '${SELF_BOOTSTRAP_SCHEMA_VERSION}'.`
    );
  }
  if (m.mode !== SELF_BOOTSTRAP_MODE) {
    errors.push(`Invalid mode '${String(m.mode)}'. Expected '${SELF_BOOTSTRAP_MODE}'.`);
  }

  // 5. Provenance validation
  if (!m.provenance || typeof m.provenance !== 'object' || Array.isArray(m.provenance)) {
    errors.push('Missing required provenance metadata block.');
  } else {
    const p = m.provenance as Partial<BootstrapProvenance>;
    if (p.repository !== SELF_BOOTSTRAP_DEFAULT_REPOSITORY) {
      errors.push(
        `Provenance repository must be exactly '${SELF_BOOTSTRAP_DEFAULT_REPOSITORY}'. Got '${String(p.repository)}'.`
      );
    }
    if (typeof p.baselineCommit !== 'string' || !GIT_COMMIT_SHA_REGEX.test(p.baselineCommit)) {
      errors.push(
        `Provenance baselineCommit must be a valid 40-character hexadecimal Git commit SHA.`
      );
    }
    if (p.source !== 'LOCAL_REPOSITORY_DOCUMENTATION') {
      errors.push(
        `Provenance source must be 'LOCAL_REPOSITORY_DOCUMENTATION', got '${String(p.source)}'.`
      );
    }
  }

  // 6. Stable Self-Project metadata validation
  if (!m.project || typeof m.project !== 'object' || Array.isArray(m.project)) {
    errors.push('Missing required project metadata block.');
  } else {
    const proj = m.project as Partial<Project>;
    if (proj.id !== SELF_BOOTSTRAP_DEFAULT_PROJECT_ID) {
      errors.push(
        `Project ID must be exactly '${SELF_BOOTSTRAP_DEFAULT_PROJECT_ID}'. Got '${String(proj.id)}'.`
      );
    }
    if (!proj.name || typeof proj.name !== 'string') {
      errors.push('Project must define a non-empty name.');
    }

    // Runtime enum validations for project
    if (proj.maturity !== undefined) {
      validateEnum(proj.maturity, VALID_PROJECT_MATURITIES, 'project.maturity', errors, false);
    }

    if (!Array.isArray(proj.profiles)) {
      errors.push("Project 'profiles' must be an array.");
    } else {
      proj.profiles.forEach((prof, idx) => {
        validateEnum(prof, VALID_PROJECT_PROFILES, `project.profiles[${idx}]`, errors);
      });
    }

    if (proj.specializedProfiles !== undefined) {
      if (!Array.isArray(proj.specializedProfiles)) {
        errors.push("Project 'specializedProfiles' must be an array if present.");
      } else {
        proj.specializedProfiles.forEach((sp, idx) => {
          validateEnum(sp, VALID_SPECIALIZED_PROFILES, `project.specializedProfiles[${idx}]`, errors);
        });
      }
    }

    validateEnum(proj.deliveryMethod, VALID_DELIVERY_METHODS, 'project.deliveryMethod', errors);
    validateEnum(proj.dataSensitivity, VALID_DATA_SENSITIVITIES, 'project.dataSensitivity', errors);
    validateEnum(proj.lifecyclePhase, VALID_LIFECYCLE_PHASES, 'project.lifecyclePhase', errors);
  }

  const projectId = m.project?.id || '';

  // 7. Canonical collections validation & duplicate ID detection
  const featureIds = new Set<string>();
  const requirementIds = new Set<string>();
  const riskIds = new Set<string>();
  const threatIds = new Set<string>();
  const adrIds = new Set<string>();
  const componentIds = new Set<string>();
  const workItemIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const documentIds = new Set<string>();

  function validateCollection<T extends { id?: string }>(
    collectionName: keyof BootstrapEntityCounts,
    items: unknown,
    idSet: Set<string>,
    itemValidator?: (item: T, index: number) => void
  ) {
    if (!Array.isArray(items)) {
      errors.push(`Collection '${collectionName}' must be an array.`);
      return;
    }
    counts[collectionName] = items.length;
    items.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Collection '${collectionName}[${idx}]' must be an object.`);
        return;
      }
      const typed = item as T;
      if (!typed.id || typeof typed.id !== 'string') {
        errors.push(`Collection '${collectionName}[${idx}]' is missing required string 'id'.`);
        return;
      }
      if (idSet.has(typed.id)) {
        errors.push(`Duplicate ID '${typed.id}' detected in collection '${collectionName}'.`);
      } else {
        idSet.add(typed.id);
      }
      if (itemValidator) {
        itemValidator(typed, idx);
      }
    });
  }

  // --- Validate Features ---
  validateCollection<Feature>('features', m.features, featureIds, (feat, idx) => {
    if (FORBIDDEN_BOOTSTRAP_FEATURE_STATUSES.includes(feat.status as any)) {
      errors.push(
        `Feature '${feat.id}' has forbidden status '${feat.status}'. Features during bootstrap cannot be APPROVED.`
      );
    } else {
      validateEnum(feat.status, VALID_BOOTSTRAP_FEATURE_STATUSES, `features[${idx}].status`, errors);
    }
    validateEnum(feat.priority, VALID_FEATURE_PRIORITIES, `features[${idx}].priority`, errors);
    validateEnum(feat.source, VALID_FEATURE_SOURCES, `features[${idx}].source`, errors);
  });

  // --- Validate Requirements ---
  validateCollection<Requirement>('requirements', m.requirements, requirementIds, (req, idx) => {
    if (FORBIDDEN_BOOTSTRAP_REQUIREMENT_STATUSES.includes(req.status as any)) {
      errors.push(
        `Requirement '${req.id}' has forbidden status '${req.status}'. Requirements during bootstrap cannot be APPROVED.`
      );
    } else {
      validateEnum(
        req.status,
        VALID_BOOTSTRAP_REQUIREMENT_STATUSES,
        `requirements[${idx}].status`,
        errors
      );
    }
    validateEnum(req.category, VALID_REQUIREMENT_CATEGORIES, `requirements[${idx}].category`, errors);
    validateEnum(req.priority, VALID_RISK_LEVELS, `requirements[${idx}].priority`, errors);
    if (!req.source || typeof req.source !== 'object') {
      errors.push(`Requirement '${req.id}' is missing required 'source' object.`);
    } else {
      validateEnum(
        req.source.type,
        VALID_REQUIREMENT_SOURCE_TYPES,
        `requirements[${idx}].source.type`,
        errors
      );
    }
  });

  // --- Validate Risks ---
  validateCollection<Risk>('risks', m.risks, riskIds, (risk, idx) => {
    validateEnum(risk.inherentLevel, VALID_RISK_LEVELS, `risks[${idx}].inherentLevel`, errors);
    validateEnum(risk.residualLevel, VALID_RISK_LEVELS, `risks[${idx}].residualLevel`, errors);
    validateEnum(risk.treatment, VALID_RISK_TREATMENTS, `risks[${idx}].treatment`, errors);
  });

  // --- Validate Threats ---
  validateCollection<Threat>('threats', m.threats, threatIds, (threat, idx) => {
    validateEnum(threat.riskLevel, VALID_RISK_LEVELS, `threats[${idx}].riskLevel`, errors);
    if (!Array.isArray(threat.mitigations)) {
      errors.push(`Threat '${threat.id}' mitigations must be an array.`);
    } else {
      threat.mitigations.forEach((mit, mIdx) => {
        validateEnum(
          mit?.status,
          VALID_MITIGATION_STATUSES,
          `threats[${idx}].mitigations[${mIdx}].status`,
          errors
        );
      });
    }
  });

  // --- Validate ADRs ---
  validateCollection<ADR>('adrs', m.adrs, adrIds, (adr, idx) => {
    if (FORBIDDEN_BOOTSTRAP_ADR_STATUSES.includes(adr.status as any)) {
      errors.push(
        `ADR '${adr.id}' has forbidden status '${adr.status}'. ADRs during bootstrap cannot be ACCEPTED; ratification requires human sign-off.`
      );
    } else {
      validateEnum(adr.status, VALID_BOOTSTRAP_ADR_STATUSES, `adrs[${idx}].status`, errors);
    }
  });

  // --- Validate Architecture Components ---
  validateCollection<ArchitectureComponent>('components', m.components, componentIds, (comp, idx) => {
    validateEnum(comp.category, VALID_COMPONENT_CATEGORIES, `components[${idx}].category`, errors);
    validateEnum(comp.trustZone, VALID_TRUST_ZONES, `components[${idx}].trustZone`, errors);
    validateEnum(
      comp.dataClassification,
      VALID_DATA_CLASSIFICATIONS,
      `components[${idx}].dataClassification`,
      errors
    );
  });

  // --- Validate WorkItems ---
  validateCollection<WorkItem>('workItems', m.workItems, workItemIds, (item, idx) => {
    // Reject unsupported fields
    for (const k of Object.keys(item)) {
      if (!ALLOWED_WORK_ITEM_KEYS.has(k)) {
        errors.push(`WorkItem '${item.id}' contains unsupported field '${k}'.`);
      }
    }

    // Required string fields
    if (typeof item.title !== 'string' || item.title.trim().length === 0) {
      errors.push(`WorkItem '${item.id}' is missing required string 'title'.`);
    }
    if (typeof item.description !== 'string' || item.description.trim().length === 0) {
      errors.push(`WorkItem '${item.id}' is missing required string 'description'.`);
    }
    if (typeof item.sprint !== 'number' || !Number.isInteger(item.sprint)) {
      errors.push(`WorkItem '${item.id}' is missing required integer 'sprint'.`);
    }
    if (!Array.isArray(item.requirements) || !item.requirements.every((r: unknown) => typeof r === 'string')) {
      errors.push(`WorkItem '${item.id}' is missing required string array 'requirements'.`);
    }
    if (!Array.isArray(item.dependencies) || !item.dependencies.every((d: unknown) => typeof d === 'string')) {
      errors.push(`WorkItem '${item.id}' is missing required string array 'dependencies'.`);
    }
    if (!Array.isArray(item.acceptanceCriteria) || !item.acceptanceCriteria.every((a: unknown) => typeof a === 'string')) {
      errors.push(`WorkItem '${item.id}' is missing required string array 'acceptanceCriteria'.`);
    }
    if (
      !Array.isArray(item.checklist) ||
      !item.checklist.every(
        (c: any) => c && typeof c === 'object' && typeof c.text === 'string' && typeof c.done === 'boolean'
      )
    ) {
      errors.push(`WorkItem '${item.id}' is missing required checklist array '{ text: string, done: boolean }[]'.`);
    }
    if (!Array.isArray(item.tests) || !item.tests.every((t: unknown) => typeof t === 'string')) {
      errors.push(`WorkItem '${item.id}' is missing required string array 'tests'.`);
    }
    if (!Array.isArray(item.evidence) || !item.evidence.every((e: unknown) => typeof e === 'string')) {
      errors.push(`WorkItem '${item.id}' is missing required string array 'evidence'.`);
    }
    if (typeof item.updatedAt !== 'string' || item.updatedAt.trim().length === 0) {
      errors.push(`WorkItem '${item.id}' is missing required string 'updatedAt'.`);
    }

    if (FORBIDDEN_BOOTSTRAP_WORK_ITEM_STATUSES.includes(item.status as any)) {
      errors.push(
        `WorkItem '${item.id}' has forbidden status '${item.status}'. WorkItems during bootstrap cannot be VERIFIED, APPROVED, or RELEASED.`
      );
    } else {
      validateEnum(
        item.status,
        VALID_BOOTSTRAP_WORK_ITEM_STATUSES,
        `workItems[${idx}].status`,
        errors
      );
    }
    validateEnum(item.type, VALID_WORK_ITEM_TYPES, `workItems[${idx}].type`, errors);
    validateEnum(item.priority, VALID_WORK_ITEM_PRIORITIES, `workItems[${idx}].priority`, errors);
    validateEnum(item.risk, VALID_RISK_LEVELS, `workItems[${idx}].risk`, errors);
  });

  // --- Validate Evidence ---
  validateCollection<Evidence>('evidence', m.evidence, evidenceIds, (ev, idx) => {
    // Reject unsupported fields
    for (const k of Object.keys(ev)) {
      if (!ALLOWED_EVIDENCE_KEYS.has(k)) {
        errors.push(`Evidence '${ev.id}' contains unsupported field '${k}'.`);
      }
    }

    // Required fields
    if (typeof ev.title !== 'string' || ev.title.trim().length === 0) {
      errors.push(`Evidence '${ev.id}' is missing required string 'title'.`);
    }
    if (typeof ev.workItemId !== 'string' || ev.workItemId.trim().length === 0) {
      errors.push(`Evidence '${ev.id}' is missing required string 'workItemId'.`);
    }
    if (typeof ev.producer !== 'string' || ev.producer.trim().length === 0) {
      errors.push(`Evidence '${ev.id}' is missing required string 'producer'.`);
    }
    if (typeof ev.createdAt !== 'string' || ev.createdAt.trim().length === 0) {
      errors.push(`Evidence '${ev.id}' is missing required string 'createdAt'.`);
    }
    if (typeof ev.sha256Hash !== 'string' || !SHA256_HEX_REGEX.test(ev.sha256Hash)) {
      errors.push(
        `Evidence '${ev.id}' sha256Hash must be a valid 64-character hexadecimal SHA-256 string.`
      );
    }
    if (typeof ev.details !== 'string' || ev.details.trim().length === 0) {
      errors.push(`Evidence '${ev.id}' is missing required string 'details'.`);
    }

    validateEnum(ev.type, VALID_EVIDENCE_TYPES, `evidence[${idx}].type`, errors);
    validateEnum(ev.result, VALID_EVIDENCE_RESULTS, `evidence[${idx}].result`, errors);
  });

  // --- Validate Controlled Documents ---
  validateCollection<ControlledDocumentReference>(
    'documents',
    m.documents,
    documentIds,
    (doc, idx) => {
      validateDocumentPath(doc.path, doc.id || `documents[${idx}]`, errors);
      validateEnum(doc.kind, VALID_DOCUMENT_KINDS, `documents[${idx}].kind`, errors);
      validateEnum(doc.authority, VALID_DOCUMENT_AUTHORITIES, `documents[${idx}].authority`, errors);
      if (doc.sha256Digest !== undefined && doc.sha256Digest !== null) {
        if (typeof doc.sha256Digest !== 'string' || !SHA256_HEX_REGEX.test(doc.sha256Digest)) {
          errors.push(
            `Document reference '${doc.id}' sha256Digest must be a valid 64-character hexadecimal SHA-256 string.`
          );
        }
      }
    }
  );

  // 8. Complete Referential Integrity Validation
  // Feature references
  if (Array.isArray(m.features)) {
    m.features.forEach((feat) => {
      if (Array.isArray(feat.requirements)) {
        feat.requirements.forEach((rId) => {
          if (!requirementIds.has(rId)) {
            errors.push(`Feature '${feat.id}' references non-existent requirement '${rId}'.`);
          }
        });
      }
      if (Array.isArray(feat.dependencies)) {
        feat.dependencies.forEach((fId) => {
          if (!featureIds.has(fId)) {
            errors.push(`Feature '${feat.id}' references non-existent dependency feature '${fId}'.`);
          }
        });
      }
    });
  }

  // Requirement references
  if (Array.isArray(m.requirements)) {
    m.requirements.forEach((req) => {
      if (Array.isArray(req.riskLinks)) {
        req.riskLinks.forEach((rId) => {
          if (!riskIds.has(rId)) {
            errors.push(`Requirement '${req.id}' references non-existent risk '${rId}'.`);
          }
        });
      }
      if (Array.isArray(req.threatLinks)) {
        req.threatLinks.forEach((tId) => {
          if (!threatIds.has(tId)) {
            errors.push(`Requirement '${req.id}' references non-existent threat '${tId}'.`);
          }
        });
      }
      if (req.linkedFeatureId && !featureIds.has(req.linkedFeatureId)) {
        errors.push(
          `Requirement '${req.id}' references non-existent feature '${req.linkedFeatureId}'.`
        );
      }
      if (Array.isArray(req.workItems)) {
        req.workItems.forEach((wId) => {
          if (!workItemIds.has(wId)) {
            errors.push(`Requirement '${req.id}' references non-existent workItem '${wId}'.`);
          }
        });
      }
      if (Array.isArray(req.evidence)) {
        req.evidence.forEach((eId) => {
          if (!evidenceIds.has(eId)) {
            errors.push(`Requirement '${req.id}' references non-existent evidence '${eId}'.`);
          }
        });
      }
    });
  }

  // ADR references
  if (Array.isArray(m.adrs)) {
    m.adrs.forEach((adr) => {
      if (Array.isArray(adr.linkedRequirements)) {
        adr.linkedRequirements.forEach((rId) => {
          if (!requirementIds.has(rId)) {
            errors.push(`ADR '${adr.id}' references non-existent requirement '${rId}'.`);
          }
        });
      }
      if (Array.isArray(adr.linkedRisks)) {
        adr.linkedRisks.forEach((rId) => {
          if (!riskIds.has(rId)) {
            errors.push(`ADR '${adr.id}' references non-existent risk '${rId}'.`);
          }
        });
      }
    });
  }

  // WorkItem references
  if (Array.isArray(m.workItems)) {
    m.workItems.forEach((wi) => {
      if (Array.isArray(wi.requirements)) {
        wi.requirements.forEach((rId) => {
          if (!requirementIds.has(rId)) {
            errors.push(`WorkItem '${wi.id}' references non-existent requirement '${rId}'.`);
          }
        });
      }
      if (Array.isArray(wi.features)) {
        wi.features.forEach((fId) => {
          if (!featureIds.has(fId)) {
            errors.push(`WorkItem '${wi.id}' references non-existent feature '${fId}'.`);
          }
        });
      }
      if (Array.isArray(wi.evidence)) {
        wi.evidence.forEach((eId: string) => {
          if (!evidenceIds.has(eId)) {
            errors.push(`WorkItem '${wi.id}' references non-existent evidence '${eId}'.`);
          }
        });
      }
      if (Array.isArray(wi.dependencies)) {
        wi.dependencies.forEach((dId) => {
          if (!workItemIds.has(dId)) {
            errors.push(`WorkItem '${wi.id}' references non-existent dependency workItem '${dId}'.`);
          }
        });
      }
    });
  }

  // Evidence references
  if (Array.isArray(m.evidence)) {
    m.evidence.forEach((ev) => {
      if (ev.workItemId && !workItemIds.has(ev.workItemId)) {
        errors.push(`Evidence '${ev.id}' references non-existent workItemId '${ev.workItemId}'.`);
      }
    });
  }

  // ArchitectureComponent references
  if (Array.isArray(m.components)) {
    m.components.forEach((comp) => {
      if (Array.isArray(comp.assignedRequirements)) {
        comp.assignedRequirements.forEach((rId) => {
          if (!requirementIds.has(rId)) {
            errors.push(
              `ArchitectureComponent '${comp.id}' references non-existent requirement '${rId}'.`
            );
          }
        });
      }
      if (Array.isArray(comp.linkedADRs)) {
        comp.linkedADRs.forEach((aId) => {
          if (!adrIds.has(aId)) {
            errors.push(`ArchitectureComponent '${comp.id}' references non-existent ADR '${aId}'.`);
          }
        });
      }
    });
  }

  // 9. Cross-project containment check
  const collectionsToCheck: [string, any[] | undefined][] = [
    ['requirements', m.requirements],
    ['features', m.features],
    ['workItems', m.workItems],
    ['evidence', m.evidence],
    ['risks', m.risks],
    ['threats', m.threats],
    ['adrs', m.adrs],
    ['components', m.components],
  ];

  for (const [colName, list] of collectionsToCheck) {
    if (Array.isArray(list)) {
      list.forEach((item) => {
        if (item && typeof item === 'object' && item.projectId && item.projectId !== projectId) {
          errors.push(
            `Entity '${item.id}' in '${colName}' belongs to foreign project '${item.projectId}'. Cross-project entity inclusion is forbidden.`
          );
        }
      });
    }
  }

  // 10. Manifest SHA-256 digest computation
  let manifestDigest: string | undefined;
  if (errors.length === 0) {
    try {
      manifestDigest = computeBootstrapManifestDigest(raw);
    } catch {
      // Digest computation failed
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts,
    manifestDigest,
  };
}

/**
 * Computes a dry-run report for a SelfBootstrapManifest without mutating any store.
 */
export function computeBootstrapDryRunReport(raw: unknown): BootstrapDryRunReport {
  const valResult = validateSelfBootstrapManifest(raw);
  const m = (raw && typeof raw === 'object' ? raw : {}) as Partial<SelfBootstrapManifest>;

  const governanceRestrictions = [
    'approvals = [] (No human approvals injected)',
    'Gate 7 status = HUMAN_APPROVAL_REQUIRED (Not executed)',
    'Release signoff = ABSENT',
    'No credential verifiers, secrets, tokens, or private keys allowed',
    'WorkItems cannot be VERIFIED, APPROVED, or RELEASED during bootstrap',
    'Requirements cannot be APPROVED during bootstrap',
    'ADRs cannot be ACCEPTED during bootstrap (ratification requires human signoff)',
    'Features cannot be APPROVED during bootstrap',
    'Closed root schema enforced (no unexpected root properties)',
    'Recursive governance field scanning active',
  ];

  const unresolvedReferenceErrors = valResult.errors.filter(
    (e) => e.includes('references non-existent') || e.includes('Duplicate ID')
  );

  return {
    valid: valResult.valid,
    errors: valResult.errors,
    warnings: valResult.warnings,
    mode: SELF_BOOTSTRAP_MODE,
    projectToCreate: m.project
      ? {
          id: m.project.id,
          name: m.project.name,
          maturity: m.project.maturity,
          profiles: m.project.profiles || [],
          specializedProfiles: m.project.specializedProfiles || [],
          lifecyclePhase: m.project.lifecyclePhase,
        }
      : null,
    counts: valResult.counts,
    manifestDigest: valResult.manifestDigest || null,
    governanceRestrictions,
    unresolvedReferenceErrors,
    mutationCount: 0, // Guarantees zero mutations during dry-run
  };
}
