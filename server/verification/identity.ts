import type {ReviewerIdentity} from '../proposals/identity.ts';
import type {VerificationPrincipal} from '../../src/verificationTypes.ts';

/** A personId is an operator assertion linking accounts, not proof of real human independence. */
export function resolveVerificationPrincipal(identity:ReviewerIdentity, rawRoster:string|undefined):VerificationPrincipal|undefined {
  if(identity.kind!=='HUMAN'||identity.roleSource!=='LOCAL_SERVER_ROSTER')return;
  if(typeof identity.id!=='string'||!identity.id.trim()||identity.id.length>128||typeof identity.name!=='string'||!identity.name.trim()||identity.name.length>128||!Array.isArray(identity.roles)||identity.roles.some(role=>typeof role!=='string'))return;
  let roster:any;
  try {roster=JSON.parse(rawRoster??'{}');} catch {return;}
  if(!roster||typeof roster!=='object'||Array.isArray(roster)||!Object.hasOwn(roster,identity.name))return;
  const record=roster[identity.name];
  if(!record||record.id!==identity.id||record.kind!=='HUMAN'||!Array.isArray(record.roles))return;
  if(Object.values(roster).filter((r:any)=>r&&r.id===identity.id).length!==1)return;
  if(typeof record.personId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(record.personId))return;
  if(JSON.stringify([...record.roles].sort())!==JSON.stringify([...identity.roles].sort()))return;
  return {identityId:identity.id,username:identity.name,personId:record.personId,roles:[...identity.roles],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'};
}
