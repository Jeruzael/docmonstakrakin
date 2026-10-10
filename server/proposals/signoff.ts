import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { digest } from './review.js';
import { validateText } from '../../src/data/generationValidation.js';
import { installReviewerIdentity } from './identity.js';
import { evaluateQuorum, REQUIRED_QUORUM_ROLES, validateStoredSignatures } from './quorum.js';

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

    const activePendings = (store.approvals[p.id] || []).filter(
      (a: any) =>
        a.targetEntityType === targetEntityType &&
        a.targetEntityId === targetEntityId &&
        a.status === 'PENDING'
    );

    if (activePendings.length > 1) {
      return res.status(409).json({
        error: 'Multiple conflicting active pending approvals exist for this target; governed resolution required',
        code: 'CONFLICTING_APPROVALS',
      });
    }

    if (activePendings.length === 1) {
      const prior = activePendings[0];
      if (prior.targetDigest !== targetDigest) {
        return res.status(409).json({
          error: 'Active pending approval targetDigest does not match current canonical artifact; governed resolution required',
          code: 'TARGET_DIGEST_MISMATCH',
        });
      }

      // Authoritative pending approval integrity checks
      const isPolicyValid = prior.policyVersion === 'LOCAL_SESSION_V1';
      const isRolesValid =
        Array.isArray(prior.requiredRoles) &&
        prior.requiredRoles.length === roles.length &&
        prior.requiredRoles[0] === roles[0] &&
        prior.requiredRoles[1] === roles[1];
      const isDigestValid = typeof prior.targetDigest === 'string' && /^[a-f0-9]{64}$/.test(prior.targetDigest);
      const sigValidation = validateStoredSignatures(prior.approvalsCollected, {
        isPending: true,
        requiredRoles: roles,
      });

      if (!isPolicyValid || !isRolesValid || !isDigestValid || !sigValidation.valid || prior.supersededBy) {
        let reason = 'Stored pending approval is corrupted; governed reissue required';
        if (!isPolicyValid) reason = 'Invalid or unsupported policyVersion; requires LOCAL_SESSION_V1';
        else if (!isRolesValid) reason = "Invalid requiredRoles; policy requires exact ['Security Officer', 'Lead Architect']";
        else if (!isDigestValid) reason = 'Invalid or malformed targetDigest format';
        else if (!sigValidation.valid) reason = sigValidation.error || 'Malformed stored approval signatures';
        else if (prior.supersededBy) reason = 'Approval has been superseded';

        return res.status(409).json({
          error: 'Pending approval record is corrupted and cannot receive signatures; governed reissue required',
          code: 'REISSUE_REQUIRED',
          approvalId: prior.id,
          reason,
        });
      }

      // Case A: Healthy pending approval - deduplicate silently
      return res.status(201).json(prior);
    }

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

  app.post('/api/projects/:id/approvals/:apvId/reissue', (req, res) => {
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

    const hasAuthorizedRole = identity.roles.some((r: string) => roles.includes(r as any));
    if (!hasAuthorizedRole) {
      return res.status(403).json({ error: 'Identity lacks authorized governance role for approval reissue' });
    }

    const { humanConfirmed, justification, reason } = req.body;
    if (humanConfirmed !== true) {
      return res.status(403).json({ error: 'Explicit human confirmation required for sign-off reissue' });
    }

    const reissueReason = (justification || reason || '').trim();
    if (!reissueReason) {
      return res.status(422).json({ error: 'A meaningful recovery justification is required' });
    }

    const p = store.projects.find((pr: any) => pr.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    const item = (store.approvals[p.id] || []).find((a: any) => a.id === req.params.apvId);
    if (!item) {
      return res.status(404).json({ error: 'Approval request not found in this project' });
    }

    // Idempotent retry: if already superseded, return existing replacement
    if (item.status === 'SUPERSEDED' || item.supersededBy) {
      const existingReplacement = (store.approvals[p.id] || []).find((a: any) => a.id === item.supersededBy);
      if (existingReplacement) {
        return res.status(200).json(existingReplacement);
      }
      return res.status(409).json({ error: 'Approval request has already been superseded' });
    }

    if (item.status !== 'PENDING') {
      return res.status(409).json({ error: `Cannot reissue approval with status "${item.status}"; must be PENDING` });
    }

    const spec = mapping[item.targetEntityType];
    if (!spec) {
      return res.status(422).json({ error: `Unsupported targetEntityType: ${item.targetEntityType}` });
    }

    const target = (store[spec[0]]?.[p.id] || []).find((t: any) => t.id === item.targetEntityId);
    if (!target) {
      return res.status(404).json({ error: 'Canonical approval target no longer exists; cannot reissue approval' });
    }

    if (item.targetEntityType === 'OVERRIDE') {
      const ovrCheck = validateOverrideEligibility(target);
      if (!ovrCheck.valid) {
        return res.status(ovrCheck.status).json({ error: ovrCheck.error });
      }
    }

    const currentTargetDigest = digest(target);
    if (item.targetDigest !== currentTargetDigest) {
      return res.status(409).json({ error: 'Canonical approval target has changed; cannot reissue against stale target' });
    }

    // Verify corruption: healthy pending approvals cannot be reissued
    const isPolicyValid = item.policyVersion === 'LOCAL_SESSION_V1';
    const isRolesValid =
      Array.isArray(item.requiredRoles) &&
      item.requiredRoles.length === roles.length &&
      item.requiredRoles[0] === roles[0] &&
      item.requiredRoles[1] === roles[1];
    const isDigestValid = typeof item.targetDigest === 'string' && /^[a-f0-9]{64}$/.test(item.targetDigest);
    const sigValidation = validateStoredSignatures(item.approvalsCollected, {
      isPending: true,
      requiredRoles: roles,
    });

    const isCorrupted = !isPolicyValid || !isRolesValid || !isDigestValid || !sigValidation.valid;
    if (!isCorrupted) {
      return res.status(409).json({
        error: 'Cannot reissue a healthy pending approval; existing request is valid for sign-off',
      });
    }

    // Check no conflicting active pending request
    const conflictingActive = (store.approvals[p.id] || []).filter(
      (a: any) =>
        a.id !== item.id &&
        a.targetEntityType === item.targetEntityType &&
        a.targetEntityId === item.targetEntityId &&
        a.status === 'PENDING'
    );
    if (conflictingActive.length > 0) {
      return res.status(409).json({
        error: 'Conflicting active pending approval already exists for this target',
      });
    }

    // Perform atomic supersession transaction
    const newApprovalId = `APV-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    item.status = 'SUPERSEDED';
    item.supersededBy = newApprovalId;
    item.supersededAt = timestamp;
    item.supersededReason = reissueReason;

    const replacementItem: any = {
      id: newApprovalId,
      projectId: p.id,
      title: target.title || target.gateOrControl || item.title,
      type: item.type,
      targetEntityId: item.targetEntityId,
      targetEntityType: item.targetEntityType,
      requestedBy: identity.name,
      requestedAt: timestamp,
      status: 'PENDING',
      urgency: item.urgency || 'HIGH',
      riskLevel: item.riskLevel || 'MEDIUM',
      description: target.statement || target.context || target.description || target.reason || item.description,
      impactAnalysis: item.impactAnalysis || 'Human sign-off of canonical proposed artifact',
      requiredRoles: [...roles],
      approvalsCollected: [],
      targetDigest: currentTargetDigest,
      policyGates: [
        {
          gateName: 'Canonical target exists',
          passed: true,
          details: 'Target resolved within this project; distinct authorized humans required',
        },
      ],
      policyVersion: 'LOCAL_SESSION_V1',
      supersededApprovalId: item.id,
    };

    store.approvals[p.id].unshift(replacementItem);
    p.stateVersion++;

    store.addAuditEvent(
      p.id,
      identity.name,
      'APPROVAL_REISSUED',
      item.id,
      reissueReason,
      {
        supersededApprovalId: item.id,
        replacementApprovalId: newApprovalId,
        targetEntityId: item.targetEntityId,
        targetEntityType: item.targetEntityType,
        authenticatedIdentity: identity.id,
        roleSource: identity.roleSource,
        reason: reissueReason,
      }
    );

    res.status(201).json(replacementItem);
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

    // Validate stored approvalsCollected structure with strict canonical provenance
    const sigValidation = validateStoredSignatures(item.approvalsCollected, {
      isPending: item.status === 'PENDING',
      requiredRoles: roles,
    });
    if (!sigValidation.valid) {
      return res.status(409).json({
        error: sigValidation.error || 'Malformed or inconsistent stored approval signatures; request fresh authenticated sign-off',
      });
    }

    const alreadySigned = sigValidation.usedIdentities.includes(identity.id);
    if (alreadySigned) {
      return res.status(409).json({
        error: 'Reviewer has already signed this approval request; distinct human identities required for quorum',
      });
    }

    const alreadySatisfiedRoles = sigValidation.satisfiedRoles;
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
