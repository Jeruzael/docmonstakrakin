/** Local evidence review is a human attestation, never authenticated producer proof. */
export type VerificationBinding = {commitSha:string; buildRevision:string; environment:string};
export type VerificationPrincipal = {
  identityId:string; username:string; personId:string; roles:string[];
  kind:'HUMAN'; roleSource:'LOCAL_SERVER_ROSTER'; personBindingSource:'LOCAL_ROSTER_ASSERTION';
};
export type VerificationEvidenceInput = {
  id:string; kind:'MANUAL'|'LOG'|'SCREENSHOT'|'REFERENCE'; encoding:'UTF8'|'BASE64'; content:string; sha256:string;
};
export type VerificationEvidence = VerificationEvidenceInput & {byteLength:number; provenance:'HUMAN_ATTESTED_INLINE'|'UNVERIFIED_REFERENCE'};
export type VerificationCriterionResult = {criterionIndex:number; result:'PASS'|'FAIL'|'NOT_RUN'; notes:string; evidenceIds:string[]};
export type VerificationDraft = VerificationBinding & {criterionResults:VerificationCriterionResult[]; evidence:VerificationEvidence[]};
export type VerificationBundle = VerificationDraft & {
  schemaVersion:1; projectId:string; workItemId:string; workItemDigest:string;
  acceptanceCriteria:string[]; author:VerificationPrincipal; submittedAt:string;
  attestation:'HUMAN_ATTESTATION'; policyVersion:'LOCAL_SESSION_V1'; requiredRoles:string[];
};
export type VerificationDecision = VerificationBinding & {
  id:string; decision:'APPROVE'|'REJECT'|'REQUIRE_REMEDIATION'; reason:string; role:string;
  reviewer:VerificationPrincipal; submittedDigest:string; createdAt:string;
  humanAttested:true; independenceAttested:true;
};
export type VerificationSession = {
  id:string; projectId:string; workItemId:string; workItemDigest:string; acceptanceCriteria:string[];
  author:VerificationPrincipal; createdAt:string; updatedAt:string;
  status:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'REMEDIATION_REQUIRED';
  draft:VerificationDraft; submitted?:{bundle:VerificationBundle; digest:string}; decisions:VerificationDecision[];
};
export type VerificationReviewProjection = {
  sessionId:string; eligible:boolean; reason:string; pendingRoles:string[];
  trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION'; trustedProductionEvidence:false;
};
/** Listing never embeds criterion notes, evidence content, or submitted bundle bytes. */
export type VerificationSessionSummary = VerificationBinding & {
  id:string; projectId:string; workItemId:string; author:VerificationPrincipal;
  createdAt:string; updatedAt:string; status:VerificationSession['status'];
  submittedDigest?:string; criterionCount:number; evidenceCount:number; retainedBytes:number;
};
export type VerificationSessionList = {
  sessions:VerificationSessionSummary[]; reviews:VerificationReviewProjection[]; stateVersion:number;
  identity:VerificationPrincipal; requiredRoles:string[];
  archives?:VerificationArchiveSummary[];
};
export type VerificationArchive = {
  schemaVersion:1; trust:'UNTRUSTED_IMPORTED_HISTORY'; sourceProjectId:string;
  sessions:VerificationSession[]; sessionCount:number; retainedBytes:number;
  activeReviewAuthority:false; trustedProductionEvidence:false;
};
export type VerificationArchiveSummary=Omit<VerificationArchive,'sessions'>;
