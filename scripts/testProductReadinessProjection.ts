import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardView} from '../src/components/DashboardView.tsx';
import {TopBar} from '../src/components/TopBar.tsx';
import {INITIAL_PROJECTS,INITIAL_NEXT_ACTION,INITIAL_QUESTIONS} from '../src/data/initialData.ts';
import {DISCOVERY_QUESTION_CATALOG} from '../src/data/discoveryCatalog.ts';
import {projectHealthProjection} from '../src/data/projectHealthProjection.ts';
import type {Question} from '../src/types.ts';
import {releaseHealthProjection} from '../src/data/releaseHealthProjection.ts';

const project={...structuredClone(INITIAL_PROJECTS[0]),progress:{...INITIAL_PROJECTS[0].progress,requirementsReadiness:0,releaseReadiness:0}};
const html=renderToStaticMarkup(React.createElement(DashboardView,{project,nextAction:INITIAL_NEXT_ACTION,questions:INITIAL_QUESTIONS,onNavigate:()=>{},onOpenOverrideModal:()=>{}}));
assert(!html.includes('On track'));assert(!html.includes('✓ Compliant'));assert(html.includes('Discovery incomplete'));
console.log('PASS incomplete discovery cannot render unconditional on-track or compliance assertions');
assert(html.includes('Discovery coverage'));assert(html.includes('does not establish verification, compliance or release approval'));
console.log('PASS calculated discovery coverage is distinguished from actual verification and release decisions');
const bar=renderToStaticMarkup(React.createElement(TopBar,{currentProject:project,projects:[project],onSelectProject:()=>{},onOpenCreateWizard:()=>{},onOpenSearch:()=>{}}));
assert(!bar.includes('>Gio<'));assert(bar.includes('Local workspace'));assert(bar.includes('Reviewer identity is shown separately'));
console.log('PASS local workspace chrome does not invent an authenticated operator identity');

