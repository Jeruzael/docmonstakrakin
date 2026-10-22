import React, {useEffect, useRef, useState} from 'react';
import type {ReviewerSessionInfo} from '../types';

class SessionResponseError extends Error {
  constructor(readonly status: number) {super('Unsuccessful session response');}
}

type VerificationSetupStatus = {
  trust: 'LOCAL_ROSTER_ASSERTION';
  validHumanPersonBindings: number;
  missingHumanPersonBindings: boolean;
  ambiguousAccountIds: boolean;
  distinctPersonRoleCoverage: boolean;
  distinctSubmitterCoverage: boolean;
};
type ReviewerSetupStatus = {
  state: 'not-configured' | 'malformed' | 'configured';
  missingRoles: string[];
  distinctHumanRoleCoverage: boolean;
  verification: VerificationSetupStatus | null;
};
type SessionResult = {identity: ReviewerSessionInfo | null; setup: ReviewerSetupStatus | null};

function readSetup(value: unknown): ReviewerSetupStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const {state, missingRoles, distinctHumanRoleCoverage, verification} = value as Record<string, unknown>;
  if (typeof state !== 'string' || !['not-configured', 'malformed', 'configured'].includes(state) ||
    !Array.isArray(missingRoles) || missingRoles.some(role => !['Security Officer', 'Lead Architect'].includes(role)) ||
    typeof distinctHumanRoleCoverage !== 'boolean') return null;
  let binding: VerificationSetupStatus | null = null;
  if (verification && typeof verification === 'object' && !Array.isArray(verification)) {
    const fields = verification as Record<string, unknown>;
    if (fields.trust === 'LOCAL_ROSTER_ASSERTION' && Number.isSafeInteger(fields.validHumanPersonBindings) && Number(fields.validHumanPersonBindings) >= 0 &&
      ['missingHumanPersonBindings', 'ambiguousAccountIds', 'distinctPersonRoleCoverage', 'distinctSubmitterCoverage'].every(key => typeof fields[key] === 'boolean')) {
      binding = {trust: 'LOCAL_ROSTER_ASSERTION', validHumanPersonBindings: fields.validHumanPersonBindings as number,
        missingHumanPersonBindings: fields.missingHumanPersonBindings as boolean, ambiguousAccountIds: fields.ambiguousAccountIds as boolean,
        distinctPersonRoleCoverage: fields.distinctPersonRoleCoverage as boolean, distinctSubmitterCoverage: fields.distinctSubmitterCoverage as boolean};
    }
  }
  return {state: state as ReviewerSetupStatus['state'], missingRoles: [...missingRoles], distinctHumanRoleCoverage, verification: binding};
}

function setupGuidance(setup: ReviewerSetupStatus): string {
  if (setup.state === 'not-configured') return 'No human reviewers are configured. Ask the local operator to set DMK_HUMAN_REVIEWERS in the server environment and restart the server. Use operator-issued credentials; there are no default reviewer credentials.';
  if (setup.state === 'malformed') return 'Reviewer setup is malformed. Ask the local operator to validate DMK_HUMAN_REVIEWERS record fields and credential verifiers, then restart the server. Keep passwords and verifier values out of tickets or chat.';
  if (setup.missingRoles.length) return `Reviewer setup is missing required human roles: ${setup.missingRoles.join(', ')}. Ask the local operator to configure Security Officer and Lead Architect for distinct human reviewers, then restart the server.`;
  if (!setup.distinctHumanRoleCoverage) return 'The configured roles do not cover two distinct human reviewer IDs. Ask the local operator to configure Security Officer and Lead Architect for distinct human reviewers, then restart the server. Roster entries alone do not verify real-world human independence.';
  return 'Local reviewer role coverage is configured. Security Officer and Lead Architect approvals still require two distinct humans. Roster entries alone do not verify real-world human independence.';
}

