import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse} from 'yaml';
import {canonicalizeJson} from '../../src/data/selfBootstrapContract.ts';
import {verifySelfBootstrapIntegrity, KNOWN_EVIDENCE_PATHS} from '../bootstrap/selfBootstrapIntegrity.ts';
import {sanitizeAndHashAudit} from '../security/sanitizedAudit.ts';
import {verifyAuditLedgerChain, GENESIS_AUDIT_HASH} from '../security/auditImmutability.ts';
import {writeProjectSnapshotAtomic, resolveProjectStatePath, type ProjectStateSnapshot} from '../projectPersistence.ts';

export const TARGET = 'PRJ-DOCMONSTAKRAKIN';
export const STATUS_MAP = Object.freeze({BACKLOG:'BACKLOG', READY:'READY', IN_PROGRESS:'IN_PROGRESS', VERIFICATION_PENDING:'VERIFICATION', VERIFIED:'VERIFIED'});
// A bounded projection, not a replacement for the repository WBS. Observe-only
// entries make older drift visible without expanding the authorized apply scope.
export const WORK_ITEM_MAP = Object.freeze([
  ['DMK-187','DMK-187',false], ['DMK-188','DMK-188',false], ['DMK-189','DMK-189',false],
  ['DMK-190','DMK-190',false], ['DMK-191','DMK-191',false], ['DMK-192','DMK-192',true],
  ['DMK-193','DMK-193',true], ['DMK-194','DMK-194',true], ['DMK-195','DMK-195',false],
  ['DMK-196','DMK-196',false], ['DMK-197','DMK-197',false], ['DMK-198','DMK-198',false],
  ['DMK-199','DMK-199',false],
] as const);
const MANIFEST = 'bootstrap/docmonstakrakin.self-bootstrap.json';
const WBS = 'docs/00_control/MASTER_WBS.yaml';
const PREFIX = 'docs/07_verification/';
const MANIFEST_DIGEST = '229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36';
// Retained reviewed artifacts, not freshly generated test expectations. The
// execution report's published digest is LF text; raw bytes are additionally
// bound in every plan. No historical file or pristine validator is rewritten.
const RETAINED = {
  'SELF_BOOTSTRAP_DRY_RUN_REVIEW.md':'b0ad8c68bbadef63d98d58ca2f8198f62395bfe65311f0da1a10234852925264',
  'SELF_BOOTSTRAP_EXECUTION_REVIEW.md':'e66095179eeb43bfde9680efd082301a587ad8b5cb1dda7f2f24d3a02c409f04',
  'self-bootstrap-manifest-validation.json':'c8d50cf1fd32aeaf9a6427e9401643ced49481e04adee2d4d11cde4da4a5081d',
  'self-bootstrap-execution-verification.json':'066c07a79c2e9588fb162e82a4560b23b9c098e5564064ea44c180cbcdad95c0',
};
export const digest = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => digest(canonicalizeJson(value));
const ensure = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
const serialize = (snapshot: ProjectStateSnapshot) => JSON.stringify(snapshot, null, 2) + '\n';

