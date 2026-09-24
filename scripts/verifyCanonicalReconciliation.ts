import fs from 'node:fs';
import path from 'node:path';
import {verifyReconciliation} from '../server/reconciliation/canonicalReconciliation.ts';
const args=process.argv.slice(2);
const value=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
try {
  for(const key of ['--before','--after','--plan'])if(!value(key))throw Error(`Required ${key}`);
  console.log(JSON.stringify(verifyReconciliation(fs.readFileSync(value('--before')!),fs.readFileSync(value('--after')!),
    JSON.parse(fs.readFileSync(value('--plan')!,'utf8')),path.resolve(value('--evidence-root')||process.cwd())),null,2));
} catch(error) {console.error(JSON.stringify({status:'RECONCILIATION_VERIFICATION_FAILED',error:String(error),mutationCount:0}));process.exitCode=1;}
