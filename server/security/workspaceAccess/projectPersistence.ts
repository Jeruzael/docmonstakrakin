import type {Express} from 'express';
import type {ProjectStore} from '../../projectStore.ts';
import {classifyProjectRequestMode,hydrateProjectStoreFromSnapshot,snapshotProjectStore,type ProjectPersistenceHooks} from '../../projectPersistence.ts';
import {actionRequestHash} from './actionReceipt.ts';
type Authority={execute(command:any):Promise<any>};
const operationId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

/** In enforced mode SQLite owns the snapshot; the old JSON migration input is never overwritten. */
export async function installWorkspaceProjectPersistence(app:Express,store:ProjectStore,authority:Authority){
 const initial=await authority.execute({command:'snapshot'});let revision=initial.snapshotRevision;
 const receiptCapable=initial.actionReceipts===true;
 // Historical hydration permits omitted collections to retain constructor
 // seeds. Operational snapshots must never inherit those unrelated projects.
 for(const key of Object.keys(store))(store as any)[key]=key==='projects'?[]:{};
 if(initial.stateJson!==null)hydrateProjectStoreFromSnapshot(store,JSON.parse(initial.stateJson));
 let inFlight=false,requiresRecovery=false;
 app.use('/api/projects',(req,res,next)=>{
  // Handlers use one shared in-memory projection. Neither readers nor writers
  // may observe it while a durable transaction outcome is pending.
  if(requiresRecovery)return void res.status(503).json({error:'WORKSPACE_RECOVERY_REQUIRED'});
  if(inFlight)return void res.status(409).json({error:'WORKSPACE_TRANSACTION_IN_PROGRESS'});
  const authorization=res.locals.workspaceAuthorization;
  // This middleware follows existing session, CSRF and route authorization.
  // Never disclose capability/revision to a caller lacking that admission.
  if(authorization?.digest||res.locals.workspaceDiscoveryRevision===revision){res.setHeader('X-DMK-Workspace-Revision',String(revision));if(receiptCapable)res.setHeader('X-DMK-Action-Protocol','1');}
  const protocol=req.headers['x-dmk-action-protocol'];
  if(protocol!==undefined&&protocol!=='1')return void res.status(400).json({error:'WORKSPACE_ACTION_PROTOCOL_INVALID'});
  if(protocol==='1'&&!receiptCapable)return void res.status(409).json({error:'WORKSPACE_ACTION_PROTOCOL_UNAVAILABLE'});
  // Import's authorization changes from create to import after first success.
  // Protocol1 must not reinterpret a stored action or silently fall back.
  if(protocol==='1'&&req.method==='POST'&&/^\/package\/import\/?$/i.test(req.path))return void res.status(400).json({error:'WORKSPACE_ACTION_ROUTE_UNSUPPORTED'});
  const auditedExport=['GET','HEAD'].includes(req.method)&&/\/package\/export\/?$/i.test(req.path);
  const mutation=['POST','PATCH','PUT','DELETE'].includes(req.method)||auditedExport;
  if(!mutation)return next();
  const mode=req.method==='POST'&&/^\/package\/verify\/?$/i.test(req.path)?'READ_ONLY':classifyProjectRequestMode(req);res.locals.projectPersistenceMode=mode;
  if(mode==='READ_ONLY')return next();
  const id=req.headers['x-dmk-request-id'];if(!operationId(id))return void res.status(400).json({error:'WORKSPACE_OPERATION_ID_REQUIRED'});
  if(!authorization?.digest||authorization.snapshotRevision!==revision)return void res.status(409).json({error:'WORKSPACE_REVISION_STALE'});
  let requestHash:string|undefined,expectedRevision:number|undefined;
  if(protocol==='1'){
   const expected=req.headers['x-dmk-expected-revision'];
   if(typeof expected!=='string'||!/^(0|[1-9][0-9]*)$/.test(expected)||!Number.isSafeInteger(Number(expected)))return void res.status(400).json({error:'WORKSPACE_ACTION_REVISION_REQUIRED'});
   expectedRevision=Number(expected);
   try{requestHash=actionRequestHash({method:req.method,url:req.originalUrl,expectedRevision,body:req.body});}
   catch{return void res.status(400).json({error:'WORKSPACE_ACTION_INPUT_INVALID'});}
  }
  // Reserve the shared projection before the asynchronous receipt lookup.
  // A pending lookup is not permission for another writer to enter.
  inFlight=true;
  const begin=()=>{
  const before=structuredClone({...store});let responding=false;
  const originalJson=res.json.bind(res);
  const send=(body:any)=>{try{return originalJson(body);}finally{inFlight=false;}};
  res.json=(body:any)=>{
   if(responding)return res;responding=true;
   const hooks:ProjectPersistenceHooks|undefined=res.locals.projectPersistenceHooks;
   if(res.statusCode<200||res.statusCode>=300){Object.assign(store,before);try{hooks?.onRollback?.(Error('Request rejected'));}catch{/* no successful write is reported */}send(body);return res;}
   const next=snapshotProjectStore(store);
   const oldIds=new Set(before.projects.map((p:any)=>p.id));const added=store.projects.filter(p=>!oldIds.has(p.id));
   const projectId=authorization.projectId??(added.length===1?added[0].id:undefined);
   const command={command:requestHash?'commitReceipt':'commit',digest:authorization.digest,action:authorization.action,...(projectId?{projectId}:{}),operationId:id,expectedRevision:revision,expectedPolicyRevision:authorization.policyRevision,stateJson:JSON.stringify(next),now:Date.now(),...(requestHash?{requestHash,...(authorization.projectId?{requestedProjectId:authorization.projectId}:{})}:{})};
   void authority.execute(command).then(result=>{
    if(!result||result.snapshotRevision!==revision+1)throw Error('WORKSPACE_COMMIT_ACK_INVALID');
    if(requestHash&&(!result.receipt||result.receipt.version!==1||result.receipt.operationId!==id||result.receipt.requestHash!==requestHash||result.receipt.action!==authorization.action||result.receipt.requestedProjectId!==(authorization.projectId??null)||result.receipt.projectId!==projectId||result.receipt.snapshotRevision!==result.snapshotRevision||result.receipt.policyRevision!==result.policyRevision))throw Error('WORKSPACE_COMMIT_ACK_INVALID');
    revision=result.snapshotRevision;
    res.setHeader('X-DMK-Workspace-Revision',String(revision));
    if(requestHash)res.setHeader('X-DMK-Action-Acknowledged',id);
    try{hooks?.onCommit?.();}catch{console.error('Committed workspace cleanup requires recovery');}
    send(body);
   }).catch(error=>{
    // Even when the local projection is restored, a lost reply could follow a
    // committed SQL transaction. Never serve that old projection as current.
    requiresRecovery=true;Object.assign(store,before);try{hooks?.onRollback?.(error);}catch{console.error('Workspace rollback cleanup requires recovery');}
    const code=typeof error?.code==='string'?error.code:String(error?.message??'');
    res.status(/STALE|REPLAY|DENIED|REVOKED/.test(code)?409:503);send({error:'WORKSPACE_COMMIT_REJECTED',message:'Reload authoritative state before any retry; an uncertain result is not permission to repeat a mutation.'});
   });
   return res;
  };
  // Identity lives in server context; adding actor fields to a caller's body
  // would corrupt strict document and package schemas.
  next();
  };
  if(!requestHash)return begin();
  // Lookup uses the original request scope; project creation may have resolved
  // a new target. The authority rechecks access to that actual target too.
  void authority.execute({command:'lookupReceipt',digest:authorization.digest,action:authorization.action,...(authorization.projectId?{projectId:authorization.projectId}:{}),operationId:id,requestHash,now:Date.now()}).then(receipt=>{
   if(receipt!==null){
    if(!receipt||receipt.version!==1||receipt.operationId!==id||receipt.requestHash!==requestHash||receipt.action!==authorization.action||receipt.requestedProjectId!==(authorization.projectId??null)||!Number.isSafeInteger(receipt.snapshotRevision)||receipt.snapshotRevision<1||receipt.snapshotRevision>revision)throw Error('WORKSPACE_RECEIPT_ACK_INVALID');
    inFlight=false;res.setHeader('X-DMK-Action-Acknowledged',id);
    // Explicit recovery acknowledgment, never a fabricated original response
    // or certification of the current complete project snapshot.
    res.status(200).json({acknowledgment:receipt,replayed:true,refreshRequired:true});return;
   }
   if(expectedRevision!==revision){inFlight=false;res.status(409).json({error:'WORKSPACE_REVISION_STALE'});return;}
   begin();
  }).catch(error=>{
   inFlight=false;const code=typeof error?.code==='string'?error.code:String(error?.message??'');
   const denied=/ACCESS_DENIED|REVOKED/.test(code),conflict=/REPLAY|STALE/.test(code);
   if(!denied&&!conflict)requiresRecovery=true;
   res.status(denied?403:conflict?409:503).json({error:denied?'WORKSPACE_ACCESS_DENIED':conflict?'WORKSPACE_OPERATION_CONFLICT':'WORKSPACE_RECOVERY_REQUIRED'});
  });
 });
}
