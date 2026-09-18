const fs=require('node:fs');
const file='src/data/derivationEngine.ts';let s=fs.readFileSync(file,'utf8');
const a=s.indexOf('export function calculateDiscoveryCoverage(');const b=s.indexOf('/**\n * Derives requirements',a);
s=s.slice(0,a)+`export function calculateDiscoveryCoverage(questions: Question[], project?: Project): DiscoveryCoverageReport {
  const activeQuestions = project ? filterQuestionsForProject(questions, project) : questions;
  const pb = project?.productBaseline;
  const wizardAnswers: Record<string, boolean> = {
    'PROD-Q-001': Boolean(pb?.problemStatement?.trim()), 'PROD-Q-003': Boolean(pb?.problemStatement?.trim()),
    'PROD-Q-002': Boolean(pb?.successCriteria?.length), 'PROD-Q-004': Boolean(pb?.coreFeatures?.length),
    'SCOPE-Q-001': Boolean(pb?.nonGoals?.length), 'USER-Q-001': Boolean(pb?.targetUsers?.length),
    'WORK-Q-001': Boolean(pb?.primaryWorkflows?.length),
  };
  const allDomains: DiscoveryDomain[] = ['PRODUCT','SCOPE','USERS','WORKFLOWS','DATA','AUTHENTICATION_AND_AUTHORIZATION','INTEGRATIONS','TECHNICAL_CONSTRAINTS','ARCHITECTURE_INPUT','DEPLOYMENT','SOURCE_CONTROL_AND_DEVELOPMENT_ENVIRONMENT','SECURITY','PRIVACY','NON_FUNCTIONAL','TESTING_AND_QUALITY','OPERATIONS','AI','AGENTIC_AI','COMPLIANCE'];
  const summaries = allDomains.map(domain => {
    const qs = activeQuestions.filter(q=>q.domain===domain);
    const wizard = qs.filter(q=>q.state==='UNRESOLVED' && wizardAnswers[q.id]);
    const resolved = qs.filter(q=>q.state==='ANSWERED').length + wizard.length;
    const deferred = qs.filter(q=>q.state==='DEFERRED').length;
    const notApplicable = qs.filter(q=>q.state==='NOT_APPLICABLE').length;
    const unresolved = qs.filter(q=>q.state==='UNRESOLVED' && !wizardAnswers[q.id]).length;
    const blockingPending = qs.filter(q=>isQuestionMandatory(q) && q.state==='UNRESOLVED' && !wizardAnswers[q.id]).length;
    const aiNA = domain==='AI' && !project?.profiles.some(p=>['AI_APPLICATION','AGENTIC_AI_APPLICATION'].includes(p));
    const agentNA = domain==='AGENTIC_AI' && !project?.profiles.includes('AGENTIC_AI_APPLICATION');
    const privacyNA = domain==='PRIVACY' && project?.assuranceInputs?.pii===false;
    const scmOpen = domain==='SOURCE_CONTROL_AND_DEVELOPMENT_ENVIRONMENT' && project && !normalizeTechChoice(project.technicalBaseline?.sourceControl).finalSelection ? 1 : 0;
    const maturityOpen = domain==='PRODUCT' && project && !project.maturity ? 1 : 0;
    const extraOpen = scmOpen + maturityOpen;
    const total = qs.length + extraOpen;
    const openItems = unresolved + deferred + extraOpen;
    const status = aiNA || agentNA || privacyNA ? 'NOT_APPLICABLE' : blockingPending ? 'BLOCKED' : deferred ? 'DEFERRED' : openItems ? (resolved ? 'ACTIVE_DISCOVERY' : 'UNRESOLVED') : wizard.length ? 'RESOLVED_BY_PROJECT_WIZARD' : total ? 'RESOLVED' : 'SKIPPED_BY_CONDITION';
    return {domain,total,mandatory:qs.filter(isQuestionMandatory).length+extraOpen,resolved,deferred,notApplicable,unresolved:unresolved+extraOpen,blockingPending:blockingPending+extraOpen,isComplete:openItems===0,status,
      source: aiNA||agentNA ? 'Profile filtering' : privacyNA ? 'Assurance inputs: no PII' : scmOpen ? 'Project maturity: '+project!.maturity+'; target source control open' : maturityOpen ? 'Project maturity missing' : wizard.length ? 'Product Baseline + discovery' : total ? 'Discovery answers' : 'Conditional applicability',
      openItems,coveragePercentage:total ? Math.round((resolved+notApplicable)/total*100) : 100};
  });
  const mandatory = activeQuestions.filter(isQuestionMandatory);
  const mandatoryResolved = mandatory.filter(q=>q.state==='ANSWERED' || (q.state==='UNRESOLVED' && wizardAnswers[q.id])).length;
  const mandatoryNA = mandatory.filter(q=>q.state==='NOT_APPLICABLE').length;
  const mandatoryDeferred = mandatory.filter(q=>q.state==='DEFERRED').length;
  const mandatoryTotal = summaries.reduce((n,d)=>n+d.mandatory,0);
  const blockingPending = summaries.reduce((n,d)=>n+d.blockingPending,0);
  return {totalQuestions:questions.length,totalActiveQuestions:activeQuestions.length,mandatoryTotal,mandatoryResolved,mandatoryNA,mandatoryDeferred,blockingPending,coveragePercentage:mandatoryTotal ? Math.round((mandatoryResolved+mandatoryNA)/mandatoryTotal*100) : 100,isComplete:summaries.every(d=>d.isComplete),domainSummaries:summaries};
}

`+s.slice(b);fs.writeFileSync(file,s);
// Eliminate host-specific semantics from generally applicable answers.
const cat='src/data/discoveryCatalog.ts';s=fs.readFileSync(cat,'utf8');
s=s.replace('All canonical state must serialize into deterministic, portable, sealed archives capable of standalone verification without network connectivity.', 'The project must support its selected offline operation and data portability needs: {{ANSWER}}.');
s=s.replace('Account recovery must enforce {{ANSWER}} policy with single-use verification tokens expiring within 15 minutes.', 'Account recovery must follow the explicitly selected recovery policy: {{ANSWER}}.');
s=s.replace('Public user registration must enforce anti-automation, rate limiting, and private session isolation.', 'The system must support the selected public audience with appropriate access boundaries; registration remains a separate discovery decision.');
fs.writeFileSync(cat,s);
// Drop unreachable old stack block; it read candidate values as selected.
const ctx='src/data/contextPackageCompiler.ts';s=fs.readFileSync(ctx,'utf8');const st=s.indexOf('    if (false && project.technicalBaseline)');const en=s.indexOf('    // Global Architectural Constraints',st);s=s.slice(0,st)+s.slice(en);fs.writeFileSync(ctx,s);
