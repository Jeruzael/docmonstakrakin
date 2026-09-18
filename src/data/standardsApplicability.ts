import { INITIAL_STANDARDS } from './initialData.js';
import type { Project, StandardControl } from '../types.js';

export function applicableStandards(project: Pick<Project, 'profiles'>): StandardControl[] {
  const ai = project.profiles.some(p => p === 'AI_APPLICATION' || p === 'AGENTIC_AI_APPLICATION');
  const web = project.profiles.some(p => ['WEB_APPLICATION', 'BACKEND_API', 'BACKEND_SERVICE', 'FULL_STACK', 'API_SERVICE'].includes(p));
  return INITIAL_STANDARDS.filter(s => s.standardId === 'OWASP_AISVS' ? ai : s.standardId === 'OWASP_ASVS' ? web : true)
    .map(s => ({...s, verifiedCount: 0, unverifiedCount: 1, mappedRequirementsCount: 0}));
}
export function applicableStandardLinks(links: string[], project: Project): string[] {
  const ids = new Set(applicableStandards(project).map(s => s.id));
  return links.filter(id => ids.has(id));
}
