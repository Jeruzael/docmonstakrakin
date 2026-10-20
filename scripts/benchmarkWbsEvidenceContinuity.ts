/** Explicit offline synthetic benchmark; never discovered by the regression runner.
 * Run: node --import tsx scripts/benchmarkWbsEvidenceContinuity.ts --suite LABEL
 * Same file copied to baseline and candidate disposable clones. No product writes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as continuity from './wbsEvidenceContinuity.ts';
import * as transaction from './planWbsRegistrationTransaction.ts';
import { policyDigestV2, registrationSigningPayloadV2, type TrustedPolicyV2, type RegistrationIntentV2, type SignedReceiptV2 } from './verifyTrustedWbsRegistrationV2.ts';

const sha = (b: crypto.BinaryLike) => crypto.createHash('sha256').update(b).digest('hex');
const gitId = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
const GRID = [1, 8, 32, 128, 256] as const;
const SAMPLES = 5, WATCHDOG_MS = 60_000;

/** Fixed public synthetic seeds; NEVER enrolled or used outside disposable tests. */
export function syntheticWbsProof(count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 256) throw Error('Unsupported synthetic profile');
  const historicalBytes = fs.readFileSync('docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml');
  const keys = [0,1].map(i => crypto.createPrivateKey({ format:'der', type:'pkcs8',
    key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),crypto.createHash('sha256').update('PUBLIC-SYNTHETIC-DMK-R11-'+i).digest()]) }));
  const roles = ['Security Officer','Lead Architect'];
  const policy: TrustedPolicyV2 = { schemaVersion:'2.0',policyId:'PUBLIC-SYNTHETIC-RESOURCE-PROFILE',policyVersion:'1',requiredRoles:roles,
    humanKeys:keys.map((key,i)=>({principalId:'SYNTHETIC-PERSON-'+i,role:roles[i],keyId:'SYNTHETIC-KEY-'+i,kind:'HUMAN',revoked:false,
      publicKeyPem:crypto.createPublicKey(key).export({type:'spki',format:'pem'}).toString(),validNotBefore:'2026-01-01T00:00:00.000Z',validNotAfter:'2027-01-01T00:00:00.000Z'})) };
  const policySha256=policyDigestV2(policy), ledger=transaction.makeHistoricalWbsReceiptLedger();
  let before=historicalBytes, ledgerBytes=transaction.serializeWbsReceiptLedger(ledger);
  const links:continuity.ForwardWbsEvidence['links']=[], applications:continuity.WbsContinuityAuthority['applications']=[];
  for(let i=0;i<count;i++) {
    const item={id:'DMK-'+(209+i),wbs_path:'13.06.'+(22+i),status:'PROPOSED' as const,epic:'EPIC-13'};
    const after=Buffer.concat([before,Buffer.from('\n  - id: "'+item.id+'"\n    wbs_path: "'+item.wbs_path+'"\n    status: "PROPOSED"\n    epic: "EPIC-13"\n')]);
    const git={repository:'Jeruzael/docmonstakrakin',pullRequestNumber:1000+i,baseCommitSha:gitId('base:'+i),reviewedHeadCommitSha:gitId('head:'+i),reviewedHeadTreeSha:gitId('tree:'+i)};
    const intent:RegistrationIntentV2={schemaVersion:'2.0',projectId:'PRJ-DOCMONSTAKRAKIN',operation:'ADD_WBS_ITEMS',receiptId:'SYNTHETIC-RESOURCE-'+i,
      preWbsSha256:sha(before),postWbsSha256:sha(after),approvedItems:[item],policyId:policy.policyId,policyVersion:policy.policyVersion,policySha256,
      notBefore:'2026-10-01T00:00:00.000Z',notAfter:'2026-11-01T00:00:00.000Z',git};
    const receipt:SignedReceiptV2={intent,signatures:keys.map((key,n)=>({principalId:'SYNTHETIC-PERSON-'+n,role:roles[n],keyId:'SYNTHETIC-KEY-'+n,kind:'HUMAN',
      signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intent),key).toString('base64')}))};
    const rawReceiptBytes=Buffer.from(JSON.stringify(receipt));
    const ledgerBeforeSha256=sha(ledgerBytes);
    ledger.entries.push({receiptId:intent.receiptId,preWbsSha256:intent.preWbsSha256,postWbsSha256:intent.postWbsSha256,policySha256,
      signedIntentSha256:sha(registrationSigningPayloadV2(intent)),signedReceiptSha256:transaction.signedReceiptDigestV2(receipt),
      reviewedHeadCommitSha:git.reviewedHeadCommitSha,reviewedHeadTreeSha:git.reviewedHeadTreeSha,pullRequestNumber:git.pullRequestNumber});
    ledgerBytes=transaction.serializeWbsReceiptLedger(ledger);
    links.push({beforeBytes:before,afterBytes:after,receipt,rawReceiptBytes,policy});
    applications.push({receiptId:intent.receiptId,preWbsSha256:intent.preWbsSha256,postWbsSha256:intent.postWbsSha256,ledgerBeforeSha256,ledgerAfterSha256:sha(ledgerBytes),
      rawReceiptSha256:sha(rawReceiptBytes),policySha256,policyEpoch:1,revocationSequence:1,appliedAt:'2026-10-20T00:00:00.000Z',
      appliedCommitSha:gitId('applied:'+i),appliedTreeSha:gitId('applied-tree:'+i),expectedGit:git});
    before=after;
  }
  const last=applications.at(-1)!;
  const context:continuity.WbsContinuityAuthority={nowIso:'2026-10-20T00:00:30.000Z',validUntilIso:'2026-10-20T00:01:00.000Z',authorityEpoch:1,minimumAuthorityEpoch:1,
    revocationSequence:1,minimumRevocationSequence:1,protected:{wbsSha256:sha(before),ledgerSha256:sha(ledgerBytes),masterCommitSha:last.appliedCommitSha,masterTreeSha:last.appliedTreeSha},applications};
  return {input:{historicalBytes,currentBytes:before,forward:{ledgerBytes,links}},context};
}

