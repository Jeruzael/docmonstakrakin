import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';

export interface CanonicalWbsItem {
  id: string;
  wbsPath: string;
  parentId: string;
  epic: string;
  phase: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  risk: string;
  status: string;
  requirements: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  verificationMethod?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  humanApprovedBy?: string;
  evidence: string[];
  plannedBy?: string;
  children?: CanonicalWbsItem[];
}

export interface CanonicalWbsDocument {
  rawSha256: string;
  version: string;
  project: string;
  baseline: string;
  items: CanonicalWbsItem[];
  rawDocument: any;
}

export function resolveMasterWbsPath(workspaceRoot: string = process.cwd()): string {
  return path.join(workspaceRoot, 'docs', '00_control', 'MASTER_WBS.yaml');
}

/**
 * Computes the raw SHA-256 digest of MASTER_WBS.yaml.
 */
export function computeMasterWbsSha256(workspaceRoot: string = process.cwd()): string {
  const filePath = resolveMasterWbsPath(workspaceRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`MASTER_WBS.yaml not found at ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Parses raw MASTER_WBS.yaml bytes without performing filesystem reads.
 * Computes SHA-256, parses YAML, validates root structure and items,
 * enforces uniqueness of IDs and WBS paths, and normalizes items.
 */
export function parseCanonicalWbsBytes(rawBytes: Buffer): CanonicalWbsDocument {
  const rawSha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');
  const rawText = rawBytes.toString('utf8');

  let parsed: any;
  try {
    parsed = YAML.parse(rawText);
  } catch (err: unknown) {
    throw new Error(`Failed to parse MASTER_WBS.yaml: ${String(err)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid MASTER_WBS.yaml: root must be an object');
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid MASTER_WBS.yaml: items must be an array');
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const canonicalItems: CanonicalWbsItem[] = [];

  for (let idx = 0; idx < parsed.items.length; idx++) {
    const raw = parsed.items[idx];
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Invalid WBS item at index ${idx}: item must be an object`);
    }

    const id = String(raw.id || '').trim();
    if (!id) {
      throw new Error(`Invalid WBS item at index ${idx}: missing id`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate WBS item ID detected: "${id}"`);
    }
    seenIds.add(id);

    const wbsPath = String(raw.wbs_path || '').trim();
    if (!wbsPath) {
      throw new Error(`Invalid WBS item "${id}": missing wbs_path`);
    }
    if (seenPaths.has(wbsPath)) {
      throw new Error(`Duplicate WBS path detected: "${wbsPath}" (item "${id}")`);
    }
    seenPaths.add(wbsPath);

    canonicalItems.push({
      id,
      wbsPath,
      parentId: String(raw.parent_id || '').trim(),
      epic: String(raw.epic || '').trim(),
      phase: String(raw.phase || '').trim(),
      title: String(raw.title || '').trim(),
      description: String(raw.description || '').trim(),
      type: String(raw.type || '').trim(),
      priority: String(raw.priority || '').trim(),
      risk: String(raw.risk || '').trim(),
      status: String(raw.status || '').trim(),
      requirements: Array.isArray(raw.requirements) ? raw.requirements.map(String) : [],
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : [],
      acceptanceCriteria: Array.isArray(raw.acceptance_criteria) ? raw.acceptance_criteria.map(String) : [],
      verificationMethod: raw.verification_method ? String(raw.verification_method).trim() : undefined,
      verificationStatus: raw.verification_status ? String(raw.verification_status).trim() : undefined,
      verifiedBy: raw.verified_by ? String(raw.verified_by).trim() : undefined,
      humanApprovedBy: raw.human_approved_by ? String(raw.human_approved_by).trim() : undefined,
      evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
      plannedBy: raw.planned_by ? String(raw.planned_by).trim() : undefined,
    });
  }

  return {
    rawSha256,
    version: String(parsed.version || ''),
    project: String(parsed.project || ''),
    baseline: String(parsed.baseline || ''),
    items: canonicalItems,
    rawDocument: parsed,
  };
}

/**
 * Reads and parses MASTER_WBS.yaml from disk.
 * Validates uniqueness of IDs and WBS paths.
 * Fails closed on any structural anomaly or duplicates.
 */
export function readCanonicalWbs(workspaceRoot: string = process.cwd()): CanonicalWbsDocument {
  const filePath = resolveMasterWbsPath(workspaceRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`MASTER_WBS.yaml not found at ${filePath}`);
  }

  const rawBytes = fs.readFileSync(filePath);
  return parseCanonicalWbsBytes(rawBytes);
}

/**
 * Returns canonical WBS items scoped for operational runtime tracking.
 * For PRJ-DOCMONSTAKRAKIN v1, this is bounded to EPIC-13.
 */
export function getScopedCanonicalWbsItems(
  workspaceRoot: string = process.cwd(),
  targetEpic: string = 'EPIC-13'
): { wbsSha256: string; scopedItems: CanonicalWbsItem[]; allItems: CanonicalWbsItem[] } {
  const doc = readCanonicalWbs(workspaceRoot);
  const scopedItems = doc.items.filter(
    (item) => item.epic === targetEpic || item.parentId === targetEpic
  );
  return {
    wbsSha256: doc.rawSha256,
    scopedItems,
    allItems: doc.items,
  };
}

/**
 * Returns the full hierarchical canonical WBS tree for presentation.
 */
export function getCanonicalWbsHierarchy(workspaceRoot: string = process.cwd()): {
  wbsSha256: string;
  phases: any[];
  items: CanonicalWbsItem[];
} {
  const doc = readCanonicalWbs(workspaceRoot);
  return {
    wbsSha256: doc.rawSha256,
    phases: Array.isArray(doc.rawDocument?.phases) ? doc.rawDocument.phases : [],
    items: doc.items,
  };
}

/**
 * Builds a hierarchical tree from canonical WBS items based on parentId.
 */
export function buildCanonicalWbsTree(items: CanonicalWbsItem[]): CanonicalWbsItem[] {
  const itemMap = new Map<string, CanonicalWbsItem>();
  for (const item of items) {
    itemMap.set(item.id, { ...item, children: [] });
  }

  const roots: CanonicalWbsItem[] = [];
  for (const item of items) {
    const node = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      itemMap.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

