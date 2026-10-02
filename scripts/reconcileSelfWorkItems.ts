import fs from 'node:fs';
import path from 'node:path';
import {
  generateReconciliationPlan,
  applyReconciliationPlan,
  type ReconciliationPlan,
} from '../server/workTracking/selfWorkItemReconciliation.ts';

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const isDryRun = Boolean(args['dry-run']);
  const isApply = Boolean(args['apply']);

  if (!isDryRun && !isApply) {
    console.error('Usage:');
    console.error('  Dry-run: npm run reconcile:self-work -- --dry-run --actor <name> [--output <file>]');
    console.error('  Apply:   npm run reconcile:self-work -- --apply --plan <plan.json> --confirm-project-id PRJ-DOCMONSTAKRAKIN --confirm-plan-digest <digest> [--actor <name>]');
    process.exit(1);
  }

  const root = process.cwd();

  if (isDryRun) {
    const rawActor = args['actor'];
    if (!rawActor || typeof rawActor !== 'string' || !rawActor.trim()) {
      console.error('INVALID_REVIEW_ACTOR: --actor is required for executable/reviewed reconciliation plans.');
      process.exit(1);
    }
    const actor = rawActor.trim();

    console.log(`[Reconciliation CLI] Generating dry-run plan for PRJ-DOCMONSTAKRAKIN (actor: "${actor}")...`);
    const plan = generateReconciliationPlan({
      workspaceRoot: root,
      projectId: 'PRJ-DOCMONSTAKRAKIN',
      actor,
    });

    console.log('\n--- Reconciliation Plan Summary ---');
    console.log(`Plan ID:                  ${plan.planId}`);
    console.log(`Format Version:           ${plan.formatVersion}`);
    console.log(`Plan Digest:              ${plan.planDigest}`);
    console.log(`WBS SHA-256:              ${plan.wbsSha256}`);
    console.log(`Snapshot SHA-256:         ${plan.beforeSnapshotSha256}`);
    console.log(`Candidate Snapshot SHA:   ${plan.candidateSnapshotDigest}`);
    console.log(`Current stateVersion:     ${plan.stateVersion}`);
    console.log(`Current auditCount:       ${plan.auditCount}`);
    console.log(`Canonical items (EPIC-13):${plan.summary.canonicalItems}`);
    console.log(`Runtime items:            ${plan.summary.runtimeItems}`);
    console.log(`  Synced:                 ${plan.summary.synced}`);
    console.log(`  Missing in runtime:     ${plan.summary.missingRuntime}`);
    console.log(`  Status drift:           ${plan.summary.statusDrift}`);
    console.log(`  Metadata drift:         ${plan.summary.metadataDrift}`);
    console.log(`  Runtime only (kept):    ${plan.summary.runtimeOnly}`);
    console.log(`  Blocked items:          ${plan.summary.blocked}`);

    if (plan.proposedCreations.length > 0) {
      console.log('\nProposed Creations:');
      for (const item of plan.proposedCreations) {
        console.log(`  + [${item.id}] ${item.title} -> ${item.status} (${item.type})`);
      }
    }

    if (plan.proposedUpdates.length > 0) {
      console.log('\nProposed Updates:');
      for (const update of plan.proposedUpdates) {
        console.log(`  ~ [${update.id}] changes:`, JSON.stringify(update.after));
      }
    }

    if (plan.runtimeOnlyWarnings.length > 0) {
      console.log('\nRuntime-Only Warnings (Preserved untouched):');
      for (const warn of plan.runtimeOnlyWarnings) {
        console.log(`  ! ${warn}`);
      }
    }

    if (plan.summary.blocked > 0) {
      console.log('\nBlocked Items:');
      for (const [id, reason] of Object.entries(plan.blockedReasons)) {
        console.log(`  X [${id}] ${reason}`);
      }
    }

    const outputPath = args['output'] ? String(args['output']) : null;
    if (outputPath) {
      const fullPath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
      console.log(`\nPlan saved to: ${fullPath}`);
    }

    console.log('\n[Dry-run completed cleanly — zero writes executed]');
    return;
  }

  if (isApply) {
    const planFile = String(args['plan'] || '');
    if (!planFile) {
      console.error('Error: --plan <path> is required for apply');
      process.exit(1);
    }

    const confirmProjectId = String(args['confirm-project-id'] || '');
    const confirmPlanDigest = String(args['confirm-plan-digest'] || '');

    const fullPlanPath = path.isAbsolute(planFile) ? planFile : path.join(root, planFile);
    if (!fs.existsSync(fullPlanPath)) {
      console.error(`Error: Plan file not found: ${fullPlanPath}`);
      process.exit(1);
    }

    const plan: ReconciliationPlan = JSON.parse(fs.readFileSync(fullPlanPath, 'utf8'));

    console.log(`[Reconciliation CLI] Applying plan ${plan.planId}...`);
    console.log(`Reviewed actor:       ${plan.actor}`);
    console.log(`Plan operationId:     ${plan.operationId}`);
    console.log(`Plan digest:          ${plan.planDigest}`);

    const result = applyReconciliationPlan({
      workspaceRoot: root,
      plan,
      actor: plan.actor,
      confirmProjectId,
      confirmPlanDigest,
    });

    console.log('\n--- Synchronization Result ---');
    console.log(`Status:               ${result.status}`);
    console.log(`Mutation Count:       ${result.mutationCount}`);
    console.log(`New stateVersion:     ${result.newStateVersion}`);
    console.log(`Audit Event ID:       ${result.auditEventId || 'NONE (No changes or already applied)'}`);
    console.log(`New Snapshot SHA-256: ${result.newSnapshotSha256}`);
  }
}

main().catch((err) => {
  console.error('[Reconciliation CLI Error]', err.message);
  process.exit(1);
});
