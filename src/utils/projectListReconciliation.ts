import { Project } from '../types';

export interface ProjectListReconciliationResult {
  acceptedProjects: Project[];
  staleProjects: Project[];
  staleIncomingProjectIds: string[];
}

export type UnresolvedListFreshness = Record<string, number>;

/**
 * Strict validator for project stateVersion:
 * Must be a finite, nonnegative safe integer.
 */
export function isValidStateVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 0;
}

/**
 * Pure calculation of monotonic effective required version floors per project.
 * Merges confirmed save versions, accepted version high-watermarks, and outstanding unresolved floors.
 *
 * Invariant:
 * requiredFloor[id] = max(confirmedSave[id] ?? 0, acceptedHighWatermark[id] ?? 0, unresolvedFloor[id] ?? 0)
 */
export function calculateEffectiveVersionFloors(
  confirmedSaveVersions: Record<string, number> = {},
  acceptedVersionHighWatermarks: Record<string, number> = {},
  unresolvedFloors: Record<string, number> = {}
): Record<string, number> {
  const floors: Record<string, number> = {};
  const allIds = new Set([
    ...Object.keys(confirmedSaveVersions || {}),
    ...Object.keys(acceptedVersionHighWatermarks || {}),
    ...Object.keys(unresolvedFloors || {}),
  ]);

  for (const id of allIds) {
    const confirmed = confirmedSaveVersions?.[id] ?? 0;
    const accepted = acceptedVersionHighWatermarks?.[id] ?? 0;
    const unresolved = unresolvedFloors?.[id] ?? 0;
    floors[id] = Math.max(confirmed, accepted, unresolved);
  }

  return floors;
}

/**
 * Reconciles persistent unresolved project-list freshness requirements across responses.
 *
 * Rules:
 * Rule A (Newly stale): Record project ID and required version floor.
 * Rule B (Still stale): Retain existing unresolved entry and preserve maximum required version floor.
 * Rule C (Absent from response): Retain unresolved entry; omission is not verified deletion.
 * Rule D (Fresh metadata): Incoming project at or above required version floor clears unresolved entry.
 * Rule E (Explicit deletion): Only clear if authoritative deletion evidence exists (absent in GET /api/projects).
 */
export function reconcileListFreshness(
  previousUnresolved: UnresolvedListFreshness,
  incomingProjects: Project[],
  requiredVersionFloors: Record<string, number>,
  staleIncomingProjectIds: string[]
): UnresolvedListFreshness {
  const nextUnresolved: UnresolvedListFreshness = { ...previousUnresolved };

  // Rule A & B: For any newly or persistently stale incoming project, record / preserve required version
  for (const id of staleIncomingProjectIds) {
    const required = requiredVersionFloors[id] ?? 0;
    nextUnresolved[id] = Math.max(nextUnresolved[id] ?? 0, required);
  }

  // Rule D: Check incoming projects to resolve previously unresolved projects that now provide fresh metadata
  for (const incoming of incomingProjects) {
    if (!incoming || !incoming.id) continue;
    const required = nextUnresolved[incoming.id];
    if (required !== undefined) {
      const incomingVersion = incoming.stateVersion;
      if (isValidStateVersion(incomingVersion)) {
        const targetMin = Math.max(required, requiredVersionFloors[incoming.id] ?? 0);
        if (incomingVersion >= targetMin) {
          delete nextUnresolved[incoming.id];
        }
      }
    }
  }

  // Rule C & E: Previously unresolved projects omitted from incomingProjects are retained in nextUnresolved.

  return nextUnresolved;
}

/**
 * Reconciles incoming project-list records against effective version floors, previously accepted state,
 * and persistent unresolved project-list freshness requirements.
 *
 * Requirements:
 * 1. An incoming project's stateVersion is strictly validated and compared against its required version floor.
 * 2. If incomingVersion is invalid or < requiredFloor:
 *    - Do NOT normalize the stale object by increasing its version.
 *    - Do NOT accept its stale project name, description, profiles, ownership, or metadata.
 *    - Preserve the previously accepted project object if its version is >= requiredFloor.
 *    - If no safe previously accepted object exists, hold the stale entry out of the accepted list.
 * 3. If an unresolved project ID is omitted from incomingProjects:
 *    - Preserve previously accepted safe metadata if available (omission is not verified deletion).
 *    - If no safe previously accepted object exists, hold out of accepted list.
 * 4. Returns acceptedProjects, staleProjects, and staleIncomingProjectIds.
 */
export function reconcileProjectList(
  incomingProjects: Project[],
  previouslyAcceptedProjects: Project[],
  requiredVersionFloors: Record<string, number> = {},
  unresolvedProjectIds: string[] = []
): ProjectListReconciliationResult {
  const prevMap = new Map<string, Project>();
  for (const prev of previouslyAcceptedProjects) {
    if (prev && prev.id) {
      prevMap.set(prev.id, prev);
    }
  }

  const incomingIds = new Set<string>();
  const acceptedProjects: Project[] = [];
  const staleProjects: Project[] = [];
  const staleIncomingProjectIds: string[] = [];

  for (const incoming of incomingProjects) {
    if (!incoming || !incoming.id) continue;
    incomingIds.add(incoming.id);

    const prev = prevMap.get(incoming.id);
    const requiredFloor = Math.max(
      requiredVersionFloors[incoming.id] ?? 0,
      prev && isValidStateVersion(prev.stateVersion) ? prev.stateVersion : 0
    );

    const incomingVersion = incoming.stateVersion;
    const isVersionValid = isValidStateVersion(incomingVersion);

    if (!isVersionValid || incomingVersion < requiredFloor) {
      staleIncomingProjectIds.push(incoming.id);
      // Stale or invalid incoming project data
      if (prev && isValidStateVersion(prev.stateVersion) && prev.stateVersion >= requiredFloor) {
        // Preserve previously accepted project object without adopting stale metadata
        acceptedProjects.push(prev);
      } else {
        // No safe previously accepted object exists; hold out of authoritative visible list
        staleProjects.push(incoming);
      }
    } else {
      // Incoming version is valid and at or above required floor; accept directly
      acceptedProjects.push(incoming);
    }
  }

  // Check unresolved projects omitted from incomingProjects (Rule C & Case B)
  for (const unresolvedId of unresolvedProjectIds) {
    if (!incomingIds.has(unresolvedId)) {
      const prev = prevMap.get(unresolvedId);
      const requiredFloor = Math.max(
        requiredVersionFloors[unresolvedId] ?? 0,
        prev && isValidStateVersion(prev.stateVersion) ? prev.stateVersion : 0
      );
      if (prev && isValidStateVersion(prev.stateVersion) && prev.stateVersion >= requiredFloor) {
        // Preserve safe cached metadata for omitted unresolved project
        acceptedProjects.push(prev);
      } else {
        // No safe cache exists for omitted unresolved project; mark stale
        staleProjects.push(prev || ({ id: unresolvedId, stateVersion: 0 } as Project));
      }
    }
  }

  return { acceptedProjects, staleProjects, staleIncomingProjectIds };
}
