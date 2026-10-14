import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateWbsRegistration, registrationPayload, type RegistrationManifest, type RegistrationSignature } from './verifyWbsRegistration.ts';

const original = `version: "1.0"
project: "docmonstakrakin"
items:
  - id: "DMK-197"
    wbs_path: "13.06.11"
    status: "VERIFICATION_PENDING"
`;
const modified = original + `  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const addition = { id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' };
const manifest: RegistrationManifest = {
  schemaVersion:'1.0',projectId:'PRJ-DOCMONSTAKRAKIN',operation:'ADD_WBS_ITEMS',
  preWbsSha256:hash(original),postWbsSha256:hash(modified),
  approvedItems:[addition],policyId:'TEST-LOCAL-HUMAN-REVIEW',policyVersion:'1.0',
};
const sec = crypto.generateKeyPairSync('ed25519');
const arch = crypto.generateKeyPairSync('ed25519');
const policy = {
  policyId:'TEST-LOCAL-HUMAN-REVIEW',policyVersion:'1.0',
  requiredRoles:['Security Officer','Lead Architect'],
  humanKeys:[
    {identityId:'SEC-TEST',role:'Security Officer',kind:'HUMAN' as const,keyId:'K1',publicKeyPem:sec.publicKey.export({type:'spki',format:'pem'}).toString()},
    {identityId:'ARCH-TEST',role:'Lead Architect',kind:'HUMAN' as const,keyId:'K2',publicKeyPem:arch.publicKey.export({type:'spki',format:'pem'}).toString()}
  ]
};
const sign=(who:'SEC-TEST'|'ARCH-TEST'):RegistrationSignature=>{
  const isSec=who==='SEC-TEST';
  return {identityId:who,role:isSec?'Security Officer':'Lead Architect',keyId:isSec?'K1':'K2',kind:'HUMAN',
    signatureBase64:crypto.sign(null,registrationPayload(manifest),isSec?sec.privateKey:arch.privateKey).toString('base64')};
};
const data={beforeBytes:Buffer.from(original),afterBytes:Buffer.from(modified),manifest};
let passed=0;
const check=(name:string,run:()=>void)=>{run();passed++;console.log('PASS '+name);};
check('PREVIEW exact additive candidate passes without claiming human authorization',()=>{
  const result=validateWbsRegistration({...data,decision:'PREVIEW'});
  assert.equal(result.valid,true);assert.deepEqual(result.addedIds,['DMK-209']);
});
check('APPROVED without independently supplied human policy fails closed',()=>{
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED'}).valid,false);
});
check('APPROVED without signatures fails closed',()=>{
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED',trustedPolicy:policy}).valid,false);
});
check('APPROVED with valid independent signatures passes',()=>{
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED',trustedPolicy:policy,signatures:[sign('SEC-TEST'),sign('ARCH-TEST')]}).valid,true);
});
check('One human cannot sign both roles',()=>{
  const forged={...sign('ARCH-TEST'),identityId:'SEC-TEST'};
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED',trustedPolicy:policy,signatures:[sign('SEC-TEST'),forged]}).valid,false);
});
check('Altered signature or candidate fails closed',()=>{
  const tampered={...sign('SEC-TEST'),signatureBase64:Buffer.alloc(64).toString('base64')};
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED',trustedPolicy:policy,signatures:[tampered,sign('ARCH-TEST')]}).valid,false);
  assert.equal(validateWbsRegistration({...data,decision:'PREVIEW',afterBytes:Buffer.from(modified+'\n')}).valid,false);
});
check('Revoked authorized signer fails closed',()=>{
  const badPolicy={...policy,humanKeys:policy.humanKeys.map(k=>k.identityId==='SEC-TEST'?{...k,revoked:true}:k)};
  assert.equal(validateWbsRegistration({...data,decision:'APPROVED',trustedPolicy:badPolicy,signatures:[sign('SEC-TEST'),sign('ARCH-TEST')]}).valid,false);
});
check('Existing WBS modification fails closed',()=>{
  const bad=modified.replace('VERIFICATION_PENDING','VERIFIED');
  const attempt={...manifest,postWbsSha256:hash(bad)};
  assert.equal(validateWbsRegistration({...data,afterBytes:Buffer.from(bad),manifest:attempt,decision:'PREVIEW'}).valid,false);
});
check('Unexpected additional item fails closed',()=>{
  const bad=modified+`  - id: "DMK-210"
    wbs_path: "13.06.23"
    status: "PROPOSED"
`;
  assert.equal(validateWbsRegistration({...data,afterBytes:Buffer.from(bad),manifest:{...manifest,postWbsSha256:hash(bad)},decision:'PREVIEW'}).valid,false);
});
check('Existing item removal and duplicate WBS paths fail closed',()=>{
  const removed=original.replace(/  - id: "DMK-197"[\s\S]*/, '')+`items:
`;
  assert.equal(validateWbsRegistration({...data,afterBytes:Buffer.from(removed),manifest:{...manifest,postWbsSha256:hash(removed)},decision:'PREVIEW'}).valid,false);
  const dupe=modified.replace('13.06.22','13.06.11');
  assert.equal(validateWbsRegistration({...data,afterBytes:Buffer.from(dupe),manifest:{...manifest,postWbsSha256:hash(dupe)},decision:'PREVIEW'}).valid,false);
});
check('Modified registration authority policy version fails closed',()=>{
  assert.equal(validateWbsRegistration({...data,manifest:{...manifest,policyVersion:'2.0'},decision:'APPROVED',trustedPolicy:policy,signatures:[sign('SEC-TEST'),sign('ARCH-TEST')]}).valid,false);
});
console.log('TOTAL: '+passed+' / '+passed+' checks passed');
