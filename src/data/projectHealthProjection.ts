import type {Project,Question} from '../types';
import {discoveryGateProjection} from './discoveryGates';

/** Stored planning percentages are deliberately not inputs to this projection. */
export function projectHealthProjection(project:Project,questions?:Question[]) {
  const gates=questions===undefined?undefined:discoveryGateProjection(project,questions);
  const coverage=gates?.coverage;
  return {
    version:'LOCAL_PROJECT_HEALTH/1',
    status:!gates?'Unavailable':gates.total>0?'Blocked':!coverage?.isComplete?'Discovery incomplete':'Evidence review required',
    gates,
    discovery:coverage?{version:'DISCOVERY_COVERAGE/1',percentage:coverage.coveragePercentage,numerator:coverage.mandatoryResolved+coverage.mandatoryNA,denominator:coverage.mandatoryTotal,formula:'round(100 × (resolved required + not applicable required) / required decisions)',source:'Current project wizard facts and applicable saved discovery answers'}:undefined,
    dimensions:[
      {label:'Implementation',value:'Unavailable',reason:'Release scope and accepted task denominator are not configured.'},
      {label:'Verification Evidence',value:'Unavailable',reason:'No admitted task/build/criteria evidence projection has been loaded.'},
      {label:'Security Assurance',value:'Unavailable',reason:'Stored planning values do not establish verified security controls.'},
      {label:'Release Readiness',value:'Unavailable',reason:'Requires current evidence-backed release-gate evaluation and separate human release decision.'},
    ],
  };
}
