/**
 * docmonstakrakin - A-SSDLC Development Control Plane
 * Canonical Type Definitions & Schemas
 */

export type ProjectProfile =
  | 'WEB_APPLICATION'
  | 'MOBILE_APPLICATION'
  | 'BACKEND_API'
  | 'BACKEND_SERVICE'
  | 'FULL_STACK'
  | 'API_SERVICE'
  | 'DATA_PIPELINE'
  | 'DESKTOP_APPLICATION'
  | 'DESKTOP_GUI'
  | 'EMBEDDED_SYSTEM'
  | 'AI_APPLICATION'
  | 'AGENTIC_AI_APPLICATION';

export type SpecializedProfile =
  | 'FINANCIAL'
  | 'HEALTHCARE'
  | 'EDUCATION'
  | 'ECOMMERCE'
  | 'PII'
  | 'INTERNAL_TOOL'
  | 'PUBLIC_INTERNET'
  | 'AI_ASSISTANT'
  | 'AUTONOMOUS_AGENT'
  | 'DEVELOPER_TOOL'
  | 'AGENTIC_AI_EXPERIMENTATION'
  | 'AI_ENGINEERING'
  | 'DATA_PLATFORM';

export type DeliveryMethod = 'ITERATIVE' | 'SCRUM' | 'KANBAN' | 'SCRUMBAN';

export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type ASSDLCPhase =
  | 'DISCOVERY'
  | 'REQUIREMENTS'
  | 'REQUIREMENTS_REVIEW'
  | 'RISK_ASSESSMENT'
  | 'THREAT_MODELING'
  | 'ARCHITECTURE'
  | 'ARCHITECTURE_REVIEW'
  | 'PLANNING'
  | 'IMPLEMENTATION'
  | 'VERIFICATION'
  | 'SECURITY_REVIEW'
  | 'RELEASE_APPROVAL'
  | 'DEPLOYMENT'
  | 'OPERATIONS'
  | 'FEEDBACK';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DiscoveryDomain =
  | 'PRODUCT'
  | 'SCOPE'
  | 'USERS'
  | 'WORKFLOWS'
  | 'DATA'
  | 'AUTHENTICATION_AND_AUTHORIZATION'
  | 'INTEGRATIONS'
  | 'TECHNICAL_CONSTRAINTS'
  | 'ARCHITECTURE_INPUT'
  | 'DEPLOYMENT'
  | 'SOURCE_CONTROL_AND_DEVELOPMENT_ENVIRONMENT'
  | 'SECURITY'
  | 'PRIVACY'
  | 'NON_FUNCTIONAL'
  | 'TESTING_AND_QUALITY'
  | 'OPERATIONS'
  | 'AI'
  | 'AGENTIC_AI'
  | 'COMPLIANCE';

export type TechChoiceType = 'USER_SPECIFIED' | 'RECOMMEND_FOR_ME' | 'UNKNOWN';

export interface ArchitectureAlternative {
  technology: string;
  tradeOff: string;
}

export interface ArchitectureRecommendation {
  status: 'NOT_EVALUATED' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
  preferredTechnology?: string;
  rationale?: string[];
  alternatives?: ArchitectureAlternative[];
  evaluatedAt?: string;
}

export interface TechChoice {
  type: TechChoiceType;
  decision_mode?: TechChoiceType;
  userValue?: string | null;
  recommendation?: ArchitectureRecommendation | null;
  finalSelection?: string | null;
  final_selection?: string | null;
  status?: 'PROPOSED' | 'NOT_RATIFIED' | 'ACCEPTED' | 'RATIFIED' | 'UNRESOLVED';
  value?: string;
  notes?: string;
}

export interface TechnicalBaseline {
  frontend: TechChoice;
  backend: TechChoice;
  database: TechChoice;
  authentication: TechChoice;
  storage: TechChoice;
  apiApproach: TechChoice;
  deployment: TechChoice;
  sourceControl: TechChoice;
  testing: TechChoice;
  aiProvider: TechChoice;
}

export interface ProductBaseline {
  problemStatement: string;
  targetUsers: string[];
  coreCapabilities: string[];
  coreFeatures: string[];
  primaryWorkflows: string[];
  nonGoals: string[];
  successCriteria: string[];
}

