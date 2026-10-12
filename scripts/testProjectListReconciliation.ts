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

console.log('All project list reconciliation unit tests passed!');
