import { inspectWorkspaceCapacity } from '../server/security/workspaceAccess/capacityInspector.ts';

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--workspace'){
  process.stdout.write(JSON.stringify({schema:'WORKSPACE_CAPACITY_OBSERVATION/1',status:'BLOCKED',reason:'CAPACITY_ARGUMENTS_INVALID',activated:false,freshnessEstablished:false,pilotAuthorized:false})+'\n');
  process.exitCode=2;
}else{
  const result=await inspectWorkspaceCapacity(args[1]);
  process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=['VALID_BOUNDED','FULL'].includes(result.status)?0:2;
}