export interface Project {
  maturity?: 'GREENFIELD' | 'EXISTING_PROJECT' | 'MIGRATION' | 'EXTENSION';
  assuranceInputs?: AssuranceInputs;
  computedRisk?: { score: number; level: RiskLevel; drivers: string[] };
  id: string;
  name: string;
  description: string;
  profiles: ProjectProfile[];
  specializedProfiles: SpecializedProfile[];
  deliveryMethod: DeliveryMethod;
  deploymentIntent: string;
  dataSensitivity: DataSensitivity;
  lifecyclePhase: ASSDLCPhase;
  stateVersion: number;
  owner: string;
  targetRelease: string;
  createdAt: string;
  updatedAt: string;
  repoPath?: string;
  repoStatus?: 'CLEAN' | 'MODIFIED' | 'DISCONNECTED';
  healthScore: number;
  progress: {
    requirementsReadiness: number;
    architectureReadiness: number;
    implementation: number;
    verification: number;
    securityAssurance: number;
    releaseReadiness: number;
  };
  productBaseline?: ProductBaseline;
  technicalBaseline?: TechnicalBaseline;
  discoveryCoverage?: {
    totalQuestions: number;
    mandatoryTotal: number;
    mandatoryResolved: number;
    mandatoryDeferred: number;
    mandatoryNA: number;
    blockingPending: number;
    coveragePercentage: number;
    isComplete: boolean;
  };
}

export interface AssuranceInputs {
  publicInternetExposure: boolean | null;
  pii: boolean | null;
  regulatedData: boolean | null;
  productionSecrets: boolean | null;
  destructiveOperations: boolean | null;
  autonomousAgentExecution: boolean | null;
  securitySensitivity: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH';
  complianceProfile: string[];
}

export type QuestionImportance = 'BLOCKING' | 'REQUIRED_BEFORE_IMPLEMENTATION' | 'RECOMMENDED';
export type AnswerState = 'ANSWERED' | 'DEFERRED' | 'NOT_APPLICABLE' | 'UNRESOLVED';

export type AnswerType =
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'
  | 'FREE_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'RANGE'
  | 'DATE_OR_DURATION'
  | 'RANKING'
  | 'REPEATABLE_GROUP'
  | 'KEY_VALUE_LIST'
  | 'TECH_DECISION'
  | 'NOT_APPLICABLE';

export type RequirednessLevel =
  | 'CORE_MANDATORY'
  | 'PROFILE_MANDATORY'
  | 'CONDITIONAL_MANDATORY'
  | 'RECOMMENDED'
  | 'OPTIONAL'
  | 'MANDATORY'; // Backwards compatibility

export interface QuestionRequiredness {
  level: RequirednessLevel;
  reason?: string;
}

export interface QuestionCardinality {
  min?: number;
  max?: number | null;
}

