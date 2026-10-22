import type {ProjectStore} from '../projectStore.ts';
import type {VerificationSession} from '../../src/verificationTypes.ts';
import {VerificationError} from './errors.ts';

/** Engineering admission limits for this local JSON store, not production capacity claims. */
export const VERIFICATION_RETENTION_LIMITS = {
  sessionsPerProject:100, sessionsTotal:500,
  bytesPerSession:1_048_576, bytesPerProject:8_388_608, bytesTotal:33_554_432,
} as const;
export const verificationRetainedBytes=(session:unknown)=>Buffer.byteLength(JSON.stringify(session),'utf8');
const exceeded=(label:string):never=>{throw new VerificationError(413,`VERIFICATION_STORAGE_LIMIT: ${label}; no retained records were truncated`);};

/** Count every compact-JSON byte, including draft/submitted duplication, notes and metadata. */
export function assertVerificationRetention(store:Pick<ProjectStore,'verificationSessions'>&Partial<Pick<ProjectStore,'verificationArchives'>>,candidate?:{projectId:string;session:VerificationSession}) {
  const collections=store.verificationSessions;
  if(!collections||typeof collections!=='object'||Array.isArray(collections))throw new VerificationError(409,'Invalid retained verification collection; preserve state for recovery');
  const archives=store.verificationArchives??{};
  if(!archives||typeof archives!=='object'||Array.isArray(archives))throw new VerificationError(409,'Invalid retained verification archives; preserve state for recovery');
  const projectIds=new Set([...Object.keys(collections),...Object.keys(archives),...(candidate?[candidate.projectId]:[])]);
  let totalCount=0,totalBytes=0,totalBatches=0;
  for(const projectId of projectIds) {
    const saved=collections[projectId]??[];
    if(!Array.isArray(saved))throw new VerificationError(409,'Invalid retained verification project collection; preserve state for recovery');
    let sessions=saved;
    if(candidate&&candidate.projectId===projectId) {
      const found=saved.some(s=>s.id===candidate.session.id);
      sessions=found?saved.map(s=>s.id===candidate.session.id?candidate.session:s):[...saved,candidate.session];
    }
    const batches=archives[projectId]??[];
    if(!Array.isArray(batches))throw new VerificationError(409,'Invalid retained verification archive batches; preserve state for recovery');
    totalBatches+=batches.length;if(totalBatches>100)exceeded('maximum 100 archive batches across projects');
    let archiveOverhead=0;
    for(const archive of batches) {
      if(!archive||archive.schemaVersion!==1||archive.trust!=='UNTRUSTED_IMPORTED_HISTORY'||archive.activeReviewAuthority!==false||archive.trustedProductionEvidence!==false||!Array.isArray(archive.sessions))throw new VerificationError(409,'Invalid untrusted verification history; preserve state for recovery');
      archiveOverhead+=verificationRetainedBytes(archive)-archive.sessions.reduce((total,session)=>total+verificationRetainedBytes(session),0);
      sessions=[...sessions,...archive.sessions];
    }
    if(sessions.length>VERIFICATION_RETENTION_LIMITS.sessionsPerProject)exceeded('maximum 100 active and archived sessions per project');
    totalCount+=sessions.length;if(totalCount>VERIFICATION_RETENTION_LIMITS.sessionsTotal)exceeded('maximum 500 sessions across projects');
    let projectBytes=archiveOverhead;
    for(const session of sessions) {
      const bytes=verificationRetainedBytes(session);
      if(bytes>VERIFICATION_RETENTION_LIMITS.bytesPerSession)exceeded('maximum 1 MiB compact JSON per session');
      projectBytes+=bytes;
    }
    if(projectBytes>VERIFICATION_RETENTION_LIMITS.bytesPerProject)exceeded('maximum 8 MiB compact JSON per project');
    totalBytes+=projectBytes;if(totalBytes>VERIFICATION_RETENTION_LIMITS.bytesTotal)exceeded('maximum 32 MiB compact JSON across projects');
  }
}
/** Parent package imports can validate a complete proposed store before mutating it. */
export const assertVerificationStoreRetention=assertVerificationRetention;
