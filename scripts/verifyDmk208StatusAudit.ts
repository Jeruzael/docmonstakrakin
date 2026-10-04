import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {
  readCanonicalWbs,
  getScopedCanonicalWbsItems,
  computeMasterWbsSha256,
} from '../server/workTracking/canonicalWbs.ts';
import {
  CANONICAL_LIFECYCLE_STATUSES,
  isCanonicalLifecycleStatus,
  type CanonicalLifecycleStatus,
} from '../server/workTracking/canonicalLifecycle.ts';

export interface AuditCandidateItem {
  id: string;
  wbsPath: string;
  title: string;
  currentStatus: CanonicalLifecycleStatus;
  candidateStatus: CanonicalLifecycleStatus;
  action: 'KEEP' | 'TRANSITION';
  evidenceRefs: string[];
  rationale: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  humanDecisionRequired: string;
}

export interface Dmk208StatusAuditCandidate {
  schemaVersion: string;
  projectId: string;
  workItemId: string;
  baseMasterSha: string;
  canonicalWbsSha256: string;
  candidateDigest: string;
  generatedAt: string;
  generatedBy: string;
  scopeEpic: string;
  scopeCount: number;
  items: AuditCandidateItem[];
}

export const EXPECTED_BASE_MASTER_SHA = '2a473df75d45aab2df3f55f37fec2d24ed403811';
export const EXPECTED_SCOPE_EPIC = 'EPIC-13';
export const EXPECTED_SCOPE_COUNT = 27;
export const EXPECTED_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';
export const EXPECTED_WORK_ITEM_ID = 'DMK-208';
export const EXPECTED_SCHEMA_VERSION = '1.0';

