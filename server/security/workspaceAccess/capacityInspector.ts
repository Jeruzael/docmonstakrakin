import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export type CapacityInspectionResult = {
  schema: 'WORKSPACE_CAPACITY_OBSERVATION/1'; status: 'VALID_BOUNDED' | 'FULL' | 'BLOCKED' | 'INVALID';
  reason?: string; activated: false; freshnessEstablished: false; pilotAuthorized: false;
  [key: string]: unknown;
};
const blocked = (reason: string): CapacityInspectionResult => ({
  schema:'WORKSPACE_CAPACITY_OBSERVATION/1',status:'BLOCKED',reason,activated:false,freshnessEstablished:false,pilotAuthorized:false,
});
/** Offline only. A writable/live/uncertain input receives no capacity verdict. */
export function inspectWorkspaceCapacity(workspaceRoot: string): Promise<CapacityInspectionResult> {
  if(typeof workspaceRoot!=='string'||workspaceRoot.length>4096||!path.isAbsolute(workspaceRoot)||path.resolve(workspaceRoot)!==workspaceRoot||workspaceRoot.includes('\0'))
    return Promise.resolve(blocked('CAPACITY_PATH_INVALID'));
  if(process.platform!=='linux'||process.arch!=='x64')return Promise.resolve(blocked('CAPACITY_PROFILE_UNSUPPORTED'));
  const worker=typeof __dirname==='string'
    ? path.resolve(__dirname,path.basename(__dirname)==='dist'?'../server/security/workspaceAccess/capacityInspectorWorker.cjs':'capacityInspectorWorker.cjs')
    : fileURLToPath(new URL('./capacityInspectorWorker.cjs',import.meta.url));
  return new Promise(resolve=>{
    // A process, not an authority worker: native parser failures/timeouts cannot
    // publish a partial verdict or keep an SQLite file connection alive.
    const child=spawn(process.execPath,['--max-old-space-size=512',worker,workspaceRoot],{
      windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''},
    });
    let output='',settled=false;
    const finish=(result:CapacityInspectionResult)=>{if(!settled){settled=true;clearTimeout(timer);resolve(result);}};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(blocked('CAPACITY_TIMEOUT'));},15_000);
    child.stdout.on('data',chunk=>{
      output+=chunk.toString('utf8');
      if(Buffer.byteLength(output)>8192){child.kill('SIGKILL');finish(blocked('CAPACITY_OUTPUT_INVALID'));}
    });
    // Native errors and private paths are never copied into result/log output.
    child.stderr.resume();
    child.on('error',()=>finish(blocked('CAPACITY_INSPECTOR_UNAVAILABLE')));
    child.on('close',code=>{
      if(settled)return;
      try{
        const result=JSON.parse(output);
        if(result?.schema!=='WORKSPACE_CAPACITY_OBSERVATION/1'||!['VALID_BOUNDED','FULL','BLOCKED','INVALID'].includes(result.status)||
          result.activated!==false||result.freshnessEstablished!==false||result.pilotAuthorized!==false||
          (['VALID_BOUNDED','FULL'].includes(result.status)?code!==0:code!==2))throw Error();
        finish(result);
      }catch{finish(blocked('CAPACITY_INSPECTOR_UNAVAILABLE'));}
    });
  });
}
