# docmonstakrakin

A local-first development control plane for project discovery, requirements,
linked work, offline prompt compilation, controlled documents, evidence and audit.
The React UI runs with an Express server on IPv4 loopback. The ordinary local
workflow and disposable demo need no Gemini or other external-provider key.
Live provider calls are a separate capability; no credential setup is part of
this quick start.

The 2026-10-22 local-MVP work is integrated through
[PR #80](https://github.com/Jeruzael/docmonstakrakin/pull/80). It adds ordinary-project
managed documents, local verification sessions, reviewer diagnostics and explicit
scope-bound progress. The [actual integration closure](docs/07_verification/LOCAL_MVP_COMPLETION_CLOSURE_20261022.md)
records exact commits and execution results; the [normal-checkout runbook](docs/08_handoff/LOCAL_MVP_REPRODUCIBILITY_20261022.md)
separates synthetic end-to-end and configured fresh CI qualification from the
untouched original workstation. Production authorization remains incomplete.

The operational workspace candidate adds default-enforced persistent sessions,
explicit project permissions and transactional private SQLite persistence. Start
with the [current workspace guide](docs/08_handoff/OPERATIONAL_WORKSPACE_GUIDE_20261022.md)
and [combined qualification checkpoint](docs/07_verification/OPERATIONAL_SECURITY_COMPLETION_20261022.md).
These controls do not establish operational WBS trust, independent human
appointments, shared/remote deployment acceptance or release permission.

## Install in a fresh checkout

Use the committed lockfile in a disposable checkout with no existing
`node_modules` or dependency junction. On Windows or Linux, use qualified
**Node 22.23.3 x64**, or a separately qualified patched Node 22 x64 runtime.
The locked dependencies require at least 22.12.0 within Node 22; that engine
minimum alone is not security qualification. The original Node 22.21.1 runtime
is not qualified for this setup by its older fixture measurements. Native packages include pinned
`better-sqlite3` and `argon2`.
Source builds require Python and a compatible C++ toolchain: MSVC plus a Windows
SDK on Windows, or build tools on Linux. Windows ownership tests also use
PowerShell 7.

```text
node --version
npm --version
git rev-parse --show-toplevel
git rev-parse HEAD
npm ci --foreground-scripts
npm audit --json
```

Keep normal lifecycle scripts enabled. In addition to hosted npm/Bun checks,
a fresh normal npm installation on the original Windows host now passes in a
regular isolated checkout with a genuine task-private SDK and new header cache.
The original SDK/cache failures remain in the
[additive qualification receipt](docs/07_verification/OPERATOR_WINDOWS_QUALIFICATION_20261022.md).
The operator's original installation and dependency junction were not changed.
Retained-package test runs are separate evidence. See the
[native compatibility record](docs/07_verification/WINDOWS_NATIVE_COMPATIBILITY_20261021.md),
[developer handoff](docs/08_handoff/FAST_TRACK_DEVELOPMENT_HANDOFF.md) and
[CI workflow](.github/workflows/ci.yml) for prerequisites, installer differences
and preserved failures. Do not install through an existing dependency junction.

## Try the local workflow

From a checkout containing the integrated product demo, run:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/demoLocalProduct.ts
```

Open its printed loopback URL. This builds the actual app and starts the actual
server in a marked disposable workspace with no inherited provider credentials.
Create a project, answer discovery questions, propose a requirement-linked task,
move it to IN_PROGRESS, compile an offline prompt, and inspect reports and audit.
The printed reviewer login is synthetic and confined to this demo. Ctrl+C stops
the server and removes its owned workspace.

The [walkthrough](docs/08_handoff/LOCAL_PRODUCT_DEMO.md) covers controlled-document
editing and expected denials; the
[acceptance matrix](docs/07_verification/LOCAL_PRODUCT_DEMO_ACCEPTANCE_20261021.md)
records what the journey proves. Follow the current integration checkpoint in
the developer handoff when reading historical branch instructions in these records.

Run from the deliberately selected checkout root. Normal startup uses ENFORCED
access, serves the built UI and exposes setup instructions until a private
authority is explicitly initialized offline. There are no default accounts.
Build first, then start in PowerShell:

```powershell
$env:NODE_ENV = 'development'
npm run build
npm run dev
```

In a POSIX shell:

```sh
npm run build
NODE_ENV=development npm run dev
```

To build and serve the built static UI, in PowerShell:

```powershell
npm run build
$env:NODE_ENV = 'production'
npm start
```

In a POSIX shell:

```sh
npm run build
NODE_ENV=production npm start
```

ENFORCED always serves the built `dist` UI. Explicit
`DMK_WORKSPACE_ACCESS=LOCAL_DEVELOPMENT` selects the older unscoped demo contract;
in that mode NODE_ENV selects Vite versus built assets. Use the
[workspace guide](docs/08_handoff/OPERATIONAL_WORKSPACE_GUIDE_20261022.md) for
offline initialization, membership and optional private TLS. Open
[the default local address](http://127.0.0.1:3000).
`HOST` accepts only `127.0.0.1`; `PORT` is an integer from 1 through 65535.
Restart from the same checkout root: state and the built UI use the process
working directory.

[.env.example](.env.example) lists configuration names. Normal startup reads the
process environment; copying this reference to `.env` or `.env.local` does not
configure the server. No environment file or provider credential is needed for
the disposable local journey. The older
[reviewer setup guide](docs/07_verification/REVIEWER_SESSION_SETUP.md) describes
LOCAL_DEVELOPMENT's roster contract; ENFORCED resolves identity from its private
authority instead of that environment roster.

## Persistence and recovery

ENFORCED uses `.security/authority.sqlite` for principals, sessions, membership,
security audit and the authoritative project snapshot. Its scoped mutations
commit snapshot, policy/revision checks and replay records atomically. It never
shadow-writes the old JSON or initializes the unrelated SecretStore. An explicit
offline `init --import-state` may copy the fixed `.local/project-state.json`
input while preserving its bytes and granting no imported ownership. See the
workspace guide for private backup and unactivated restore preparation.

Explicit LOCAL_DEVELOPMENT retains JSON snapshot persistence and SecretStore
startup. Its filesystem document transactions use `.local/document-transactions/`
and `.local/project-state.write.lock`. These legacy files are not an alternate
authority for ENFORCED recovery.

The default private SecretStore uses `.secrets/store.enc`, `.secrets/store.salt`
and `.secrets/.machine_token`; an older installation may also have
`.docmonstakrakin/.machine_token`. Keep private state and recovery material out
of source control and shared logs. Project packages exclude those secrets and
authenticated reviewer login sessions. Restart preserves persisted project data and clears
in-memory reviewer sessions, so reviewers sign in again.

On corrupt state, a stale snapshot, an unknown transaction outcome, a remaining
writer lock or required document recovery, stop mutations and preserve the
files and error for operator recovery. Do not delete snapshots, locks, journals,
salts or machine tokens to force startup. An external snapshot edit requires a
controlled restart after the operator establishes the authoritative state.
`ci:prepare` and CI fixture flags must never initialize or repair an operator
checkout; they can replace project state and clear test locks/journals.

## Verify in a disposable test checkout

Browser suites need Playwright Chromium. On Windows use
`npx playwright install chromium`; Linux hosted CI uses
`npx playwright install --with-deps chromium` to include browser system libraries.
The focused isolated product journey is:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testLocalProductJourney.ts
```

It creates its own fixture and writes a JSON result and screenshots under
`runtime/product-demo/`. For the full sequence, use a disposable checkout with
no operator state. The `ci:*` test commands initialize synthetic `.local` state;
they are not a way to initialize a real project. Run sequentially on a constrained
machine. For example, in a dedicated PowerShell test session:

```powershell
Import-Module Microsoft.PowerShell.Utility
$env:PSModulePath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/Modules'
$env:DMK_ALLOW_CI_FIXTURE = '1'
npm run ci:quality
npm run ci:controlled-docs
npm run ci:regression
```

The module import and process-only `PSModulePath` setting are required by the
existing Windows account fixture's module autoload path. Keep these settings in
the dedicated test session. `DMK_ALLOW_CI_FIXTURE` permits test fixtures only; it
enables no authentication pilot or product authority. Hosted jobs use `CI=true`.
No bootstrap, canonical WBS apply, live credential provisioning or release
operation is needed for this sequence.

## Current boundaries

- The route policy in `server/security/apiRoutePolicy.ts` is the source for
  classification. ENFORCED resolves current sessions and explicit project policy;
  project ownership grants no independent-human review role. LOCAL_DEVELOPMENT
  remains visibly unscoped; loopback/Origin checks alone authenticate no user.
- Authentication and governance development pilots are explicitly disconnected.
  Their tests and synthetic roles grant no real identity, permission or quorum.
  Live agent execution, Gate 7 authorization and release remain outside the demo.
- In ENFORCED, ordinary managed-document creation/save requires an authenticated
  human with explicit project-write permission, a reason and confirmation.
  LOCAL_DEVELOPMENT retains its configured SO/LA author contract.
  Self-project filesystem documents retain their existing registry restrictions.
  The [synthetic creation demo](scripts/demoSyntheticDocumentCreation.ts) remains a
  separate fixture. Neither creation path grants governance approval or trust.
- Candidate verification sessions bind exact task/build/evidence state and require
  separate locally asserted persons with fresh human attestations. Package hashes
  and local review approval confer no trusted production evidence or release
  authority. See the reviewer setup and reproducibility guides for the boundaries.
- Planning health, stored lifecycle status and evidence references are not
  authenticated acceptance. Release evaluation binds exact scope and separates
  local/CI observations from unavailable production evidence; viewing or
  exporting a report does not perform signoff or release a project.

Historical prototype reference: [original AI Studio project](https://ai.studio/apps/d9657610-b77b-48c1-b428-5ab58b77c232).
