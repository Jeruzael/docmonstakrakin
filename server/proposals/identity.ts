import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import type {Express, Request, Response} from 'express';

export type ReviewerIdentity = {id:string; name:string; roles:string[]; kind:'HUMAN'|'AGENT'; roleSource:'LOCAL_SERVER_ROSTER'};

/** Local reviewer sessions. Only the operator-controlled roster can assign identity or roles. */
export function installReviewerIdentity(app:Express) {
  const configured = JSON.parse(process.env.DMK_HUMAN_REVIEWERS || '{}');
  const sessions = new Map<string,{identity:ReviewerIdentity;expires:number}>();
  const failures = new Map<string,{count:number;until:number}>();
  const cookieName = 'dmk_reviewer';
  const token = (req:Request) => req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
  const sameOrigin = (req:Request) => !req.headers.origin || req.headers.origin === `${req.protocol}://${req.headers.host}`;
  const get = (req:Request):ReviewerIdentity|undefined => {
    const key=token(req), entry=sessions.get(key);
    if (!entry || entry.expires<=Date.now()) {sessions.delete(key);return;}
    return entry.identity;
  };
  const requireHuman = (req:Request,res:Response):ReviewerIdentity|undefined => {
    if (!sameOrigin(req)) {res.status(403).json({error:'Cross-origin governance request rejected'});return;}
    const identity=get(req);
    if (!identity) {res.status(401).json({error:'Sign in as a configured human reviewer first'});return;}
    if (identity.kind!=='HUMAN' || !identity.roles.some(r=>['Security Officer','Lead Architect'].includes(r))) {res.status(403).json({error:'This identity has no human governance authority'});return;}
    return identity;
  };
  app.get('/api/governance/session',(req,res)=>res.json({identity:get(req) || null}));
  app.post('/api/governance/session',(req,res)=>{
    if (!sameOrigin(req)) return res.status(403).json({error:'Cross-origin sign-in rejected'});
    const ip=req.ip || 'local'; const attempts=failures.get(ip);
    if (attempts && attempts.until>Date.now() && attempts.count>=10) return res.status(429).json({error:'Too many failed sign-in attempts; retry in 15 minutes'});
    const {username,password}=req.body;
    const record=typeof username==='string' && Object.hasOwn(configured,username) ? configured[username] : null;
    const [salt,hash]=String(record?.credentialVerifier || '').split(':');
    const valid=record && typeof password==='string' && password.length<=1024 && /^[a-f0-9]{32}$/.test(salt || '') && /^[a-f0-9]{64}$/.test(hash || '') && timingSafeEqual(scryptSync(password,salt,32),Buffer.from(hash,'hex'));
    if (!valid || !Array.isArray(record.roles) || !['HUMAN','AGENT'].includes(record.kind) || typeof record.id!=='string') {
      failures.set(ip,{count:attempts && attempts.until>Date.now() ? attempts.count+1 : 1,until:Date.now()+15*60_000});
      return res.status(401).json({error:'Invalid reviewer credentials'});
    }
    failures.delete(ip); sessions.delete(token(req));
    const identity:ReviewerIdentity={id:record.id,name:username,roles:[...record.roles],kind:record.kind,roleSource:'LOCAL_SERVER_ROSTER'};
    const key=randomBytes(32).toString('hex'); sessions.set(key,{identity,expires:Date.now()+30*60_000});
    res.cookie(cookieName,key,{httpOnly:true,sameSite:'strict',secure:req.secure,path:'/',maxAge:30*60_000});
    res.json({identity});
  });
  app.delete('/api/governance/session',(req,res)=>{
    if (!sameOrigin(req)) return res.status(403).json({error:'Cross-origin sign-out rejected'});
    sessions.delete(token(req));res.clearCookie(cookieName,{path:'/'});res.json({identity:null});
  });
  return {requireHuman};
}
