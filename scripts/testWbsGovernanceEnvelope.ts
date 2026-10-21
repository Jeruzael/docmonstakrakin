import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { policyDigestV2, registrationSigningPayloadV2, type TrustedPolicyV2 } from './verifyTrustedWbsRegistrationV2.ts';

// All keys and person claims in this file are ephemeral SYNTHETIC fixtures.
const api = await import(new URL('./verifyWbsGovernanceEnvelope.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + String(e)); }
}
if (!api) check('E01 offline envelope verifier API exists', () => assert.fail('Authorized offline verifier is not implemented'));
else {
  const sha = (x: Buffer | string) => crypto.createHash('sha256').update(x).digest('hex');
  const roles = ['Security Officer', 'Lead Architect', 'Independent Human Approver'];
  const pairs = Array.from({ length: 8 }, () => crypto.generateKeyPairSync('ed25519'));
  const pem = (i: number) => pairs[i].publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const sig = (i: number, bytes: Buffer) => crypto.sign(null, bytes, pairs[i].privateKey).toString('base64');
  const now = '2026-10-21T12:00:00.000Z';
  const from = '2026-10-01T00:00:00.000Z', to = '2026-11-01T00:00:00.000Z';
  function fixture(profileId = 'ORDINARY'): any {
    const requiredRoles = roles.slice(0, profileId === 'ORDINARY' ? 2 : 3);
    const policy: TrustedPolicyV2 = { schemaVersion: '2.0', policyId: 'SYNTHETIC-POLICY', policyVersion: 'epoch-1', requiredRoles,
      humanKeys: requiredRoles.map((role, i) => ({ principalId: 'person-' + i, role, keyId: 'registration-' + i,
        kind: 'HUMAN', publicKeyPem: pem(i + 3), revoked: false, validNotBefore: from, validNotAfter: to })) };
    const expected = { repository: 'Jeruzael/docmonstakrakin', repositoryId: '1001', ownerId: '2001',
      projectId: 'PRJ-DOCMONSTAKRAKIN', operation: 'ADD_WBS_ITEMS', profileId,
      classificationRulesSha256: '1'.repeat(64), personRegistrySha256: '2'.repeat(64),
      policyId: policy.policyId, policyVersion: policy.policyVersion, policySha256: policyDigestV2(policy),
      revocationStateSha256: '3'.repeat(64), verifierCommitSha: '4'.repeat(40), workflowCommitSha: '5'.repeat(40),
      ratificationEvidenceSha256: '6'.repeat(64) };
    const payload = { schemaVersion: '1.0', ...expected, rootId: 'SYNTHETIC-ROOT', rootVersion: 1,
      envelopeId: 'SYNTHETIC-ENVELOPE-0001', authorityEpoch: 1, previousEnvelopeSha256: '0'.repeat(64),
      effectiveNotBefore: from, effectiveNotAfter: to, requiredRoles, revocationSequence: 1 };
    const context = { kind: 'SYNTHETIC_OFFLINE', expected, root: { rootId: payload.rootId, rootVersion: 1,
      keys: roles.map((role, i) => ({ principalId: 'governance-' + i, personId: 'person-' + i, role,
        keyId: 'governance-key-' + i, publicKeyPem: pem(i), revoked: false, eligible: true,
        conflicted: false, custodySeparated: true, validNotBefore: from, validNotAfter: to })) },
      registrationPeople: requiredRoles.map((_, i) => ({ principalId: 'person-' + i, personId: 'person-' + i,
        eligible: true, conflicted: false, custodySeparated: true })),
      witness: { keyId: 'witness-1', personId: 'independent-witness', publicKeyPem: pem(6) },
      clock: { keyId: 'clock-1', publicKeyPem: pem(7) }, fixedNowIso: now, sessionNonce: 'a'.repeat(64),
      minimumAuthorityEpoch: 1, minimumRevocationSequence: 1, minimumCheckpointSequence: 1, minimumClockSequence: 1,
      consumedEnvelopeIds: [], consumedNonces: [], previous: null, checkpoint: null, clockObservation: null };
    return bind({ policy, document: { payload, signatures: [] }, context });
  }
  function bind(f: any, resign = true): any {
    if (resign) f.document.signatures = roles.map((role, i) => ({ principalId: f.context.root.keys[i].principalId,
      role, keyId: f.context.root.keys[i].keyId, signatureBase64: sig(i, api.governanceEnvelopeSigningBytes(f.document.payload)) }));
    f.bytes = api.governanceEnvelopeBytes(f.document);
    const inputsSha256 = api.offlineGovernanceInputDigest(f.bytes, f.policy, f.context);
    const clock = { schemaVersion: '1.0', sessionNonce: f.context.sessionNonce, inputsSha256,
      nowIso: '2026-10-21T11:59:59.000Z', validUntilIso: '2026-10-21T12:00:30.000Z', uncertaintyMs: 100, sequence: 1 };
    const checkpoint = { schemaVersion: '1.0', sessionNonce: f.context.sessionNonce, inputsSha256,
      envelopeSha256: sha(f.bytes), authorityEpoch: f.document.payload.authorityEpoch,
      revocationSequence: f.document.payload.revocationSequence, sequence: 1,
      observedAt: '2026-10-21T11:59:58.000Z', validUntilIso: '2026-10-21T12:01:00.000Z' };
    f.context.clockObservation = { payload: clock, signatureBase64: sig(7, api.clockObservationSigningBytes(clock)) };
    f.context.checkpoint = { payload: checkpoint, signatureBase64: sig(6, api.checkpointSigningBytes(checkpoint)) };
    return f;
  }
  const verify = (f: any) => api.verifyOfflineWbsGovernanceEnvelope(f.bytes, f.policy, f.context);
  function reject(f: any, message?: RegExp) {
    const r = verify(f); assert.equal(r.valid, false); assert.equal(r.mayApply, false);
    assert.equal(r.operationalAuthority, false); assert.equal(r.mode, 'REJECTED');
    assert.ok(r.errors.length); if (message) assert.match(r.errors.join('; '), message);
  }
  function changed(name: string, mutate: (f: any) => void, message?: RegExp, resign = true) {
    check(name, () => { const f = fixture(); mutate(f); bind(f, resign); reject(f, message); });
  }
  check('E01 ordinary synthetic envelope verifies without authority', () => {
    const r = verify(fixture()); assert.equal(r.valid, true, r.errors.join('; '));
    assert.equal(r.mode, 'OFFLINE_CONTRACT_VERIFIED'); assert.equal(r.mayApply, false); assert.equal(r.operationalAuthority, false);
  });
  check('E01 elevated synthetic envelope preserves all three registration roles', () => {
    const f = fixture('ELEVATED'); assert.equal(verify(f).valid, true); assert.equal(f.policy.requiredRoles.length, 3);
  });
  check('canonical independent sorted-key and Unicode vector', () => {
    const value = { z: '\ud800', a: ['é', '\n', { b: 2, a: true }] };
    assert.equal(api.canonicalGovernanceJson(value), '{"a":["é","\\n",{"a":true,"b":2}],"z":"\\ud800"}');
    assert.deepEqual(api.governanceEnvelopeSigningBytes(value), Buffer.from('DOCMONSTAKRAKIN/WBS_GOVERNANCE_ENVELOPE/1.0\n' + api.canonicalGovernanceJson(value)));
  });
  check('existing v2 signing format and policy digest stay byte-identical', () => {
    const f = fixture(); const independent = (v: any): string => Array.isArray(v) ? '[' + v.map(independent).join(',') + ']' :
      v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + independent(v[k])).join(',') + '}' : JSON.stringify(v);
    assert.equal(policyDigestV2(f.policy), sha(independent(f.policy)));
    assert.deepEqual(registrationSigningPayloadV2({ a: 1 } as any), Buffer.from('DOCMONSTAKRAKIN/WBS_REGISTRATION/2.0\n{"a":1}'));
  });
  check('E02 missing authority rejects without fallback', () => {
    const f = fixture(); const r = api.verifyOfflineWbsGovernanceEnvelope(f.bytes, f.policy, undefined);
    assert.equal(r.valid, false); assert.equal(r.mayApply, false);
  });
  changed('E02 self-selected pin extra payload key rejects', f => { f.document.payload.pinnedRoot = f.context.root; }, /key|schema/i);
  changed('E02 wrong externally supplied root rejects', f => { f.context.root.rootId = 'ROGUE-ROOT'; }, /root/i);
  check('E03 duplicate raw JSON keys reject before signature validation', () => {
    const f = fixture(); f.bytes = Buffer.from(f.bytes.toString().replace('"schemaVersion":"1.0"', '"schemaVersion":"1.0","schemaVersion":"1.0"'));
    reject(f, /duplicate/i);
  });
  for (const [name, raw] of [['BOM', Buffer.from('\ufeff{}')], ['invalid UTF8', Buffer.from([0xff])],
    ['trailing data', Buffer.from('{}{}')], ['malformed framing', Buffer.from('{]')], ['unterminated string', Buffer.from('{"a":"x}')],
    ['invalid primitive', Buffer.from('{"a":undefined}')], ['invalid escape', Buffer.from('{"\\q":1}')]])
    check('E03 ' + name + ' rejects', () => { const f = fixture(); f.bytes = raw; reject(f); });
  check('E03 noncanonical whitespace and ordering reject', () => {
    const f = fixture(); f.bytes = Buffer.from(JSON.stringify(f.document, null, 2)); reject(f, /canonical/i);
  });
  for (const [field, value] of [['schemaVersion', '2.0'], ['extra', true], ['rootVersion', 0], ['authorityEpoch', 1.5],
    ['envelopeId', '../escape'], ['policySha256', 'not-a-digest'], ['verifierCommitSha', 'short'], ['effectiveNotAfter', 'bad-time']])
    changed('E03 malformed payload ' + field, f => { f.document.payload[field as string] = value; });
  check('E03 exact raw byte admission boundary is inclusive', () => {
    const f = fixture(); for (const n of [2 * 1024 * 1024 - 1, 2 * 1024 * 1024, 2 * 1024 * 1024 + 1]) {
      f.bytes = Buffer.alloc(n, 32); const r = verify(f); assert.equal(r.valid, false);
      assert.equal(r.errors.join('; ').includes('Raw envelope exceeds'), n > 2 * 1024 * 1024);
    }
  });
  check('E03 depth 63 and 64 admit; 65 rejects', () => {
    for (const depth of [63, 64, 65]) { const f = fixture(); f.bytes = Buffer.from('['.repeat(depth) + '0' + ']'.repeat(depth));
      const r = verify(f); assert.equal(r.valid, false); assert.equal(r.errors.join('; ').includes('JSON depth exceeds'), depth > 64); }
  });
  changed('E04 missing governance signature rejects', f => { f.document.signatures.pop(); }, /signature|quorum/i, false);
  changed('E04 duplicated governance signature rejects', f => { f.document.signatures[1] = f.document.signatures[0]; }, /signature|role|principal/i, false);
  changed('E04 altered signature rejects', f => { f.document.signatures[0].signatureBase64 = Buffer.alloc(64).toString('base64'); }, /signature/i, false);
  changed('E04 noncanonical Base64 rejects', f => { f.document.signatures[0].signatureBase64 += '\n'; }, /signature|Base64/i, false);
  changed('E04 one person using two governance principals rejects', f => { f.context.root.keys[1].personId = 'person-0'; }, /person|independ/i);
  changed('E04 one person using two registration principals rejects', f => { f.context.registrationPeople[1].personId = 'person-0'; }, /person|independ/i);
  changed('E04 duplicate policy principal cannot use an unused second-person mapping', f => {
    f.policy.humanKeys[1].principalId = f.policy.humanKeys[0].principalId;
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy);
  }, /principal|person/i);
  changed('E04 shared governance key rejects', f => { f.context.root.keys[1].publicKeyPem = pem(0); }, /key|fingerprint/i);
  check('E03 public-only anchor fields reject private PEM material', () => {
    const f = fixture(); f.context.root.keys[0].publicKeyPem = pairs[0].privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    bind(f); reject(f, /public|PEM/i);
  });
  changed('E04 registration/governance key purpose reuse rejects', f => { f.policy.humanKeys[0].publicKeyPem = pem(0);
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy); }, /purpose|key/i);
  changed('E04 governance signer authorship conflict rejects', f => { f.context.root.keys[0].conflicted = true; }, /eligib|conflict/i);
  changed('E04 registration beneficiary conflict rejects', f => { f.context.registrationPeople[0].conflicted = true; }, /eligib|conflict/i);
  changed('E04 shared custody rejects', f => { f.context.root.keys[0].custodySeparated = false; }, /custody|eligib/i);
  changed('E04 Project Lead cannot replace Lead Architect', f => { f.policy.requiredRoles[1] = 'Project Lead';
    f.policy.humanKeys[1].role = 'Project Lead'; f.document.payload.requiredRoles = f.policy.requiredRoles;
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy); }, /role|profile/i);
  changed('E04 unauthorized ordinary/elevated substitution rejects', f => { f.document.payload.profileId = 'ELEVATED'; }, /profile|binding/i);
  check('E04 elevated third human cannot be omitted', () => { const f = fixture('ELEVATED'); f.policy.requiredRoles.pop();
    f.policy.humanKeys.pop(); f.context.registrationPeople.pop(); f.document.payload.requiredRoles = f.policy.requiredRoles;
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy); bind(f); reject(f, /role|profile/i); });
  changed('E05 authority epoch below floor rejects', f => { f.context.minimumAuthorityEpoch = 2; }, /epoch/i);
  changed('E05 revocation sequence below floor rejects', f => { f.context.minimumRevocationSequence = 2; }, /revocation/i);
  changed('E05 checkpoint sequence rollback rejects', f => { f.context.minimumCheckpointSequence = 2; }, /checkpoint/i);
  changed('E05 missing witness rejects', f => { f.context.witness = null; }, /witness|object/i);
  changed('E05 root administrator cannot be its own independent witness', f => { f.context.witness.personId = 'person-0'; }, /witness|independ/i);
  check('E05 witness key reused for clock rejects', () => {
    const f = fixture(); f.context.clock.publicKeyPem = pem(6); bind(f);
    f.context.clockObservation.signatureBase64 = sig(6, api.clockObservationSigningBytes(f.context.clockObservation.payload));
    reject(f, /purpose|key/i);
  });
  check('E05 valid signatures under rogue witness key reject', () => { const f = fixture(); f.context.checkpoint.signatureBase64 = sig(0, api.checkpointSigningBytes(f.context.checkpoint.payload)); reject(f, /witness|signature/i); });
  function successor(): any {
    const f = fixture(); f.context.previous = { envelopeSha256: 'b'.repeat(64), authorityEpoch: 1,
      policySha256: f.document.payload.policySha256, policyVersion: 'epoch-1', revocationSequence: 1,
      rootId: f.document.payload.rootId, rootVersion: 1 };
    f.document.payload.authorityEpoch = 2; f.document.payload.previousEnvelopeSha256 = 'b'.repeat(64);
    f.policy.policyVersion = f.context.expected.policyVersion = f.document.payload.policyVersion = 'epoch-2';
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy);
    return bind(f);
  }
  check('E06 next epoch binds a new immutable v2 policy version/digest', () => assert.equal(verify(successor()).valid, true));
  check('E06 predecessor policy digest array coercion cannot bypass reuse denial', () => {
    const f = successor(); f.context.previous.policySha256 = [f.document.payload.policySha256]; bind(f); reject(f, /predecessor|digest/i);
  });
  for (const [name, mutate] of [
    ['reused policy/version', (f: any) => { f.context.previous.policySha256 = f.document.payload.policySha256; f.context.previous.policyVersion = f.policy.policyVersion; }],
    ['skipped epoch', (f: any) => { f.document.payload.authorityEpoch = 3; }],
    ['wrong predecessor', (f: any) => { f.document.payload.previousEnvelopeSha256 = 'c'.repeat(64); }],
    ['new-root-only rotation', (f: any) => { f.context.root.rootVersion = f.document.payload.rootVersion = 2; }],
    ['revocation rollback', (f: any) => { f.context.previous.revocationSequence = 2; }]
  ] as const) check('E05/E06 ' + name + ' rejects', () => { const f = successor(); mutate(f); bind(f); reject(f); });
  changed('E06 policy content differs from independently expected digest', f => { f.policy.policyVersion = 'hidden-change'; }, /policy/i);
  for (const field of ['repository', 'repositoryId', 'ownerId', 'projectId', 'operation', 'classificationRulesSha256', 'personRegistrySha256', 'verifierCommitSha', 'workflowCommitSha', 'ratificationEvidenceSha256'])
    changed('E07 bound ' + field + ' substitution rejects', f => { f.document.payload[field] = field.endsWith('Sha256') ? 'f'.repeat(64) : field.endsWith('Sha') ? 'f'.repeat(40) : 'SUBSTITUTED'; });
  check('E08 unsigned clock observation change rejects', () => { const f = fixture(); f.context.clockObservation.payload.nowIso = now; reject(f, /clock|signature/i); });
  changed('E08 fixed clock is outside signed observation', f => { f.context.fixedNowIso = '2026-10-21T12:02:00.000Z'; }, /clock|time/i);
  changed('E08 clock sequence rollback rejects', f => { f.context.minimumClockSequence = 2; }, /clock/i);
  changed('E08 uncertainty crossing envelope start rejects', f => { f.document.payload.effectiveNotBefore = now; }, /time|valid|uncertainty/i);
  check('E08 oversized signed uncertainty rejects', () => { const f = fixture(); f.context.clockObservation.payload.uncertaintyMs = 2001;
    f.context.clockObservation.signatureBase64 = sig(7, api.clockObservationSigningBytes(f.context.clockObservation.payload)); reject(f, /uncertainty/i); });
  check('E08 stale or mismatched checkpoint/clock binding rejects', () => { const f = fixture(); f.context.checkpoint.payload.inputsSha256 = '0'.repeat(64);
    f.context.checkpoint.signatureBase64 = sig(6, api.checkpointSigningBytes(f.context.checkpoint.payload)); reject(f, /binding/i); });
  changed('E09 revoked governance authority rejects', f => { f.context.root.keys[0].revoked = true; }, /revok|eligib/i);
  changed('E09 revoked registration key rejects', f => { f.policy.humanKeys[0].revoked = true;
    f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy); }, /revok|eligib/i);
  changed('E09 expired governance key rejects', f => { f.context.root.keys[0].validNotAfter = from; }, /valid|time/i);
  changed('E09 missing person eligibility rejects', f => { f.context.registrationPeople[0].eligible = false; }, /eligib/i);
  check('E10 digest-only signature cannot replace exact message signature', () => { const f = fixture();
    f.document.signatures[0].signatureBase64 = sig(0, Buffer.from(sha(api.governanceEnvelopeSigningBytes(f.document.payload)), 'hex'));
    bind(f, false); reject(f, /signature/i); });
  check('E10 registration-domain signature cannot replace governance signature', () => { const f = fixture();
    f.document.signatures[0].signatureBase64 = sig(0, registrationSigningPayloadV2(f.document.payload)); bind(f, false); reject(f, /signature/i); });
  changed('E11 envelope replay in supplied consumed IDs rejects', f => { f.context.consumedEnvelopeIds = [f.document.payload.envelopeId]; }, /replay|consum/i);
  changed('E11 session nonce replay rejects', f => { f.context.consumedNonces = [f.context.sessionNonce]; }, /replay|consum/i);
  check('E11 verifier does not consume or mutate any input', () => { const f = fixture(); const before = JSON.stringify(f); verify(f); verify(f);
    assert.equal(JSON.stringify(f), before); assert.equal(verify(f).valid, true); });
  check('E11 cyclic context rejects without invoking serialization', () => { const f = fixture(); f.context.extra = f.context; reject(f, /cyc|key|JSON/i); });
  check('E11 context accessor rejects without invocation', () => { const f = fixture(); let calls = 0;
    Object.defineProperty(f.context, 'trap', { enumerable: true, get() { calls++; throw Error('executed'); } }); reject(f, /accessor|inert|property/i); assert.equal(calls, 0); });
  check('E11 oversized context rejects with bounded diagnostics', () => { const f = fixture(); f.context.extra = 'x'.repeat(2 * 1024 * 1024 + 1); reject(f, /size|budget|exceed/i); });
  changed('E12 production context label does not enable a mode', f => { f.context.kind = 'PRODUCTION'; }, /offline|synthetic/i);
  changed('E12 witness/recovery label grants no registration role', f => { f.policy.requiredRoles[1] = 'Recovery Custodian';
    f.document.payload.requiredRoles = f.policy.requiredRoles; f.context.expected.policySha256 = f.document.payload.policySha256 = policyDigestV2(f.policy); }, /role|profile/i);
  check('E12 all results are explicitly non-authorizing, including malformed inputs', () => {
    for (const [raw, policy, ctx] of [[null, null, null], [Buffer.alloc(0), {}, {}], [Buffer.from('{}'), {}, {}]]) {
      const r = api.verifyOfflineWbsGovernanceEnvelope(raw, policy, ctx); assert.equal(r.valid, false);
      assert.equal(r.mayApply, false); assert.equal(r.operationalAuthority, false); assert.equal(r.mode, 'REJECTED');
    }
  });
}
console.log(`Offline envelope checks: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
