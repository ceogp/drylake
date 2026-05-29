import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateAiText: vi.fn(),
}));

vi.mock("@/lib/services/ai-text", () => ({
  generateAiText: mocks.generateAiText,
}));

import {
  buildRunbookDraftPrompt,
  generateRunbookPhasePlanPrompt,
  type RunbookGenerationInput,
} from "@/lib/services/runbook-generation";

function input(prompt = "Fix the login button color"): RunbookGenerationInput {
  return {
    prompt,
    mode: "build-app",
    workspaceSummary: "Workspace: test",
  };
}

beforeEach(() => {
  mocks.generateAiText.mockReset();
  mocks.generateAiText.mockResolvedValue("xu: 1");
});

describe("runbook generation prompts", () => {
  it("asks AI to determine phase count for draft runbooks", async () => {
    await buildRunbookDraftPrompt(input());

    const request = mocks.generateAiText.mock.calls[0][0];
    const userPrompt = request.userPrompt;

    expect(userPrompt).toContain("determine the correct number of phases for this specific task");
    expect(userPrompt).toContain("Simple tasks may need 3 phases");
    expect(userPrompt).toContain("Complex tasks may need 8 or more");
    expect(userPrompt).not.toContain("at least five phases");
    expect(request.textFormat).toMatchObject({
      type: "json_schema",
      name: "drylake_runbook",
      strict: true,
    });
    expect(request.textFormat.schema.properties.phases).toMatchObject({
      type: "array",
      minItems: 1,
    });
  });

  it("asks AI to determine phase count for phase-plan revisions", async () => {
    await generateRunbookPhasePlanPrompt(input("Build Stripe checkout with webhook handling and admin dashboard"));

    const userPrompt = mocks.generateAiText.mock.calls[0][0].userPrompt;

    expect(userPrompt).toContain("determine the correct number of phases for this specific task");
    expect(userPrompt).toContain("Do not default to 5");
    expect(userPrompt).not.toContain("at least five phases");
  });
});
