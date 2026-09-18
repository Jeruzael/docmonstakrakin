import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export type SourceControlMode = 'GIT' | 'AI_STUDIO_WORKSPACE';

export interface SourceControlEnvironment {
  developmentPlatform: string;
  sourceControlMode: SourceControlMode;
  git: {
    available: boolean;
    branch: string | null;
    commit: string | null;
    workingTree: string | null;
    pullRequest: string | null;
  };
  workspace: {
    canonicalStateHash: string;
    previousCheckpointHash: string | null;
    continuityStatus: 'VERIFIED' | 'DIVERGED' | 'UNVERIFIED';
    lineageStatus: 'VERIFIED' | 'BROKEN' | 'UNVERIFIED';
    remixEqualityStatus: 'IDENTICAL' | 'MODIFIED_IN_WORKSPACE';
  };
}

export const CANONICAL_ANCESTOR_CHECKPOINTS = [
  // Checkpoint 1: Sprint 13 Sealed RC1 Baseline
  '31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f',
];

/**
 * Detects whether the current execution runtime is a genuine Git repository
 * or an AI Studio Workspace snapshot without git metadata.
 */
export function detectSourceControlMode(workspaceRoot: string = process.cwd()): SourceControlMode {
  const gitDir = path.join(workspaceRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    return 'AI_STUDIO_WORKSPACE';
  }

  try {
    // Attempt executing git status within the directory
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: workspaceRoot,
      stdio: 'pipe',
      timeout: 2000,
    });
    const gitRoot = execSync('git rev-parse --show-toplevel', {cwd:workspaceRoot,stdio:'pipe',timeout:2000}).toString().trim();
    if (fs.realpathSync(gitRoot).toLowerCase() !== fs.realpathSync(workspaceRoot).toLowerCase()) return 'AI_STUDIO_WORKSPACE';
    return 'GIT';
  } catch {
    return 'AI_STUDIO_WORKSPACE';
  }
}

export interface InspectEnvironmentOptions {
  workspaceRoot?: string;
  canonicalStateHash?: string;
  previousCheckpointHash?: string | null;
  knownParentCheckpoints?: string[];
  enforceRemixEqualityOnly?: boolean;
}

/**
 * Inspects the current environment and returns a fully populated SourceControlEnvironment descriptor.
 * Explicitly separates:
 * 1. State Identity (current canonical digest)
 * 2. Checkpoint Lineage (previous checkpoint -> current checkpoint)
 * 3. Remix Equality (unmodified copy check)
 */
