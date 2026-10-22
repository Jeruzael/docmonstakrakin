import React,{useEffect,useRef,useState} from 'react';
import {DashboardView,type DashboardViewProps} from './DashboardView';
import {requestProjectReadiness} from './ProjectReadinessSetup';
import type {ProjectReadinessResponse} from '../releaseScopeTypes';

/** Observations never mutate project state; scope/version/session changes mask old data immediately. */
export function ScopedDashboardView(props:DashboardViewProps & {sessionRevision:number;canInspect:boolean}) {
  const key=JSON.stringify([props.project.id,props.project.stateVersion,props.sessionRevision,props.canInspect]);
  const current=useRef(key);current.current=key;
  const [observation,setObservation]=useState<{key:string;data:ProjectReadinessResponse}|null>(null);
  const [retry,setRetry]=useState(0);
  const [error,setError]=useState('');
  useEffect(()=>{
    let mounted=true;const controller=new AbortController();
    setError('');setObservation(null);
    if(props.canInspect && props.project.id!=='PRJ-DOCMONSTAKRAKIN'){
      void requestProjectReadiness(`/api/projects/${encodeURIComponent(props.project.id)}/readiness`,controller).then(data=>{
          if(!mounted || current.current!==key)return;
          if(data.projectId!==props.project.id || data.stateVersion!==props.project.stateVersion)throw new Error('Snapshot differs');
          setObservation({key,data});
        }).catch(()=>{if(mounted && current.current===key)setError('Scoped evidence is unavailable. Sign in as a configured reviewer, or reload the current project before retrying.');});
    }
    return ()=>{mounted=false;controller.abort();};
  },[key,retry]);
  const summary=observation?.key===key?observation.data.summary:undefined;
  return <><DashboardView {...props} releaseHealth={summary}/>{error && <p role="status" className="mt-3 text-xs text-slate-600">{error} <button className="underline" onClick={()=>setRetry(value=>value+1)}>Retry scoped evidence</button></p>}</>;
}
