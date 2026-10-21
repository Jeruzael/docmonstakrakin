/** Ephemeral TESTONLY people/keys. Never write private key material or appointments. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalGovernanceJson, governanceEnvelopeBytes, governanceEnvelopeSigningBytes,
  clockObservationSigningBytes, checkpointSigningBytes, offlineGovernanceInputDigest } from '../verifyWbsGovernanceEnvelope.ts';
import { policyDigestV2, registrationSigningPayloadV2 } from '../verifyTrustedWbsRegistrationV2.ts';
import { makeHistoricalWbsReceiptLedger, parseWbsReceiptLedgerV1, serializeWbsReceiptLedger, signedReceiptDigestV2 } from '../planWbsRegistrationTransaction.ts';

export const hash = (raw: Buffer | string) => crypto.createHash('sha256').update(raw).digest('hex');
const roles = ['Security Officer', 'Lead Architect', 'Independent Human Approver'];
const from = '2026-10-01T00:00:00.000Z', to = '2026-11-01T00:00:00.000Z';
export const fixtureNow = '2026-10-21T12:00:00.000Z';
export function syntheticCeremony(profile = 'ORDINARY'): any {
  const pairs = Array.from({ length: 8 }, () => crypto.generateKeyPairSync('ed25519'));
  const pem = (i: number) => pairs[i].publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const sign = (i: number, bytes: Buffer) => crypto.sign(null, bytes, pairs[i].privateKey).toString('base64');
  const requiredRoles = roles.slice(0, profile === 'ORDINARY' ? 2 : 3);
  let beforeBytes = fs.readFileSync(fileURLToPath(new URL('../../docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml', import.meta.url)));
  let item = { id: 'DMK-9999', wbs_path: '99.99.99', status: 'PROPOSED' };
  let afterBytes = Buffer.concat([beforeBytes, Buffer.from('\n  - id: DMK-9999\n    wbs_path: 99.99.99\n    status: PROPOSED\n')]);
  let ledgerBytes = serializeWbsReceiptLedger(makeHistoricalWbsReceiptLedger());
  let state: any = { revision: 0, wbsBytes: beforeBytes, ledgerBytes, commitSha: 'a'.repeat(40), treeSha: 'b'.repeat(40),
    authorityEpoch: 0, revocationSequence: 0, checkpointSequence: 0, clockSequence: 0, consumedEnvelopeIds: [], consumedNonces: [] };
  const policy = { schemaVersion: '2.0', policyId: 'TESTONLY-POLICY', policyVersion: 'epoch-1', requiredRoles,
    humanKeys: requiredRoles.map((role, i) => ({ principalId: 'test-person-' + i, role, keyId: 'registration-' + i,
      kind: 'HUMAN', publicKeyPem: pem(i + 3), revoked: false, validNotBefore: from, validNotAfter: to })) };
  const expected = { repository: 'Jeruzael/docmonstakrakin', repositoryId: '1001', ownerId: '2001', projectId: 'PRJ-DOCMONSTAKRAKIN',
    operation: 'ADD_WBS_ITEMS', profileId: profile, classificationRulesSha256: '1'.repeat(64), personRegistrySha256: '2'.repeat(64),
    policyId: policy.policyId, policyVersion: policy.policyVersion, policySha256: policyDigestV2(policy as any), revocationStateSha256: '3'.repeat(64),
    verifierCommitSha: '4'.repeat(40), workflowCommitSha: '5'.repeat(40), ratificationEvidenceSha256: '6'.repeat(64) };
  const payload = { schemaVersion: '1.0', ...expected, rootId: 'TESTONLY-ROOT', rootVersion: 1, envelopeId: 'TESTONLY-ENVELOPE-0001',
    authorityEpoch: 1, previousEnvelopeSha256: '0'.repeat(64), effectiveNotBefore: from, effectiveNotAfter: to, requiredRoles, revocationSequence: 1 };
  const context: any = { kind: 'SYNTHETIC_OFFLINE', expected, root: { rootId: payload.rootId, rootVersion: 1,
    keys: roles.map((role, i) => ({ principalId: 'governance-' + i, personId: 'test-person-' + i, role, keyId: 'governance-' + i,
      publicKeyPem: pem(i), revoked: false, eligible: true, conflicted: false, custodySeparated: true, validNotBefore: from, validNotAfter: to })) },
    registrationPeople: requiredRoles.map((_, i) => ({ principalId: 'test-person-' + i, personId: 'test-person-' + i,
      eligible: true, conflicted: false, custodySeparated: true })), witness: { keyId: 'witness-1', personId: 'independent-witness', publicKeyPem: pem(6) },
    clock: { keyId: 'clock-1', publicKeyPem: pem(7) }, fixedNowIso: fixtureNow, sessionNonce: 'e'.repeat(64), minimumAuthorityEpoch: 1,
    minimumRevocationSequence: 1, minimumCheckpointSequence: 1, minimumClockSequence: 1, consumedEnvelopeIds: [], consumedNonces: [], previous: null,
    checkpoint: null, clockObservation: null };
  const document: any = { payload, signatures: [] };
  const git = { repository: 'Jeruzael/docmonstakrakin', pullRequestNumber: 999, baseCommitSha: state.commitSha,
    reviewedHeadCommitSha: 'c'.repeat(40), reviewedHeadTreeSha: 'd'.repeat(40) };
  const intent: any = { schemaVersion: '2.0', projectId: 'PRJ-DOCMONSTAKRAKIN', operation: 'ADD_WBS_ITEMS', receiptId: 'TESTONLY-RECEIPT-0001',
    preWbsSha256: hash(beforeBytes), postWbsSha256: hash(afterBytes), approvedItems: [item], policyId: policy.policyId, policyVersion: policy.policyVersion,
    policySha256: policyDigestV2(policy as any), notBefore: from, notAfter: to, git };
  const receipt: any = { intent, signatures: [] };
  const f: any = { beforeBytes, afterBytes, state, policy, context, document, receipt, git, sign,
    request: { schemaVersion: 'SYNTHETIC_REGISTRATION/1', operationId: 'TESTONLY-OPERATION-0001', expectedRevision: 0,
      beforeBytes, afterBytes, receiptBytes: Buffer.alloc(0) } };
  f.bind = () => {
    intent.preWbsSha256 = hash(beforeBytes); intent.postWbsSha256 = hash(afterBytes); intent.approvedItems = [item];
    intent.policySha256 = payload.policySha256 = expected.policySha256 = policyDigestV2(policy as any);
    intent.policyVersion = payload.policyVersion = expected.policyVersion = policy.policyVersion;
    receipt.signatures = requiredRoles.map((role, i) => ({ principalId: policy.humanKeys[i].principalId, role, keyId: policy.humanKeys[i].keyId,
      kind: 'HUMAN', signatureBase64: sign(i + 3, registrationSigningPayloadV2(intent)) }));
    f.request.receiptBytes = governanceEnvelopeBytes(receipt);
    document.signatures = roles.map((role, i) => ({ principalId: context.root.keys[i].principalId, role, keyId: context.root.keys[i].keyId,
      signatureBase64: sign(i, governanceEnvelopeSigningBytes(payload)) }));
    f.envelopeBytes = governanceEnvelopeBytes(document);
    const inputsSha256 = offlineGovernanceInputDigest(f.envelopeBytes, policy, context);
    const clock = { schemaVersion: '1.0', sessionNonce: context.sessionNonce, inputsSha256, nowIso: '2026-10-21T11:59:59.000Z',
      validUntilIso: '2026-10-21T12:00:30.000Z', uncertaintyMs: 100, sequence: state.clockSequence + 1 };
    const checkpoint = { schemaVersion: '1.0', sessionNonce: context.sessionNonce, inputsSha256, envelopeSha256: hash(f.envelopeBytes),
      authorityEpoch: payload.authorityEpoch, revocationSequence: payload.revocationSequence, sequence: state.checkpointSequence + 1,
      observedAt: '2026-10-21T11:59:58.000Z', validUntilIso: '2026-10-21T12:01:00.000Z' };
    context.clockObservation = { payload: clock, signatureBase64: sign(7, clockObservationSigningBytes(clock)) };
    context.checkpoint = { payload: checkpoint, signatureBase64: sign(6, checkpointSigningBytes(checkpoint)) };
    const entry = { receiptId: intent.receiptId, preWbsSha256: intent.preWbsSha256, postWbsSha256: intent.postWbsSha256,
      policySha256: intent.policySha256, signedIntentSha256: hash(registrationSigningPayloadV2(intent)), signedReceiptSha256: signedReceiptDigestV2(receipt),
      reviewedHeadCommitSha: git.reviewedHeadCommitSha, reviewedHeadTreeSha: git.reviewedHeadTreeSha, pullRequestNumber: git.pullRequestNumber };
    const previousLedger = parseWbsReceiptLedgerV1(ledgerBytes);
    f.proposedLedgerBytes = serializeWbsReceiptLedger({ ...previousLedger, entries: [...previousLedger.entries, entry] });
    f.pinSha256 = hash(canonicalGovernanceJson({ root: context.root, witness: context.witness, clock: context.clock }));
    f.source = { kind: 'TESTONLY_PUBLIC_ROOTS', pinnedAnchorSha256: f.pinSha256, acquire: (requestSha256: string) => {
      const provenance = { schemaVersion: 'TESTONLY_ACQUISITION/1', requestSha256, envelopeSha256: hash(f.envelopeBytes), expectedGit: git,
        protected: { commitSha: state.commitSha, treeSha: state.treeSha, wbsSha256: hash(beforeBytes), ledgerSha256: hash(ledgerBytes) },
        applied: { commitSha: hash(intent.receiptId).slice(0, 40), treeSha: hash('tree-' + intent.receiptId).slice(0, 40), wbsSha256: hash(afterBytes), ledgerSha256: hash(f.proposedLedgerBytes),
          parentShas: [state.commitSha] },
        nowIso: fixtureNow, validUntilIso: '2026-10-21T12:00:30.000Z', authorityEpoch: payload.authorityEpoch,
        revocationSequence: payload.revocationSequence, checkpointSequence: checkpoint.sequence, clockSequence: clock.sequence };
      return f.acquisition = { envelopeBytes: f.envelopeBytes, policy, context, provenance,
        signatureBase64: sign(6, Buffer.from('DOCMONSTAKRAKIN/TESTONLY_WBS_ACQUISITION/1\n' + canonicalGovernanceJson(provenance))) };
    } };
    return f;
  };
  f.advance = (nextState: any) => {
    state = nextState; beforeBytes = state.wbsBytes; ledgerBytes = state.ledgerBytes;
    const ordinal = 9999 - state.revision;
    item = { id: 'DMK-' + ordinal, wbs_path: '99.99.' + (99 - state.revision), status: 'PROPOSED' };
    afterBytes = Buffer.concat([beforeBytes, Buffer.from('\n  - id: ' + item.id + '\n    wbs_path: ' + item.wbs_path + '\n    status: PROPOSED\n')]);
    policy.policyVersion = 'epoch-' + (state.authorityEpoch + 1); payload.authorityEpoch = state.authorityEpoch + 1;
    payload.previousEnvelopeSha256 = state.lastEnvelope.envelopeSha256; payload.envelopeId = 'TESTONLY-ENVELOPE-' + payload.authorityEpoch;
    context.previous = state.lastEnvelope; context.consumedEnvelopeIds = state.consumedEnvelopeIds; context.consumedNonces = state.consumedNonces;
    context.sessionNonce = hash('nonce-' + payload.authorityEpoch); context.minimumAuthorityEpoch = state.authorityEpoch;
    context.minimumCheckpointSequence = state.checkpointSequence; context.minimumClockSequence = state.clockSequence;
    intent.receiptId = 'TESTONLY-RECEIPT-' + payload.authorityEpoch; git.baseCommitSha = state.commitSha;
    git.reviewedHeadCommitSha = hash('reviewed-' + payload.authorityEpoch).slice(0, 40); git.reviewedHeadTreeSha = hash('reviewed-tree-' + payload.authorityEpoch).slice(0, 40);
    f.request = { schemaVersion: 'SYNTHETIC_REGISTRATION/1', operationId: 'TESTONLY-OPERATION-' + payload.authorityEpoch,
      expectedRevision: state.revision, beforeBytes, afterBytes, receiptBytes: Buffer.alloc(0) };
    f.beforeBytes = beforeBytes; f.afterBytes = afterBytes; f.state = state; return f.bind();
  };
  return f.bind();
}
