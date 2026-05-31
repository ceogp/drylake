import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    OPENAI_MODEL: "gpt-5.4",
  },
  getOpenAiApiKey: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/security/runtime-secrets", () => ({
  getOpenAiApiKey: mocks.getOpenAiApiKey,
}));

import { generateAiText } from "@/lib/services/ai-text";

beforeEach(() => {
  mocks.getOpenAiApiKey.mockReset();
  mocks.getOpenAiApiKey.mockResolvedValue("openai-test-key");
  vi.restoreAllMocks();
});

describe("generateAiText", () => {
  it("logs selected model and task when OpenAI succeeds", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ output_text: "Plan ready." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(generateAiText({
        systemPrompt: "System",
        userPrompt: "User",
        taskLabel: "planning chat",
        model: "gpt-5.4-nano",
      })).resolves.toBe("Plan ready.");

      expect(infoSpy).toHaveBeenCalledWith(
        "[xupra-ai] request_started",
        expect.objectContaining({ taskLabel: "planning chat", model: "gpt-5.4-nano" }),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "[xupra-ai] request_succeeded",
        expect.objectContaining({ taskLabel: "planning chat", model: "gpt-5.4-nano", outputLength: 11 }),
      );
    } finally {
      globalThis.fetch = originalFetch;
      infoSpy.mockRestore();
    }
  });

  it("logs sanitized OpenAI errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "bad key sk-test-secret-value" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;

    try {
      await expect(generateAiText({
        systemPrompt: "System",
        userPrompt: "User",
        taskLabel: "runbook draft",
      })).rejects.toThrow("Xupra AI runbook draft failed (401)");

      expect(errorSpy).toHaveBeenCalledWith(
        "[xupra-ai] request_failed",
        expect.objectContaining({
          taskLabel: "runbook draft",
          model: "gpt-5.4",
          status: 401,
          error: expect.not.stringContaining("sk-test-secret-value"),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
      errorSpy.mockRestore();
    }
  });
});
