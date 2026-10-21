# docmonstakrakin

A local-first development control plane for project discovery, requirements,
linked work, offline prompt compilation, controlled documents, evidence and audit.
The React UI runs with an Express server on IPv4 loopback. The ordinary local
workflow and disposable demo need no Gemini or other external-provider key.
Live provider calls are a separate capability; no credential setup is part of
this quick start.

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

For ordinary development against a deliberately selected local workspace:

```text
npm run dev
```

The default address is `http://127.0.0.1:3000`. Normal startup uses that checkout's
local project state and initializes its SecretStore; it is not the disposable
demo. Use the demo above for first-run exploration. The optional configuration
names are documented in [.env.example](.env.example); no `.env.local` file or
external-provider credential is required for the local journey. `npm run build`
produces the UI and bundled server; `npm start` runs that build locally. This is
not a remote-deployment procedure.

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

- Ordinary product routes retain their existing partial-containment policy:
  45 legacy local unscoped registrations, 14 blocked privileged registrations,
  seven specialized reviewer registrations and three reviewer-session registrations.
  Loopback and Origin checks do not authenticate a user; keep this a local tool.
- Authentication and governance development pilots are explicitly disconnected.
  Their tests and synthetic roles grant no real identity, permission or quorum.
  Live agent execution, Gate 7 authorization and release remain outside the demo.
- Ordinary external-project document creation is unavailable. The separately
  invoked [synthetic creation demo](scripts/demoSyntheticDocumentCreation.ts)
  is described in the walkthrough and is not mounted by normal startup.
- Planning health, stored lifecycle status and evidence references are not
  authenticated acceptance. Release evaluation still has documented heuristics;
  viewing or exporting a report does not perform signoff or release a project.

Historical prototype reference: [original AI Studio project](https://ai.studio/apps/d9657610-b77b-48c1-b428-5ab58b77c232).
