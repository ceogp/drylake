import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateAiText: vi.fn(),
}));

vi.mock("@/lib/services/ai-text", () => ({
  generateAiText: mocks.generateAiText,
}));

import { generatePlanningChatReply, type RunbookPlanningChatInput } from "@/lib/services/runbook-generation";

const input: RunbookPlanningChatInput = {
  prompt: "Build checkout",
  mode: "build-app",
  workspaceSummary: "Workspace: test",
  chatTranscript: "User: update the plan",
};

beforeEach(() => {
  mocks.generateAiText.mockReset();
});

describe("generatePlanningChatReply", () => {
  it("keeps plain text replies compatible", async () => {
    mocks.generateAiText.mockResolvedValueOnce("Use a queue for retries.");

    await expect(generatePlanningChatReply(input, { model: "gpt-5.4" })).resolves.toEqual({
      reply: "Use a queue for retries.",
    });
    expect(mocks.generateAiText).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5.4" }));
  });

  it("returns proposedRunbook when the AI provides a structured plan update", async () => {
    const proposedRunbook = {
      xu: 1,
      kind: "ApplicationBuildRunbook",
      metadata: { name: "checkout", owner: "drylake", status: "draft" },
      phases: [{ id: "phase-01", title: "Implement", status: "pending" }],
    };
    mocks.generateAiText.mockResolvedValueOnce(JSON.stringify({
      reply: "I drafted an updated plan for approval.",
      proposedRunbook,
    }));

    await expect(generatePlanningChatReply(input)).resolves.toEqual({
      reply: "I drafted an updated plan for approval.",
      proposedRunbook,
    });
  });
});
