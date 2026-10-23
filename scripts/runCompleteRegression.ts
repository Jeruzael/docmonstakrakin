import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {KNOWN_EVIDENCE_PATHS} from '../server/bootstrap/selfBootstrapIntegrity.ts';
import {classifyRegressionResult, REGRESSION_REPORT_SCHEMA_VERSION, REGRESSION_COUNTING_VERSION, REGRESSION_COUNTING_DESCRIPTION} from './lib/regressionResult.ts';

const root=process.cwd();
// Historical rc-regression/results.json is pinned bootstrap evidence. New runs
// must never overwrite it (including on repeat runs or partial failures).
const evidence=path.join(root,'runtime/rc-regression'); fs.mkdirSync(evidence,{recursive:true});
const manifestPath='bootstrap/docmonstakrakin.self-bootstrap.json';
const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
const protectedPaths=[...new Set<string>([manifestPath,...manifest.documents.map((d:any)=>d.path),...Object.values(KNOWN_EVIDENCE_PATHS)])];
const retained=new Map(protectedPaths.map(p=>[p,fs.readFileSync(path.join(root,p))]));
function discover(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?discover(path.join(dir,e.name)):/^test.*\.ts$/.test(e.name)?[path.join(dir,e.name)]:[]);}
const files=[path.join(root,'scripts/runAutomatedQa.ts'),...discover(path.join(root,'scripts')),...discover(path.join(root,'server'))].sort();
const results=[];
for(const file of files){
  const name=path.relative(root,file).replaceAll('\\','/');
  // Native Windows ACL/SQLite fixture admission measured 138 seconds for this
  // suite. This harness allowance does not enlarge any application RPC budget.
  const timeout=['scripts/testWorkspaceStore.ts','scripts/testWorkspaceApplication.ts','scripts/testWorkspaceBackup.ts'].includes(name)?240000:120000;
  const r=spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,file],{cwd:root,windowsHide:true,encoding:'utf8',timeout,env:{...process.env,GEMINI_API_KEY:''}});
  const changedEvidence=protectedPaths.filter(p=>!fs.existsSync(path.join(root,p))||!fs.readFileSync(path.join(root,p)).equals(retained.get(p)!));
  // Keep each captured stream's first result marker at a line boundary even if
  // stdout ends without a newline; otherwise stderr FAIL could become PASS text.
  const output=[r.stdout||'',r.stderr||''].join('\n')+(changedEvidence.length?`\nFAIL retained evidence changed: ${changedEvidence.join(', ')}\n`:'');
  const log=name.replaceAll('/','_').replace('.ts','.log');fs.writeFileSync(path.join(evidence,log),output);
  const classified=classifyRegressionResult(output,r,changedEvidence);
  const result={suite:name,exitCode:r.status,signal:r.signal,...classified,log,error:r.error?.message,changedEvidence};
  results.push(result);console.log(`${result.status} ${name}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
}
const report={schemaVersion:REGRESSION_REPORT_SCHEMA_VERSION,countingVersion:REGRESSION_COUNTING_VERSION,timestamp:new Date().toISOString(),counting:REGRESSION_COUNTING_DESCRIPTION,suites:{total:results.length,passed:results.filter(r=>r.status==='PASSED').length,failed:results.filter(r=>r.status==='FAILED').length,skipped:0},assertions:{total:results.reduce((n,r)=>n+r.passed+r.failed+r.skipped,0),passed:results.reduce((n,r)=>n+r.passed,0),failed:results.reduce((n,r)=>n+r.failed,0),skipped:results.reduce((n,r)=>n+r.skipped,0)},results};
fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({suites:report.suites,assertions:report.assertions},null,2));process.exitCode=report.suites.failed?1:0;
