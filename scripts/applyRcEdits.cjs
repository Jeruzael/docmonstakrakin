const fs = require('node:fs');
function edit(file, fn) { fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))); }
edit('server.ts', s => {
  s = s.slice(0, s.indexOf('    // Seed initial features')) + '    store.features[newId] = baselineFeatures(newProject);\n\n' + s.slice(s.indexOf('    store.risks[newId]'));
  const start = s.indexOf("  app.get('/api/projects/:id/questions'");
  const end = s.indexOf("  // Derivations", start);
  s = s.slice(0, start) + `  app.get('/api/projects/:id/questions', (req, res) => {
    const project = store.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({error: 'Project not found'});
    const saved = store.questions[project.id] || [];
    const all = structuredClone(DISCOVERY_QUESTION_CATALOG).map(q => saved.find(x => x.id === q.id) || q);
    store.questions[project.id] = all;
    res.json(filterQuestionsForProject(all, project));
  });

  app.post('/api/projects/:id/answers', (req, res) => {
    const project = store.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({error: 'Project not found'});
    const {questionId, answer, state = 'ANSWERED', justification} = req.body;
    if (!['ANSWERED', 'DEFERRED', 'NOT_APPLICABLE', 'UNRESOLVED'].includes(state)) return res.status(422).json({error: 'Invalid answer state'});
    if (['DEFERRED', 'NOT_APPLICABLE'].includes(state) && !justification?.trim()) return res.status(422).json({error: 'Disposition requires rationale'});
    const questions = structuredClone(store.questions[project.id] || []);
    const target = filterQuestionsForProject(questions, project).find(q => q.id === questionId);
    if (!target) return res.status(422).json({error: 'Question is not currently applicable'});
    Object.assign(target, {answer, state, justification, updatedAt: new Date().toISOString()});
    const derived = state === 'ANSWERED' ? deriveArtifactsFromAnswer(target, answer, justification) : deriveArtifactsFromAnswer({...target, state: 'DEFERRED'}, 'Disposition recorded', justification);
    const active = filterQuestionsForProject(questions, project);
    const activeIds = new Set(active.filter(q => q.state === 'ANSWERED').map(q => q.id));
    const retained = (store.requirements[project.id] || []).filter(r => r.source.type !== 'questionnaire_answer' || (r.source.id !== questionId && activeIds.has(r.source.id)));
    derived.requirements.forEach(r => r.standardLinks = applicableStandardLinks(r.standardLinks, project));
    store.requirements[project.id] = [...retained, ...derived.requirements];
    store.features[project.id] = [...(store.features[project.id] || []).filter(f => !derived.features.some(n => n.id === f.id)), ...derived.features];
    store.questions[project.id] = questions;
    (store.derivations[project.id] ||= []).unshift(derived.record);
    const coverage = calculateDiscoveryCoverage(active, project);
    project.discoveryCoverage = coverage;
    project.progress.requirementsReadiness = coverage.coveragePercentage;
    project.stateVersion++;
    project.updatedAt = new Date().toISOString();
    store.addAuditEvent(project.id, 'User', 'QUESTION_ANSWERED', questionId, justification || 'Explicit discovery answer', {answer, state, derivation: derived.record.id});
    res.json({success: true, question: target, coverage, derivation: derived.record, derivedRequirements: derived.requirements});
  });

  app.get('/api/projects/:id/discovery/coverage', (req, res) => {
    const project = store.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({error: 'Project not found'});
    res.json(calculateDiscoveryCoverage(filterQuestionsForProject(store.questions[project.id] || [], project), project));
  });

` + s.slice(end);
  s = s.replace("const activeWorkItem = workItems.find((w) => w.id === activeWorkItemId) || workItems[0];", "const activeWorkItem = workItems.find((w) => w.id === activeWorkItemId);");
  s = s.replace('      components,\n      mode,', '      components,\n      standards: applicableStandards(project),\n      mode,');
  s = s.replace("  // Vite / Static Middleware", "  // Vite / Static Middleware");
  s = s.replace("  if (process.env.NODE_ENV !== 'production') {", `  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof DerivationError) return res.status(422).json({error: error.toJSON()});
    console.error(error);
    res.status(500).json({error: 'Request failed; canonical changes were not accepted'});
  });

  if (process.env.NODE_ENV !== 'production') {`);
  return s;
});

