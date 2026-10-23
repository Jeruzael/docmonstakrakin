import crypto from 'node:crypto';
import express, {type Request, type Response} from 'express';
import type {ProjectStore} from '../projectStore.ts';
import type {ReviewerIdentity} from '../proposals/identity.ts';
import {isWorkspaceIdentity} from '../security/workspaceAccess/identity.ts';
import type {ProjectManagedDocument, ProjectManagedDocuments} from '../../src/managedDocumentTypes.ts';
import type {ControlledDocumentKind} from '../../src/types.ts';
import {computeDocumentDiff} from './controlledDocsValidator.ts';
import {assertDocumentTransactionsUnlocked} from './controlledDocsRecovery.ts';
import {SELF_BOOTSTRAP_PROJECT_ID} from './controlledDocsRegistry.ts';

const KINDS = new Set(['PRODUCT','REQUIREMENTS','ARCHITECTURE','SECURITY','VERIFICATION','OPERATIONS']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^MDOC-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_CONTENT_BYTES = 128 * 1024;
const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENTS = 100;
const MAX_REQUEST_IDS = 1024;
type Store = ProjectStore & {managedDocuments?: ProjectManagedDocuments};
class ManagedDocumentError extends Error {
  constructor(readonly status: number, message: string) {super(message);}
}
const fail = (status: number, code: string): never => {throw new ManagedDocumentError(status,code);};
const digest = (content: string) => crypto.createHash('sha256').update(content,'utf8').digest('hex');
const unsafeText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
function validTitle(title: unknown): title is string {
  return typeof title==='string' && title===title.trim() && title.length>0 && title.length<=120 &&
    Buffer.from(title,'utf8').toString('utf8')===title &&
    !unsafeText.test(title) && !/[<>\[\]{}\\/:*?"|`]/.test(title) && !title.includes('..');
}
function contentErrors(content: unknown): string[] {
  if(typeof content!=='string')return ['INVALID_DOCUMENT_CONTENT'];
  const normalizedContent=content.replace(/\r\n?/g,'\n');
  const errors: string[]=[];
  if(!normalizedContent.trim())errors.push('DOCUMENT_EMPTY');
  if(Buffer.byteLength(normalizedContent,'utf8')>MAX_CONTENT_BYTES)errors.push('DOCUMENT_TOO_LARGE');
  if(normalizedContent.split('\n').length>1001)errors.push('DOCUMENT_TOO_MANY_LINES');
  if(Buffer.from(normalizedContent,'utf8').toString('utf8')!==normalizedContent)errors.push('INVALID_UTF8');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalizedContent))errors.push('DOCUMENT_CONTROL_CHARACTERS');
  // Markdown is rendered by the existing safe renderer. Reject active markup as
  // input too, so future consumers cannot accidentally interpret stored HTML.
  if(/<\s*\/?\s*[a-z!]|(?:javascript|vbscript|data)\s*:/i.test(normalizedContent))errors.push('DOCUMENT_ACTIVE_MARKUP_PROHIBITED');
  return errors;
}
function normalizeContent(content: unknown): string {
  const normalized=typeof content==='string'?content.replace(/\r\n?/g,'\n'):content;
  const errors=contentErrors(normalized);
  if(errors.length)fail(422,errors[0]);
  return normalized as string;
}
function assertStoredDocument(doc: any, projectId: string): asserts doc is ProjectManagedDocument {
  const keys=['id','projectId','path','title','kind','format','content','sha256Digest','createdAt','updatedAt','requestIds'];
  if(!doc || typeof doc!=='object' || Array.isArray(doc) || Object.keys(doc).some(k=>!keys.includes(k)) ||
    !ID.test(doc.id) || doc.projectId!==projectId || !validTitle(doc.title) || !KINDS.has(doc.kind) ||
    !['MARKDOWN','TEXT'].includes(doc.format) || contentErrors(doc.content).length || doc.content.includes('\r') ||
    !HASH.test(doc.sha256Digest) || digest(doc.content)!==doc.sha256Digest ||
    doc.path!==`managed-documents/${doc.id}.${doc.format==='MARKDOWN'?'md':'txt'}` ||
    typeof doc.createdAt!=='string' || !Number.isFinite(Date.parse(doc.createdAt)) ||
    typeof doc.updatedAt!=='string' || !Number.isFinite(Date.parse(doc.updatedAt)) ||
    !Array.isArray(doc.requestIds) || doc.requestIds.length<1 || doc.requestIds.length>MAX_REQUEST_IDS ||
    doc.requestIds.some((id: unknown)=>typeof id!=='string'||!UUID.test(id)) || new Set(doc.requestIds).size!==doc.requestIds.length) {
    fail(500,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
  }
}
/** Shared strict validation for persistence/package integration. No filesystem reads or writes. */
export function validateProjectManagedDocuments(records: unknown, projectId: string): asserts records is ProjectManagedDocument[] {
  if(projectId===SELF_BOOTSTRAP_PROJECT_ID || !Array.isArray(records) || records.length>MAX_DOCUMENTS)fail(500,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
  const ids=new Set<string>(), names=new Set<string>(), requests=new Set<string>(); let bytes=0;
  for(const doc of records as unknown[]) {
    assertStoredDocument(doc,projectId);
    const name=doc.title.toLowerCase();
    if(ids.has(doc.id)||names.has(name)||doc.requestIds.some(id=>requests.has(id)))fail(500,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
    ids.add(doc.id);names.add(name);doc.requestIds.forEach(id=>requests.add(id));bytes+=Buffer.byteLength(doc.content,'utf8');
  }
  if(bytes>MAX_PROJECT_BYTES)fail(500,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
}
function recordsFor(store: Store, projectId: string): ProjectManagedDocument[] {
  if(store.managedDocuments!==undefined && (!store.managedDocuments || typeof store.managedDocuments!=='object' || Array.isArray(store.managedDocuments))) {
    fail(500,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
  }
  const records=Object.hasOwn(store.managedDocuments??{},projectId)?store.managedDocuments![projectId]:[];
  validateProjectManagedDocuments(records,projectId);return records;
}
function summary(doc: ProjectManagedDocument) {
  return {id:doc.id,path:doc.path,title:doc.title,kind:doc.kind,authority:'REFERENCE',editability:'CONTROLLED_EDIT',
    fileType:doc.format==='MARKDOWN'?'MARKDOWN':'OTHER',editableLivingDoc:true,managed:true,
    description:'Project document; creation and editing confer no governance approval or trust.',
    sha256Digest:doc.sha256Digest,currentSha256:doc.sha256Digest,integrityStatus:'MATCH',sizeBytes:Buffer.byteLength(doc.content,'utf8'),eol:doc.content.includes('\n')?'LF':'NONE'};
}
function bodyKeys(body: any, allowed: string[]) {
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'MANAGED_DOCUMENT_FIELDS_PROHIBITED');
}
function commonWrite(store: Store, req: Request, res: Response, requireHuman: (req:Request,res:Response)=>ReviewerIdentity|undefined) {
  const reviewer=requireHuman(req,res);if(!reviewer)return;
  if(reviewer.kind!=='HUMAN'||reviewer.roleSource!=='LOCAL_SERVER_ROSTER'||(!isWorkspaceIdentity(reviewer)&&!reviewer.roles.some(r=>['Security Officer','Lead Architect'].includes(r))))fail(403,'HUMAN_REVIEWER_REQUIRED');
  if(res.locals.projectPersistenceMode!=='MUTATING'||!store.managedDocuments)fail(503,'MANAGED_DOCUMENT_PERSISTENCE_REQUIRED');
  const project=store.projects.find(p=>p.id===req.params.id);if(!project)fail(404,'PROJECT_NOT_FOUND');
  if(project.id===SELF_BOOTSTRAP_PROJECT_ID)fail(403,'MANAGED_DOCUMENT_PROJECT_PROTECTED');
  if(!Number.isSafeInteger(req.body.expectedStateVersion)||req.body.expectedStateVersion<0)fail(422,'EXPECTED_STATE_VERSION_REQUIRED');
  if(req.body.expectedStateVersion!==project.stateVersion)fail(409,'STALE_STATE');
  if(project.stateVersion>=Number.MAX_SAFE_INTEGER)fail(409,'PROJECT_STATE_VERSION_LIMIT');
  if(req.body.humanConfirmed!==true)fail(422,'HUMAN_CONFIRMATION_REQUIRED');
  if(typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>500||unsafeText.test(req.body.reason)||/[<>]/.test(req.body.reason))fail(422,'DOCUMENT_SAVE_REASON_REQUIRED');
  if(typeof req.body.requestId!=='string'||!UUID.test(req.body.requestId))fail(422,'DOCUMENT_REQUEST_ID_REQUIRED');
  try{assertDocumentTransactionsUnlocked();}catch{fail(500,'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED');}
  const records=recordsFor(store,project.id);
  if(records.some(doc=>doc.requestIds.includes(req.body.requestId)))fail(409,'DOCUMENT_REQUEST_REPLAYED');
  return {reviewer,project,records};
}
/** Handles snapshot-owned external documents before the unchanged filesystem registry router. */
export function createProjectManagedDocumentsRouter(store: Store, requireHuman: (req:Request,res:Response)=>ReviewerIdentity|undefined) {
  const router=express.Router();
  const run=(operation:(req:Request,res:Response)=>unknown)=>(req:Request,res:Response)=>{
    try{return operation(req,res);}catch(error){return res.status(error instanceof ManagedDocumentError?error.status:500).json({error:error instanceof ManagedDocumentError?error.message:'MANAGED_DOCUMENT_UPDATE_FAILED'});}
  };
  // Ordinary-project routes are deliberately dispatched here, never to disk code.
  router.post('/:id/docs',run((req,res)=>{
    bodyKeys(req.body,['title','kind','format','content','expectedStateVersion','reason','humanConfirmed','requestId']);
    const context=commonWrite(store,req,res,requireHuman);if(!context)return;
    const {project,reviewer,records}=context;
    const title=typeof req.body.title==='string'?req.body.title.trim():req.body.title;
    if(!validTitle(title))fail(422,'INVALID_DOCUMENT_TITLE');
    if(!KINDS.has(req.body.kind)||!['MARKDOWN','TEXT'].includes(req.body.format))fail(422,'INVALID_DOCUMENT_FORMAT_OR_KIND');
    const content=normalizeContent(req.body.content);
    if(records.length>=MAX_DOCUMENTS)fail(409,'MANAGED_DOCUMENT_LIMIT');
    if(records.some(doc=>doc.title.toLowerCase()===title.toLowerCase()))fail(409,'DOCUMENT_TITLE_EXISTS');
    if(records.reduce((n,d)=>n+Buffer.byteLength(d.content,'utf8'),0)+Buffer.byteLength(content,'utf8')>MAX_PROJECT_BYTES)fail(422,'MANAGED_DOCUMENT_PROJECT_SIZE_LIMIT');
    const id=`MDOC-${crypto.randomUUID()}`,timestamp=new Date().toISOString();
    const doc: ProjectManagedDocument={id,projectId:project.id,path:`managed-documents/${id}.${req.body.format==='MARKDOWN'?'md':'txt'}`,title,kind:req.body.kind as ControlledDocumentKind,format:req.body.format,content,sha256Digest:digest(content),createdAt:timestamp,updatedAt:timestamp,requestIds:[req.body.requestId]};
    store.managedDocuments![project.id]=[...records,doc];
    const audit=store.addAuditEvent(project.id,reviewer.name,'DOCUMENT_CREATED',id,req.body.reason.trim(),{path:doc.path,newSha256:doc.sha256Digest,requestId:req.body.requestId,governanceApprovalGranted:false},`AUD-MDOC-${crypto.randomUUID()}`);
    project.stateVersion++;
    return res.status(201).json({success:true,projectId:project.id,documentId:id,path:doc.path,newSha256:doc.sha256Digest,stateVersion:project.stateVersion,auditEventId:audit.id,timestamp:audit.timestamp});
  }));
  router.get('/:id/docs',(req,res,next)=>{
    if(req.params.id===SELF_BOOTSTRAP_PROJECT_ID)return next();
    return run((req,res)=>{
      if(!store.projects.some(p=>p.id===req.params.id))fail(404,'PROJECT_NOT_FOUND');
      return res.json(recordsFor(store,req.params.id).map(summary));
    })(req,res);
  });
  router.get('/:id/docs/:documentId',(req,res,next)=>{
    if(req.params.id===SELF_BOOTSTRAP_PROJECT_ID)return next();
    return run((req,res)=>{
      const project=store.projects.find(p=>p.id===req.params.id);if(!project)fail(404,'PROJECT_NOT_FOUND');
      const doc=recordsFor(store,project.id).find(d=>d.id===req.params.documentId);if(!doc)fail(404,'DOCUMENT_NOT_FOUND');
      const item=summary(doc);
      return res.json({document:item,content:doc.content,rawSha256:doc.sha256Digest,eol:item.eol,sizeBytes:item.sizeBytes,projectId:project.id,stateVersion:project.stateVersion});
    })(req,res);
  });
  for(const action of ['diff','validate','save'])router.post(`/:id/docs/:documentId/${action}`,(req,res,next)=>{
    if(req.params.id===SELF_BOOTSTRAP_PROJECT_ID)return next();
    return run((req,res)=>{
      const allowed=action==='save'?['candidateContent','baseSha256','expectedStateVersion','reason','humanConfirmed','requestId']:action==='diff'?['candidateContent','baseSha256']:['candidateContent'];
      bodyKeys(req.body,allowed);
      const context=action==='save'?commonWrite(store,req,res,requireHuman):undefined;
      if(action==='save'&&!context)return;
      const project=context?.project??store.projects.find(p=>p.id===req.params.id);if(!project)fail(404,'PROJECT_NOT_FOUND');
      const records=context?.records??recordsFor(store,project.id);
      const doc=records.find(d=>d.id===req.params.documentId);if(!doc)fail(404,'DOCUMENT_NOT_FOUND');
      if(action==='validate')return res.json({documentId:doc.id,valid:contentErrors(req.body.candidateContent).length===0,errors:contentErrors(req.body.candidateContent),warnings:[]});
      const candidateContent=normalizeContent(req.body.candidateContent),candidateSha256=digest(candidateContent);
      if(typeof req.body.baseSha256!=='string'||!/^[0-9a-fA-F]{64}$/.test(req.body.baseSha256))fail(422,'INVALID_BASE_SHA256');
      const baseSha256=req.body.baseSha256.toLowerCase();
      if(action==='diff')return res.json({documentId:doc.id,...computeDocumentDiff({originalContent:doc.content,candidateContent,baseSha256,currentSha256:doc.sha256Digest,candidateSha256})});
      if(baseSha256!==doc.sha256Digest)fail(409,'DOCUMENT_STALE');
      if(candidateSha256===doc.sha256Digest)fail(409,'DOCUMENT_UNCHANGED');
      if(doc.requestIds.length>=MAX_REQUEST_IDS)fail(409,'MANAGED_DOCUMENT_HISTORY_LIMIT');
      if(records.reduce((n,d)=>n+Buffer.byteLength(d.id===doc.id?candidateContent:d.content,'utf8'),0)>MAX_PROJECT_BYTES)fail(422,'MANAGED_DOCUMENT_PROJECT_SIZE_LIMIT');
      const previousSha256=doc.sha256Digest;
      const updated={...doc,content:candidateContent,sha256Digest:candidateSha256,updatedAt:new Date().toISOString(),requestIds:[...doc.requestIds,req.body.requestId]};
      store.managedDocuments![project.id]=records.map(d=>d.id===doc.id?updated:d);
      const audit=store.addAuditEvent(project.id,context!.reviewer.name,'DOCUMENT_UPDATED',doc.id,req.body.reason.trim(),{path:doc.path,previousSha256,newSha256:candidateSha256,requestId:req.body.requestId,governanceApprovalGranted:false},`AUD-MDOC-${crypto.randomUUID()}`);
      project.stateVersion++;
      return res.json({success:true,documentId:doc.id,path:doc.path,previousSha256,newSha256:candidateSha256,stateVersion:project.stateVersion,auditEventId:audit.id,timestamp:audit.timestamp});
    })(req,res);
  });
  return router;
}
