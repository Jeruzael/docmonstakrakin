import assert from 'node:assert/strict';
import {
  ExpectedAuditAcknowledgment,
  validateAuditAcknowledgment,
  reconcileAuditEvents,
  combineRequiredAuditAcks,
  isValidSaveAcknowledgment,
  isEligibleControlledDocumentSaveCommit,
} from '../src/utils/auditValidation';

console.log('--- Testing Audit Validation & Reconciliation ---');

const baseExpected: ExpectedAuditAcknowledgment = {
  auditEventId: 'AUD-001',
  documentId: 'DOC-CTRL-002',
  path: 'docs/00_control/PROJECT_STATE.md',
  previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
  newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
  timestamp: '2026-10-12T10:00:00.000Z',
  stateVersion: 121,
};

const validEvent = {
  id: 'AUD-001',
  action: 'DOCUMENT_UPDATED',
  target: 'DOC-CTRL-002',
  timestamp: '2026-10-12T10:00:00.000Z',
  actor: 'Lead Architect',
  stateHash: 'CHAIN_HASH_9999999', // Cryptographic audit chain hash; not required to equal newSha256
  details: {
    path: 'docs/00_control/PROJECT_STATE.md',
    previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
  },
};

// 1. Valid exact match
assert.equal(validateAuditAcknowledgment(validEvent, baseExpected), true, 'Exact match must pass');

// 2. Wrong target
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, target: 'DOC-CTRL-001' }, baseExpected),
  false,
  'Wrong target must fail'
);

// 3. Wrong path
assert.equal(
  validateAuditAcknowledgment(
    { ...validEvent, details: { ...validEvent.details, path: 'docs/other.md' } },
    baseExpected
  ),
  false,
  'Wrong path must fail'
);

// 4. Wrong newSha256
assert.equal(
  validateAuditAcknowledgment(
    { ...validEvent, details: { ...validEvent.details, newSha256: 'wrong_sha' } },
    baseExpected
  ),
  false,
  'Wrong newSha256 must fail'
);

// 5. Wrong previousSha256
assert.equal(
  validateAuditAcknowledgment(
    { ...validEvent, details: { ...validEvent.details, previousSha256: 'wrong_prev_sha' } },
    baseExpected
  ),
  false,
  'Wrong previousSha256 must fail'
);

// 6. Wrong action (not exactly DOCUMENT_UPDATED)
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, action: 'DOCUMENT' }, baseExpected),
  false,
  'Partial action string must fail'
);
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, action: 'DOCUMENT_CREATED' }, baseExpected),
  false,
  'Non-matching action must fail'
);

// 7. Wrong timestamp
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, timestamp: '2026-10-12T10:00:05.000Z' }, baseExpected),
  false,
  'Mismatched timestamp must fail'
);

// 8. Missing / malformed details
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, details: null }, baseExpected),
  false,
  'Null details must fail'
);
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, details: 'invalid' }, baseExpected),
  false,
  'String details must fail'
);
assert.equal(
  validateAuditAcknowledgment({ ...validEvent, details: {} }, baseExpected),
  false,
  'Empty details must fail'
);

// 9. reconcileAuditEvents - single valid event
const r1 = reconcileAuditEvents([validEvent], [baseExpected]);
assert.equal(r1.valid, true, 'Reconcile single valid event must pass');
assert.deepEqual(r1.satisfiedAckIds, ['AUD-001']);

// 10. reconcileAuditEvents - duplicate event ID in audit list must fail
const r2 = reconcileAuditEvents([validEvent, { ...validEvent }], [baseExpected]);
assert.equal(r2.valid, false, 'Duplicate acknowledged event ID must fail');
assert.match(r2.reason || '', /duplicate/i);

// 11. reconcileAuditEvents - missing acknowledged event
const r3 = reconcileAuditEvents([], [baseExpected]);
assert.equal(r3.valid, false, 'Missing acknowledged event must fail');

// 12. reconcileAuditEvents - multiple outstanding saves
const expected2: ExpectedAuditAcknowledgment = {
  auditEventId: 'AUD-002',
  documentId: 'DOC-CTRL-002',
  path: 'docs/00_control/PROJECT_STATE.md',
  previousSha256: '2222222222222222222222222222222222222222222222222222222222222222',
  newSha256: '3333333333333333333333333333333333333333333333333333333333333333',
  timestamp: '2026-10-12T10:05:00.000Z',
  stateVersion: 122,
};
const validEvent2 = {
  id: 'AUD-002',
  action: 'DOCUMENT_UPDATED',
  target: 'DOC-CTRL-002',
  timestamp: '2026-10-12T10:05:00.000Z',
  actor: 'Lead Architect',
  stateHash: 'CHAIN_HASH_8888888',
  details: {
    path: 'docs/00_control/PROJECT_STATE.md',
    previousSha256: '2222222222222222222222222222222222222222222222222222222222222222',
    newSha256: '3333333333333333333333333333333333333333333333333333333333333333',
  },
};

