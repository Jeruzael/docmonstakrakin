import type {Project,Question} from '../types';
import {discoveryGateProjection} from './discoveryGates';
import type {ReleaseHealthSummary} from '../releaseScopeTypes';
import {isReleaseScopeContext} from './releaseHealthProjection';

/** Stored planning percentages are deliberately not inputs to this projection. */
export function projectHealthProjection(project:Project,questions?:Question[],releaseHealth?:ReleaseHealthSummary) {
  const gates=questions===undefined?undefined:discoveryGateProjection(project,questions);
  const coverage=gates?.coverage;
  const context=project.readinessContext;
  const releaseScope=isReleaseScopeContext(context) && context.targetRelease===project.targetRelease && releaseHealth?.scope &&
    JSON.stringify({...releaseHealth.scope,count:undefined})===JSON.stringify(context) ? releaseHealth.scope : undefined;
  const counts=releaseScope && releaseHealth?.lifecycle.status==='Available' ? releaseHealth.lifecycle.counts : undefined;
  const reported=counts ? counts.VERIFICATION+counts.VERIFIED+counts.APPROVED+counts.RELEASED : undefined;
  return {
    version:'LOCAL_PROJECT_HEALTH/1',
    status:!gates?'Unavailable':gates.total>0?'Blocked':!coverage?.isComplete?'Discovery incomplete':'Evidence review required',
    gates,
    releaseScope,
    discovery:coverage?{version:'DISCOVERY_COVERAGE/1',percentage:coverage.coveragePercentage,numerator:coverage.mandatoryResolved+coverage.mandatoryNA,denominator:coverage.mandatoryTotal,formula:'round(100 × (resolved required + not applicable required) / required decisions)',source:'Current project wizard facts and applicable saved discovery answers'}:undefined,
    dimensions:[
      {label:'Implementation',value:reported!==undefined?`${reported} / ${releaseScope!.count} recorded`:'Unavailable',reason:counts?'Scoped lifecycle records in VERIFICATION/VERIFIED/APPROVED/RELEASED; these labels alone do not prove implementation.':'Release scope and accepted task denominator are not configured.'},
      {label:'Verification Evidence',value:releaseScope && releaseHealth?.localEvidence.status==='Available'?`${releaseHealth.localEvidence.reviewedCount} / ${releaseScope.count} locally reviewed`:'Unavailable',reason:'Exact task/build/criteria review under local roster assertions; no production trust is inferred.'},
      {label:'Security Assurance',value:'Unavailable',reason:'Stored planning values do not establish verified security controls.'},
      {label:'Release Readiness',value:'Unavailable',reason:'Requires current evidence-backed release-gate evaluation and separate human release decision.'},
    ],
  };
}
