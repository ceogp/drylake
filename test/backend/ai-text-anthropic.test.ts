import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_PROVIDER: "anthropic",
    ANTHROPIC_BASE_URL: "https://api.anthropic.com",
    ANTHROPIC_MODEL: "claude-sonnet-4-6",
    ANTHROPIC_FREE_MODEL: "claude-haiku-4-5-20251001",
    OPENAI_MODEL: "gpt-5.4",
  },
  getAnthropicApiKey: vi.fn(),
  getOpenAiApiKey: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/security/runtime-secrets", () => ({
  getAnthropicApiKey: mocks.getAnthropicApiKey,
  getOpenAiApiKey: mocks.getOpenAiApiKey,
}));

import { generateAiText } from "@/lib/services/ai-text";

beforeEach(() => {
  mocks.env.AI_PROVIDER = "anthropic";
  mocks.getAnthropicApiKey.mockReset();
  mocks.getOpenAiApiKey.mockReset();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);

  mocks.getAnthropicApiKey.mockResolvedValue("anthropic-test-key");
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ type: "text", text: "ok" }] }),
  });
});

describe("generateAiText with Anthropic", () => {
  it("uses the Anthropic Messages API with the selected model", async () => {
    await expect(generateAiText({
      systemPrompt: "System prompt",
      userPrompt: "User prompt",
      taskLabel: "anthropic smoke",
      model: "claude-haiku-4-5-20251001",
    })).resolves.toBe("ok");

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "anthropic-test-key",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.system).toContain("You are Xupra AI.");
    expect(body.system).toContain("System prompt");
    expect(body.messages[0]).toEqual({ role: "user", content: "User prompt" });
  });

  it("adds JSON-only schema instructions for structured output requests", async () => {
    await generateAiText({
      systemPrompt: "Return structured data.",
      userPrompt: "Create plan.",
      taskLabel: "anthropic structured",
      textFormat: {
        type: "json_schema",
        name: "plan",
        schema: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
        strict: true,
      },
    });

    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.system).toContain("Return only valid JSON.");
    expect(body.system).toContain("\"title\"");
  });
});
