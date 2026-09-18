# docmonstakrakin Agent Bootstrap Protocol

## Purpose

This file defines how any AI development agent must initialize, resume,
implement, verify, document, and hand off work in the docmonstakrakin
repository.

This protocol applies regardless of:

- AI provider;
- account;
- conversation;
- session;
- context loss;
- previous agent;
- previous developer.

The repository is the persistent project memory.

Chat history is supplementary and MUST NOT be treated as the authoritative
project state.

---

# 1. CORE RULE

Never assume project state from previous conversation text.

At the beginning of every session, reconstruct project state from:

1. Git repository
2. MASTER_WBS.yaml
3. PROJECT_STATE.md
4. requirements
5. architecture
6. security documentation
7. traceability records
8. implementation evidence
9. tests
10. Git history

The repository is authoritative over conversational memory.

---

# 2. SOURCE-OF-TRUTH PRECEDENCE

When documents conflict, use this precedence:

1. Approved product / requirement baseline
2. Approved architecture and security decisions
3. MASTER_WBS.yaml
4. Repository implementation and tests
5. Verification evidence
6. ROADMAP.md
7. Sprint documents
8. Implementation plans
9. PROJECT_STATE.md
10. LAST_HANDOFF.md
11. Previous AI conversation

However, implementation does not automatically override an approved
requirement or architecture decision.

If implementation conflicts with the approved baseline, report the conflict.

Do not silently redefine the requirement to match the code.

---

# 3. REQUIRED SESSION INITIALIZATION

Before implementing anything:

## Step 1 — Repository & Workspace Environment State

Detect the operational environment and inspect state accordingly:

1. **Source-Control Mode Detection:**
   - Check whether a valid `.git` directory exists and whether Git commands execute successfully.
   - If Git is available, record `SOURCE_CONTROL_MODE: GIT`.
   - If `.git` is not present (such as in Google AI Studio or exported filesystem bundles), record `SOURCE_CONTROL_MODE: AI_STUDIO_WORKSPACE`.
   - **CRITICAL:** Do NOT fabricate Git branch names, commit hashes, or working-tree states when running in `AI_STUDIO_WORKSPACE` mode. If Git is absent, branch, commit, and git status MUST be reported as `NOT_APPLICABLE` or `UNAVAILABLE`.

2. **State Inspection by Mode:**
   - **If GIT Mode:**
     - Inspect current Git branch;
     - Inspect git status;
     - Inspect recent commits;
     - Inspect uncommitted changes;
     - Inspect repository structure.
   - **If AI_STUDIO_WORKSPACE Mode:**
     - Development Platform: Google AI Studio;
     - Repository Structure: inspect root files and `docs/00_control/`;
     - Compute or inspect canonical project-state hash (`computeCanonicalStateHash`);
     - Verify continuity against previous checkpoint state hash;
     - Do not overwrite unrelated uncommitted user work.

---

## Step 2 — Read Control Documents

Read in this order:

1. AGENT_BOOTSTRAP.md
2. docs/00_control/PROJECT_STATE.md
3. docs/00_control/MASTER_WBS.yaml
4. docs/00_control/ROADMAP.md
5. docs/00_control/TRACEABILITY_MATRIX.md
6. docs/00_control/LAST_HANDOFF.md

Then inspect documents linked by the currently active WBS item.

---

## Step 3 — Reconstruct Current State

Determine:

- current release target;
- current phase;
- current milestone;
- active sprint, if any;
- current WBS item;
- last VERIFIED item;
- IN_PROGRESS items;
- BLOCKED items;
- VERIFICATION_PENDING items;
- highest-risk unresolved items;
- pending human approvals;
- Recommended Next Action.

Do not trust LAST_HANDOFF.md without checking the WBS and repository.

---

## Step 4 — Validate Current Task

Before executing the Recommended Next Action confirm:

- task exists in MASTER_WBS.yaml;
- status permits execution;
- dependencies are satisfied;
- acceptance criteria exist;
- requirement traceability exists;
- architectural prerequisites exist;
- required security controls exist;
- required human approvals exist;
- repository state does not contradict the task.

If these conditions are not satisfied:

DO NOT IMPLEMENT.

Resolve or report the inconsistency first.

---

# 4. TASK SELECTION POLICY

Select work in this order:

1. Existing IN_PROGRESS task that can safely continue
2. VERIFICATION_PENDING task requiring completion
3. Highest-priority READY task whose dependencies are satisfied
4. Documentation or investigation task required to unblock work

Do not begin another task merely because it appears interesting.

Do not skip unfinished high-priority work without recording the reason.

