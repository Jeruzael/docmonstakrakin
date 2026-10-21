import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardView} from '../src/components/DashboardView.tsx';
import {TopBar} from '../src/components/TopBar.tsx';
import {INITIAL_PROJECTS,INITIAL_NEXT_ACTION,INITIAL_QUESTIONS} from '../src/data/initialData.ts';

const project={...structuredClone(INITIAL_PROJECTS[0]),progress:{...INITIAL_PROJECTS[0].progress,requirementsReadiness:0,releaseReadiness:0}};
const html=renderToStaticMarkup(React.createElement(DashboardView,{project,nextAction:INITIAL_NEXT_ACTION,questions:INITIAL_QUESTIONS,onNavigate:()=>{},onOpenOverrideModal:()=>{}}));
assert(!html.includes('On track'));assert(!html.includes('✓ Compliant'));assert(html.includes('Discovery incomplete'));
console.log('PASS incomplete discovery cannot render unconditional on-track or compliance assertions');
assert(html.includes('Stored planning score'));assert(html.includes('does not establish verification, compliance or release approval'));
console.log('PASS stored planning scores are distinguished from actual verification and release decisions');
const bar=renderToStaticMarkup(React.createElement(TopBar,{currentProject:project,projects:[project],onSelectProject:()=>{},onOpenCreateWizard:()=>{},onOpenSearch:()=>{}}));
assert(!bar.includes('>Gio<'));assert(bar.includes('Local workspace'));assert(bar.includes('Reviewer identity is shown separately'));
console.log('PASS local workspace chrome does not invent an authenticated operator identity');
