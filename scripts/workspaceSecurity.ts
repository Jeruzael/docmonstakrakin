import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';
import{createRequire}from'node:module';
import{readWorkspacePassword}from'../server/security/workspaceAccess/passwordInput.ts';
const help=`Workspace security maintenance (offline, server stopped)

init --id <id> --name <account> --person <local-person-id> [--can-create] [--role "Security Officer"|"Lead Architect"] [--import-state] [--action-receipts]
provision --id <id> --name <account> --person <local-person-id> [--can-create] [--role <role>]
membership --id <principal-id> --project <project-id> --role OWNER|EDITOR|READER|DENY
reset --id <principal-id>
disable --id <principal-id>
status
recover-lock --confirm-stopped

Passwords are read from a private local terminal without echo, or from stdin.
Never pass a password as an argument, environment value, ticket or chat message.
No account, role, grant or independent-human appointment is created by help.
--import-state explicitly copies the fixed .local/project-state.json data into
the authority database, preserving that original file and granting no ownership.
Person bindings remain local operator assertions; project ownership grants no
independent-human quorum role. There are no default credentials.
--action-receipts creates an experimental schema2 authority only when none
exists. No migration or downgrade is performed. Schema2 backup/restore and
capacity inspection remain unsupported; use disposable qualification only.
`;
function flags(args:string[]){const result:Record<string,string|boolean>={};for(let i=0;i<args.length;i++){const key=args[i];if(!/^--[a-z-]+$/.test(key)||Object.hasOwn(result,key))throw Error('CLI_INPUT_INVALID');if(['--can-create','--import-state','--confirm-stopped','--action-receipts'].includes(key))result[key]=true;else{const value=args[++i];if(!value||value.startsWith('--'))throw Error('CLI_INPUT_INVALID');result[key]=value;}}return result;}
const id=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._@:-]{0,127}$/.test(v);
async function main(){
 const[command='help',...args]=process.argv.slice(2);if(['help','--help'].includes(command)){if(args.length)throw Error('CLI_INPUT_INVALID');console.log(help);return;}
 if(!['init','provision','membership','reset','disable','status','recover-lock'].includes(command))throw Error('CLI_COMMAND_INVALID');
 const input=flags(args);const allowed:Record<string,string[]>={init:['--id','--name','--person','--role','--can-create','--import-state','--action-receipts'],provision:['--id','--name','--person','--role','--can-create'],membership:['--id','--project','--role'],reset:['--id'],disable:['--id'],status:[],['recover-lock']:['--confirm-stopped']};
 if(Object.keys(input).some(k=>!allowed[command].includes(k)))throw Error('CLI_INPUT_INVALID');
 if(command==='recover-lock'){if(input['--confirm-stopped']!==true)throw Error('CLI_STOPPED_CONFIRMATION_REQUIRED');const{recoverWorkspaceLock}=await import('../server/security/workspaceAccess/privateDirectory.ts');await recoverWorkspaceLock(process.cwd());console.log(JSON.stringify({stoppedOwnerRecovery:true,productionAuthority:false}));return;}
 if(['init','provision'].includes(command)&&(!id(input['--id'])||!id(input['--name'])||!id(input['--person'])||input['--role']!==undefined&&!['Security Officer','Lead Architect'].includes(String(input['--role']))))throw Error('CLI_PRINCIPAL_INVALID');
 if(['reset','disable','membership'].includes(command)&&!id(input['--id']))throw Error('CLI_PRINCIPAL_INVALID');
 if(command==='membership'&&(!id(input['--project'])||!['OWNER','EDITOR','READER','DENY'].includes(String(input['--role']))))throw Error('CLI_MEMBERSHIP_INVALID');
 if(input['--action-receipts']&&input['--import-state'])throw Error('CLI_EXPERIMENTAL_IMPORT_UNSUPPORTED');
 let verifier:string|undefined;
 if(['init','provision','reset'].includes(command)){
  const require=createRequire(typeof __filename==='string'?__filename:import.meta.url);if(require('argon2/package.json').version!=='0.45.1')throw Error('WORKSPACE_DEPENDENCY_MISMATCH');
  const secret=await readWorkspacePassword();const{BoundedVerifier}=await import('../server/security/syntheticFoundations/boundedVerifier.ts');const argon=await import('argon2');verifier=await new BoundedVerifier(argon.default??argon).hash(secret);
 }
 let stateJson:string|undefined,originalDigest:string|undefined;
 const migration=path.join(process.cwd(),'.local','project-state.json');
 if(command==='init'&&input['--import-state']){
  for(const item of[path.dirname(migration),migration])if(fs.lstatSync(item).isSymbolicLink())throw Error('MIGRATION_PATH_INVALID');
  const stat=fs.lstatSync(migration);if(!stat.isFile()||stat.nlink!==1||stat.size>64*1024*1024)throw Error('MIGRATION_PATH_INVALID');
  const raw=fs.readFileSync(migration);if(raw.length>64*1024*1024)throw Error('MIGRATION_PATH_INVALID');stateJson=raw.toString('utf8');if(!Buffer.from(stateJson,'utf8').equals(raw))throw Error('MIGRATION_ENCODING_INVALID');originalDigest=createHash('sha256').update(raw).digest('hex');
 }
 const{WorkspaceStore}=await import('../server/security/workspaceAccess/store.ts');const store=await WorkspaceStore.open(process.cwd(),{initialize:command==='init',...(input['--action-receipts']?{actionReceipts:true}:{})});
 try{
  if(command==='status'){const info=await store.execute({command:'info'});console.log(JSON.stringify(info));return;}
  if(command==='init'||command==='provision'){
   const principal={id:String(input['--id']),name:String(input['--name']),personId:String(input['--person']),kind:'HUMAN' as const,roles:input['--role']?[String(input['--role']) as 'Security Officer'|'Lead Architect']:[],disabled:false,credentialRevision:1,canCreateProjects:input['--can-create']===true};
   await store.execute({command:command==='init'?'bootstrap':'provision',principal,verifier:verifier!,...(stateJson!==undefined?{stateJson}:{})});
  }else if(command==='membership')await store.execute({command:'membership',principalId:String(input['--id']),projectId:String(input['--project']),role:String(input['--role'])as any,deniedActions:[]});
  else if(command==='reset')await store.execute({command:'resetCredential',principalId:String(input['--id']),verifier:verifier!});
  else if(command==='disable')await store.execute({command:'disable',principalId:String(input['--id'])});
  if(originalDigest&&createHash('sha256').update(fs.readFileSync(migration)).digest('hex')!==originalDigest)throw Error('MIGRATION_SOURCE_CHANGED');
  console.log(JSON.stringify({command,completed:true,identityTrust:'LOCAL_OPERATOR_ASSERTION',independentHumanAppointment:false,...(originalDigest?{preservedMigrationSourceSha256:originalDigest}:{})}));
 }finally{await store.close();}
}
main().catch(error=>{const code=typeof error?.code==='string'&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:typeof error?.message==='string'&&/^[A-Z_]{1,80}$/.test(error.message)?error.message:'WORKSPACE_MAINTENANCE_FAILED';console.error(code);process.exitCode=1;});
