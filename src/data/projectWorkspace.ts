import type {Project,Question,Requirement,Risk,WorkItem,Evidence,AuditEvent,RecommendedNextAction,ADR,ArchitectureComponent,ApprovalItem,Feature,StandardControl,Threat} from '../types';

export interface ProjectSnapshot {
  project:Project;
  questions:Question[];
  requirements:Requirement[];
  risks:Risk[];
  workItems:WorkItem[];
  evidence:Evidence[];
  audit:AuditEvent[];
  nextAction:RecommendedNextAction;
  adrs:ADR[];
  components:ArchitectureComponent[];
  approvals:ApprovalItem[];
  features:Feature[];
  standards:StandardControl[];
  threats:Threat[];
}
const resources = {project:'',questions:'/questions',requirements:'/requirements',risks:'/risks',workItems:'/work-items',evidence:'/evidence',audit:'/audit',nextAction:'/next-action',adrs:'/adrs',components:'/components',approvals:'/approvals',features:'/features',standards:'/standards',threats:'/threats'} as const;

export async function readProjectList(request:typeof fetch=fetch):Promise<Project[]> {
  const response=await request('/api/projects',{method:'GET',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Cannot load the project list. Retry when the server is available.');
  const projects=await response.json();
  if(!Array.isArray(projects) || projects.some(p=>!p || typeof p.id!=='string' || !p.id || typeof p.name!=='string') || new Set(projects.map(p=>p.id)).size!==projects.length)throw new Error('The server returned an invalid project list.');
  return projects;
}

export function projectContentReady(selectedId:string,project:Project|null,loading:boolean,error:string):boolean {
  return Boolean(selectedId && project?.id===selectedId && !loading && !error);
}

/** Request coordination only: App remains the sole owner of active-project selection. */
export function createProjectLoader(request:typeof fetch=fetch) {
  let sequence=0;
  let controller:AbortController|undefined;
  const invalidate=()=>{sequence++;controller?.abort();};
  return {
    invalidate,
    async load(projectId:string,isSelected:()=>boolean,callbacks:{onStart:()=>void;onCommit:(value:ProjectSnapshot)=>void;onError:(message:string)=>void}) {
      // An old mutation callback may finish after selection changes. It must not supersede a new load.
      if(!projectId || !isSelected())return;
      invalidate();const current=sequence;controller=new AbortController();const signal=controller.signal;
      const controllerForRequest=controller;
      const timeout=setTimeout(()=>controllerForRequest.abort(),20000);
      callbacks.onStart();
      try {
        const entries=await Promise.all(Object.entries(resources).map(async([key,suffix])=>{
          const response=await request(`/api/projects/${encodeURIComponent(projectId)}${suffix}`,{method:'GET',signal});
          if(!response.ok)throw new Error(`Cannot load selected project ${projectId}${suffix}. Retry or select another project.`);
          const value=await response.json();
          if(key==='project' ? !value || value.id!==projectId : key==='nextAction' ? !value || typeof value!=='object' || Array.isArray(value) : !Array.isArray(value))throw new Error(`Invalid ${key} response for selected project ${projectId}.`);
          return [key,value];
        }));
        if(current===sequence && isSelected())callbacks.onCommit(Object.fromEntries(entries) as unknown as ProjectSnapshot);
      } catch(error) {
        controllerForRequest.abort();
        if(current===sequence && isSelected())callbacks.onError(signal.aborted && error instanceof Error && error.name==='AbortError' ? 'Project loading timed out. Retry or select another project.' : error instanceof Error?error.message:'Cannot load selected project.');
      } finally {clearTimeout(timeout);}
    },
  };
}
