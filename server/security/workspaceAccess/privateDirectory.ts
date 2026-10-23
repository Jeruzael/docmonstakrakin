import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkspaceSecurityError } from './contracts.ts';
// The bundled artifact retains the committed worker/helper in its checkout.
// Source fixtures may select a workspace independently of their process cwd.
const helperFile = typeof __dirname === 'string'
  ? path.resolve(__dirname, path.basename(__dirname) === 'dist' ? '../server/security/workspaceAccess/privateBoundary.cjs' : 'privateBoundary.cjs')
  : fileURLToPath(new URL('./privateBoundary.cjs', import.meta.url));
const boundary = createRequire(helperFile)(helperFile);
export interface PrivateWorkspaceHandle { workspaceRoot: string; root: string; workspaceIdentity: string; rootIdentity: string; lockRaw: string; lockIdentity: string }
function mapped<T>(operation: () => T): T { try { return operation(); } catch (e) { throw new WorkspaceSecurityError(typeof (e as any)?.code === 'string' && /^WORKSPACE_[A-Z_]+$/.test((e as any).code) ? (e as any).code : 'WORKSPACE_PATH_INVALID'); } }
export function acquirePrivateWorkspace(root: string, initialize: boolean): PrivateWorkspaceHandle {
  return mapped(() => { const h = boundary.acquire(boundary.capture(root, initialize)); try { boundary.assertFiles(h); return h; } catch (e) { try { boundary.release(h); } catch {} throw e; } });
}
export function releasePrivateWorkspace(h: PrivateWorkspaceHandle): void { mapped(() => boundary.release(h)); }
/** Explicit stopped-owner recovery only. Never invoked by open() or close(). */
export function recoverWorkspaceLock(root: string): boolean { return mapped(() => boundary.recover(root)); }
/** Exclusively creates a new directory; never repairs or reowns existing state. */
export function createPrivateDirectory(file: string): string { return mapped(() => boundary.createPrivateDirectory(file)); }
export function assertPrivateDirectory(file: string): string { return mapped(() => boundary.assertPrivateDirectory(file)); }
export function assertPrivateFile(file: string): string { return mapped(() => boundary.assertPrivateFile(file)); }
