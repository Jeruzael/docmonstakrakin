import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  CANONICAL_SIGNED_RECEIPT_DOMAIN_V2,
  canonicalSignedReceiptPayloadV2,
  makeHistoricalWbsReceiptLedger,
  parseWbsReceiptLedgerV1,
  previewWbsRegistrationTransaction,
  serializeWbsReceiptLedger,
  signedReceiptDigestV2,
  type WbsRegistrationPreflightInput,
} from './planWbsRegistrationTransaction.ts';
import { HISTORICAL_WBS_SHA256 } from './verifyForwardWbsEvidence.ts';
import { policyDigestV2, registrationSigningPayloadV2, type TrustedPolicyV2, type RegistrationIntentV2 } from './verifyTrustedWbsRegistrationV2.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const historic=fs.readFileSync('docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml');
const after=Buffer.concat([historic,Buffer.from('\n  - id: "DMK-209"\n    wbs_path: "13.06.22"\n    status: "PROPOSED"\n')]);
const digest=(x:Buffer)=>crypto.createHash('sha256').update(x).digest('hex');
const a=crypto.generateKeyPairSync('ed25519'),b=crypto.generateKeyPairSync('ed25519');
const key=(pair:typeof a,id:string,role:string,keyId:string)=>({
  principalId:id,role,keyId,kind:'HUMAN' as const,revoked:false,
  publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}).toString(),
  validNotBefore:'2026-01-01T00:00:00.000Z',validNotAfter:'2027-01-01T00:00:00.000Z',
});
const policy:TrustedPolicyV2={
  schemaVersion:'2.0',policyId:'SYNTHETIC-ONLY',policyVersion:'2.0',
  requiredRoles:['Security Officer','Lead Architect'],
  humanKeys:[key(a,'A','Security Officer','K-A'),key(b,'B','Lead Architect','K-B')],
};
const git={repository:'Jeruzael/docmonstakrakin',pullRequestNumber:34,baseCommitSha:'a'.repeat(40),reviewedHeadCommitSha:'b'.repeat(40),reviewedHeadTreeSha:'c'.repeat(40)};
const intent:RegistrationIntentV2={
  schemaVersion:'2.0',projectId:'PRJ-DOCMONSTAKRAKIN',operation:'ADD_WBS_ITEMS',
  receiptId:'WBS-SYNTHETIC-TEST-0001',preWbsSha256:digest(historic),postWbsSha256:digest(after),
  approvedItems:[{id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED'}],
  policyId:policy.policyId,policyVersion:policy.policyVersion,policySha256:policyDigestV2(policy),
  notBefore:'2026-10-01T00:00:00.000Z',notAfter:'2026-11-01T00:00:00.000Z',git,
};
const sign=(pair:typeof a,principalId:string,role:string,keyId:string)=>({
 principalId,role,keyId,kind:'HUMAN' as const,
 signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intent),pair.privateKey).toString('base64'),
});
const receipt={intent,signatures:[sign(a,'A','Security Officer','K-A'),sign(b,'B','Lead Architect','K-B')]};
const genesis=makeHistoricalWbsReceiptLedger();
const ledgerBytes=serializeWbsReceiptLedger(genesis);
const context={
 pinnedPolicySha256:policyDigestV2(policy),expectedGit:git,nowIso:'2026-10-16T00:00:00.000Z',consumedReceiptIds:[],
};
const data:WbsRegistrationPreflightInput={
 beforeBytes:historic,afterBytes:after,ledgerBytes,receipt,policy,trustedContext:context,
 expectedCurrentWbsSha256:HISTORICAL_WBS_SHA256,expectedCurrentLedgerSha256:digest(ledgerBytes),
};
const preview=(change:Partial<WbsRegistrationPreflightInput>={})=>previewWbsRegistrationTransaction({...data,...change});
let passes=0;
function check(name:string,fn:()=>void){fn();passes++;console.log('PASS '+name);}
check('Historical genesis WBS digest anchored',()=>assert.equal(digest(historic),HISTORICAL_WBS_SHA256));
check('Synthetic fully signed evidence produces only read-only preview',()=>{
 const p=preview();assert.equal(p.valid,true);assert.equal(p.mode,'PREVIEW_VALID');
 assert.equal(p.mayApply,false);assert.ok(p.proposedLedgerBytes);
 assert.equal(p.proposedLedgerSha256,digest(p.proposedLedgerBytes!));
});
check('Synthetic preview cannot write WBS or authoritative ledger',()=>{
 const first=preview(),second=preview();
 assert.deepEqual(first.proposedLedgerBytes,second.proposedLedgerBytes);
 assert.equal(fs.readFileSync('docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml').equals(historic),true);
});
check('Stale protected WBS hash rejects',()=>assert.equal(preview({expectedCurrentWbsSha256:'f'.repeat(64)}).valid,false));
check('Stale protected ledger hash rejects',()=>assert.equal(preview({expectedCurrentLedgerSha256:'f'.repeat(64)}).valid,false));
check('Untrusted altered receipt ledger bytes reject',()=>assert.equal(preview({ledgerBytes:Buffer.concat([ledgerBytes,Buffer.from(' ')])}).valid,false));
check('Disconnected nonempty ledger chain rejects',()=>{
 const broken=serializeWbsReceiptLedger({...genesis,entries:[{
  receiptId:'WBS-PREVIOUS-TEST-01',preWbsSha256:'f'.repeat(64),postWbsSha256:'e'.repeat(64),
  policySha256:'d'.repeat(64),signedIntentSha256:'c'.repeat(64),
  signedReceiptSha256:'b'.repeat(64),reviewedHeadCommitSha:'a'.repeat(40),
  reviewedHeadTreeSha:'b'.repeat(40),pullRequestNumber:34
 }]});
 assert.equal(preview({ledgerBytes:broken,expectedCurrentLedgerSha256:digest(broken)}).valid,false);
});
check('Ledger matching current WBS but duplicated receipt rejects',()=>{
 const p=preview();assert.ok(p.proposedLedgerBytes);
 assert.equal(preview({ledgerBytes:p.proposedLedgerBytes!,expectedCurrentLedgerSha256:digest(p.proposedLedgerBytes!)}).valid,false);
});
check('Mismatched consumed-receipt set rejects',()=>assert.equal(preview({trustedContext:{...context,consumedReceiptIds:['WBS-OTHER-RECEIPT']}}).valid,false));
check('Missing independently authenticated inputs reject',()=>{
 assert.equal(preview({trustedContext:{...context,pinnedPolicySha256:''}}).valid,false);
 assert.equal(preview({trustedContext:{...context,expectedGit:{...git,pullRequestNumber:35}}}).valid,false);
});
check('Bad WBS exact bytes reject',()=>assert.equal(preview({afterBytes:Buffer.concat([after,Buffer.from('# stealth\n')])}).valid,false));
check('Missing signatures reject',()=>assert.equal(preview({receipt:{...receipt,signatures:[]}}).valid,false));
check('Missing ledger bytes reject',()=>assert.equal(preview({ledgerBytes:null as any}).valid,false));
check('Duplicate JSON keys reject noncanonical ledger',()=>{
 const untrusted=Buffer.from('{"schemaVersion":"1.0","schemaVersion":"1.0","projectId":"PRJ-DOCMONSTAKRAKIN","genesisWbsSha256":"'+HISTORICAL_WBS_SHA256+'","entries":[]}\n');
 assert.equal(preview({ledgerBytes:untrusted,expectedCurrentLedgerSha256:digest(untrusted)}).valid,false);
});
check('Malformed receipt with BigInt or nonfinite number fails closed without exception',()=>{
 const withBigInt={...receipt,extraBigInt:1n} as unknown as typeof receipt;
 const r1=preview({receipt:withBigInt});
 assert.equal(r1.valid,false);
 assert.equal(r1.mode,'REJECTED');
 assert.equal(r1.mayApply,false);
 assert.ok(r1.errors.some(e=>e.includes('Signed receipt schema or canonical serialization invalid')));

 const sigWithBigInt={...receipt,signatures:[{...receipt.signatures[0],extra:1n} as any,receipt.signatures[1]]};
 const r2=preview({receipt:sigWithBigInt});
 assert.equal(r2.valid,false);
 assert.equal(r2.mode,'REJECTED');
 assert.equal(r2.mayApply,false);

 const itemWithNaN={
  ...receipt,
  intent:{...intent,approvedItems:[{id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED',badNum:Number.NaN}]},
 };
 const r3=preview({receipt:itemWithNaN});
 assert.equal(r3.valid,false);
 assert.equal(r3.mode,'REJECTED');
 assert.equal(r3.mayApply,false);
});
check('Malformed receipt with cyclic object or array reference fails closed without exception',()=>{
 const cyclic:Record<string,unknown>={...receipt};
 cyclic.self=cyclic;
 const r1=preview({receipt:cyclic as unknown as typeof receipt});
 assert.equal(r1.valid,false);
 assert.equal(r1.mode,'REJECTED');
 assert.equal(r1.mayApply,false);

 const cyclicItem:Record<string,unknown>={id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED'};
 cyclicItem.self=cyclicItem;
 const r2=preview({receipt:{...receipt,intent:{...intent,approvedItems:[cyclicItem]}}});
 assert.equal(r2.valid,false);
 assert.equal(r2.mode,'REJECTED');
 assert.equal(r2.mayApply,false);
});
check('Malformed receipt with hostile getter, prototype object, or toJSON fails closed without exception',()=>{
 const throwingReceipt=Object.defineProperty({...receipt},'intent',{
  enumerable:true,
  get(){throw new Error('hostile getter');},
 });
 const r1=preview({receipt:throwingReceipt as unknown as typeof receipt});
 assert.equal(r1.valid,false);
 assert.equal(r1.mode,'REJECTED');
 assert.equal(r1.mayApply,false);
 assert.ok(r1.errors.some(e=>e.includes('Signed receipt schema or canonical serialization invalid: hostile getter')));

 const protoReceipt=Object.assign(Object.create({inherited:true}),receipt);
 const r2=preview({receipt:protoReceipt});
 assert.equal(r2.valid,false);
 assert.equal(r2.mode,'REJECTED');
 assert.equal(r2.mayApply,false);

 const itemWithToJson={
  ...receipt,
  intent:{...intent,approvedItems:[{id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED',toJSON:()=>({})}]},
 };
 const r3=preview({receipt:itemWithToJson});
 assert.equal(r3.valid,false);
 assert.equal(r3.mode,'REJECTED');
 assert.equal(r3.mayApply,false);
});
check('Unexpected fields in receipt, intent, git, or signatures reject',()=>{
 const extraTop={...receipt,unauthenticatedNote:'bypass'} as unknown as typeof receipt;
 assert.equal(preview({receipt:extraTop}).valid,false);

 const extraSig={...receipt,signatures:[{...receipt.signatures[0],extraSigField:'bypass'} as any,receipt.signatures[1]]};
 assert.equal(preview({receipt:extraSig}).valid,false);

 const intentWithExtra={...intent,extraIntentField:'bypass'} as unknown as RegistrationIntentV2;
 const receiptExtraIntent={
  intent:intentWithExtra,
  signatures:[
   {principalId:'A',role:'Security Officer',keyId:'K-A',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intentWithExtra),a.privateKey).toString('base64')},
   {principalId:'B',role:'Lead Architect',keyId:'K-B',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intentWithExtra),b.privateKey).toString('base64')},
  ],
 };
 assert.equal(preview({receipt:receiptExtraIntent}).valid,false);

 const gitWithExtra={...git,extraGitField:'bypass'} as unknown as typeof git;
 const intentExtraGit={...intent,git:gitWithExtra};
 const receiptExtraGit={
  intent:intentExtraGit,
  signatures:[
   {principalId:'A',role:'Security Officer',keyId:'K-A',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intentExtraGit),a.privateKey).toString('base64')},
   {principalId:'B',role:'Lead Architect',keyId:'K-B',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intentExtraGit),b.privateKey).toString('base64')},
  ],
 };
 assert.equal(preview({receipt:receiptExtraGit,trustedContext:{...context,expectedGit:gitWithExtra}}).valid,false);
});
check('Non-canonical signatureBase64 encoding rejects',()=>{
 const nonCanonicalB64={...receipt,signatures:[{...receipt.signatures[0],signatureBase64:' '+receipt.signatures[0].signatureBase64+' '},receipt.signatures[1]]};
 const r=preview({receipt:nonCanonicalB64});
 assert.equal(r.valid,false);
 assert.equal(r.mode,'REJECTED');
 assert.ok(r.errors.some(e=>e.includes('Signed receipt schema or canonical serialization invalid')));
});
check('Semantically equivalent valid receipts produce identical signedReceiptSha256 and proposedLedgerBytes',()=>{
 const reorderedGit={
  reviewedHeadTreeSha:git.reviewedHeadTreeSha,
  reviewedHeadCommitSha:git.reviewedHeadCommitSha,
  baseCommitSha:git.baseCommitSha,
  pullRequestNumber:git.pullRequestNumber,
  repository:git.repository,
 };
 const reorderedIntent:RegistrationIntentV2={
  git:reorderedGit,
  notAfter:intent.notAfter,
  notBefore:intent.notBefore,
  policySha256:intent.policySha256,
  policyVersion:intent.policyVersion,
  policyId:intent.policyId,
  approvedItems:[{status:'PROPOSED',wbs_path:'13.06.22',id:'DMK-209'}],
  postWbsSha256:intent.postWbsSha256,
  preWbsSha256:intent.preWbsSha256,
  receiptId:intent.receiptId,
  operation:intent.operation,
  projectId:intent.projectId,
  schemaVersion:intent.schemaVersion,
 };
 const sigA=receipt.signatures[0];
 const sigB=receipt.signatures[1];
 const reorderedSigB={
  signatureBase64:sigB.signatureBase64,
  kind:sigB.kind,
  keyId:sigB.keyId,
  role:sigB.role,
  principalId:sigB.principalId,
 };
 const reorderedSigA={
  signatureBase64:sigA.signatureBase64,
  kind:sigA.kind,
  keyId:sigA.keyId,
  role:sigA.role,
  principalId:sigA.principalId,
 };
 const equivalentReceipt={
  signatures:[reorderedSigB,reorderedSigA],
  intent:reorderedIntent,
 } as typeof receipt;

 const payload1=canonicalSignedReceiptPayloadV2(receipt);
 const payload2=canonicalSignedReceiptPayloadV2(equivalentReceipt);
 assert.ok(payload1.toString('utf8').startsWith(CANONICAL_SIGNED_RECEIPT_DOMAIN_V2+'\n'));
 assert.deepEqual(payload1,payload2);
 assert.equal(signedReceiptDigestV2(receipt),signedReceiptDigestV2(equivalentReceipt));

 const p1=preview({receipt});
 const p2=preview({receipt:equivalentReceipt});
 assert.equal(p1.valid,true);
 assert.equal(p2.valid,true);
 assert.equal(p1.proposedLedgerSha256,p2.proposedLedgerSha256);
 assert.deepEqual(p1.proposedLedgerBytes,p2.proposedLedgerBytes);
 const l1=JSON.parse(p1.proposedLedgerBytes!.toString('utf8'));
 const l2=JSON.parse(p2.proposedLedgerBytes!.toString('utf8'));
 assert.equal(l1.entries[0].signedReceiptSha256,signedReceiptDigestV2(receipt));
 assert.equal(l1.entries[0].signedReceiptSha256,l2.entries[0].signedReceiptSha256);
});
check('Strict ledger schema rejects unexpected top-level and per-entry properties',()=>{
 const extraTopBytes=Buffer.from(JSON.stringify({...genesis,extraField:'unexpected'},null,2)+'\n','utf8');
 const rTop=preview({ledgerBytes:extraTopBytes,expectedCurrentLedgerSha256:digest(extraTopBytes)});
 assert.equal(rTop.valid,false);
 assert.ok(rTop.errors.some(e=>e.includes('Receipt ledger header contains unexpected or missing properties')));

 const p1=preview();
 assert.ok(p1.proposedLedgerBytes);
 const parsed1=JSON.parse(p1.proposedLedgerBytes!.toString('utf8'));
 const extraEntryBytes=Buffer.from(JSON.stringify({
  ...parsed1,
  entries:[{...parsed1.entries[0],extraEntryProp:'bad'}],
 },null,2)+'\n','utf8');
 const rEntry=preview({
  beforeBytes:after,
  expectedCurrentWbsSha256:digest(after),
  ledgerBytes:extraEntryBytes,
  expectedCurrentLedgerSha256:digest(extraEntryBytes),
 });
 assert.equal(rEntry.valid,false);
 assert.ok(rEntry.errors.some(e=>e.includes('Receipt ledger entry contains unexpected or missing properties')));
});
check('Strict ledger schema rejects non-canonical top-level and per-entry field ordering',()=>{
 const reorderedTopBytes=Buffer.from(JSON.stringify({
  entries:[],
  genesisWbsSha256:HISTORICAL_WBS_SHA256,
  projectId:'PRJ-DOCMONSTAKRAKIN',
  schemaVersion:'1.0',
 },null,2)+'\n','utf8');
 const rOrderTop=preview({ledgerBytes:reorderedTopBytes,expectedCurrentLedgerSha256:digest(reorderedTopBytes)});
 assert.equal(rOrderTop.valid,false);
 assert.ok(rOrderTop.errors.some(e=>e.includes('Receipt ledger header fields are not in canonical order')));

 const p1=preview();
 assert.ok(p1.proposedLedgerBytes);
 const parsed1=JSON.parse(p1.proposedLedgerBytes!.toString('utf8'));
 const e0=parsed1.entries[0];
 const reorderedEntryBytes=Buffer.from(JSON.stringify({
  schemaVersion:'1.0',
  projectId:'PRJ-DOCMONSTAKRAKIN',
  genesisWbsSha256:HISTORICAL_WBS_SHA256,
  entries:[{
   pullRequestNumber:e0.pullRequestNumber,
   receiptId:e0.receiptId,
   preWbsSha256:e0.preWbsSha256,
   postWbsSha256:e0.postWbsSha256,
   policySha256:e0.policySha256,
   signedIntentSha256:e0.signedIntentSha256,
   signedReceiptSha256:e0.signedReceiptSha256,
   reviewedHeadCommitSha:e0.reviewedHeadCommitSha,
   reviewedHeadTreeSha:e0.reviewedHeadTreeSha,
  }],
 },null,2)+'\n','utf8');
 const rOrderEntry=preview({
  beforeBytes:after,
  expectedCurrentWbsSha256:digest(after),
  ledgerBytes:reorderedEntryBytes,
  expectedCurrentLedgerSha256:digest(reorderedEntryBytes),
 });
 assert.equal(rOrderEntry.valid,false);
 assert.ok(rOrderEntry.errors.some(e=>e.includes('Receipt ledger entry fields are not in canonical order')));
});

