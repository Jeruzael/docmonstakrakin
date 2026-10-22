import fs from 'node:fs';
import path from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {isFileLoadingAllowed,type Plugin,type ResolvedConfig} from 'vite';
import {localRequestBoundary,resolveLocalNetworkConfig} from './localPerimeter.ts';

const privateDirectories=['.security','.security-backups','.local','.secrets','.docmonstakrakin'];
const privateNames=new Set(privateDirectories);
export const PRIVATE_WORKSPACE_FS_DENY=privateDirectories.map(directory=>`**/${directory}/**`);
// Keep the pinned Vite defaults as well as every caller-configured denial.
export const WORKSPACE_VITE_FS_DENY=['.env','.env.*','*.{crt,pem}','**/.git/**',...PRIVATE_WORKSPACE_FS_DENY];
const privatePath=(value:string)=>value.replaceAll('\\','/').split('/').some(segment=>privateNames.has(segment.replace(/[. ]+$/,'').toLowerCase()));

/** Covers publicDir (which bypasses fs.deny), aliases and directory links too. */
function privateFileBoundary(config:ResolvedConfig,roots:string[],aliases=config.resolve.alias){
  // publicDir and preview output are legitimate serving roots. Use Vite's
  // compiled deny policy on clean paths even for its query/public shortcuts.
  const policy:ResolvedConfig={...config,server:{...config.server,fs:{...config.server.fs,strict:true,allow:[...config.server.fs.allow,...roots.map(root=>root.replaceAll('\\','/'))]}}};
  return(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
    const reject=()=>{res.statusCode=403;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'PRIVATE_WORKSPACE_PATH'}));};
    let pathname:string;
    try{pathname=(req.url??'').split('?')[0].split('/').map(segment=>decodeURIComponent(segment)).join('/');}
    catch{return reject();}
    if(privatePath(pathname))return reject();
    const candidates=pathname.startsWith('/@fs/')?[pathname.slice(5)]:roots.map(root=>path.resolve(root,'.'+pathname));
    for(const alias of aliases){
      if(typeof alias.find==='string'?pathname.startsWith(alias.find):alias.find.test(pathname)){
        const resolved=pathname.replace(alias.find,alias.replacement);
        if(path.isAbsolute(resolved))candidates.push(resolved);
      }
    }
    for(const candidate of candidates){
      if(privatePath(candidate)||!isFileLoadingAllowed(policy,candidate.replaceAll('\\','/')))return reject();
      try{const canonical=fs.realpathSync.native(candidate);if(privatePath(canonical)||!isFileLoadingAllowed(policy,canonical.replaceAll('\\','/')))return reject();}
      catch(error){if(!['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))return reject();}
    }
    next();
  };
}

/** Vite dev/preview are separate ingress paths; CLI overrides must also fail closed. */
export function localVitePerimeter():Plugin {
  return {
    name:'dmk-local-perimeter',
    config(config){return{server:{fs:{deny:[...new Set([...WORKSPACE_VITE_FS_DENY,...(config.server?.fs?.deny??[])])]}}};},
    configResolved(config){
      resolveLocalNetworkConfig();
      for(const options of [config.server,config.preview]){
        const port=options.port;
        if(options.host!=='127.0.0.1'||options.https||typeof port!=='number'||!Number.isInteger(port)||port<0||port>65535){
          throw new Error('UNSUPPORTED_LOCAL_VITE_CONFIG: use IPv4 loopback, HTTP and a valid local port');
        }
      }
      if(!WORKSPACE_VITE_FS_DENY.every(pattern=>config.server.fs.deny.includes(pattern)))throw new Error('UNSUPPORTED_LOCAL_VITE_CONFIG: private-file denial cannot be removed');
      // No independently listening WebSocket/HMR server during containment.
      if(config.server.ws!==false||config.server.hmr!==false)throw new Error('UNSUPPORTED_LOCAL_VITE_CONFIG: auxiliary WebSocket/HMR listeners are disabled');
    },
    configureServer(server){server.middlewares.use(localRequestBoundary);server.middlewares.use(privateFileBoundary(server.config,[server.config.root,...(server.config.publicDir?[server.config.publicDir]:[])]));},
    configurePreviewServer(server){server.middlewares.use(localRequestBoundary);server.middlewares.use(privateFileBoundary(server.config,[path.resolve(server.config.root,server.config.build.outDir)],[]));},
  };
}
