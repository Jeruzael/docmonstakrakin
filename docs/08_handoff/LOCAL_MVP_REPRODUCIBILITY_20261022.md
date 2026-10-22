# Local-MVP normal-checkout reproducibility candidate — 2026-10-22

This runbook describes expected behavior after parent integration. It is not a
startup/install receipt, production security qualification, human approval or
release decision. The parent must replace pending execution entries with the
actual integrated HEAD, environment, commands and results. This subtask reviewed
source and corrected documentation; it ran no installation, startup, browser,
build, native-heavy or full regression command.

## Select the workspace

Use a deliberately selected ordinary Git checkout with its own dependency
directory. Confirm the checkout root, exact commit, Node and npm versions using
the [README commands](../../README.md#install-in-a-fresh-checkout). Source-build
prerequisites and fresh-install evidence remain separate from runs using retained
packages. Do not install through a `node_modules` junction, repair an operator
SDK or replace operator dependencies as part of this runbook.

Run development mode or explicitly set `NODE_ENV=production` when serving a
built UI, as shown in the [README](../../README.md#try-the-local-workflow).
Both use direct IPv4 loopback; the default is `http://127.0.0.1:3000`.
`.env.example` lists configuration names. Normal startup uses the process
environment and does not automatically load `.env` or `.env.local`.

Read-only reviewer-setup guidance can explain missing server configuration.
Actual roster provisioning stays in the operator's private workflow; this
runbook contains no person, account, password or verifier values. See
[reviewer setup](../07_verification/REVIEWER_SESSION_SETUP.md) for the candidate
person-binding and independent-human policy.

## Expected ordinary-project journey

Perform this after the parent has integrated the candidate routes, collections,
UI and package import/export wiring. Use a dedicated ordinary test project with
non-sensitive content; do not modify the canonical self-project, WBS, history,
receipts or release state.

| Step | Expected behavior | Actual execution |
| --- | --- | --- |
| Start from the selected checkout root | Direct loopback service opens; no provider credential is required | Pending parent run |
| Inspect reviewer setup and sign in through the header if authorized | Server-resolved human roles and setup guidance; no enrollment or default credentials | Pending parent run |
| Create an ordinary project and one Markdown/text document | Server ID/virtual path, content digest, one state-version increment and audit; no governance approval | Pending parent run |
| Edit, preview diff, validate and confirm save | Expected project version and previous digest must match; stale input requires reload/review | Pending parent run |
| Stop cleanly and restart from the same checkout root | Saved content, digest, replay history and audit survive; the reviewer session requires sign-in again | Pending parent run |
| Export the project package and verify it | Optional managed content and metadata participate in integrity; no private SecretStore or human session is included | Pending parent run |
| Import through the integrated UI into an intended ordinary test context | Exact project-bound managed records survive the import contract; conflicting targets fail clearly | Pending parent run |
| Inspect imported content, digest and replay history | Exact stored values match the export; package hashes confer no HUMAN authority or production trust | Pending parent run |
| Exercise a verification draft and independent review when an operator-qualified setup exists | Exact task/build/environment/bundle digest, separate local person assertions, fresh confirmations and no release activation | Pending parent run |

Import follows the existing target project ID and explicit conflict handling.
This candidate provides no cross-project remapping or hidden overwrite step.
A separate ordinary test checkout may be used for import; select it intentionally
and retain its own private state. Do not copy a running operator snapshot into
it to bypass conflict handling.

The package engine has focused unit coverage documented in
[the managed-document implementation note](../07_verification/LOCAL_MVP_MANAGED_DOCUMENTS_20261022.md).
Those checks do not constitute execution of the HTTP/UI journey above. A missing
managed-document field remains compatible with older packages. Imported records
carry content integrity and replay metadata, never authority fields.

## Persisted and private files

All paths below are relative to the selected process working directory:

| Path | Purpose |
| --- | --- |
| `.local/project-state.json` | Atomic project snapshot, audit and candidate managed/verification collections |
| `.local/document-transactions/` | Recovery journals for existing registered filesystem document transactions |
| `.local/project-state.write.lock` | Exclusive snapshot writer lock |
| `.secrets/store.enc`, `.secrets/store.salt`, `.secrets/.machine_token` | Private default encrypted SecretStore and recovery material |
| `.docmonstakrakin/.machine_token` when present | Possible legacy private machine-token material |

Project package export excludes SecretStore files and authenticated reviewer
login sessions. Treat
snapshots and package content according to their sensitivity; `.gitignore` is
not a backup or access-control mechanism. Keep private recovery material in the
operator's existing protected backup workflow. Stop writers before inspecting
or restoring state. Preserve local ownership and cryptographic checks.

On corrupt state, unknown transaction outcome, stale persisted bytes or a
remaining lock, stop mutations and preserve the state, journals and error for
operator recovery. Do not delete a snapshot, lock, journal, salt, machine token
or ownership marker to force startup. Do not run `ci:prepare`, set `CI=true` or
enable `DMK_ALLOW_CI_FIXTURE` in an operator checkout: fixture initialization
can replace project state and clear test locks/journals. A controlled restart
after an external edit reloads the state the operator has established as
authoritative; it does not repair corruption.

## Evidence to record before publication

Record exact HEAD, working-directory identity, Node/npm versions, installation
method and whether dependencies were fresh or retained. Record each command's
actual exit status and meaningful API/UI result. Separate normal-checkout
restart/package evidence from disposable demos, native-install qualification,
unit tests and CI history. Keep failed and pending checks visible. Local roster
assertions and package hashes provide no proof of authenticated production
producers, actual human independence, Gate 7 or release authority.
