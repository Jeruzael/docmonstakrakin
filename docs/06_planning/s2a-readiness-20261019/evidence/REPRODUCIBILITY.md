# Reproducing the disposable experiments

Use a new disposable directory outside any operator project/security store. Never run these probes against a live identity database or install their self-signed certificate in OS/browser trust. The fixture's session checks are deliberately generic and are not application authentication tests.

## Inputs

Copy evidence/benchmark.mjs.txt and evidence/sqlite-worker.mjs.txt into the same sandbox directory as benchmark.mjs and sqlite-worker.mjs. Copy the retained dependency-package-lock.json into separate windows/package-lock.json and linux/package-lock.json directories. Construct each package.json with the root name/version and exact dependencies from the lockfile's packages[""] entry, plus private:true and type:module. The pinned dependencies are better-sqlite3@13.0.3 and argon2@0.45.1.

Use native Windows x64 Node 22.21.1 and the Linux image node:22.21.1-bookworm@sha256:b84d52cd45bfe261096ccbf886955d431b8b9ed01b72eaef588e8886bda09e78. Run npm ci --no-audit --no-fund separately on each platform; never share native node_modules. The slim image lacks required Python for its implicit native build; the build-capable image was used for the successful Linux run.

## Synthetic TLS fixture

Create a sandbox tls directory. In WSL/OpenSSL or the disposable build-capable Linux image, generate a one-day self-signed P-256 leaf into that directory:

```sh
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout fixture-key.pem -out fixture-cert.pem -days 1 \
  -subj /CN=dmk-fixture.localhost \
  -addext subjectAltName=DNS:dmk-fixture.localhost,IP:127.0.0.1
```

The probe explicitly trusts that certificate only for its own HTTPS client and maps its hostname to 127.0.0.1. It never installs a CA, changes hosts files or disables TLS validation. Delete the private fixture key/certificate after the run; do not commit them.

## Windows run

From the sandbox windows dependency directory, set BENCH_WINDOWS_SID to the current WindowsIdentity.User.Value in the process environment. Run Node 22.21.1 with benchmark.mjs, the desired results.json output path and the tls fixture directory as its three arguments. The benchmark creates an OS-temporary uniquely named directory, applies its owner SID DACL, creates only synthetic data and removes that directory in finally.

## Linux run

Install dependencies in the Linux dependency directory using the exact image. For the benchmark, use an ephemeral container with --network none, --read-only, --user 1000:1000, --cap-drop ALL, --security-opt no-new-privileges, --pids-limit 128, --memory 1g and --cpus 2. Mount the probe files and synthetic tls folder read-only, the Linux dependency/output folder at /work, and a newly created labeled disposable local volume at /data. Set BENCH_TMP_ROOT=/data and BENCH_LIMITS to the configured limits.

Initialize only that new volume so uid1000 can create a subdirectory; the benchmark sets its private child to 0700. Use /work as the process directory so createRequire resolves the Linux dependencies, then invoke node /probe/benchmark.mjs /work/linux-results.json /probe/tls. Remove only the verified newly created volume after execution. Do not mount any production store, home directory, Docker socket or operator project.

## Outputs and interpretation

Each successful run produces 34 PASS checks and a JSON report with exact runtime/package versions, sample counts/quantiles, SQLite and KDF timing, queue bounds, RSS/event-loop/TLS metrics and limitations. Inspect the report rather than treating exit 0 as application acceptance. The method's p95 uses sorted[floor(n*.95)], so at 20 samples it equals the maximum. Resources cover the whole probe, not one profile.

The Windows/Linux runs were sequential. The Linux container ran on the same Windows/WSL2 machine with quota 2 CPU/1 GiB and a Docker local data volume; results are not a controlled bare-metal platform comparison. The probe makes no production availability, recovery-time or tenant-isolation claim.

## Governance preview

The previewRegistration helper is retained as text for inspection. Its actual execution used the repository's tsx loader, immutable master bf5d617 and PR #34 head 5912185, and wrote proposed bytes/JSON only into managed temporary output. It calls the repository's PREVIEW validator, checks the dependency graph and negative approval/existing-item/count controls. It does not create a receipt, signatures, canonical edit or runtime projection.
