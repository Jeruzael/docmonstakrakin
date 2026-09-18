import {
  Question,
  Project,
  Requirement,
  Feature,
  FeatureSource,
  DerivationRecord,
  DerivationOutput,
  DiscoveryDomain,
  AnswerState,
} from '../types.js';
import { answerText, substitute, validateGenerated } from './generationValidation.js';
import { normalizeTechChoice } from './projectInitialization.js';

export interface DomainCoverageSummary {
  status: string;
  source: string;
  coveragePercentage: number;
  openItems: number;
  domain: DiscoveryDomain;
  total: number;
  mandatory: number;
  resolved: number;
  deferred: number;
  notApplicable: number;
  unresolved: number;
  blockingPending: number;
  isComplete: boolean;
}

export interface DiscoveryCoverageReport {
  totalQuestions: number;
  totalActiveQuestions: number;
  mandatoryTotal: number;
  mandatoryResolved: number;
  mandatoryDeferred: number;
  mandatoryNA: number;
  blockingPending: number;
  coveragePercentage: number;
  isComplete: boolean;
  domainSummaries: DomainCoverageSummary[];
}

export interface DerivationResult {
  record: DerivationRecord;
  requirements: Requirement[];
  features: Feature[];
  constraints: Array<{ id: string; title: string; statement: string }>;
  risks: any[];
}

/**
 * Filters the master question catalog based on the project's profile,
 * specialized profiles, and any dynamic condition dependencies.
 */
export function filterQuestionsForProject(allQuestions: Question[], project: Project): Question[] {
  return allQuestions.filter((q) => {
    // 1. Check primary profiles
    const matchesPrimary = q.appliesTo.some((p) => project.profiles.includes(p));
    if (!matchesPrimary) return false;

    // 2. Check specialized profiles if specified on the question
    if (q.specializedProfiles && q.specializedProfiles.length > 0) {
      const matchesSpecialized = q.specializedProfiles.some((sp) =>
        (project.specializedProfiles || []).includes(sp)
      );
      if (!matchesSpecialized) return false;
    }

    // 3. Check dynamic condition dependencies (e.g. requiredWhen)
    if (q.requiredWhen) {
      if (q.requiredWhen.profile && !project.profiles.includes(q.requiredWhen.profile)) {
        return false;
      }
      if (q.requiredWhen.questionId) {
        const dependentQuestion = allQuestions.find((dq) => dq.id === q.requiredWhen?.questionId);
        if (!dependentQuestion) return false;
        if (dependentQuestion.state !== 'ANSWERED' || !dependentQuestion.answer) return false;
        if (q.requiredWhen.equalsValue !== undefined && dependentQuestion.answer !== q.requiredWhen.equalsValue) {
          return false;
        }
        if (q.requiredWhen.notEqualsValue !== undefined && dependentQuestion.answer === q.requiredWhen.notEqualsValue) {
          return false;
        }
      }
    }

    // Explicit wizard facts suppress irrelevant branches without inventing answers.
    if (project.assuranceInputs?.pii === false && q.domain === 'PRIVACY') return false;
    if (project.assuranceInputs?.productionSecrets === false && q.id === 'SEC-Q-001') return false;
    if (project.assuranceInputs?.publicInternetExposure === false && ['NFR-Q-002', 'OPS-Q-002'].includes(q.id)) return false;
    if (q.id === 'SCM-Q-001' && project.maturity === 'GREENFIELD') return false;

    return true;
  });
}

export function isQuestionMandatory(q: Question): boolean {
  const lvl = q.requiredness?.level;
  if (
    lvl === 'CORE_MANDATORY' ||
    lvl === 'PROFILE_MANDATORY' ||
    lvl === 'CONDITIONAL_MANDATORY' ||
    lvl === 'MANDATORY'
  ) {
    return true;
  }
  if (lvl === 'RECOMMENDED' || lvl === 'OPTIONAL') {
    return false;
  }
  return q.importance === 'BLOCKING' || q.blocking === true;
}

export function isDomainCoveredByWizardBaseline(domain: DiscoveryDomain, project?: Project): boolean {
  if (!project) return false;
  const pb = project.productBaseline;
  const tb = project.technicalBaseline;
  switch (domain) {
    case 'PRODUCT':
      return Boolean(pb?.problemStatement?.trim() || project.description?.trim() || (pb?.coreFeatures && pb.coreFeatures.length > 0));
    case 'USERS':
      return Boolean(pb?.targetUsers && pb.targetUsers.length > 0);
    case 'SCOPE':
      return Boolean(pb?.nonGoals && pb.nonGoals.length > 0);
    case 'WORKFLOWS':
      return Boolean(pb?.primaryWorkflows && pb.primaryWorkflows.length > 0);
    case 'TECHNICAL_CONSTRAINTS':
      return Boolean(tb && [tb.frontend, tb.backend, tb.database].every(c => normalizeTechChoice(c).finalSelection));
    case 'SOURCE_CONTROL_AND_DEVELOPMENT_ENVIRONMENT':
      return Boolean(tb && normalizeTechChoice(tb.sourceControl).finalSelection);
    case 'TESTING_AND_QUALITY':
      return Boolean(tb && normalizeTechChoice(tb.testing).finalSelection);
    default:
      return false;
  }
}

