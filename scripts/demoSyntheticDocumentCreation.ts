import express from 'express';
import {randomBytes,scryptSync} from 'node:crypto';
import {localRequestBoundary} from '../server/security/localPerimeter.ts';
import {installReviewerIdentity} from '../server/proposals/identity.ts';
import {createSyntheticDocumentCreationPilot} from '../server/docs/syntheticCreationPilot.ts';

const password='Synthetic-document-demo-only!',username='synthetic-author';
const salt=randomBytes(16).toString('hex');
const savedRoster=process.env.DMK_HUMAN_REVIEWERS;
process.env.DMK_HUMAN_REVIEWERS=JSON.stringify({[username]:{id:'TEST-ONLY-DOCUMENT-AUTHOR',kind:'HUMAN',roles:['Security Officer'],credentialVerifier:`${salt}:${scryptSync(password,salt,32).toString('hex')}`}});
const app=express();app.use(localRequestBoundary);app.use(express.json({limit:'128kb'}));
const identity=installReviewerIdentity(app);
if(savedRoster===undefined)delete process.env.DMK_HUMAN_REVIEWERS;else process.env.DMK_HUMAN_REVIEWERS=savedRoster;
const pilot=createSyntheticDocumentCreationPilot(identity.requireHuman);
app.use('/api/product-demo/documents',pilot.router);
const server=app.listen(0,'127.0.0.1',()=>{
  console.log(`Disconnected creation pilot: http://127.0.0.1:${(server.address() as {port:number}).port}`);
  console.log(`Synthetic login: ${username}; password: ${password}`);
  console.log('Synthetic role only. One fixed external document; normal application registry stays unchanged.');
});
let closing=false;const close=()=>{if(closing)return;closing=true;server.close(()=>{pilot.close();process.exit(0);});};
process.once('SIGINT',close);process.once('SIGTERM',close);
