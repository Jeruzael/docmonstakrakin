import type { WorkItemStatus, WorkItemType, RiskLevel } from '../../src/types.ts';

export const CANONICAL_STATUS_MAP: Record<string, WorkItemStatus> = {
  PROPOSED: 'PROPOSED',
  BACKLOG: 'BACKLOG',
  READY: 'READY',
  IMPLEMENTED: 'VERIFICATION',
  VERIFICATION_PENDING: 'VERIFICATION',
  VERIFIED: 'VERIFIED',
};

export const CANONICAL_TYPE_MAP: Record<string, WorkItemType> = {
  FEATURE: 'FEATURE',
  BUG: 'TASK',
  INFRASTRUCTURE: 'TASK',
  GOVERNANCE: 'TASK',
  QUALITY: 'VERIFICATION',
  SECURITY: 'SECURITY',
  RELEASE: 'RELEASE',
};

/**
 * Maps a canonical WBS status to operational runtime WorkItemStatus.
 * Fails closed if the canonical status is unrecognized.
 */
export function mapCanonicalStatus(status: string): WorkItemStatus {
  const normalized = String(status || '').trim().toUpperCase();
  const mapped = CANONICAL_STATUS_MAP[normalized];
  if (!mapped) {
    throw new Error(`UNSUPPORTED_WBS_STATUS: Unrecognized canonical WBS status "${status}"`);
  }
  return mapped;
}

/**
 * Maps a canonical WBS type to operational runtime WorkItemType.
 * Fails closed if the canonical type is unrecognized.
 */
export function mapCanonicalType(type: string): WorkItemType {
  const normalized = String(type || '').trim().toUpperCase();
  const mapped = CANONICAL_TYPE_MAP[normalized];
  if (!mapped) {
    throw new Error(`UNSUPPORTED_WBS_TYPE: Unrecognized canonical WBS type "${type}"`);
  }
  return mapped;
}

/**
 * Maps priority deterministically to runtime priority ('P0' | 'P1' | 'P2').
 * P0 -> P0, P1 -> P1, P2 -> P2, and P3 -> P2 (explicit operational fold for board display).
 * Fails closed on any unrecognized priority.
 */
export function mapCanonicalPriority(priority: string): 'P0' | 'P1' | 'P2' {
  const normalized = String(priority || '').trim().toUpperCase();
  if (normalized === 'P0') return 'P0';
  if (normalized === 'P1') return 'P1';
  if (normalized === 'P2') return 'P2';
  if (normalized === 'P3') return 'P2'; // Explicit operational fold for board display
  throw new Error(`UNSUPPORTED_WBS_PRIORITY: Unrecognized canonical WBS priority "${priority}"`);
}

/**
 * Maps risk deterministically to runtime RiskLevel ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW').
 * Fails closed on any unrecognized risk level.
 */
export function mapCanonicalRisk(risk: string): RiskLevel {
  const normalized = String(risk || '').trim().toUpperCase();
  if (normalized === 'CRITICAL') return 'CRITICAL';
  if (normalized === 'HIGH') return 'HIGH';
  if (normalized === 'MEDIUM') return 'MEDIUM';
  if (normalized === 'LOW') return 'LOW';
  throw new Error(`UNSUPPORTED_WBS_RISK: Unrecognized canonical WBS risk "${risk}"`);
}

