# Local reviewer session setup

The 2026-10-22 reviewer-setup and verification changes are integrated through
PR #80; see the [exact closure and qualifications](LOCAL_MVP_COMPLETION_CLOSURE_20261022.md).
This guide describes their configuration
contract. It enrolls no person, issues no credential and claims no human approval.
Reviewer operations fail closed when the operator has not configured an eligible
roster. Ordinary legacy project access retains its existing local partial
containment boundary.

## Operator-controlled configuration

`DMK_HUMAN_REVIEWERS` is a JSON map supplied in the server process environment.
Each account record contains a stable unique `id`, `kind: "HUMAN"`, a `roles`
array and a `credentialVerifier`. The recognized human review roles are
`Security Officer` and `Lead Architect`. Account names, IDs, credentials and
verifiers are private operator configuration; this guide supplies no example
people or passwords. Agent records use `kind: "AGENT"` and cannot obtain human
review authority from a role label.

The verifier format is `<salt>:<hash>`: 16 random salt bytes encoded as 32
lowercase hex characters, followed by the 32-byte result of Node's
`scryptSync(password, saltHex, 32)` encoded as 64 lowercase hex characters. The
salt argument is the hex string, matching the server. Existing private operator
provisioning owns verifier generation. Keep password entry and verifier values
out of command history, tickets, chat, source control and screenshots. Do not
copy fixture credentials into an operator roster.

Normal startup reads process environment variables. `.env.example` lists
configuration names and is not an automatically loaded environment file.
Configure or correct the roster through the operator's existing private
workflow and restart the server to refresh its in-memory roster snapshot.

## Verification person binding

The local verification workflow also requires `personId` on each human
account used for verification. Its exact format is
`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`; surrounding whitespace is invalid.
It is an operator's **LOCAL_ROSTER_ASSERTION**, not identity enrollment, proof
of a real person or evidence of real-world independence. Accounts belonging to
the same person must retain the same person binding. Distinct account IDs alone
cannot establish distinct people.

An evidence submitter needs a configured human Security Officer or Lead Architect
session. The submitter cannot review their own evidence. Two other distinct
locally asserted people must cover Security Officer and Lead Architect review;
one person with two accounts or both roles cannot fill both review slots. Each
reviewer must freshly attest reviewing the exact submitted digest and their
independence. The local operator remains responsible for establishing actual
independence. The workflow reports local human attestation and explicitly keeps
`trustedProductionEvidence: false`.

## Read-only setup guidance and sessions

The header exposes read-only aggregate setup guidance: absent or
malformed configuration, missing roles, ambiguous account IDs, missing person
bindings and insufficient independent-person coverage. These diagnostics reveal
no account names, person values, passwords or verifiers. They create no roster
record, permission, session or human appointment. Route authorization checks the
configured server identity on every request.

Use the header Sign in form with operator-issued credentials. Roles come from
the server roster. Sessions last 30 minutes, use HttpOnly and SameSite=Strict
cookies, and are revoked by logout or server restart. After changing accounts,
reload the relevant document/verification context and provide fresh personal
confirmation. Pending work from an earlier session must not become a new
reviewer's attestation.

The supported normal service is direct IPv4 loopback. This local reviewer
mechanism is not SSO, production team authentication or an authorization system
for remote deployment. Setup and diagnostic success authorize no privileged
administration, agent execution, Gate 7 or release activation.