export function readReconciliationInputs(root: string) {
  const read = (relative: string) => fs.readFileSync(path.join(root, relative));
  const manifestBytes = read(MANIFEST);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  ensure(hash(manifest) === MANIFEST_DIGEST, 'EVIDENCE_INVALID: historical manifest digest');
  const wbs = parse(read(WBS).toString('utf8'));
  ensure(Array.isArray(wbs.items), 'Invalid WBS items');
  const items = wbs.items as any[];
  ensure(new Set(items.map(i=>i.id)).size === items.length, 'Duplicate WBS IDs');
  for (const [file,pin] of Object.entries(RETAINED)) {
    const bytes = read(PREFIX+file);
    const content = file === 'self-bootstrap-execution-verification.json' ? bytes.toString('utf8').replace(/\r\n/g,'\n') : bytes;
    ensure(digest(content) === pin, `EVIDENCE_INVALID: retained ${file}`);
  }
  const integrity = verifySelfBootstrapIntegrity(manifest,root);
  ensure(integrity.valid, `EVIDENCE_INVALID: ${integrity.errors.join('; ')}`);
  const validation = JSON.parse(read(PREFIX+'self-bootstrap-manifest-validation.json').toString());
  const execution = JSON.parse(read(PREFIX+'self-bootstrap-execution-verification.json').toString());
  ensure(validation.valid === true && validation.errors.length === 0 && validation.mutationCount === 0 &&
    validation.manifestDigest === MANIFEST_DIGEST && validation.documentReferencesChecked === 28 &&
    validation.documentHashesVerified === 24 && validation.evidenceHashesVerified === 4, 'EVIDENCE_INVALID: DMK-192 retained validation');
  ensure(execution.status === 'BOOTSTRAP_VERIFIED' && execution.targetProject === TARGET &&
    execution.manifestDigest === MANIFEST_DIGEST && execution.errors.length === 0 && execution.mutationCount === 0 &&
    execution.unrelatedStateEquivalent === true && execution.baselineUnrelatedStateHash === execution.currentUnrelatedStateHash &&
    execution.currentProjectCount === execution.baselineProjectCount+1 && execution.newProjectIds.join() === TARGET &&
    execution.bootstrapAuditEvents === 1 && execution.auditLedgerValid === true && execution.emptyCollectionsVerified === true &&
    execution.approvalsInjected === 0 && execution.releaseSignoffInjected === false && execution.gate7Executed === false &&
    hash(execution.entityCounts) === hash(integrity.counts), 'EVIDENCE_INVALID: DMK-193 retained execution');
  for (const [id,files] of [['DMK-192',['SELF_BOOTSTRAP_DRY_RUN_REVIEW.md','self-bootstrap-manifest-validation.json']],
    ['DMK-193',['SELF_BOOTSTRAP_EXECUTION_REVIEW.md','self-bootstrap-execution-verification.json']]] as const) {
    const item=items.find(i=>i.id===id);
    ensure(item?.status==='VERIFIED' && files.every(file=>item.evidence?.includes(PREFIX+file)), `EVIDENCE_INVALID: ${id} WBS evidence links`);
    ensure(typeof item.verified_by==='string' && item.verified_by.length>0, `EVIDENCE_INVALID: ${id} verification provenance`);
  }
  ensure(items.find(i=>i.id==='DMK-192').verified_by.includes('Human operator Step 4 review sign-off') &&
    items.find(i=>i.id==='DMK-193').human_approved_by === 'Human operator (self-bootstrap execution ceremony and read-only verification)',
    'EVIDENCE_INVALID: historical human review provenance');
  const dmk194 = items.find(i=>i.id==='DMK-194');
  let dmk194Evidence: string | undefined = undefined;
  const paths = [MANIFEST,WBS,...Object.keys(RETAINED).map(p=>PREFIX+p),
    ...manifest.documents.map((d:any)=>d.path),...Object.values(KNOWN_EVIDENCE_PATHS)];
  if (dmk194?.status === 'VERIFIED') {
    ensure(dmk194.evidence?.includes(PREFIX+'DMK_194_PROJECTS_WORKSPACE_REVIEW.md'), 'EVIDENCE_INVALID: DMK-194 WBS evidence links');
    ensure(typeof dmk194.verified_by === 'string' && dmk194.verified_by.length > 0, 'EVIDENCE_INVALID: DMK-194 verification provenance');
    ensure(typeof dmk194.human_approved_by === 'string' && dmk194.human_approved_by.includes('Human operator'), 'EVIDENCE_INVALID: DMK-194 human review provenance');
    const dmk194File = PREFIX+'DMK_194_PROJECTS_WORKSPACE_REVIEW.md';
    ensure(fs.existsSync(path.join(root, dmk194File)), 'EVIDENCE_INVALID: DMK-194 review file missing');
    paths.push(dmk194File);
    dmk194Evidence = 'VALIDATED';
  }
  const fingerprint = () => Object.fromEntries([...new Set<string>(paths)].sort().map(p=>[p,digest(read(p))]));
  const bindings = fingerprint();
  ensure(hash(bindings) === hash(fingerprint()), 'STALE_INPUTS during evidence validation');
  return {items,bindings,evidence:{'DMK-192':'VALIDATED','DMK-193':'VALIDATED',
    ...(dmk194Evidence ? {'DMK-194': dmk194Evidence} : {}),
    executionReportDigestMode:'published LF-text digest plus exact raw-byte review binding'},manifestDigest:MANIFEST_DIGEST};
}

