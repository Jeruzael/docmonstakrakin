import assert from 'node:assert/strict';
import { Project } from '../src/types';
import {
  reconcileProjectList,
  reconcileListFreshness,
  calculateEffectiveVersionFloors,
  isValidStateVersion,
} from '../src/utils/projectListReconciliation';

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

// Case 7: Version Monotonicity without confirmed save (RED Phase 2.1)
// Previously accepted B at v51, incoming B at v50, confirmed save for B absent/zero
const prevProjectB: Project = {
  id: 'PRJ-FIXTURE-B',
  name: 'ACCEPTED B v51',
  description: 'Accepted metadata at v51',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 51,
} as unknown as Project;

const incomingStaleProjectB: Project = {
  id: 'PRJ-FIXTURE-B',
  name: 'STALE B v50',
  description: 'Stale metadata from v50',
  profiles: ['CORE'],
  owners: ['lead'],
  stateVersion: 50,
} as unknown as Project;

const res7 = reconcileProjectList(
  [incomingStaleProjectB],
  [prevProjectB],
  { 'PRJ-DOCMONSTAKRAKIN': 121 } // No confirmed save for PRJ-FIXTURE-B!
);

// Under Plan A v1.1 invariant:
// Must reject incoming B v50, preserve previously accepted B v51, and report PRJ-FIXTURE-B as stale
assert.equal(res7.acceptedProjects.length, 1);
assert.equal(res7.acceptedProjects[0].name, 'ACCEPTED B v51', 'Must retain accepted B v51 name');
assert.equal(res7.acceptedProjects[0].stateVersion, 51, 'Must retain accepted B v51 version');
assert.ok(
  res7.staleIncomingProjectIds.includes('PRJ-FIXTURE-B'),
  'staleIncomingProjectIds must report PRJ-FIXTURE-B even with no confirmed save'
);
// Case 8: isValidStateVersion contract tests
assert.equal(isValidStateVersion(0), true, '0 is valid safe integer version');
assert.equal(isValidStateVersion(1), true, '1 is valid safe integer version');
assert.equal(isValidStateVersion(100), true, '100 is valid safe integer version');
assert.equal(isValidStateVersion(Number.MAX_SAFE_INTEGER), true, 'MAX_SAFE_INTEGER is valid safe integer version');
assert.equal(isValidStateVersion(-1), false, 'negative integer is invalid');
assert.equal(isValidStateVersion(1.5), false, 'fractional number is invalid');
assert.equal(isValidStateVersion(NaN), false, 'NaN is invalid');
assert.equal(isValidStateVersion(Infinity), false, 'Infinity is invalid');
assert.equal(isValidStateVersion(-Infinity), false, '-Infinity is invalid');
assert.equal(isValidStateVersion(null), false, 'null is invalid');
assert.equal(isValidStateVersion(undefined), false, 'undefined is invalid');
assert.equal(isValidStateVersion('50'), false, 'string "50" is invalid');
assert.equal(isValidStateVersion({}), false, 'object is invalid');
assert.equal(isValidStateVersion([]), false, 'array is invalid');

// Case 9: calculateEffectiveVersionFloors pure helper tests
const floors = calculateEffectiveVersionFloors(
  { 'PRJ-A': 121, 'PRJ-B': 10 },
  { 'PRJ-B': 51, 'PRJ-C': 5 },
  { 'PRJ-A': 120, 'PRJ-C': 20, 'PRJ-D': 1 }
);
assert.equal(floors['PRJ-A'], 121, 'PRJ-A floor is max(121, 0, 120) = 121');
assert.equal(floors['PRJ-B'], 51, 'PRJ-B floor is max(10, 51, 0) = 51');
assert.equal(floors['PRJ-C'], 20, 'PRJ-C floor is max(0, 5, 20) = 20');
assert.equal(floors['PRJ-D'], 1, 'PRJ-D floor is max(0, 0, 1) = 1');

// Case 10: Malformed/invalid stateVersion incoming projects rejected
const malformedIncomingProject: Project = {
  id: 'PRJ-FIXTURE-B',
  name: 'MALFORMED B',
  stateVersion: -1 as any,
} as unknown as Project;

const res10 = reconcileProjectList(
  [malformedIncomingProject],
  [prevProjectB],
  { 'PRJ-FIXTURE-B': 51 }
);
assert.equal(res10.acceptedProjects.length, 1);
assert.equal(res10.acceptedProjects[0].name, 'ACCEPTED B v51', 'Must retain previous safe project');
assert.equal(res10.acceptedProjects[0].stateVersion, 51);
assert.ok(
  res10.staleIncomingProjectIds.includes('PRJ-FIXTURE-B'),
  'Must report malformed version project as stale/invalid'
);

// Case 11: Persistent list freshness across omission and recovery
let unresolvedFreshness: Record<string, number> = {};
// B is reported stale with floor 51
unresolvedFreshness = reconcileListFreshness(
  unresolvedFreshness,
  [incomingStaleProjectB],
  { 'PRJ-FIXTURE-B': 51 },
  ['PRJ-FIXTURE-B']
);
assert.equal(unresolvedFreshness['PRJ-FIXTURE-B'], 51, 'Unresolved floor for B must be recorded as 51');

// Omission: response without B retains unresolved requirement
unresolvedFreshness = reconcileListFreshness(
  unresolvedFreshness,
  [prevProject], // Only project A in response
  { 'PRJ-FIXTURE-B': 51 },
  []
);
assert.equal(unresolvedFreshness['PRJ-FIXTURE-B'], 51, 'Omission of B must retain unresolved requirement at 51');

// Recovery: response with B at v51 clears unresolved requirement
const recoveredProjectB: Project = {
  id: 'PRJ-FIXTURE-B',
  name: 'RECOVERED B v51',
  stateVersion: 51,
} as unknown as Project;
unresolvedFreshness = reconcileListFreshness(
  unresolvedFreshness,
  [recoveredProjectB],
  { 'PRJ-FIXTURE-B': 51 },
  []
);
assert.equal(unresolvedFreshness['PRJ-FIXTURE-B'], undefined, 'Recovery at v51 must clear unresolved entry');

console.log('All project list reconciliation unit tests passed!');
