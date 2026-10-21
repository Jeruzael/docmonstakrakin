import {createHash, randomBytes} from 'node:crypto';
import type {PrivateSyntheticStore} from './privateStore.ts';
import type {SessionPrincipal} from './contracts.ts';

export function sessionDigest(token: unknown): string | null {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const decoded = Buffer.from(token, 'base64url');
  if (decoded.length !== 32 || decoded.toString('base64url') !== token) return null;
  return createHash('sha256').update(token).digest('hex');
}
export class SyntheticSessions {
  constructor(private readonly store: PrivateSyntheticStore, private readonly clock: () => number) {}
  async issue(principalId: string, fence?: {credentialRevision: number; generation: number}): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.execute({command: 'issueSession', principalId, digest: sessionDigest(token)!, now: this.clock(), ...(fence ? {expectedCredentialRevision: fence.credentialRevision, expectedGeneration: fence.generation} : {})});
    return token;
  }
  async accept(token: unknown): Promise<SessionPrincipal | null> {
    const digest = sessionDigest(token); if (!digest) return null;
    try { return await this.store.execute({command: 'acceptSession', digest, now: this.clock()}); }
    catch { return null; }
  }
  async rotate(token: unknown): Promise<string | null> {
    const digest = sessionDigest(token); if (!digest) return null;
    const replacement = randomBytes(32).toString('base64url');
    try { return await this.store.execute({command: 'rotateSession', digest, replacementDigest: sessionDigest(replacement)!, now: this.clock()}) ? replacement : null; }
    catch { return null; }
  }
  async revoke(token: unknown): Promise<boolean> {
    const digest = sessionDigest(token); if (!digest) return false;
    return this.store.execute({command: 'revokeSession', digest, now: this.clock()});
  }
}