// If only event 1 is present, but both expected:
const r4 = reconcileAuditEvents([validEvent], [baseExpected, expected2]);
assert.equal(r4.valid, false, 'Partial satisfaction of multiple saves must fail');

// If both present:
const r5 = reconcileAuditEvents([validEvent, validEvent2], [baseExpected, expected2]);
assert.equal(r5.valid, true, 'Both satisfied must pass');
assert.deepEqual(r5.satisfiedAckIds, ['AUD-001', 'AUD-002']);

// 13. combineRequiredAuditAcks - empty confirmed & empty outstanding
const c1 = combineRequiredAuditAcks([], []);
assert.equal(c1.valid, true);
assert.equal(c1.requiredAcks.length, 0);

// 14. combineRequiredAuditAcks - distinct confirmed and outstanding
const c2 = combineRequiredAuditAcks([baseExpected], [expected2]);
assert.equal(c2.valid, true);
assert.equal(c2.requiredAcks.length, 2);
assert.deepEqual(c2.requiredAcks.map(a => a.auditEventId), ['AUD-001', 'AUD-002']);

// 15. combineRequiredAuditAcks - identical confirmed and outstanding deduplicated
const c3 = combineRequiredAuditAcks([baseExpected], [{ ...baseExpected }]);
assert.equal(c3.valid, true);
assert.equal(c3.requiredAcks.length, 1);
assert.equal(c3.requiredAcks[0].auditEventId, 'AUD-001');

// 16. combineRequiredAuditAcks - conflicting metadata for same auditEventId fails closed
const conflictingExpected = {
  ...baseExpected,
  newSha256: '9999999999999999999999999999999999999999999999999999999999999999',
};
const c4 = combineRequiredAuditAcks([baseExpected], [conflictingExpected]);
assert.equal(c4.valid, false, 'Conflicting metadata must fail closed');
assert.ok(c4.reason?.includes('Conflicting acknowledgment metadata'));

// 18. isValidSaveAcknowledgment & isEligibleControlledDocumentSaveCommit (MONO-18)
const validSaveAck = {
  success: true,
  documentId: 'DOC-CTRL-002',
  path: 'docs/00_control/PROJECT_STATE.md',
  previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
  newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
  stateVersion: 121,
  auditEventId: 'AUD-001',
  timestamp: '2026-10-12T10:00:00.000Z',
};

assert.equal(isValidSaveAcknowledgment(validSaveAck), true, 'Valid save acknowledgment must pass');
assert.equal(isEligibleControlledDocumentSaveCommit('PRJ-DOCMONSTAKRAKIN', validSaveAck), true, 'Valid project and save ack must be eligible');

// Rejection of unsafe integers and invalid stateVersions
assert.equal(
  isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: Number.MAX_SAFE_INTEGER + 1 }),
  false,
  'Unsafe integer stateVersion (MAX_SAFE_INTEGER + 1) must be rejected'
);
assert.equal(
  isEligibleControlledDocumentSaveCommit('PRJ-DOCMONSTAKRAKIN', { ...validSaveAck, stateVersion: Number.MAX_SAFE_INTEGER + 1 }),
  false,
  'Unsafe integer must be ineligible for commit at App boundary'
);
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: -1 }), false, 'Negative stateVersion rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: 1.5 }), false, 'Fractional stateVersion rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: '121' }), false, 'String stateVersion rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: NaN }), false, 'NaN stateVersion rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, stateVersion: Infinity }), false, 'Infinity stateVersion rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, success: false }), false, 'success !== true rejected');
assert.equal(isValidSaveAcknowledgment({ ...validSaveAck, auditEventId: '' }), false, 'Empty auditEventId rejected');
assert.equal(isValidSaveAcknowledgment(null), false, 'null rejected');
assert.equal(isValidSaveAcknowledgment(undefined), false, 'undefined rejected');
assert.equal(isValidSaveAcknowledgment([]), false, 'array rejected');

// Project ID boundary checks
assert.equal(isEligibleControlledDocumentSaveCommit('', validSaveAck), false, 'Empty projectId ineligible');
assert.equal(isEligibleControlledDocumentSaveCommit(null, validSaveAck), false, 'Null projectId ineligible');
assert.equal(isEligibleControlledDocumentSaveCommit(undefined, validSaveAck), false, 'Undefined projectId ineligible');

console.log('All audit validation unit tests passed!');
