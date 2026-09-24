import type {Question} from '../src/types.ts';
import {DISCOVERY_QUESTION_CATALOG} from '../src/data/discoveryCatalog.ts';

/** Project discovery reads expose the catalog without materializing it in canonical state. */
export function projectQuestionCatalog(saved:Question[]):Question[] {
  return structuredClone(DISCOVERY_QUESTION_CATALOG.map(question=>saved.find(answer=>answer.id===question.id) || question));
}