function profileSizes(f: ReturnType<typeof syntheticWbsProof>) {
  let logicalBytes=f.input.historicalBytes.length+f.input.currentBytes.length+f.input.forward.ledgerBytes.length+Buffer.byteLength(JSON.stringify(f.context));
  for(const l of f.input.forward.links) logicalBytes+=l.beforeBytes.length+l.afterBytes.length+l.rawReceiptBytes.length+Buffer.byteLength(JSON.stringify(l.receipt))+Buffer.byteLength(JSON.stringify(l.policy));
  const serialized=JSON.stringify({historical:f.input.historicalBytes.toString(),current:f.input.currentBytes.toString(),ledger:f.input.forward.ledgerBytes.toString(),
    links:f.input.forward.links.map(l=>({before:l.beforeBytes.toString(),after:l.afterBytes.toString(),receipt:l.receipt,raw:l.rawReceiptBytes.toString(),policy:l.policy})),context:f.context});
  return {logicalBytes,serializedBytes:Buffer.byteLength(serialized),inputSha256:sha(serialized),ledgerBytes:f.input.forward.ledgerBytes.length,
    maxSnapshotBytes:Math.max(f.input.currentBytes.length,...f.input.forward.links.map(l=>l.afterBytes.length))};
}

function worker(count:number) {
  const setupStart=performance.now(), f=syntheticWbsProof(count), sizes=profileSizes(f), setupMs=performance.now()-setupStart;
  const cpu=process.cpuUsage(), heapBefore=process.memoryUsage().heapUsed, start=performance.now();
  const result=continuity.verifyWbsEvidenceContinuity(f.input,()=>f.context);
  const wallMs=performance.now()-start, used=process.cpuUsage(cpu), usage=process.resourceUsage();
  const heapAfter=process.memoryUsage().heapUsed;
  // GC trace writes stdout at native boundaries. A separate fd prevents it from
  // interleaving inside the JSON record when stdout is redirected on Windows.
  console.error('BENCH_RESULT '+JSON.stringify({count,...sizes,setupMs,wallMs,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,
    peakRssKiB:usage.maxRSS,heapBefore,heapAfter,valid:result.valid,mayApply:result.mayApply,errors:result.errors}));
  if(!result.valid||result.mayApply) process.exitCode=1;
}

