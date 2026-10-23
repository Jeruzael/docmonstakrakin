const actions=new Set(['project:read','project:write','project:review','project:export','project:import']);
/** UI observation only. The server reauthorizes every actual operation. */
export function workspaceProjectActions(value:unknown):string[]|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const project=value as Record<string,any>,access=project.workspaceAccess;
 if(typeof project.id!=='string'||!access||typeof access!=='object'||Array.isArray(access)||access.projectId!==project.id||!Number.isSafeInteger(access.policyRevision)||access.policyRevision<0||!Array.isArray(access.allowedActions)||access.allowedActions.length>5||access.allowedActions.some((v:unknown)=>typeof v!=='string'||!actions.has(v))||new Set(access.allowedActions).size!==access.allowedActions.length)return null;
 return[...access.allowedActions];
}
