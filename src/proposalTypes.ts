export type ProposalArtifactType = 'REQUIREMENT' | 'ADR' | 'RISK' | 'WORK_ITEM' | 'CODE_MODIFICATION';
export interface ProposalContent {
  title:string; details:string;
  acceptanceCriteria?: string[]; requirements?: string[]; features?: string[]; assumptions?: string[];
}
export interface ProposalChange extends ProposalContent {
  type: ProposalArtifactType;
  action: 'CREATE' | 'MODIFY';
  id: string; title: string; details: string;
  acceptanceCriteria?: string[]; requirements?: string[]; features?: string[]; assumptions?: string[];
}
export interface ProposalChangeV11 {
  proposal_id:string; artifact_type:ProposalArtifactType; action:'CREATE'|'MODIFY';
  target?:{artifact_id:string;artifact_type:ProposalArtifactType}|null;
  proposed:ProposalContent;
}
export interface NormalizedProposalChange extends ProposalContent {
  schemaVersion:'1.0'|'1.1';proposalId:string;artifactType:ProposalArtifactType;action:'CREATE'|'MODIFY';
  target?:{artifactId:string;artifactType:ProposalArtifactType};
}
export interface ProposalDiagnostic {
  code:string;path?:string;message:string;proposal_id?:string;artifact_type?:string;target_id?:string;expected_type?:string;received_type?:string;
}
export interface EditableArtifact {artifact_id:string;artifact_type:Exclude<ProposalArtifactType,'CODE_MODIFICATION'>;status:string;allowed_actions:['MODIFY']}
export interface ImportSession {
  schemaVersion?:'1.0'|'1.1';
  editableArtifacts?:EditableArtifact[];
  id: string; projectId: string; provider: string; model: string; timestamp: string;
  originalJson: string; digest: string;
  validationStatus: 'AWAITING_HUMAN_REVIEW' | 'REVIEW_COMPLETE';
  assumptions: string[];
  changes: { original: ProposalChange|ProposalChangeV11; normalized?:NormalizedProposalChange; modified?:NormalizedProposalChange|ProposalChange; disposition: 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED'; reviewer?: string; reviewedAt?: string; artifactIds: string[]; auditId?: string }[];
}
