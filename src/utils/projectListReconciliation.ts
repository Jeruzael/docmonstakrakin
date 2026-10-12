import { Project } from '../types';

export interface ProjectListReconciliationResult {
  acceptedProjects: Project[];
  staleProjects: Project[];
  staleIncomingProjectIds: string[];
}

/**
 * Reconciles incoming project-list records against confirmed version watermarks and previously accepted state.
 *
 * Requirements:
 * 1. An incoming project's original, unmodified stateVersion is compared against its confirmed version.
 * 2. If incomingVersion < confirmedVersion:
 *    - Do NOT normalize the stale object by increasing its version.
 *    - Do NOT accept its stale project name, description, profiles, ownership, or metadata.
 *    - Preserve the previously accepted project object if its version is >= confirmed.
 *    - If no safe previously accepted object exists, hold the stale entry out of the accepted list.
 * 3. Returns acceptedProjects (safe, authoritative), staleProjects (unresolved stale entries without cache),
 *    and staleIncomingProjectIds (all project IDs whose incoming payload was older than confirmed).
 */
export function reconcileProjectList(
  incomingProjects: Project[],
  previouslyAcceptedProjects: Project[],
  confirmedVersions: Record<string, number>
): ProjectListReconciliationResult {
  const prevMap = new Map<string, Project>();
  for (const prev of previouslyAcceptedProjects) {
    if (prev && prev.id) {
      prevMap.set(prev.id, prev);
    }
  }

  const acceptedProjects: Project[] = [];
  const staleProjects: Project[] = [];
  const staleIncomingProjectIds: string[] = [];

  for (const incoming of incomingProjects) {
    if (!incoming || !incoming.id) continue;

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

  return { acceptedProjects, staleProjects, staleIncomingProjectIds };
}