export function computeCandidateDigest(items: AuditCandidateItem[]): string {
  const canonicalItems = items.map((i) => ({
    id: i.id,
    wbsPath: i.wbsPath,
    currentStatus: i.currentStatus,
    candidateStatus: i.candidateStatus,
    action: i.action,
    evidenceRefs: [...i.evidenceRefs].sort(),
    rationale: i.rationale.trim(),
    confidence: i.confidence,
    humanDecisionRequired: i.humanDecisionRequired.trim(),
  }));
  // Sort deterministically by WBS path
  canonicalItems.sort((a, b) => a.wbsPath.localeCompare(b.wbsPath, undefined, { numeric: true }));
  const jsonStr = JSON.stringify(canonicalItems);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

export function verifyDmk208StatusAudit(
  workspaceRoot: string,
  candidatePath?: string
): { valid: boolean; summary: { total: number; keep: number; transition: number; candidateDigest: string } } {
  const filePath = candidatePath ?? path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-candidate.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audit candidate file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data: Dmk208StatusAuditCandidate;
  try {
    data = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to parse audit candidate JSON: ${err.message}`);
  }

  assert.equal(data.schemaVersion, EXPECTED_SCHEMA_VERSION, `Invalid schemaVersion: expected ${EXPECTED_SCHEMA_VERSION}`);
  assert.equal(data.projectId, EXPECTED_PROJECT_ID, `Invalid projectId: expected ${EXPECTED_PROJECT_ID}`);
  assert.equal(data.workItemId, EXPECTED_WORK_ITEM_ID, `Invalid workItemId: expected ${EXPECTED_WORK_ITEM_ID}`);
  assert.equal(data.baseMasterSha, EXPECTED_BASE_MASTER_SHA, `Invalid baseMasterSha: expected ${EXPECTED_BASE_MASTER_SHA}`);
  assert.equal(data.scopeEpic, EXPECTED_SCOPE_EPIC, `Invalid scopeEpic: expected ${EXPECTED_SCOPE_EPIC}`);
  assert.equal(data.scopeCount, EXPECTED_SCOPE_COUNT, `Invalid scopeCount: expected ${EXPECTED_SCOPE_COUNT}`);

  const actualWbsSha = computeMasterWbsSha256(workspaceRoot);
  assert.equal(
    data.canonicalWbsSha256,
    actualWbsSha,
    `canonicalWbsSha256 mismatch: candidate=${data.canonicalWbsSha256}, actual=${actualWbsSha}`
  );

  const { scopedItems } = getScopedCanonicalWbsItems(workspaceRoot, EXPECTED_SCOPE_EPIC);
  assert.equal(
    scopedItems.length,
    EXPECTED_SCOPE_COUNT,
    `Scoped item count in MASTER_WBS.yaml (${scopedItems.length}) != expected (${EXPECTED_SCOPE_COUNT})`
  );

  assert.ok(Array.isArray(data.items), 'items must be an array');
  assert.equal(data.items.length, EXPECTED_SCOPE_COUNT, `Candidate items count (${data.items.length}) != ${EXPECTED_SCOPE_COUNT}`);

  const expectedDigest = computeCandidateDigest(data.items);
  assert.equal(
    data.candidateDigest,
    expectedDigest,
    `candidateDigest mismatch: declared=${data.candidateDigest}, computed=${expectedDigest}`
  );

  const seenIds = new Set<string>();
  const canonicalMap = new Map(scopedItems.map((i) => [i.id, i]));
  let keepCount = 0;
  let transitionCount = 0;

  for (const item of data.items) {
    assert.ok(item.id, 'Item must have an id');
    assert.ok(!seenIds.has(item.id), `Duplicate candidate item id: ${item.id}`);
    seenIds.add(item.id);

    const canonicalItem = canonicalMap.get(item.id);
    assert.ok(canonicalItem, `Unknown candidate item id not in canonical WBS: ${item.id}`);

    assert.equal(
      item.currentStatus,
      canonicalItem.status,
      `Item ${item.id} currentStatus (${item.currentStatus}) does not match canonical WBS (${canonicalItem.status})`
    );

    assert.ok(
      isCanonicalLifecycleStatus(item.candidateStatus),
      `Item ${item.id} candidateStatus "${item.candidateStatus}" is not a valid canonical v1 lifecycle status`
    );

    // Reject non-v1 statuses
    const forbidden = ['BLOCKED', 'DEFERRED', 'CANCELLED', 'ACCEPTED', 'SUPERSEDED'];
    assert.ok(
      !forbidden.includes(item.candidateStatus),
      `Item ${item.id} proposes forbidden non-v1 status: ${item.candidateStatus}`
    );

    if (item.action === 'KEEP') {
      assert.equal(
        item.candidateStatus,
        item.currentStatus,
        `Item ${item.id} marked KEEP but candidateStatus (${item.candidateStatus}) != currentStatus (${item.currentStatus})`
      );
      keepCount++;
    } else if (item.action === 'TRANSITION') {
      assert.notEqual(
        item.candidateStatus,
        item.currentStatus,
        `Item ${item.id} marked TRANSITION but candidateStatus matches currentStatus (${item.currentStatus})`
      );
      assert.ok(
        Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0,
        `Item ${item.id} marked TRANSITION must have at least one evidenceRef`
      );
      // Validate that local repository evidence paths exist on disk
      for (const ref of item.evidenceRefs) {
        if (
          ref.startsWith('src/') ||
          ref.startsWith('server/') ||
          ref.startsWith('scripts/') ||
          ref.startsWith('docs/') ||
          ref === 'server.ts'
        ) {
          const resolvedPath = path.resolve(workspaceRoot, ref);
          assert.ok(
            fs.existsSync(resolvedPath),
            `Item ${item.id} TRANSITION evidenceRef file does not exist on disk: ${ref}`
          );
        }
      }
      assert.ok(
        item.rationale && item.rationale.trim().length > 10,
        `Item ${item.id} marked TRANSITION must have a detailed rationale`
      );
      transitionCount++;
    } else {
      throw new Error(`Item ${item.id} has invalid action: ${(item as any).action} (must be KEEP or TRANSITION)`);
    }

    assert.ok(
      ['HIGH', 'MEDIUM', 'LOW'].includes(item.confidence),
      `Item ${item.id} has invalid confidence: ${item.confidence}`
    );
    assert.ok(
      item.humanDecisionRequired && item.humanDecisionRequired.trim().length > 0,
      `Item ${item.id} must describe required human decision`
    );
  }

  // Ensure all canonical items are present
  for (const cItem of scopedItems) {
    assert.ok(seenIds.has(cItem.id), `Canonical item ${cItem.id} missing from audit candidate`);
  }

  return {
    valid: true,
    summary: {
      total: data.items.length,
      keep: keepCount,
      transition: transitionCount,
      candidateDigest: data.candidateDigest,
    },
  };
}

// CLI runner
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  try {
    const res = verifyDmk208StatusAudit(process.cwd());
    console.log('✓ [PASS] DMK-208 Status Audit Candidate is 100% valid.');
    console.log(`  Scope count: ${res.summary.total} (KEEP: ${res.summary.keep}, TRANSITION: ${res.summary.transition})`);
    console.log(`  Candidate Digest: ${res.summary.candidateDigest}`);
    process.exit(0);
  } catch (err: any) {
    console.error('✗ [FAIL] DMK-208 Status Audit Candidate Verification Failed:');
    console.error(' ', err.message);
    process.exit(1);
  }
}
