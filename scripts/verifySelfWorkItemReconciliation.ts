import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ReconciliationPlan } from '../server/workTracking/selfWorkItemReconciliation.ts';
import { verifyAuditLedgerChain } from '../server/security/auditImmutability.ts';

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

export function verifyReconciliationOutcome(params: {
  beforeSnapshot: any;
  afterSnapshot: any;
  plan: ReconciliationPlan;
  wbsBytes?: Buffer;
}): { valid: boolean; errors: string[] } {
  const { beforeSnapshot, afterSnapshot, plan } = params;
  const errors: string[] = [];

  const beforeProjects = beforeSnapshot.state?.projects || [];
  const afterProjects = afterSnapshot.state?.projects || [];

  const beforeDmk = beforeProjects.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');
  const afterDmk = afterProjects.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');

  if (!beforeDmk || !afterDmk) {
    errors.push('PRJ-DOCMONSTAKRAKIN missing in snapshots');
    return { valid: false, errors };
  }

  const hasChanges = plan.proposedCreations.length > 0 || plan.proposedUpdates.length > 0;

  // 1. stateVersion check
  const expectedStateVersion = hasChanges ? beforeDmk.stateVersion + 1 : beforeDmk.stateVersion;
  if (afterDmk.stateVersion !== expectedStateVersion) {
    errors.push(`stateVersion mismatch: expected ${expectedStateVersion}, got ${afterDmk.stateVersion}`);
  }

  // 2. Unrelated projects preservation
  for (const bProj of beforeProjects) {
    if (bProj.id === 'PRJ-DOCMONSTAKRAKIN') continue;
    const aProj = afterProjects.find((p: any) => p.id === bProj.id);
    if (!aProj || JSON.stringify(aProj) !== JSON.stringify(bProj)) {
      errors.push(`Unrelated project "${bProj.id}" was mutated`);
    }
  }

  // 3. Unrelated collections preservation
  const collectionsToPreserve = [
    'requirements',
    'approvals',
    'risks',
    'threats',
    'standards',
    'adrs',
    'components',
  ];
  for (const col of collectionsToPreserve) {
    const beforeCol = beforeSnapshot.state?.[col];
    const afterCol = afterSnapshot.state?.[col];
    if (JSON.stringify(beforeCol) !== JSON.stringify(afterCol)) {
      errors.push(`Collection "${col}" was mutated unexpectedly`);
    }
  }

  // 4. Audit ledger validation
  const beforeAudit = beforeSnapshot.state?.auditLogs?.['PRJ-DOCMONSTAKRAKIN'] || [];
  const afterAudit = afterSnapshot.state?.auditLogs?.['PRJ-DOCMONSTAKRAKIN'] || [];

  const expectedAuditCount = hasChanges ? beforeAudit.length + 1 : beforeAudit.length;
  if (afterAudit.length !== expectedAuditCount) {
    errors.push(`Audit count mismatch: expected ${expectedAuditCount}, got ${afterAudit.length}`);
  }

  if (hasChanges) {
    const latestEvent = afterAudit[0];
    if (!latestEvent || latestEvent.action !== 'WORK_ITEMS_WBS_SYNCHRONIZED') {
      errors.push(`Latest audit event action is not WORK_ITEMS_WBS_SYNCHRONIZED: "${latestEvent?.action}"`);
    }
  }

  const chainCheck = verifyAuditLedgerChain(afterAudit, 'REVERSE_CHRONOLOGICAL');
  if (!chainCheck.valid) {
    errors.push(`Audit chain invalid after reconciliation: ${chainCheck.error}`);
  }

  // 5. WorkItems validation
  const beforeWorkItems = beforeSnapshot.state?.workItems?.['PRJ-DOCMONSTAKRAKIN'] || [];
  const afterWorkItems = afterSnapshot.state?.workItems?.['PRJ-DOCMONSTAKRAKIN'] || [];

  // Check expected creations
  for (const created of plan.proposedCreations) {
    const found = afterWorkItems.find((w: any) => w.id === created.id);
    if (!found) {
      errors.push(`Expected created WorkItem "${created.id}" not found in after snapshot`);
    } else {
      if (found.status !== created.status) {
        errors.push(`Created WorkItem "${created.id}" status mismatch: expected ${created.status}, got ${found.status}`);
      }
    }
  }

  // Check expected updates
  for (const update of plan.proposedUpdates) {
    const found = afterWorkItems.find((w: any) => w.id === update.id);
    if (!found) {
      errors.push(`Updated WorkItem "${update.id}" not found in after snapshot`);
    } else {
      for (const [key, val] of Object.entries(update.after)) {
        if (JSON.stringify(found[key]) !== JSON.stringify(val)) {
          errors.push(`WorkItem "${update.id}" field "${key}" mismatch after update`);
        }
      }
    }
  }

  // Check no unexpected deletions
  const afterIds = new Set(afterWorkItems.map((w: any) => w.id));
  for (const bItem of beforeWorkItems) {
    if (!afterIds.has(bItem.id)) {
      errors.push(`Unexpected deletion of runtime WorkItem "${bItem.id}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const beforeFile = String(args['before'] || '');
  const afterFile = String(args['after'] || '');
  const planFile = String(args['plan'] || '');

  if (!beforeFile || !afterFile || !planFile) {
    console.error('Usage: tsx scripts/verifySelfWorkItemReconciliation.ts --before <before.json> --after <after.json> --plan <plan.json>');
    process.exit(1);
  }

  const beforeSnapshot = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const afterSnapshot = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));

  const result = verifyReconciliationOutcome({
    beforeSnapshot,
    afterSnapshot,
    plan,
  });

  if (!result.valid) {
    console.error('[Verification Failed]');
    for (const err of result.errors) {
      console.error('  - ' + err);
    }
    process.exit(1);
  }

  console.log('[Verification Succeeded] All reconciliation invariants verified cleanly.');
}

if (process.argv[1]?.endsWith('verifySelfWorkItemReconciliation.ts')) {
  main().catch((err) => {
    console.error('[Verification Error]', err);
    process.exit(1);
  });
}
