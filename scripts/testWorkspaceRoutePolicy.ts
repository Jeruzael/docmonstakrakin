import assert from 'node:assert/strict';
let passed=0,failed=0;
async function check(name:string,fn:()=>unknown|Promise<unknown>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+String(e));}}
let Module:any;try{Module=await import('../server/security/workspaceAccess/http.ts');}catch{}
await check('workspace route classifier is implemented',()=>assert.equal(typeof Module?.resolveWorkspaceRoute,'function'));
if(Module){
const resolve=(path:string,method='GET',body?:unknown)=>Module.resolveWorkspaceRoute({path,method,body});
await check('health and session do not expose project resources',()=>{assert.equal(resolve('/api/health').kind,'PUBLIC');assert.equal(resolve('/api/governance/session','POST').kind,'SESSION');});
await check('all project read aliases remain project scoped',()=>{for(const path of ['/api/projects/PRJ-A/docs','/API/PROJECTS/PRJ-A/docs/','/api/projects/PRJ-A/requirements']){const r=resolve(path,'HEAD');assert.equal(r.projectId,'PRJ-A');assert.equal(r.action,'project:read');}});
await check('lists require a current workspace session',()=>assert.equal(resolve('/api/projects').kind,'LIST'));
await check('creation never takes an owner or project from input',()=>{const r=resolve('/api/projects','POST',{owner:'other',id:'PRJ-VICTIM'});assert.equal(r.action,'project:create');assert.equal(r.projectId,undefined);});
await check('package export and import require explicit capabilities',()=>{assert.equal(resolve('/api/projects/PRJ-A/package/export').action,'project:export');const r=resolve('/api/projects/package/import','POST',{package:{knowledge:{project:{id:'PRJ-A'}}}});assert.equal(r.projectId,'PRJ-A');assert.equal(r.action,'project:import');});
await check('review operations cannot be downgraded to project edit',()=>{for(const [p,b]of [['/api/projects/PRJ-A/approvals/1/decide',{}],['/api/projects/PRJ-A/verification-sessions/1/decisions',{}],['/api/projects/PRJ-A/work-items',{status:'VERIFIED'}]]as const)assert.equal(resolve(p,'POST',b).action,'project:review');});
await check('ordinary managed authoring uses scoped write rather than inherited quorum authority',()=>{assert.equal(resolve('/api/projects/PRJ-A/docs','POST').action,'project:write');assert.equal(resolve('/api/projects/PRJ-A/docs/1/save','POST').action,'project:write');});
await check('diff and validate are reads despite using POST',()=>{assert.equal(resolve('/api/projects/PRJ-A/docs/1/diff','POST').action,'project:read');assert.equal(resolve('/api/projects/PRJ-A/docs/1/validate','POST').action,'project:read');});
await check('unknown and privileged aliases remain denied',()=>{for(const [p,m]of [['/api/projects/PRJ-A/unknown','GET'],['/api/repo/status','GET'],['/api/projects/PRJ-A/agents/a/run','POST'],['/api/projects/PRJ-A','DELETE']])assert.equal(resolve(p,m).kind,'DENY');});
}
console.log(JSON.stringify({suite:'workspace-route-policy',passed,failed}));if(failed)process.exitCode=1;
