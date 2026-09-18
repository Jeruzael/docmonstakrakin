import type { Project } from '../../src/types.js';

export const cryptoDemonDraft = {
  name: 'CryptoDemon',
  description: 'A simple educational cryptocurrency demonstrating mining, peer-to-peer demo coin transfers, wallet balances, block hashes, and immutable ledger behavior.',
  maturity: 'GREENFIELD',
  profiles: ['WEB_APPLICATION', 'BACKEND_API'],
  specializedProfiles: ['DEVELOPER_TOOL'],
  deploymentIntent: 'Local / localhost only',
  dataSensitivity: 'PUBLIC',
  assuranceInputs: { publicInternetExposure: false, pii: false, regulatedData: false, productionSecrets: false, destructiveOperations: true, autonomousAgentExecution: false, securitySensitivity: 'LOW', complianceProfile: [] },
  productBaseline: {
    problemStatement: 'A simple educational cryptocurrency demonstrating mining, peer-to-peer demo coin transfers, wallet balances, block hashes, and immutable ledger behavior.',
    targetUsers: [], coreCapabilities: [], primaryWorkflows: [], successCriteria: [],
    coreFeatures: ['Demo Wallet Creation', 'Mine Block', 'Mining Reward', 'Send DEMON Coins', 'Wallet Balance', 'Transaction History', 'Blockchain Explorer', 'Validate Blockchain Integrity'],
    nonGoals: ['no real monetary value', 'no public blockchain network', 'no real crypto exchange', 'no fiat', 'no smart contracts', 'no production OIDC', 'no production wallet security', 'no PII', 'no AI or agentic AI'],
  },
  technicalBaseline: Object.fromEntries(['frontend', 'backend', 'database', 'authentication', 'storage', 'apiApproach', 'deployment', 'sourceControl', 'testing', 'aiProvider'].map(key => [key, { type: 'UNKNOWN', decision_mode: 'UNKNOWN', finalSelection: null }])),
};
export const cryptoDemonProject = { ...cryptoDemonDraft, id: 'PRJ-CRYPTODEMON-REGRESSION', deliveryMethod: 'ITERATIVE', lifecyclePhase: 'DISCOVERY', owner: 'Fixture Human', stateVersion: 1, targetRelease: 'v0.1', createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z', healthScore: 0, progress: { requirementsReadiness: 0, architectureReadiness: 0, implementation: 0, verification: 0, securityAssurance: 0, releaseReadiness: 0 } } as unknown as Project;
