import type {ReleaseScopeContext} from '../../src/releaseScopeTypes.ts';

/** A local scope declaration is a binding, not an accepted trust root. */
export type ReleaseEvaluationScope = Pick<ReleaseScopeContext,
  'targetRelease' | 'workItemIds' | 'commitSha' | 'buildRevision' | 'environment'> & {
  projectId: string;
  scopeId: string;
  scopeRevision: number;
};
export type ReleaseScopeEvaluation = {
  status: 'BOUND' | 'UNAVAILABLE' | 'INVALID';
  scope: ReleaseEvaluationScope | null;
  reason: string;
};
export type ProductionEvidenceRequest = {
  version: 'PRODUCTION_RELEASE_EVIDENCE_REQUEST/1';
  scope: ReleaseEvaluationScope;
  subject: {kind: 'RELEASE_GATE' | 'CAPABILITY'; id: number; workItemIds: string[]};
};
export type ProductionEvidenceUnavailable = {
  status: 'UNAVAILABLE';
  providerId: 'UNCONFIGURED';
  trustedProductionEvidence: false;
  reasonCode: 'TRUST_ROOTS_NOT_ACCEPTED';
  reason: string;
};
/** No accepted-root runtime exists. A future success variant requires a separately
 * reviewed verifier contract; neither caller claims nor CI can fill that role. */
export interface ProductionEvidenceProvider {
  acquire(request: ProductionEvidenceRequest): ProductionEvidenceUnavailable;
}
export function productionEvidenceUnavailable(): ProductionEvidenceUnavailable {
  return {status: 'UNAVAILABLE', providerId: 'UNCONFIGURED', trustedProductionEvidence: false,
    reasonCode: 'TRUST_ROOTS_NOT_ACCEPTED',
    reason: 'Authenticated production evidence acquisition is unavailable: production trust roots and independent human/operator acceptance have not been established. Local attestations, imported archives and CI observations cannot substitute for that authority.'};
}
export const unavailableProductionEvidenceProvider: ProductionEvidenceProvider = Object.freeze({
  acquire: (_request: ProductionEvidenceRequest) => productionEvidenceUnavailable(),
});
