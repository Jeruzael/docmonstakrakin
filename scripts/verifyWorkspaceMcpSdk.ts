import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {mcpAuthorityFixture} from './fixtures/mcpAuthority.ts';
import {buildClientMcpConfigs,createWorkspaceMcpBridge,createMcpHttpBridgeServer} from '../server/security/workspaceAccess/mcpBridge.ts';

// Explicit external test-tool location; never installs a package or changes credentials.
const root=process.env.DMK_MCP_SDK_ROOT;if(!root)throw Error('MCP_SDK_TOOL_PATH_REQUIRED');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
if(version!=='1.17.0')throw Error('MCP_SDK_TOOL_VERSION_NOT_QUALIFIED');
const fromSdk=async(file:string)=>import(pathToFileURL(path.join(root,'dist/esm',file)).href);
const {Client}=await fromSdk('client/index.js'),{StdioClientTransport}=await fromSdk('client/stdio.js'),{StreamableHTTPClientTransport}=await fromSdk('client/streamableHttp.js');
const fixture=await mcpAuthorityFixture();let passed=0;
const bridge=createWorkspaceMcpBridge({origin:fixture.origin,ca:fixture.ca,token:fixture.token});
const connectorToken='mcp_conn_v1_'+randomBytes(32).toString('hex');
const server=await createMcpHttpBridgeServer({bridge,connectorToken});
const entry=buildClientMcpConfigs({repoRoot:process.cwd(),privateConfigPath:fixture.configPath}).geminiCli.mcpServers['dmk-agent-bridge'];
const stdio=new Client({name:'synthetic-stdio-qualification',version:'1'},{capabilities:{}}),httpClient=new Client({name:'synthetic-http-qualification',version:'1'},{capabilities:{}});
const call={name:'read_task',arguments:{projectId:fixture.projectId,taskId:fixture.taskId}};
try{
 await stdio.connect(new StdioClientTransport({...entry,stderr:'pipe'}));assert.equal((await stdio.listTools()).tools[0].name,'read_task');assert.equal((await stdio.callTool(call)).isError,false);console.log('PASS actual MCP SDK stdio native-authority read');passed++;
 await httpClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`),{requestInit:{headers:{Authorization:'Bearer '+connectorToken}}}));assert.equal((await httpClient.callTool(call)).isError,false);console.log('PASS actual MCP SDK HTTP native-authority read');passed++;
 assert.equal((await stdio.callTool({...call,arguments:{...call.arguments,taskId:'TASK-UNAUTHORIZED'}})).isError,true);console.log('PASS actual MCP SDK scope denial');passed++;
 await fixture.revoke();assert.equal((await stdio.callTool(call)).isError,true);assert.equal((await httpClient.callTool(call)).isError,true);console.log('PASS exact issued token revoked through current sponsor authority on both transports');passed++;
 console.log(JSON.stringify({suite:'workspace-mcp-sdk',sdk:version,passed,failed:0,REAL_GEMINI_CONNECTED:'NOT_RUN',REAL_CLAUDE_CONNECTED:'NOT_RUN',CHATGPT_CONNECTED:'BLOCKED'}));
}finally{await stdio.close();await httpClient.close();await server.close();bridge.close();await fixture.close();}
