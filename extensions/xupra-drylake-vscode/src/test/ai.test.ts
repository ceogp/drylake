import { describe, expect, it, vi } from "vitest";

import { createStarterXu } from "../xu/createStarterXu";
import { renderXu } from "../xu/renderXu";
import { ClipboardProvider } from "../ai/providers/clipboardProvider";
import { XupraCloudProvider } from "../ai/providers/xupraCloudProvider";
import { resolveDryLakeAiProvider } from "../ai/providerResolver";
import { parseAiRunbookResponse } from "../ai/parseAiRunbookResponse";

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

  it("allows Xupra Pro AI when the account has the new entitlement", async () => {
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

  it("posts all Xupra Pro AI runbook requests to /api/v1 endpoints", async () => {
    const provider = new XupraCloudProvider(
      configuration({ apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      () => ({
        userEmail: "owner@example.com",
        entitlements: {
          xupra_pro_ai: true,
          session_cloud_sync: false,
          pr_summary_generation: false,
        },
      }),
      async () => "token",
    );
    const runbook = createStarterXu({ prompt: "Build app", mode: "build-app" });
    const fetchMock = vi.fn(async (...fetchArgs: Parameters<typeof fetch>) => {
      void fetchArgs;

      return new Response(JSON.stringify({ content: renderXu(runbook) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
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
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/draft",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/refine-purpose",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/refine-architecture",
      "https://drylake.xupracorp.com/api/v1/drylake/runbooks/generate-phases",
    ]);
  });

  it("falls back to External AI Prompt when configured auto has no integrated model", async () => {
    models = [];
    const provider = await resolveDryLakeAiProvider({
      configuration: configuration({ aiProvider: "auto", environment: "development", apiBaseUrl: "" }) as never,
      readConnection: () => ({}),
      readAccessToken: async () => undefined,
    });

    expect(provider.label).toBe("External AI Prompt");
  });

  it("selects User IDE AI when an editor model is available", async () => {
    models = [{ sendRequest: vi.fn() }];
    const provider = await resolveDryLakeAiProvider({
      configuration: configuration({ aiProvider: "auto", environment: "development", apiBaseUrl: "" }) as never,
      readConnection: () => ({}),
      readAccessToken: async () => undefined,
    });

    expect(provider.label).toBe("User IDE AI");
  });
});
