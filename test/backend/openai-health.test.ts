import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    OPENAI_MODEL: "gpt-5.4",
    OPENAI_FREE_MODEL: "gpt-5.4-nano",
  },
  getOpenAiApiKey: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/security/runtime-secrets", () => ({
  getOpenAiApiKey: mocks.getOpenAiApiKey,
}));

import { checkOpenAiModelAccess, checkPlanningModelAccess } from "@/lib/services/openai-health";

beforeEach(() => {
  mocks.getOpenAiApiKey.mockReset();
  mocks.getOpenAiApiKey.mockResolvedValue("openai-test-key");
  vi.restoreAllMocks();
});

describe("openai health checks", () => {
  it("reports missing API key before calling OpenAI", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mocks.getOpenAiApiKey.mockResolvedValueOnce("");

    await expect(checkOpenAiModelAccess("gpt-5.4")).resolves.toEqual({
      model: "gpt-5.4",
      configured: false,
      ok: false,
      message: "OPENAI_API_KEY is not configured.",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("checks both paid and free planning models", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "model" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(checkPlanningModelAccess()).resolves.toMatchObject({
        ok: true,
        foundation: { model: "gpt-5.4", configured: true, ok: true },
        nano: { model: "gpt-5.4-nano", configured: true, ok: true },
      });
      expect((fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).map((call) => call[0])).toEqual([
        "https://api.openai.com/v1/models/gpt-5.4",
        "https://api.openai.com/v1/models/gpt-5.4-nano",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
