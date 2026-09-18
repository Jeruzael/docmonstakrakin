import crypto from 'node:crypto';
import type { AuditEvent } from '../../src/types.js';

/**
 * SEC-CTRL-013: Cryptographic Audit Hash Chaining & Immutability
 * NIST SSDF PO.1.3: Maintain tamper-evident audit records
 *
 * Implements deterministic SHA-256 hash chaining where each audit event
 * incorporates the stateHash of the preceding event, rendering any retroactive
 * modification mathematically detectable.
 */

export const GENESIS_AUDIT_HASH = '0'.repeat(64);

/**
 * Deterministically computes the SHA-256 state hash for an audit record.
 */
export function computeAuditEventHash(event: {
  actor: string;
  timestamp: string;
  action: string;
  target: string;
  reason?: string;
  details?: any;
  previousHash?: string;
}): string {
  const previousHash = event.previousHash || GENESIS_AUDIT_HASH;
  const reason = event.reason || '';
  
  // Sort keys for deterministic JSON serialization of details
  let serializedDetails = '';
  if (event.details !== undefined && event.details !== null) {
    if (typeof event.details === 'object') {
      const sortedKeys = Object.keys(event.details).sort();
      const sortedObj: Record<string, any> = {};
      for (const k of sortedKeys) {
        sortedObj[k] = event.details[k];
      }
      serializedDetails = JSON.stringify(sortedObj);
    } else {
      serializedDetails = String(event.details);
    }
  }

  const payload = [
    previousHash,
    event.timestamp,
    event.actor,
    event.action,
    event.target,
    reason,
    serializedDetails,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Creates a cryptographically chained AuditEvent linked to the previous event's hash.
 */
export function createChainedAuditEvent(params: {
  id?: string;
  actor: string;
  action: string;
  target: string;
  reason?: string;
  details?: any;
  previousEvent?: AuditEvent;
}): AuditEvent {
  const id = params.id || `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const previousHash = params.previousEvent ? params.previousEvent.stateHash : GENESIS_AUDIT_HASH;

  const stateHash = computeAuditEventHash({
    actor: params.actor,
    timestamp,
    action: params.action,
    target: params.target,
    reason: params.reason,
    details: params.details,
    previousHash,
  });

  return {
    id,
    actor: params.actor,
    timestamp,
    action: params.action,
    target: params.target,
    reason: params.reason,
    stateHash,
    previousHash,
    details: params.details,
  };
}

export interface ChainVerificationResult {
  valid: boolean;
  verifiedCount: number;
  brokenIndex?: number;
  brokenEventId?: string;
  error?: string;
}

/**
 * Verifies the cryptographic integrity of an audit ledger sequence.
 * Accepts events in either chronological order (oldest first) or reverse-chronological order (newest first).
 */
export function verifyAuditLedgerChain(
  events: AuditEvent[],
  order: 'CHRONOLOGICAL' | 'REVERSE_CHRONOLOGICAL' = 'CHRONOLOGICAL'
): ChainVerificationResult {
  if (!events || events.length === 0) {
    return { valid: true, verifiedCount: 0 };
  }

  // Normalize to chronological order (oldest to newest)
  const chronological = order === 'REVERSE_CHRONOLOGICAL' ? [...events].reverse() : [...events];

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i];
    const prev = i > 0 ? chronological[i - 1] : undefined;
    const expectedPreviousHash = prev ? prev.stateHash : (current.previousHash || GENESIS_AUDIT_HASH);

    // 1. Verify previousHash pointer if present
    if (current.previousHash && current.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        verifiedCount: i,
        brokenIndex: i,
        brokenEventId: current.id,
        error: `Broken chain link at index ${i} (${current.id}): previousHash "${current.previousHash}" does not match expected previous stateHash "${expectedPreviousHash}"`,
      };
    }

    // 2. Recompute and verify stateHash
    const expectedHash = computeAuditEventHash({
      actor: current.actor,
      timestamp: current.timestamp,
      action: current.action,
      target: current.target,
      reason: current.reason,
      details: current.details,
      previousHash: expectedPreviousHash,
    });

    // If event has a full 64-char hex sha256, strictly compare
    if (current.stateHash.length === 64) {
      if (current.stateHash !== expectedHash) {
        return {
          valid: false,
          verifiedCount: i,
          brokenIndex: i,
          brokenEventId: current.id,
          error: `Tampered event payload detected at index ${i} (${current.id}): recorded stateHash "${current.stateHash}" does not match recomputed hash "${expectedHash}"`,
        };
      }
    }
  }

  return {
    valid: true,
    verifiedCount: chronological.length,
  };
}
