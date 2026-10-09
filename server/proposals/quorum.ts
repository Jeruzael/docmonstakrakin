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
  // 1. Policy version check
  if (item.policyVersion !== 'LOCAL_SESSION_V1') {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: [],
      reason: 'Legacy, missing, or unsupported policyVersion; requires LOCAL_SESSION_V1',
    };
  }

  // 2. Exact canonical requiredRoles policy check
  if (
    !Array.isArray(item.requiredRoles) ||
    item.requiredRoles.length !== REQUIRED_QUORUM_ROLES.length ||
    item.requiredRoles[0] !== REQUIRED_QUORUM_ROLES[0] ||
    item.requiredRoles[1] !== REQUIRED_QUORUM_ROLES[1]
  ) {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: [],
      reason: "Invalid requiredRoles; policy requires exact ['Security Officer', 'Lead Architect']",
    };
  }

  // 3. Target digest presence check
  if (typeof item.targetDigest !== 'string' || !item.targetDigest.trim()) {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: [],
      reason: 'Missing or invalid targetDigest in sign-off request',
    };
  }

  const requiredRoles: string[] = [...REQUIRED_QUORUM_ROLES];

  // 4. Stale digest check
  if (currentTargetDigest !== undefined) {
    if (item.status === 'APPROVED') {
      const expectedDigest = item.postRatificationDigest || item.targetDigest;
      // If postRatificationDigest exists, target must match it
      if (item.postRatificationDigest && currentTargetDigest !== item.postRatificationDigest) {
        return {
          status: 'STALE',
          hasQuorum: false,
          satisfiedRoles: [],
          pendingRoles: [...requiredRoles],
          collectedSignatures: [],
          reason: 'Target digest has changed since sign-off ratification',
        };
      }
    } else {
      if (currentTargetDigest !== item.targetDigest) {
        return {
          status: 'STALE',
          hasQuorum: false,
          satisfiedRoles: [],
          pendingRoles: [...requiredRoles],
          collectedSignatures: [],
          reason: 'Target digest has changed since sign-off request was initiated',
        };
      }
    }
  }

  const signatures = Array.isArray(item.approvalsCollected) ? item.approvalsCollected : [];

  // 5. Rejection check
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

  // 6. Evaluate valid signatures with strict provenance
  const satisfiedRoles: string[] = [];
  const usedIdentities = new Set<string>();
  const validSignatures: any[] = [];

  for (const sig of signatures) {
    if (sig.decision !== 'APPROVED') continue;
    if (typeof sig.identityId !== 'string' || !sig.identityId.trim()) continue;
    if (sig.roleSource !== 'LOCAL_SERVER_ROSTER') continue;
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
