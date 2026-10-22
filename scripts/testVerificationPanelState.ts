import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Actual component handlers with a small in-memory hook adapter; browser scheduling remains a parent check.
const principal=(id:string)=>({identityId:id,username:id,personId:`person-${id}`,roles:['Security Officer'],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'});
const bundle={commitSha:'a'.repeat(40),buildRevision:'fixture',environment:'local',criterionResults:[{criterionIndex:0,result:'PASS',notes:'Observed',evidenceIds:['EV-1']}],evidence:[{id:'EV-1',kind:'MANUAL',encoding:'UTF8',content:'Observed',sha256:'a'.repeat(64),byteLength:8,provenance:'HUMAN_ATTESTED_INLINE'}]};
const session={id:'VER-UI',projectId:'A',workItemId:'TASK-1',author:principal('author'),status:'SUBMITTED',acceptanceCriteria:['Criterion'],draft:bundle,submitted:{digest:'d'.repeat(64),bundle},decisions:[]};
const summary={id:session.id,projectId:'A',workItemId:'TASK-1',author:session.author,status:session.status,...{commitSha:bundle.commitSha,buildRevision:bundle.buildRevision,environment:bundle.environment}};
function fixture() {
 const values:any[]=[],effects:(()=>void|(()=>void))[]=[],cleanups:(()=>void)[]=[],requests:any[]=[],acknowledgements:any[]=[];let cursor=0,started=false,tree:any;
 const react={useState(initial:any){const k=cursor++;if(!(k in values))values[k]=typeof initial==='function'?initial():initial;return [values[k],(next:any)=>{values[k]=typeof next==='function'?next(values[k]):next;}];},useRef(initial:any){const k=cursor++;if(!(k in values))values[k]={current:initial};return values[k];},useEffect(effect:any){if(!started)effects.push(effect);}};
 const jsx=(type:any,props:any)=>({type,props});const exports:any={};
 const source=ts.transpileModule(fs.readFileSync('src/components/VerificationPanel.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:Object.create(null),AbortController,setTimeout,clearTimeout,crypto:globalThis.crypto,TextEncoder,atob,btoa,fetch:(url:string,init:any)=>new Promise((resolve,reject)=>requests.push({url,init,resolve,reject}))});
 const render=()=>{cursor=0;tree=exports.VerificationPanel({projectId:'A',workItems:[{id:'TASK-1',acceptanceCriteria:['Criterion']}],onChanged:(...args:any[])=>acknowledgements.push(args)});if(!started){started=true;for(const effect of effects){const cleanup=effect();if(cleanup)cleanups.push(cleanup);}}return tree;};
 const all=(node:any=tree):any[]=>Array.isArray(node)?node.flatMap(child=>child===undefined?[]:all(child)):node?.props?[node,...(node.props.children===undefined?[]:all(node.props.children))]:[];
 const text=(node:any=tree):string=>Array.isArray(node)?node.map(child=>child===undefined?'':text(child)).join(' '):node?.props?(node.props.children===undefined?'':text(node.props.children)):typeof node==='string'||typeof node==='number'?String(node):'';
 const button=(label:string)=>{const node=all().find(n=>n.type==='button'&&text(n)===label);assert.ok(node,`Missing ${label}`);return node;};
 const label=(name:string)=>{const node=all().find(n=>n.type==='label'&&text(n).trim()===name);assert.ok(node,`Missing label ${name}`);return all(node).find(n=>n.type==='input');};
 const flush=async()=>{await new Promise<void>(r=>setImmediate(r));render();};
 const reply=async(index:number,body:any,status=200)=>{assert.ok(requests[index],`Missing request ${index}`);requests[index].resolve(new Response(JSON.stringify(body),{status}));await flush();};
 render();return {render,all,text,button,label,requests,reply,flush,acknowledgements,close:()=>{for(const cleanup of cleanups)cleanup();}};
}
const list=(identity=principal('reviewer'))=>({sessions:[summary],reviews:[],identity,stateVersion:1,requiredRoles:['Security Officer','Lead Architect']});
const detail=(identity=principal('reviewer'))=>({session,review:{sessionId:session.id,eligible:false,reason:'Pending'},identity,stateVersion:1,requiredRoles:['Security Officer','Lead Architect']});
let passed=0;
for(const mode of ['reload','identity-response','identity-conflict','malformed-ack','unsafe-ack','wrong-increment'] as const) {
 const f=fixture();try {
  await f.reply(0,list());f.button('VER-UI').props.onClick();assert.equal(f.requests.length,2,'selecting a summary fetches its bounded detail');await f.flush();await f.reply(1,detail());
  f.label('I reviewed this exact submitted digest').props.onChange({target:{checked:true}});f.label('I attest I am a different person from the author and other reviewers').props.onChange({target:{checked:true}});f.render();assert.equal(f.button('Record review decision').props.disabled,false);
  if(mode==='reload') {
   f.button('Reload sessions').props.onClick();f.render();assert.equal(f.all().filter(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true).length,0,'reload immediately clears personal confirmations');await f.reply(2,list(principal('different')));f.button('VER-UI').props.onClick();await f.flush();await f.reply(3,detail(principal('different')));assert.equal(f.label('I reviewed this exact submitted digest').props.checked,false);assert.equal(f.label('I attest I am a different person from the author and other reviewers').props.checked,false);assert.equal(f.button('Record review decision').props.disabled,true);
  } else {
   const form=f.all().find(n=>n.type==='form'&&f.all(n).some(child=>child.type==='button'&&f.text(child)==='Record review decision'));form.props.onSubmit({preventDefault(){}});await f.flush();const payload=JSON.parse(f.requests[2].init.body);assert.deepEqual(payload.expectedReviewer,{identityId:'reviewer',personId:'person-reviewer'},'personal confirmation binds to the displayed reviewer');
   if(mode==='identity-response'||mode==='identity-conflict') {
    await f.reply(2,mode==='identity-response'?{...detail(principal('different')),stateVersion:2}:{error:'REVIEWER_IDENTITY_STALE',identity:principal('different')},mode==='identity-response'?200:409);
    assert.match(f.text(),/Authenticated reviewer:.*different/s,'actual returned principal replaces prior display');assert.equal(f.all().filter(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true).length,0,'changed response principal clears all personal confirmations');
    assert.deepEqual(f.acknowledgements,mode==='identity-response'?[['A',2]]:[],'only validated success acknowledges the exact project version floor');
   } else {
    await f.reply(2,{...detail(),stateVersion:mode==='malformed-ack'?'2':mode==='unsafe-ack'?Number.MAX_SAFE_INTEGER+1:3});assert.equal(f.acknowledgements.length,0,'malformed or non-successor acknowledgement never advances parent version floor');assert.match(f.text(),/cannot be confirmed/);
   }
  }
  passed++;console.log(`PASS verification panel ${mode} clears personal confirmation and preserves actual identity`);
 }finally{f.close();}
}
console.log(`Verification panel state: ${passed} passed`);
