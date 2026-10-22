# Local MVP reviewer setup diagnostics — 2026-10-22

## Design and acceptance

This bounded change makes local reviewer setup failures distinguishable without changing identity, credential, session, role, quorum, or route authorization behavior. The operator-controlled roster remains authoritative. Setup diagnostics are observations, never authority or evidence of real-world human identity.

Acceptance criteria:

- An anonymous session GET distinguishes absent/empty configuration, malformed configuration, missing Security Officer/Lead Architect roles, and insufficient distinct account coverage.
- The response exposes only fixed status values, required role labels, booleans, and an aggregate binding count. It exposes no roster usernames, account/person ID values, credential verifiers, passwords, or session tokens. Authenticated `identity` retains its existing shape.
- The UI distinguishes setup failure, rejected credentials, cross-origin rejection, rate limiting, and uncertain transport/server outcomes using fixed, actionable messages.
- Passwords are cleared after sign-in attempts. No credentials are automatically retried. An explicit session check uses GET with same-origin credentials, retains uncertainty until a valid response, and preserves session-state notifications.
- Verification setup reports local person-binding gaps separately from ordinary login. Two distinct reviewer persons and a third distinct submitter person are needed; the submitter must retain existing SO/LA authority and cannot approve their own evidence.
- No credentials, reviewer enrollment, real identity mappings, production authentication, pilot activation, or human approval records are created.

## API contract

`GET /api/governance/session` retains `identity` and adds `setup`:

| Field | Meaning |
| --- | --- |
| `state` | `not-configured`, `malformed`, or `configured`; valid empty JSON is not configured. |
| `missingRoles` | Required role labels absent from structurally usable HUMAN records. AGENT records never count. |
| `distinctHumanRoleCoverage` | SO/LA role coverage exists across different account IDs; this is not proof of different people. |
| `verification.trust` | Always `LOCAL_ROSTER_ASSERTION`. |
| `verification.validHumanPersonBindings` | Number of usable HUMAN account bindings with valid person aliases and unambiguous account IDs; not a count of unique people. |
| `verification.missingHumanPersonBindings` | At least one structurally usable HUMAN account lacks a valid person alias. |
| `verification.ambiguousAccountIds` | Duplicate account IDs occur anywhere in the raw roster, including records otherwise unusable for coverage. |
| `verification.distinctPersonRoleCoverage` | SO/LA coverage exists across different locally asserted persons after ambiguous accounts are excluded. |
| `verification.distinctSubmitterCoverage` | Such a reviewer pair also has a third distinct, bound person with existing SO/LA authority available as submitter. |

`POST` and `DELETE` keep their existing response and authorization semantics. Missing optional setup fields from an older server do not invalidate a valid identity. Malformed diagnostic values are never reflected as arbitrary UI text. The server snapshots setup when installing the identity routes, matching its existing roster lifecycle.

## Safe operator recovery

The UI directs reviewers to their local operator. The operator can inspect `DMK_HUMAN_REVIEWERS` privately in the server environment and restart the server after a deliberate configuration correction. The roster is a JSON object keyed by operator-issued username. Diagnostic validation expects nonempty account IDs, string role arrays, `HUMAN` or `AGENT` kind, and the existing scrypt verifier format: 32 lowercase hexadecimal salt characters, a colon, and 64 lowercase hexadecimal hash characters. This diagnostic validation is conservative and does not change which existing credentials the login handler accepts.

For the separate verification workflow, each HUMAN account needs an operator-controlled `personId` matching `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$` exactly; surrounding whitespace is invalid. Account IDs must be unique. Multiple accounts for one person retain the same person alias and never count as separate people. The operator must confirm real-world identity and independence through an appropriate local process; roster strings cannot establish that fact. Keep real roster contents, credentials, verifiers, and identity values out of source control, tickets, and chat. There are no default reviewer credentials or automatic mappings.

## Red/green evidence and checks

Using portable Node 22.23.3 and the existing dependency junction without installing or modifying dependencies:

1. Initial server test failed because GET lacked `setup`; initial component test failed because no missing-configuration guidance was rendered.
2. After implementation, the initial suites passed (18 server / 9 component scenarios).
3. Person-binding extensions failed because aggregate verification fields/guidance were missing, then passed (30 server / 14 component scenarios).
4. A roleless third submitter fixture failed against overly broad submitter coverage. Requiring the existing SO/LA authority made it pass.
5. Final focused checks: `node --import tsx scripts/testReviewerSetup.ts` — **32 passed**; `node --import tsx scripts/testReviewerSetupUi.ts` — **19 passed**; `node node_modules/typescript/bin/tsc --noEmit` — **passed**; `git diff --check` — **passed**.

The invalid-JSON server fixture emits the existing generic warning; no raw configuration is logged. Server tests use an isolated loopback Express instance and synthetic credentials only. Component tests transpile the actual component in memory with a small hook/element adapter and deferred transport; they do not validate browser layout or React scheduling itself.

## Integration and limits

Independent agent review found two reliability mismatches. Diagnostics now exclude account IDs and usernames longer than 128 characters, matching the separate evidence principal resolver; login acceptance remains unchanged. Optional diagnostic state is checked as a string before union validation, so a malformed JSON object cannot invalidate an otherwise valid authenticated session. Both failures were reproduced before correction. Updated focused results: **34 server scenarios and 20 component cases passed**; logs are retained locally under `runtime/local-mvp-reviewer-review/`. These are agent checks, not human approval or proof of enrolled independent people.

- Coordinate the aggregate person-binding rules with the verification workflow resolver: exact alias syntax, duplicate account IDs, same-person aliases, existing governance authority, and submitter/reviewer separation must stay aligned.
- Existing browser session tests, browser build, native integration tests, full regression, and CI are intentionally deferred to the parent sprint's serialized integration checks. No claim that those checks have passed is made here.
- The in-memory component harness verifies diagnostic selection, handler requests, clearing sensitive input, duplicate-check exclusion, and phase notifications. Real browser coverage remains required for scheduling and rendered layout.
- No changes were made to `server.ts`, `src/types.ts`, project storage, route policy, or quorum enforcement. No commit, push, PR, merge, pilot activation, or production signoff is part of this snapshot.
- Worktree: `C:/Users/HomePC/.codex/worktrees/campaign-auth/docmonstakrakin-version-sync`; branch `codex/local-mvp-reviewer-20261022` created from `d503323aad1002f7325ba3a45faf4bee261686a9`. Prior branch `codex/final-discovery-save-sequencing` at `c6d6e3fde57166309d1153fe6557ebd6d5af8ace` remains preserved.
