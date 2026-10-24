import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
type CapacityDiagnostic = {
  caseName: string;
  phase: string;
  ordinal: number;
  lastCompleted?: {operation: string; phase: string; ordinal: number; elapsedMs: number};
};
// Parent-side test observation only. Never emit request values, tokens, verifier
// strings, proof bytes or private paths, and never retry an uncertain operation.
async function observe<T>(diagnostic: CapacityDiagnostic, operation: string, run: () => Promise<T>): Promise<T> {
  const began = performance.now(), ordinal = ++diagnostic.ordinal, phase = diagnostic.phase;
  const label = /^[A-Za-z]{1,40}$/.test(operation) ? operation : 'unclassified';
  try {
    const value = await run();
    diagnostic.lastCompleted = {operation: label, phase, ordinal, elapsedMs: Math.round(performance.now() - began)};
    return value;
  } catch (error) {
    const code = (error as {code?: unknown})?.code;
    if (code === 'STORE_REQUEST_TIMEOUT' || code === 'STORE_UNAVAILABLE') {
      console.error('CAPACITY_OPERATION_DIAGNOSTIC ' + JSON.stringify({
        case: diagnostic.caseName, phase, operation: label, ordinal,
        elapsedMs: Math.round(performance.now() - began), code,
        lastCompleted: diagnostic.lastCompleted, node: process.version,
      }));
    }
    throw error;
  }
}
const messages: string[]=[];
const originalError=console.error;
console.error=(line)=>messages.push(String(line));
try {
 const context: CapacityDiagnostic={caseName:'synthetic-control',phase:'audit-fill-4094',ordinal:0};
 const payload={token:'must-not-log-private-token'};
 assert.equal(await observe(context,'authorize',async()=>payload),payload);
 assert.equal(messages.length,0);
 const failure=Object.assign(Error('must-not-log-private-token'),{code:'STORE_REQUEST_TIMEOUT',request:payload});
 let caught;try{await observe(context,'issueSession',async()=>{throw failure;});}catch(error){caught=error;}
 assert.equal(caught,failure);assert.equal(messages.length,1);
 assert.equal(messages[0].includes('must-not-log-private-token'),false);
 const log=JSON.parse(messages[0].slice('CAPACITY_OPERATION_DIAGNOSTIC '.length));
 assert.equal(log.operation,'issueSession');assert.equal(log.phase,'audit-fill-4094');assert.equal(log.ordinal,2);
 assert.equal(log.lastCompleted.operation,'authorize');assert.equal(log.code,'STORE_REQUEST_TIMEOUT');
 assert.deepEqual(Object.keys(log).sort(),['case','code','elapsedMs','lastCompleted','node','operation','ordinal','phase']);
}finally{console.error=originalError;}
console.log('PASS diagnostic success preserves value without logging payload');
console.log('PASS timeout observation retains error identity and excludes private content');