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

Keep normal lifecycle scripts enabled. Hosted Windows qualification uses fresh
npm and pinned Bun installations with the existing CI toolchain; it does not
prove a clean install on the original operator machine. That machine's recorded
Windows SDK/space issue remains unresolved, and its original dependency junction
was not repaired. Retained-package test runs are separate evidence. See the
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

Run from the deliberately selected checkout root. For development in PowerShell:

```powershell
$env:NODE_ENV = 'development'
npm run dev
```

In a POSIX shell:

```sh
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

`NODE_ENV=production` selects the built `dist` UI; the `start` script does not set
it. Both modes remain a local loopback service with the existing partial
authorization boundary. Open [the default local address](http://127.0.0.1:3000).
`HOST` accepts only `127.0.0.1`; `PORT` is an integer from 1 through 65535.
Restart from the same checkout root: state and the built UI use the process
working directory.

[.env.example](.env.example) lists configuration names. Normal startup reads the
process environment; copying this reference to `.env` or `.env.local` does not
configure the server. No environment file or provider credential is needed for
the ordinary local journey. The [reviewer setup guide](docs/07_verification/REVIEWER_SESSION_SETUP.md)
describes operator-owned roster configuration without enrolling people or
providing credentials.

## Persistence and recovery

Normal startup reads `.local/project-state.json` when present and initializes
the private SecretStore. Successful project mutations atomically persist project
collections and audit there. Managed documents keep content, digest,
metadata and replay history in the same snapshot. Existing filesystem document
transactions use `.local/document-transactions/`; `.local/project-state.write.lock`
coordinates snapshot writers.

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
  route classification. Legacy local project access remains partially contained;
  loopback and Origin checks authenticate no user. Reviewer sessions gate selected
  operations and grant no general project membership or privileged administration.
- Authentication and governance development pilots are explicitly disconnected.
  Their tests and synthetic roles grant no real identity, permission or quorum.
  Live agent execution, Gate 7 authorization and release remain outside the demo.
- After candidate integration, ordinary managed-document creation/save requires a
  configured HUMAN Security Officer or Lead Architect, a reason and confirmation.
  Self-project filesystem documents retain their existing registry restrictions.
  The [synthetic creation demo](scripts/demoSyntheticDocumentCreation.ts) remains a
  separate fixture. Neither creation path grants governance approval or trust.
- Candidate verification sessions bind exact task/build/evidence state and require
  separate locally asserted persons with fresh human attestations. Package hashes
  and local review approval confer no trusted production evidence or release
  authority. See the reviewer setup and reproducibility guides for the boundaries.
- Planning health, stored lifecycle status and evidence references are not
  authenticated acceptance. Release evaluation still has documented heuristics;
  viewing or exporting a report does not perform signoff or release a project.

Historical prototype reference: [original AI Studio project](https://ai.studio/apps/d9657610-b77b-48c1-b428-5ab58b77c232).
