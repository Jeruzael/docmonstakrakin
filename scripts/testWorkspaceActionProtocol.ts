import assert from 'node:assert/strict';
let passed=0,failed=0;
async function check(name:string,fn:()=>unknown|Promise<unknown>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+String(e));}}
let api:any;try{api=await import('../server/security/workspaceAccess/actionReceipt.ts');}catch{}
await check('versioned action request binding exists',()=>assert.equal(typeof api?.actionRequestHash,'function'));
if(api){
 const input={method:'POST',url:'/api/projects/PRJ-A/work-items',expectedRevision:3,body:{title:'Synthetic',count:1}};
 await check('canonical object order binds the same request while every effectful field changes the digest',()=>{
  const hash=api.actionRequestHash(input);assert.match(hash,/^[a-f0-9]{64}$/);
  assert.equal(api.actionRequestHash({...input,body:{count:1,title:'Synthetic'}}),hash);
  for(const delta of[{method:'PATCH'},{url:input.url+'?mode=other'},{expectedRevision:4},{body:{title:'Changed',count:1}}])assert.notEqual(api.actionRequestHash({...input,...delta}),hash);
 });
 await check('inert bounded canonicalization never executes getters or toJSON',()=>{
  let called=false;const getter=Object.defineProperty({},'x',{enumerable:true,get(){called=true;return 1;}});
  for(const body of[getter,{toJSON(){called=true;return{};}},{n:NaN},new Date(),new Array(2),{s:'\ud800'}])assert.throws(()=>api.actionRequestHash({...input,body}));
  assert.equal(called,false);const deep:any={};let p=deep;for(let i=0;i<66;i++)p=p.next={};assert.throws(()=>api.actionRequestHash({...input,body:deep}));
 });
 await check('protocol rejects malformed revision and unsupported metadata before mutation',()=>{
  for(const expectedRevision of[-1,1.1,Number.MAX_SAFE_INTEGER+1,'3'])assert.throws(()=>api.actionRequestHash({...input,expectedRevision}));
  for(const url of['https://example.test/api/projects','/api/secrets','/api/projects/'+ 'x'.repeat(8193)])assert.throws(()=>api.actionRequestHash({...input,url}));
  assert.throws(()=>api.actionRequestHash({...input,body:'x'.repeat(10*1024*1024+1)}));
 });
}
console.log(JSON.stringify({suite:'workspace-action-protocol',passed,failed}));if(failed)process.exitCode=1;
