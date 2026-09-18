export interface ProposalChange {
  type: 'REQUIREMENT' | 'ADR' | 'RISK' | 'WORK_ITEM' | 'CODE_MODIFICATION';
  action: 'CREATE' | 'MODIFY';
  id: string; title: string; details: string;
  acceptanceCriteria?: string[]; requirements?: string[]; features?: string[]; assumptions?: string[];
}
export interface ImportSession {
  id: string; projectId: string; provider: string; model: string; timestamp: string;
  originalJson: string; digest: string;
  validationStatus: 'AWAITING_HUMAN_REVIEW' | 'REVIEW_COMPLETE';
  assumptions: string[];
  changes: { original: ProposalChange; modified?: ProposalChange; disposition: 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED'; reviewer?: string; reviewedAt?: string; artifactIds: string[]; auditId?: string }[];
}