let failures=0;
const check=(name:string,run:()=>void)=>{try{run();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name,error);}};
const fresh={...structuredClone(project),id:'SYNTHETIC-HEALTH',profiles:['WEB_APPLICATION'],specializedProfiles:[],maturity:'GREENFIELD',healthScore:70,progress:{requirementsReadiness:0,architectureReadiness:0,implementation:0,verification:0,securityAssurance:40,releaseReadiness:0}} as typeof project;
const render=(p= fresh,questions=structuredClone(DISCOVERY_QUESTION_CATALOG))=>renderToStaticMarkup(React.createElement(DashboardView,{project:p,nextAction:INITIAL_NEXT_ACTION,questions,onNavigate:()=>{},onOpenOverrideModal:()=>{}}));
check('fresh dashboard exposes discovery inputs instead of bootstrap health and assurance percentages',()=>{
 const page=render();assert(!page.includes('70%'));assert(!page.includes('40%'));assert(page.includes('Discovery coverage'));assert(page.includes('DISCOVERY_COVERAGE/1'));
});
check('wizard-covered questions do not appear as unresolved dashboard gates',()=>{
 const page=render({...fresh,productBaseline:{problemStatement:'Synthetic ticket tracking.',targetUsers:['Synthetic employee'],coreCapabilities:[],coreFeatures:[],primaryWorkflows:[],nonGoals:[],successCriteria:[]}});
 assert(!page.includes('PROD-Q-001'));assert(!page.includes('USER-Q-001'));assert(page.includes('DATA-Q-001'));
});
check('requiredness drives dashboard blockers even when display importance is recommended',()=>{
 const question={...structuredClone(DISCOVERY_QUESTION_CATALOG[0]),id:'SYNTHETIC-REQUIRED',importance:'RECOMMENDED',requiredness:{level:'CORE_MANDATORY'},state:'UNRESOLVED'} as any;
 const page=render(fresh,[question]);assert(page.includes('SYNTHETIC-REQUIRED'));
});
check('missing evidence and release scope render unavailable rather than stored zero progress',()=>{
 const page=render();for(const label of ['Implementation','Verification Evidence','Security Assurance','Release Readiness'])assert.match(page,new RegExp(label+'</span><span[^>]*>Unavailable</span>'));assert(page.includes('Release scope'));
});
check('unresolved project metadata cannot produce an all-gates-clear message',()=>{
 const page=render({...fresh,maturity:undefined},[]);assert(!page.includes('All discovery blockers are resolved!'));assert(page.includes('Project setup decisions'));
});
check('deferred mandatory discovery decisions remain visible as unresolved gates',()=>{
 const question={...structuredClone(DISCOVERY_QUESTION_CATALOG[0]),id:'SYNTHETIC-DEFERRED',state:'DEFERRED',justification:'Synthetic decision pending.'} as any;
 assert(render(fresh,[question]).includes('SYNTHETIC-DEFERRED'));
});
check('legacy saved responses retain catalog metadata and cannot exceed full discovery coverage',()=>{
 const questions:Question[]=structuredClone(DISCOVERY_QUESTION_CATALOG).map(q=>({...q,state:'ANSWERED' as const,answer:'Synthetic recorded answer.'}));
 const legacy=structuredClone(INITIAL_QUESTIONS.find(q=>q.id==='DATA-Q-008')!);
 questions[questions.findIndex(q=>q.id===legacy.id)]=legacy;
 const p={...fresh,technicalBaseline:{sourceControl:{decision_mode:'USER_SPECIFIED',userValue:'Git'}}} as any;
 const result=projectHealthProjection(p,questions).discovery!;
 assert.equal(result.numerator,result.denominator);assert.equal(result.percentage,100);
});
check('recommendation priority comes from its actual severity',()=>{
 const page=renderToStaticMarkup(React.createElement(DashboardView,{project:fresh,nextAction:{...INITIAL_NEXT_ACTION,severity:'MEDIUM'},questions:[],onNavigate:()=>{},onOpenOverrideModal:()=>{}}));
 assert(!page.includes('CRITICAL GATE'));assert(page.includes('MEDIUM priority'));
});
const buttons=(node:any):any[]=>!node?[]:Array.isArray(node)?node.flatMap(buttons):node.props?[...(node.type==='button'?[node]:[]),...buttons(node.props.children)]:[];
const buttonText=(node:any):string=>node==null?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(buttonText).join(''):buttonText(node.props?.children);
check('project fallback recommendation opens discovery rather than work with a project ID',()=>{
 const calls:any[]=[];const tree=DashboardView({project:fresh,nextAction:{...INITIAL_NEXT_ACTION,actionType:'COMPLETE_REVIEW',targetEntityId:fresh.id},questions:[],onNavigate:(...args)=>calls.push(args),onOpenOverrideModal:()=>{}});
 buttons(tree).find(b=>buttonText(b).includes('Review next action'))!.props.onClick();assert.equal(calls[0][0],'discovery');
});
check('adaptive questionnaire footer opens the discovery subtab explicitly',()=>{
 const calls:any[]=[];const tree=DashboardView({project:fresh,nextAction:INITIAL_NEXT_ACTION,questions:[],onNavigate:(...args)=>calls.push(args),onOpenOverrideModal:()=>{}});
 buttons(tree).find(b=>buttonText(b).includes('Open Adaptive Questionnaire'))!.props.onClick();assert.equal(calls[0][0],'discovery');
});
check('legacy recommendation without a target cannot crash the dashboard or navigate to undefined work',()=>{
 const calls:any[]=[];
 const nextAction={id:'LEGACY',title:'Review',reason:'Legacy summary',blocks:[]} as any;
 const props={project:fresh,nextAction,questions:[],onNavigate:(...args:any[])=>calls.push(args),onOpenOverrideModal:()=>{}};
 const page=renderToStaticMarkup(React.createElement(DashboardView,props));assert(page.includes('Review'));
 buttons(DashboardView(props)).find(b=>buttonText(b).includes('Review next action'))!.props.onClick();assert.equal(calls[0][0],'discovery');
});
check('scoped dashboard exposes lifecycle denominator and local evidence without promoting production trust',()=>{
 const p={...fresh,readinessContext:{version:'LOCAL_RELEASE_SCOPE/1' as const,id:'RSC-synthetic',revision:1,targetRelease:fresh.targetRelease,workItemIds:['TASK-ONE'],commitSha:'a'.repeat(40),buildRevision:'synthetic-build',environment:'synthetic-offline',updatedAt:'2026-10-22T00:00:00Z',updatedBy:{identityId:'synthetic',name:'Synthetic',roleSource:'LOCAL_SERVER_ROSTER' as const}}};
 const observation={reviews:[],eligibleSessionIds:[],trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION' as const,trustedProductionEvidence:false as const};
 const summary=releaseHealthProjection(p,[{id:'TASK-ONE',status:'VERIFICATION'},{id:'FUTURE',status:'BACKLOG'}] as any,[{projectId:p.id,workItemId:'TASK-ONE',commitSha:p.readinessContext.commitSha,buildRevision:p.readinessContext.buildRevision,environment:p.readinessContext.environment,observation}]);
 const health=projectHealthProjection(p,[],summary);assert.equal(health.dimensions[0].value,'1 / 1 recorded');assert.equal(health.dimensions[1].value,'0 / 1 locally reviewed');assert.equal(health.dimensions[2].value,'Unavailable');assert.equal(health.dimensions[3].value,'Unavailable');assert.equal(health.releaseScope?.count,1);
 const stale=projectHealthProjection({...p,targetRelease:'different'},[],summary);assert.equal(stale.dimensions[0].value,'Unavailable');
});
process.exitCode=failures?1:0;
