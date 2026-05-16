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

  it("refuses Xupra Pro AI production hosts", async () => {
    const provider = new XupraCloudProvider(
      configuration({ environment: "development", apiBaseUrl: "https://drylake.xupracorp.com" }) as never,
      () => ({ userEmail: "owner@example.com", organizationTier: "pro" }),
      async () => "token",
    );

    const availability = await provider.isAvailable();

    expect(availability.available).toBe(false);
    expect(availability.reason).toContain("production host");
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
