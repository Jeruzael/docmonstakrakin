import assert from 'node:assert/strict';
import { Project } from '../src/types';
import { reconcileProjectList } from '../src/utils/projectListReconciliation';

console.log('--- Testing Project-List Stale Metadata Reconciliation ---');

const prevProject: Project = {
  id: 'PRJ-DOCMONSTAKRAKIN',
  name: 'Docmonstakrakin',
  description: 'Current description at v121',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 121,
} as unknown as Project;

const incomingStaleProject: Project = {
  id: 'PRJ-DOCMONSTAKRAKIN',
  name: 'Docmonstakrakin',
  description: 'Outdated description from v120',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 120, // Stale!
} as unknown as Project;

const incomingFreshProject: Project = {
  id: 'PRJ-DOCMONSTAKRAKIN',
  name: 'Docmonstakrakin',
  description: 'Fresh description at v121',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 121,
} as unknown as Project;

// Case 1: Fresh project is accepted directly
const res1 = reconcileProjectList(
  [incomingFreshProject],
  [prevProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121 }
);
assert.equal(res1.acceptedProjects.length, 1);
assert.equal(res1.acceptedProjects[0].description, 'Fresh description at v121');
assert.equal(res1.acceptedProjects[0].stateVersion, 121);
assert.equal(res1.staleProjects.length, 0);

// Case 2: Stale incoming data with valid previous object
// Must preserve PREVIOUS object, NOT mutate or bump stale incoming object
const res2 = reconcileProjectList(
  [incomingStaleProject],
  [prevProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121 }
);
assert.equal(res2.acceptedProjects.length, 1);
assert.equal(
  res2.acceptedProjects[0].description,
  'Current description at v121',
  'Must preserve previously accepted description'
);
assert.equal(res2.acceptedProjects[0].stateVersion, 121, 'Must preserve confirmed version 121');
assert.equal(
  res2.acceptedProjects[0] === incomingStaleProject,
  false,
  'Must NOT accept the stale incoming object'
);
assert.equal(res2.staleProjects.length, 0, 'Resolved via previous accepted object');
assert.ok(
  Array.isArray((res2 as any).staleIncomingProjectIds) && (res2 as any).staleIncomingProjectIds.includes('PRJ-DOCMONSTAKRAKIN'),
  'staleIncomingProjectIds must report incoming stale project IDs even when preserved via safe cache'
);

// Case 3: Stale incoming data with NO previous object
// Must hold stale entry out of accepted list
const res3 = reconcileProjectList(
  [incomingStaleProject],
  [], // No previous object
  { 'PRJ-DOCMONSTAKRAKIN': 121 }
);
assert.equal(res3.acceptedProjects.length, 0, 'No safe object -> held out of accepted list');
assert.equal(res3.staleProjects.length, 1, 'Marked as unresolved stale entry');
assert.equal(res3.staleProjects[0].id, 'PRJ-DOCMONSTAKRAKIN');

// Case 4: Multiple projects mixed
const otherFreshProject: Project = {
  id: 'PRJ-FIXTURE-B',
  name: 'Fixture B',
  description: 'Fixture B at v50',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 50,
} as unknown as Project;

const res4 = reconcileProjectList(
  [incomingStaleProject, otherFreshProject],
  [prevProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121, 'PRJ-FIXTURE-B': 50 }
);
assert.equal(res4.acceptedProjects.length, 2);
assert.equal(res4.acceptedProjects[0].description, 'Current description at v121');
assert.equal(res4.acceptedProjects[1].description, 'Fixture B at v50');

// Case 5: reconcileListFreshness tests
import { reconcileListFreshness } from '../src/utils/projectListReconciliation';

// Rule A: Newly stale project records required version
const freshUnresolved = {};
const unres1 = reconcileListFreshness(
  freshUnresolved,
  [incomingStaleProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  ['PRJ-DOCMONSTAKRAKIN']
);
assert.equal(unres1['PRJ-DOCMONSTAKRAKIN'], 121, 'Rule A: must record required version 121');

// Rule B: Still stale project retains existing entry and preserves max required version
const unres2 = reconcileListFreshness(
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  [incomingStaleProject],
  { 'PRJ-DOCMONSTAKRAKIN': 122 },
  ['PRJ-DOCMONSTAKRAKIN']
);
assert.equal(unres2['PRJ-DOCMONSTAKRAKIN'], 122, 'Rule B: must preserve higher confirmed version 122');

// Rule C & E: Absent from response retains unresolved entry (omission is not verified deletion)
const unres3 = reconcileListFreshness(
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  [otherFreshProject], // PRJ-DOCMONSTAKRAKIN omitted
  { 'PRJ-DOCMONSTAKRAKIN': 121, 'PRJ-FIXTURE-B': 50 },
  []
);
assert.equal(unres3['PRJ-DOCMONSTAKRAKIN'], 121, 'Rule C: omitted project remains unresolved');

// Empty response also retains unresolved entry
const unres3Empty = reconcileListFreshness(
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  [], // Empty response
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  []
);
assert.equal(unres3Empty['PRJ-DOCMONSTAKRAKIN'], 121, 'Rule C: empty response retains unresolved entry');

// Rule D: Fresh metadata at or above required clears unresolved entry
const unres4 = reconcileListFreshness(
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  [incomingFreshProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121 },
  []
);
assert.equal(unres4['PRJ-DOCMONSTAKRAKIN'], undefined, 'Rule D: fresh version 121 clears unresolved entry');

// Case 6: reconcileProjectList with omitted unresolved project
// When safe cache exists: preserves safe cache
const res6Safe = reconcileProjectList(
  [otherFreshProject], // PRJ-DOCMONSTAKRAKIN omitted
  [prevProject, otherFreshProject],
  { 'PRJ-DOCMONSTAKRAKIN': 121, 'PRJ-FIXTURE-B': 50 },
  ['PRJ-DOCMONSTAKRAKIN']
);
assert.equal(res6Safe.acceptedProjects.length, 2);
assert.ok(res6Safe.acceptedProjects.some(p => p.id === 'PRJ-DOCMONSTAKRAKIN' && p.stateVersion === 121));

// When NO safe cache exists: marked as stale, excluded from accepted
const res6NoSafe = reconcileProjectList(
  [otherFreshProject], // PRJ-DOCMONSTAKRAKIN omitted
  [otherFreshProject], // No safe cache for PRJ-DOCMONSTAKRAKIN
  { 'PRJ-DOCMONSTAKRAKIN': 121, 'PRJ-FIXTURE-B': 50 },
  ['PRJ-DOCMONSTAKRAKIN']
);
assert.equal(res6NoSafe.acceptedProjects.length, 1);
assert.equal(res6NoSafe.staleProjects.length, 1);
assert.equal(res6NoSafe.staleProjects[0].id, 'PRJ-DOCMONSTAKRAKIN');

console.log('All project list reconciliation unit tests passed!');
