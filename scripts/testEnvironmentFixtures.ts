import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { inspectEnvironment, detectSourceControlMode } from './detectEnvironment.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✓ [PASS] ${message}`);
}

console.log('=== Target Environment Detection & Continuity Fixtures ===\n');

// Fixture A — Git repository
console.log('--- Fixture A: Git repository simulation ---');
const tmpGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-git-test-'));
try {
  fs.mkdirSync(path.join(tmpGitDir, '.git'));
  execSync('git init -b main', { cwd: tmpGitDir, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: tmpGitDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: tmpGitDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpGitDir, 'test.txt'), 'hello', 'utf-8');
  execSync('git add test.txt && git commit -m "initial commit"', { cwd: tmpGitDir, stdio: 'pipe' });

  const envGit = inspectEnvironment({ workspaceRoot: tmpGitDir });
  assert(envGit.sourceControlMode === 'GIT', 'Fixture A detects SOURCE_CONTROL_MODE = GIT');
  assert(envGit.git.available === true, 'Fixture A git.available is true');
  assert(envGit.git.branch === 'main', `Fixture A reports real branch (${envGit.git.branch})`);
  assert(typeof envGit.git.commit === 'string' && envGit.git.commit.length === 40, 'Fixture A reports real commit SHA-1');
  assert(envGit.git.workingTree === 'CLEAN', 'Fixture A reports CLEAN working tree');
} finally {
  fs.rmSync(tmpGitDir, { recursive: true, force: true });
}

// Fixture B — No .git, AI Studio-like workspace
console.log('\n--- Fixture B: No .git, AI Studio-like workspace ---');
const tmpAiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-aistudio-test-'));
try {
  const envAi = inspectEnvironment({ workspaceRoot: tmpAiDir });
  assert(envAi.sourceControlMode === 'AI_STUDIO_WORKSPACE', 'Fixture B detects SOURCE_CONTROL_MODE = AI_STUDIO_WORKSPACE');
  assert(envAi.git.available === false, 'Fixture B git.available is false');
  assert(envAi.git.branch === null, 'Fixture B git.branch is null (NOT_APPLICABLE)');
  assert(envAi.git.commit === null, 'Fixture B git.commit is null (NOT_APPLICABLE)');
  assert(envAi.git.workingTree === null, 'Fixture B git.workingTree is null (NOT_APPLICABLE)');
} finally {
  fs.rmSync(tmpAiDir, { recursive: true, force: true });
}

// Fixture C — Git unavailable but old handoff says "main"
console.log('\n--- Fixture C: Git unavailable but legacy text claims "main" ---');
const tmpLegacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-legacy-test-'));
try {
  // Even if a file in the directory has "Branch: main", inspectEnvironment should NOT be fooled
  fs.writeFileSync(path.join(tmpLegacyDir, 'LAST_HANDOFF.md'), '## Branch\nmain\n', 'utf-8');
  const envLegacy = inspectEnvironment({ workspaceRoot: tmpLegacyDir });
  assert(envLegacy.sourceControlMode === 'AI_STUDIO_WORKSPACE', 'Fixture C detects AI_STUDIO_WORKSPACE regardless of legacy text');
  assert(envLegacy.git.branch === null, 'Fixture C ignores legacy text and sets git.branch to null');
  assert(envLegacy.workspace.canonicalStateHash.length === 64, 'Fixture C relies on canonical state hash');
} finally {
  fs.rmSync(tmpLegacyDir, { recursive: true, force: true });
}

// Fixture D — Matching state hashes
console.log('\n--- Fixture D: Matching state hashes ---');
const envMatch = inspectEnvironment({
  canonicalStateHash: 'aaaabbbbcccc1111222233334444555566667777888899990000aaaabbbbcccc',
  previousCheckpointHash: 'aaaabbbbcccc1111222233334444555566667777888899990000aaaabbbbcccc',
});
assert(envMatch.workspace.continuityStatus === 'VERIFIED', 'Fixture D resolves STATE_CONTINUITY = VERIFIED');

// Fixture E — Mismatched state hashes
console.log('\n--- Fixture E: Mismatched state hashes ---');
const envMismatch = inspectEnvironment({
  canonicalStateHash: '1111111111111111111111111111111111111111111111111111111111111111',
  previousCheckpointHash: '2222222222222222222222222222222222222222222222222222222222222222',
});
assert(envMismatch.workspace.continuityStatus === 'DIVERGED', 'Fixture E resolves STATE_CONTINUITY = DIVERGED');

// Fixture F — Missing previous checkpoint hash
console.log('\n--- Fixture F: Missing previous checkpoint hash ---');
const envMissing = inspectEnvironment({
  canonicalStateHash: '1111111111111111111111111111111111111111111111111111111111111111',
  previousCheckpointHash: null,
});
assert(envMissing.workspace.continuityStatus === 'UNVERIFIED', 'Fixture F resolves STATE_CONTINUITY = UNVERIFIED');

console.log('\n=== ALL 6 TARGETED ENVIRONMENT FIXTURES PASSED ===\n');
