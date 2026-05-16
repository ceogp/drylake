import { buildDraftRunbookPrompt } from "./buildDraftRunbookPrompt";
import type { GenerateDraftRunbookInput } from "../DryLakeAiProvider";

export function refineArchitecturePrompt(input: GenerateDraftRunbookInput) {
  return `${buildDraftRunbookPrompt(input)}\n\nFocus this revision on architecture summary, decisions, risks, assumptions, and provisioning preview.`;
}

