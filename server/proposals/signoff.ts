import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { digest } from './review.js';
import { validateText } from '../../src/data/generationValidation.js';
import { installReviewerIdentity } from './identity.js';
import { evaluateQuorum, REQUIRED_QUORUM_ROLES } from './quorum.js';

export function registerSignoffRoutes(app: Express, store: any) {
  const { requireHuman } = installReviewerIdentity(app);
  const roles = [...REQUIRED_QUORUM_ROLES];
  const mapping: Record<string, [string, string]> = {
    REQUIREMENT: ['requirements', 'REQUIREMENT_BASELINE'],
    ADR: ['adrs', 'ADR_SIGN_OFF'],
    RISK: ['risks', 'RISK_ACCEPTANCE'],
    OVERRIDE: ['overrides', 'SECURITY_OVERRIDE'],
  };

  function isProtectedGateOrRelease(controlCandidate: unknown): boolean {
    if (typeof controlCandidate !== 'string') return false;
    const val = controlCandidate.trim();
    if (!val) return false;

    // Matches Gate 7 representations: 'Gate 7', 'gate 7', 'GATE-7', 'Gate7', 'GATE_7', 'GATE-07', 'gate #7', etc.
    // Must NOT match unrelated controls like 'Gate 70', 'Gate 71', 'GATE-70'
    const gate7Pattern = /(?:^|[^a-zA-Z0-9])gate[\s\-_#/:.]*0*7(?!\d)/i;

    // Matches release ceremony references regardless of case
    const releasePattern = /(?:^|[^a-zA-Z0-9])release(?:$|[^a-zA-Z0-9])/i;

    return gate7Pattern.test(val) || releasePattern.test(val);
  }

  function validateOverrideEligibility(target: any): { valid: boolean; status: number; error: string } {
    const candidates = [target.gateOrControl, target.title, target.id].filter(Boolean);
    const hasProtected = candidates.some((c) => isProtectedGateOrRelease(c));
    if (hasProtected) {
      return { valid: false, status: 403, error: 'Direct bypass or override of Gate 7 or release ceremony is strictly forbidden' };
    }
    if (!target.expiresAt || isNaN(new Date(target.expiresAt).getTime())) {
      return { valid: false, status: 422, error: 'Override must possess a valid expiration timestamp' };
    }
    if (new Date(target.expiresAt).getTime() <= Date.now()) {
      return { valid: false, status: 422, error: 'Cannot approve expired security override' };
    }
    if (target.riskAcknowledged !== true) {
      return { valid: false, status: 422, error: 'Risk must be acknowledged before requesting or approving override' };
    }
    return { valid: true, status: 200, error: '' };
  }

  app.get('/api/projects/:id/governance-policy', (req, res) => res.json({ requiredRoles: roles }));

  app.get('/api/projects/:id/approvals', (req, res) => {
    const identity = requireHuman(req, res);
    if (!identity) return;

    const p = store.projects.find((pr: any) => pr.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const list = store.approvals[p.id] || [];
    const projected = list.map((item: any) => {
      const spec = mapping[item.targetEntityType];
      if (!spec) {
        return {
          ...item,
          quorum: {
            status: 'INVALID',
            hasQuorum: false,
            satisfiedRoles: [],
            pendingRoles: [...REQUIRED_QUORUM_ROLES],
            reason: `Unsupported target entity type: ${item.targetEntityType}`,
          },
        };
      }
      const target = (store[spec[0]]?.[req.params.id] || []).find((t: any) => t.id === item.targetEntityId);
      if (!target) {
        return {
          ...item,
          quorum: {
            status: 'STALE',
            hasQuorum: false,
            satisfiedRoles: [],
            pendingRoles: [...REQUIRED_QUORUM_ROLES],
            reason: 'Canonical approval target no longer exists',
          },
        };
      }
      const currentTargetDigest = digest(target);
      const quorum = evaluateQuorum(item, currentTargetDigest);
      return {
        ...item,
        quorum: {
          status: quorum.status,
          hasQuorum: quorum.hasQuorum,
          satisfiedRoles: quorum.satisfiedRoles,
          pendingRoles: quorum.pendingRoles,
          ...(quorum.reason ? { reason: quorum.reason } : {}),
        },
      };
    });
    res.json(projected);
  });

  app.post('/api/projects/:id/approvals', (req, res) => {
    const identity = requireHuman(req, res);
    if (!identity) return;

    if (req.body.actorType === 'AGENT') {
      return res.status(403).json({ error: 'Agent identity cannot request governance approval' });
    }

    const p = store.projects.find((p: any) => p.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const { targetEntityType, targetEntityId } = req.body;

    if (targetEntityType === 'GATE' || targetEntityType === 'RELEASE') {
      return res.status(422).json({
        error: 'Use the dedicated release gate ceremony for release sign-off; select a canonical requirement, ADR, risk or override here',
      });
    }

    const spec = Object.hasOwn(mapping, targetEntityType) ? mapping[targetEntityType] : null;
    if (!spec) {
      return res.status(422).json({
        error: 'Use the dedicated release gate ceremony for release sign-off; select a canonical requirement, ADR, risk or override here',
      });
    }

    const target = (store[spec[0]][p.id] || []).find((a: any) => a.id === targetEntityId);
    if (!target) return res.status(404).json({ error: 'Canonical target not found in this project' });

    if (targetEntityType === 'OVERRIDE') {
      const ovrCheck = validateOverrideEligibility(target);
      if (!ovrCheck.valid) {
        return res.status(ovrCheck.status).json({ error: ovrCheck.error });
      }
    }

    const requestedBy = identity.name;
    validateText(requestedBy, 'requestedBy');

    const targetDigest = digest(target);

    const prior = (store.approvals[p.id] || []).find(
      (a: any) =>
        a.targetEntityType === targetEntityType &&
        a.targetEntityId === targetEntityId &&
        a.policyVersion === 'LOCAL_SESSION_V1' &&
        a.status === 'PENDING' &&
        a.targetDigest === targetDigest
    );
    if (prior) return res.status(201).json(prior);

    const item = {
      id: `APV-${randomUUID()}`,
      projectId: p.id,
      title: target.title || target.gateOrControl,
      type: spec[1],
      targetEntityId,
      targetEntityType,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      urgency: 'HIGH',
      riskLevel: 'MEDIUM',
      description: target.statement || target.context || target.description || target.reason,
      impactAnalysis: 'Human sign-off of canonical proposed artifact',
      requiredRoles: [...roles],
      approvalsCollected: [],
      targetDigest,
      policyGates: [
        {
          gateName: 'Canonical target exists',
          passed: true,
          details: 'Target resolved within this project; distinct authorized humans required',
        },
      ],
      policyVersion: 'LOCAL_SESSION_V1',
    };

    (store.approvals[p.id] ||= []).unshift(item);
    p.stateVersion++;
    store.addAuditEvent(
      p.id,
      requestedBy,
      'APPROVAL_REQUESTED',
      item.id,
      'Explicit Request Sign-Off',
      { targetEntityId, authenticatedIdentity: identity.id, roleSource: identity.roleSource }
    );
    res.status(201).json(item);
  });

  app.post('/api/projects/:id/approvals/:apvId/decide', (req, res) => {
    const identity = requireHuman(req, res);
    if (!identity) return;

    if (
      req.body.approver ||
      req.body.role ||
      req.body.reviewerName ||
      req.body.reviewerRole ||
      req.body.authorizedRole ||
      req.body.actorType === 'AGENT'
    ) {
      return res.status(403).json({
        error: 'Identity and role claims are not accepted; the server uses your authenticated session',
      });
    }

    const { decision, humanConfirmed, comment } = req.body;
    if (humanConfirmed !== true) {
      return res.status(403).json({ error: 'Explicit human confirmation required' });
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(422).json({ error: 'Invalid decision; must be APPROVED or REJECTED' });
    }

    if (decision === 'REJECTED' && (!comment || !String(comment).trim())) {
      return res.status(422).json({ error: 'A meaningful rejection comment is required' });
    }

    const item = (store.approvals[req.params.id] || []).find((a: any) => a.id === req.params.apvId);
    if (!item) return res.status(404).json({ error: 'Approval request not found' });

    // Validate approval policy version
    if (item.policyVersion !== 'LOCAL_SESSION_V1') {
      return res.status(409).json({ error: 'Historical or unsupported approval policy; request fresh authenticated sign-off' });
    }

    // Validate canonical required roles policy
    if (
      !Array.isArray(item.requiredRoles) ||
      item.requiredRoles.length !== roles.length ||
      item.requiredRoles[0] !== roles[0] ||
      item.requiredRoles[1] !== roles[1]
    ) {
      return res.status(409).json({ error: 'Invalid requiredRoles policy; request fresh authenticated sign-off' });
    }

    // Validate target digest metadata (strict 64-char lowercase hex SHA-256)
    if (typeof item.targetDigest !== 'string' || !/^[a-f0-9]{64}$/.test(item.targetDigest)) {
      return res.status(409).json({ error: 'Invalid or malformed targetDigest; request fresh authenticated sign-off' });
    }

    if (
      item.postRatificationDigest !== undefined &&
      (typeof item.postRatificationDigest !== 'string' || !/^[a-f0-9]{64}$/.test(item.postRatificationDigest))
    ) {
      return res.status(409).json({ error: 'Invalid or malformed postRatificationDigest; request fresh authenticated sign-off' });
    }

    if (item.status !== 'PENDING') {
      return res.status(409).json({ error: 'Request is no longer pending' });
    }

    // Validate stored approvalsCollected structure
    if (!Array.isArray(item.approvalsCollected)) {
      return res.status(409).json({
        error: 'Malformed stored approval record: approvalsCollected must be an array; request fresh authenticated sign-off',
      });
    }

    for (const sig of item.approvalsCollected) {
      if (!sig || typeof sig !== 'object' || Array.isArray(sig)) {
        return res.status(409).json({
          error: 'Malformed stored signature record; request fresh authenticated sign-off',
        });
      }
      if (typeof sig.decision !== 'string' || !['APPROVED', 'REJECTED'].includes(sig.decision)) {
        return res.status(409).json({
          error: 'Malformed stored signature: invalid or missing decision; request fresh authenticated sign-off',
        });
      }
      if (typeof sig.role !== 'string' || !sig.role.trim()) {
        return res.status(409).json({
          error: 'Malformed stored signature: invalid or missing role; request fresh authenticated sign-off',
        });
      }
      if (sig.identityId !== undefined && (typeof sig.identityId !== 'string' || !sig.identityId.trim())) {
        return res.status(409).json({
          error: 'Malformed stored signature: invalid identityId; request fresh authenticated sign-off',
        });
      }
      if (sig.roleSource !== undefined && typeof sig.roleSource !== 'string') {
        return res.status(409).json({
          error: 'Malformed stored signature: invalid roleSource; request fresh authenticated sign-off',
        });
      }
    }

    const alreadySigned = item.approvalsCollected.some((a: any) => a.identityId === identity.id);
    if (alreadySigned) {
      return res.status(409).json({
        error: 'Reviewer has already signed this approval request; distinct human identities required for quorum',
      });
    }

    const alreadySatisfiedRoles = item.approvalsCollected
      .filter((a: any) => a.decision === 'APPROVED')
      .map((a: any) => a.role);
    const assignedRole = decision === 'REJECTED'
      ? (roles.find((r: string) => !alreadySatisfiedRoles.includes(r) && identity.roles.includes(r)) || roles.find((r: string) => identity.roles.includes(r)))
      : roles.find((r: string) => !alreadySatisfiedRoles.includes(r) && identity.roles.includes(r));

    if (!assignedRole) {
      return res.status(403).json({ error: decision === 'REJECTED' ? 'Identity does not possess an authorized governance role' : 'Identity does not possess an unsatisfied required role' });
    }

    const collection = mapping[item.targetEntityType]?.[0];
    const target = collection ? (store[collection]?.[req.params.id] || []).find((a: any) => a.id === item.targetEntityId) : null;
    if (!target) return res.status(404).json({ error: 'Target entity not found' });

    // Revalidate Security Override eligibility at decision time
    if (item.targetEntityType === 'OVERRIDE') {
      const ovrCheck = validateOverrideEligibility(target);
      if (!ovrCheck.valid) {
        return res.status(ovrCheck.status).json({ error: ovrCheck.error });
      }
    }

    if (digest(target) !== item.targetDigest) {
      return res.status(409).json({ error: 'Target changed; request fresh sign-off' });
    }

    const approver = identity.name;
    const newSignature = {
      role: assignedRole,
      approver,
      identityId: identity.id,
      roleSource: identity.roleSource,
      decision,
      timestamp: new Date().toISOString(),
      comment: comment || '',
    };

    item.approvalsCollected.push(newSignature);

    if (decision === 'REJECTED') {
      item.status = 'REJECTED';
      item.resolvedAt = new Date().toISOString();
      item.resolvedBy = approver;
    } else {
      const quorum = evaluateQuorum(item, digest(target));
      if (quorum.hasQuorum) {
        item.status = 'APPROVED';
        item.resolvedAt = new Date().toISOString();
        item.resolvedBy = approver;

        if (item.targetEntityType === 'REQUIREMENT') {
          target.status = 'APPROVED';
        } else if (item.targetEntityType === 'ADR') {
          target.status = 'ACCEPTED';
        } else if (item.targetEntityType === 'OVERRIDE') {
          target.status = 'APPROVED';
          target.authorizedBy = item.id;
        }
        item.postRatificationDigest = digest(target);
      }
    }

    const p = store.projects.find((p: any) => p.id === req.params.id);
    if (p) p.stateVersion++;

    store.addAuditEvent(
      req.params.id,
      approver,
      'GOVERNANCE_SIGNATURE',
      item.id,
      decision,
      {
        role: assignedRole,
        authenticatedIdentity: identity.id,
        roleSource: identity.roleSource,
        comment: comment || '',
        status: item.status,
      }
    );

    res.json(item);
  });

  return { requireHuman };
}
