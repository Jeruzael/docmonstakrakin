# Bun lifecycle inventory guard correction — 2026-10-21

## Scope and disposition

This corrective candidate starts at independently rechecked remote master
`3705f67b2be4c0506a0933ee6c8d6976b0edda9c`. It changes exactly four paths:

1. `.github/workflows/ci.yml`
2. `scripts/lib/bunLifecycleInventory.mjs`
3. `scripts/testBunLifecycleInventory.ts`
4. `docs/07_verification/BUN_LIFECYCLE_GUARD_CORRECTION_20261021.md`

The candidate restores a fail-closed CI qualification. It does not change any
package declaration, lockfile, package lifecycle trust, runtime, canonical WBS,
historical evidence, credential, quorum, privileged route, agent, Gate 7 or release
state. The original operator dependency junction is unchanged; no installation
was run through it. No operational authority or native-package compatibility is
conferred by this parser.

## Actual failure preserved

PR #64's [Quality & Build job](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39578907017/job/119151310644)
reported provider success although the intended native lifecycle check did not
execute. The captured raw job log has SHA-256
`bf8c9701695ae570983b92f2191137d48faae6b95d4f1c2bc5b71a06a6688c50`.
Its 2026-10-21T09:42:21Z output contains:

```text
bun pm untrusted v1.4.2 (744846f84)
./node_modules/@google/genai @2.22.0
 » [preinstall]: echo 'preinstall: no-op'
./node_modules/protobufjs @7.6.6
 » [postinstall]: node scripts/postinstall
These dependencies had their lifecycle scripts blocked during install.
If you trust them and wish to run their scripts, use `bun pm trust`.
/home/runner/work/_temp/b1b2668b-5ee0-42d2-ad9c-adf49f82429d.sh: line 12: rg: command not found
```

The failed `rg` command was inside an `if` condition. Bash's `set -e` did not make
that condition fatal; subsequent successful steps hid the absent check. This is
an invalid qualification, not evidence that a required native package was
actually blocked: the captured inventory names only the two disclosed non-native
packages above. Earlier provider-green records remain historical records and
must retain this qualification.

## Corrected verification boundary

Both OS jobs pass the captured inventory to the same plain Node stdin guard.
Linux retains `set -euo pipefail` and command-substitution acquisition; the guard
is a standalone pipeline command, outside any conditional. Windows separately
checks the Bun acquisition exit code and the Node guard exit code. Its step sets
both native-output decoding and pipeline-output encoding to BOMless UTF-8 within
that process, before acquisition. No host-wide encoding or toolchain is changed.
Missing Bun, a failed inventory command, a missing guard module and guard
rejection all fail the job. The helper does not acquire tools or execute script
text. It emits only package names, versions, hook names and explicit qualification;
untrusted script bodies and native errors are not echoed by the helper.
Node's `import.meta.main` identifies actual CLI execution, including a directory
junction or symlink alias; imports remain inert. A lexical entry-path comparison
was reproduced as a false green and replaced. A runtime without this main-module
facility fails explicitly instead of silently skipping admission (Node 22.18+
provides it; the exercised version is 22.23.3).

The candidate accepts the observed nonempty Bun 1.4.2 inventory protocol, with
Linux/Windows separators, LF/CRLF, optional UTF-8 BOM, complete package/hook
records, SemVer versions and exact explanatory footer. It rejects malformed
UTF-8, ANSI/control wrappers, incomplete or unknown formats, duplicate packages
or hooks, unknown lifecycle labels, nested/traversing paths, and any inventory
containing blocked `better-sqlite3`, `argon2` or `esbuild`. Remaining blocked
scripts, including `@google/genai` and `protobufjs`, remain blocked and disclosed;
the guard never invokes `bun pm trust` or treats them as fully qualified.

Candidate parser admission limits are 65,536 raw bytes, 128 package records and
4,096 characters per script body. They bound parsing work; they are not production
memory or package-trust budgets. Exact byte/package boundaries are tested and
proofs are never truncated. Empty/no-package inventories, another Bun version,
ANSI output and unfamiliar output fail closed. No zero-untrusted-output grammar
was independently established, so supporting it would require a reviewed format
extension. This conservative compatibility restriction is explicit.

The guard bounds stdin reads before concatenation. The CI shell captures the
provider output before invoking it; this candidate does not separately bound
Bun's execution, the shell's capture allocation or total job memory. Existing job
timeouts remain in force. Synchronous stdin assumes the already captured pipe
closes; it is not a general service input interface.

## Reproducible local evidence and remaining gates

The focused script is automatically discovered by the existing complete
regression runner and is invoked early in Linux Quality & Build and Windows
Native Qualification. It uses built-in Node modules only and launches real Node
and platform-shell subprocesses with inert synthetic providers. Reproduce with
Node 22.23.3 and PowerShell 7 on Windows, or Node 22.23.3 and Bash on Linux:

```text
node scripts/testBunLifecycleInventory.ts
```

Local Windows execution used the isolated officially hashed and Authenticode
verified portable Node 22.23.3; it did not change the host Node installation.
Final focused result: **20/20 named groups, exit 0**, including all three blocked
native packages, exact admission limits, malformed versions/UTF-8, unknown CLI
options, missing module, actual aliased CLI rejection/success, inert imports,
failed supplier with valid-looking stdout, actual shell guard rejection and actual
shell success. Node syntax checks and diff whitespace
checks also passed. No full suite, build, fresh install or Linux execution was
performed locally for this correction; exact candidate GitHub CI remains required.

Genuine RED evidence was retained before correction:

| Evidence | Actual result | Captured-log SHA-256 |
| --- | --- | --- |
| Missing guard before implementation | exit 1, `The dependency-free fail-closed Bun inventory guard must exist` | `0703e8b5f1ce06d6ac68a8a43bce63d2411a20d76167c5b57208cddde4d7df75` |
| Malformed version admitted by initial parser | exit 1, expected rejection but subprocess returned 0 | `de11e13eb88100eb99773539463c7547a86f5600c1a7434eb3f06ed61af85e6b` |
| Headless PowerShell positive transport fixture | exit 1, `BUN_INVENTORY_INVALID` | `5073141e5fdefbaf9219def293d6e0ccac77bca6721d25f333e2e20d0e0b9be` |
| Actual directory-junction CLI bypass | exit 1, expected rejection but aliased subprocess returned 0 | `56ee66ea115e32b0e3458de6cd8436a7f0acf8e2b88c71dcf9341f4e57929b36` |
| Final focused subprocess run | exit 0, 20/20 | `a46586e131b41177803938e65a6848f931cfb0f1bcd203f976159ca707e86a9b` |

The transport RED was traced to `[Console]::OutputEncoding` being `ibm437` in
a headless child while `$OutputEncoding` was UTF-8: the native UTF-8 hook marker
was decoded incorrectly before piping. Explicit process-scoped UTF-8 fixes this;
the parser's strict UTF-8 and hook grammar were preserved. The committed focused
tests and the failure excerpts above are usable without private temporary files.

Before integration, require all four actual candidate CI jobs, fresh Linux and
Windows frozen Bun qualification through this guard, complete regression,
controlled documentation, and independent exact-HEAD human review. Provider
success alone is insufficient if the logs show an acquisition/guard failure.
Candidate preflight does not replace actual post-merge checks. Rollback is a
normal reviewed revert of these four paths; reverting would restore the known
qualification defect, so dependent integration must remain held until a valid
replacement check is in place. No bypass or permissive fallback is authorized.
