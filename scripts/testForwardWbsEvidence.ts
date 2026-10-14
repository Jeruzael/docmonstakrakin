import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { verifyForwardWbsEvidence, HISTORICAL_WBS_SHA256 } from './verifyForwardWbsEvidence.ts';
import { registrationPayload, type RegistrationManifest, type RegistrationSignature } from './verifyWbsRegistration.ts';

const root=process.cwd();
const historic=fs.readFileSync(path.join(root,'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'));
const current=fs.readFileSync(path.join(root,'docs/00_control/MASTER_WBS.yaml'));
const sha=(v:Buffer)=>crypto.createHash('sha256').update(v).digest('hex');
let passed=0;
function test(name:string, action:()=>void){action();passed++;console.log('PASS '+name);}
test('Historical snapshot retains expected raw SHA256',()=>assert.equal(sha(historic),HISTORICAL_WBS_SHA256));
test('Current unchanged historical WBS is accepted',()=>{
 const r=verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:current});
 assert.equal(r.valid,true);assert.equal(r.mode,'HISTORICAL');
});
test('Tampered historical snapshot cannot establish a trust anchor',()=>{
 const fake=Buffer.concat([historic,Buffer.from(' ')]);
 assert.equal(verifyForwardWbsEvidence({historicalBytes:fake,currentBytes:current}).valid,false);
});
const added=Buffer.from(current.toString('utf8')+
  '\n  - id: "DMK-209"\n    wbs_path: "13.06.22"\n    status: "PROPOSED"\n');
const newItem={id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED'};
const manifest:RegistrationManifest={
 schemaVersion:'1.0',projectId:'PRJ-DOCMONSTAKRAKIN',operation:'ADD_WBS_ITEMS',
 preWbsSha256:sha(historic),postWbsSha256:sha(added),approvedItems:[newItem],
 policyId:'TEST-POLICY',policyVersion:'1.0'
};
test('Unapproved changed WBS fails closed',()=>{
 const r=verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:added,manifest});
 assert.equal(r.valid,false);assert.equal(r.mode,'REJECTED');
});
test('PREVIEW-like manifest alone cannot authorize a WBS registration',()=>{
 const r=verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:added,manifest,signatures:[]});
 assert.equal(r.valid,false);
});
const sec=crypto.generateKeyPairSync('ed25519'),arch=crypto.generateKeyPairSync('ed25519');
const key=(who:'SEC'|'ARCH')=>({
 identityId:who,role:who==='SEC'?'Security Officer':'Lead Architect',keyId:who+'-KEY',
 kind:'HUMAN' as const,publicKeyPem:(who==='SEC'?sec:arch).publicKey.export({type:'spki',format:'pem'}).toString()
});
const policy={
 policyId:'TEST-POLICY',policyVersion:'1.0',
 requiredRoles:['Security Officer','Lead Architect'],humanKeys:[key('SEC'),key('ARCH')]
};
const signature=(who:'SEC'|'ARCH'):RegistrationSignature=>{
 const v=key(who);return {identityId:v.identityId,role:v.role,keyId:v.keyId,kind:'HUMAN',
 signatureBase64:crypto.sign(null,registrationPayload(manifest),(who==='SEC'?sec:arch).privateKey).toString('base64')};
};
test('Independently trusted and signed additive change verifies',()=>{
 const result=verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:added,manifest,trustedPolicy:policy,signatures:[signature('SEC'),signature('ARCH')]});
 assert.equal(result.valid,true);assert.equal(result.mode,'FORWARD_APPROVED');
});
test('Revoked human signer cannot approve',()=>{
 const bad={...policy,humanKeys:[{...key('SEC'),revoked:true},key('ARCH')]};
 assert.equal(verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:added,manifest,trustedPolicy:bad,signatures:[signature('SEC'),signature('ARCH')]}).valid,false);
});
test('Exact candidate digest mismatch cannot be approved',()=>{
 const tampered=Buffer.concat([added,Buffer.from('\n')]);
 assert.equal(verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:tampered,manifest,trustedPolicy:policy,signatures:[signature('SEC'),signature('ARCH')]}).valid,false);
});
test('Wrong sign-off payload rejected',()=>{
 const bad={...signature('SEC'),signatureBase64:Buffer.alloc(64).toString('base64')};
 assert.equal(verifyForwardWbsEvidence({historicalBytes:historic,currentBytes:added,manifest,trustedPolicy:policy,signatures:[bad,signature('ARCH')]}).valid,false);
});
console.log('TOTAL: '+passed+'/'+passed+' checks passed');
