import React, {useEffect, useRef, useState} from 'react';
import type {ReviewerSessionInfo} from '../types';

class SessionResponseError extends Error {
  constructor(readonly status: number) {super('Unsuccessful session response');}
}

async function readIdentity(response: Response): Promise<ReviewerSessionInfo | null> {
  if (!response.ok) throw new SessionResponseError(response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'identity')) {
    throw new Error('Invalid session response');
  }
  const identity = (body as {identity: unknown}).identity;
  if (identity === null) return null;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) throw new Error('Invalid session identity');
  const {name, roles} = identity as {name?: unknown; roles?: unknown};
  if (typeof name !== 'string' || !name.trim() || !Array.isArray(roles) || roles.some(role => typeof role !== 'string')) {
    throw new Error('Invalid session identity');
  }
  return {name, roles: [...roles]};
}

async function requestIdentity(controller: AbortController, init: RequestInit = {}): Promise<ReviewerSessionInfo | null> {
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

export function ReviewerSession() {
  const [identity, setIdentity] = useState<ReviewerSessionInfo | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'unknown'>('checking');
  const [pending, setPending] = useState<'signIn' | 'signOut' | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const mutating = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const current = (request: number) => mounted.current && generation.current === request;

  useEffect(() => {
    mounted.current = true;
    const request = ++generation.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    void (async () => {
      try {
        const session = await requestIdentity(controller);
        if (!current(request)) return;
        setIdentity(session);
        setStatus('confirmed');
        if (session) {setOpen(false); setPassword('');}
      } catch {
        if (!current(request)) return;
        setStatus('unknown');
        setError('Session status could not be confirmed. You can try signing in.');
      } finally {if (current(request)) activeRequest.current = null;}
    })();
    return () => {
      mounted.current = false;
      ++generation.current;
      activeRequest.current?.abort();
    };
  }, []);

  function begin(action: 'signIn' | 'signOut'): {request: number; controller: AbortController} | null {
    // A ref closes the same-event-loop gap before disabled controls rerender.
    if (!mounted.current || mutating.current) return null;
    mutating.current = true;
    const request = ++generation.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(action);
    setError('');
    return {request, controller};
  }

  function finish(request: number) {
    if (!current(request)) return;
    mutating.current = false;
    activeRequest.current = null;
    setPending(null);
    setPassword('');
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
      if (!session) throw new Error('Missing signed-in identity');
      if (!current(request)) return;
      setIdentity(session);
      setStatus('confirmed');
      setOpen(false);
    } catch (cause) {
      if (!current(request)) return;
      // Fixed messages avoid reflecting arbitrary response text or credentials.
      let failure = 'Sign-in could not be confirmed. Please try again.';
      if (cause instanceof SessionResponseError) {
        if (cause.status === 401) failure = 'Sign-in could not be confirmed. Check your reviewer credentials.';
        if (cause.status === 403) failure = 'Sign-in could not be confirmed. The server rejected this request.';
        if (cause.status === 429) failure = 'Sign-in could not be confirmed. Too many attempts; retry in 15 minutes.';
      }
      setStatus('unknown');
      setError(failure);
    } finally {finish(request);}
  }

  async function signOut() {
    const operation = begin('signOut');
    if (operation === null) return;
    const {request, controller} = operation;
    try {
      if (await requestIdentity(controller, {method: 'DELETE'}) !== null) throw new Error('Missing signed-out confirmation');
      if (!current(request)) return;
      setIdentity(null);
      setStatus('confirmed');
      setOpen(false);
    } catch {
      if (!current(request)) return;
      // A lost reply may follow a committed logout. Preserve the last observation
      // with an uncertainty label, rather than claiming either current outcome.
      setStatus('unknown');
      setError('Sign-out could not be confirmed. Please try again.');
    } finally {finish(request);}
  }

  return <div className="px-6 py-2 border-b bg-white text-xs" aria-busy={pending !== null}>
    {identity ? <span>{status === 'unknown' ? 'Last confirmed reviewer: ' : 'Reviewer: '}<strong>{identity.name}</strong> · {identity.roles.join(', ')} <button className="underline ml-3" disabled={pending !== null} onClick={signOut}>Sign out</button></span> : <button className="underline" disabled={pending !== null} onClick={() => setOpen(!open)}>Sign in for governance review</button>}
    {open && <form onSubmit={signIn} className="flex flex-wrap gap-2 mt-2">
      <input aria-label="Reviewer username" placeholder="Reviewer username" required disabled={pending !== null} value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" className="border p-2 rounded"/>
      <input aria-label="Reviewer password" placeholder="Password" type="password" required disabled={pending !== null} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" className="border p-2 rounded"/>
      <button className="border p-2 rounded" type="submit" disabled={pending !== null}>Sign in</button>
    </form>}
    {(pending || status === 'checking') && <p role="status">{pending === 'signIn' ? 'Signing in…' : pending === 'signOut' ? 'Signing out…' : 'Checking reviewer session…'}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
