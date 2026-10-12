import { Project } from '../types';

export interface ProjectListReconciliationResult {
  acceptedProjects: Project[];
  staleProjects: Project[];
  staleIncomingProjectIds: string[];
}

export type UnresolvedListFreshness = Record<string, number>;

/**
 * Reconciles persistent unresolved project-list freshness requirements across responses.
 *
 * Rules:
 * Rule A (Newly stale): Record project ID and required version watermark (from confirmedVersions).
 * Rule B (Still stale): Retain existing unresolved entry and preserve maximum required version.
 * Rule C (Absent from response): Retain unresolved entry; omission is not verified deletion.
 * Rule D (Fresh metadata): Incoming project at or above confirmed/required version clears unresolved entry.
 * Rule E (Explicit deletion): Only clear if authoritative deletion evidence exists (absent in GET /api/projects).
 */
export function reconcileListFreshness(
  previousUnresolved: UnresolvedListFreshness,
  incomingProjects: Project[],
  confirmedVersions: Record<string, number>,
  staleIncomingProjectIds: string[]
): UnresolvedListFreshness {
  const nextUnresolved: UnresolvedListFreshness = { ...previousUnresolved };

  // Rule A & B: For any newly or persistently stale incoming project, record / preserve required version
  for (const id of staleIncomingProjectIds) {
    const required = confirmedVersions[id] ?? 0;
    nextUnresolved[id] = Math.max(nextUnresolved[id] ?? 0, required);
  }

  // Rule D: Check incoming projects to resolve previously unresolved projects that now provide fresh metadata
  for (const incoming of incomingProjects) {
    if (!incoming || !incoming.id) continue;
    const required = nextUnresolved[incoming.id];
    if (required !== undefined) {
      const incomingVersion = incoming.stateVersion ?? 0;
      const confirmed = confirmedVersions[incoming.id] ?? 0;
      const targetMin = Math.max(required, confirmed);
      if (incomingVersion >= targetMin) {
        delete nextUnresolved[incoming.id];
      }
    }
  }

  // Rule C & E: Previously unresolved projects omitted from incomingProjects are retained in nextUnresolved.

  return nextUnresolved;
}

/**
 * Reconciles incoming project-list records against confirmed version watermarks, previously accepted state,
 * and persistent unresolved project-list freshness requirements.
 *
 * Requirements:
 * 1. An incoming project's original, unmodified stateVersion is compared against its confirmed version.
 * 2. If incomingVersion < confirmedVersion:
 *    - Do NOT normalize the stale object by increasing its version.
 *    - Do NOT accept its stale project name, description, profiles, ownership, or metadata.
 *    - Preserve the previously accepted project object if its version is >= confirmed.
 *    - If no safe previously accepted object exists, hold the stale entry out of the accepted list.
 * 3. If an unresolved project ID is omitted from incomingProjects:
 *    - Preserve previously accepted safe metadata if available (omission is not verified deletion).
 *    - If no safe previously accepted object exists, hold out of accepted list.
 * 4. Returns acceptedProjects, staleProjects, and staleIncomingProjectIds.
 */
export function reconcileProjectList(
  incomingProjects: Project[],
  previouslyAcceptedProjects: Project[],
  confirmedVersions: Record<string, number>,
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

    const confirmed = confirmedVersions[incoming.id] ?? 0;
    const incomingVersion = incoming.stateVersion ?? 0;

    if (incomingVersion < confirmed) {
      staleIncomingProjectIds.push(incoming.id);
      // Stale incoming project data
      const prev = prevMap.get(incoming.id);
      if (prev && (prev.stateVersion ?? 0) >= confirmed) {
        // Preserve previously accepted project object without adopting stale metadata
        acceptedProjects.push(prev);
      } else {
        // No safe previously accepted object exists; hold out of authoritative visible list
        staleProjects.push(incoming);
      }
    } else {
      // Incoming version is current or newer; accept directly
      acceptedProjects.push(incoming);
    }
  }

  // Check unresolved projects omitted from incomingProjects (Rule C & Case B)
  for (const unresolvedId of unresolvedProjectIds) {
    if (!incomingIds.has(unresolvedId)) {
      const prev = prevMap.get(unresolvedId);
      const confirmed = confirmedVersions[unresolvedId] ?? 0;
      if (prev && (prev.stateVersion ?? 0) >= confirmed) {
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
