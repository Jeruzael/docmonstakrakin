const fs=require('node:fs');
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')));}
edit('src/App.tsx',s=>{
  s=s.replace('useCallback }','useCallback, useRef }');
  s=s.replace("  // Fetch full project payload", "  const loadSequence = useRef(0);\n  const [loadError,setLoadError] = useState('');\n  // Fetch full project payload");
  const a=s.indexOf('  const fetchProjectData ='); const b=s.indexOf('  useEffect(() => {\n    fetchProjects();',a);
  s=s.slice(0,a)+`  const fetchProjectData = useCallback(async (projectId: string) => {
    const sequence = ++loadSequence.current;
    setLoadError('');
    try {
      const paths = ['', '/questions','/requirements','/risks','/work-items','/evidence','/audit','/next-action','/adrs','/components','/approvals','/features','/standards','/threats'];
      const data = await Promise.all(paths.map(async path => { const r=await fetch('/api/projects/'+projectId+path); if(!r.ok) throw new Error('Cannot load project '+path); return r.json(); }));
      if(sequence !== loadSequence.current) return;
      const [p,q,r,rk,w,ev,aud,na,adr,comp,apv,feat,std,threat] = data;
      setCurrentProject(p);setQuestions(q);setRequirements(r);setRisks(rk);setWorkItems(w);setEvidenceList(ev);setAuditLogs(aud);setNextAction(na);setAdrs(adr);setComponents(comp);setApprovals(apv);setFeatures(feat);setStandards(std);setThreats(threat);
    } catch(e) {if(sequence===loadSequence.current) setLoadError((e as Error).message);}
  }, []);

`+s.slice(b);
  const c=s.indexOf("      console.warn('Backend create failed");const d=s.indexOf('  const handleAnswerQuestion',c);
  s=s.slice(0,c)+"      throw new Error('Project creation failed. Your wizard draft is retained; retry when the server is available.');\n    }\n  };\n\n"+s.slice(d);
  s=s.replace('    setActiveProjectId(id);','    loadSequence.current++;\n    setSelectedReqId(undefined); setSelectedQuestionId(undefined); setSelectedWorkItemId(undefined);\n    setActiveProjectId(id);');
  s=s.replace("      if (res.ok) {\n        // Refresh project data", "      if (!res.ok) { const error = await res.json(); throw new Error(error.error?.message || error.error || 'Answer rejected'); }\n      if (res.ok) {\n        // Refresh project data");
  s=s.replace("      console.error('Failed to record answer:', err);", "      throw err;");
  s=s.replace('/requirements/${reqId}/status`, {\n        method: \'PATCH\'', '/requirements/${reqId}/status`, {\n        method: \'POST\'');
  s=s.replace("          {projects.length === 0 ? (", "          {loadError && <p role=\"alert\" className=\"text-red-700\">{loadError}</p>}\n          {currentProject.id !== activeProjectId ? <p>Loading selected project…</p> : projects.length === 0 ? (");
  s=s.replace("            <>\n              {currentView", "            <React.Fragment key={currentProject.id}>\n              {currentView");
  s=s.replace('            </>\n          )}', '            </React.Fragment>\n          )}');
  s=s.replace('                  requirements={requirements}\n                  onAddRequirement', '                  project={currentProject}\n                  requirements={requirements}\n                  onAddRequirement');
  s=s.replace('              workItems={workItems}\n            />\n          )}\n\n          {currentView === \'documents\'', "              workItems={workItems}\n              features={features}\n              adrs={adrs}\n              standards={standards}\n              onImported={() => fetchProjectData(currentProject.id)}\n              onNavigate={view => {setRequirementsSubTab('canonical');setCurrentView(view as NavView);}}\n            />\n          )}\n\n          {currentView === 'documents'");
  return s;
});
edit('src/components/PromptCompilerView.tsx',s=>{
  s="import { ImportReviewView } from './ImportReviewView';\n"+s;
  s=s.replace('Project, Requirement, Risk, WorkItem, ContextPackageMode','Project, Requirement, Risk, WorkItem, ContextPackageMode, Feature, ADR, StandardControl');
  s=s.replace('  project: Project;', '  features?: Feature[]; adrs?: ADR[]; standards?: StandardControl[];\n  onImported: () => void; onNavigate: (view: string) => void;\n  project: Project;');
  s=s.replace('  project,\n  requirements', '  project, features=[], adrs=[], standards=[], onImported, onNavigate,\n  requirements');
  const a=s.indexOf('  // Manual Import State'); const b=s.indexOf('  const activeWorkItem',a);s=s.slice(0,a)+s.slice(b);
  s=s.replace('  const compiledPackage = compileContextPackage({','  let compiledPackage;\n  try { compiledPackage = compileContextPackage({');
  s=s.replace('    requirements,\n    risks,','    requirements,\n    features, adrs, standards,\n    risks,');
  s=s.replace('    includeOmissionReport: true,\n  });',"    includeOmissionReport: true,\n  }); } catch(e) {compiledPackage = {compiledPrompt: 'Generation rejected: '+(e as Error).message, handoffReady:false, omissionsReport:[], tokenEstimate:0};}");
  const c=s.indexOf('  const handleValidate =');const d=s.indexOf('  return (',c);s=s.slice(0,c)+s.slice(d);
  const e=s.indexOf('      {/* 2. Manual Import Tab */}');s=s.slice(0,e)+`      {tab === 'IMPORT' && <ImportReviewView key={project.id} projectId={project.id} onImported={onImported} onNavigate={onNavigate}/>}
    </div>
  );
};
`;
  s=s.replace('            Generates role-scoped execution packages. Renders full requirement statements, technical baseline, and omission reports.', '            SUMMARY, TASK_CONTEXT and FULL_BASELINE are outbound context packages. External agents return structured proposals. Tracking changes only after validation, human review and canonical acceptance.');
  s=s.replace('                onClick={handleCopy}', '                disabled={compiledPackage.handoffReady === false}\n                onClick={handleCopy}');
  return s;
});
edit('src/components/QuestionnaireView.tsx',s=>{
  s="import { calculateDiscoveryCoverage } from '../data/derivationEngine';\n"+s;
  s=s.replace('  const resolvedCount =', '  const coverage = calculateDiscoveryCoverage(questions, project);\n  const resolvedCount =');
  s=s.replace("  }).filter((d) => d.total > 0);", '  });');
  s=s.replace('      {/* Workspace Header */}', `      <section className="bg-white border rounded p-4 overflow-x-auto"><h2 className="font-bold mb-3">Discovery domain coverage</h2><table className="w-full text-xs"><thead><tr>{['Domain','Status','Coverage','Source','Open'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{coverage.domainSummaries.map(d=><tr key={d.domain} className="border-t"><td className="p-2">{d.domain}</td><td>{d.status}</td><td>{d.coveragePercentage}%</td><td>{d.source}</td><td>{d.openItems}</td></tr>)}</tbody></table></section>
      {/* Workspace Header */}`);
  s=s.replace("onClick={() => handleSaveAnswer(activeQuestion.options?.[0]?.value || 'recommended')}", "onClick={() => handleSaveAnswer({type:'RECOMMEND_FOR_ME',decision_mode:'RECOMMEND_FOR_ME',recommendation:{status:'ACCEPTED',preferredTechnology:activeQuestion.options?.[0]?.value},finalSelection:activeQuestion.options?.[0]?.value || null,status:'NOT_RATIFIED'})}");
  s=s.replace('Accept & Ratify Recommendation','Accept Selection (Not Ratified)');
  s=s.replace("'TypeScript / Node.js 20+ with strict type checking and sandboxed container deployment.'", "'No recommendation available; leave this decision open.'");
  s=s.replace('Rationale: Provides type-safe validation, zero-drift build compatibility, and native compatibility with the running container.', 'Candidate only. Review suitability for this project; acceptance is separate from architecture ratification.');
  return s;
});
edit('src/components/RequirementsView.tsx',s=>{
  s="import { RequestSignoff } from './RequestSignoff';\n"+s;
  s=s.replace('Requirement, RiskLevel', 'Project, Requirement, RiskLevel');
  s=s.replace('interface RequirementsViewProps {', 'interface RequirementsViewProps {\n  project?: Project;');
  s=s.replace('  requirements = [],', '  project,\n  requirements = [],');
  s=s.replace('                    {req.source.type}: {req.source.id}', '                    {req.source.type}: {req.source.id}\n                    {project && req.status === \'PROPOSED\' && <RequestSignoff projectId={project.id} targetEntityId={req.id} targetEntityType="REQUIREMENT" requestedBy={project.owner}/>}');
  return s;
});
edit('src/components/ArchitectureView.tsx',s=>{
  s="import { RequestSignoff } from './RequestSignoff';\n"+s;
  s=s.replace('  return (', `  return (`);
  const pos=s.indexOf('<div className=',s.indexOf('  return (')); const end=s.indexOf('>',pos);
  s=s.slice(0,end+1)+`\n      {adrs.filter(a=>a.status==='PROPOSED').map(a=><div key={a.id} className="flex justify-between items-center border rounded p-3"><span>{a.title}</span><RequestSignoff projectId={project.id} targetEntityId={a.id} targetEntityType="ADR" requestedBy={project.owner}/></div>)}\n`+s.slice(end+1);
  return s;
});
edit('src/components/WorkView.tsx',s=>s.replace("    { id: 'BACKLOG'", "    { id: 'PROPOSED', label: 'Proposed' },\n    { id: 'BACKLOG'"));
edit('src/components/ApprovalsView.tsx',s=>{
  s=s.replace("  const [loading,", "  const [error,setError] = useState('');\n  const [humanConfirmed,setHumanConfirmed] = useState(false);\n  const [loading,");
  s=s.replace("useState('Gio (Security Lead)')", "useState('')");
  s=s.replace('          decision: decisionType,', "          actorType: 'HUMAN', humanConfirmed,\n          decision: decisionType,");
  s=s.replace('      if (res.ok) {\n        setShowDecisionModal(false);', "      if (!res.ok) {const data = await res.json();setError(data.error);return;}\n      if (res.ok) {\n        setShowDecisionModal(false);");
  s=s.replace('No approval requests matching active filter.', 'No governance sign-off requests are pending. Imported AI proposals must first be reviewed and accepted into canonical project state before sign-off can be requested.');
  const pos=s.indexOf('<div className=',s.indexOf('  return ('));const end=s.indexOf('>',pos);
  s=s.slice(0,end+1)+`\n      {error && <p role="alert" className="text-red-700">{error}</p>}\n      <label className="text-sm block"><input type="checkbox" checked={humanConfirmed} onChange={e=>setHumanConfirmed(e.target.checked)}/> I am an authorized human reviewer, signing in my assigned role.</label>\n`+s.slice(end+1);
  return s;
});
edit('server.ts',s=>{
  const a=s.indexOf("  app.post('/api/projects/:id/approvals',");const b=s.indexOf('  // Agent Center & Autonomous Roles',a);
  s=s.slice(0,a)+s.slice(b);
  s=s.replace('        approvals: store.approvals[projectId] || [],', '        approvals: store.approvals[projectId] || [],\n        importSessions: store.importSessions[projectId] || [],\n        features: store.features[projectId] || [],\n        derivations: store.derivations[projectId] || [],');
  s=s.replace('      store.approvals[targetProjectId] = pkg.knowledge.approvals || [];', '      store.approvals[targetProjectId] = pkg.knowledge.approvals || [];\n      store.importSessions[targetProjectId] = (pkg.knowledge.importSessions || []).map(s => ({...s, projectId:targetProjectId}));\n      store.features[targetProjectId] = pkg.knowledge.features || [];\n      store.derivations[targetProjectId] = pkg.knowledge.derivations || [];');
  return s;
});
edit('server/package/portablePackage.ts',s=>s.replace('  derivations?: DerivationRecord[];', "  derivations?: DerivationRecord[];\n  importSessions?: import('../../src/proposalTypes.js').ImportSession[];"));