function verificationGuidance(setup: VerificationSetupStatus | null): string {
  if (!setup) return 'Verification person binding status is unavailable. Ask the local operator to check the server setup.';
  if (setup.ambiguousAccountIds) return 'Reviewer account IDs are ambiguous. Ask the local operator to assign unique account IDs in DMK_HUMAN_REVIEWERS, preserve one personId across accounts belonging to the same person, then restart the server.';
  if (setup.missingHumanPersonBindings) return 'Verification person bindings are missing or invalid. Ask the local operator to supply a valid personId for each human account in DMK_HUMAN_REVIEWERS, then restart the server. Keep identity values and credentials out of tickets or chat.';
  if (!setup.distinctPersonRoleCoverage) return 'Verification setup needs two distinct locally asserted persons covering Security Officer and Lead Architect. Multiple accounts belonging to one person cannot count twice. Ask the local operator to check the person bindings.';
  if (!setup.distinctSubmitterCoverage) return 'Verification setup needs a third distinct locally asserted person for evidence submission, with Security Officer or Lead Architect authority. The submitter cannot approve their own evidence. Ask the local operator to check submitter and reviewer coverage.';
  return 'Configuration coverage only: evidence submission needs a distinct submitter plus Security Officer and Lead Architect reviewers; the submitter cannot approve their own evidence. The local operator must confirm real-world human identity and independence. Roster bindings are local assertions.';
}

async function readIdentity(response: Response): Promise<SessionResult> {
  if (!response.ok) throw new SessionResponseError(response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'identity')) {
    throw new Error('Invalid session response');
  }
  const identity = (body as {identity: unknown}).identity;
  const setup = readSetup((body as {setup?: unknown}).setup);
  if (identity === null) return {identity: null, setup};
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) throw new Error('Invalid session identity');
  const {name, roles} = identity as {name?: unknown; roles?: unknown};
  if (typeof name !== 'string' || !name.trim() || !Array.isArray(roles) || roles.some(role => typeof role !== 'string')) {
    throw new Error('Invalid session identity');
  }
  return {identity: {name, roles: [...roles]}, setup};
}

