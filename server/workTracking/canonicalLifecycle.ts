/**
 * Programmatic Canonical WorkItem Lifecycle Contract (DMK-208 v1)
 *
 * Authoritative programmatic source of truth for the seven primary canonical WorkItem
 * lifecycle states as formally defined and approved in PLAN-GOV-2026-001.
 */

export const CANONICAL_LIFECYCLE_STATUSES = [
  'PROPOSED',
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFICATION_PENDING',
  'VERIFIED',
] as const;

export type CanonicalLifecycleStatus = (typeof CANONICAL_LIFECYCLE_STATUSES)[number];

export interface CanonicalLifecycleDefinition {
  status: CanonicalLifecycleStatus;
  label: string;
  description: string;
}

export const CANONICAL_LIFECYCLE_DEFINITIONS: Record<CanonicalLifecycleStatus, CanonicalLifecycleDefinition> = {
  PROPOSED: {
    status: 'PROPOSED',
    label: 'Proposed',
    description: 'Candidate work identified but not yet accepted into planned execution.',
  },
  BACKLOG: {
    status: 'BACKLOG',
    label: 'Backlog',
    description: 'Accepted/planned work that has not started.',
  },
  READY: {
    status: 'READY',
    label: 'Ready',
    description: 'Accepted work whose required prerequisites are satisfied and which may begin.',
  },
  IN_PROGRESS: {
    status: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Actual implementation has begun and acceptance criteria are not yet fully satisfied.',
  },
  IMPLEMENTED: {
    status: 'IMPLEMENTED',
    label: 'Implemented',
    description: 'Implementation deliverables are complete; technical verification remains pending or underway.',
  },
  VERIFICATION_PENDING: {
    status: 'VERIFICATION_PENDING',
    label: 'Verification Pending',
    description: 'Implementation is complete and formal technical verification / evidence review is awaiting closure.',
  },
  VERIFIED: {
    status: 'VERIFIED',
    label: 'Verified',
    description: 'Technical verification is complete and sufficient reproducible technical evidence demonstrates that applicable acceptance criteria are satisfied. (VERIFIED does NOT imply Human Governance Approved.)',
  },
};

/**
 * Checks whether an arbitrary string is an approved canonical v1 lifecycle status.
 */
export function isCanonicalLifecycleStatus(status: unknown): status is CanonicalLifecycleStatus {
  if (typeof status !== 'string') return false;
  return (CANONICAL_LIFECYCLE_STATUSES as readonly string[]).includes(status.trim().toUpperCase());
}

/**
 * Asserts that a given string is an approved canonical v1 lifecycle status.
 * Fails closed throwing UNSUPPORTED_WBS_STATUS if missing or unsupported.
 */
export function assertCanonicalLifecycleStatus(
  status: unknown,
  itemId?: string
): asserts status is CanonicalLifecycleStatus {
  if (typeof status !== 'string' || !status.trim()) {
    const idMsg = itemId ? ` for item "${itemId}"` : '';
    throw new Error(`UNSUPPORTED_WBS_STATUS: Missing or blank canonical WBS status${idMsg}`);
  }
  const normalized = status.trim().toUpperCase();
  if (!(CANONICAL_LIFECYCLE_STATUSES as readonly string[]).includes(normalized)) {
    const idMsg = itemId ? ` in item "${itemId}"` : '';
    throw new Error(`UNSUPPORTED_WBS_STATUS: Unsupported canonical WBS status "${status}"${idMsg}`);
  }
}
