==================================================
OPERATOR COMMAND REFERENCE
==================================================

Create:

docs/00_control/OPERATOR_COMMAND_REFERENCE.md

Purpose:
Provide the human operator with a durable, concise command reference for
routine docmonstakrakin repository operation, verification, controlled Git
workflow, bootstrap inspection, evidence handling, and recovery.

This is an operator cheat sheet, not an architectural specification.

Classify commands using these safety classes:

READ_ONLY
  Commands that only inspect repository/state.

GENERATED_WRITE
  Commands that regenerate derived controlled files.

GIT_WRITE
  Source-control mutations owned exclusively by the human operator.

STATE_WRITE
  Commands that mutate canonical application state and require explicit
  authorization.

RECOVERY
  Commands that must never be used as routine workflow.

Include these sections:

1. Purpose & Safety Classes

2. Repository Inspection
   git status
   git branch --show-current
   git rev-parse HEAD
   git diff
   git diff --stat
   git diff --cached
   git diff --check
   git log --oneline --decorate -n 10

3. Remote / Branch Synchronization
   git fetch origin
   git switch master
   git pull origin master
   git switch -c <branch-name>
   git merge origin/master
   git merge-base --is-ancestor origin/master HEAD
   echo $?

Explain:
exit code 0 = ancestry check passed.

4. Controlled Staging / Commit / Push
   git add <explicit-files>
   git status
   git diff --cached
   git commit -m "<message>"
   git push origin <branch>

Explicitly recommend targeted git add rather than routine git add .

5. Normal Engineering Verification
   npm run lint
   npm run build
   npx tsx scripts/runAutomatedQa.ts

6. WBS Operation
   npm run wbs:check
   npm run wbs:render

Document the invariant:

MASTER_WBS.yaml = canonical editable source
MASTER_WBS.md   = generated output; never manually edit

7. Bootstrap Regression Suites
   npm run test:bootstrap:contract
   npm run test:bootstrap:manifest
   npm run test:bootstrap:executor
   npm run test:bootstrap:execution-verifier

Current expected suite baselines:
- bootstrap contract: 19/19
- bootstrap executor: 16/16
- execution verifier: 20/20
- automated QA: 11/11
- WBS: zero drift

8. Safe Bootstrap Inspection

   npm run bootstrap:self -- --dry-run
   npm run bootstrap:self -- --dry-run --json

Expected dry-run invariants:
- snapshotWritten = false
- mutationCount = 0
- Gate 7 not executed
- approvalsInjected = 0

9. Post-Bootstrap Read-Only Verification

   npm run verify:bootstrap:execution -- \
     --baseline-snapshot .local/project-state.baseline-backup.json

   npm run verify:bootstrap:execution -- \
     --baseline-snapshot .local/project-state.baseline-backup.json \
     --json

Clearly state this verifier is read-only.

10. Canonical State Hashing

   sha256sum .local/project-state.json
   sha256sum .local/project-state.baseline-backup.json

Include variable form:

   STATE_SHA="$(sha256sum .local/project-state.json | awk '{print $1}')"
   BACKUP_SHA="$(sha256sum .local/project-state.baseline-backup.json | awk '{print $1}')"

Include equality check.

11. Ignored Local State

   git check-ignore .local/project-state.json
   git check-ignore .local/project-state.baseline-backup.json

12. Search / Inspection Helpers

   grep -n "<term>" <file>
   grep -A25 '<term>' <file>
   grep -Rni "<term>" docs scripts server src

13. Standard Pre-Commit Checklist

   npm run lint
   npm run wbs:check
   npx tsx scripts/runAutomatedQa.ts
   npm run build
   git diff --check
   git status
   git diff --stat
   git diff

14. Standard Pre-Push Checklist

   git fetch origin
   git merge origin/master
   git merge-base --is-ancestor origin/master HEAD
   echo $?
   npm run lint
   npm run wbs:check
   npx tsx scripts/runAutomatedQa.ts
   git diff --check

15. STATE_WRITE / One-Time Commands

Document the trusted bootstrap execution command as HIGH RISK / ONE TIME.

Do NOT present it as a routine command.

Explicitly state that PRJ-DOCMONSTAKRAKIN self-bootstrap has already been
successfully executed and must NOT be executed again.

16. Recovery Commands

Document baseline restoration only as a deliberate RECOVERY action:

   cp .local/project-state.baseline-backup.json \
      .local/project-state.json

State that failure evidence must be preserved before rollback.

17. Dangerous Git Commands

Document that the following are NOT routine workflow and require deliberate
operator review:

   git reset --hard
   git clean -fd
   git push --force

Do not encourage their use.

18. Command Ownership

Explicitly state:

- Git mutations are human-operator owned.
- Real canonical-state execution is human-operator owned.
- AI Studio may run implementation/test commands but not Git commands.
- AI agents must not execute the trusted bootstrap ceremony.