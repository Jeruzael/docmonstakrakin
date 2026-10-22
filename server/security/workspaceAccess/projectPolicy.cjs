'use strict';
// Metadata and enforcement share this exact existing project rule. This helper
// neither acquires identity nor grants membership; the worker supplies current
// server-owned principal, membership and existing-resource records.
const PROJECT_ACTIONS = Object.freeze(['project:read', 'project:write', 'project:review', 'project:export', 'project:import']);
const HUMAN_ROLES = Object.freeze(['Security Officer', 'Lead Architect']);
const SELF_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';
function evaluateProjectAction(principal, membership, action, projectId) {
  const deny = reason => ({ allowed: false, reason });
  if (!principal || principal.kind !== 'HUMAN' || principal.disabled !== false) return deny('SESSION_INVALID');
  if (!PROJECT_ACTIONS.includes(action)) return deny('UNSUPPORTED_ACTION');
  if (typeof projectId !== 'string' || !projectId) return deny('RESOURCE_UNAVAILABLE');
  if (!membership) return deny('MEMBERSHIP_REQUIRED');
  if (!['OWNER', 'EDITOR', 'READER', 'DENY'].includes(membership.role) || !Array.isArray(membership.deniedActions) ||
    membership.deniedActions.some(a => ![...PROJECT_ACTIONS, 'project:create'].includes(a))) return deny('ACTION_DENIED');
  if (membership.role === 'DENY' || membership.deniedActions.includes(action)) return deny('EXPLICIT_DENY');
  if (projectId === SELF_PROJECT_ID && !['project:read', 'project:export'].includes(action)) return deny('CANONICAL_PROJECT_READ_ONLY');
  const allowed = action === 'project:read' || action === 'project:export' && (membership.role !== 'READER' || projectId === SELF_PROJECT_ID) ||
    action === 'project:write' && ['EDITOR', 'OWNER'].includes(membership.role) ||
    action === 'project:review' && ['EDITOR', 'OWNER'].includes(membership.role) && Array.isArray(principal.roles) && principal.roles.some(r => HUMAN_ROLES.includes(r)) ||
    action === 'project:import' && membership.role === 'OWNER';
  return { allowed, reason: allowed ? 'ALLOWED' : 'ACTION_DENIED' };
}
function allowedProjectActions(principal, membership, projectId) {
  return PROJECT_ACTIONS.filter(action => evaluateProjectAction(principal, membership, action, projectId).allowed);
}
module.exports = { PROJECT_ACTIONS, HUMAN_ROLES, SELF_PROJECT_ID, evaluateProjectAction, allowedProjectActions };