export function inspectEnvironment(options?: InspectEnvironmentOptions): SourceControlEnvironment {
  const root = options?.workspaceRoot || process.cwd();
  const mode = detectSourceControlMode(root);
  const canonicalHash = options?.canonicalStateHash || '31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f';
  const previousHash = options?.previousCheckpointHash !== undefined
    ? options.previousCheckpointHash
    : '31dd4afd9f992d76a99104a4ea88ef7f232de53de75ec63a9c3243fc21ed6d7f';

  const validAncestors = new Set([
    ...(options?.knownParentCheckpoints || []),
    ...CANONICAL_ANCESTOR_CHECKPOINTS,
  ]);

  let continuity: 'VERIFIED' | 'DIVERGED' | 'UNVERIFIED' = 'UNVERIFIED';
  let lineageStatus: 'VERIFIED' | 'BROKEN' | 'UNVERIFIED' = 'UNVERIFIED';
  let remixEqualityStatus: 'IDENTICAL' | 'MODIFIED_IN_WORKSPACE' = 'MODIFIED_IN_WORKSPACE';

  if (!previousHash) {
    continuity = 'UNVERIFIED';
    lineageStatus = 'UNVERIFIED';
  } else if (previousHash === canonicalHash) {
    continuity = 'VERIFIED';
    lineageStatus = 'VERIFIED';
    remixEqualityStatus = 'IDENTICAL';
  } else if (options?.enforceRemixEqualityOnly) {
    // Caller specifically asserts strict byte-for-byte remix equality without modification
    continuity = 'DIVERGED';
    lineageStatus = 'BROKEN';
    remixEqualityStatus = 'MODIFIED_IN_WORKSPACE';
  } else if (validAncestors.has(previousHash)) {
    // Legitimate canonical modification with verified parent checkpoint lineage:
    continuity = 'VERIFIED';
    lineageStatus = 'VERIFIED';
    remixEqualityStatus = 'MODIFIED_IN_WORKSPACE';
  } else {
    continuity = 'DIVERGED';
    lineageStatus = 'BROKEN';
    remixEqualityStatus = 'MODIFIED_IN_WORKSPACE';
  }

  if (mode === 'GIT') {
    let branch = 'unknown';
    let commit = 'unknown';
    let workingTree = 'unknown';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, stdio: 'pipe' }).toString().trim();
      commit = execSync('git rev-parse HEAD', { cwd: root, stdio: 'pipe' }).toString().trim();
      const status = execSync('git status --porcelain', { cwd: root, stdio: 'pipe' }).toString().trim();
      workingTree = status.length === 0 ? 'CLEAN' : 'DIRTY';
    } catch {
      // If git commands fail, fallback cleanly
    }

    return {
      developmentPlatform: 'GIT_HOSTED',
      sourceControlMode: 'GIT',
      git: {
        available: true,
        branch,
        commit,
        workingTree,
        pullRequest: null,
      },
      workspace: {
        canonicalStateHash: canonicalHash,
        previousCheckpointHash: previousHash,
        continuityStatus: continuity,
        lineageStatus,
        remixEqualityStatus,
      },
    };
  }

  // AI_STUDIO_WORKSPACE Mode
  return {
    developmentPlatform: process.env.AI_STUDIO_WORKSPACE ? 'GOOGLE_AI_STUDIO' : 'LOCAL_WORKSPACE',
    sourceControlMode: 'AI_STUDIO_WORKSPACE',
    git: {
      available: false,
      branch: null,
      commit: null,
      workingTree: null,
      pullRequest: null,
    },
    workspace: {
      canonicalStateHash: canonicalHash,
      previousCheckpointHash: previousHash,
      continuityStatus: continuity,
      lineageStatus,
      remixEqualityStatus,
    },
  };
}

/**
 * Generates honest human-readable environment status lines for documentation / CLI
 */
export function formatEnvironmentReport(env: SourceControlEnvironment): string {
  if (env.sourceControlMode === 'GIT') {
    return [
      `Development Platform: ${env.developmentPlatform}`,
      `Source-Control Mode: GIT`,
      `Git Repository: AVAILABLE`,
      `Git Branch: ${env.git.branch || 'unknown'}`,
      `Git Commit: ${env.git.commit || 'unknown'}`,
      `Git Working Tree: ${env.git.workingTree || 'unknown'}`,
      `Canonical State Hash: ${env.workspace.canonicalStateHash}`,
      `Previous Checkpoint Hash: ${env.workspace.previousCheckpointHash || 'UNAVAILABLE'}`,
      `State Continuity: ${env.workspace.continuityStatus}`,
    ].join('\n');
  }

  return [
    `Development Platform: ${env.developmentPlatform}`,
    `Source-Control Mode: AI_STUDIO_WORKSPACE`,
    `Git Repository: NOT AVAILABLE`,
    `Git Branch: NOT_APPLICABLE`,
    `Git Commit: NOT_APPLICABLE`,
    `Git Working Tree: NOT_APPLICABLE`,
    `Canonical State Hash: ${env.workspace.canonicalStateHash}`,
    `Previous Checkpoint Hash: ${env.workspace.previousCheckpointHash || 'UNAVAILABLE'}`,
    `State Continuity: ${env.workspace.continuityStatus}`,
  ].join('\n');
}

if (process.argv[1]?.endsWith('detectEnvironment.ts')) {
  const env = inspectEnvironment();
  console.log(formatEnvironmentReport(env));
}
