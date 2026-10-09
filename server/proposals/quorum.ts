export const REQUIRED_QUORUM_ROLES = ['Security Officer', 'Lead Architect'] as const;
export type QuorumRole = typeof REQUIRED_QUORUM_ROLES[number];

export type QuorumStatus = 'PENDING' | 'PARTIAL' | 'SATISFIED' | 'REJECTED' | 'STALE' | 'INVALID';

export interface QuorumEvaluation {
  status: QuorumStatus;
  hasQuorum: boolean;
  satisfiedRoles: string[];
  pendingRoles: string[];
  collectedSignatures: any[];
  reason?: string;
}

export function evaluateQuorum(item: any, currentTargetDigest?: string): QuorumEvaluation {
  const requiredRoles: string[] = Array.isArray(item.requiredRoles) && item.requiredRoles.length > 0
    ? item.requiredRoles
    : [...REQUIRED_QUORUM_ROLES];

  // 1. Policy version check
  if (item.policyVersion !== 'LOCAL_SESSION_V1') {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...requiredRoles],
      collectedSignatures: [],
      reason: 'Legacy or invalid policy version; requires LOCAL_SESSION_V1',
    };
  }

  // 2. Stale digest check
  if (currentTargetDigest !== undefined && item.targetDigest && currentTargetDigest !== item.targetDigest) {
    return {
      status: 'STALE',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...requiredRoles],
      collectedSignatures: [],
      reason: 'Target digest has changed since sign-off request was initiated',
    };
  }

  const signatures = Array.isArray(item.approvalsCollected) ? item.approvalsCollected : [];

  // 3. Rejection check
  if (item.status === 'REJECTED' || signatures.some((s: any) => s.decision === 'REJECTED')) {
    return {
      status: 'REJECTED',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...requiredRoles],
      collectedSignatures: signatures,
      reason: 'Approval request was rejected',
    };
  }

  // 4. Evaluate valid signatures
  const satisfiedRoles: string[] = [];
  const usedIdentities = new Set<string>();
  const validSignatures: any[] = [];

  for (const sig of signatures) {
    if (sig.decision !== 'APPROVED') continue;
    if (typeof sig.identityId !== 'string' || !sig.identityId.trim()) continue;
    if (sig.roleSource && sig.roleSource !== 'LOCAL_SERVER_ROSTER') continue;
    if (!requiredRoles.includes(sig.role)) continue;

    // Enforce distinct human identities
    if (usedIdentities.has(sig.identityId)) continue;
    if (satisfiedRoles.includes(sig.role)) continue;

    usedIdentities.add(sig.identityId);
    satisfiedRoles.push(sig.role);
    validSignatures.push(sig);
  }

  const pendingRoles = requiredRoles.filter((r) => !satisfiedRoles.includes(r));
  const hasQuorum = requiredRoles.length > 0 && pendingRoles.length === 0;

  let status: QuorumStatus = 'PENDING';
  if (hasQuorum) {
    status = 'SATISFIED';
  } else if (satisfiedRoles.length > 0) {
    status = 'PARTIAL';
  } else {
    status = 'PENDING';
  }

  return {
    status,
    hasQuorum,
    satisfiedRoles,
    pendingRoles,
    collectedSignatures: validSignatures,
  };
}
