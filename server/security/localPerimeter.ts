import type {IncomingMessage, ServerResponse} from 'node:http';

export interface LocalNetworkConfig {host:'127.0.0.1';port:number}

/** Validate before initializing credentials, recovery or persistence. No remote mode exists. */
export function resolveLocalNetworkConfig(env:NodeJS.ProcessEnv=process.env):LocalNetworkConfig {
  const host=env.HOST??'127.0.0.1';
  if(host!=='127.0.0.1')throw new Error('INVALID_LOCAL_HOST: only 127.0.0.1 is supported; secured remote deployment requires a separate design');
  const value=env.PORT??'3000';
  if(!/^[1-9]\d{0,4}$/.test(value)||Number(value)>65535)throw new Error('INVALID_LOCAL_PORT: expected an integer from 1 through 65535');
  return {host,port:Number(value)};
}

function reject(res:ServerResponse,status:number,error:string,message:string){
  res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify({error,message}));
}

/** Browser/network containment only. Passing this check authenticates no person or process. */
export function localRequestBoundary(req:IncomingMessage,res:ServerResponse,next:()=>void):void {
  const count=(name:string)=>req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===name).length;
  const port=req.socket.localPort;
  const host=req.headers.host;
  const authorities=port===80?['127.0.0.1','localhost']:['127.0.0.1:'+port,'localhost:'+port];
  if(!port||count('host')!==1||typeof host!=='string'||!authorities.includes(host.toLowerCase())||
    Object.keys(req.headers).some(k=>k==='forwarded'||k.startsWith('x-forwarded-'))){
    return reject(res,403,'LOCAL_HOST_REQUIRED','Use the direct loopback service address; proxy and remote authority are unsupported');
  }
  const origin=req.headers.origin;
  const site=req.headers['sec-fetch-site'];
  if(count('origin')>1||count('sec-fetch-site')>1||
    (origin!==undefined&&origin!==`http://${host.toLowerCase()}`)||
    (site!==undefined&&!['same-origin','none'].includes(String(site)))){
    return reject(res,403,'LOCAL_ORIGIN_REQUIRED','Cross-origin browser access to this local service is blocked');
  }
  const target=req.url??'';
  try{
    if(!target.startsWith('/')||target.startsWith('//'))throw new Error();
    const pathname=target.split('?')[0];
    for(const part of pathname.split('/')){
      const decoded=decodeURIComponent(part);
      if(/[\\/%\u0000-\u001f\u007f]/.test(decoded)||decoded==='.'||decoded==='..')throw new Error();
    }
  }catch{return reject(res,400,'AMBIGUOUS_LOCAL_PATH','Malformed or ambiguous request path');}
  res.setHeader('X-Content-Type-Options','nosniff');
  next();
}
