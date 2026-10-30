import {parseAgentJson} from './agentJson.ts';
import {withPrivateMcpFiles} from './mcpPrivateFiles.ts';

const fail=():never=>{throw Error('MCP_BRIDGE_CONFIG_INVALID');};

/** Admission only. Never changes an existing ACL, owner or credential. */
export function loadPrivateMcpConfig(configPath:string):{origin:string;ca:Buffer;token:string;httpPort?:number;connectorToken?:string}{
 try{return withPrivateMcpFiles(read=>{
  const parsed=parseAgentJson(read(configPath,16384));
  const allowed=['origin','caPath','token','tokenPath','connectorToken','connectorTokenPath','httpPort'];
  if(Object.keys(parsed).some(k=>!allowed.includes(k))||typeof parsed.origin!=='string'||typeof parsed.caPath!=='string')fail();
  if(Object.hasOwn(parsed,'token')===Object.hasOwn(parsed,'tokenPath')||(Object.hasOwn(parsed,'connectorToken')&&Object.hasOwn(parsed,'connectorTokenPath')))fail();
  const ca=read(parsed.caPath as string,65536);
  const text=(inline:unknown,file:unknown)=>{
   if(file!==undefined&&typeof file!=='string')fail();
   const bytes=typeof file==='string'?read(file,1024):typeof inline==='string'?Buffer.from(inline):fail();
   const value=bytes.toString('utf8');if(!Buffer.from(value).equals(bytes))fail();return value.trim();
  };
  const token=text(parsed.token,parsed.tokenPath);
  if(!/^dmk_agent_v1_[a-f0-9]{64}$/.test(token))fail();
  let connectorToken:string|undefined;
  if(parsed.connectorToken!==undefined||parsed.connectorTokenPath!==undefined){connectorToken=text(parsed.connectorToken,parsed.connectorTokenPath);if(!/^mcp_conn_v1_[a-f0-9]{64}$/.test(connectorToken))fail();}
  const httpPort=parsed.httpPort;
  if(httpPort!==undefined&&(typeof httpPort!=='number'||!Number.isSafeInteger(httpPort)||httpPort<0||httpPort>65535))fail();
  return{origin:parsed.origin as string,ca,token,httpPort:httpPort as number|undefined,connectorToken};
 });}catch{throw Error('MCP_BRIDGE_CONFIG_INVALID');}
}