Do not start multiple unrelated implementation tasks simultaneously unless
the approved plan explicitly allows parallel work.

---

# 5. ATOMIC TASK EXECUTION

Prefer executing ONE atomic WBS task at a time.

For the selected task:

1. Read linked requirement(s).
2. Read linked architecture decision(s).
3. Read linked security control(s).
4. Read its implementation plan where applicable.
5. Inspect affected code.
6. Confirm assumptions.
7. Implement only the approved scope.
8. Test the implementation.
9. Verify acceptance criteria.
10. Record evidence.
11. Update project documentation.
12. Determine the next task.

Do not expand scope silently.

If new work is discovered, create or propose a separate WBS item.

---

# 6. STATUS TRANSITION RULES

Allowed normal progression:

PROPOSED
    ↓
READY
    ↓
IN_PROGRESS
    ↓
IMPLEMENTED
    ↓
VERIFICATION_PENDING
    ↓
VERIFIED

Alternative states:

BLOCKED
DEFERRED
CANCELLED

Never mark a task VERIFIED simply because code was written.

VERIFIED requires evidence that its acceptance criteria were satisfied.

---

# 7. DEFINITION OF DONE

A task is NOT complete merely when implementation finishes.

A task is DONE only when all applicable items below are complete:

- implementation exists;
- tests were added or updated;
- relevant tests pass;
- acceptance criteria evaluated;
- security implications reviewed;
- verification evidence recorded;
- MASTER_WBS.yaml updated;
- MASTER_WBS.md synchronized;
- TRACEABILITY_MATRIX.md updated;
- PROJECT_STATE.md updated;
- sprint documentation updated if applicable;
- implementation-plan status updated;
- relevant ADR updated or created when required;
- user-facing documentation updated when applicable;
- LAST_HANDOFF.md updated;
- Recommended Next Action recalculated.

Documentation updates are part of implementation work.

Never defer them merely because the code works.

---

# 8. MASTER WBS UPDATE POLICY

MASTER_WBS.yaml is the canonical task-state representation.

After meaningful work, update applicable fields such as:

- status;
- dependencies;
- evidence;
- blocking reason;
- branch;
- commit;
- PR;
- verification;
- reviewer;
- notes.

Never change stable DMK identifiers.

MASTER_WBS.md must remain semantically synchronized with MASTER_WBS.yaml.

If automated generation is available, regenerate it.

---

# 9. TRACEABILITY UPDATE POLICY

For implementation work maintain:

REQ
→ architecture
→ security controls
→ WBS task
→ test
→ verification evidence

Do not leave implemented functionality orphaned from its requirement.

When newly discovered work has no requirement, flag it instead of inventing
product scope silently.

---

# 10. PROJECT STATE UPDATE POLICY

After every completed or materially changed task update:

docs/00_control/PROJECT_STATE.md

It must include:

- current release;
- current phase;
- current milestone;
- active sprint;
- current branch;
- last VERIFIED task;
- current IN_PROGRESS task;
- VERIFICATION_PENDING items;
- BLOCKED items;
- unresolved decisions;
- pending approvals;
- important risks;
- Recommended Next Action.

The Recommended Next Action must reference a specific WBS ID.

Example:

Recommended Next Action:
DMK-157.4

Do not write vague recommendations such as:

"Continue security implementation."

---

# 11. RECOMMENDED NEXT ACTION POLICY

After completing a task:

1. Inspect dependencies.
2. Inspect priority.
3. Inspect risk.
4. Inspect current milestone.
5. Inspect blockers.
6. Identify READY tasks.
7. Select exactly one recommended next atomic task.

Record:

- WBS ID;
- title;
- why it is next;
- prerequisites;
- expected output;
- verification method.

Do not select a task whose dependencies are unresolved.

---

# 12. HUMAN APPROVAL GATES

STOP and request human approval before performing actions requiring approval.

Examples include:

- changing approved product scope;
- modifying governance policy;
- destructive operation;
- irreversible migration;
- credential migration;
- privilege escalation;
- weakening security controls;
- production deployment;
- release promotion;
- architecture changes requiring ADR approval.

Preparing the change is not equivalent to approving it.

An AI agent must not approve its own high-risk change.

---

# 13. SECOND-AGENT VERIFICATION

Where independent verification is required:

Executor and verifier must be treated as separate roles.

Record:

Planned by:
Implemented by:
Verified by:
Human approved by:

Do not claim independent verification simply because the implementing agent
reviewed its own output.

If verification requires another agent, set:

VERIFICATION_PENDING

and record what needs to be checked.

---

# 14. INTERRUPTION / QUOTA-EXHAUSTION SAFETY

