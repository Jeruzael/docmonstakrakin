/** Synthetic-only contracts. None of these identities convey product authority. */
export type PrincipalKind = 'HUMAN' | 'AGENT';
export type SyntheticAction = 'synthetic:read' | 'synthetic:write' | 'synthetic:human-approve';
export type Decision = {allowed: boolean; reason: string};
export type SessionPrincipal = {principalId: string; kind: PrincipalKind; issuedAt: number; lastSeenAt: number; credentialRevision: number; policyRevision: number; generation: number};
export type StoreCommand =
  | {command: 'info' | 'snapshot' | 'audit' | 'checkpoint'}
  | {command: 'createPrincipal'; id: string; kind: PrincipalKind; verifier?: string}
  | {command: 'getCredential' | 'disablePrincipal'; principalId: string}
  | {command: 'resetCredential'; principalId: string; verifier: string}
  | {command: 'recordAuthFailure'; now: number}
  | {command: 'changeOwnCredential'; digest: string; verifier: string; expectedCredentialRevision: number; now: number}
  | {command: 'prepareTestTransfer'; transferDigest: string; now: number}
  | {command: 'registerResource'; id: string}
  | {command: 'resourceExists'; id: string}
  | {command: 'setRule'; principalId: string; action: SyntheticAction; resourceId: string; effect: 'ALLOW' | 'DENY'}
  | {command: 'issueSession'; principalId: string; digest: string; now: number; expectedCredentialRevision?: number; expectedGeneration?: number}
  | {command: 'acceptSession' | 'revokeSession'; digest: string; now: number}
  | {command: 'rotateSession'; digest: string; replacementDigest: string; now: number}
  | {command: 'authorize'; digest: string; action: string; resourceId: string; now: number};

export class SyntheticSecurityError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'SyntheticSecurityError'; }
}