async function requestIdentity(controller: AbortController, init: RequestInit = {}): Promise<SessionResult> {
  let onAbort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Session request interrupted'));
    controller.signal.addEventListener('abort', onAbort, {once: true});
    if (controller.signal.aborted) onAbort();
  });
  const deadline = setTimeout(() => controller.abort(), 20_000);
  try {
    // Include body decoding in the deadline. Cancellation settles the local wait
    // even when transport ignores abort; it cannot establish the server outcome.
    return await Promise.race([
      fetch('/api/governance/session', {...init, credentials: 'same-origin', signal: controller.signal}).then(readIdentity),
      cancelled,
    ]);
  } finally {
    clearTimeout(deadline);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

interface ReviewerSessionProps {
  onSessionStateChange?: (phase: 'checking' | 'pending' | 'confirmed' | 'unknown') => void;
  checkRevision?: number;
}

export function ReviewerSession({onSessionStateChange, checkRevision = 0}: ReviewerSessionProps = {}) {
  const [identity, setIdentity] = useState<ReviewerSessionInfo | null>(null);
  const [setup, setSetup] = useState<ReviewerSetupStatus | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'unknown'>('checking');
  const [pending, setPending] = useState<'signIn' | 'signOut' | 'check' | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const mutating = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const notify = useRef(onSessionStateChange);
  notify.current = onSessionStateChange;
  const current = (request: number) => mounted.current && generation.current === request;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++generation.current;
      activeRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    // A re-check queued before a same-turn mutation must yield to that mutation.
    if (mutating.current) return;
    const request = ++generation.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus('checking');
    setError('');
    notify.current?.('checking');
    void (async () => {
      try {
        const session = await requestIdentity(controller);
        if (!current(request)) return;
        setIdentity(session.identity);
        setSetup(session.setup);
        setStatus('confirmed');
        notify.current?.('confirmed');
        if (session.identity) {setOpen(false); setPassword('');}
      } catch {
        if (!current(request)) return;
        setStatus('unknown');
        notify.current?.('unknown');
        setError('Session status could not be confirmed. Check the server connection, then use Check reviewer session before retrying credentials.');
      } finally {if (current(request)) activeRequest.current = null;}
    })();
    return () => {
      if (current(request)) {
        ++generation.current;
        controller.abort();
        activeRequest.current = null;
      }
    };
  }, [checkRevision]);

  function begin(action: 'signIn' | 'signOut' | 'check'): {request: number; controller: AbortController} | null {
    // A ref closes the same-event-loop gap before disabled controls rerender.
    if (!mounted.current || mutating.current) return null;
    mutating.current = true;
    const request = ++generation.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(action);
    setError('');
    notify.current?.('pending');
    return {request, controller};
  }

  function finish(request: number) {
    if (!current(request)) return;
    mutating.current = false;
    activeRequest.current = null;
    setPending(null);
    setPassword('');
  }

  async function checkSession() {
    const operation = begin('check');
    if (!operation) return;
    const {request, controller} = operation;
    try {
      const session = await requestIdentity(controller);
      if (!current(request)) return;
      setIdentity(session.identity);
      setSetup(session.setup);
      setStatus('confirmed');
      notify.current?.('confirmed');
      if (session.identity) setOpen(false);
    } catch {
      if (!current(request)) return;
      setStatus('unknown');
      notify.current?.('unknown');
      setError('Session status could not be confirmed. Check the server connection and use Check reviewer session again.');
    } finally {finish(request);}
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const operation = begin('signIn');
    if (operation === null) return;
    const {request, controller} = operation;
    const body = JSON.stringify({username, password});
    setPassword('');
    try {
      const session = await requestIdentity(controller, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body,
      });
      if (!session.identity) throw new Error('Missing signed-in identity');
      if (!current(request)) return;
      setIdentity(session.identity);
      setStatus('confirmed');
      notify.current?.('confirmed');
      setOpen(false);
    } catch (cause) {
      if (!current(request)) return;
      // Fixed messages avoid reflecting arbitrary response text or credentials.
      let failure = 'Sign-in could not be confirmed. The server may have accepted it. Check the server connection, then use Check reviewer session before submitting credentials again.';
      if (cause instanceof SessionResponseError) {
        if (cause.status === 401) failure = 'Sign-in could not be confirmed. Reviewer credentials were rejected. Check your operator-issued username and password; ask the local operator if access is unavailable.';
        if (cause.status === 403) failure = "Sign-in could not be confirmed. The server rejected this request. Open the app from the server's own address and try again.";
        if (cause.status === 429) failure = 'Sign-in could not be confirmed. Too many attempts; wait 15 minutes before retrying. Avoid repeated credential submissions.';
      }
      setStatus('unknown');
      notify.current?.('unknown');
      setError(failure);
    } finally {finish(request);}
  }

  async function signOut() {
    const operation = begin('signOut');
    if (operation === null) return;
    const {request, controller} = operation;
    try {
      if ((await requestIdentity(controller, {method: 'DELETE'})).identity !== null) throw new Error('Missing signed-out confirmation');
      if (!current(request)) return;
      setIdentity(null);
      setStatus('confirmed');
      notify.current?.('confirmed');
      setOpen(false);
    } catch {
      if (!current(request)) return;
      // A lost reply may follow a committed logout. Preserve the last observation
      // with an uncertainty label, rather than claiming either current outcome.
      setStatus('unknown');
      notify.current?.('unknown');
      setError('Sign-out could not be confirmed. The server may have completed it. Check the server connection, then use Check reviewer session to confirm the outcome.');
    } finally {finish(request);}
  }

  return <div className="px-6 py-2 border-b bg-white text-xs" aria-busy={pending !== null}>
    {identity ? <span>{status !== 'confirmed' ? 'Last confirmed reviewer: ' : 'Reviewer: '}<strong>{identity.name}</strong> · {identity.roles.join(', ')} <button className="underline ml-3" disabled={pending !== null} onClick={signOut}>Sign out</button></span> : <button className="underline" disabled={pending !== null} onClick={() => setOpen(!open)}>Sign in for governance review</button>}
    {open && <form onSubmit={signIn} className="flex flex-wrap gap-2 mt-2">
      <input aria-label="Reviewer username" placeholder="Reviewer username" required disabled={pending !== null} value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" className="border p-2 rounded"/>
      <input aria-label="Reviewer password" placeholder="Password" type="password" required disabled={pending !== null} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" className="border p-2 rounded"/>
      <button className="border p-2 rounded" type="submit" disabled={pending !== null}>Sign in</button>
    </form>}
    {setup && <p className="mt-2">{setupGuidance(setup)}</p>}
    {setup?.state === 'configured' && <p className="mt-2">{verificationGuidance(setup.verification)}</p>}
    {status === 'unknown' && <button className="underline ml-3" disabled={pending !== null} onClick={checkSession}>Check reviewer session</button>}
    {(pending || status === 'checking') && <p role="status">{pending === 'signIn' ? 'Signing in…' : pending === 'signOut' ? 'Signing out…' : 'Checking reviewer session…'}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
