import fs from 'node:fs';
import path from 'node:path';
import {dryRunReconciliation,applyReconciliation,TARGET} from '../server/reconciliation/canonicalReconciliation.ts';

// Local administrative ceremony, never a startup migration or public API.
// Dry-run only emits stdout. Saving a report is an explicit operator action.
const args=process.argv.slice(2);
const value=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
try {
  const stateRoot=path.resolve(value('--state-root')||process.cwd());
  const evidenceRoot=path.resolve(value('--evidence-root')||process.cwd());
  if(args.includes('--dry-run') && !args.includes('--apply')) {
    console.log(JSON.stringify(dryRunReconciliation(stateRoot,evidenceRoot,value('--actor')||'human-review-pending'),null,2));
  } else if(args.includes('--apply') && !args.includes('--dry-run')) {
    if(!value('--plan'))throw Error('A saved reviewed --plan is required');
    const plan=JSON.parse(fs.readFileSync(path.resolve(value('--plan')!),'utf8'));
    console.log(JSON.stringify(applyReconciliation(stateRoot,evidenceRoot,plan,{
      confirmProjectId:value('--confirm-project-id')||'',confirmPlanDigest:value('--confirm-plan-digest')||'',
      authorized:process.env.DMK_RECONCILIATION_EXECUTE===TARGET,
    }),null,2));
  } else throw Error('Specify exactly one of --dry-run or --apply');
} catch(error) {console.error(JSON.stringify({status:'RECONCILIATION_REJECTED',error:String(error)}));process.exitCode=1;}
