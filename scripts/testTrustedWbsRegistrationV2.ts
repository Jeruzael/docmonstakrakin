import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  policyDigestV2, registrationSigningPayloadV2, verifyTrustedWbsRegistrationV2,
  type TrustedPolicyV2, type RegistrationIntentV2, type TrustedVerificationContextV2,
  type SignedReceiptV2,
} from './verifyTrustedWbsRegistrationV2.ts';

const before = Buffer.from('version: "1.0"\nproject: "docmonstakrakin"\nitems:\n  - id: "DMK-197"\n    wbs_path: "13.06.11"\n    status: "VERIFICATION_PENDING"\n');
const after = Buffer.concat([before, Buffer.from('  - id: "DMK-209"\n    wbs_path: "13.06.22"\n    status: "PROPOSED"\n')]);
const sha=(x:Buffer)=>crypto.createHash('sha256').update(x).digest('hex');
const a=crypto.generateKeyPairSync('ed25519'),b=crypto.generateKeyPairSync('ed25519');
const enrolled=(pair:typeof a,principalId:string,role:string,keyId:string)=>({
  principalId,role,keyId,kind:'HUMAN' as const,revoked:false,
  validNotBefore:'2026-01-01T00:00:00.000Z',validNotAfter:'2027-01-01T00:00:00.000Z',
  publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}).toString()
});
const policy:TrustedPolicyV2={
  schemaVersion:'2.0',policyId:'TEST-QUORUM',policyVersion:'2.0',
  requiredRoles:['Security Officer','Lead Architect'],
  humanKeys:[enrolled(a,'HUMAN-A','Security Officer','KEY-A'),enrolled(b,'HUMAN-B','Lead Architect','KEY-B')]
};
const git={
  repository:'Jeruzael/docmonstakrakin',pullRequestNumber:34,
  baseCommitSha:'a'.repeat(40),reviewedHeadCommitSha:'b'.repeat(40),
  reviewedHeadTreeSha:'c'.repeat(40)
};
const intent:RegistrationIntentV2={
  schemaVersion:'2.0',projectId:'PRJ-DOCMONSTAKRAKIN',operation:'ADD_WBS_ITEMS',
  receiptId:'WBS-TEST-209-214-0001',preWbsSha256:sha(before),postWbsSha256:sha(after),
  approvedItems:[{id:'DMK-209',wbs_path:'13.06.22',status:'PROPOSED'}],
  policyId:policy.policyId,policyVersion:policy.policyVersion,policySha256:policyDigestV2(policy),
  notBefore:'2026-10-01T00:00:00.000Z',notAfter:'2026-11-01T00:00:00.000Z',git
};
const sign=(p:typeof a,principalId:string,role:string,keyId:string)=>{
  return {principalId,role,keyId,kind:'HUMAN' as const,
    signatureBase64:crypto.sign(null,registrationSigningPayloadV2(intent),p.privateKey).toString('base64')};
};
const receipt:SignedReceiptV2={intent,signatures:[
  sign(a,'HUMAN-A','Security Officer','KEY-A'),sign(b,'HUMAN-B','Lead Architect','KEY-B')
]};
const context:TrustedVerificationContextV2={
  pinnedPolicySha256:policyDigestV2(policy),expectedGit:git,
  nowIso:'2026-10-16T00:00:00.000Z',consumedReceiptIds:[]
};
const verify=(overrides:Partial<Parameters<typeof verifyTrustedWbsRegistrationV2>[0]>={})=>
  verifyTrustedWbsRegistrationV2({beforeBytes:before,afterBytes:after,receipt,policy,context,...overrides});
