import type {Express, Request, Response} from 'express';
import type {ProjectStore} from '../projectStore.ts';
import type {ReviewerIdentity} from '../proposals/identity.ts';
import {REQUIRED_QUORUM_ROLES} from '../proposals/quorum.ts';
import {resolveVerificationPrincipal} from './identity.ts';
import {VerificationError, verificationProject, verificationSession, verificationSummary, verificationArchiveSummary, verificationReview, createVerificationDraft, updateVerificationDraft, submitVerificationDraft, decideVerification} from './service.ts';
import {assertVerificationRetention} from './retention.ts';

/** Install AFTER existing project snapshot persistence; requireHuman is the shared auth boundary. */
export function registerVerificationRoutes(app:Express,store:ProjectStore,requireHuman:(req:Request,res:Response)=>ReviewerIdentity|undefined,principalResolver?:(identity:ReviewerIdentity)=>ReturnType<typeof resolveVerificationPrincipal>) {
 const roster=process.env.DMK_HUMAN_REVIEWERS;
 const handler=(action:(req:Request,res:Response,principal:NonNullable<ReturnType<typeof resolveVerificationPrincipal>>)=>void)=>(req:Request,res:Response)=>{
  const identity=requireHuman(req,res);if(!identity)return;
  const principal=principalResolver?principalResolver(identity):resolveVerificationPrincipal(identity,roster);if(!principal)return void res.status(403).json({error:'Verification requires an unambiguous operator-controlled personId binding in the human reviewer roster (local assertion only)'});
  try{
   if(['POST','PATCH'].includes(req.method)&&res.locals.projectPersistenceMode!=='MUTATING')return void res.status(503).json({error:'Verification mutations require the project persistence transaction boundary'});
   if(['POST','PATCH'].includes(req.method)) {
    const expected=req.body?.expectedReviewer;
    if(!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(key=>!['identityId','personId'].includes(key))||typeof expected.identityId!=='string'||typeof expected.personId!=='string')return void res.status(422).json({error:'expectedReviewer with identityId and personId is required'});
    if(expected.identityId!==principal.identityId||expected.personId!==principal.personId)return void res.status(409).json({error:'REVIEWER_IDENTITY_STALE: personal confirmations belong to another reviewer; reload and review again',identity:principal});
    const {expectedReviewer,...input}=req.body;req.body=input;
   }
   verificationProject(store,req.params.id);action(req,res,principal);
  }catch(error){
   if(error instanceof VerificationError)return void res.status(error.status).json({error:error.message});
   console.error('Verification operation failed before transaction response');
   res.status(500).json({error:'Verification operation failed; project transaction was not accepted'});
  }
 };
 const details=(projectId:string,session:any,identity:any)=>({session,review:verificationReview(store,session),stateVersion:verificationProject(store,projectId).stateVersion,identity,requiredRoles:[...REQUIRED_QUORUM_ROLES]});
 app.get('/api/projects/:id/verification-sessions',handler((req,res,identity)=>{assertVerificationRetention(store);const sessions=store.verificationSessions[req.params.id]??[];res.json({sessions:sessions.map(verificationSummary),reviews:sessions.map(s=>verificationReview(store,s)),archives:(store.verificationArchives[req.params.id]??[]).map(verificationArchiveSummary),stateVersion:verificationProject(store,req.params.id).stateVersion,identity,requiredRoles:[...REQUIRED_QUORUM_ROLES]});}));
 app.get('/api/projects/:id/verification-sessions/:sessionId',handler((req,res,identity)=>res.json(details(req.params.id,verificationSession(store,req.params.id,req.params.sessionId),identity))));
 app.post('/api/projects/:id/verification-sessions',handler((req,res,identity)=>res.status(201).json(details(req.params.id,createVerificationDraft(store,req.params.id,req.body,identity),identity))));
 app.patch('/api/projects/:id/verification-sessions/:sessionId',handler((req,res,identity)=>res.json(details(req.params.id,updateVerificationDraft(store,req.params.id,req.params.sessionId,req.body,identity),identity))));
 app.post('/api/projects/:id/verification-sessions/:sessionId/submit',handler((req,res,identity)=>res.json(details(req.params.id,submitVerificationDraft(store,req.params.id,req.params.sessionId,req.body,identity),identity))));
 app.post('/api/projects/:id/verification-sessions/:sessionId/decisions',handler((req,res,identity)=>res.json(details(req.params.id,decideVerification(store,req.params.id,req.params.sessionId,req.body,identity),identity))));
}