edit('src/components/ProjectWizard.tsx', s => {
  s = s.replace("import React,", "import { emptyAssurance, computeAssurance } from '../data/projectInitialization';\nimport { applicableStandards } from '../data/standardsApplicability';\nimport React,");
  // Default and reset values must both be neutral. Examples are never saved input.
  const fields = ['owner','deploymentIntent','targetUsers','coreCapabilities','coreFeatures','primaryWorkflows','nonGoals','successCriteria','frontendVal','frontendFinal','backendVal','backendFinal','authVal','authFinal','storageVal','storageFinal','deploymentVal','deploymentFinal','sourceControlVal','sourceControlFinal'];
  for (const name of fields) {
    const cap = name[0].toUpperCase() + name.slice(1);
    s = s.replace(new RegExp('(const \\[' + name + ', set' + cap + '\\] = useState\\()([^\\n]*)(\\);)'), '$1\'\'$3');
    s = s.replace(new RegExp('set' + cap + '\\([^\\n]*\\);', 'g'), 'set' + cap + "('');");
  }
  s = s.replace(/useState<TechChoiceType>\('[^']+'\)/g, "useState<TechChoiceType>('UNKNOWN')");
  s = s.replace(/set(Frontend|Backend|Database|Auth|Storage|Api|Deployment|SourceControl|Testing|Ai)Choice\('[^']+'\)/g, "set$1Choice('UNKNOWN')");
  s = s.replace("useState<DataSensitivity>('CONFIDENTIAL')", "useState<DataSensitivity>('INTERNAL')").replace("setDataSensitivity('CONFIDENTIAL')", "setDataSensitivity('INTERNAL')");
  s = s.replace("useState<SpecializedProfile[]>(['DEVELOPER_TOOL'])", "useState<SpecializedProfile[]>([])").replace("setSelectedSpecialized(['DEVELOPER_TOOL'])", "setSelectedSpecialized([])");
  s = s.replace("  const [step,", "  const [maturity, setMaturity] = useState<Project['maturity']>('GREENFIELD');\n  const [assurance, setAssurance] = useState({...emptyAssurance});\n  const [submitError, setSubmitError] = useState('');\n  const [step,");
  const st = s.indexOf('  const activatedStandards =');
  const en = s.indexOf('  const isFormDirty', st);
  s = s.slice(0, st) + "  const activatedStandards = Array.from(new Set(applicableStandards({profiles: selectedProfiles}).map(s => s.standardName + ' v' + s.version)));\n  const computedRisk = computeAssurance(assurance, selectedProfiles, selectedSpecialized);\n\n" + s.slice(en);
  s = s.replace('    setStep(1);', "    setMaturity('GREENFIELD');\n    setAssurance({...emptyAssurance});\n    setSubmitError('');\n    setStep(1);");
  s = s.replace('        dataSensitivity,\n        productBaseline', '        dataSensitivity,\n        maturity,\n        assuranceInputs: assurance,\n        productBaseline');
  s = s.replace("status: isRecommended ? 'PROPOSED' : 'NOT_EVALUATED'", "status: isRecommended ? (explicitFinal ? 'ACCEPTED' : 'PROPOSED') : 'NOT_EVALUATED'");
  s = s.replace("      console.error('Failed to create project:', err);", "      setSubmitError(err instanceof Error ? err.message : 'Project creation failed. Your draft is retained.');");
  s = s.replace('              {/* Step 1: Project Details */}', '              {submitError && <p role="alert" className="text-red-700">{submitError}</p>}\n              {/* Step 1: Project Details */}');
  s = s.replace('1. Project Identification</h3>', '1. Project Identification</h3>');
  s = s.replace('                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">', `                  <label className="block text-xs font-semibold">Project Maturity
                    <select aria-label="Project Maturity" value={maturity} onChange={e => setMaturity(e.target.value as Project['maturity'])} className="w-full border rounded p-2 mt-1">
                      {['GREENFIELD','EXISTING_PROJECT','MIGRATION','EXTENSION'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">`);
  const a = s.indexOf('              {step === 5 && (');
  const b = s.indexOf('              {/* Step 6:', a);
  s = s.slice(0,a) + `              {step === 5 && <div className="space-y-4 text-sm">
                <h3 className="font-bold">ASSURANCE INPUTS</h3>
                {Object.keys(emptyAssurance).filter(k => !['securitySensitivity','complianceProfile'].includes(k)).map(key => <label key={key} className="flex justify-between gap-3 items-center">
                  {key.replace(/([A-Z])/g, ' $1')}
                  <select aria-label={key} value={assurance[key] === null ? 'UNKNOWN' : String(assurance[key])} onChange={e => setAssurance({...assurance, [key]: e.target.value === 'UNKNOWN' ? null : e.target.value === 'true'})} className="border rounded p-2">
                    <option value="UNKNOWN">Unknown</option><option value="false">No</option><option value="true">Yes</option>
                  </select>
                </label>)}
                <label className="block">Security sensitivity <select value={assurance.securitySensitivity} onChange={e => setAssurance({...assurance, securitySensitivity: e.target.value as any})}>{['UNKNOWN','LOW','MEDIUM','HIGH'].map(v => <option key={v}>{v}</option>)}</select></label>
                <label className="block">Regulatory / compliance profile <input className="border rounded p-2 w-full" value={assurance.complianceProfile.join(', ')} onChange={e => setAssurance({...assurance, complianceProfile: e.target.value.split(',').map(v => v.trim()).filter(Boolean)})} placeholder="Applicable regulations, if any" /></label>
                <section className="p-4 bg-amber-50 border rounded"><h3 className="font-bold">COMPUTED RISK RESULT</h3><p>{computedRisk.level} (Score: {computedRisk.score})</p><p className="text-xs">Deterministic initial floor and declared exposure inputs. Score is read-only.</p></section>
                <section className="p-4 border rounded"><h3 className="font-bold">GOVERNANCE OVERRIDE</h3><p className="text-xs">After creation, request an override with rationale and human authorization. Approval and audit history are required; the computed score remains unchanged.</p></section>
              </div>}

` + s.slice(b);
  return s;
});