let n=0;
const check=(name:string,fn:()=>void)=>{fn();n++;console.log('PASS '+name);};
check('A valid synthetic receipt verifies EVIDENCE only and never grants mutation',()=>{
  const result=verify();assert.equal(result.valid,true);assert.equal(result.mode,'EVIDENCE_VERIFIED');assert.equal(result.mayApply,false);
});
check('Omitted independent policy anchor fails closed',()=>{
  assert.equal(verify({context:{...context,pinnedPolicySha256:''}}).valid,false);
});
check('Attacker-substituted policy keys and signatures fail anchored policy digest',()=>{
  const rogue=crypto.generateKeyPairSync('ed25519');
  const fakePolicy:TrustedPolicyV2={...policy,humanKeys:[enrolled(rogue,'ROGUE','Security Officer','ROGUE-KEY'),policy.humanKeys[1]]};
  assert.equal(verify({policy:fakePolicy}).valid,false);
});
check('Weakened roles under unchanged policy name/version fail',()=>{
  const weak:TrustedPolicyV2={...policy,requiredRoles:['Security Officer'],humanKeys:[policy.humanKeys[0]]};
  assert.equal(verify({policy:weak}).valid,false);
});
check('Shared key in two enrollment identities fails even if policy is re-anchored',()=>{
  const shared:TrustedPolicyV2={...policy,humanKeys:[policy.humanKeys[0],enrolled(a,'HUMAN-B','Lead Architect','KEY-B')]};
  assert.equal(verify({policy:shared,context:{...context,pinnedPolicySha256:policyDigestV2(shared)}}).valid,false);
});
check('Duplicated principal across required roles fails',()=>{
  const shared:TrustedPolicyV2={...policy,humanKeys:[policy.humanKeys[0],enrolled(b,'HUMAN-A','Lead Architect','KEY-B')]};
  assert.equal(verify({policy:shared,context:{...context,pinnedPolicySha256:policyDigestV2(shared)}}).valid,false);
});
check('Signed Git tree/PR target differs from trusted Git context',()=>{
  assert.equal(verify({context:{...context,expectedGit:{...git,reviewedHeadTreeSha:'d'.repeat(40)}}}).valid,false);
});
check('Consumed receipt ID rejects reuse',()=>{
  assert.equal(verify({context:{...context,consumedReceiptIds:[intent.receiptId]}}).valid,false);
});
check('Expired or future-dated approvals rejected',()=>{
  assert.equal(verify({context:{...context,nowIso:'2027-02-01T00:00:00.000Z'}}).valid,false);
  assert.equal(verify({context:{...context,nowIso:'2026-09-01T00:00:00.000Z'}}).valid,false);
});
check('Revoked signer rejects signed approval',()=>{
  const revoked:TrustedPolicyV2={...policy,humanKeys:[{...policy.humanKeys[0],revoked:true},policy.humanKeys[1]]};
  assert.equal(verify({policy:revoked,context:{...context,pinnedPolicySha256:policyDigestV2(revoked)}}).valid,false);
});
check('Invalid or missing signature rejects',()=>{
  assert.equal(verify({receipt:{...receipt,signatures:[]}}).valid,false);
  assert.equal(verify({receipt:{...receipt,signatures:[{...receipt.signatures[0],signatureBase64:Buffer.alloc(64).toString('base64')},receipt.signatures[1]]}}).valid,false);
});
check('WBS extra unreviewed bytes rejected',()=>{
  assert.equal(verify({afterBytes:Buffer.concat([after,Buffer.from('# unapproved\n')])}).valid,false);
});
check('An attacker cannot supply an updated policy digest by changing only the signed intent',()=>{
  const modified={...intent,policySha256:'f'.repeat(64)};
  assert.equal(verify({receipt:{...receipt,intent:modified}}).valid,false);
});
check('Identical changed policy content under same id/version rejected',()=>{
  const changed={...policy,humanKeys:[{...policy.humanKeys[0],keyId:'DIFFERENT'},policy.humanKeys[1]]};
  assert.equal(verify({policy:changed}).valid,false);
});
check('Invalid policy key validity rejected',()=>{
  const invalid={...policy,humanKeys:[{...policy.humanKeys[0],validNotAfter:'bad'},policy.humanKeys[1]]};
  assert.equal(verify({policy:invalid,context:{...context,pinnedPolicySha256:policyDigestV2(invalid)}}).valid,false);
});
check('Null record in human-keys roster rejected without exception',()=>{
  const nullRoster: TrustedPolicyV2 = { ...policy, humanKeys: [null as any] };
  const res = verify({ policy: nullRoster, context: { ...context, pinnedPolicySha256: policyDigestV2(nullRoster) } });
  assert.equal(res.valid, false);
  assert.equal(res.mode, 'REJECTED');
  assert.ok(res.errors.includes('Invalid human signer enrollment record'));
});
check('Malformed non-object record type in human-keys roster rejected',()=>{
  const malformedRoster: TrustedPolicyV2 = { ...policy, humanKeys: ['malformed-record' as any] };
  const res = verify({ policy: malformedRoster, context: { ...context, pinnedPolicySha256: policyDigestV2(malformedRoster) } });
  assert.equal(res.valid, false);
  assert.equal(res.mode, 'REJECTED');
  assert.ok(res.errors.includes('Invalid human signer enrollment record'));
});
check('Incomplete object record type in human-keys roster rejected',()=>{
  const malformedObj: TrustedPolicyV2 = { ...policy, humanKeys: [{ principalId: 'HUMAN-A' } as any] };
  const res = verify({ policy: malformedObj, context: { ...context, pinnedPolicySha256: policyDigestV2(malformedObj) } });
  assert.equal(res.valid, false);
  assert.equal(res.mode, 'REJECTED');
  assert.ok(res.errors.includes('Invalid human signer enrollment record'));
});
check('Mixed valid and invalid roster rejects even if required signatures match valid keys',()=>{
  const mixedRoster: TrustedPolicyV2 = {
    ...policy,
    humanKeys: [null as any, policy.humanKeys[0], policy.humanKeys[1]]
  };
  const res = verify({ policy: mixedRoster, context: { ...context, pinnedPolicySha256: policyDigestV2(mixedRoster) } });
  assert.equal(res.valid, false);
  assert.equal(res.mode, 'REJECTED');
  assert.ok(res.errors.includes('Invalid human signer enrollment record'));
});
check('Mixed valid and malformed object roster rejects',()=>{
  const mixedRoster: TrustedPolicyV2 = {
    ...policy,
    humanKeys: [{ invalid: true } as any, policy.humanKeys[0], policy.humanKeys[1]]
  };
  const res = verify({ policy: mixedRoster, context: { ...context, pinnedPolicySha256: policyDigestV2(mixedRoster) } });
  assert.equal(res.valid, false);
  assert.equal(res.mode, 'REJECTED');
  assert.ok(res.errors.includes('Invalid human signer enrollment record'));
});
check('Malformed signature claims with null entry rejected',()=>{
  const badSignatures = verify({ receipt: { ...receipt, signatures: [null as any, receipt.signatures[1]] } });
  assert.equal(badSignatures.valid, false);
  assert.equal(badSignatures.mode, 'REJECTED');
  assert.ok(badSignatures.errors.includes('Invalid human signature claim'));
});
check('Malformed intent with empty approvedItems rejected',()=>{
  const emptyItems = verify({ receipt: { ...receipt, intent: { ...intent, approvedItems: [] } } });
  assert.equal(emptyItems.valid, false);
  assert.equal(emptyItems.mode, 'REJECTED');
  assert.ok(emptyItems.errors.includes('Invalid v2 registration intent'));
});
console.log('TOTAL: '+n+'/'+n+' checks passed');
