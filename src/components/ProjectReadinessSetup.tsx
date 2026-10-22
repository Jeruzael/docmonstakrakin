import React, {useEffect, useRef, useState} from 'react';
import type {ProjectReadinessRequest, ProjectReadinessResponse, ReadinessProject, ReleaseScopeInput} from '../releaseScopeTypes';
import {isReleaseScopeContext, readinessCommit, readinessText, READINESS_WORK_STATUSES} from '../data/releaseHealthProjection';

type Props = {project: ReadinessProject; onChanged: (projectId: string, stateVersion: number) => void | Promise<void>; sessionRevision?: number; canEdit?: boolean};
type Draft = {maturity: string; sourceControl: string; workItemIds: string[]; commitSha: string; buildRevision: string; environment: string};
const emptyDraft = (): Draft => ({maturity: '', sourceControl: '', workItemIds: [], commitSha: '', buildRevision: '', environment: ''});
const maturities = ['GREENFIELD', 'EXISTING_PROJECT', 'MIGRATION', 'EXTENSION'];
class ReadinessResponseError extends Error {constructor(readonly status: number) {super('Unsuccessful readiness response');}}

export async function decodeProjectReadinessResponse(response: Response): Promise<ProjectReadinessResponse> {
  if (!response.ok) throw new ReadinessResponseError(response.status);
  const body = await response.json() as ProjectReadinessResponse;
  if (!body || typeof body !== 'object' || !readinessText(body.projectId) || !Number.isSafeInteger(body.stateVersion) || body.stateVersion < 0 ||
    typeof body.targetRelease !== 'string' || !(body.maturity === null || maturities.includes(String(body.maturity))) ||
    !(body.sourceControl === null || readinessText(body.sourceControl)) || !(body.readinessContext === null || isReleaseScopeContext(body.readinessContext)) ||
    !Array.isArray(body.workItems) || body.workItems.some(item => !item || !readinessText(item.id, 128) || typeof item.title !== 'string' || !READINESS_WORK_STATUSES.includes(item.status)) ||
    new Set(body.workItems.map(item => item.id)).size !== body.workItems.length) throw new Error('Invalid readiness response');
  const summary = body.summary;
  if (!summary || summary.version !== 'LOCAL_RELEASE_HEALTH/1' || !['Unavailable', 'Local evidence pending', 'Local evidence reviewed'].includes(summary.status) ||
    !(summary.scope === null || (isReleaseScopeContext(summary.scope) && summary.scope.count === summary.scope.workItemIds.length)) ||
    !summary.lifecycle || !['Available', 'Unavailable'].includes(summary.lifecycle.status) ||
    READINESS_WORK_STATUSES.some(status => !Number.isSafeInteger(summary.lifecycle.counts?.[status]) || summary.lifecycle.counts[status] < 0) ||
    !summary.localEvidence || !['Available', 'Unavailable'].includes(summary.localEvidence.status) ||
    !Number.isSafeInteger(summary.localEvidence.reviewedCount) || summary.localEvidence.reviewedCount < 0 ||
    !(summary.localEvidence.percentage === null || (Number.isSafeInteger(summary.localEvidence.percentage) && summary.localEvidence.percentage >= 0 && summary.localEvidence.percentage <= 100)) ||
    summary.localEvidence.trust !== 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION' ||
    summary.securityAssurance?.status !== 'Unavailable' || summary.productionRelease?.status !== 'Unavailable') throw new Error('Invalid readiness summary');
  const scope = summary.scope, local = summary.localEvidence;
  if([summary.reason,summary.lifecycle.source,local.formula,local.reason,summary.securityAssurance.reason,summary.productionRelease.reason].some(value=>typeof value!=='string'||value.length>4000))throw new Error('Invalid readiness explanatory text');
  if (local.total !== (scope?.count ?? null) || !Array.isArray(local.reviewedWorkItemIds) ||
    local.reviewedWorkItemIds.some(id => !scope?.workItemIds.includes(id)) || new Set(local.reviewedWorkItemIds).size !== local.reviewedWorkItemIds.length ||
    local.reviewedCount !== local.reviewedWorkItemIds.length ||
    (scope && (!body.readinessContext || scope.targetRelease !== body.targetRelease ||
      JSON.stringify({...scope, count: undefined}) !== JSON.stringify({...body.readinessContext, count: undefined}))) ||
    (summary.lifecycle.status === 'Available' && (!scope || Object.values(summary.lifecycle.counts).reduce((sum, count) => sum + count, 0) !== scope.count))) throw new Error('Inconsistent readiness summary');
  if(summary.lifecycle.status==='Available' && scope){
    const counts=Object.fromEntries(READINESS_WORK_STATUSES.map(status=>[status,0]));
    for(const id of scope.workItemIds){const matches=body.workItems.filter(item=>item.id===id);if(matches.length!==1)throw new Error('Scoped work is missing');counts[matches[0].status]++;}
    if(READINESS_WORK_STATUSES.some(status=>counts[status]!==summary.lifecycle.counts[status]))throw new Error('Scoped lifecycle counts disagree with work data');
  }
  if (local.status === 'Available'
    ? !scope || summary.lifecycle.status !== 'Available' || local.percentage !== Math.round(100 * local.reviewedCount / scope.count) ||
      summary.status !== (local.reviewedCount === scope.count ? 'Local evidence reviewed' : 'Local evidence pending')
    : local.percentage !== null || local.reviewedCount !== 0 || summary.status !== 'Unavailable') throw new Error('Inconsistent local review summary');
  return body;
}

