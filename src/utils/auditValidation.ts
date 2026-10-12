export interface ExpectedAuditAcknowledgment {
  auditEventId: string;
  documentId: string;
  path: string;
  previousSha256: string;
  newSha256: string;
  timestamp: string;
  stateVersion: number;
}

/**
 * Validates a single audit event record against an authoritative save acknowledgment.
 * Requires exact matching on:
 * - id: saveResponse.auditEventId
 * - action: exactly 'DOCUMENT_UPDATED'
 * - target: saveResponse.documentId
 * - timestamp: saveResponse.timestamp
 * - details.path: saveResponse.path
 * - details.previousSha256: saveResponse.previousSha256
 * - details.newSha256: saveResponse.newSha256
 */
export function validateAuditAcknowledgment(
  event: unknown,
  expected: ExpectedAuditAcknowledgment
): boolean {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, any>;

  if (e.id !== expected.auditEventId) return false;
  if (e.action !== 'DOCUMENT_UPDATED') return false;
  if (e.target !== expected.documentId) return false;
  if (typeof e.timestamp !== 'string' || e.timestamp !== expected.timestamp) return false;

  if (!e.details || typeof e.details !== 'object') return false;
  if (typeof e.details.path !== 'string' || e.details.path !== expected.path) return false;
  if (typeof e.details.previousSha256 !== 'string' || e.details.previousSha256 !== expected.previousSha256) return false;
  if (typeof e.details.newSha256 !== 'string' || e.details.newSha256 !== expected.newSha256) return false;

  return true;
}

export interface AuditReconciliationResult {
  valid: boolean;
  reason?: string;
  satisfiedAckIds: string[];
}

/**
 * Reconciles an audit event list against all outstanding acknowledged saves.
 * Enforces that:
 * 1. Every outstanding acknowledgment appears in the audit list.
 * 2. Every acknowledged ID appears exactly once (no duplicates).
 * 3. Every acknowledged event matches the exact save metadata.
 */
export function reconcileAuditEvents(
  events: unknown[],
  outstandingAcks: ExpectedAuditAcknowledgment[]
): AuditReconciliationResult {
  if (!Array.isArray(events)) {
    return { valid: false, reason: 'Events payload is not an array', satisfiedAckIds: [] };
  }

  if (outstandingAcks.length === 0) {
    return { valid: true, satisfiedAckIds: [] };
  }

  const satisfiedAckIds: string[] = [];

  for (const ack of outstandingAcks) {
    const matchingEvents = events.filter(
      (e): e is Record<string, any> => Boolean(e && typeof e === 'object' && (e as any).id === ack.auditEventId)
    );

    if (matchingEvents.length === 0) {
      return {
        valid: false,
        reason: `Outstanding audit event ${ack.auditEventId} not found in audit records`,
        satisfiedAckIds,
      };
    }

    if (matchingEvents.length > 1) {
      return {
        valid: false,
        reason: `Duplicate instances of audit event ${ack.auditEventId} detected in audit records`,
        satisfiedAckIds,
      };
    }

    const matched = matchingEvents[0];
    if (!validateAuditAcknowledgment(matched, ack)) {
      return {
        valid: false,
        reason: `Audit event ${ack.auditEventId} does not strictly match expected save acknowledgment`,
        satisfiedAckIds,
      };
    }

    satisfiedAckIds.push(ack.auditEventId);
  }

  return { valid: true, satisfiedAckIds };
}
