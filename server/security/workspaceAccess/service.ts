import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {createRequire} from 'node:module';
import {BoundedVerifier} from '../syntheticFoundations/boundedVerifier.ts';
import type {WorkspaceAction} from './contracts.ts';

type Authority={execute(command:any):Promise<any>};
type Verifier=Pick<BoundedVerifier,'hash'|'verify'>;
const validPassword=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v,'utf8')<=1024&&Buffer.from(v,'utf8').toString('utf8')===v;
const loginKey=(name:string)=>createHash('sha256').update(name.toLowerCase()).digest('hex');
const validName=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._@:-]{0,127}$/.test(v);
export const workspaceTokenDigest=(token:unknown):string|null=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?createHash('sha256').update(token).digest('hex'):null;
function loginInput(value:unknown):value is {username:string;password:string}{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(fields).sort().join(',')!=='password,username'||Object.values(fields).some(f=>!Object.hasOwn(f,'value')))return false;
 return validName(fields.username.value)&&validPassword(fields.password.value);
}

/** Password and raw token material stay outside worker RPC and all audit records. */
export class WorkspaceSessionService {
 private readonly csrfKey=randomBytes(32);
 private closed=false;
 private highWater=0;
 constructor(readonly store:Authority,private readonly verifier:Verifier,private readonly dummyVerifier:string,private readonly clock:()=>number=Date.now){}
 private now(){let n:number;try{n=this.clock();}catch{return null;}if(!Number.isSafeInteger(n)||n<this.highWater||n<0||n>Number.MAX_SAFE_INTEGER-1_800_000)return null;this.highWater=n;return n;}
 csrf(token:unknown):string|null{return!this.closed&&workspaceTokenDigest(token)?createHmac('sha256',this.csrfKey).update('workspace-csrf-v1\0'+token).digest('base64url'):null;}
 verifyCsrf(token:unknown,proof:unknown):boolean{const expected=this.csrf(token);return!!expected&&typeof proof==='string'&&/^[A-Za-z0-9_-]{43}$/.test(proof)&&timingSafeEqual(Buffer.from(expected),Buffer.from(proof));}
 async login(input:unknown):Promise<{authenticated:false;limited?:boolean;unavailable?:boolean}|{authenticated:true;token:string;csrf:string}>{
  if(this.closed||!loginInput(input))return{authenticated:false};
  const now=this.now();if(now===null)return{authenticated:false};
  try{
   if(!await this.store.execute({command:'admitLogin',key:loginKey(input.username),now}))return{authenticated:false,limited:true};
   const record=await this.store.execute({command:'credential',name:input.username});
   const eligible=record?.principal?.kind==='HUMAN'&&record.principal.disabled===false;
   const matches=await this.verifier.verify(eligible?record.verifier:this.dummyVerifier,input.password);
   const issuedAt=this.now();if(!matches||!eligible||this.closed||issuedAt===null)return{authenticated:false};
   const token=randomBytes(32).toString('hex');
   const issued=await this.store.execute({command:'issue',principalId:record.principal.id,expectedCredentialRevision:record.principal.credentialRevision,expectedGeneration:record.generation,digest:workspaceTokenDigest(token),now:issuedAt});
   if(!issued||this.closed)return{authenticated:false};
   return{authenticated:true,token,csrf:this.csrf(token)!};
  }catch{return{authenticated:false,unavailable:true};}
 }
 async sessionState(token:unknown):Promise<{available:boolean;session:any|null}>{const digest=workspaceTokenDigest(token),now=this.now();if(this.closed||now===null)return{available:false,session:null};if(!digest)return{available:true,session:null};try{return{available:true,session:await this.store.execute({command:'session',digest,now})};}catch{return{available:false,session:null};}}
 async session(token:unknown):Promise<any|null>{return(await this.sessionState(token)).session;}
 async listProjects(token:unknown):Promise<any>{
  const digest=workspaceTokenDigest(token),now=this.now(),deny={allowed:false,reason:'AUTHORITY_UNAVAILABLE',projectIds:[]};
  if(this.closed||!digest||now===null)return deny;
  try{return await this.store.execute({command:'listProjects',digest,now});}catch{return deny;}
 }
 async authorize(token:unknown,action:WorkspaceAction,projectId?:string):Promise<any>{
  const digest=workspaceTokenDigest(token),now=this.now();const deny={allowed:false,reason:'AUTHORITY_UNAVAILABLE',policyRevision:-1,snapshotRevision:-1};
  if(this.closed||!digest||now===null)return deny;
  try{return await this.store.execute({command:'authorize',digest,action,...(projectId?{projectId}:{}),now});}catch{return deny;}
 }
 async rotate(token:unknown,proof:unknown):Promise<{token:string;csrf:string}|null>{
  const digest=workspaceTokenDigest(token),now=this.now();if(!digest||now===null||!this.verifyCsrf(token,proof))return null;
  const replacement=randomBytes(32).toString('hex');try{if(!await this.store.execute({command:'rotate',digest,replacementDigest:workspaceTokenDigest(replacement),now}))return null;return{token:replacement,csrf:this.csrf(replacement)!};}catch{return null;}
 }
 async logout(token:unknown,proof:unknown):Promise<boolean>{const digest=workspaceTokenDigest(token),now=this.now();if(!digest||now===null||!this.verifyCsrf(token,proof))return false;try{return!!await this.store.execute({command:'logout',digest,now});}catch{return false;}}
 async changePassword(token:unknown,proof:unknown,current:unknown,replacement:unknown):Promise<boolean>{
  if(!this.verifyCsrf(token,proof)||!validPassword(current)||!validPassword(replacement)||replacement.length<12)return false;
  const session=await this.session(token);if(!session?.principal)return false;
  try{
   const now=this.now();if(now===null||!await this.store.execute({command:'admitLogin',key:loginKey(session.principal.name),now}))return false;
   const record=await this.store.execute({command:'credential',name:session.principal.name});if(!record||!await this.verifier.verify(record.verifier,current))return false;
   const verifier=await this.verifier.hash(replacement),at=this.now();if(this.closed||at===null)return false;
   return!!await this.store.execute({command:'changeCredential',digest:workspaceTokenDigest(token),expectedCredentialRevision:record.principal.credentialRevision,verifier,now:at});
  }catch{return false;}
 }
 close(){if(this.closed)return;this.closed=true;this.csrfKey.fill(0);}
}

/** Runtime factory has no HTTP-selected verifier, clock, package, store path or identity. */
export async function createWorkspaceSessionService(store:Authority):Promise<WorkspaceSessionService>{
 const require=createRequire(typeof __filename==='string'?__filename:import.meta.url);if(require('argon2/package.json').version!=='0.45.1')throw Error('WORKSPACE_DEPENDENCY_MISMATCH');
 const argon=await import('argon2'),verifier=new BoundedVerifier(argon.default??argon);
 const dummy=await verifier.hash(randomBytes(32).toString('base64url'));
 return new WorkspaceSessionService(store,verifier,dummy);
}
