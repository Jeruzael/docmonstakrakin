# docmonstakrakin Deployment Architecture
## Runtime Environments, Container Packaging & Ingress Routing

**Document ID:** DOC-ARC-005  
**Baseline:** v0.1 Local-First MVP  

---

## 1. Local-First Desktop Execution

In normal local developer usage, docmonstakrakin runs as a unified local application service:
- Node.js runtime hosting Express on `0.0.0.0:3000`;
- Single entry-point server bundling both the REST API endpoints and the compiled Vite static assets (`dist/index.html`);
- Zero external database daemon dependencies for offline development;
- Local secrets stored in OS native keystore or AES-256-GCM encrypted local vault.

---

## 2. Containerized / Cloud Run Runtime (Active Preview Environment)

In containerized or cloud sandbox execution (such as Google Cloud Run):
- The container binds exclusively to **Port 3000** behind an external reverse proxy;
- Secrets are passed as environment variables into `server.ts` or resolved via an encrypted local fallback file;
- The workspace filesystem root is isolated, with `/` distinct from the workspace directory `.`.

---

## 3. Production Build & Bundling Flow

The application build pipeline is orchestrated via `package.json`:
1. **Frontend Build:** `vite build` compiles React components into static HTML/CSS/JS artifacts in `dist/`.
2. **Backend Server Bundle:** `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` produces a single CommonJS bundle for rock-solid runtime execution without ESM relative path issues.
3. **Production Start:** `node dist/server.cjs` serves the applet cleanly in container or desktop environments.