export async function requestProjectReadiness(url: string, controller: AbortController, init: RequestInit = {}): Promise<ProjectReadinessResponse> {
  let abort!: () => void;
  const interrupted = new Promise<never>((_, reject) => {abort = () => reject(new Error('Readiness request interrupted')); controller.signal.addEventListener('abort', abort, {once: true}); if (controller.signal.aborted) abort();});
  const deadline = setTimeout(() => controller.abort(), 20_000);
  try {return await Promise.race([fetch(url, {...init, credentials: 'same-origin', signal: controller.signal}).then(decodeProjectReadinessResponse), interrupted]);}
  finally {clearTimeout(deadline); controller.signal.removeEventListener('abort', abort);}
}

/** Local planning context editor. Every read and write remains authorized by the server. */
export function ProjectReadinessSetup({project, onChanged, sessionRevision = 0, canEdit = true}: Props) {
  const scopeKey = JSON.stringify([project.id, project.stateVersion, sessionRevision, canEdit]);
  const [observation, setObservation] = useState<ProjectReadinessResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState<'load' | 'save' | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stateKey, setStateKey] = useState(scopeKey);
  const mounted = useRef(false), generation = useRef(0), busy = useRef(false), active = useRef<AbortController | null>(null);
  const currentKey = useRef(scopeKey); currentKey.current = scopeKey;
  const notify = useRef(onChanged); notify.current = onChanged;
  const current = (operation: {generation: number; key: string}) => mounted.current && operation.generation === generation.current && operation.key === currentKey.current;
  const url = `/api/projects/${encodeURIComponent(project.id)}/readiness`;
  function begin(kind: 'load' | 'save') {
    if (!mounted.current || busy.current || !canEdit) return null;
    busy.current = true;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const operation = {generation: ++generation.current, key: scopeKey, controller};
    setPending(kind); setError(''); setMessage(''); return operation;
  }
  function finish(operation: {generation: number; key: string}) {if (current(operation)) {busy.current = false; active.current = null; setPending(null);}}
  function accept(body: ProjectReadinessResponse) {
    setObservation(body);
    setDraft({maturity: body.maturity || '', sourceControl: body.sourceControl || '', workItemIds: [...(body.readinessContext?.workItemIds || [])],
      commitSha: body.readinessContext?.commitSha || '', buildRevision: body.readinessContext?.buildRevision || '', environment: body.readinessContext?.environment || ''});
    setNeedsReload(false);
  }
  async function load() {
    const operation = begin('load'); if (!operation) return;
    try {const body = await requestProjectReadiness(url, operation.controller); if (!current(operation)) return; if (body.projectId !== project.id) throw new Error('Wrong project response'); accept(body);}
    catch (cause) {
      if (!current(operation)) return;
      setNeedsReload(true);
      setError(cause instanceof ReadinessResponseError && [401, 403].includes(cause.status)
        ? 'Sign in as a configured human Security Officer or Lead Architect, then Reload readiness.'
        : 'Readiness could not be confirmed. Check the server connection, then Reload readiness.');
    } finally {finish(operation);}
  }
  useEffect(() => {
    mounted.current = true; ++generation.current; active.current?.abort(); busy.current = false;
    setStateKey(scopeKey); setObservation(null); setDraft(emptyDraft()); setNeedsReload(false); setError(''); setMessage(''); setPending(null);
    if (canEdit) void load();
    return () => {mounted.current = false; ++generation.current; active.current?.abort();};
  }, [project.id, project.stateVersion, sessionRevision, canEdit]);

  async function save(includeScope: boolean) {
    if (!observation || observation.projectId !== project.id || needsReload || !canEdit || busy.current) return;
    if (!maturities.includes(draft.maturity) || !readinessText(draft.sourceControl)) {setError('Select project maturity and enter the target source-control selection.'); return;}
    let scope: ReleaseScopeInput | undefined;
    if (includeScope) {
      if (!draft.workItemIds.length || new Set(draft.workItemIds).size !== draft.workItemIds.length ||
        draft.workItemIds.some(id => !observation.workItems.some(item => item.id === id)) ||
        !readinessCommit(draft.commitSha) || !readinessText(draft.buildRevision) || !readinessText(draft.environment)) {
        setError('Select current-release work and enter an exact full lowercase commit SHA, build revision and environment.'); return;
      }
      scope = {targetRelease: observation.targetRelease, workItemIds: [...draft.workItemIds], commitSha: draft.commitSha, buildRevision: draft.buildRevision, environment: draft.environment};
    }
    const operation = begin('save'); if (!operation) return;
    const body: ProjectReadinessRequest = {expectedStateVersion: observation.stateVersion, maturity: draft.maturity as ProjectReadinessRequest['maturity'], sourceControl: draft.sourceControl, ...(scope ? {scope} : {})};
    try {
      const saved = await requestProjectReadiness(url, operation.controller, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      if (!current(operation)) return;
      if (saved.projectId !== project.id || saved.stateVersion !== observation.stateVersion + 1 || saved.targetRelease !== observation.targetRelease || saved.maturity !== draft.maturity || saved.sourceControl !== draft.sourceControl ||
        (scope && (!saved.readinessContext || JSON.stringify(saved.readinessContext.workItemIds) !== JSON.stringify(scope.workItemIds) || saved.readinessContext.targetRelease !== scope.targetRelease ||
          saved.readinessContext.commitSha !== scope.commitSha || saved.readinessContext.buildRevision !== scope.buildRevision || saved.readinessContext.environment !== scope.environment))) throw new Error('Invalid save acknowledgement');
      accept(saved);
      setMessage('Planning context saved. No approval or release authority was granted. Reload readiness to evaluate current local evidence.');
      // A parent refresh failure does not erase the confirmed persistence acknowledgement.
      try {void Promise.resolve(notify.current(project.id, saved.stateVersion)).catch(() => {if (current(operation)) setError('Planning context was saved, but the project view could not refresh. Reload readiness.');});}
      catch {setError('Planning context was saved, but the project view could not refresh. Reload readiness.');}
    } catch (cause) {
      if (!current(operation)) return;
      if (cause instanceof ReadinessResponseError && cause.status === 422) setError('The server rejected the setup or scope. Review the selected work and exact release/build fields; your draft is retained.');
      else {
        setNeedsReload(true);
        setError(cause instanceof ReadinessResponseError && cause.status === 409
          ? 'The project changed. Reload readiness and review the current version before saving again. Your draft is retained until reload.'
          : cause instanceof ReadinessResponseError && [401, 403].includes(cause.status)
            ? 'Configured human reviewer authority is required. Sign in, then Reload readiness before saving again.'
            : 'The save outcome could not be confirmed. The server may have saved it. Reload readiness and inspect the current context before retrying; your draft is retained.');
      }
    } finally {finish(operation);}
  }
  const sameView = stateKey === scopeKey;
  const known = sameView && observation?.projectId === project.id && canEdit ? observation : null;
  const disabled = !known || pending !== null || needsReload || !canEdit;
  const change = (key: keyof Omit<Draft, 'workItemIds'>, value: string) => setDraft(previous => ({...previous, [key]: value}));
  const inputClass = 'border border-slate-300 rounded p-2 w-full text-sm disabled:bg-slate-100';
  return <section aria-label="Project readiness setup" aria-busy={canEdit && (!sameView || pending !== null)} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="font-semibold text-slate-900">Project setup and current-release scope</h2><p className="text-xs text-slate-600 mt-1">Local planning context grants no approval or release authority. No repository or provider action is performed.</p></div>
      {canEdit && <button type="button" onClick={load} disabled={pending !== null} className="underline text-sm disabled:opacity-50">Reload readiness</button>}</div>
    {!canEdit && <p>Sign in as a configured human Security Officer or Lead Architect to inspect or edit readiness setup.</p>}
    {canEdit && (!sameView || pending) && <p role="status">{!sameView || pending === 'load' ? 'Loading readiness…' : 'Saving planning context…'}</p>}
    {sameView && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {sameView && message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    {known && <>
      <div className="text-xs text-slate-700 space-y-1"><p>Target release: <strong>{known.targetRelease || 'Unavailable'}</strong> · Project state version: {known.stateVersion}</p>
        <p>Scope revision: {known.readinessContext?.revision ?? 'Not configured'} · {needsReload ? 'Readiness unavailable until reload' : known.summary.status}</p>
        {!needsReload && known.summary.scope && <><p>Scoped work ({known.summary.scope.count}): {known.summary.scope.workItemIds.join(', ')}</p><p>Commit: {known.summary.scope.commitSha} · Build: {known.summary.scope.buildRevision} · Environment: {known.summary.scope.environment}</p></>}
        {!needsReload && <><p>Stored lifecycle counts: {known.summary.lifecycle.status === 'Available' ? READINESS_WORK_STATUSES.map(status => `${status}: ${known.summary.lifecycle.counts[status]}`).join(' · ') : 'Unavailable'}</p>
          <p>Local evidence review: {known.summary.localEvidence.status === 'Available' ? `${known.summary.localEvidence.reviewedCount} / ${known.summary.localEvidence.total} scoped work items (${known.summary.localEvidence.percentage}%)` : 'Unavailable'}</p>
          <p>round(100 × locally reviewed scoped work items / scoped work items) · LOCAL_RELEASE_HEALTH/1</p></>}
        <p>Security assurance: Unavailable · Production release readiness: Unavailable. Local roster assertions and human attestations do not establish production trust.</p></div>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">Project maturity<select aria-label="Project maturity" value={draft.maturity} onChange={event => change('maturity', event.target.value)} className={inputClass}><option value="">Select maturity</option>{maturities.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label className="text-sm">Target source-control selection<input aria-label="Target source-control selection" maxLength={160} value={draft.sourceControl} onChange={event => change('sourceControl', event.target.value)} className={inputClass}/></label>
        </div>
        <button type="button" disabled={disabled} onClick={() => save(false)} className="border rounded px-3 py-2 text-sm disabled:opacity-50">Save project setup</button>
        <div className="space-y-2"><p className="text-sm font-medium">Explicit current-release work</p><p className="text-xs text-slate-600">Select only work included in {known.targetRelease}. Unselected future work is excluded from the denominator. Existing scope is preserved when saving setup alone.</p>
          {known.workItems.length ? known.workItems.map(item => <label key={item.id} className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label={`Include ${item.id} in current release`} checked={draft.workItemIds.includes(item.id)} onChange={event => setDraft(previous => ({...previous, workItemIds: event.target.checked ? [...previous.workItemIds, item.id] : previous.workItemIds.filter(id => id !== item.id)}))}/><span>{item.id} · {item.title} · {item.status}</span></label>) : <p className="text-sm">No project work is available. Save project setup now; configure release scope after creating work.</p>}</div>
        {draft.workItemIds.filter(id => !known.workItems.some(item => item.id === id)).map(id => <label key={id} className="flex items-start gap-2 text-sm text-amber-800"><input type="checkbox" aria-label={`Include ${id} in current release`} checked onChange={() => setDraft(previous => ({...previous, workItemIds: previous.workItemIds.filter(value => value !== id)}))}/><span>Unavailable scoped item: {id}. Clear this selection before saving the release scope.</span></label>)}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{(['commitSha', 'buildRevision', 'environment'] as const).map((key, index) => <label key={key} className="text-sm">{['Commit SHA', 'Build revision', 'Environment'][index]}<input aria-label={['Commit SHA', 'Build revision', 'Environment'][index]} maxLength={key === 'commitSha' ? 64 : 160} value={draft[key]} onChange={event => change(key, event.target.value)} className={inputClass}/></label>)}</div>
        <button type="button" disabled={disabled} onClick={() => save(true)} className="border rounded px-3 py-2 text-sm disabled:opacity-50">Save release scope and setup</button>
      </fieldset>
    </>}
  </section>;
}
