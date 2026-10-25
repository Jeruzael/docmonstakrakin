import assert from 'node:assert/strict';let api:any,passed=0,failed=0;try{api=await import('../server/security/workspaceAccess/agentJson.ts');}catch{}
function check(name:string,fn:()=>void){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+String(e));}}
check('bounded agent JSON admission exists',()=>assert.equal(typeof api?.parseAgentJson,'function'));
if(api){
 check('typed nested action input preserves data without executing content',()=>{const value={version:1,action:'grantAgent',scope:{kind:'TASKS',taskIds:['TASK-A']},actions:['task:read'],expiresAt:123};assert.deepEqual(api.parseAgentJson(Buffer.from(JSON.stringify(value))),value);});
 check('decoded duplicate keys and unsafe properties reject at any nesting',()=>{for(const value of['{"action":"read","\\u0061ction":"write"}','{"scope":{"kind":"TASKS","kind":"PROJECT_TASKS"}}','{"__proto__":{}}','{"scope":{"constructor":1}}','{"toJSON":"no"}'])assert.throws(()=>api.parseAgentJson(Buffer.from(value)));});
 check('malformed UTF8 JSON trailing data and nonfinite numbers reject',()=>{for(const b of[Buffer.from([0xc0,0xaf]),Buffer.from('{"x":1}null'),Buffer.from('{"x":1e999}'),Buffer.from('{"x":"\\ud800"}'),Buffer.from('{"x":}'),Buffer.from('[]')])assert.throws(()=>api.parseAgentJson(b));});
 check('16KiB and depth8 bounds reject without silent truncation',()=>{assert.throws(()=>api.parseAgentJson(Buffer.from(JSON.stringify({x:'a'.repeat(16384)}))));let v:any={};for(let i=0;i<10;i++)v={next:v};assert.throws(()=>api.parseAgentJson(Buffer.from(JSON.stringify(v))));assert.deepEqual(api.parseAgentJson(Buffer.from('{"x":[]}')),{x:[]});});
 check('canonical numeric strings and escaped ordinary Unicode remain literal data',()=>assert.deepEqual(api.parseAgentJson(Buffer.from('{"x":"001","text":"hello \\u4e16\\u754c","flag":false}')),{x:'001',text:'hello 世界',flag:false}));
}
console.log(JSON.stringify({suite:'agent-json',passed,failed}));if(failed)process.exitCode=1;
