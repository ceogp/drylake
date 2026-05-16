import { buildDraftRunbookPrompt } from "../prompts/buildDraftRunbookPrompt";
import { generatePhasePlanPrompt } from "../prompts/generatePhasePlanPrompt";
import { refineArchitecturePrompt } from "../prompts/refineArchitecturePrompt";
import { refinePurposePrompt } from "../prompts/refinePurposePrompt";
import type {
  DryLakeAiProvider,
  GenerateDraftRunbookInput,
  GenerateDraftRunbookResult,
} from "../DryLakeAiProvider";

export class ClipboardProvider implements DryLakeAiProvider {
  readonly id = "external-ai-prompt";
  readonly label = "External AI Prompt";

  async isAvailable() {
    return { available: true };
  }

  async generateDraftRunbook(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    return {
      promptForExternalAi: buildDraftRunbookPrompt(input),
      message: "DryLake created a local draft runbook. The external prompt is optional if you want an AI-refined draft.",
    };
  }

  async refinePurpose(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    return {
      promptForExternalAi: refinePurposePrompt(input),
      message: "Copy this purpose refinement prompt into an external AI tool.",
    };
  }

  async refineArchitecture(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    return {
      promptForExternalAi: refineArchitecturePrompt(input),
      message: "Copy this architecture refinement prompt into an external AI tool.",
    };
  }

  async generatePhasePlan(input: GenerateDraftRunbookInput): Promise<GenerateDraftRunbookResult> {
    return {
      promptForExternalAi: generatePhasePlanPrompt(input),
      message: "Copy this phase planning prompt into an external AI tool.",
    };
  }
}
