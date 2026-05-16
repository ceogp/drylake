import { buildDraftRunbookPrompt } from "./buildDraftRunbookPrompt";
import type { GenerateDraftRunbookInput } from "../DryLakeAiProvider";

export function generatePhasePlanPrompt(input: GenerateDraftRunbookInput) {
  return `${buildDraftRunbookPrompt(input)}\n\nFocus this revision on phase-by-phase execution planning and acceptance criteria.`;
}

