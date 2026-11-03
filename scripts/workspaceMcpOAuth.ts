import {pathToFileURL} from 'node:url';
import {loadPrivateMcpOAuthConfig,parseMcpOAuthLauncherArgs} from '../server/security/workspaceAccess/mcpOAuthConfig.ts';
import {createMcpOAuthIntrospector,createWorkspaceMcpOAuthServer} from '../server/security/workspaceAccess/mcpOAuth.ts';

type LaunchOptions={enabled?:boolean;configPath?:string};

/** A separate, opt-in discovery process. No DMK store or successful binding exists here. */
export async function startMcpOAuthDiscoveryLauncher(options:LaunchOptions={}):Promise<
 {enabled:false}|{enabled:true;port:number;close:()=>Promise<void>}
>{
 if(options.enabled!==true)return{enabled:false};
 let introspector:ReturnType<typeof createMcpOAuthIntrospector>|undefined;
 try{
  if(typeof options.configPath!=='string')throw Error('MISSING_CONFIG');
  const config=loadPrivateMcpOAuthConfig(options.configPath);
  introspector=createMcpOAuthIntrospector(config.introspection);
  const server=await createWorkspaceMcpOAuthServer({enabled:true,host:'127.0.0.1',port:config.port,
   issuer:config.issuer,resource:config.resource,resourceMetadataUrl:config.resourceMetadataUrl,
   tls:config.tls,introspector,
   // Deliberate boundary: OAuth authentication never creates task authority.
   // Persistent, human-authorized native bindings require a separate candidate.
   resolveBinding:async()=>null});
  const verifier=introspector;let closing:Promise<void>|undefined;
  return{enabled:true,port:server.port,close:()=>closing??=(async()=>{verifier.close();await server.close();})()};
 }catch{
  introspector?.close();throw Error('MCP_OAUTH_LAUNCHER_FAILED');
 }
}

async function main(){
 const args=parseMcpOAuthLauncherArgs(process.argv.slice(2));
 if('help' in args){console.log('Usage: workspaceMcpOAuth.ts [--config ABSOLUTE_PRIVATE_PATH --enable-discovery-only]\nDefault: disabled. Discovery-only mode never grants task access.');return;}
 const running=await startMcpOAuthDiscoveryLauncher(args);
 if(!running.enabled){console.log(JSON.stringify({status:'MCP_OAUTH_DISABLED'}));return;}
 let stopping=false;
 const shutdown=()=>{
  if(stopping)return;stopping=true;
  process.removeListener('SIGINT',shutdown);process.removeListener('SIGTERM',shutdown);
  process.stdin.removeListener('end',shutdown);process.stdin.pause();
  void running.close().catch(()=>{console.error('MCP_OAUTH_LAUNCHER_FAILED');process.exitCode=1;});
 };
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
 process.stdin.once('end',shutdown);process.stdin.resume();
 console.log(JSON.stringify({status:'MCP_OAUTH_DISCOVERY_ONLY',host:'127.0.0.1',port:running.port,taskAccess:'DENIED',authority:'NONE'}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 void main().catch(()=>{console.error('MCP_OAUTH_LAUNCHER_FAILED');process.exitCode=1;});
}
