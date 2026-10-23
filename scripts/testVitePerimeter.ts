/** Exercise the real Vite config, dev listener and preview listener. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import type {AddressInfo} from 'node:net';
import {createServer,preview,type InlineConfig} from 'vite';
import {chromium} from 'playwright';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';

const root=process.cwd();
const out=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-vite-perimeter-'));
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><title>Disposable preview</title>');
// Copy the real App and config into a disposable source checkout, retaining a
// dependency junction to the already installed canonical tree. No dependency
// file or operator workspace is modified, even when CI installed ordinary dirs.
const sourceAppRoot=path.join(out,'source-app');fs.mkdirSync(sourceAppRoot);
for(const file of ['package.json','index.html','vite.config.ts'])fs.copyFileSync(path.join(root,file),path.join(sourceAppRoot,file));
fs.cpSync(path.join(root,'src'),path.join(sourceAppRoot,'src'),{recursive:true});
fs.mkdirSync(path.join(sourceAppRoot,'server/security'),{recursive:true});
for(const file of ['vitePerimeter.ts','localPerimeter.ts'])fs.copyFileSync(path.join(root,'server/security',file),path.join(sourceAppRoot,'server/security',file));
fs.symlinkSync(fs.realpathSync.native(path.join(root,'node_modules')),path.join(sourceAppRoot,'node_modules'),process.platform==='win32'?'junction':'dir');
fs.writeFileSync(path.join(out,'outside-app.txt'),'SYNTHETIC_OUTSIDE_ALLOW_ROOT');
// Exercise real network configuration without filesystem watching. Vite's
// inline config merge ignores watch:null, so use the existing config flag.
const previousWatchFlag=process.env.DISABLE_HMR;
process.env.DISABLE_HMR='true';
let passed=0,failed=0;
async function check(name:string,fn:()=>Promise<void>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+String(e));}}
const request=(port:number,headers:Record<string,string>,target='/')=>new Promise<number>((resolve,reject)=>{
  const req=http.get({host:'127.0.0.1',port,path:target,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});req.on('error',reject);
});
const fixtureResponse=(port:number,target:string)=>new Promise<{status:number;body:string}>((resolve,reject)=>{
  const req=http.get({host:'127.0.0.1',port,path:target,headers:{Host:`127.0.0.1:${port}`}},res=>{
    let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;});res.on('end',()=>resolve({status:res.statusCode!,body}));
  });req.on('error',reject);
});

// Characterize the delivered Vite editor boundary, not a separately installed
// launch-editor. Only its bundled middleware/parser/launcher block is evaluated.
// Chunk names change between patches; ambiguous/missing boundaries fail closed.
function bundledEditorSource(){
  const chunks=path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),'dist/node/chunks');
  const start='var guessExports = guess.exports;';
  const end='var launchEditorMiddleware$1 =';
  const matches=fs.readdirSync(chunks).filter(name=>name.endsWith('.js')).map(name=>fs.readFileSync(path.join(chunks,name),'utf8')).filter(source=>source.includes('function launchEditor('));
  assert.equal(matches.length,1,'Expected one bundled editor implementation');
  const source=matches[0];
  assert.equal(source.split(start).length,2,'Editor block start must be unique');
  assert.equal(source.split(end).length,2,'Editor block end must be unique');
  const from=source.indexOf(start)+start.length,to=source.indexOf(end);
  assert(to>from);
  return source.slice(from,to);
}

type EditorFixture={platform:'win32'|'linux';file:string;existing:string[];editor?:string[];wsl?:boolean};
function inertEditor(source:string,fixture:EditorFixture){
  const windows=fixture.platform==='win32';
  const cwd=windows?'C:\\workspace':fixture.wsl?'/mnt/c/project':'/workspace';
  const nativePath=windows?path.win32:path.posix;
  const fixturePath={...nativePath,resolve:(...parts:string[])=>nativePath.resolve(cwd,...parts),relative:(from:string,to:string)=>nativePath.relative(from||cwd,to)};
  const checked:string[]=[],errors:string[]=[];
  const calls:{kind:string;command:string;args:string[]}[]=[];
  const child={on(){return child;},kill(){throw new Error('Unexpected editor reuse');}};
  // No real filesystem, editor discovery, environment, process API or require is
  // exposed to the evaluated block. Both subprocess sinks only record arguments.
  const record=(kind:string,command:string,args:string[]=[])=>{calls.push({kind,command,args:Array.from(args)});return child;};
  let ended=0;
  const context={
    require$$0$2:fixturePath,
    require$$0$4:{existsSync:(file:string)=>{checked.push(file);return fixture.existing.includes(fixturePath.resolve(file));}},
    require$$0$5:{fileURLToPath:(url:string)=>fileURLToPath(url,{windows})},
    require$$2:{release:()=>fixture.wsl?'synthetic-Microsoft':'synthetic-native'},
    require$$2$1:{exec:(command:string)=>record('exec',command),spawn:(command:string,args:string[])=>record('spawn',command,args)},
    guessExports:()=>fixture.editor??['code.cmd'],
    picocolorsExports:{red:(value:string)=>value},console:{log(){}},URL,
    process:{platform:fixture.platform,env:{},cwd:()=>cwd},
    fixtureRoot:cwd,
    fixtureError:(_file:string,error:string)=>errors.push(error),
    fixtureRequest:{url:'/__open-in-editor?file='+encodeURIComponent(fixture.file)},
    fixtureResponse:{statusCode:200,end(){ended++;}},
  };
  vm.runInNewContext(source+'\nlaunchEditorMiddleware("fixture",fixtureRoot,fixtureError)(fixtureRequest,fixtureResponse);',context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  assert.equal(ended,1,'Middleware must complete its response');
  return {checked,errors,calls};
}
try{
  let editorSource='';
  await check('Installed Vite editor fixture acquisition is unambiguous',async()=>{editorSource=bundledEditorSource();});
  await check('GHSA-587h normalizes Windows paths after positional suffix removal',async()=>{
    for(const file of ['C:\\workspace\\ghost%DMK_SYNTHETIC%\\..:7:3','file:///C:/workspace/ghost%25DMK_SYNTHETIC%25/..:7:3']){
      const result=inertEditor(editorSource,{platform:'win32',file,existing:['C:\\workspace']});
      assert.deepEqual(result.checked,['C:\\workspace']);
      assert.deepEqual(result.calls,[{kind:'exec',command:'code.cmd -r -g C:\\workspace:7:3',args:[]}]);
      assert.deepEqual(result.errors,[]);
    }
  });
  for(const [label,file] of [
    ['percent','C:\\workspace\\percent%DMK_SYNTHETIC%.txt'],
    ['carriage return','C:\\workspace\\file:stream\rmarker'],
    ['line feed','C:\\workspace\\file:stream\nmarker'],
  ])await check('GHSA-698v rejects Windows '+label+' arguments before subprocess dispatch',async()=>{
    const result=inertEditor(editorSource,{platform:'win32',file,existing:[file]});
    assert.equal(result.checked.length,1);
    assert.deepEqual(result.calls,[]);
    assert.equal(result.errors.length,1);
  });
  await check('Windows UNC and device paths reject before filesystem or subprocess access',async()=>{
    for(const file of ['\\\\server\\share\\fixture.txt','\\\\?\\C:\\workspace\\fixture.txt']){
      const result=inertEditor(editorSource,{platform:'win32',file,existing:[file]});
      assert.deepEqual(result.checked,[]);assert.deepEqual(result.calls,[]);assert.equal(result.errors.length,1);
    }
  });
  await check('GHSA-r825 WSL filenames remain positional for affected editor families',async()=>{
    for(const [editor,suffix,want] of [
      ['vim','-fixture.txt',['./-fixture.txt']],
      ['vim','+fixture.txt:7:3',['+call cursor(7, 3)','./+fixture.txt']],
      ['emacs','+fixture.txt:7:3',['+7:3','./+fixture.txt']],
      ['notepad++.exe','-fixture.txt:7:3',['-n7','-c3','./-fixture.txt']],
    ] as const){
      const result=inertEditor(editorSource,{platform:'linux',wsl:true,file:'/mnt/c/project/'+suffix,existing:['/mnt/c/project/-fixture.txt','/mnt/c/project/+fixture.txt'],editor:[editor]});
      assert.deepEqual(result.calls,[{kind:'spawn',command:editor,args:Array.from(want)}]);assert.deepEqual(result.errors,[]);
    }
  });
  await check('Ordinary Windows routing names, spaces and editor positions remain compatible',async()=>{
    const file='C:\\workspace\\route space\\(group)\\[slug]\\$page+@.tsx';
    const result=inertEditor(editorSource,{platform:'win32',file:file+':12:4',existing:[file],editor:['C:\\Program Files\\Editor\\code.exe','--wait']});
    assert.deepEqual(result.calls,[{kind:'exec',command:'"C:\\Program Files\\Editor\\code.exe" --wait -r -g "C:\\workspace\\route space\\(group)\\[slug]\\$page+@.tsx:12:4"',args:[]}]);assert.deepEqual(result.errors,[]);
  });
  await check('Ordinary POSIX file URLs, editor arguments and positions remain compatible',async()=>{
    const result=inertEditor(editorSource,{platform:'linux',file:'file:///workspace/route%20space/(group)/[slug]/$page+@.tsx:12:4',existing:['/workspace/route space/(group)/[slug]/$page+@.tsx'],editor:['code','--wait']});
    assert.deepEqual(result.calls,[{kind:'spawn',command:'code',args:['--wait','-r','-g','/workspace/route space/(group)/[slug]/$page+@.tsx:12:4']}]);assert.deepEqual(result.errors,[]);
  });
  await check('Nonexistent editor targets never dispatch a subprocess',async()=>{
    const result=inertEditor(editorSource,{platform:'win32',file:'C:\\workspace\\absent.txt',existing:[]});
    assert.deepEqual(result.calls,[]);assert.deepEqual(result.errors,[]);
  });
  await check('Retained dependency junction serves the actual Vite client and imported modules',async()=>{
    const modules=path.join(sourceAppRoot,'node_modules'),canonical=fs.realpathSync.native(modules);
    assert(fs.lstatSync(modules).isSymbolicLink(),'Fixture must exercise the retained module junction');
    assert(!canonical.startsWith(sourceAppRoot+path.sep),'Dependencies must physically reside outside the source root');
    const vite=await startIsolatedVite(sourceAppRoot);
    const cacheDir=vite.config.cacheDir;
    try{
      assert.equal(path.resolve(path.dirname(cacheDir)),path.resolve(sourceAppRoot,'runtime'),'Optimizer cache must stay inside the existing source-root allowance');
      assert(path.basename(cacheDir).startsWith('dmk-vite-fixture-'),'Cache must have a unique fixture-owned directory');
      const port=(vite.httpServer!.address() as AddressInfo).port;
      const client=await fixtureResponse(port,'/@vite/client');
      assert.equal(client.status,200,'Vite internal client must load through its built-in alias');
      assert.match(client.body,/function|import/);
      const entry=await fixtureResponse(port,'/src/main.tsx');
      assert.equal(entry.status,200);assert.match(entry.body,/createRoot/);
      const dependencies=[...entry.body.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(match=>match[1]).filter(url=>url.startsWith('/runtime/dmk-vite-fixture-'));
      assert(dependencies.length>0,'Actual entry must import the isolated optimizer cache within the existing source allowance');
      for(const target of dependencies)assert.equal((await fixtureResponse(port,target)).status,200,target);
      // The client/module correction grants neither TEMP nor the dependency
      // parent tree. These existing non-private files remain outside admission.
      for(const file of [path.join(out,'outside-app.txt'),path.join(canonical,'react/package.json')]){
        assert.equal((await fixtureResponse(port,'/@fs/'+file.replaceAll('\\','/'))).status,403,file);
      }
    }finally{await vite.close();assert.equal(fs.existsSync(cacheDir),false,'Closing the fixture removes only its unique optimizer cache');}
  });
  await check('Real source App mounts through the retained dependency junction without blocked modules',async()=>{
    const vite=await startIsolatedVite(sourceAppRoot);
    const executable=process.env.DMK_TEST_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
    const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
    try{
      const page=await browser.newPage(),errors:string[]=[],failedModules:string[]=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()>=400&&!new URL(response.url()).pathname.startsWith('/api/'))failedModules.push(response.status()+' '+response.url());});
      // Real index/main/App, React tree and CSS; only inert API replies are
      // controlled. There is no server authority or operator workspace here.
      await page.route('**/api/**',async route=>{
        const pathname=new URL(route.request().url()).pathname;
        const json=pathname==='/api/governance/session'?{identity:null,access:{mode:'LOCAL_DEVELOPMENT',setupRequired:false,productionDeploymentAccepted:false}}:pathname==='/api/projects'?[]:{};
        await route.fulfill({status:200,json});
      });
      await page.goto(vite.resolvedUrls!.local[0],{waitUntil:'domcontentloaded'});
      await page.getByText('A-SSDLC Plane',{exact:true}).waitFor({state:'visible',timeout:8000});
      assert(await page.locator('#root').textContent(),'Real React root must contain the App');
      assert.deepEqual(failedModules,[]);assert.deepEqual(errors,[]);
    }finally{await browser.close();await vite.close();}
  });
  // Every file in this workspace is a synthetic marker. Never probe an actual
  // operator authority, encrypted store, snapshot, key or backup directory.
  const privateDirectories=['.security','.security-backups','.local','.secrets','.docmonstakrakin'];
  const privateFiles=['authority.sqlite','authority.sqlite-wal','authority.sqlite-shm','backup.bak','fixture.key','.machine_token'];
  fs.writeFileSync(path.join(out,'ordinary.txt'),'SYNTHETIC_PUBLIC_CONTROL');
  fs.writeFileSync(path.join(out,'.security-notes.txt'),'SYNTHETIC_SIMILAR_NAME_CONTROL');
  fs.writeFileSync(path.join(out,'.env'),'DMK_SYNTHETIC_MARKER=SYNTHETIC_PRIVATE_FIXTURE');
  fs.writeFileSync(path.join(out,'fixture.pem'),'SYNTHETIC_PRIVATE_FIXTURE');
  fs.writeFileSync(path.join(out,'custom-denied.txt'),'SYNTHETIC_PRIVATE_FIXTURE');
  fs.mkdirSync(path.join(out,'public'));
  fs.writeFileSync(path.join(out,'public','ordinary-public.txt'),'SYNTHETIC_PUBLIC_ASSET_CONTROL');
  fs.writeFileSync(path.join(out,'ordinary-public.txt'),'SYNTHETIC_PUBLIC_ASSET_CONTROL');
  for(const directory of privateDirectories){
    fs.mkdirSync(path.join(out,directory));
    fs.mkdirSync(path.join(out,'public',directory));
    for(const filename of privateFiles){
      fs.writeFileSync(path.join(out,directory,filename),'SYNTHETIC_PRIVATE_FIXTURE');
      fs.writeFileSync(path.join(out,'public',directory,filename),'SYNTHETIC_PRIVATE_FIXTURE');
    }
  }
  fs.symlinkSync(path.join(out,'.security'),path.join(out,'public','opaque-directory'),process.platform==='win32'?'junction':'dir');
  for(const mode of ['standalone','middleware','preview'] as const){
    await check(mode+' rejects private state raw, filesystem, static and aliased assets',async()=>{
      const options:InlineConfig={root:out,configFile:path.join(root,'vite.config.ts'),logLevel:'silent',appType:'custom',
        resolve:{alias:Object.fromEntries(privateDirectories.flatMap((directory,index)=>[
          ['/opaque-private-'+index,path.join(out,directory)],
          ['/opaque-private-fs-'+index,'/@fs/'+path.join(out,directory).replaceAll('\\','/')],
        ]))},
        server:{port:0,fs:{deny:['**/custom-denied.txt']},...(mode==='middleware'?{middlewareMode:true}:{})},build:{outDir:out},preview:{port:0}};
      const vite=mode==='preview'?await preview(options):await createServer(options);
      let listener:http.Server|undefined;
      try{
        if(mode==='middleware'){
          listener=http.createServer((req,res)=>(vite as Awaited<ReturnType<typeof createServer>>).middlewares(req,res,()=>{res.statusCode=404;res.end();}));
          await new Promise<void>(resolve=>listener!.listen(0,'127.0.0.1',resolve));
        }else if(mode==='standalone')await (vite as Awaited<ReturnType<typeof createServer>>).listen();
        const port=((listener??vite.httpServer)!.address() as AddressInfo).port;
        const ordinary=await fixtureResponse(port,'/ordinary.txt?note=.security');
        assert.equal(ordinary.status,200);assert.equal(ordinary.body,'SYNTHETIC_PUBLIC_CONTROL');
        assert.equal((await fixtureResponse(port,'/ordinary-public.txt')).body,'SYNTHETIC_PUBLIC_ASSET_CONTROL');
        if(mode!=='preview'){
          assert.match((await fixtureResponse(port,'/.security-notes.txt?raw')).body,/SYNTHETIC_SIMILAR_NAME_CONTROL/);
        }
        for(const [index,directory] of privateDirectories.entries())for(const filename of privateFiles){
          const absolute=path.join(out,directory,filename).replaceAll('\\','/');
          const targets=[`/${directory}/${filename}?raw`,`/@fs/${absolute}?raw`,`/${directory}/${filename}`,`/${directory}/${filename}?url&import`,
            `/${directory.replace('.','%2e')}/${filename}?raw`,`/${directory.toUpperCase()}/${filename}?raw`];
          if(mode!=='preview')targets.push(`/opaque-private-${index}/${filename}?raw`,`/opaque-private-${index}/${filename}?url&import`,
            `/opaque-private-fs-${index}/${filename}?raw`,`/opaque-private-fs-${index}/${filename}?url&import`);
          for(const target of targets){
            const response=await fixtureResponse(port,target);
            assert.equal(response.status,403,target);assert.equal(response.body.includes('SYNTHETIC_PRIVATE_FIXTURE'),false,target);
          }
        }
        const linked=await fixtureResponse(port,`${mode==='preview'?'/public':''}/opaque-directory/authority.sqlite`);
        assert.equal(linked.status,403,'public directory link to private state');assert.equal(linked.body.includes('SYNTHETIC_PRIVATE_FIXTURE'),false);
        if(mode!=='preview')for(const target of ['/.env?raw','/fixture.pem?raw','/custom-denied.txt?raw'])assert.equal((await fixtureResponse(port,target)).status,403,target);
      }finally{
        if(listener)await new Promise<void>(resolve=>listener!.close(()=>resolve()));
        await vite.close();
      }
    });
  }
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
        if(kind==='dev'){
          // Missing file means no editor can launch. No-Origin local ingress is
          // allowed (500 for missing query), not authenticated or repaired here.
          assert.equal(await request(address.port,{},'/__open-in-editor'),500);
          const inertTarget='/__open-in-editor?file='+encodeURIComponent(path.join(out,'nonexistent-editor-fixture.txt'));
          assert.equal(await request(address.port,{Origin:'https://attacker.example'},inertTarget),403);
          assert.equal(await request(address.port,{Host:`attacker.example:${address.port}`},inertTarget),403);
        }
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
  // Remove only this fixture's dependency link before recursive cleanup. Never
  // recurse through the retained external dependency tree on Windows.
  const moduleLink=path.join(sourceAppRoot,'node_modules');
  assert.equal(path.dirname(out),os.tmpdir());assert(path.basename(out).startsWith('dmk-vite-perimeter-'));
  if(fs.lstatSync(moduleLink).isSymbolicLink())fs.unlinkSync(moduleLink);
  fs.rmSync(out,{recursive:true,force:true});
}
console.log(`Vite perimeter checks: ${passed} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
