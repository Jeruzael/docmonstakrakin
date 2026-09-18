import type {EditableArtifact,NormalizedProposalChange} from '../../src/proposalTypes.js';
import {ProposalValidationError,proposalCollections} from '../../src/data/proposalContract.js';

export function validateProposalTargets(change:NormalizedProposalChange,store:any,projectId:string,index:number,editable?:EditableArtifact[]) {
  const base=`proposed_changes[${index}]`;
  const context={proposal_id:change.proposalId,artifact_type:change.artifactType,target_id:change.target?.artifactId};
  if(change.action==='MODIFY'){
    const target=change.target!;
    if(change.artifactType==='CODE_MODIFICATION')throw new ProposalValidationError('UNSUPPORTED_ARTIFACT_TYPE',`${base}.artifact_type`,'CODE_MODIFICATION supports CREATE only; target an existing WORK_ITEM for a proposed work amendment.',context);
    const entries=Object.entries({...proposalCollections,FEATURE:'features'}).filter(([type])=>type!=='CODE_MODIFICATION');
    const actual=entries.find(([,collection])=>(store[collection]?.[projectId] || []).some((a:any)=>a.id===target.artifactId));
    if(!actual)throw new ProposalValidationError('TARGET_NOT_FOUND',`${base}.target.artifact_id`,'Modification target does not exist in this project.',context);
    if(actual[0]!==change.artifactType || actual[0]!==target.artifactType)throw new ProposalValidationError('TARGET_TYPE_MISMATCH',`${base}.target.artifact_type`,'Target exists but has a different canonical artifact type.',{...context,expected_type:actual[0],received_type:actual[0]!==change.artifactType?change.artifactType:target.artifactType});
    if(editable && !editable.some(a=>a.artifact_id===target.artifactId && a.artifact_type===target.artifactType))throw new ProposalValidationError('TARGET_NOT_EDITABLE',`${base}.target.artifact_id`,'Target is outside this compiled package editable scope.',context);
  }
  for(const [field,collection] of [['requirements','requirements'],['features','features']] as const)for(const [refIndex,ref] of (change[field] || []).entries()){
    if(!(store[collection]?.[projectId] || []).some((a:any)=>a.id===ref))throw new ProposalValidationError('INVALID_REFERENCE',`${base}.${change.schemaVersion==='1.1'?'proposed.':''}${field}[${refIndex}]`,'Reference does not exist in this project.',{...context,target_id:ref});
  }
}