function prefixWorker(count:number) {
  const f=syntheticWbsProof(count), bytes=f.input.forward.ledgerBytes;
  const optimized=(transaction as any).parseWbsReceiptLedgerWithPrefixes;
  let encodedBytes=bytes.length,hashedBytes=0,encodedEntries=0;
  const start=performance.now();let prefixMs=0,equivalenceMs=0;
  if(optimized) {
    const p=optimized(bytes);({encodedBytes,hashedBytes,encodedEntries}=p);
    prefixMs=performance.now()-start;const referenceStart=performance.now();
    for(let i=0;i<=count;i++) if(p.digests[i]!==sha(transaction.serializeWbsReceiptLedger({...p.ledger,entries:p.ledger.entries.slice(0,i)}))) throw Error('Canonical prefix digest mismatch');
    equivalenceMs=performance.now()-referenceStart;
  } else {
    const parsed=transaction.parseWbsReceiptLedgerV1(bytes);
    for(let i=0;i<count;i++) for(const n of [i,i+1]) {
      const b=transaction.serializeWbsReceiptLedger({...parsed,entries:parsed.entries.slice(0,n)});
      encodedBytes+=b.length;hashedBytes+=b.length;encodedEntries+=n;sha(b);
    }
    prefixMs=performance.now()-start;
  }
  console.log('PREFIX_RESULT '+JSON.stringify({count,ledgerBytes:bytes.length,encodedBytes,hashedBytes,encodedEntries,prefixMs,equivalenceMs}));
}

function suite(label:string) {
  const script=fileURLToPath(import.meta.url), loader=process.execArgv;
  console.log(JSON.stringify({kind:'environment',label,timestamp:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,
    release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,hostMemoryBytes:os.totalmem(),watchdogMs:WATCHDOG_MS,
    grid:GRID,samples:SAMPLES,heapMetric:'GC-observed high-water plus pre/post heapUsed; not exact instantaneous peak',limits:'External cgroup/host limits recorded by operator'}));
  for(const count of GRID) {
    for(let sample=1;sample<=SAMPLES;sample++) {
      const start=performance.now();
      const child=spawnSync(process.execPath,['--trace-gc-nvp',...loader,script,'--worker',String(count)],
        {cwd:process.cwd(),encoding:'utf8',windowsHide:true,timeout:WATCHDOG_MS,maxBuffer:32*1024*1024,env:{...process.env,GEMINI_API_KEY:''}});
      const output=(child.stdout||'')+'\n'+(child.stderr||''), line=(child.stderr||'').split(/\r?\n/).find(l=>l.startsWith('BENCH_RESULT '));
      const measured=line?JSON.parse(line.slice(13)):undefined;
      const observed=[...output.matchAll(/total_size_(?:before|after)=(\d+)/g)].map(m=>Number(m[1]));
      const gcObservedHeapBytes=Math.max(0,...observed,measured?.heapBefore||0,measured?.heapAfter||0);
      console.log(JSON.stringify({kind:'sample',label,count,sample,exitCode:child.status,signal:child.signal,error:child.error?.message,
        processMs:performance.now()-start,gcObservedHeapBytes,...measured,tail:measured?undefined:output.slice(-2000)}));
      if(!measured||!measured.valid||child.status!==0) process.exitCode=1;
    }
    const p=spawnSync(process.execPath,[...loader,script,'--prefix',String(count)],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,timeout:WATCHDOG_MS,maxBuffer:1024*1024});
    const line=(p.stdout||'').split(/\r?\n/).find(l=>l.startsWith('PREFIX_RESULT '));
    let prefix: any;
    try { prefix=line&&JSON.parse(line.slice(14)); } catch { /* Invalid child output must fail the suite. */ }
    const hasValidResult=Boolean(prefix&&prefix.count===count&&['encodedBytes','hashedBytes','encodedEntries','prefixMs','equivalenceMs'].every(k=>Number.isFinite(prefix[k])&&prefix[k]>=0));
    console.log(JSON.stringify({kind:'prefix',label,count,exitCode:p.status,hasValidResult,output:p.stdout,error:p.error?.message,stderr:p.stderr}));
    if(p.status!==0||p.error||!hasValidResult) process.exitCode=1;
  }
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked) {
  const [mode,arg]=process.argv.slice(2);
  if(mode==='--worker') worker(Number(arg));
  else if(mode==='--prefix') prefixWorker(Number(arg));
  else if(mode==='--suite'&&arg) suite(arg);
  else throw Error('Explicit --suite LABEL, --worker COUNT or --prefix COUNT required');
}
