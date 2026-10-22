import type {Question} from '../src/types.ts';
import {DISCOVERY_QUESTION_CATALOG} from '../src/data/discoveryCatalog.ts';
import {restoreDiscoveryQuestionMetadata} from '../src/data/discoveryGates.ts';

/** Project discovery reads expose the catalog without materializing it in canonical state. */
export function projectQuestionCatalog(saved:Question[]):Question[] {
  return DISCOVERY_QUESTION_CATALOG.map(question=>restoreDiscoveryQuestionMetadata(saved.find(answer=>answer.id===question.id) || question));
}
