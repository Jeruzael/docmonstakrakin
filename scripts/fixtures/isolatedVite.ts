import {createServer} from 'vite';
import {createServer as createPortProbe} from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function startIsolatedVite(root:string) {
  // Vite 6 treats port:0 as falsy and substitutes 5173. Ask the OS for an
  // available positive port first; retry the bounded close/listen race only.
  for(let attempt=0;attempt<4;attempt++){
    const probe=createPortProbe();
    await new Promise<void>((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
    const port=(probe.address() as {port:number}).port;
    await new Promise<void>((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
    // Keep optimizer state out of shared/retained node_modules fixtures and
    // restrict initial HTML crawling to the application entrypoint.
    const cacheDir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-vite-fixture-'));
    let server:Awaited<ReturnType<typeof createServer>>;
    try{server=await createServer({root,cacheDir,optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});}
    catch(error){fs.rmSync(cacheDir,{recursive:true,force:true});throw error;}
    const close=server.close.bind(server);server.close=async()=>{try{await close();}finally{if(path.dirname(cacheDir)===os.tmpdir() && path.basename(cacheDir).startsWith('dmk-vite-fixture-'))fs.rmSync(cacheDir,{recursive:true,force:true});}};
    try{await server.listen();return server;}catch(error){await server.close();if(attempt===3 || !/already in use/.test(String(error)))throw error;}
  }
  throw new Error('ISOLATED_VITE_PORT_UNAVAILABLE');
}
