import { describe, expect, it, vi } from "vitest";

import { createStarterXu } from "../xu/createStarterXu";
import { renderXu } from "../xu/renderXu";
import { ClipboardProvider } from "../ai/providers/clipboardProvider";
import { XupraCloudProvider } from "../ai/providers/xupraCloudProvider";
import { resolveDryLakeAiProvider } from "../ai/providerResolver";
import { parseAiRunbookResponse } from "../ai/parseAiRunbookResponse";
import { buildDraftRunbookPrompt } from "../ai/prompts/buildDraftRunbookPrompt";
import { generatePhasePlanPrompt } from "../ai/prompts/generatePhasePlanPrompt";

let models: unknown[] = [];

vi.mock("vscode", () => ({
  lm: {
    selectChatModels: vi.fn(async () => models),
  },
  LanguageModelChatMessage: {
    User: (content: string) => ({ role: "user", content }),
  },
}));

function configuration(values: Record<string, unknown>) {
  return {
    get<T>(key: string, defaultValue?: T) {
      return (key in values ? values[key] : defaultValue) as T;
    },
  };
}

function proConnection() {
  return {
    userEmail: "owner@example.com",
    entitlements: {
      xupra_pro_ai: true,
      session_cloud_sync: false,
      pr_summary_generation: false,
    },
  };
}

function mockRunbookFetch(runbook = createStarterXu({ prompt: "Build app", mode: "build-app" })) {
  return vi.fn(async (...fetchArgs: Parameters<typeof fetch>) => {
    void fetchArgs;

    return new Response(JSON.stringify({ content: renderXu(runbook) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("AI providers", () => {
  it("generates External AI Prompt content and parses returned .xu", async () => {
    const provider = new ClipboardProvider();
    const runbook = createStarterXu({ prompt: "Build app", mode: "build-app" });
    runbook.intent.purpose = "Build the app.";

    const generated = await provider.generateDraftRunbook({
      prompt: "Build app",
      mode: "build-app",
      workspaceSummary: "Workspace: test",
    });
    const parsed = parseAiRunbookResponse(`\`\`\`yaml\n${renderXu(runbook)}\n\`\`\``);

    expect(generated.promptForExternalAi).toContain("DryLake .xu runbook");
    expect(parsed.runbook?.intent.purpose).toBe("Build the app.");
  });

  it("asks AI to determine the phase count from task complexity", () => {
    const input = {
      prompt: "Fix the login button color",
      mode: "build-app" as const,
      workspaceSummary: "Workspace: test",
    };

    const draftPrompt = buildDraftRunbookPrompt(input);
    const phasePlanPrompt = generatePhasePlanPrompt(input);

    expect(draftPrompt).toContain("determine the correct number of phases for this specific task");
    expect(phasePlanPrompt).toContain("Simple tasks may need 3 phases");
    expect(`${draftPrompt}\n${phasePlanPrompt}`).not.toContain("at least five phases");
  });

  it("allows Xupra AI when the account has the new entitlement", async () => {
    const provider = new XupraCloudProvider(
      configuration({ environment: "production", apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      () => ({
        userEmail: "owner@example.com",
        organizationTier: "free",
        entitlements: {
          xupra_pro_ai: true,
          session_cloud_sync: false,
          pr_summary_generation: false,
        },
      }),
      async () => "token",
    );

    const availability = await provider.isAvailable();

    expect(availability.available).toBe(true);
  });

  it("posts all Xupra AI runbook requests to /api/v1 endpoints", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      proConnection,
      async () => "token",
    );
    const fetchMock = mockRunbookFetch();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const input = {
        prompt: "Build app",
        mode: "build-app" as const,
        workspaceSummary: "Workspace: test",
      };

      await provider.generateDraftRunbook(input);
      await provider.refinePurpose(input);
      await provider.refineArchitecture(input);
      await provider.generatePhasePlan(input);
      await provider.planningChat({ ...input, chatTranscript: "User: hi" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/draft",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/refine-purpose",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/refine-architecture",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/generate-phases",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/chat",
    ]);
  });

  it("returns model tier metadata from Xupra AI draft and chat responses", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      proConnection,
      async () => "token",
    );
    const runbook = createStarterXu({ prompt: "Build app", mode: "build-app" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        content: renderXu(runbook),
        modelTier: "nano",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reply: "Use a queue for retries.",
        modelTier: "foundation",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    const originalFetch = globalThis.fetch;

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const input = {
        prompt: "Build app",
        mode: "build-app" as const,
        workspaceSummary: "Workspace: test",
      };

      await expect(provider.generateDraftRunbook(input)).resolves.toMatchObject({
        runbook: expect.any(Object),
        modelTier: "nano",
      });
      await expect(provider.planningChat({ ...input, chatTranscript: "User: hi" })).resolves.toEqual({
        reply: "Use a queue for retries.",
        modelTier: "foundation",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses proposed runbooks from Xupra AI chat responses", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      proConnection,
      async () => "token",
    );
    const runbook = createStarterXu({ prompt: "Build app", mode: "build-app" });
    runbook.phases[0].objective = "Updated objective";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      reply: "I drafted an updated phase.",
      proposedRunbook: runbook,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const originalFetch = globalThis.fetch;

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(provider.planningChat({
        prompt: "Build app",
        mode: "build-app",
        workspaceSummary: "Workspace: test",
        chatTranscript: "User: update phase one",
      })).resolves.toMatchObject({
        reply: "I drafted an updated phase.",
        runbook: expect.objectContaining({
          phases: expect.arrayContaining([
            expect.objectContaining({ objective: "Updated objective" }),
          ]),
        }),
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses xupra.baseUrl for Xupra AI requests when no drylake API override is configured", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "" }) as never,
      proConnection,
      async () => "token",
      configuration({ baseUrl: "https://staging.drylake.xupracorp.com/" }) as never,
    );
    const fetchMock = mockRunbookFetch();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await provider.generateDraftRunbook({
        prompt: "Build app",
        mode: "build-app",
        workspaceSummary: "Workspace: test",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchMock.mock.calls[0][0]).toBe("https://staging.drylake.xupracorp.com/api/v1/drylake/runbooks/draft");
  });

  it("keeps drylake.apiBaseUrl as an explicit Xupra AI request override", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "http://localhost:3008/" }) as never,
      proConnection,
      async () => "token",
      configuration({ baseUrl: "https://staging.drylake.xupracorp.com" }) as never,
    );
    const fetchMock = mockRunbookFetch();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await provider.generateDraftRunbook({
        prompt: "Build app",
        mode: "build-app",
        workspaceSummary: "Workspace: test",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3008/api/v1/drylake/runbooks/draft");
  });

  it("uses Xupra AI even when configured auto has no editor model", async () => {
    models = [];
    const { provider, reason } = await resolveDryLakeAiProvider({
      configuration: configuration({ aiProvider: "auto", environment: "development", apiBaseUrl: "" }) as never,
      readConnection: () => ({}),
      readAccessToken: async () => undefined,
    });

    expect(provider.label).toBe("Xupra AI");
    expect(reason).toBeUndefined();
  });

  it("does not select User IDE AI when an editor model is available", async () => {
    models = [{ sendRequest: vi.fn() }];
    const { provider, reason } = await resolveDryLakeAiProvider({
      configuration: configuration({ aiProvider: "auto", environment: "development", apiBaseUrl: "" }) as never,
      readConnection: () => ({}),
      readAccessToken: async () => undefined,
    });

    expect(provider.label).toBe("Xupra AI");
    expect(reason).toBeUndefined();
  });
});
