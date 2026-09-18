import assert from 'node:assert/strict';
import { DISCOVERY_QUESTION_CATALOG } from '../src/data/discoveryCatalog.js';
import { filterQuestionsForProject, deriveArtifactsFromAnswer, calculateDiscoveryCoverage } from '../src/data/derivationEngine.js';
import { compileContextPackage } from '../src/data/contextPackageCompiler.js';
import { cryptoDemonProject } from './fixtures/cryptoDemon.js';
import { baselineFeatures, normalizeTechChoice, computeAssurance } from '../src/data/projectInitialization.js';
import { validateText } from '../src/data/generationValidation.js';
import { applicableStandards } from '../src/data/standardsApplicability.js';

let failed = 0;
function test(name: string, run: () => void) { try { run(); console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}`, (e as Error).message); } }
const questions = filterQuestionsForProject(structuredClone(DISCOVERY_QUESTION_CATALOG), cryptoDemonProject);
test('unanswered identity does not activate account recovery', () => assert(!questions.some(q => q.id === 'AUTH-Q-014')));
test('AI and agent questions absent', () => assert(!questions.some(q => q.domain === 'AI' || q.domain === 'AGENTIC_AI')));
test('all 19 domains have explicit status and source', () => { const c = calculateDiscoveryCoverage(questions, cryptoDemonProject); assert.equal(c.domainSummaries.length, 19); assert(c.domainSummaries.every(d => (d as any).status && (d as any).source)); });
test('summary does not activate AI standards', () => assert(!compileContextPackage({project: cryptoDemonProject, role: 'Architect', mode: 'SUMMARY'}).compiledPrompt.includes('AISVS')));
test('structured runtime settings never coerce to object Object', () => { const q = questions.find(q => q.id === 'ARCH-Q-003')!; const r = deriveArtifactsFromAnswer(q, {host: 'localhost'} as any); assert(!JSON.stringify(r.requirements).includes('[object Object]')); });
test('substitutes every acceptance criterion token', () => { const q = {...questions[0], derivationRules: [{id: 'TEST-RULE', outputType: 'REQUIREMENT' as const, targetTitle: 'Demo transfer', targetStatement: '{{ANSWER}} / {{ANSWER}}', acceptanceCriteria: ['Verify {{ANSWER}}']}]}; const r = deriveArtifactsFromAnswer(q, 'DEMON'); assert(!JSON.stringify(r.requirements).includes('{{')); });
test('malformed template is rejected', () => { assert.throws(() => deriveArtifactsFromAnswer({...questions[0], derivationRules: [{id: 'BAD', outputType: 'REQUIREMENT', targetStatement: '{{MISSING}}'}]}, 'DEMON')); });
test('feature reopen and save are idempotent', () => {const first=baselineFeatures(cryptoDemonProject);const second=baselineFeatures(cryptoDemonProject,first);assert.deepEqual(second,first);assert.equal(first.length,8);assert(first.every(f=>f.provenance?.projectId===cryptoDemonProject.id));});
test('recommendation candidate does not bind until acceptance', () => { const candidate:any={type:'RECOMMEND_FOR_ME',recommendation:{status:'PROPOSED',preferredTechnology:'PostgreSQL'},value:'PostgreSQL',finalSelection:'PostgreSQL'};assert.equal(normalizeTechChoice(candidate).finalSelection,null);candidate.recommendation.status='ACCEPTED';const selected=normalizeTechChoice(candidate);assert.equal(selected.finalSelection,'PostgreSQL');assert.equal(selected.status,'NOT_RATIFIED');});
test('UNKNOWN clears legacy host and stale selection aliases', () => { const c=normalizeTechChoice({type:'UNKNOWN',value:'AI_STUDIO_WORKSPACE',final_selection:'GIT',finalSelection:'AI_STUDIO_WORKSPACE'});assert.equal(c.finalSelection,null);assert.equal(c.value,null); });
test('risk calculation preserves floor and elevates declared exposure', () => {const a=cryptoDemonProject.assuranceInputs!;assert.equal(computeAssurance(a).score,12);assert.equal(computeAssurance({...a,productionSecrets:true}).level,'HIGH');assert.equal(computeAssurance({...a,productionSecrets:true,autonomousAgentExecution:true}).level,'CRITICAL');});
test('all malformed substitution patterns are rejected', () => {for(const v of ['[object Object]','[object Array]','{{ANSWER}}','undefined','NaN','null',null]) assert.throws(()=>validateText(v));});
test('standards agree across all context modes', () => {const expected=applicableStandards(cryptoDemonProject);assert(!expected.some(s=>s.standardId==='OWASP_AISVS'));for(const mode of ['SUMMARY','TASK_CONTEXT','FULL_BASELINE'] as const){const c=compileContextPackage({project:cryptoDemonProject,role:'Architect',mode});assert(!c.compiledPrompt.includes('AISVS'));expected.forEach(s=>assert(c.compiledPrompt.includes(s.standardName)));}});
test('deferred blockers and unresolved target source control are not ready', () => {const c=calculateDiscoveryCoverage(questions.map(q=>({...q,state:'DEFERRED'})),cryptoDemonProject);assert.equal(c.isComplete,false);assert(c.domainSummaries.find(d=>d.domain==='SOURCE_CONTROL_AND_DEVELOPMENT_ENVIRONMENT')!.openItems>0);});
process.exitCode = failed ? 1 : 0;
