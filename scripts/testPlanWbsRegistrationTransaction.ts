import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  makeHistoricalWbsReceiptLedger, previewWbsRegistrationTransaction,
  serializeWbsReceiptLedger, type WbsRegistrationPreflightInput,
} from './planWbsRegistrationTransaction.ts';
import { HISTORICAL_WBS_SHA256 } from './verifyForwardWbsEvidence.ts';
import { policyDigestV2, registrationSigningPayloadV2, type TrustedPolicyV2, type RegistrationIntentV2 } from './verifyTrustedWbsRegistrationV2.ts';
import fs from 'node:fs';

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
console.log('TOTAL: '+passes+'/'+passes+' checks passed');