const after2=Buffer.concat([after,Buffer.from('\n  - id: "DMK-210"\n    wbs_path: "13.06.23"\n    status: "PROPOSED"\n')]);
const git2={
 repository:'Jeruzael/docmonstakrakin',
 pullRequestNumber:39,
 baseCommitSha:'b'.repeat(40),
 reviewedHeadCommitSha:'d'.repeat(40),
 reviewedHeadTreeSha:'e'.repeat(40),
};
const intent2:RegistrationIntentV2={
 schemaVersion:'2.0',
 projectId:'PRJ-DOCMONSTAKRAKIN',
 operation:'ADD_WBS_ITEMS',
 receiptId:'WBS-SYNTHETIC-TEST-0002',
 preWbsSha256:digest(after),
 postWbsSha256:digest(after2),
 approvedItems:[{id:'DMK-210',wbs_path:'13.06.23',status:'PROPOSED'}],
 policyId:policy.policyId,
 policyVersion:policy.policyVersion,
 policySha256:policyDigestV2(policy),
 notBefore:'2026-10-01T00:00:00.000Z',
 notAfter:'2026-11-01T00:00:00.000Z',
 git:git2,
};
const sign2=(pair:typeof a,principalId:string,role:string,keyId:string)=>({
 principalId,role,keyId,kind:'HUMAN' as const,
 signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intent2),pair.privateKey).toString('base64'),
});
const receipt2={
 intent:intent2,
 signatures:[sign2(a,'A','Security Officer','K-A'),sign2(b,'B','Lead Architect','K-B')],
};
const context2={
 pinnedPolicySha256:policyDigestV2(policy),
 expectedGit:git2,
 nowIso:'2026-10-16T01:00:00.000Z',
 consumedReceiptIds:['WBS-SYNTHETIC-TEST-0001'],
};

