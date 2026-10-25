import {pathToFileURL} from 'node:url';
import {
 attachMcpStdioTransport,
 createMcpHttpBridgeServer,
 createWorkspaceMcpBridge,
 loadPrivateMcpConfig,
 validateMcpCliArgs
} from '../server/security/workspaceAccess/mcpBridge.ts';

async function main(){
 const parsedArgs=validateMcpCliArgs(process.argv.slice(2));
 const configPath=parsedArgs.configPath??process.env.DMK_MCP_CONFIG_PATH;
 if(!configPath)throw Error('MCP_CONFIG_PATH_REQUIRED');
 const config=loadPrivateMcpConfig(configPath);
 const bridge=createWorkspaceMcpBridge({origin:config.origin,ca:config.ca,token:config.token});

 if(config.httpPort!==undefined){
  if(!config.connectorToken)throw Error('MCP_CONNECTOR_TOKEN_REQUIRED');
  const httpServer=await createMcpHttpBridgeServer({
   bridge,
   host:'127.0.0.1',
   port:config.httpPort,
   connectorToken:config.connectorToken
  });
  const shutdown=()=>{
   void httpServer.close().finally(()=>{
    bridge.close();
    process.exit(0);
   });
  };
  process.once('SIGINT',shutdown);
  process.once('SIGTERM',shutdown);
  return;
 }

 const stdio=attachMcpStdioTransport(bridge,process.stdin,process.stdout);
 const shutdown=()=>{
  stdio.close();
  bridge.close();
 };
 process.stdin.once('end',()=>{
  void stdio.drain().finally(shutdown);
 });
 process.once('SIGINT',shutdown);
 process.once('SIGTERM',shutdown);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(()=>{
  console.error('MCP_BRIDGE_FAILED');
  process.exitCode=1;
 });
}
