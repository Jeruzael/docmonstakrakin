/** Exercise the real Vite config, dev listener and preview listener. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {createServer,preview,type InlineConfig} from 'vite';

const root=process.cwd();
const out=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-vite-perimeter-'));
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><title>Disposable preview</title>');
// Exercise real network configuration without filesystem watching. Vite's
// inline config merge ignores watch:null, so use the existing config flag.
const previousWatchFlag=process.env.DISABLE_HMR;
process.env.DISABLE_HMR='true';
let passed=0,failed=0;
async function check(name:string,fn:()=>Promise<void>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+String(e));}}
const request=(port:number,headers:Record<string,string>)=>new Promise<number>((resolve,reject)=>{
  const req=http.get({host:'127.0.0.1',port,path:'/',headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});req.on('error',reject);
});
try{
  for(const kind of ['dev','preview'] as const){
    await check(kind+' defaults to loopback and enforces actual Host/Origin boundary',async()=>{
      const options:InlineConfig={root,logLevel:'silent',...(kind==='dev'?{server:{port:0}}:{build:{outDir:out},preview:{port:0}})};
      const server=kind==='dev'?await createServer(options):await preview(options);
      try{
        if(kind==='dev')await (server as Awaited<ReturnType<typeof createServer>>).listen();
        const address=server.httpServer!.address() as AddressInfo;
        assert.equal(address.address,'127.0.0.1');
        assert.equal(await request(address.port,{}),200);
        assert.equal(await request(address.port,{Origin:`http://127.0.0.1:${address.port}`}),200);
        assert.equal(await request(address.port,{Host:`attacker.example:${address.port}`}),403);
        assert.equal(await request(address.port,{Origin:'https://attacker.example'}),403);
        assert.equal(await request(address.port,{Origin:'null'}),403);
        assert.equal(await request(address.port,{'Sec-Fetch-Site':'cross-site'}),403);
        assert.equal(await request(address.port,{'X-Forwarded-Host':'localhost'}),403);
      }finally{await server.close();}
    });
    for(const host of ['0.0.0.0','::','192.0.2.1',true])await check(kind+' rejects CLI-equivalent host override '+host,async()=>{
      let server:Awaited<ReturnType<typeof createServer>>|Awaited<ReturnType<typeof preview>>|undefined;
      try{
        await assert.rejects(async()=>{server=kind==='dev'?await createServer({root,logLevel:'silent',server:{host,port:0}}):await preview({root,logLevel:'silent',build:{outDir:out},preview:{host,port:0}});},/UNSUPPORTED_LOCAL_VITE_CONFIG/);
      }finally{await server?.close();}
    });
  }
  await check('Auxiliary WebSocket listener cannot be re-enabled by an override',async()=>{
    let server:Awaited<ReturnType<typeof createServer>>|undefined;
    try{await assert.rejects(async()=>{server=await createServer({root,logLevel:'silent',server:{ws:true as unknown as false,hmr:true}});},/UNSUPPORTED_LOCAL_VITE_CONFIG/);}finally{await server?.close();}
  });
}finally{
  if(previousWatchFlag===undefined)delete process.env.DISABLE_HMR;else process.env.DISABLE_HMR=previousWatchFlag;
  assert.equal(path.dirname(out),os.tmpdir());assert(path.basename(out).startsWith('dmk-vite-perimeter-'));fs.rmSync(out,{recursive:true,force:true});
}
console.log(`Vite perimeter checks: ${passed} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
