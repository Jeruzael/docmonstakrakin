import {createHash} from 'node:crypto';

/** Opt-in protocol admission. A digest binds intent; it is not authorization. */
export function actionRequestHash(input:{method:string;url:string;expectedRevision:number;body:unknown}):string {
 const fail=():never=>{throw Error('WORKSPACE_ACTION_INPUT_INVALID');};
 if(!['POST','PATCH','PUT','DELETE','GET','HEAD'].includes(input.method)||typeof input.url!=='string'||
  !/^\/api\/projects(?:[/?]|$)/.test(input.url)||input.url.length>8192||/[\r\n\0]/.test(input.url)||
  !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail();
 let nodes=0,bytes=0;
 const charge=(s:string)=>{bytes+=Buffer.byteLength(s);if(bytes>10*1024*1024||Buffer.from(s).toString('utf8')!==s)fail();return JSON.stringify(s);};
 function canonical(value:unknown,depth:number):string {
  if(depth>64||++nodes>100_000)fail();
  if(value===null)return'null';
  if(typeof value==='string')return charge(value);
  if(typeof value==='boolean')return String(value);
  if(typeof value==='number'){if(!Number.isFinite(value))fail();return JSON.stringify(value);}
  if(!value||typeof value!=='object'||Object.getOwnPropertySymbols(value).length)fail();
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail();
  const keys=Object.getOwnPropertyNames(value).filter(k=>!array||k!=='length');
  if(keys.length>100_000||array&&(keys.length!==(value as unknown[]).length||keys.some((k,i)=>k!==String(i))))fail();
  const result:string[]=[];
  for(const key of array?keys:keys.sort()){
   const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
   if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value')||['__proto__','prototype','constructor','toJSON'].includes(key))fail();
   const prefix=array?'':charge(key)+':';result.push(prefix+canonical(descriptor.value,depth+1));
  }
  return(array?'[':'{')+result.join(',')+(array?']':'}');
 }
 const body=canonical(input.body===undefined?null:input.body,0);
 if(Buffer.byteLength(body)>10*1024*1024)fail();
 return createHash('sha256').update(JSON.stringify(['DMK_ACTION/1',input.method,input.url,input.expectedRevision,body])).digest('hex');
}
