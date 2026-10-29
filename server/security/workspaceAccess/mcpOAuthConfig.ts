import path from 'node:path';
import {createPrivateKey,X509Certificate} from 'node:crypto';
import {createSecureContext} from 'node:tls';
import {parseAgentJson} from './agentJson.ts';
import {withPrivateMcpFiles} from './mcpPrivateFiles.ts';

const fail=():never=>{throw Error('MCP_OAUTH_CONFIG_INVALID');};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactKeys(value:Record<string,unknown>,keys:readonly string[]){if(Object.keys(value).some(key=>!keys.includes(key)))fail();}
function httpsUrl(value:unknown){
 if(typeof value!=='string')fail();
 const url=new URL(value as string);
 if(url.protocol!=='https:'||url.href!==value||url.username||url.password||(value as string).includes('?')||(value as string).includes('#'))fail();
 return url;
}
function credential(value:unknown):string{
 if(typeof value!=='string'||!value||Buffer.byteLength(value)>1024||/[\x00-\x1f\x7f]/.test(value))fail();return value as string;
}
export type McpOAuthPrivateConfig={mode:'DISCOVERY_ONLY';port:number;issuer:string;resource:string;resourceMetadataUrl:string;
 tls:{key:Buffer;cert:Buffer};introspection:{issuer:string;resource:string;introspectionEndpoint:string;clientId:string;clientSecret:string;ca?:Buffer}};

/** Closed discovery-only profile. It cannot name a DMK authority, grant or binding. */
export function loadPrivateMcpOAuthConfig(configPath:string):McpOAuthPrivateConfig{
 try{return withPrivateMcpFiles(read=>{
  const value=parseAgentJson(read(configPath,16384));
  exactKeys(value,['schema','enabled','mode','port','issuer','resource','resourceMetadataUrl','tlsKeyPath','tlsCertPath','introspection']);
  if(value.schema!=='DMK_MCP_OAUTH_LAUNCHER/1'||value.mode!=='DISCOVERY_ONLY')fail();
  if(value.enabled===false)throw Error('MCP_OAUTH_LAUNCHER_DISABLED');
  if(value.enabled!==true||typeof value.port!=='number'||!Number.isSafeInteger(value.port)||value.port<0||value.port>65535)fail();
  const issuer=httpsUrl(value.issuer),resource=httpsUrl(value.resource),metadata=httpsUrl(value.resourceMetadataUrl);
  if(metadata.origin!==resource.origin||metadata.pathname!=='/.well-known/oauth-protected-resource'+resource.pathname)fail();
  if(!record(value.introspection))fail();const introspection=value.introspection as Record<string,unknown>;
  exactKeys(introspection,['endpoint','clientId','clientSecretPath','caPath']);
  const endpoint=httpsUrl(introspection.endpoint);if(endpoint.origin!==issuer.origin)fail();
  const clientId=credential(introspection.clientId);
  if(typeof value.tlsKeyPath!=='string'||typeof value.tlsCertPath!=='string'||typeof introspection.clientSecretPath!=='string'||(Object.hasOwn(introspection,'caPath')&&typeof introspection.caPath!=='string'))fail();
  const key=read(value.tlsKeyPath as string,65536),cert=read(value.tlsCertPath as string,65536);
  const certificate=new X509Certificate(cert),now=Date.now();
  if(!certificate.checkPrivateKey(createPrivateKey(key))||!certificate.checkIP('127.0.0.1')||Date.parse(certificate.validFrom)>now||Date.parse(certificate.validTo)<=now)fail();
  const bytes=read(introspection.clientSecretPath as string,1024),text=bytes.toString('utf8');
  if(!Buffer.from(text).equals(bytes))fail();const clientSecret=credential(text);
  const ca=typeof introspection.caPath==='string'?read(introspection.caPath,65536):undefined;
  createSecureContext({key,cert,ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3'});
  return{mode:'DISCOVERY_ONLY' as const,port:value.port as number,issuer:issuer.href,resource:resource.href,resourceMetadataUrl:metadata.href,tls:{key,cert},
   introspection:{issuer:issuer.href,resource:resource.href,introspectionEndpoint:endpoint.href,clientId,clientSecret,ca}};
 });}catch(error){throw Error(error instanceof Error&&error.message==='MCP_OAUTH_LAUNCHER_DISABLED'?'MCP_OAUTH_LAUNCHER_DISABLED':'MCP_OAUTH_CONFIG_INVALID');}
}

export function parseMcpOAuthLauncherArgs(args:readonly string[]):{help:true}|{enabled:boolean;configPath?:string}{
 const invalid=():never=>{throw Error('MCP_OAUTH_ARGUMENTS_INVALID');};
 if(args.length===1&&args[0]==='--help')return{help:true};
 let enabled=false,configPath:string|undefined;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--enable-discovery-only'&&!enabled){enabled=true;continue;}
  if(args[i]==='--config'&&configPath===undefined){const file=args[++i];if(typeof file!=='string'||!path.isAbsolute(file)||path.resolve(file)!==file||file.includes('\0')||(process.platform==='win32'&&!/^[A-Z]:\\/.test(file)))invalid();configPath=file;continue;}
  invalid();
 }
 if(enabled&&!configPath)invalid();return configPath===undefined?{enabled}:{enabled,configPath};
}
