import {createHash} from 'node:crypto';
import type {Project, Requirement, WorkItem} from '../../src/types.ts';

/** A proposed task is planning context, never approval or verification evidence. */
export function proposeRequirementWork(project:Project,requirement:Requirement,timestamp:string):WorkItem {
  const digest=createHash('sha256').update(requirement.id).digest('hex');
  return {
    id:`WORK-REQ-${digest}`,type:'TASK',title:`Implement: ${requirement.title}`,
    description:requirement.statement,status:'PROPOSED',
    priority:requirement.priority==='CRITICAL'?'P0':requirement.priority==='HIGH'?'P1':'P2',
    risk:project.computedRisk?.level ?? 'MEDIUM',sprint:0,requirements:[requirement.id],dependencies:[],
    acceptanceCriteria:[...(requirement.acceptanceCriteria || [])],
    checklist:[{text:'Review governing requirement and acceptance criteria',done:false}],
    tests:[],evidence:[],owner:project.owner,updatedAt:timestamp,
  };
}
