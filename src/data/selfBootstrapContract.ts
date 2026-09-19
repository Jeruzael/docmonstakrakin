/**
 * docmonstakrakin - Trusted Self-Bootstrap Contract
 * Defines the strongly typed schema, referential-integrity validators,
 * security rules, provenance requirements, and dry-run reporting for
 * bootstrapping docmonstakrakin's own canonical project state.
 *
 * Schema: SELF_BOOTSTRAP_V1
 * Mode: TRUSTED_LOCAL_BOOTSTRAP
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
 * Prohibited sensitive property name patterns.
 * Structural scanner rejects any object property matching these keys.
 */
export const PROHIBITED_SENSITIVE_KEY_PATTERNS: RegExp[] = [
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
 * Prohibited governance injection fields.
 * Manifests MUST NOT inject approvals, release signatures, or gate sign-offs.
 */
export const PROHIBITED_GOVERNANCE_FIELDS: string[] = [
  'approvals',
  'signatures',
  'releaseSignoff',
  'releaseSignOff',
  'gate7Approval',
  'authorizedBy',
];

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
 * Recursively scans an object for prohibited sensitive keys.
 * Crucial security invariant: never prints the suspicious value, only reports the path.
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
 * Validates a SelfBootstrapManifest against structural, referential-integrity,
 * governance, and security constraints.
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

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Manifest must be a non-null JSON object.'],
      warnings: [],
      counts,
    };
  }

  const m = raw as Partial<SelfBootstrapManifest> & Record<string, unknown>;

  // 1. Schema & Mode validation
  if (m.schemaVersion !== SELF_BOOTSTRAP_SCHEMA_VERSION) {
    errors.push(
      `Invalid schemaVersion '${String(m.schemaVersion)}'. Expected '${SELF_BOOTSTRAP_SCHEMA_VERSION}'.`
    );
  }
  if (m.mode !== SELF_BOOTSTRAP_MODE) {
    errors.push(`Invalid mode '${String(m.mode)}'. Expected '${SELF_BOOTSTRAP_MODE}'.`);
  }

  // 2. Sensitive key scanning
  scanForSensitiveKeys(raw, '', errors);

  // 3. Governance field prohibition
  for (const field of PROHIBITED_GOVERNANCE_FIELDS) {
    if (Object.hasOwn(m, field)) {
      errors.push(
        `Governance field '${field}' is strictly forbidden in bootstrap manifests. Approvals and release signoffs must not be injected.`
      );
    }
  }

  // 4. Provenance validation
  if (!m.provenance || typeof m.provenance !== 'object') {
    errors.push('Missing required provenance metadata block.');
  } else {
    const p = m.provenance;
    if (!p.repository || typeof p.repository !== 'string') {
      errors.push('Provenance must specify a non-empty repository string.');
    }
    if (!p.baselineCommit || typeof p.baselineCommit !== 'string') {
      errors.push('Provenance must specify a non-empty baselineCommit hash.');
    }
    if (p.source !== 'LOCAL_REPOSITORY_DOCUMENTATION') {
      errors.push(
        `Provenance source must be 'LOCAL_REPOSITORY_DOCUMENTATION', got '${String(p.source)}'.`
      );
    }
  }

  // 5. Project metadata validation
  if (!m.project || typeof m.project !== 'object') {
    errors.push('Missing required project metadata block.');
  } else {
    const proj = m.project;
    if (!proj.id || typeof proj.id !== 'string') {
      errors.push('Project must define a valid non-empty string ID.');
    }
    if (!proj.name || typeof proj.name !== 'string') {
      errors.push('Project must define a non-empty name.');
    }
  }

  const projectId = m.project?.id || '';

  // 6. Canonical collection validations & duplicate ID detection
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
    extraValidator?: (item: T, index: number) => void
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
      if (extraValidator) {
        extraValidator(typed, idx);
      }
    });
  }

  validateCollection<Feature>('features', m.features, featureIds);
  validateCollection<Requirement>('requirements', m.requirements, requirementIds);
  validateCollection<Risk>('risks', m.risks, riskIds);
  validateCollection<Threat>('threats', m.threats, threatIds);
  validateCollection<ADR>('adrs', m.adrs, adrIds);
  validateCollection<ArchitectureComponent>('components', m.components, componentIds);
  validateCollection<Evidence>('evidence', m.evidence, evidenceIds);
  validateCollection<ControlledDocumentReference>('documents', m.documents, documentIds, (doc, idx) => {
    if (!doc.path || typeof doc.path !== 'string') {
      errors.push(`Document reference 'documents[${idx}]' must specify a valid 'path'.`);
    }
    const validKinds: ControlledDocumentKind[] = [
      'CONTROL',
      'PRODUCT',
      'REQUIREMENTS',
      'ARCHITECTURE',
      'SECURITY',
      'VERIFICATION',
      'OPERATIONS',
    ];
    if (!validKinds.includes(doc.kind)) {
      errors.push(`Document reference '${doc.id}' has invalid kind '${String(doc.kind)}'.`);
    }
    const validAuthorities: ControlledDocumentAuthority[] = ['REFERENCE', 'GENERATED_PROJECTION'];
    if (!validAuthorities.includes(doc.authority)) {
      errors.push(`Document reference '${doc.id}' has invalid authority '${String(doc.authority)}'.`);
    }
  });

  // Work items validation (special status & governance rules)
  validateCollection<WorkItem>('workItems', m.workItems, workItemIds, (item, idx) => {
    // Work item status restrictions
    if (item.status === 'APPROVED' || item.status === 'RELEASED') {
      errors.push(
        `WorkItem '${item.id}' has forbidden status '${item.status}'. Bootstrap manifests cannot grant human approval or release authorization.`
      );
    }

    // Historical work items marked VERIFIED must cite supporting evidence
    if (item.status === 'VERIFIED') {
      const hasDirectEvidence = Array.isArray(item.evidence) && item.evidence.length > 0;
      const hasCriteriaEvidence = Array.isArray(item.acceptanceCriteria) && item.acceptanceCriteria.some(
        (c: string) => c.includes('EVID-') || c.includes('EVIDENCE') || c.includes('rc-regression')
      );
      if (!hasDirectEvidence && !hasCriteriaEvidence) {
        errors.push(
          `WorkItem '${item.id}' is marked VERIFIED but does not cite supporting evidence in evidence or criteria.`
        );
      }
    }
  });

  // 7. Referential Integrity Link Resolution
  if (Array.isArray(m.requirements)) {
    m.requirements.forEach((req) => {
      if (Array.isArray(req.riskLinks)) {
        req.riskLinks.forEach((rId) => {
          if (!riskIds.has(rId)) {
            errors.push(
              `Requirement '${req.id}' references non-existent risk '${rId}'.`
            );
          }
        });
      }
      if (Array.isArray(req.threatLinks)) {
        req.threatLinks.forEach((tId) => {
          if (!threatIds.has(tId)) {
            errors.push(
              `Requirement '${req.id}' references non-existent threat '${tId}'.`
            );
          }
        });
      }
      if (req.linkedFeatureId && !featureIds.has(req.linkedFeatureId)) {
        errors.push(
          `Requirement '${req.id}' references non-existent feature '${req.linkedFeatureId}'.`
        );
      }
    });
  }

  if (Array.isArray(m.workItems)) {
    m.workItems.forEach((wi) => {
      if (Array.isArray(wi.requirements)) {
        wi.requirements.forEach((rId) => {
          if (!requirementIds.has(rId)) {
            errors.push(
              `WorkItem '${wi.id}' references non-existent requirement '${rId}'.`
            );
          }
        });
      }
      if (Array.isArray(wi.features)) {
        wi.features.forEach((fId) => {
          if (!featureIds.has(fId)) {
            errors.push(
              `WorkItem '${wi.id}' references non-existent feature '${fId}'.`
            );
          }
        });
      }
      if (Array.isArray(wi.evidence)) {
        wi.evidence.forEach((eId: string) => {
          if (!evidenceIds.has(eId)) {
            errors.push(
              `WorkItem '${wi.id}' references non-existent evidence '${eId}'.`
            );
          }
        });
      }
    });
  }

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
            errors.push(
              `ArchitectureComponent '${comp.id}' references non-existent ADR '${aId}'.`
            );
          }
        });
      }
    });
  }

  // Cross-project containment check
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
    'Historical VERIFIED statuses require explicit supporting evidence',
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