export interface ReconciliationPlan {
  format: 'DMK_BATCH_A_V1'; projectId: string; actor: string; timestamp: string;
  beforeDigest: string; stateVersion: number | null; inputBindings: Record<string,string>;
  mapping: {wbsId:string;workItemId:string;wbsStatus:string;runtimeStatus:string;mappedStatus:string;apply:boolean}[];
  evidence: ReturnType<typeof readReconciliationInputs>['evidence'];
  changes: {workItemId:string;from:string;to:string;previousUpdatedAt:string}[];
  operationId: string; planDigest: string; candidateDigest: string; auditEvent: any | null;
  mutationCount: 0;
}

/** Pure projection. Changes only three authorized statuses/timestamps, target
 * stateVersion and one chained audit event; all other bytes of data are retained. */
export function projectReconciliation(beforeBytes: Buffer, inputs: ReturnType<typeof readReconciliationInputs>, actor: string, timestamp: string) {
  ensure(/^[\w .@-]{1,100}$/.test(actor), 'Explicit operator actor is required');
  ensure(new Date(timestamp).toISOString() === timestamp, 'Invalid review timestamp');
  const before:ProjectStateSnapshot=JSON.parse(beforeBytes.toString());
  ensure(before.schemaVersion===1 && Array.isArray(before.state?.projects), 'Invalid snapshot');
  const projects=before.state.projects.filter((p:any)=>p.id===TARGET);
  ensure(projects.length===1, 'Expected exactly one self-project');
  const project=projects[0];
  ensure(project.stateVersion===undefined || (Number.isSafeInteger(project.stateVersion)&&project.stateVersion>=0), 'Invalid stateVersion');
  const work=before.state.workItems?.[TARGET];
  ensure(Array.isArray(work) && new Set(work.map((i:any)=>i.id)).size===work.length, 'Missing or duplicate runtime WorkItems');
  ensure(work.length===WORK_ITEM_MAP.length && work.every((i:any)=>WORK_ITEM_MAP.some(([,id])=>id===i.id)), 'Unmapped runtime WorkItem');
  const mapping=WORK_ITEM_MAP.map(([wbsId,workItemId,apply])=>{
    const item=inputs.items.find(i=>i.id===wbsId), runtime=work.find((i:any)=>i.id===workItemId);
    ensure(item && runtime, `Missing mapped item ${wbsId}`);
    ensure(Object.hasOwn(STATUS_MAP,item.status), `Unmapped WBS status for ${wbsId}`);
    return {wbsId,workItemId,wbsStatus:item.status,runtimeStatus:runtime.status,mappedStatus:STATUS_MAP[item.status as keyof typeof STATUS_MAP],apply};
  });
  const changes=mapping.filter(m=>m.apply && m.runtimeStatus!==m.mappedStatus).map(m=>{
    ensure(m.mappedStatus!=='VERIFIED' || (inputs.evidence as any)[m.wbsId]==='VALIDATED', 'VERIFIED requires retained evidence');
    return {workItemId:m.workItemId,from:m.runtimeStatus,to:m.mappedStatus,previousUpdatedAt:work.find((i:any)=>i.id===m.workItemId).updatedAt};
  });
  const logs=before.state.auditLogs?.[TARGET];
  ensure(Array.isArray(logs) && verifyAuditLedgerChain(logs,'REVERSE_CHRONOLOGICAL').valid, 'Invalid existing audit ledger');
  const body={format:'DMK_BATCH_A_V1' as const,projectId:TARGET,actor,timestamp,beforeDigest:digest(beforeBytes),
    stateVersion:project.stateVersion??null,inputBindings:inputs.bindings,mapping,evidence:inputs.evidence,changes,mutationCount:0 as const};
  const operationId=hash(body);
  const candidate=structuredClone(before);
  let auditEvent:any=null;
  if(changes.length) {
    for(const change of changes)Object.assign(candidate.state.workItems[TARGET].find((i:any)=>i.id===change.workItemId),{status:change.to,updatedAt:timestamp});
    candidate.state.projects.find((p:any)=>p.id===TARGET).stateVersion=(project.stateVersion??0)+1;
    auditEvent=sanitizeAndHashAudit({id:`AUD-RECON-${operationId}`,actor,timestamp,action:'WORK_ITEMS_RECONCILED',target:TARGET,
      reason:'Explicitly reviewed Batch A WBS projection; no release or Gate 7 authority',previousHash:logs[0]?.stateHash??GENESIS_AUDIT_HASH,stateHash:'',
      details:{operationId,beforeDigest:body.beforeDigest,inputDigest:hash(inputs.bindings),changes}});
    candidate.state.auditLogs[TARGET].unshift(auditEvent);
  }
  const sealed={...body,operationId,auditEvent,candidateDigest:changes.length?digest(serialize(candidate)):digest(beforeBytes)};
  const plan:ReconciliationPlan={...sealed,planDigest:hash(sealed)};
  return {plan,candidate};
}

