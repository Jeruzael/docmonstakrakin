import {startLocalProductDemo,DEMO_PASSWORD,DEMO_REVIEWER} from './fixtures/localProductDemo.ts';

const fixture=await startLocalProductDemo();
console.log(`Disconnected synthetic product demo: ${fixture.base}`);
console.log(`Synthetic reviewer: ${DEMO_REVIEWER}; synthetic password: ${DEMO_PASSWORD}`);
console.log('These fixture-only roles are not real human appointments. No external credentials are loaded.');
console.log('Workspace is disposable. Ctrl+C stops the server and removes only its marked fixture.');
let closing=false;const close=async()=>{if(closing)return;closing=true;await fixture.close();process.exit(0);};
process.once('SIGINT',close);process.once('SIGTERM',close);
await new Promise(()=>{});
