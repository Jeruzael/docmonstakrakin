import assert from 'node:assert/strict';
import {mcpAuthorityFixture} from './fixtures/mcpAuthority.ts';
import {createWorkspaceMcpBridge} from '../server/security/workspaceAccess/mcpBridge.ts';

let passed=0,failed=0;
const fixture=await mcpAuthorityFixture();
const bridge=createWorkspaceMcpBridge({origin:fixture.origin,ca:fixture.ca,token:fixture.token});
const call=(b=bridge)=>b.handleMessage({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_task',arguments:{projectId:fixture.projectId,taskId:fixture.taskId}}});
async function check(name:string,fn:()=>Promise<void>){try{await fn();passed++;console.log('PASS '+name);}catch{failed++;console.error('FAIL '+name);}}
try{
 await check('genuinely issued token reads through real native schema-3 authority and TLS',async()=>{const result=await call();assert.equal((result as any).result.isError,false);const data=JSON.parse((result as any).result.content[0].text);assert.equal(data.task.id,fixture.taskId);assert.equal(data.humanApproval,false);assert.deepEqual(Object.keys(data.task).sort(),['description','id','priority','status','title','updatedAt']);});
 await check('never-issued token is separately rejected',async()=>{const unknown=createWorkspaceMcpBridge({origin:fixture.origin,ca:fixture.ca,token:'dmk_agent_v1_'+'c'.repeat(64)});try{assert.equal(((await call(unknown)) as any).result.isError,true);}finally{unknown.close();}});
 await check('current synthetic human sponsor revokes the genuine grant and same token fails',async()=>{await fixture.revoke();const result=await call();assert.equal((result as any).result.isError,true);assert.equal(JSON.parse((result as any).result.content[0].text).error,'MCP_TASK_READ_DENIED');});
}finally{bridge.close();await fixture.close();}
console.log(JSON.stringify({suite:'workspace-mcp-native-authority',passed,failed,qualification:'AGENT_EXECUTED_SYNTHETIC; no real human acceptance'}));if(failed)process.exitCode=1;
