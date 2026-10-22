import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {VerificationPanel} from '../../src/components/VerificationPanel';
import type {WorkItem} from '../../src/types';
import '../../src/index.css';
const item:WorkItem={id:'TASK-1',type:'TASK',title:'Fixture task',description:'Synthetic',status:'IN_PROGRESS',priority:'P1',risk:'LOW',sprint:1,requirements:[],dependencies:[],acceptanceCriteria:['Fixture criterion'],checklist:[],tests:[],evidence:[],updatedAt:'2026-10-22T00:00:00.000Z'};
function Harness(){const [project,setProject]=useState('A');return <main className="max-w-5xl mx-auto p-3"><button onClick={()=>setProject('A')}>Switch to project A</button><button onClick={()=>setProject('B')}>Switch to project B</button><VerificationPanel projectId={project} workItems={[item]}/></main>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
