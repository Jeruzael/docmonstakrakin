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
  reissueRequired?: boolean;
  reissueReason?: string;
}

export interface StoredSignaturesValidation {
  valid: boolean;
  error?: string;
  satisfiedRoles: string[];
  usedIdentities: string[];
}

export function validateStoredSignatures(
  signatures: any,
  options?: { isPending?: boolean; requiredRoles?: readonly string[] }
): StoredSignaturesValidation {
  const allowedRoles = options?.requiredRoles || REQUIRED_QUORUM_ROLES;

  if (!Array.isArray(signatures)) {
    return {
      valid: false,
      error: 'Malformed stored approval record: approvalsCollected must be an array; request fresh authenticated sign-off',
      satisfiedRoles: [],
      usedIdentities: [],
    };
  }

  const satisfiedRoles: string[] = [];
  const usedIdentities = new Set<string>();

  for (const sig of signatures) {
    if (!sig || typeof sig !== 'object' || Array.isArray(sig)) {
      return {
        valid: false,
        error: 'Malformed stored signature record; request fresh authenticated sign-off',
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (typeof sig.decision !== 'string' || !['APPROVED', 'REJECTED'].includes(sig.decision)) {
      return {
        valid: false,
        error: 'Malformed stored signature: invalid or missing decision; request fresh authenticated sign-off',
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (typeof sig.role !== 'string' || !allowedRoles.includes(sig.role as any)) {
      return {
        valid: false,
        error: `Malformed stored signature: invalid canonical role "${sig.role}"; request fresh authenticated sign-off`,
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (typeof sig.identityId !== 'string' || !sig.identityId.trim()) {
      return {
        valid: false,
        error: 'Malformed stored signature: missing or empty identityId; request fresh authenticated sign-off',
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (sig.roleSource !== 'LOCAL_SERVER_ROSTER') {
      return {
        valid: false,
        error: 'Malformed stored signature: invalid or missing roleSource; request fresh authenticated sign-off',
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (options?.isPending && sig.decision === 'REJECTED') {
      return {
        valid: false,
        error: 'Inconsistent stored signature: pending approval request contains a rejection signature; request fresh authenticated sign-off',
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }

    if (usedIdentities.has(sig.identityId)) {
      return {
        valid: false,
        error: `Inconsistent stored signature: duplicate signer identity "${sig.identityId}"; request fresh authenticated sign-off`,
        satisfiedRoles: [],
        usedIdentities: [],
      };
    }
    usedIdentities.add(sig.identityId);

    if (sig.decision === 'APPROVED') {
      if (satisfiedRoles.includes(sig.role)) {
        return {
          valid: false,
          error: `Inconsistent stored signature: duplicate approval for role "${sig.role}"; request fresh authenticated sign-off`,
          satisfiedRoles: [],
          usedIdentities: [],
        };
      }
      satisfiedRoles.push(sig.role);
    }
  }

  return {
    valid: true,
    satisfiedRoles,
    usedIdentities: Array.from(usedIdentities),
  };
}

export function evaluateQuorum(item: any, currentTargetDigest?: string): QuorumEvaluation {
  // 0. Superseded check
  if (item.status === 'SUPERSEDED' || item.supersededBy) {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: Array.isArray(item.approvalsCollected) ? item.approvalsCollected : [],
      reason: 'Approval request has been superseded by a replacement sign-off request',
    };
  }

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

  // 3. Target digest format check (lowercase 64-char hex SHA-256)
  const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;
  if (typeof item.targetDigest !== 'string' || !SHA256_HEX_REGEX.test(item.targetDigest)) {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: [],
      reason: 'Missing, malformed, or non-hex SHA-256 targetDigest in sign-off request',
    };
  }

  // Validate postRatificationDigest if present
  if (
    item.postRatificationDigest !== undefined &&
    (typeof item.postRatificationDigest !== 'string' || !SHA256_HEX_REGEX.test(item.postRatificationDigest))
  ) {
    return {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...REQUIRED_QUORUM_ROLES],
      collectedSignatures: [],
      reason: 'Invalid postRatificationDigest format; requires 64-char lowercase hex SHA-256',
    };
  }

  const requiredRoles: string[] = [...REQUIRED_QUORUM_ROLES];

  // 4. Stale digest / missing target check
  if (currentTargetDigest === null) {
    return {
      status: 'STALE',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: [...requiredRoles],
      collectedSignatures: [],
      reason: 'Canonical approval target no longer exists',
    };
  }

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
      if (!item.postRatificationDigest && currentTargetDigest !== item.targetDigest) {
        return {
          status: 'STALE',
          hasQuorum: false,
          satisfiedRoles: [],
          pendingRoles: [...requiredRoles],
          collectedSignatures: [],
          reason: 'Target digest has changed since sign-off request was initiated',
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

  // 4.5. Stored signature validation for pending approvals
  if (item.status === 'PENDING') {
    const sigValidation = validateStoredSignatures(item.approvalsCollected, {
      isPending: true,
      requiredRoles,
    });
    if (!sigValidation.valid) {
      return {
        status: 'INVALID',
        hasQuorum: false,
        satisfiedRoles: [],
        pendingRoles: [...requiredRoles],
        collectedSignatures: [],
        reason: sigValidation.error || 'Malformed stored approval signatures; request fresh authenticated sign-off',
      };
    }
  }

  const signatures = Array.isArray(item.approvalsCollected) ? item.approvalsCollected : [];

  // 5. Rejection check
  if (item.status === 'REJECTED' || signatures.some((s: any) => s && typeof s === 'object' && s.decision === 'REJECTED')) {
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
    if (!sig || typeof sig !== 'object') continue;
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
