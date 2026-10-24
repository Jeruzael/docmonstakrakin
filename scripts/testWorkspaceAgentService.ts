import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {workspaceTokenDigest} from '../server/security/workspaceAccess/service.ts';
const api:any = await import(new URL('../server/security/workspaceAccess/agentService.ts',import.meta.url).href).catch(()=>null);
let passed=0,failed=0;
async function test(name:string,run:()=>unknown){try{await run();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+String(error));}}
await test('AS01 agent token domain is distinct from HUMAN sessions',()=>{
 assert.ok(api,'Agent service is not implemented');
 const token='dmk_agent_v1_'+'a'.repeat(64);
 assert.equal(api.agentTokenDigest(token),createHash('sha256').update('dmk-agent-session-v1\0'+token).digest('hex'));
 for(const bad of ['a'.repeat(64),token.toUpperCase(),token+' ',null,{},'dmk_agent_v2_'+'a'.repeat(64)])assert.equal(api.agentTokenDigest(bad),null);
 assert.equal(workspaceTokenDigest(token),null);
});
if(api){
 await test('AS06 malformed acknowledgment cannot authorize secret delivery',async()=>{
  const service=new api.WorkspaceAgentService({execute:async()=>({replayed:false,acknowledgment:{sessionId:'unrelated'}})},()=>1000);
  const result=await service.issueAgent('a'.repeat(64),{operationId:'00000000-0000-4000-8000-000000000003',grantId:'grant',expectedGrantRevision:1,expectedPolicyRevision:3});
  assert.equal(result.accepted,false);assert.equal(result.available,false);assert.equal(Object.hasOwn(result,'token'),false);
 });
 await test('AS05 repeated issuance returns historical acknowledgment without a new secret',async()=>{
  const service=new api.WorkspaceAgentService({execute:async(c:any)=>({acknowledgment:{sessionId:'historical',operationId:c.operationId,action:c.command,requestHash:c.requestHash,expectedPolicyRevision:c.expectedPolicyRevision,policyRevision:c.expectedPolicyRevision},replayed:true})},()=>1000);
  const result=await service.issueAgent('a'.repeat(64),{operationId:'00000000-0000-4000-8000-000000000001',grantId:'grant',expectedGrantRevision:1,expectedPolicyRevision:3});
  assert.equal(result.accepted,true);assert.equal(result.tokenAvailable,false);assert.equal(Object.hasOwn(result,'token'),false);
 });
 await test('AS02 invalid tokens and accessor management input never reach authority',async()=>{
  let calls=0,reads=0;const service=new api.WorkspaceAgentService({execute:async()=>{calls++;throw Error();}},()=>1000);
  assert.deepEqual(await service.sessionState('bad'),{available:true,actor:null});
  assert.equal((await service.readTask('bad',{projectId:'P',taskId:'T'})).allowed,false);
  const input=Object.defineProperty({projectId:'P',expectedPolicyRevision:1},'name',{enumerable:true,get(){reads++;return'X';}});
  assert.equal((await service.enrollAgent('a'.repeat(64),input)).accepted,false);
  assert.equal(calls,0);assert.equal(reads,0);
 });
 await test('AS03 issue returns a raw token only after confirmed authority response',async()=>{
  let captured:any;const service=new api.WorkspaceAgentService({execute:async(c:any)=>{captured=c;return{replayed:false,acknowledgment:{sessionId:c.sessionId,operationId:c.operationId,action:c.command,requestHash:c.requestHash,expectedPolicyRevision:c.expectedPolicyRevision,policyRevision:c.expectedPolicyRevision}};}},()=>1000);
  const input={operationId:'00000000-0000-4000-8000-000000000002',grantId:'grant',expectedGrantRevision:1,expectedPolicyRevision:3};
  const result=await service.issueAgent('a'.repeat(64),input);
  assert.equal(result.accepted,true);assert.match(result.token,/^dmk_agent_v1_[a-f0-9]{64}$/);assert.equal(captured.digest,api.agentTokenDigest(result.token));
  assert.equal(captured.sponsorDigest,workspaceTokenDigest('a'.repeat(64)));assert.equal(captured.command,'issueAgent');assert.ok(!JSON.stringify(captured).includes(result.token));
  const failing=new api.WorkspaceAgentService({execute:async()=>{throw Object.assign(Error(),{code:'WORKSPACE_REQUEST_TIMEOUT'});}},()=>1000);
  const failure=await failing.issueAgent('a'.repeat(64),input);
  assert.equal(failure.available,false);assert.equal(failure.accepted,false);assert.equal(Object.hasOwn(failure,'token'),false);
 });
 await test('AS04 adapter forwards exact task scope and fails closed on clock reversal/close',async()=>{
  const calls:any[]=[];let now=1000;const service=new api.WorkspaceAgentService({execute:async(c:any)=>{calls.push(c);return{allowed:true,reason:'ALLOWED',task:{id:'T'}};}},()=>now);
  const token='dmk_agent_v1_'+'b'.repeat(64);assert.equal((await service.readTask(token,{projectId:'P',taskId:'T'})).allowed,true);
  assert.deepEqual(calls[0],{command:'readAgentTask',digest:api.agentTokenDigest(token),projectId:'P',taskId:'T',now:1000});
  now=999;assert.equal((await service.sessionState(token)).available,false);assert.equal(calls.length,1);
  service.close();assert.equal((await service.readTask(token,{projectId:'P',taskId:'T'})).available,false);assert.equal(calls.length,1);
 });
}
console.log(JSON.stringify({suite:'workspace-agent-service',passed,failed}));if(failed)process.exitCode=1;
