import {INITIAL_AGENT_ROLES} from './initialData.ts';

export interface PublishedPromptSkill {id:string;description:string;instructions:string;authority:'BUNDLED_SOURCE';actions:('task:read')[]}
export interface PromptSkillPublication {schema:'PROMPT_SKILL_PUBLICATION/1';epoch:number;revokedIds:string[];assets:PublishedPromptSkill[]}
// Source publication is the trust boundary. Mutable project role cards and
// imported prompts are never consulted by this registry.
const sourceAssets:PublishedPromptSkill[]=INITIAL_AGENT_ROLES.map(role=>({id:role.id,description:role.description,instructions:role.promptTemplate,authority:'BUNDLED_SOURCE',actions:role.id==='AGT-TASK-READ-01'?['task:read']:[]}));
export function publishedPromptSkills():PromptSkillPublication {
 return{schema:'PROMPT_SKILL_PUBLICATION/1',epoch:1,revokedIds:[],assets:structuredClone(sourceAssets)};
}
