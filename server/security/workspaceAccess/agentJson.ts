export const AGENT_BODY_BYTES=16*1024;
/** Fixed transport data only: duplicate decoded names cannot disappear in JSON.parse. */
export function parseAgentJson(bytes:Buffer):Record<string,unknown> {
 const fail=():never=>{throw Object.assign(Error('AGENT_BODY_INVALID'),{status:400,type:'entity.parse.failed'});};
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>AGENT_BODY_BYTES)fail();
 const raw=bytes.toString('utf8');if(!Buffer.from(raw).equals(bytes))fail();let i=0,nodes=0;
 const white=()=>{while(i<raw.length&&/[\x20\x09\x0a\x0d]/.test(raw[i]))i++;};
 function string():string {
  const start=i;if(raw[i++]!=='"')return fail();
  while(i<raw.length){if(raw[i]==='"'){i++;const value=JSON.parse(raw.slice(start,i));if(Buffer.from(value).toString('utf8')!==value)fail();return value;}if(raw.charCodeAt(i)<32)fail();i+=raw[i]==='\\'?2:1;}
  return fail();
 }
 const primitive=/(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
 function walk(depth:number){
  if(depth>8||++nodes>4096)fail();white();const c=raw[i];
  if(c==='{'||c==='['){
   const object=c==='{',close=object?'}':']',keys=new Set<string>();i++;white();if(raw[i]===close){i++;return;}
   for(;;){if(object){white();const key=string();if(keys.has(key)||['__proto__','prototype','constructor','toJSON'].includes(key))fail();keys.add(key);white();if(raw[i++]!==':')fail();}walk(depth+1);white();if(raw[i]===close){i++;return;}if(raw[i++]!==',')fail();}
  }
  if(c==='"'){string();return;}primitive.lastIndex=i;const match=primitive.exec(raw);if(!match||/^-?\d/.test(match[0])&&!Number.isFinite(Number(match[0])))fail();i=primitive.lastIndex;
 }
 try{white();if(raw[i]!=='{')fail();walk(0);white();if(i!==raw.length)fail();return JSON.parse(raw);}catch{return fail();}
}
