import { buildDraftRunbookPrompt } from "./buildDraftRunbookPrompt";
import type { GenerateDraftRunbookInput } from "../DryLakeAiProvider";

export function refinePurposePrompt(input: GenerateDraftRunbookInput) {
  return `${buildDraftRunbookPrompt(input)}\n\nFocus this revision on purpose, users, goals, non-goals, and constraints.`;
}