export function dryRunReconciliation(stateRoot: string, evidenceRoot: string, actor: string, timestamp=new Date().toISOString()) {
  const before=fs.readFileSync(resolveProjectStatePath(stateRoot));
  const inputs=readReconciliationInputs(evidenceRoot);
  const result=projectReconciliation(before,inputs,actor,timestamp);
  ensure(digest(fs.readFileSync(resolveProjectStatePath(stateRoot)))===result.plan.beforeDigest,'STALE_STATE during dry-run');
  return result.plan;
}

export function applyReconciliation(stateRoot: string, evidenceRoot: string, plan: ReconciliationPlan,
  authorization: {confirmProjectId:string;confirmPlanDigest:string;authorized:boolean},
  hooks?: {beforeRename?:()=>void}) {
  ensure(authorization.authorized===true && authorization.confirmProjectId===TARGET && authorization.confirmPlanDigest===plan.planDigest,
    'EXPLICIT_AUTHORIZATION_REQUIRED');
  const {planDigest,...body}=plan;
  const {candidateDigest,auditEvent}=plan;
  ensure(plan.format==='DMK_BATCH_A_V1' && plan.projectId===TARGET && hash(body)===planDigest,'INVALID_REVIEW_PLAN');
  const currentBytes=fs.readFileSync(resolveProjectStatePath(stateRoot));
  const inputs=readReconciliationInputs(evidenceRoot);
  ensure(hash(inputs.bindings)===hash(plan.inputBindings),'STALE_INPUTS: WBS or evidence changed');
  if(digest(currentBytes)===candidateDigest) {
    const logs=JSON.parse(currentBytes.toString()).state.auditLogs[TARGET];
    ensure(verifyAuditLedgerChain(logs,'REVERSE_CHRONOLOGICAL').valid &&
      (!plan.changes.length || logs.filter((e:any)=>e.id===auditEvent?.id && hash(e)===hash(auditEvent)).length===1),'INVALID_APPLIED_RECEIPT');
    return {status:'ALREADY_APPLIED',mutationCount:0,planDigest};
  }
  ensure(digest(currentBytes)===plan.beforeDigest,'STALE_STATE: reviewed snapshot changed');
  const expected=projectReconciliation(currentBytes,inputs,plan.actor,plan.timestamp);
  ensure(hash(expected.plan)===hash(plan),'INVALID_REVIEW_PLAN');
  writeProjectSnapshotAtomic(expected.candidate,stateRoot,{expectedDigest:plan.beforeDigest,beforeRename:()=>{
    hooks?.beforeRename?.();
    ensure(hash(readReconciliationInputs(evidenceRoot).bindings)===hash(plan.inputBindings),'STALE_INPUTS before commit');
  }});
  return {status:'APPLIED',mutationCount:1,planDigest};
}

/** Independent read-only post-bootstrap check against reviewed before/after.
 * Exact whole-snapshot comparison also proves preservation of unknown fields,
 * unrelated projects, bootstrap ledger history, approvals and Gate 7 state. */
export function verifyReconciliation(before: Buffer, after: Buffer, plan:ReconciliationPlan, evidenceRoot:string) {
  const inputs=readReconciliationInputs(evidenceRoot);
  const expected=projectReconciliation(before,inputs,plan.actor,plan.timestamp);
  ensure(hash(expected.plan)===hash(plan),'INVALID_REVIEW_PLAN');
  ensure(digest(after)===plan.candidateDigest,'POST_RECONCILIATION_MISMATCH');
  const actual=JSON.parse(after.toString());
  ensure(hash(actual)===hash(expected.candidate),'UNEXPECTED_STATE_CHANGE');
  ensure(verifyAuditLedgerChain(actual.state.auditLogs[TARGET],'REVERSE_CHRONOLOGICAL').valid,'AUDIT_INVALID');
  return {status:'RECONCILIATION_VERIFIED',planDigest:plan.planDigest,changes:plan.changes,
    unrelatedStatePreserved:true,gate7Preserved:true,bootstrapEvidencePreserved:true,mutationCount:0};
}
