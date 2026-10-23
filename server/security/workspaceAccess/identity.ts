import type {ReviewerIdentity} from '../../proposals/identity.ts';
import type {VerificationPrincipal} from '../../../src/verificationTypes.ts';
import type {WorkspacePrincipal} from './contracts.ts';
const principals=new WeakMap<ReviewerIdentity,WorkspacePrincipal>();
/** The server's durable local roster is an identity source, not real-world enrollment proof. */
export function workspaceReviewerIdentity(principal:WorkspacePrincipal):ReviewerIdentity{
 if(!principal||principal.kind!=='HUMAN'||principal.disabled||typeof principal.id!=='string'||typeof principal.name!=='string'||typeof principal.personId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(principal.personId)||!Array.isArray(principal.roles)||principal.roles.some(r=>!['Security Officer','Lead Architect'].includes(r)))throw Error('WORKSPACE_IDENTITY_INVALID');
 const snapshot={...principal,roles:[...principal.roles]};Object.freeze(snapshot.roles);Object.freeze(snapshot);
 const identity:ReviewerIdentity={id:principal.id,name:principal.name,roles:[...principal.roles],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER'};
 Object.freeze(identity.roles);Object.freeze(identity);principals.set(identity,snapshot);return identity;
}
export function isWorkspaceIdentity(identity:ReviewerIdentity):boolean{return principals.has(identity);}
export function workspaceVerificationPrincipal(identity:ReviewerIdentity):VerificationPrincipal|undefined{
 // The historical verification/archive contract requires a configured review
 // role even for its submitter. Project ownership never supplies that role.
 const principal=principals.get(identity);if(!principal||principal.kind!=='HUMAN'||principal.disabled||!principal.roles.some(r=>['Security Officer','Lead Architect'].includes(r)))return;
 return{identityId:principal.id,username:principal.name,personId:principal.personId,roles:[...principal.roles],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'};
}
