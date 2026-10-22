import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import type {Express, Request, Response} from 'express';

export type ReviewerIdentity = {id:string; name:string; roles:string[]; kind:'HUMAN'|'AGENT'; roleSource:'LOCAL_SERVER_ROSTER'};

const quorumRoles = ['Security Officer', 'Lead Architect'] as const;
type ReviewerSetupStatus = {
  state: 'not-configured' | 'malformed' | 'configured';
  missingRoles: string[];
  distinctHumanRoleCoverage: boolean;
  verification: {
    trust: 'LOCAL_ROSTER_ASSERTION';
    validHumanPersonBindings: number;
    missingHumanPersonBindings: boolean;
    ambiguousAccountIds: boolean;
    distinctPersonRoleCoverage: boolean;
    distinctSubmitterCoverage: boolean;
  };
};

/** Keep roster parsing separate from diagnostics so setup hints cannot grant authority. */
function parseConfiguredReviewers(raw?: string): {configured: Record<string, any>; malformed: boolean} {
  if (!raw || !raw.trim()) return {configured: {}, malformed: false};
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {configured: parsed, malformed: false};
    }
    return {configured: {}, malformed: true};
  } catch {
    console.warn('[ReviewerIdentity] DMK_HUMAN_REVIEWERS contains invalid JSON. Defaulting to empty reviewer roster.');
    return {configured: {}, malformed: true};
  }
}

/** Public aggregate configuration hints only: never return roster fields or values. */
function reviewerSetup(configured: Record<string, any>, malformed: boolean): ReviewerSetupStatus {
  const humans: {id: string; roles: string[]; personId?: unknown}[] = [];
  const accountIds = new Map<string, number>();
  for (const record of Object.values(configured)) {
    if (record && typeof record.id === 'string') accountIds.set(record.id, (accountIds.get(record.id) || 0) + 1);
  }
  for (const [name, record] of Object.entries(configured)) {
    if (!name.trim() || name.length > 128 || !record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !record.id.trim() || record.id.length > 128 ||
      !Array.isArray(record.roles) || record.roles.some((role: unknown) => typeof role !== 'string') ||
      !['HUMAN', 'AGENT'].includes(record.kind) ||
      typeof record.credentialVerifier !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(record.credentialVerifier)) {
      malformed = true;
      continue;
    }
    if (record.kind === 'HUMAN') humans.push(record);
  }
  const security = humans.filter(record => record.roles.includes(quorumRoles[0]));
  const architects = humans.filter(record => record.roles.includes(quorumRoles[1]));
  const validPerson = (personId: unknown): personId is string => typeof personId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(personId);
  const bound = humans.filter(record => validPerson(record.personId) && accountIds.get(record.id) === 1);
  const rolePairs = bound.filter(record => record.roles.includes(quorumRoles[0])).flatMap(first =>
    bound.filter(second => second.roles.includes(quorumRoles[1]) && first.personId !== second.personId).map(second => [first, second]));
  return {
    state: malformed ? 'malformed' : Object.keys(configured).length ? 'configured' : 'not-configured',
    missingRoles: quorumRoles.filter(role => !humans.some(record => record.roles.includes(role))),
    distinctHumanRoleCoverage: security.some(first => architects.some(second => first.id !== second.id)),
    verification: {
      trust: 'LOCAL_ROSTER_ASSERTION',
      validHumanPersonBindings: bound.length,
      missingHumanPersonBindings: humans.some(record => !validPerson(record.personId)),
      ambiguousAccountIds: [...accountIds.values()].some(count => count > 1),
      distinctPersonRoleCoverage: rolePairs.length > 0,
      distinctSubmitterCoverage: rolePairs.some(([first, second]) => bound.some(third =>
        third.roles.some(role => quorumRoles.includes(role as typeof quorumRoles[number])) &&
        third.personId !== first.personId && third.personId !== second.personId)),
    },
  };
}

/** Local reviewer sessions. Only the operator-controlled roster can assign identity or roles. */
export function installReviewerIdentity(app:Express) {
  const {configured, malformed} = parseConfiguredReviewers(process.env.DMK_HUMAN_REVIEWERS);
  const setup = reviewerSetup(configured, malformed);
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
  app.get('/api/governance/session',(req,res)=>res.json({identity:get(req) || null, setup}));
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
