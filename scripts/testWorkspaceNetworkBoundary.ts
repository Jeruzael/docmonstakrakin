import assert from'node:assert/strict';import{localRequestBoundary}from'../server/security/localPerimeter.ts';
let passed=0,failed=0;function check(name:string,fn:()=>void){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e);}}
function admit(encrypted:boolean,origin:string,port=3443,extra:Record<string,string>={}){let accepted=false,status=200;const headers={host:'127.0.0.1:'+port,origin,...extra};const req={socket:{localPort:port,encrypted},headers,rawHeaders:Object.entries(headers).flat(),url:'/api/projects'};const res={set statusCode(v:number){status=v;},setHeader(){},end(){}};localRequestBoundary(req as any,res as any,()=>accepted=true);return{accepted,status};}
check('direct HTTPS origin follows actual encrypted socket',()=>assert.deepEqual(admit(true,'https://127.0.0.1:3443'),{accepted:true,status:200}));
check('HTTP origin cannot masquerade as same origin on encrypted socket',()=>assert.equal(admit(true,'http://127.0.0.1:3443').status,403));
check('HTTPS claim does not upgrade plaintext socket',()=>assert.equal(admit(false,'https://127.0.0.1:3443').status,403));
check('direct HTTP development origin remains accepted',()=>assert.equal(admit(false,'http://127.0.0.1:3443').accepted,true));
check('forwarded protocol never grants admission',()=>assert.equal(admit(true,'https://127.0.0.1:3443',3443,{'x-forwarded-proto':'https'}).status,403));
console.log(JSON.stringify({suite:'workspace-network-boundary',passed,failed}));if(failed)process.exitCode=1;
