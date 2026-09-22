import React from 'react';
import {FolderKanban,Plus,ArrowRight,CheckCircle2} from 'lucide-react';
import type {Project} from '../types';

interface ProjectsViewProps {
  projects:Project[];
  activeProjectId:string;
  loading:boolean;
  error:string;
  onSelectProject:(id:string)=>void;
  onCreateProject:()=>void;
  onRetry:()=>void;
}
const button='inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors';

/** A projection of the canonical list. Selection and loading belong to App. */
export function ProjectsView({projects,activeProjectId,loading,error,onSelectProject,onCreateProject,onRetry}:ProjectsViewProps) {
  return <section className="space-y-6" aria-label="Projects workspace" aria-busy={loading}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-bold tracking-tight text-slate-900">Projects</h1><p className="mt-1 text-sm text-slate-500">Browse your projects and open their requirements, work and evidence.</p></div>
      <button className={`${button} bg-white text-emerald-700`} onClick={onCreateProject}><Plus className="w-4 h-4"/>New Project</button>
    </div>
    {loading && <p role="status" className="text-sm text-slate-600">Loading projects…</p>}
    {error && <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800"><p>{error}</p><button className={`${button} mt-3 bg-white`} onClick={onRetry}>Retry</button></div>}
    {!loading && !error && projects.length===0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4"><FolderKanban className="w-8 h-8 text-emerald-600 mx-auto"/><h2 className="text-base font-bold">No projects yet</h2><p className="text-sm text-slate-500">Create a project to begin building its baseline.</p><button className={`${button} text-emerald-700`} onClick={onCreateProject}>Create New Project</button></div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {projects.map(project=>{
        const active=project.id===activeProjectId;
        const metadata=[['Lifecycle',project.lifecyclePhase],['Owner',project.owner],['Target release',project.targetRelease],['Delivery method',project.deliveryMethod],['Data sensitivity',project.dataSensitivity],['State version',project.stateVersion],['Repository',project.repoStatus],['Created',project.createdAt],['Updated',project.updatedAt]].filter(([,value])=>value!==undefined && value!==null && value!=='');
        return <article key={project.id} aria-label={project.name} className={`bg-white rounded-xl border p-5 shadow-2xs space-y-4 ${active?'border-emerald-300 ring-1 ring-emerald-100':'border-slate-200'}`}>
          <div className="flex flex-wrap justify-between items-start gap-3"><div className="min-w-0"><h2 className="font-bold text-slate-900 break-words">{project.name}</h2><p className="font-mono text-xs text-slate-500 break-all mt-1">{project.id}</p></div>{active && <span className="inline-flex gap-1 items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800"><CheckCircle2 className="w-3.5 h-3.5"/>Active project</span>}</div>
          {project.description && <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{project.description}</p>}
          <div className="flex flex-wrap gap-2">{[...(project.profiles||[]),...(project.specializedProfiles||[])].map(profile=><span key={profile} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">{profile}</span>)}</div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 text-xs">{metadata.map(([label,value])=><div key={label}><dt className="text-slate-400">{label}</dt><dd className="text-slate-700 break-words mt-1">{value}</dd></div>)}</dl>
          {(typeof project.healthScore==='number' || typeof project.progress?.requirementsReadiness==='number') && <div className="flex flex-wrap gap-4 text-xs text-slate-600">{typeof project.healthScore==='number' && <span>Health: {project.healthScore}%</span>}{typeof project.progress?.requirementsReadiness==='number' && <span>Requirements readiness: {project.progress.requirementsReadiness}%</span>}</div>}
          <div className="pt-3 border-t border-slate-100"><button className={`${button} text-emerald-700`} onClick={()=>onSelectProject(project.id)}>Open Project<ArrowRight className="w-3.5 h-3.5"/></button></div>
        </article>;
      })}
    </div>
  </section>;
}
