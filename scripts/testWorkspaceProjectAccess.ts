import assert from'node:assert/strict';let passed=0,failed=0;function check(name:string,fn:()=>void){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e);}}
let read:any;try{read=(await import('../src/data/workspaceProjectAccess.ts')).workspaceProjectActions;}catch{}
check('project UI access observation parser exists',()=>assert.equal(typeof read,'function'));
if(read){const data={id:'PRJ-A',workspaceAccess:{projectId:'PRJ-A',policyRevision:2,allowedActions:['project:read','project:write']}};
check('scoped server observation permits ordinary authoring without quorum role inference',()=>assert.deepEqual(read(data),['project:read','project:write']));
check('unavailable observation is distinct from an explicit empty allow set',()=>{assert.equal(read({id:'PRJ-A'}),null);assert.deepEqual(read({...data,workspaceAccess:{...data.workspaceAccess,allowedActions:[]}}),[]);});
check('foreign scope, invalid revision, duplicate and unknown actions deny UI capabilities',()=>{for(const access of[{...data.workspaceAccess,projectId:'PRJ-B'},{...data.workspaceAccess,policyRevision:-1},{...data.workspaceAccess,allowedActions:['project:write','project:write']},{...data.workspaceAccess,allowedActions:['privileged:enable']}])assert.equal(read({...data,workspaceAccess:access}),null);});
check('returned UI actions cannot mutate a server observation',()=>{const actions=read(data);actions.push('project:export');assert.equal(data.workspaceAccess.allowedActions.includes('project:export'),false);});}
console.log(JSON.stringify({suite:'workspace-project-access',passed,failed}));if(failed)process.exitCode=1;