export interface QuestionValidation {
  minNumeric?: number;
  maxNumeric?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface DerivationRule {
  id: string;
  conditionValue?: string | string[];
  outputType: 'REQUIREMENT' | 'FEATURE' | 'RISK' | 'CONSTRAINT' | 'ARCHITECTURE_INPUT' | 'NO_DERIVED_ARTIFACT';
  targetTitle?: string;
  targetStatement?: string;
  category?: RequirementCategory;
  priority?: RiskLevel;
  rationale?: string;
  acceptanceCriteria?: string[];
  dispositionReason?: string;
}

export interface Question {
  id: string;
  category?: 'authentication' | 'data_retention' | 'architecture' | 'ai_safety' | 'deployment' | 'compliance' | string;
  domain?: DiscoveryDomain;
  subtopic?: string;
  question: string;
  contextReason: string;
  why_it_matters?: string;
  importance: QuestionImportance;
  requiredness?: QuestionRequiredness;
  blocking?: boolean;
  answer_type?: AnswerType;
  answerType?: AnswerType;
  cardinality?: QuestionCardinality;
  validation?: QuestionValidation;
  allow_custom?: boolean;
  appliesTo: ProjectProfile[];
  specializedProfiles?: SpecializedProfile[];
  requiredWhen?: {
    questionId?: string;
    equalsValue?: any;
    notEqualsValue?: any;
    profile?: ProjectProfile;
  };
  standards: string[];
  options: { label: string; value: string; description?: string }[];
  state: AnswerState;
  answer?: any;
  justification?: string;
  derivationRules?: DerivationRule[];
  version?: string;
  updatedAt?: string;
}

export type RequirementCategory =
  | 'FUNCTIONAL'
  | 'SECURITY'
  | 'PRIVACY'
  | 'DATA'
  | 'OPERATIONAL'
  | 'COMPLIANCE'
  | 'AI_SPECIFIC'
  | 'AGENT_SPECIFIC'
  | 'ARCHITECTURE';

export type RequirementStatus =
  | 'PROPOSED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'VERIFIED';

export interface Requirement {
  id: string;
  title: string;
  statement: string;
  category: RequirementCategory;
  status: RequirementStatus;
  priority: RiskLevel;
  source: {
    type: 'questionnaire_answer' | 'stakeholder' | 'standard_control' | 'threat_mitigation' | 'wizard_baseline' | 'ai_derivation' | 'EXTERNAL_AI_PROPOSAL';
    id: string;
  };
  riskLinks: string[];
  threatLinks: string[];
  standardLinks: string[];
  workItems: string[];
  tests: string[];
  evidence: string[];
  rationale?: string;
  acceptanceCriteria?: string[];
  linkedFeatureId?: string;
  derivationRecordId?: string;
  updatedAt: string;
}

export type FeatureStatus = 'PROPOSED' | 'UNDER_REVIEW' | 'APPROVED' | 'DEFERRED' | 'REJECTED';
export type FeatureSource = 'DISCOVERY' | 'MANUAL_ENTRY' | 'AI_PROPOSED' | 'REQUIREMENT' | 'WIZARD' | 'PRODUCT_BASELINE';

export interface Feature {
  provenance?: { projectId: string; origin: string; input: string; timestamp: string };
  id: string;
  title: string;
  description: string;
  capability: string;
  priority: RiskLevel | 'P0' | 'P1' | 'P2';
  status: FeatureStatus;
  source: FeatureSource;
  personas: string[];
  requirements: string[];
  dependencies: string[];
  updatedAt: string;
}

export interface DerivationOutput {
  type: 'REQUIREMENT' | 'FEATURE' | 'RISK' | 'CONSTRAINT' | 'ARCHITECTURE_INPUT';
  id: string;
  title: string;
}

export interface DerivationRecord {
  id: string;
  origin: {
    type: 'DISCOVERY_ANSWER' | 'WIZARD_BASELINE' | 'AI_DERIVATION';
    id: string;
    answer: string;
  };
  derivation: {
    rule: string;
    version: string;
    generated_at: string;
  };
  outputs: DerivationOutput[];
  disposition: 'ARTIFACTS_GENERATED' | 'NO_DERIVED_ARTIFACT';
  reason?: string;
}

export type ContextPackageMode = 'SUMMARY' | 'TASK_CONTEXT' | 'FULL_BASELINE';

export interface ContextPackageOptions {
  mode: ContextPackageMode;
  role: string;
  activeWorkItemId?: string;
  includeOmissionReport?: boolean;
}

export interface CompiledContextPackage {
  handoffReady?: boolean;
  blockers?: string[];
  mode: ContextPackageMode;
  role: string;
  compiledPrompt: string;
  activeWorkItem?: WorkItem;
  includedRequirementIds: string[];
  includedRiskIds: string[];
  omissionsReport?: string[];
  tokenEstimate: number;
  timestamp: string;
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  drivers: string[];
  inherentLikelihood: number; // 1-5
  inherentImpact: number; // 1-5
  inherentScore: number; // 1-25
  inherentLevel: RiskLevel;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  residualLevel: RiskLevel;
  treatment: 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID';
  controls: string[];
  mandatoryFloorApplied?: boolean;
  floorReason?: string;
}

export interface Threat {
  id: string;
  title: string;
  attackSurface: string;
  asset: string;
  impact: string;
  likelihood: number;
  impactScore: number;
  riskLevel: RiskLevel;
  mitigations: {
    title: string;
    status: 'RESOLVED' | 'IN_PROGRESS' | 'UNRESOLVED';
  }[];
}

export interface StandardControl {
  id: string;
  standardId: 'NIST_SSDF' | 'OWASP_ASVS' | 'OWASP_MASVS' | 'OWASP_AISVS' | 'OWASP_SAMM';
  standardName: string;
  version: string;
  category: string;
  code: string;
  title: string;
  description: string;
  trustLevel: 'OFFICIAL' | 'VERIFIED_MIRROR' | 'CURATED';
  verifiedCount: number;
  unverifiedCount: number;
  mappedRequirementsCount: number;
}

export type WorkItemType = 'EPIC' | 'FEATURE' | 'TASK' | 'SECURITY' | 'VERIFICATION' | 'RELEASE';
export type WorkItemStatus =
  | 'PROPOSED'
  | 'BACKLOG'
  | 'READY'
  | 'IN_PROGRESS'
  | 'VERIFICATION'
  | 'VERIFIED'
  | 'APPROVED'
  | 'RELEASED'
  | 'DEFERRED';

export interface WorkItem {
  features?: string[];
  id: string; // e.g., DMK-001
  parentEpicId?: string;
  type: WorkItemType;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: 'P0' | 'P1' | 'P2';
  risk: RiskLevel;
  sprint: number;
  requirements: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  checklist: { text: string; done: boolean }[];
  tests: string[];
  evidence: string[];
  owner?: string;
  updatedAt: string;
}

export type EvidenceType =
  | 'TEST_RUN'
  | 'COMMIT'
  | 'DIFF'
  | 'SECURITY_SCAN'
  | 'HUMAN_REVIEW'
  | 'AGENT_REVIEW'
  | 'DEPLOYMENT_RECORD';

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  workItemId: string;
  result: 'PASSED' | 'FAILED' | 'VERIFIED';
  command?: string;
  commitHash?: string;
  producer: string;
  createdAt: string;
  sha256Hash: string;
  details: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  timestamp: string;
  action: string;
  target: string;
  reason?: string;
  stateHash: string;
  previousHash?: string;
  details?: Record<string, any>;
}

