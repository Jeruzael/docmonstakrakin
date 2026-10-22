import assert from 'node:assert/strict';
import {validateText,validateGenerated} from '../src/data/generationValidation.js';
import {normalizeProposalChange,ProposalValidationError,proposalForDisplay} from '../src/data/proposalContract.js';
import {validateProposalTargets} from '../server/proposals/targetResolution.js';
import {compileContextPackage} from '../src/data/contextPackageCompiler.js';
import {cryptoDemonProject} from './fixtures/cryptoDemon.js';

let failures=0;
function test(name:string,fn:()=>void){try{fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name,e);}}
const proposed={title:'Validate demo amounts',details:'Malformed, NaN, infinite, negative, and unsupported-precision amounts are rejected.',acceptanceCriteria:['The field may be null. JavaScript may return undefined.']};
const create={proposal_id:'CHG-001',artifact_type:'REQUIREMENT',action:'CREATE',target:null,proposed};
test('historical legacy entries remain readable when current validation is stricter',()=>{const legacy={id:'OLD',type:'REQUIREMENT',action:'CREATE',title:'Legacy',details:'Recorded before v1.1',acceptanceCriteria:['']};const original=structuredClone(legacy);const result=proposalForDisplay(legacy,'1.0',0);assert.equal(result.display,null);assert.equal(typeof result.displayError,'string');assert.deepEqual(legacy,original);assert.throws(()=>normalizeProposalChange(legacy,'1.0',0));});
test('malformed diagnostic identifiers never expose objects to the UI',()=>{for(const field of ['proposal_id','artifact_type'])assert.throws(()=>normalizeProposalChange({...create,[field]:{bad:'identifier'}},'1.1',2),(e:ProposalValidationError)=>{const error=e.toJSON();assert.equal(typeof error.message,'string');assert.equal(error.path.startsWith('proposed_changes[2]'),true);assert(Object.values(error).every(v=>typeof v==='string'));return true;});});
test('legitimate prose words are valid, including standalone JavaScript value names',()=>{for(const s of ['Reject NaN values.','A JSON property may be null.','JavaScript may return undefined.','Reject infinite amounts.','NaN','null','undefined','Infinity','true','false'])validateText(s);validateGenerated({optional:null});});
test('actual non-finite numbers and unresolved serialization artifacts fail',()=>{for(const n of [NaN,Infinity,-Infinity])assert.throws(()=>validateGenerated({value:n}));for(const s of ['[object Object]','[object Array]','{{ANSWER}}','{{walletId}}','${walletId}','<%= value %>','__PLACEHOLDER__'])assert.throws(()=>validateText(s));});
test('schema 1.1 CREATE separates external proposal identity from canonical ID',()=>{const c=normalizeProposalChange(create,'1.1',0);assert.equal(c.proposalId,'CHG-001');assert.equal(c.target,undefined);assert.equal(c.details,proposed.details);assert.throws(()=>normalizeProposalChange({...create,target:{artifact_id:'REQ-CHOSEN',artifact_type:'REQUIREMENT'}},'1.1',0));});
const modify={...create,proposal_id:'CHG-MOD-001',action:'MODIFY',target:{artifact_id:'REQ-A',artifact_type:'REQUIREMENT'}};
const store:any={requirements:{P:[{id:'REQ-A'}],OTHER:[{id:'REQ-OTHER'}]},features:{P:[{id:'FEAT-A'}]}};
test('schema 1.1 resolves the exact canonical target within the current project',()=>{const c=normalizeProposalChange(modify,'1.1',0);assert.equal(c.proposalId,'CHG-MOD-001');assert.equal(c.target?.artifactId,'REQ-A');validateProposalTargets(c,store,'P',0);});
test('missing and cross-project targets produce indexed TARGET_NOT_FOUND',()=>{for(const target of ['REQ-MISSING','REQ-OTHER'])assert.throws(()=>validateProposalTargets(normalizeProposalChange({...modify,target:{artifact_id:target,artifact_type:'REQUIREMENT'}},'1.1',12),store,'P',12),(e:ProposalValidationError)=>e.code==='TARGET_NOT_FOUND'&&e.path==='proposed_changes[12].target.artifact_id'&&e.context.proposal_id==='CHG-MOD-001');});
test('feature mistaken for requirement produces precise TARGET_TYPE_MISMATCH',()=>{assert.throws(()=>validateProposalTargets(normalizeProposalChange({...modify,target:{artifact_id:'FEAT-A',artifact_type:'REQUIREMENT'}},'1.1',0),store,'P',0),(e:ProposalValidationError)=>e.code==='TARGET_TYPE_MISMATCH'&&e.context.expected_type==='FEATURE'&&e.context.received_type==='REQUIREMENT');});
test('manifest scope and canonical type disagreement are enforced',()=>{assert.throws(()=>validateProposalTargets(normalizeProposalChange(modify,'1.1',0),store,'P',0,[]),(e:ProposalValidationError)=>e.code==='TARGET_NOT_EDITABLE');assert.throws(()=>validateProposalTargets(normalizeProposalChange({...modify,target:{artifact_id:'REQ-A',artifact_type:'ADR'}},'1.1',0),store,'P',0),(e:ProposalValidationError)=>e.code==='TARGET_TYPE_MISMATCH');});
test('legacy CREATE and MODIFY normalize without destructively rewriting wire data',()=>{const legacy={type:'REQUIREMENT',id:'REQ-A',action:'MODIFY',...proposed};const copy=structuredClone(legacy);const c=normalizeProposalChange(legacy,'1.0',3);assert.equal(c.target?.artifactId,'REQ-A');assert.equal(c.proposalId,'LEGACY-MODIFY-4');assert.deepEqual(legacy,copy);assert.equal(normalizeProposalChange({...legacy,action:'CREATE'},'1.0',3).target,undefined);});
test('nested external governance and identity fields remain forbidden',()=>{for(const field of ['signatures','approvals','reviewer','roles','authorizedBy','authenticatedIdentity','requiredRoles'])assert.throws(()=>normalizeProposalChange({...create,proposed:{...proposed,[field]:[]}},'1.1',0),(e:ProposalValidationError)=>e.code==='GOVERNANCE_FIELD_FORBIDDEN');assert.throws(()=>normalizeProposalChange({...create,proposed:{...proposed,status:'APPROVED'}},'1.1',0));});
test('compiler emits v1.1 scoped manifest with reference-only features and provenance',()=>{
 const requirements=['REQ-A','REQ-B'].map(id=>({id,title:id,statement:proposed.details,status:'PROPOSED',category:'FUNCTIONAL',priority:'MEDIUM',source:{type:'EXTERNAL_AI_PROPOSAL',id:'IMPORT-REFERENCE'},acceptanceCriteria:[],riskLinks:[],workItems:[]})) as any;
 const work:any={id:'WORK-A',title:'Ledger',description:'Ledger implementation',status:'PROPOSED',priority:'P1',requirements:['REQ-A'],dependencies:[],acceptanceCriteria:[],checklist:[],features:[]};
 const ctx=compileContextPackage({project:cryptoDemonProject,role:'Developer',mode:'TASK_CONTEXT',requirements,activeWorkItem:work});
 assert.deepEqual(ctx.editableArtifacts?.map(a=>a.artifact_id).sort(),['REQ-A','WORK-A']);
 for(const required of ['schema_version 1.1','EDITABLE CANONICAL ARTIFACTS','REFERENCE CONTEXT','proposal_id','target.artifact_id','Never construct or infer a modification target'])assert(ctx.compiledPrompt.includes(required));
 assert(!ctx.compiledPrompt.includes('"id": "Stable identifier"'));assert(!ctx.editableArtifacts?.some(a=>a.artifact_id==='IMPORT-REFERENCE'));
});
test('compiler output examples demonstrate importable text criteria in every scoping mode',()=>{
 for(const mode of ['SUMMARY','TASK_CONTEXT','FULL_BASELINE'] as const){
  const ctx=compileContextPackage({project:cryptoDemonProject,role:'Developer',mode});
  const contract=ctx.compiledPrompt.split('=== MANDATORY AGENT OUTPUT CONTRACT ===')[1].split('=== LEAST-CONTEXT OMISSION REPORT ===')[0];
  const sample=JSON.parse(contract.slice(contract.indexOf('\n{')).trim());
  const criteria=sample.proposed_changes[0].proposed.acceptanceCriteria;
  assert(Array.isArray(criteria)&&criteria.length>0,'The example must demonstrate at least one text criterion, rather than an ambiguous empty array.');
  assert(criteria.every((entry:unknown)=>typeof entry==='string'&&entry.trim().length>0));
  const normalized=normalizeProposalChange(sample.proposed_changes[0],sample.schema_version,0);
  assert.deepEqual(normalized.acceptanceCriteria,criteria);
 }
});
test('non-string proposal array entries report their expected type without changing input',()=>{
 for(const version of ['1.0','1.1'] as const)for(const field of ['acceptanceCriteria','requirements','features','assumptions'])for(const value of [{id:'AC-01',description:'Persist a valid request.',test:'Submit a valid request.',expectedResult:'The request is listed.'},null,42,false,[]]){
  const content={...proposed,[field]:[value]};
  const wire=version==='1.1'?{...create,proposed:content}:{type:'WORK_ITEM',id:'external-work',action:'CREATE',...content};
  const original=structuredClone(wire);
  assert.throws(()=>normalizeProposalChange(wire,version,2),(e:ProposalValidationError)=>{
   const diagnostic=e.toJSON();
   assert.equal(diagnostic.code,'SCHEMA_ERROR');
   assert.equal(diagnostic.path,`proposed_changes[2].${version==='1.1'?'proposed.':''}${field}[0]`);
   assert.match(diagnostic.message,new RegExp(`Expected a string in ${field}; received `));
   assert(Object.values(diagnostic).every(v=>typeof v==='string'));
   return true;
  });
  assert.deepEqual(wire,original);
 }
});
test('plain-text work criteria retain IDs test steps and expected results verbatim',()=>{
 const criteria=['AC-01: Save a valid request. Test: Submit a valid category and description. Expected result: HTTP 201 and a persisted request.','AC-02: List a saved request. Test: Retrieve the request list. Expected result: The saved identifier is present.'];
 const wire={...create,artifact_type:'WORK_ITEM',action:'MODIFY',target:{artifact_id:'WORK-A',artifact_type:'WORK_ITEM'},proposed:{...proposed,acceptanceCriteria:criteria,requirements:['REQ-A'],features:[],assumptions:['Storage remains an open decision.']}};
 const original=structuredClone(wire);
 const normalized=normalizeProposalChange(wire,'1.1',0);
 assert.deepEqual(normalized.acceptanceCriteria,criteria);
 assert.deepEqual(normalized.target,{artifactId:'WORK-A',artifactType:'WORK_ITEM'});
 assert.deepEqual(wire,original);
});
test('empty optional arrays stay valid while blank text entries still fail',()=>{
 assert.deepEqual(normalizeProposalChange({...create,proposed:{...proposed,acceptanceCriteria:[],requirements:[],features:[],assumptions:[]}},'1.1',0).acceptanceCriteria,[]);
 assert.throws(()=>normalizeProposalChange({...create,proposed:{...proposed,acceptanceCriteria:['   ']}},'1.1',0),(e:ProposalValidationError)=>e.code==='SCHEMA_ERROR'&&e.path==='proposed_changes[0].proposed.acceptanceCriteria[0]');
});
process.exitCode=failures?1:0;
