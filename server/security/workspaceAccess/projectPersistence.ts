import type {Express} from 'express';
import type {ProjectStore} from '../../projectStore.ts';
import {classifyProjectRequestMode,hydrateProjectStoreFromSnapshot,snapshotProjectStore,type ProjectPersistenceHooks} from '../../projectPersistence.ts';
type Authority={execute(command:any):Promise<any>};
const operationId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

/** In enforced mode SQLite owns the snapshot; the old JSON migration input is never overwritten. */
export async function installWorkspaceProjectPersistence(app:Express,store:ProjectStore,authority:Authority){
 const initial=await authority.execute({command:'snapshot'});let revision=initial.snapshotRevision;
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
  const auditedExport=['GET','HEAD'].includes(req.method)&&/\/package\/export\/?$/i.test(req.path);
  const mutation=['POST','PATCH','PUT','DELETE'].includes(req.method)||auditedExport;
  if(!mutation)return next();
  const mode=req.method==='POST'&&/^\/package\/verify\/?$/i.test(req.path)?'READ_ONLY':classifyProjectRequestMode(req);res.locals.projectPersistenceMode=mode;
  if(mode==='READ_ONLY')return next();
  const id=req.headers['x-dmk-request-id'];if(!operationId(id))return void res.status(400).json({error:'WORKSPACE_OPERATION_ID_REQUIRED'});
  const authorization=res.locals.workspaceAuthorization;
  if(!authorization?.digest||authorization.snapshotRevision!==revision)return void res.status(409).json({error:'WORKSPACE_REVISION_STALE'});
  inFlight=true;const before=structuredClone({...store});let responding=false;
  const originalJson=res.json.bind(res);
  const send=(body:any)=>{try{return originalJson(body);}finally{inFlight=false;}};
  res.json=(body:any)=>{
   if(responding)return res;responding=true;
   const hooks:ProjectPersistenceHooks|undefined=res.locals.projectPersistenceHooks;
   if(res.statusCode<200||res.statusCode>=300){Object.assign(store,before);try{hooks?.onRollback?.(Error('Request rejected'));}catch{/* no successful write is reported */}send(body);return res;}
   const next=snapshotProjectStore(store);
   const oldIds=new Set(before.projects.map((p:any)=>p.id));const added=store.projects.filter(p=>!oldIds.has(p.id));
   const projectId=authorization.projectId??(added.length===1?added[0].id:undefined);
   const command={command:'commit',digest:authorization.digest,action:authorization.action,...(projectId?{projectId}:{}),operationId:id,expectedRevision:revision,expectedPolicyRevision:authorization.policyRevision,stateJson:JSON.stringify(next),now:Date.now()};
   void authority.execute(command).then(result=>{
    if(!result||result.snapshotRevision!==revision+1)throw Error('WORKSPACE_COMMIT_ACK_INVALID');
    revision=result.snapshotRevision;
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
 });
}