export interface RecommendedNextAction {
  id: string;
  title: string;
  actionType: 'RESOLVE_BLOCKER' | 'APPROVE_REQUIREMENT' | 'RUN_TESTS' | 'COMPLETE_REVIEW' | 'OVERRIDE_GATE' | 'SIGN_OFF';
  reason: string;
  targetEntityId: string;
  blocks: string[];
  severity: RiskLevel;
}

export interface GateOverride {
  status?: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  authorizedBy?: string;
  id: string;
  actor: string;
  gateOrControl: string;
  reason: string;
  riskAcknowledged: boolean;
  createdAt: string;
  expiresAt: string;
  affectedWork: string[];
}

export type ADRStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'DEPRECATED' | 'SUPERSEDED';

export interface ADR {
  id: string;
  title: string;
  status: ADRStatus;
  date: string;
  author: string;
  context: string;
  decision: string;
  consequences: {
    positive: string[];
    negative: string[];
    risks: string[];
  };
  linkedRequirements: string[];
  linkedRisks: string[];
  linkedStandards: string[];
  supersededBy?: string;
  updatedAt: string;
}

export type TrustZone = 'INTERNET' | 'DMZ' | 'INTERNAL_SECURE' | 'RESTRICTED_DATA';

export interface ArchitectureComponent {
  id: string;
  name: string;
  category: 'CLIENT' | 'GATEWAY' | 'SERVICE' | 'DATASTORE' | 'EXTERNAL';
  trustZone: TrustZone;
  technology: string;
  description: string;
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  inboundProtocols: string[];
  outboundProtocols: string[];
  assignedRequirements: string[];
  linkedADRs: string[];
  securityControls: string[];
}

export interface GitFileStatus {
  path: string;
  status: 'MODIFIED' | 'ADDED' | 'DELETED' | 'UNTRACKED' | 'RENAMED';
  staged: boolean;
}

export interface GitCommitRecord {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  stateHash?: string;
  filesChanged?: number;
}

export interface PreCommitCheck {
  id: string;
  name: string;
  category: 'SECRETS' | 'RISK_GATE' | 'TRACEABILITY' | 'DEPENDENCIES' | 'LINT';
  status: 'PASSED' | 'FAILED' | 'WARNING';
  details: string;
  blocking: boolean;
}

export interface RepoStatusResponse {
  branch: string;
  headCommit: string;
  headMessage: string;
  isClean: boolean;
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  recentCommits: GitCommitRecord[];
  checks: PreCommitCheck[];
}