/**
 * Calculates domain-by-domain and overall discovery coverage.
 * Recognizes wizard baseline contributions alongside direct questionnaire answers.
 */
export function wizardQuestionCoverage(project?: Project): Record<string, boolean> {
  const pb = project?.productBaseline;
  return {
    'PROD-Q-001': Boolean(pb?.problemStatement?.trim()), 'PROD-Q-003': Boolean(pb?.problemStatement?.trim()),
    'PROD-Q-002': Boolean(pb?.successCriteria?.length), 'PROD-Q-004': Boolean(pb?.coreFeatures?.length),
    'SCOPE-Q-001': Boolean(pb?.nonGoals?.length), 'USER-Q-001': Boolean(pb?.targetUsers?.length),
    'WORK-Q-001': Boolean(pb?.primaryWorkflows?.length),
  };
}
export function calculateDiscoveryCoverage(questions: Question[], project?: Project): DiscoveryCoverageReport {
  const activeQuestions = project ? filterQuestionsForProject(questions, project) : questions;
  const wizardAnswers = wizardQuestionCoverage(project);
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

/**
 * Derives requirements, features, constraints, or explicit no-artifact records
 * from an answered discovery question.
 *
 * Requirements ALWAYS start as PROPOSED and contain honest provenance links.
 * No sample or fabricated risk, work-item, or test links are injected.
 */
export function deriveArtifactsFromAnswer(
  question: Question,
  answer: any,
  justification?: string,
  provenance: 'QUESTIONNAIRE' | 'WIZARD' | 'AI_DERIVATION' = 'QUESTIONNAIRE'
): DerivationResult {
  const timestamp = new Date().toISOString();
  const rules = question.derivationRules || [];

  // Technical candidates and unknown decisions are context only, never binding requirements.
  const technical = answer && typeof answer === 'object' && !Array.isArray(answer) && (answer.decision_mode || answer.type);
  const choice = technical ? normalizeTechChoice(answer) : null;
  const noSelection = technical && !choice?.finalSelection;
  const answerStr = noSelection ? 'Decision pending explicit selection' : answerText(choice?.finalSelection ?? answer);
  const matchedRules = (noSelection || ['NOT_APPLICABLE', 'DEFERRED'].includes(question.state) ? [] : rules).filter((r) => {
    if (!r.conditionValue) return true;
    if (Array.isArray(r.conditionValue)) {
      if (Array.isArray(answer)) {
        return r.conditionValue.some((cv) => (answer as string[]).includes(cv));
      }
      return r.conditionValue.includes(String(answer));
    }
    if (Array.isArray(answer)) {
      return (answer as string[]).includes(r.conditionValue);
    }
    return r.conditionValue === String(answer);
  });

  const generatedRequirements: Requirement[] = [];
  const generatedFeatures: Feature[] = [];
  const generatedConstraints: Array<{ id: string; title: string; statement: string }> = [];
  const generatedRisks: any[] = [];
  const outputs: DerivationOutput[] = [];

  const derivationRecordId = `DERIV-${question.id}-${Date.now().toString(36).toUpperCase()}`;
  const originType = provenance === 'WIZARD' ? 'WIZARD_BASELINE' : provenance === 'AI_DERIVATION' ? 'AI_DERIVATION' : 'DISCOVERY_ANSWER';

  if (matchedRules.length === 0) {
    const record: DerivationRecord = {
      id: derivationRecordId,
      origin: {
        type: originType,
        id: question.id,
        answer: answerStr,
      },
      derivation: {
        rule: 'NO_MATCHING_RULE',
        version: question.version || '1.0',
        generated_at: timestamp,
      },
      outputs: [],
      disposition: 'NO_DERIVED_ARTIFACT',
      reason: `Answer '${answerStr}' recorded as discovery context; no specific technical derivation rule configured.`,
    };
    return {
      record,
      requirements: [],
      features: [],
      constraints: [],
      risks: [],
    };
  }

  for (const rule of matchedRules) {
    if (rule.outputType === 'NO_DERIVED_ARTIFACT') {
      // Explicit negative derivation (e.g. no PII confirmed)
      continue;
    }

    const shortDomain = (question.domain || question.category || 'GEN').substring(0, 4).toUpperCase();
    const uniqueSuffix = Math.floor(100 + Math.random() * 900);

    if (rule.outputType === 'REQUIREMENT') {
      const reqId = `REQ-${question.id}-${rule.id}`;
      const statement = (rule.targetStatement || 'The system must support the discovered requirement.')
        .replaceAll('{{ANSWER}}', answerStr);

      const req: Requirement = {
        id: reqId,
        title: substitute(rule.targetTitle || `Requirement derived from ${question.id}`, answerStr),
        statement,
        category: rule.category || 'FUNCTIONAL',
        status: 'PROPOSED', // Always PROPOSED, never auto-approved
        priority: rule.priority || 'MEDIUM',
        source: {
          type: provenance === 'WIZARD' ? 'wizard_baseline' : provenance === 'AI_DERIVATION' ? 'ai_derivation' : 'questionnaire_answer',
          id: question.id,
        },
        riskLinks: [], // Honest empty array
        threatLinks: [],
        standardLinks: [...(question.standards || [])],
        workItems: [], // Honest empty array
        tests: [],
        evidence: [],
        rationale: substitute(rule.rationale || `Derived from discovery answer to ${question.id}: ${question.question}`, answerStr),
        acceptanceCriteria: (rule.acceptanceCriteria || []).map(ac => substitute(ac, answerStr)),
        derivationRecordId,
        updatedAt: timestamp,
      };

      generatedRequirements.push(req);
      outputs.push({
        type: 'REQUIREMENT',
        id: req.id,
        title: req.title,
      });
    } else if (rule.outputType === 'FEATURE') {
      const items = Array.isArray(answer) ? answer : [answerStr];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemStr = String(item).trim();
        if (!itemStr) continue;
        const featSlug = itemStr.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
        const featId = `FEAT-${shortDomain}-${featSlug || 'FEAT'}-${i + 1}`;
        const featTitle = rule.targetTitle
          ? (items.length > 1 ? `${rule.targetTitle}: ${itemStr}` : rule.targetTitle)
          : itemStr;

        const isCustom = !question.options?.some(
          (o) => o.value.toLowerCase() === itemStr.toLowerCase() || o.label.toLowerCase() === itemStr.toLowerCase()
        );
        const featSource: FeatureSource = provenance === 'WIZARD'
          ? 'WIZARD'
          : provenance === 'AI_DERIVATION'
          ? 'AI_PROPOSED'
          : isCustom
          ? 'MANUAL_ENTRY'
          : 'DISCOVERY';

        const feat: Feature = {
          id: featId,
          title: featTitle,
          description: substitute(rule.targetStatement || 'Discovered capability: {{ANSWER}}', itemStr),
          capability: question.subtopic || question.domain || 'Core Capability',
          priority: (rule.priority as any) || 'P1',
          status: 'PROPOSED',
          source: featSource,
          personas: [],
          requirements: [],
          dependencies: [],
          updatedAt: timestamp,
        };

        generatedFeatures.push(feat);
        outputs.push({
          type: 'FEATURE',
          id: feat.id,
          title: feat.title,
        });
      }
    } else if (rule.outputType === 'CONSTRAINT') {
      const constId = `CONST-${shortDomain}-${uniqueSuffix}`;
      const statement = substitute(rule.targetStatement || 'Architectural boundary constraint.', answerStr);
      generatedConstraints.push({
        id: constId,
        title: rule.targetTitle || `Constraint from ${question.id}`,
        statement,
      });
      outputs.push({
        type: 'CONSTRAINT',
        id: constId,
        title: rule.targetTitle || constId,
      });
    }
  }

  const disposition = outputs.length > 0 ? 'ARTIFACTS_GENERATED' : 'NO_DERIVED_ARTIFACT';
  const reason = outputs.length > 0
    ? `Successfully derived ${outputs.length} artifact(s) from question ${question.id}`
    : matchedRules[0]?.dispositionReason || `Answer processed with no output artifacts required`;

  const record: DerivationRecord = {
    id: derivationRecordId,
    origin: {
      type: originType,
      id: question.id,
      answer: answerStr,
    },
    derivation: {
      rule: matchedRules.map((r) => r.id).join('; '),
      version: question.version || '1.0',
      generated_at: timestamp,
    },
    outputs,
    disposition,
    reason,
  };

  validateGenerated([generatedRequirements, generatedFeatures, generatedConstraints]);
  return {
    record,
    requirements: generatedRequirements,
    features: generatedFeatures,
    constraints: generatedConstraints,
    risks: generatedRisks,
  };
}