A session may terminate unexpectedly.

Therefore maintain recoverability continuously.

After every meaningful atomic milestone:

- keep WBS status accurate;
- save implementation;
- update evidence where appropriate;
- avoid leaving documentation knowingly false.

Before intentionally ending a session, execute the Session Handoff Procedure.

If a session ends unexpectedly, the next agent must reconstruct state from
repository evidence.

---

# 15. SESSION HANDOFF PROCEDURE

Before ending a development session, update:

docs/00_control/LAST_HANDOFF.md

Use the following structure:

# Session Handoff

## Timestamp
<date/time>

## Environment & Source-Control Mode
- Development Platform: Google AI Studio | Git-Hosted
- Source-Control Mode: AI_STUDIO_WORKSPACE | GIT
- Git Repository: NOT_AVAILABLE | AVAILABLE
- Git Branch: NOT_APPLICABLE | <branch>
- Git Commit: NOT_APPLICABLE | <commit-sha>
- Git Working Tree: NOT_APPLICABLE | <clean / modified>
- Canonical State Hash: <64-char sha256>
- Previous Checkpoint Hash: <64-char sha256>
- State Continuity: VERIFIED | DIVERGED | UNVERIFIED

## Current Release
<release>

## Current Phase
<phase>

## Current Sprint
<sprint or UNASSIGNED>

## Work Completed This Session
- DMK-xxx — ...
- evidence...

## Work Partially Completed
- DMK-xxx
- completed:
- remaining:

## Last Verified Task
DMK-xxx

## Current Active Task
DMK-xxx or NONE

## Blockers
...

## Pending Human Decisions
...

## Verification Pending
...

## Important Repository Changes
...

## Recommended Next Action
DMK-xxx

## Why This Is Next
...

## Required Reading For Next Session
...

## Commands / Tests Last Run
...

## Test Result
...

## Warnings
...

LAST_HANDOFF.md is an aid only.

It does not override MASTER_WBS.yaml or repository evidence.

---

# 16. NEW SESSION RESUME BEHAVIOR

When a new session begins:

Do NOT immediately ask:

"What would you like me to implement?"

First reconstruct state.

Then report:

SESSION RECOVERY

Development Platform: <Google AI Studio | Git-Hosted>
Source-Control Mode: <AI_STUDIO_WORKSPACE | GIT>
Git Repository: <NOT_AVAILABLE | AVAILABLE>
Git Branch: <NOT_APPLICABLE | branch>
Git Commit: <NOT_APPLICABLE | commit-sha>
Canonical State Hash: <64-char sha256>
Previous Checkpoint Hash: <64-char sha256>
State Continuity: <VERIFIED | DIVERGED | UNVERIFIED>
Release:
Phase:
Sprint:
Last verified:
Current task:
Blocking issues:
Recommended next task:

Then state whether work can safely resume.

If the recommended task is READY and requires no human decision, proceed
according to the user's current instruction.

If approval is required, STOP.

---

# 17. CONFLICT DETECTION

If any of the following disagree:

- PROJECT_STATE.md;
- MASTER_WBS.yaml;
- repository;
- tests;
- sprint document;
- LAST_HANDOFF.md;

do not guess.

Report:

STATE CONFLICT DETECTED

Then determine the most defensible state from authoritative evidence.

Correct derived documentation where safe.

Do not silently alter approved requirements or architecture.

---

# 18. NEVER DO THESE

Never:

- infer task completion from previous AI prose alone;
- mark work VERIFIED without evidence;
- invent sprint numbers;
- invent dependencies;
- fabricate test results;
- fabricate commits;
- fabricate approvals;
- silently change approved scope;
- silently bypass security requirements;
- assume an unfinished task is complete because another task depends on it;
- start random backlog work after completing a task;
- leave WBS/documentation knowingly stale.

---

# 19. FINAL RESPONSE AFTER EACH TASK

After completing an atomic task, report:

## Completed
WBS ID and title.

## Implementation
What changed.

## Verification
Tests and evidence.

## Documentation Updated
Files changed.

## WBS State
Previous status → current status.

## Remaining Issues
Anything unresolved.

## Recommended Next Action
Exactly one WBS item.

## Approval Required
Only when applicable.

Do not automatically begin the next task unless the current user instruction
explicitly permits continuous execution.

---

# 20. GUIDING PRINCIPLE

A fresh AI account with zero conversational history must be capable of opening
this repository and determining:

- what the project is;
- what has already happened;
- what is currently happening;
- what remains;
- what is blocked;
- what must be verified;
- what should happen next.

If it cannot, project documentation is incomplete.