export type ApprovalType =
  | 'GATE_TRANSITION'
  | 'REQUIREMENT_BASELINE'
  | 'ADR_SIGN_OFF'
  | 'RISK_ACCEPTANCE'
  | 'SECURITY_OVERRIDE'
  | 'STANDARD_UPDATE'
  | 'RELEASE_SIGNOFF';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalItem {
  id: string;
  projectId: string;
  title: string;
  type: ApprovalType;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetEntityId: string;
  targetEntityType: 'GATE' | 'REQUIREMENT' | 'ADR' | 'RISK' | 'OVERRIDE' | 'RELEASE';
  description: string;
  impactAnalysis: string;
  riskLevel: RiskLevel;
  requiredRoles: string[];
  approvalsCollected: {
    role: string;
    approver: string;
    timestamp: string;
    decision: 'APPROVED' | 'REJECTED';
    comment?: string;
  }[];
  policyGates: {
    gateName: string;
    passed: boolean;
    details: string;
  }[];
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface AgentRole {
  id: string;
  name: string;
  category: 'SECURITY' | 'ARCHITECTURE' | 'COMPLIANCE' | 'TESTING' | 'ORCHESTRATION';
  description: string;
  promptTemplate: string;
  temperature: number;
  inputEntities: string[];
  outputType: 'PROPOSALS' | 'RISK_ANALYSIS' | 'TEST_SUITE' | 'ADR_EVALUATION' | 'TRACE_AUDIT';
  modelTier: 'GEMINI_2_5_FLASH' | 'GEMINI_2_5_PRO' | 'DETERMINISTIC_RULES';
  totalRuns: number;
  lastRunAt?: string;
}

export interface AgentRunLog {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  status: 'SUCCESS' | 'VIOLATION_REJECTED' | 'PENDING_HUMAN_REVIEW' | 'RUNNING';
  durationMs: number;
  tokensUsed: number;
  outputSummary: string;
  proposalCount: number;
  validationViolations: string[];
  dualAgentReview?: {
    reviewerAgentId: string;
    reviewerAgentName: string;
    verdict: 'PASSED' | 'CONCERNS_FLAGGED' | 'REJECTED';
    critique: string;
    passed: boolean;
    findingsCount: number;
  };
}

// ---------------------------------------------------------------------------
// DMK-157: SecretStore Domain Contract & Credential Abstraction
// ---------------------------------------------------------------------------

export type SecretProviderType =
  | 'OS_KEYCHAIN'
  | 'ENCRYPTED_FILE'
  | 'MEMORY_EPHEMERAL'
  | 'ENVIRONMENT_FALLBACK';

export interface SecretMetadata {
  key: string;
  description: string;
  provider: SecretProviderType;
  lastRotated?: string;
  isConfigured: boolean;
  fingerprint?: string; // Truncated/masked SHA-256 hash, NEVER plaintext secret
  createdAt?: string;
  updatedAt?: string;
}

export interface SecretStore {
  /**
   * Retrieves plaintext secret value by key.
   * Returns null if key does not exist.
   */
  getSecret(key: string): Promise<string | null>;

  /**
   * Persists or updates secret value with optional description.
   */
  setSecret(key: string, value: string, description?: string): Promise<void>;

  /**
   * Deletes a secret by key. Returns true if removed, false if not found.
   */
  deleteSecret(key: string): Promise<boolean>;

  /**
   * Checks if secret exists and is configured.
   */
  hasSecret(key: string): Promise<boolean>;

  /**
   * Returns safe metadata for all stored secrets without leaking values.
   */
  listSecretMetadata(): Promise<SecretMetadata[]>;

  /**
   * Returns active driver provider type.
   */
  getProviderType(): SecretProviderType;
}

export interface SecretRotationEvent {
  key: string;
  previousFingerprint?: string;
  newFingerprint: string;
  timestamp: string;
  rotatedBy: string;
  provider: SecretProviderType;
}

export interface SecretRedactionRule {
  pattern: RegExp;
  mask: string;
}

export interface ReleaseGate {
  gateId: number;
  code: string;
  name: string;
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'OVERRIDDEN';
  details: string;
  blocking: boolean;
  evidenceLinks: string[];
}

export interface CapabilityAssessment {
  capabilityId: string;
  title: string;
  referenceDmk: string;
  status: 'VERIFIED' | 'IMPLEMENTED' | 'NOT_STARTED';
  evidence: string;
}

export interface ReleaseAuditReport {
  projectId: string;
  projectName: string;
  timestamp: string;
  targetMilestone: string;
  allGatesPassed: boolean;
  gates: ReleaseGate[];
  capabilitiesSummary: {
    total: number;
    verified: number;
    percentage: number;
  };
  capabilities: CapabilityAssessment[];
  auditChainIntegrity: {
    valid: boolean;
    breaksCount: number;
    eventsChecked: number;
  };
  releaseReady: boolean;
  signedOff: boolean;
  signoffDetails?: {
    actor: string;
    timestamp: string;
    auditEventId: string;
  };
}
