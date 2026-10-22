import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPortablePackage,verifyPortablePackage,serializePortablePackage,parsePortablePackage,computeCanonicalStateHash,computeEnvelopeHash} from '../server/package/portablePackage.ts';
import type {ProjectManagedDocument} from '../src/managedDocumentTypes.ts';
const project={id:'PRJ-MANAGED-PACKAGE',name:'Synthetic portable records',stateVersion:3} as any;
const document: ProjectManagedDocument={id:'MDOC-00000000-0000-4000-8000-000000000001',projectId:project.id,path:'managed-documents/MDOC-00000000-0000-4000-8000-000000000001.md',title:'Design notes',kind:'ARCHITECTURE',format:'MARKDOWN',content:'# Draft\n\nExact UTF-8 bytes: 台灣.\n',sha256Digest:createHash('sha256').update('# Draft\n\nExact UTF-8 bytes: 台灣.\n','utf8').digest('hex'),createdAt:'2026-10-22T00:00:00.000Z',updatedAt:'2026-10-22T00:01:00.000Z',requestIds:['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']};
const input={project,managedDocuments:[structuredClone(document)]};
const pkg=createPortablePackage(input);
assert.deepEqual((pkg.knowledge as any).managedDocuments,[document],'managed content and server-owned metadata must be included in portable knowledge');
assert.equal(verifyPortablePackage(pkg).valid,true);
const serialized=serializePortablePackage(pkg);
const roundtrip=parsePortablePackage(serialized);
assert.deepEqual((roundtrip.knowledge as any).managedDocuments,[document]);
assert.equal(verifyPortablePackage(roundtrip).valid,true);
assert.equal(roundtrip.seal.canonicalStateHash,pkg.seal.canonicalStateHash);
assert.equal(roundtrip.seal.envelopeHash,pkg.seal.envelopeHash);
input.managedDocuments[0].requestIds.push('00000000-0000-4000-8000-000000000004');
input.managedDocuments[0].content='# Mutated caller input\n';
assert.deepEqual((pkg.knowledge as any).managedDocuments,[document],'package record ownership must be detached from mutable caller storage');
let rejected=0;
for(const mutate of [
 (p:any)=>p.knowledge.managedDocuments[0].projectId='PRJ-FOREIGN',
 (p:any)=>p.knowledge.managedDocuments[0].content='# Forged bytes\n',
 (p:any)=>p.knowledge.managedDocuments[0].path='docs/00_control/MASTER_WBS.yaml',
 (p:any)=>p.knowledge.managedDocuments[0].id='DOC-CTRL-002',
 (p:any)=>p.knowledge.managedDocuments[0].authority='GENERATED_PROJECTION',
 (p:any)=>p.knowledge.managedDocuments[0].reviewer={kind:'HUMAN',roles:['Security Officer']},
 (p:any)=>p.knowledge.managedDocuments[0].status='APPROVED',
 (p:any)=>p.knowledge.managedDocuments[0].requestIds.push(p.knowledge.managedDocuments[0].requestIds[0]),
 (p:any)=>p.knowledge.managedDocuments.push(structuredClone(p.knowledge.managedDocuments[0])),
 (p:any)=>p.knowledge.managedDocuments=null,
 (p:any)=>{p.knowledge.project.id='PRJ-DOCMONSTAKRAKIN';p.knowledge.managedDocuments[0].projectId='PRJ-DOCMONSTAKRAKIN';},
]){
 const forged=JSON.parse(serialized);mutate(forged);
 forged.seal.canonicalStateHash=computeCanonicalStateHash(forged.knowledge);
 forged.seal.envelopeHash=computeEnvelopeHash(forged.manifest,forged.seal.canonicalStateHash,forged.seal.auditRootHash,forged.seal.auditEventsCount);
 const result=verifyPortablePackage(forged);
 assert.equal(result.valid,false,'recomputed public hashes cannot authorize malformed/cross-project content or HUMAN authority');
 assert.ok(result.errors.some(error=>error.includes('managed document')));rejected++;
}
assert.throws(()=>createPortablePackage({project,managedDocuments:[{...document,projectId:'PRJ-FOREIGN'}]} as any),/MANAGED_DOCUMENT_INTEGRITY_FAILED/);
assert.throws(()=>createPortablePackage({project,managedDocuments:[{...document,approval:{kind:'HUMAN'}}]} as any),/MANAGED_DOCUMENT_INTEGRITY_FAILED/);
const legacy=createPortablePackage({project});
assert.equal(Object.hasOwn(legacy.knowledge,'managedDocuments'),false,'omission preserves pre-extension knowledge shape');
// Literal captured from the unchanged baseline package implementation, before extension.
assert.equal(legacy.seal.canonicalStateHash,'a4512e49ce1f696d2b370fe9373ad20013d1abcf8b13a70e7948fd0a25d584e4');
assert.equal(verifyPortablePackage(parsePortablePackage(serializePortablePackage(legacy))).valid,true);
const empty=createPortablePackage({project,managedDocuments:[]} as any);
assert.deepEqual((empty.knowledge as any).managedDocuments,[]);
assert.equal(verifyPortablePackage(empty).valid,true);
assert.notEqual(empty.seal.canonicalStateHash,legacy.seal.canonicalStateHash,'an explicit empty collection participates in the seal; absence remains distinct');
console.log(`PASS managed document exact roundtrip, detached records, ${rejected} resealed hostile inputs, create validation, and legacy canonical hash compatibility`);
