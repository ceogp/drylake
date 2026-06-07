import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_PROVIDER: "bedrock_openai",
    AWS_REGION: "",
    BEDROCK_OPENAI_REGION: "us-east-2",
    BEDROCK_OPENAI_BASE_URL: "",
    BEDROCK_OPENAI_MODEL: "openai.gpt-5.4",
    BEDROCK_REGION: "us-east-1",
    BEDROCK_MODEL: "anthropic.claude-sonnet-4-6",
    BEDROCK_FREE_MODEL: "anthropic.claude-haiku-4-5-20251001-v1:0",
  },
  getBedrockOpenAiApiKey: vi.fn(),
  getBedrockApiKey: vi.fn(),
  getOpenAiApiKey: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/security/runtime-secrets", () => ({
  getBedrockOpenAiApiKey: mocks.getBedrockOpenAiApiKey,
  getBedrockApiKey: mocks.getBedrockApiKey,
  getOpenAiApiKey: mocks.getOpenAiApiKey,
}));

import { generateAiText } from "@/lib/services/ai-text";

beforeEach(() => {
  mocks.env.AI_PROVIDER = "bedrock_openai";
  mocks.getBedrockOpenAiApiKey.mockReset();
  mocks.getBedrockApiKey.mockReset();
  mocks.getOpenAiApiKey.mockReset();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);

  mocks.getBedrockOpenAiApiKey.mockResolvedValue("bedrock-test-key");
  mocks.getBedrockApiKey.mockResolvedValue("bedrock-claude-test-key");
  mocks.getOpenAiApiKey.mockResolvedValue("openai-test-key");
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

  it("uses the native Bedrock Converse endpoint for Claude models", async () => {
    mocks.env.AI_PROVIDER = "bedrock_anthropic";
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: {
          message: {
            content: [{ text: "{\"result\":\"ok\"}" }],
          },
        },
      }),
    });

    await expect(generateAiText({
      systemPrompt: "System prompt",
      userPrompt: "User prompt",
      taskLabel: "bedrock claude smoke",
      model: "anthropic.claude-haiku-4-5-20251001-v1:0",
      textFormat: {
        type: "json_schema",
        name: "result_schema",
        schema: {
          type: "object",
          properties: {
            result: { type: "string" },
          },
          required: ["result"],
        },
        strict: true,
      },
    })).resolves.toBe("{\"result\":\"ok\"}");

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-haiku-4-5-20251001-v1%3A0/converse",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer bedrock-claude-test-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.system[0].text).toContain("You are Xupra AI.");
    expect(body.system[0].text).toContain("Output contract:");
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content[0].text).toBe("User prompt");
    expect(body.inferenceConfig.maxTokens).toBe(4096);
  });

  it("retries Bedrock Claude model IDs with a US inference profile prefix when required", async () => {
    mocks.env.AI_PROVIDER = "bedrock_anthropic";
    mocks.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invocation with on-demand throughput isn't supported. Retry your request with the ID or ARN of an inference profile.",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            message: {
              content: [{ text: "ok" }],
            },
          },
        }),
      });

    await expect(generateAiText({
      systemPrompt: "System prompt",
      userPrompt: "User prompt",
      taskLabel: "bedrock claude retry",
      model: "anthropic.claude-sonnet-4-6",
    })).resolves.toBe("ok");

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[0][0]).toBe(
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-sonnet-4-6/converse",
    );
    expect(mocks.fetch.mock.calls[1][0]).toBe(
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/converse",
    );
  });
});