check('Synthetic two-registration sequence succeeds across chained ledger and exact WBS transitions',()=>{
 const step1=preview();
 assert.equal(step1.valid,true);
 assert.equal(step1.mode,'PREVIEW_VALID');
 assert.equal(step1.mayApply,false);
 assert.ok(step1.proposedLedgerBytes);

 const step2=previewWbsRegistrationTransaction({
  beforeBytes:after,
  afterBytes:after2,
  ledgerBytes:step1.proposedLedgerBytes!,
  expectedCurrentWbsSha256:step1.proposedWbsSha256!,
  expectedCurrentLedgerSha256:step1.proposedLedgerSha256!,
  receipt:receipt2,
  policy,
  trustedContext:context2,
 });
 assert.equal(step2.valid,true);
 assert.equal(step2.mode,'PREVIEW_VALID');
 assert.equal(step2.mayApply,false);
 assert.equal(step2.currentWbsSha256,digest(after));
 assert.equal(step2.proposedWbsSha256,digest(after2));
 assert.ok(step2.proposedLedgerBytes);
 const ledger2=JSON.parse(step2.proposedLedgerBytes!.toString('utf8'));
 assert.equal(ledger2.entries.length,2);
 assert.equal(ledger2.entries[0].receiptId,'WBS-SYNTHETIC-TEST-0001');
 assert.equal(ledger2.entries[0].preWbsSha256,digest(historic));
 assert.equal(ledger2.entries[0].postWbsSha256,digest(after));
 assert.equal(ledger2.entries[0].signedReceiptSha256,signedReceiptDigestV2(receipt));
 assert.equal(ledger2.entries[1].receiptId,'WBS-SYNTHETIC-TEST-0002');
 assert.equal(ledger2.entries[1].preWbsSha256,digest(after));
 assert.equal(ledger2.entries[1].postWbsSha256,digest(after2));
 assert.equal(ledger2.entries[1].signedReceiptSha256,signedReceiptDigestV2(receipt2));
});
check('Multi-registration sequence rejects reused receipt ID with specific consumption errors',()=>{
 const step1=preview();
 assert.ok(step1.proposedLedgerBytes);
 const reusedIntent:RegistrationIntentV2={...intent2,receiptId:'WBS-SYNTHETIC-TEST-0001'};
 const reusedReceipt={
  intent:reusedIntent,
  signatures:[
   {principalId:'A',role:'Security Officer',keyId:'K-A',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(reusedIntent),a.privateKey).toString('base64')},
   {principalId:'B',role:'Lead Architect',keyId:'K-B',kind:'HUMAN' as const,signatureBase64:crypto.sign(null,registrationSigningPayloadV2(reusedIntent),b.privateKey).toString('base64')},
  ],
 };
 const reusedResult=previewWbsRegistrationTransaction({
  beforeBytes:after,
  afterBytes:after2,
  ledgerBytes:step1.proposedLedgerBytes!,
  expectedCurrentWbsSha256:step1.proposedWbsSha256!,
  expectedCurrentLedgerSha256:step1.proposedLedgerSha256!,
  receipt:reusedReceipt,
  policy,
  trustedContext:context2,
 });
 assert.equal(reusedResult.valid,false);
 assert.equal(reusedResult.mode,'REJECTED');
 assert.equal(reusedResult.mayApply,false);
 assert.ok(reusedResult.errors.includes('Registration receipt was already consumed'));
 assert.ok(reusedResult.errors.some(e=>e.includes('Receipt consumption ledger missing or this receipt was already consumed')));
});
check('Multi-registration sequence rejects stale WBS, stale ledger, and stale consumed-receipt context with specific errors',()=>{
 const step1=preview();
 assert.ok(step1.proposedLedgerBytes);
 const step2Input:WbsRegistrationPreflightInput={
  beforeBytes:after,
  afterBytes:after2,
  ledgerBytes:step1.proposedLedgerBytes!,
  expectedCurrentWbsSha256:step1.proposedWbsSha256!,
  expectedCurrentLedgerSha256:step1.proposedLedgerSha256!,
  receipt:receipt2,
  policy,
  trustedContext:context2,
 };

 const staleWbsResult=previewWbsRegistrationTransaction({
  ...step2Input,
  beforeBytes:historic,
  expectedCurrentWbsSha256:digest(historic),
 });
 assert.equal(staleWbsResult.valid,false);
 assert.ok(staleWbsResult.errors.includes('Current WBS does not match last independently chained receipt state'));

 const staleProtectedWbsResult=previewWbsRegistrationTransaction({
  ...step2Input,
  expectedCurrentWbsSha256:digest(historic),
 });
 assert.equal(staleProtectedWbsResult.valid,false);
 assert.ok(staleProtectedWbsResult.errors.includes('Current WBS differs from independently verified protected-branch snapshot'));

 const staleLedgerResult=previewWbsRegistrationTransaction({
  ...step2Input,
  ledgerBytes,
 });
 assert.equal(staleLedgerResult.valid,false);
 assert.ok(staleLedgerResult.errors.includes('Receipt ledger differs from independently verified protected-branch snapshot'));
 assert.ok(staleLedgerResult.errors.includes('Current WBS does not match last independently chained receipt state'));

 const staleConsumedContextResult=previewWbsRegistrationTransaction({
  ...step2Input,
  trustedContext:{...context2,consumedReceiptIds:[]},
 });
 assert.equal(staleConsumedContextResult.valid,false);
 assert.ok(staleConsumedContextResult.errors.includes('Trusted receipt-consumption snapshot conflicts with canonical ledger'));
});
check('Ledger chain rejects repeated WBS state hashes including Genesis -> State X -> Genesis cycle',()=>{
 const stateXSha=digest(after);
 const cyclicLedgerBytes=serializeWbsReceiptLedger({
  ...genesis,
  entries:[
   {
    receiptId:'WBS-CYCLE-TEST-0001',
    preWbsSha256:HISTORICAL_WBS_SHA256,
    postWbsSha256:stateXSha,
    policySha256:policyDigestV2(policy),
    signedIntentSha256:'a'.repeat(64),
    signedReceiptSha256:'b'.repeat(64),
    reviewedHeadCommitSha:'c'.repeat(40),
    reviewedHeadTreeSha:'d'.repeat(40),
    pullRequestNumber:34,
   },
   {
    receiptId:'WBS-CYCLE-TEST-0002',
    preWbsSha256:stateXSha,
    postWbsSha256:HISTORICAL_WBS_SHA256,
    policySha256:policyDigestV2(policy),
    signedIntentSha256:'e'.repeat(64),
    signedReceiptSha256:'f'.repeat(64),
    reviewedHeadCommitSha:'a'.repeat(40),
    reviewedHeadTreeSha:'b'.repeat(40),
    pullRequestNumber:35,
   },
  ],
 });
 const cyclicResult=preview({
  ledgerBytes:cyclicLedgerBytes,
  expectedCurrentLedgerSha256:digest(cyclicLedgerBytes),
  trustedContext:{
   ...context,
   consumedReceiptIds:['WBS-CYCLE-TEST-0001','WBS-CYCLE-TEST-0002'],
  },
 });
 assert.equal(cyclicResult.valid,false);
 assert.equal(cyclicResult.mode,'REJECTED');
 assert.equal(cyclicResult.mayApply,false);
 assert.ok(cyclicResult.errors.some(e=>e.includes('Receipt ledger chain contains a WBS state cycle or repeated WBS digest')));

 const validStep1=preview();
 assert.equal(validStep1.valid,true);
 const validStep2=previewWbsRegistrationTransaction({
  beforeBytes:after,
  afterBytes:after2,
  ledgerBytes:validStep1.proposedLedgerBytes!,
  expectedCurrentWbsSha256:validStep1.proposedWbsSha256!,
  expectedCurrentLedgerSha256:validStep1.proposedLedgerSha256!,
  receipt:receipt2,
  policy,
  trustedContext:context2,
 });
 assert.equal(validStep2.valid,true);
 assert.equal(validStep2.mode,'PREVIEW_VALID');
 assert.equal(validStep2.mayApply,false);
});
check('Shared ledger parser preserves strict serialization and replay rejection',()=>{
 const applied=preview();
 assert.equal(applied.valid,true);
 const parsed=parseWbsReceiptLedgerV1(applied.proposedLedgerBytes!);
 assert.equal(parsed.entries.length,1);
 assert.throws(()=>parseWbsReceiptLedgerV1(Buffer.concat([applied.proposedLedgerBytes!,Buffer.from(' ')])));
 assert.throws(()=>parseWbsReceiptLedgerV1(serializeWbsReceiptLedger({...parsed,entries:[...parsed.entries,...parsed.entries]})));
 const replay=preview({beforeBytes:after,ledgerBytes:applied.proposedLedgerBytes!,expectedCurrentWbsSha256:digest(after),expectedCurrentLedgerSha256:applied.proposedLedgerSha256!,trustedContext:{...context,consumedReceiptIds:[receipt.intent.receiptId]}});
 assert.equal(replay.valid,false); assert.equal(replay.mayApply,false);
});
const prefixApi: any = await import('./planWbsRegistrationTransaction.ts');
check('Canonical prefix helper exists and rejects unparsed noncanonical evidence',()=>{
 assert.equal(typeof prefixApi.parseWbsReceiptLedgerWithPrefixes,'function');
 assert.throws(()=>prefixApi.parseWbsReceiptLedgerWithPrefixes(Buffer.concat([ledgerBytes,Buffer.from(' ')])));
});
for (const count of [0,1,2,8,32,256]) check('Every streaming prefix equals existing serializer SHA-256 at length '+count,()=>{
 const ledger=makeHistoricalWbsReceiptLedger();
 for(let i=0;i<count;i++) ledger.entries.push({
  receiptId:'SYNTHETIC-PREFIX-'+i,preWbsSha256:i?ledger.entries[i-1].postWbsSha256:HISTORICAL_WBS_SHA256,
  postWbsSha256:digest(Buffer.from('state:'+i)),policySha256:'d'.repeat(64),signedIntentSha256:'c'.repeat(64),
  signedReceiptSha256:'b'.repeat(64),reviewedHeadCommitSha:'a'.repeat(40),reviewedHeadTreeSha:'b'.repeat(40),pullRequestNumber:i+1,
 });
 const bytes=serializeWbsReceiptLedger(ledger), result=prefixApi.parseWbsReceiptLedgerWithPrefixes(bytes);
 assert.deepEqual(result.ledger,ledger);
 assert.equal(result.digests.length,count+1);
 for(let n=0;n<=count;n++) assert.equal(result.digests[n],digest(serializeWbsReceiptLedger({...ledger,entries:ledger.entries.slice(0,n)})));
 assert.ok(result.encodedBytes+result.hashedBytes<=4*bytes.length+4096);
 assert.equal(result.encodedEntries,count);
 assert.ok(serializeWbsReceiptLedger(ledger).equals(bytes));
});
check('Prefix parser retains malformed, duplicate, reordered, replay and depth rejection',()=>{
 const p=preview();const valid=parseWbsReceiptLedgerV1(p.proposedLedgerBytes!);
 for(const bytes of [Buffer.from('{'),Buffer.from('['.repeat(65)+'0'+']'.repeat(65)),
  serializeWbsReceiptLedger({...valid,entries:[...valid.entries,...valid.entries]}),
  Buffer.from(p.proposedLedgerBytes!.toString().replace('"schemaVersion": "1.0",','"schemaVersion": "1.0", "schemaVersion": "1.0",')),
  Buffer.from(p.proposedLedgerBytes!.toString().replace('"schemaVersion": "1.0",','"extra": 1, "schemaVersion": "1.0",'))])
  assert.throws(()=>prefixApi.parseWbsReceiptLedgerWithPrefixes(bytes));
});
check('Seeded varied canonical ledgers and all prefixes preserve exact legacy digests',()=>{
 let seed=0x53a11;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<20;trial++) {
  const ledger=makeHistoricalWbsReceiptLedger(),count=next()%40;
  for(let i=0;i<count;i++) ledger.entries.push({receiptId:'SYNTHETIC-RANDOM-'+next(),preWbsSha256:i?ledger.entries[i-1].postWbsSha256:HISTORICAL_WBS_SHA256,
   postWbsSha256:digest(Buffer.from(String(next()))),policySha256:digest(Buffer.from(String(next()))),signedIntentSha256:digest(Buffer.from(String(next()))),
   signedReceiptSha256:digest(Buffer.from(String(next()))),reviewedHeadCommitSha:crypto.createHash('sha1').update(String(next())).digest('hex'),
   reviewedHeadTreeSha:crypto.createHash('sha1').update(String(next())).digest('hex'),pullRequestNumber:next()+1});
  const bytes=serializeWbsReceiptLedger(ledger),p=prefixApi.parseWbsReceiptLedgerWithPrefixes(bytes);
  for(let i=0;i<=count;i++) assert.equal(p.digests[i],digest(serializeWbsReceiptLedger({...ledger,entries:ledger.entries.slice(0,i)})));
  assert.ok(p.encodedBytes+p.hashedBytes<=4*bytes.length+4096);
 }
});
check('Existing 2 MiB/5000 ledger rejection limits remain unchanged',()=>{
 assert.throws(()=>parseWbsReceiptLedgerV1(Buffer.alloc(2*1024*1024+1,32)),/limit/);
 assert.throws(()=>parseWbsReceiptLedgerV1(Buffer.from(JSON.stringify({...genesis,entries:Array(5001).fill(null)}))),/entry count.*limit/);
 for(const n of [4999,5000]) assert.throws(()=>parseWbsReceiptLedgerV1(Buffer.from(JSON.stringify({...genesis,entries:Array(n).fill(null)}))),/entry is not/);
});
check('Benchmark CLI fails failed/timed-out/missing/malformed prefix children and passes valid control',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wbs-prefix-harness-'));
 const preload=path.join(temp,'synthetic-child-results.mjs');
 try {
  // Inject subprocess outcomes at the OS boundary. No audit result here is
  // performance evidence; this tests the real public CLI's exit propagation.
  fs.writeFileSync(preload, String.raw`
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
const original=cp.spawnSync, kind=process.env.DMK_SYNTHETIC_PREFIX_OUTCOME;
cp.spawnSync=function(executable,args,options){
 if(Array.isArray(args)&&args.includes('--worker')) return {status:0,signal:null,stdout:'',stderr:'BENCH_RESULT '+JSON.stringify({count:Number(args.at(-1)),valid:true,mayApply:false,heapBefore:0,heapAfter:0})+'\n'};
 if(Array.isArray(args)&&args.includes('--prefix')) {
  const data={count:Number(args.at(-1)),encodedBytes:1,hashedBytes:1,encodedEntries:1,prefixMs:1,equivalenceMs:0};
  return {status:kind==='timeout'?null:kind==='exit'?1:0,signal:null,
   error:kind==='timeout'?Object.assign(new Error('SYNTHETIC_TIMEOUT'),{code:'ETIMEDOUT'}):undefined,
   stdout:kind==='success'?'PREFIX_RESULT '+JSON.stringify(data)+'\n':kind==='malformed'?'PREFIX_RESULT {broken\n':'',
   stderr:'SYNTHETIC_PREFIX_OUTCOME_'+kind};
 }
 return original.call(this,executable,args,options);
};
syncBuiltinESMExports();
`);
  const kinds=['exit','timeout','missing','malformed','success'];
  const failures=kinds.map(kind=>{
   const r=spawnSync(process.execPath,[...process.execArgv,'--import',pathToFileURL(preload).href,path.resolve('scripts/benchmarkWbsEvidenceContinuity.ts'),'--suite','SYNTHETIC-HARNESS-CONTROL'],
    {cwd:process.cwd(),env:{...process.env,GEMINI_API_KEY:'',DMK_SYNTHETIC_PREFIX_OUTCOME:kind},encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024});
   assert.equal(r.error,undefined);assert.match(r.stdout,new RegExp('SYNTHETIC_PREFIX_OUTCOME_'+kind),r.stderr);
   return r.status!==0;
  });
  assert.deepEqual(failures,[true,true,true,true,false],'CLI must propagate every invalid prefix outcome; valid control must exit zero');
 } finally {fs.unlinkSync(preload);fs.rmdirSync(temp);}
});
console.log('TOTAL: '+passes+'/'+passes+' checks passed');

