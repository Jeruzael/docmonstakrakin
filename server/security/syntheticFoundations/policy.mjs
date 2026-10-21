export const SYNTHETIC_ACTIONS = Object.freeze(['synthetic:read', 'synthetic:write', 'synthetic:human-approve']);

/** Only worker-resolved current records may be supplied by the store boundary. */
export function evaluateSyntheticPolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {allowed: false, reason: 'AUTHORITY_UNAVAILABLE'};
  const {principal, action, resourceExists, effects, authorityCurrent} = input;
  if (authorityCurrent !== true) return {allowed: false, reason: 'AUTHORITY_UNAVAILABLE'};
  if (!principal || principal.disabled || typeof principal.principalId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(principal.principalId) || !['HUMAN', 'AGENT'].includes(principal.kind)) return {allowed: false, reason: 'PRINCIPAL_UNAVAILABLE'};
  if (!SYNTHETIC_ACTIONS.includes(action)) return {allowed: false, reason: 'ACTION_UNREGISTERED'};
  if (resourceExists !== true) return {allowed: false, reason: 'RESOURCE_UNREGISTERED'};
  if (!Array.isArray(effects) || effects.length > 2 || effects.some(effect => !['ALLOW', 'DENY'].includes(effect))) return {allowed: false, reason: 'POLICY_INVALID'};
  if (action === 'synthetic:human-approve' && principal.kind !== 'HUMAN') return {allowed: false, reason: 'HUMAN_REQUIRED'};
  if (effects.includes('DENY')) return {allowed: false, reason: 'EXPLICIT_DENY'};
  return effects.includes('ALLOW') ? {allowed: true, reason: 'EXPLICIT_ALLOW'} : {allowed: false, reason: 'NO_GRANT'};
}
