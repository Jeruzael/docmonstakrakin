import assert from 'node:assert/strict';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';

const starts=await Promise.allSettled([startIsolatedVite(process.cwd()),startIsolatedVite(process.cwd())]);
try {
  assert(starts.every(start=>start.status==='fulfilled'),`Two browser fixtures must start concurrently: ${starts.filter(start=>start.status==='rejected').map(start=>String(start.reason)).join('; ')}`);
  const servers=starts.filter(start=>start.status==='fulfilled').map(start=>start.value);
  const urls=servers.map(server=>server.resolvedUrls!.local[0]);assert.equal(new Set(urls).size,2);
  for(const url of urls){assert.notEqual(new URL(url).port,'5173');assert.equal((await fetch(url)).status,200);}
  // Finish the actual initial dependency scan before closing either server;
  // early cancellation otherwise emits a restart error after assertions pass.
  await Promise.all(servers.map(async server=>{await server.environments.client.depsOptimizer?.scanProcessing;await server.waitForRequestsIdle();}));
  console.log('PASS concurrent actual Vite fixtures use distinct ephemeral loopback ports without port-5173 contention');
} finally {await Promise.all(starts.filter(start=>start.status==='fulfilled').map(start=>start.value.close()));}
// Match the existing standalone browser suites: after every owned server closes,
// do not let Vite's retained optimizer service keep the assertion process alive.
process.exit(0);
