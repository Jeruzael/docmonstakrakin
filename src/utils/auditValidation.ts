import { isValidStateVersion } from './projectListReconciliation';
import type { DocumentSaveResponse } from '../types';
import type {ManagedDocumentCreateResponse} from '../managedDocumentTypes';

const SHA256_REGEX = /^[0-9a-fA-F]{64}$/;

export function isValidManagedDocumentCreateAcknowledgment(response:unknown,projectId:string):response is ManagedDocumentCreateResponse {
  if(!response || typeof response!=='object' || Array.isArray(response))return false;
  const r=response as Record<string,unknown>;
  return r.success===true && r.projectId===projectId && typeof r.documentId==='string' && /^MDOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.documentId) &&
    (r.path===`managed-documents/${r.documentId}.md` || r.path===`managed-documents/${r.documentId}.txt`) &&
    !Object.hasOwn(r,'previousSha256') && typeof r.newSha256==='string' && SHA256_REGEX.test(r.newSha256) && isValidStateVersion(r.stateVersion) &&
    typeof r.auditEventId==='string' && !!r.auditEventId && typeof r.timestamp==='string' && Number.isFinite(Date.parse(r.timestamp));
}

export function isValidSaveAcknowledgment(response: unknown): response is DocumentSaveResponse {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  const r = response as Record<string, any>;
  if (r.success !== true) return false;
  if (typeof r.documentId !== 'string' || r.documentId.length === 0) return false;
  if (typeof r.path !== 'string' || r.path.length === 0) return false;
  if (typeof r.previousSha256 !== 'string' || !SHA256_REGEX.test(r.previousSha256)) return false;
  if (typeof r.newSha256 !== 'string' || !SHA256_REGEX.test(r.newSha256)) return false;
  if (!isValidStateVersion(r.stateVersion)) return false;
  if (typeof r.auditEventId !== 'string' || r.auditEventId.length === 0) return false;
  if (typeof r.timestamp !== 'string' || Number.isNaN(Date.parse(r.timestamp))) return false;
  return true;
}

export function isEligibleControlledDocumentSaveCommit(
  projectId: unknown,
  response: unknown
): response is DocumentSaveResponse {
  if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) return false;
  return isValidSaveAcknowledgment(response);
}

export interface ExpectedAuditAcknowledgment {
  auditEventId: string;
  documentId: string;
  path: string;
  previousSha256?: string;
  action?: 'DOCUMENT_UPDATED' | 'DOCUMENT_CREATED';
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
  if (e.action !== (expected.action ?? 'DOCUMENT_UPDATED')) return false;
  if (e.target !== expected.documentId) return false;
  if (typeof e.timestamp !== 'string' || e.timestamp !== expected.timestamp) return false;

  if (!e.details || typeof e.details !== 'object') return false;
  if (typeof e.details.path !== 'string' || e.details.path !== expected.path) return false;
  if(expected.action==='DOCUMENT_CREATED') {
    if(Object.hasOwn(e.details,'previousSha256') || expected.previousSha256!==undefined)return false;
  } else if (typeof e.details.previousSha256 !== 'string' || e.details.previousSha256 !== expected.previousSha256) return false;
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

export interface CombinedAuditAcksResult {
  valid: boolean;
  reason?: string;
  requiredAcks: ExpectedAuditAcknowledgment[];
}

/**
 * Combines confirmed and outstanding audit acknowledgments into a single required set.
 * Deduplicates by auditEventId. If the same ID has conflicting metadata, fails closed with valid: false.
 */
export function combineRequiredAuditAcks(
  confirmed: ExpectedAuditAcknowledgment[] = [],
  outstanding: ExpectedAuditAcknowledgment[] = []
): CombinedAuditAcksResult {
  const map = new Map<string, ExpectedAuditAcknowledgment>();

  for (const ack of [...confirmed, ...outstanding]) {
    const existing = map.get(ack.auditEventId);
    if (!existing) {
      map.set(ack.auditEventId, ack);
    } else {
      if (
        existing.documentId !== ack.documentId ||
        (existing.action ?? 'DOCUMENT_UPDATED') !== (ack.action ?? 'DOCUMENT_UPDATED') ||
        existing.path !== ack.path ||
        existing.previousSha256 !== ack.previousSha256 ||
        existing.newSha256 !== ack.newSha256 ||
        existing.timestamp !== ack.timestamp ||
        existing.stateVersion !== ack.stateVersion
      ) {
        return {
          valid: false,
          reason: `Conflicting acknowledgment metadata for audit event ${ack.auditEventId}`,
          requiredAcks: [],
        };
      }
    }
  }

  return {
    valid: true,
    requiredAcks: Array.from(map.values()),
  };
}
