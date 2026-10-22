import type {Project, Question} from '../types';
import {calculateDiscoveryCoverage, filterQuestionsForProject, isQuestionMandatory, wizardQuestionCoverage} from './derivationEngine';
import {normalizeTechChoice} from './projectInitialization';
import {DISCOVERY_QUESTION_CATALOG} from './discoveryCatalog';

/** Legacy saved answers supply response data, never replacement catalog metadata. */
export function restoreDiscoveryQuestionMetadata(saved:Question):Question {
  const definition=DISCOVERY_QUESTION_CATALOG.find(question=>question.id===saved.id);
  if(!definition)return structuredClone(saved);
  const response=Object.fromEntries(['state','answer','justification','updatedAt'].filter(key=>Object.hasOwn(saved,key)).map(key=>[key,(saved as any)[key]]));
  return structuredClone({...definition,...response});
}

/** One read-only admission rule for dashboard gates and server recommendations. */
export function discoveryGateProjection(project: Project, questions: Question[]) {
  const active=filterQuestionsForProject(questions.map(restoreDiscoveryQuestionMetadata),project);
  const covered=wizardQuestionCoverage(project);
  const blockers=active.filter(q=>isQuestionMandatory(q) && (q.state==='DEFERRED' || q.state==='UNRESOLVED'&&!covered[q.id]));
  const metadata: {id:string;title:string;reason:string}[]=[];
  if(!project.maturity)metadata.push({id:'PROJECT-MATURITY',title:'Record the project maturity',reason:'Project setup does not identify greenfield, existing, migration or extension scope.'});
  if(!normalizeTechChoice(project.technicalBaseline?.sourceControl).finalSelection)metadata.push({id:'PROJECT-SOURCE-CONTROL',title:'Select the target source-control system',reason:'The target source-control decision remains open in project setup.'});
  return {version:'DISCOVERY_GATES/1',blockers,metadata,total:blockers.length+metadata.length,coverage:calculateDiscoveryCoverage(active,project)};
}
