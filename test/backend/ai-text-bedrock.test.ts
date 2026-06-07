import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_PROVIDER: "bedrock_openai",
    AWS_REGION: "",
    BEDROCK_OPENAI_REGION: "us-east-2",
    BEDROCK_OPENAI_BASE_URL: "",
    BEDROCK_OPENAI_MODEL: "openai.gpt-5.4",
  },
  getBedrockOpenAiApiKey: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/security/runtime-secrets", () => ({
  getBedrockOpenAiApiKey: mocks.getBedrockOpenAiApiKey,
}));

import { generateAiText } from "@/lib/services/ai-text";

beforeEach(() => {
  mocks.getBedrockOpenAiApiKey.mockReset();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);

  mocks.getBedrockOpenAiApiKey.mockResolvedValue("bedrock-test-key");
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ output_text: "ok" }),
  });
});

describe("generateAiText with Bedrock OpenAI", () => {
  it("uses the Bedrock Mantle Responses endpoint and OpenAI-compatible payload", async () => {
    await expect(generateAiText({
      systemPrompt: "System prompt",
      userPrompt: "User prompt",
      taskLabel: "bedrock smoke",
      model: "openai.gpt-5.4",
    })).resolves.toBe("ok");

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://bedrock-mantle.us-east-2.api.aws/openai/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer bedrock-test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.model).toBe("openai.gpt-5.4");
    expect(body.input[0].content[0].text).toContain("You are Xupra AI.");
    expect(body.input[1].content[0].text).toBe("User prompt");
  });
});
