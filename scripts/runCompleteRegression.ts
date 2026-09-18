import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=process.cwd();
const evidence=path.join(root,'docs/07_verification/rc-regression'); fs.mkdirSync(evidence,{recursive:true});
function discover(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?discover(path.join(dir,e.name)):/^test.*\.ts$/.test(e.name)?[path.join(dir,e.name)]:[]);}
const files=[path.join(root,'scripts/runAutomatedQa.ts'),...discover(path.join(root,'scripts')),...discover(path.join(root,'server'))].sort();
const results=[];
for(const file of files){
  const name=path.relative(root,file).replaceAll('\\','/');
  const r=spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,file],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,env:{...process.env,GEMINI_API_KEY:''}});
  const output=(r.stdout||'')+(r.stderr||'');
  const log=name.replaceAll('/','_').replace('.ts','.log');fs.writeFileSync(path.join(evidence,log),output);
  // Count actual named check results, not stale hardcoded banner totals.
  const passed=output.split(/\r?\n/).filter(l=>/^\s*(?:✓|✅|PASS\b|\[PASS\])/.test(l) && !/\bSKIP/i.test(l)).length;
  const failed=Math.max(r.status === 0 ? 0 : 1, output.split(/\r?\n/).filter(l=>/^\s*(?:✗|❌|FAIL\b|\[FAIL\])/.test(l)).length);
  const skipped=output.split(/\r?\n/).filter(l=>/^\s*(?:SKIP\b|.*\[SKIP\])/.test(l)).length;
  const result={suite:name,exitCode:r.status,status:r.status===0?'PASSED':'FAILED',passed,failed,skipped,log,error:r.error?.message};
  results.push(result);console.log(`${result.status} ${name}: ${passed} passed, ${failed} failed, ${skipped} skipped`);
}
const report={timestamp:new Date().toISOString(),counting:'Observed named assertion/check outputs; compound checks can contain multiple Node assert calls. Historical banner totals are not used.',suites:{total:results.length,passed:results.filter(r=>r.status==='PASSED').length,failed:results.filter(r=>r.status==='FAILED').length,skipped:0},assertions:{total:results.reduce((n,r)=>n+r.passed+r.failed+r.skipped,0),passed:results.reduce((n,r)=>n+r.passed,0),failed:results.reduce((n,r)=>n+r.failed,0),skipped:results.reduce((n,r)=>n+r.skipped,0)},results};
fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({suites:report.suites,assertions:report.assertions},null,2));process.exitCode=report.suites.failed?1:0;
