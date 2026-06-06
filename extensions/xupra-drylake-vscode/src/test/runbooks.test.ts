import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approvePlanChangeCommand,
  chatSendMessageCommand,
  configurePlanningProviderCommand,
  handoffPhaseCommand,
  newSessionCommand,
  openSessionsCommand,
  rejectPlanChangeCommand,
  reorderPhaseCommand,
  runNextPhaseCommand,
  startBuildSessionCommand,
  toggleAutopilotCommand,
  toggleStepCommand,
  updatePhaseAgentCommand,
  updatePhaseHandoffProfileCommand,
  updatePhaseStatusCommand,
} from "../commands/runbooks";
import { createStarterXu } from "../xu/createStarterXu";
import type { ApplicationBuildRunbook } from "../xu/types";

const mocks = vi.hoisted(() => ({
  billingUri: { value: "https://drylake.xupracorp.com/billing?source=extension" },
  openExternal: vi.fn(),
  openTextDocument: vi.fn(),
  showTextDocument: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  writeClipboard: vi.fn(),
  executeCommand: vi.fn(),
  launchPhaseAgent: vi.fn(),
  showAgentLaunchFallbackActions: vi.fn(),
  writePhaseHandoffFile: vi.fn(),
  writePhaseHandoffScript: vi.fn(),
  resolveDryLakeAiProvider: vi.fn(),
  providerIsAvailable: vi.fn(),
  providerGenerateDraftRunbook: vi.fn(),
  providerClarifyIntent: vi.fn(),
  providerPlanningChat: vi.fn(),
  providerRefinePurpose: vi.fn(),
  providerRefineArchitecture: vi.fn(),
  providerGeneratePhasePlan: vi.fn(),
  scanWorkspaceFiles: vi.fn(),
}));

const configurationValues = new Map<string, unknown>();

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  ConfigurationTarget: { Global: 1 },
  Uri: {
    parse: vi.fn(() => mocks.billingUri),
  },
  env: {
    openExternal: mocks.openExternal,
    clipboard: {
      writeText: mocks.writeClipboard,
    },
  },
  window: {
    showTextDocument: mocks.showTextDocument,
    showInformationMessage: mocks.showInformationMessage,
    showWarningMessage: mocks.showWarningMessage,
    showErrorMessage: mocks.showErrorMessage,
    showQuickPick: mocks.showQuickPick,
    showInputBox: mocks.showInputBox,
    withProgress: vi.fn(async (_options, task) => task()),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "C:/repo", path: "/repo" } }],
    asRelativePath: vi.fn((uri: { path?: string; fsPath?: string }) => uri.path ?? uri.fsPath ?? "drylake.xu"),
    openTextDocument: mocks.openTextDocument,
    getConfiguration: vi.fn((section: string) => ({
      get<T>(key: string, defaultValue?: T) {
        const scoped = `${section}.${key}`;
        if (configurationValues.has(scoped)) {
          return configurationValues.get(scoped) as T;
        }

        if (section === "drylake" && key === "aiProvider") {
          return "xupra-pro-ai" as T;
        }

        return defaultValue as T;
      },
      update: vi.fn(async (key: string, value: unknown) => {
        configurationValues.set(`${section}.${key}`, value);
      }),
    })),
  },
  commands: {
    executeCommand: mocks.executeCommand,
  },
}));

vi.mock("../services/workspaceScanner", () => ({
  getWorkspaceDisplayName: vi.fn(() => "Test Workspace"),
  scanWorkspaceFiles: mocks.scanWorkspaceFiles,
}));

vi.mock("../ai/providerResolver", () => ({
  resolveDryLakeAiProvider: mocks.resolveDryLakeAiProvider,
}));

vi.mock("../agents/phaseAgentLauncher", () => ({
  launchPhaseAgent: mocks.launchPhaseAgent,
  showAgentLaunchFallbackActions: mocks.showAgentLaunchFallbackActions,
  phaseHandoffActionFromArg: (arg: unknown) => (
    typeof arg === "string" && ["run", "script-sh", "script-bat", "copy", "markdown"].includes(arg)
      ? arg
      : undefined
  ),
  writePhaseHandoffFile: mocks.writePhaseHandoffFile,
  writePhaseHandoffScript: mocks.writePhaseHandoffScript,
}));

beforeEach(() => {
  mocks.openExternal.mockReset();
  mocks.openTextDocument.mockReset();
  mocks.showTextDocument.mockReset();
  mocks.showInformationMessage.mockReset();
  mocks.showWarningMessage.mockReset();
  mocks.showErrorMessage.mockReset();
  mocks.showQuickPick.mockReset();
  mocks.showInputBox.mockReset();
  mocks.writeClipboard.mockReset();
  mocks.executeCommand.mockReset();
  mocks.launchPhaseAgent.mockReset();
  mocks.showAgentLaunchFallbackActions.mockReset();
  mocks.writePhaseHandoffFile.mockReset();
  mocks.writePhaseHandoffScript.mockReset();
  mocks.resolveDryLakeAiProvider.mockReset();
  mocks.providerIsAvailable.mockReset();
  mocks.providerGenerateDraftRunbook.mockReset();
  mocks.providerClarifyIntent.mockReset();
  mocks.providerPlanningChat.mockReset();
  mocks.providerRefinePurpose.mockReset();
  mocks.providerRefineArchitecture.mockReset();
  mocks.providerGeneratePhasePlan.mockReset();
  mocks.scanWorkspaceFiles.mockReset();
  configurationValues.clear();
  mocks.showWarningMessage.mockResolvedValue("Upgrade to Pro");
  mocks.showQuickPick.mockImplementation(async (items) => (Array.isArray(items) ? items[0] : undefined));
  mocks.showInputBox.mockResolvedValue(undefined);
  mocks.openTextDocument.mockImplementation(async (document) => document);
  mocks.writePhaseHandoffFile.mockResolvedValue({ fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md", path: "/repo/.drylake/handoffs/P-01-codex.md" });
  mocks.writePhaseHandoffScript.mockResolvedValue({ fsPath: "C:/repo/.drylake/handoffs/P-01-codex.sh", path: "/repo/.drylake/handoffs/P-01-codex.sh" });
  mocks.launchPhaseAgent.mockResolvedValue({ status: "launched", message: "Started OpenAI Codex for this phase." });
  mocks.showAgentLaunchFallbackActions.mockResolvedValue(undefined);
  mocks.providerIsAvailable.mockResolvedValue({ available: false, reason: "Xupra AI requires a Pro plan." });
  mocks.providerGenerateDraftRunbook.mockResolvedValue({ message: "Failed to generate DryLake runbook draft (500)." });
  mocks.providerClarifyIntent.mockResolvedValue({ questions: ["What does success look like?"] });
  mocks.providerPlanningChat.mockResolvedValue({ error: "Failed to run DryLake Planning Chat (500)." });
  mocks.scanWorkspaceFiles.mockResolvedValue([]);
  mocks.resolveDryLakeAiProvider.mockResolvedValue({
    provider: {
      id: "xupra-pro-ai",
      label: "Xupra AI",
      isAvailable: mocks.providerIsAvailable,
      generateDraftRunbook: mocks.providerGenerateDraftRunbook,
      clarifyIntent: mocks.providerClarifyIntent,
      planningChat: mocks.providerPlanningChat,
      refinePurpose: mocks.providerRefinePurpose,
      refineArchitecture: mocks.providerRefineArchitecture,
      generatePhasePlan: mocks.providerGeneratePhasePlan,
    },
  });
});

describe("runbook commands", () => {
  it("does not create cards when hosted planning is unavailable", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const messages: Array<{ id: string; ts: number; role: "user" | "ai" | "system"; text: string }> = [];
    const deps = {
      apiClient: {
        setAccessToken: vi.fn(),
      },
      stateStore: {
        getConnection: vi.fn(() => ({})),
        getAccessToken: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearBuildSession: vi.fn(async () => undefined),
        setBuildSession: vi.fn(async () => undefined),
        clearAccessToken: vi.fn(async () => undefined),
        clearConnection: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        setPendingPlanDraft: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: "user" | "ai" | "system"; text: string }) => {
          const next = { id: `msg-${messages.length + 1}`, ts: messages.length + 1, ...message };
          messages.push(next);
          return next;
        }),
        getChatHistory: vi.fn(() => ({ messages })),
      },
      sessionStore: {
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.showWarningMessage.mockResolvedValueOnce("Reconnect DryLake");
    mocks.providerIsAvailable.mockResolvedValueOnce({
      available: false,
      reason: "Connect a Xupra account to use DryLake planning.",
    });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout");

    expect(deps.controlRoom.createOrShow).toHaveBeenCalledOnce();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(deps.apiClient.setAccessToken).toHaveBeenCalledWith(undefined);
    expect(deps.stateStore.clearAccessToken).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearConnection).toHaveBeenCalledOnce();
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Your DryLake extension connection expired. Reconnect to use hosted card generation.",
      "Reconnect DryLake",
    );
    expect(mocks.executeCommand).toHaveBeenCalledWith("xupra.connect");
    expect(mocks.providerClarifyIntent).not.toHaveBeenCalled();
    expect(mocks.providerGenerateDraftRunbook).not.toHaveBeenCalled();
    expect(messages.at(-1)).toEqual(expect.objectContaining({
      role: "system",
      text: "DryLake planning failed: Connect a Xupra account to use DryLake planning.",
    }));
  });

  it("generates cards immediately for connected free users through the nano backend route", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const generatedRunbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    const deps = {
      apiClient: {
        openWebUrl: vi.fn(() => mocks.billingUri),
      },
      stateStore: {
        getConnection: vi.fn(() => ({
          userEmail: "free@example.com",
          entitlements: {
            xupra_pro_ai: false,
            session_cloud_sync: false,
            pr_summary_generation: false,
          },
        })),
        getAccessToken: vi.fn(async () => "token"),
        setAwaitingPlanRefreshUntil: vi.fn(async () => undefined),
        setBuildSession: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearBuildSession: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        setPendingPlanDraft: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: string; text: string }) => ({
          id: "msg-1",
          ts: 0,
          ...message,
        })),
        getChatHistory: vi.fn(() => ({ messages: [] })),
      },
      sessionStore: {
        ensureRunbook: vi.fn(),
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({ runbook: generatedRunbook, modelTier: "nano" });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout", undefined, 3);

    expect(mocks.showWarningMessage).not.toHaveBeenCalledWith(
      "Xupra AI requires a Pro plan. Upgrade to unlock.",
      "Upgrade to Pro",
    );
    expect(mocks.openExternal).not.toHaveBeenCalled();
    expect(deps.sessionStore.ensureRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.findRunbookUri).toHaveBeenCalledOnce();
    expect(deps.sessionStore.getDefaultRunbookUri).toHaveBeenCalledOnce();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledWith(runbookUri, generatedRunbook);
    expect(deps.sessionStore.createSession).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Build checkout",
      requestedStageCount: 3,
      providerId: "xupra-pro-ai",
    }));
    expect(deps.stateStore.setBuildSession).toHaveBeenCalledWith(expect.objectContaining({
      id: "session-1",
      requestedStageCount: 3,
    }));
    expect(deps.stateStore.setLastModelTier).toHaveBeenCalledWith("nano");
    expect(deps.stateStore.setPlanningLoading).toHaveBeenNthCalledWith(1, true);
    expect(deps.stateStore.setPlanningLoading).toHaveBeenLastCalledWith(false);
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Build checkout",
      requestedStageCount: 3,
    }));
    expect(mocks.providerClarifyIntent).not.toHaveBeenCalled();
    expect(deps.stateStore.setPendingPlanDraft).not.toHaveBeenCalled();
  });

  it("uses an explicit planning provider from the Control Room for first-pass card generation", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const generatedRunbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({})),
        getAccessToken: vi.fn(async () => undefined),
        getPlanningProviderSecret: vi.fn(async () => undefined),
        setPlanningProviderSecret: vi.fn(async () => undefined),
        clearPlanningProviderSecret: vi.fn(async () => undefined),
        setBuildSession: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearBuildSession: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        setPendingPlanDraft: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: string; text: string }) => ({
          id: "msg-1",
          ts: 0,
          ...message,
        })),
        getChatHistory: vi.fn(() => ({ messages: [] })),
      },
      sessionStore: {
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    const validateConnection = vi.fn(async () => ({ available: true }));
    mocks.showInputBox.mockResolvedValueOnce("sk-test-openai");
    mocks.resolveDryLakeAiProvider.mockResolvedValue({
      provider: {
        id: "openai-api",
        label: "OpenAI API",
        isAvailable: mocks.providerIsAvailable,
        validateConnection,
        generateDraftRunbook: mocks.providerGenerateDraftRunbook,
        clarifyIntent: mocks.providerClarifyIntent,
        planningChat: mocks.providerPlanningChat,
        refinePurpose: mocks.providerRefinePurpose,
        refineArchitecture: mocks.providerRefineArchitecture,
        generatePhasePlan: mocks.providerGeneratePhasePlan,
      },
    });
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({ runbook: generatedRunbook });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout", "openai-api");

    expect(mocks.showWarningMessage).not.toHaveBeenCalledWith(
      "Connect your DryLake account before starting a Build Session.",
      "Connect DryLake",
    );
    const configurationArg = mocks.resolveDryLakeAiProvider.mock.calls[0][0].configuration;
    expect(configurationArg.get("aiProvider")).toBe("openai-api");
    expect(deps.stateStore.setPlanningProviderSecret).toHaveBeenCalledWith("openai-api", "sk-test-openai");
    expect(validateConnection).toHaveBeenCalledOnce();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledWith(runbookUri, generatedRunbook);
    expect(deps.stateStore.setPendingPlanDraft).not.toHaveBeenCalled();
    expect(deps.sessionStore.createSession).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "openai-api",
    }));
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Build checkout",
    }));
    expect(mocks.providerClarifyIntent).not.toHaveBeenCalled();
  });

  it("rejects a direct planning provider key when the live connection test fails", async () => {
    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({})),
        getAccessToken: vi.fn(async () => undefined),
        getPlanningProviderSecret: vi.fn(async () => undefined),
        setPlanningProviderSecret: vi.fn(async () => undefined),
        clearPlanningProviderSecret: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
      },
      sessionStore: {
        findRunbookUri: vi.fn(),
        getDefaultRunbookUri: vi.fn(),
        createSession: vi.fn(),
        writeRunbook: vi.fn(),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    const validateConnection = vi.fn(async () => ({
      available: false,
      reason: "401 unauthorized",
    }));
    mocks.showInputBox.mockResolvedValueOnce("bad-openai-key");
    mocks.resolveDryLakeAiProvider.mockResolvedValue({
      provider: {
        id: "openai-api",
        label: "OpenAI API",
        isAvailable: mocks.providerIsAvailable,
        validateConnection,
        generateDraftRunbook: mocks.providerGenerateDraftRunbook,
        clarifyIntent: mocks.providerClarifyIntent,
        planningChat: mocks.providerPlanningChat,
        refinePurpose: mocks.providerRefinePurpose,
        refineArchitecture: mocks.providerRefineArchitecture,
        generatePhasePlan: mocks.providerGeneratePhasePlan,
      },
    });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout", "openai-api");

    expect(deps.stateStore.setPlanningProviderSecret).toHaveBeenCalledWith("openai-api", "bad-openai-key");
    expect(validateConnection).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearPlanningProviderSecret).toHaveBeenCalledWith("openai-api");
    expect(mocks.showWarningMessage).toHaveBeenCalledWith("OpenAI API connection failed: 401 unauthorized");
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(mocks.providerGenerateDraftRunbook).not.toHaveBeenCalled();
  });

  it("configures a direct planning provider key from the Control Room", async () => {
    configurationValues.set("drylake.claude.apiKeyEnvVar", "DRYLAKE_TEST_ANTHROPIC_KEY");
    const originalEnv = process.env.DRYLAKE_TEST_ANTHROPIC_KEY;
    delete process.env.DRYLAKE_TEST_ANTHROPIC_KEY;

    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({})),
        getAccessToken: vi.fn(async () => undefined),
        getPlanningProviderSecret: vi.fn(async () => undefined),
        setPlanningProviderSecret: vi.fn(async () => undefined),
        clearPlanningProviderSecret: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
      },
      sessionStore: {},
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    const validateConnection = vi.fn(async () => ({ available: true }));
    mocks.resolveDryLakeAiProvider.mockResolvedValue({
      provider: {
        id: "claude-api",
        label: "Claude API",
        isAvailable: mocks.providerIsAvailable,
        validateConnection,
        generateDraftRunbook: mocks.providerGenerateDraftRunbook,
        clarifyIntent: mocks.providerClarifyIntent,
        planningChat: mocks.providerPlanningChat,
        refinePurpose: mocks.providerRefinePurpose,
        refineArchitecture: mocks.providerRefineArchitecture,
        generatePhasePlan: mocks.providerGeneratePhasePlan,
      },
    });

    try {
      await configurePlanningProviderCommand(deps as never, "claude-api", "save-secret", "sk-ant-test");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DRYLAKE_TEST_ANTHROPIC_KEY;
      } else {
        process.env.DRYLAKE_TEST_ANTHROPIC_KEY = originalEnv;
      }
    }

    expect(mocks.showInputBox).not.toHaveBeenCalled();
    expect(deps.stateStore.setPlanningProviderSecret).toHaveBeenCalledWith("claude-api", "sk-ant-test");
    expect(validateConnection).toHaveBeenCalledOnce();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith("Claude API is connected for DryLake planning.");
  });

  it("does not create cards when first-message AI plan generation fails after clarification", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const messages: Array<{ id: string; ts: number; role: "user" | "ai" | "system"; text: string }> = [];
    const deps = {
      apiClient: {
        openWebUrl: vi.fn(() => mocks.billingUri),
      },
      stateStore: {
        getConnection: vi.fn(() => ({ userEmail: "pro@example.com" })),
        getAccessToken: vi.fn(async () => "token"),
        setAwaitingPlanRefreshUntil: vi.fn(async () => undefined),
        setBuildSession: vi.fn(async () => undefined),
        getPendingPlanDraft: vi.fn(() => ({
          id: "pending-1",
          prompt: "Build checkout",
          mode: "build-app",
          createdAt: "2026-05-16T00:00:00.000Z",
          providerId: "xupra-pro-ai",
          providerLabel: "Xupra AI",
          questions: ["What does success look like?"],
        })),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: "user" | "ai" | "system"; text: string }) => {
          const next = { id: `msg-${messages.length + 1}`, ts: messages.length + 1, ...message };
          messages.push(next);
          return next;
        }),
        getChatHistory: vi.fn(() => ({ messages })),
      },
      sessionStore: {
        ensureRunbook: vi.fn(),
        readRunbook: vi.fn(async () => null),
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValue({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({
      message: "Xupra AI is not configured: OPENAI_MODEL is missing. (500).",
    });

    await chatSendMessageCommand(deps as never, "Success is a working checkout with tests.");

    expect(deps.sessionStore.ensureRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(deps.stateStore.clearPendingPlanDraft).not.toHaveBeenCalled();
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Success is a working checkout with tests."),
    }));
    expect(messages.at(-1)).toEqual(expect.objectContaining({
      role: "system",
      text: "DryLake planning failed: Xupra AI is not configured: OPENAI_MODEL is missing. (500).",
    }));
    expect(messages.at(-1)?.text).not.toContain("local draft");
  });

  it("generates cards after the user answers the required planning question", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const generatedRunbook = createStarterXu({
      prompt: "Build checkout\n\nUser answer:\nSuccess is a working checkout with tests.",
      mode: "build-app",
    });
    const messages: Array<{ id: string; ts: number; role: "user" | "ai" | "system"; text: string }> = [];
    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({ userEmail: "free@example.com" })),
        getAccessToken: vi.fn(async () => "token"),
        getPendingPlanDraft: vi.fn(() => ({
          id: "pending-1",
          prompt: "Build checkout",
          mode: "build-app",
          createdAt: "2026-05-16T00:00:00.000Z",
          providerId: "xupra-pro-ai",
          providerLabel: "Xupra AI",
          questions: ["What does success look like?"],
          requestedStageCount: 3,
        })),
        setBuildSession: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: "user" | "ai" | "system"; text: string }) => {
          const next = { id: `msg-${messages.length + 1}`, ts: messages.length + 1, ...message };
          messages.push(next);
          return next;
        }),
        getChatHistory: vi.fn(() => ({ messages })),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => null),
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValue({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({ runbook: generatedRunbook, modelTier: "nano" });

    await chatSendMessageCommand(deps as never, "Success is a working checkout with tests.");

    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledWith(runbookUri, generatedRunbook);
    expect(deps.sessionStore.createSession).toHaveBeenCalledWith(expect.objectContaining({
      requestedStageCount: 3,
      providerId: "xupra-pro-ai",
    }));
    expect(deps.stateStore.setBuildSession).toHaveBeenCalledWith(expect.objectContaining({
      id: "session-1",
      requestedStageCount: 3,
    }));
    expect(deps.stateStore.clearPendingPlanDraft).toHaveBeenCalledOnce();
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("DryLake asked these required planning questions"),
      requestedStageCount: 3,
    }));
    expect(messages.at(-1)).toEqual(expect.objectContaining({
      role: "ai",
      text: "DryLake drafted 5 planning cards. Review the cards below and reply with the most important refinement: scope, users, files to touch, data/auth, constraints, or deployment.",
    }));
  });

  function chatDeps() {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const messages: Array<{ id: string; ts: number; role: "user" | "ai" | "system"; text: string }> = [];
    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({ userEmail: "pro@example.com" })),
        getAccessToken: vi.fn(async () => "token"),
        getBuildSession: vi.fn(() => ({
          id: "session-1",
          prompt: "Build checkout",
          mode: "build-app",
          runbookPath: "drylake.xu",
          providerId: "xupra-pro-ai",
          providerLabel: "Xupra AI",
          createdAt: "2026-05-16T00:00:00.000Z",
        })),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: "user" | "ai" | "system"; text: string }) => {
          const next = { id: `msg-${messages.length + 1}`, ts: messages.length + 1, ...message };
          messages.push(next);
          return next;
        }),
        getChatHistory: vi.fn(() => ({ messages })),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook })),
        writeRunbook: vi.fn(async () => undefined),
        writePendingPlanChange: vi.fn(async () => undefined),
        clearPendingPlanChange: vi.fn(async () => undefined),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    return { deps, messages, runbook };
  }

  it("sends simple planning chat messages to Xupra AI", async () => {
    const { deps, messages } = chatDeps();
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerPlanningChat.mockResolvedValueOnce({ reply: "Hi. I am Xupra AI.", modelTier: "foundation" });

    await chatSendMessageCommand(deps as never, "hi");

    expect(mocks.resolveDryLakeAiProvider).toHaveBeenCalledOnce();
    expect(mocks.providerPlanningChat).toHaveBeenCalledWith(expect.objectContaining({
      chatTranscript: expect.stringContaining("User: hi"),
    }));
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(deps.stateStore.setLastModelTier).toHaveBeenCalledWith("foundation");
    expect(deps.stateStore.setPlanningLoading).toHaveBeenNthCalledWith(1, true);
    expect(deps.stateStore.setPlanningLoading).toHaveBeenLastCalledWith(false);
    expect(messages.at(-1)?.role).toBe("ai");
    expect(messages.at(-1)?.text).toBe("Hi. I am Xupra AI.");
  });

  it("reports Planning Chat outages without writing a fallback plan", async () => {
    const { deps, messages } = chatDeps();
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerPlanningChat.mockResolvedValueOnce({ error: "Failed to run DryLake Planning Chat (500)." });

    await chatSendMessageCommand(deps as never, "Add refund webhook handling.");

    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(messages.at(-1)?.text).toContain("Xupra AI Planning Chat is not working");
    expect(messages.at(-1)?.text).not.toContain("left unchanged");
    expect(messages.at(-1)?.text).not.toContain("fallback");
  });

  it("persists proposed plan changes instead of rewriting active runbooks", async () => {
    const { deps, runbook } = chatDeps();
    runbook.phases[0].status = "active";
    const proposedRunbook: ApplicationBuildRunbook = {
      ...runbook,
      phases: runbook.phases.map((phase, index) =>
        index === 0
          ? { ...phase, objective: "Implement checkout with explicit retry handling." }
          : phase,
      ),
    };
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerPlanningChat.mockResolvedValueOnce({
      reply: "I drafted a change for review.",
      runbook: proposedRunbook,
    });

    await chatSendMessageCommand(deps as never, "Add retry handling.");

    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.writePendingPlanChange).toHaveBeenCalledWith(expect.objectContaining({
      sourceChatMessageId: "msg-1",
      baseRunbookPath: "/repo/drylake.xu",
      proposedRunbook,
      affectedPhaseIds: [runbook.phases[0].id],
      status: "pending",
    }));
  });

  it("applies approved pending changes only to the selected phase", async () => {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    runbook.phases = runbook.phases.slice(0, 2).map((phase, index) => ({
      ...phase,
      id: `P-0${index + 1}`,
      title: `Phase ${index + 1}`,
      status: index === 0 ? "active" : "pending",
      agent: index === 0 ? "codex" : undefined,
    }));
    const proposedRunbook: ApplicationBuildRunbook = {
      ...runbook,
      phases: [
        { ...runbook.phases[0], title: "Updated phase", objective: "Updated objective", status: "pending", agent: undefined },
        { ...runbook.phases[1], title: "Unapproved update" },
      ],
    };
    const pending = {
      id: "plan-change-1",
      sourceChatMessageId: "msg-1",
      createdAt: "2026-05-23T00:00:00.000Z",
      baseRunbookPath: "drylake.xu",
      proposedRunbook,
      affectedPhaseIds: ["P-01", "P-02"],
      phaseSummaries: {},
      phaseResolutions: {},
      status: "pending" as const,
    };
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const writeRunbook = vi.fn(async (...args: [unknown, ApplicationBuildRunbook]) => {
      void args;
    });
    const deps = {
      apiClient: {},
      stateStore: {},
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook })),
        readPendingPlanChange: vi.fn(async () => pending),
        writeRunbook,
        writePendingPlanChange: vi.fn(async () => undefined),
      },
      controlRoom: { refresh: vi.fn(async () => undefined) },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await approvePlanChangeCommand(deps as never, "P-01");

    const writtenRunbook = writeRunbook.mock.calls[0]?.[1] as ApplicationBuildRunbook;
    expect(writtenRunbook.phases.find((phase) => phase.id === "P-01")).toMatchObject({
      title: "Updated phase",
      objective: "Updated objective",
      status: "active",
      agent: "codex",
    });
    expect(writtenRunbook.phases.find((phase) => phase.id === "P-02")?.title).toBe("Phase 2");
    expect(deps.sessionStore.writePendingPlanChange).toHaveBeenCalledWith(expect.objectContaining({
      status: "pending",
      phaseResolutions: expect.objectContaining({
        "P-01": expect.objectContaining({ status: "approved" }),
      }),
    }));
  });

  it("marks pending plan changes discarded when all affected phases are rejected", async () => {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    runbook.phases = [{ ...runbook.phases[0], id: "P-01" }];
    const pending = {
      id: "plan-change-1",
      sourceChatMessageId: "msg-1",
      createdAt: "2026-05-23T00:00:00.000Z",
      baseRunbookPath: "drylake.xu",
      proposedRunbook: runbook,
      affectedPhaseIds: ["P-01"],
      phaseSummaries: {},
      phaseResolutions: {},
      status: "pending" as const,
    };
    const deps = {
      apiClient: {},
      stateStore: {},
      sessionStore: {
        readPendingPlanChange: vi.fn(async () => pending),
        writePendingPlanChange: vi.fn(async () => undefined),
      },
      controlRoom: { refresh: vi.fn(async () => undefined) },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await rejectPlanChangeCommand(deps as never, "P-01");

    expect(deps.sessionStore.writePendingPlanChange).toHaveBeenCalledWith(expect.objectContaining({
      status: "discarded",
      phaseResolutions: expect.objectContaining({
        "P-01": expect.objectContaining({ status: "rejected" }),
      }),
    }));
  });

  it("archives the current plan and clears pending plan changes when starting a new session", async () => {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    runbook.phases[0].status = "active";
    const deps = {
      apiClient: {},
      stateStore: {
        clearBuildSession: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
      },
      sessionStore: {
        findRunbookUri: vi.fn(async () => ({ path: "/repo/drylake.xu" })),
        readRunbook: vi.fn(async () => ({ uri: { path: "/repo/drylake.xu" }, runbook })),
        archiveCurrentRunbook: vi.fn(async () => ({ id: "archive-1", uri: { path: "/repo/.drylake/sessions/archive-1/drylake.xu" }, runbook })),
        deleteCurrentPlan: vi.fn(async () => true),
        clearPendingPlanChanges: vi.fn(async () => undefined),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.showWarningMessage.mockResolvedValueOnce("Archive & Start New");

    await newSessionCommand(deps as never);

    expect(deps.sessionStore.archiveCurrentRunbook).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearBuildSession).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearPendingPlanDraft).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearChatHistory).toHaveBeenCalledOnce();
    expect(deps.stateStore.setPlanningLoading).toHaveBeenCalledWith(false);
    expect(deps.sessionStore.clearPendingPlanChanges).toHaveBeenCalledOnce();
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("deletes the current plan and clears pending plan changes when requested", async () => {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    const deps = {
      apiClient: {},
      stateStore: {
        clearBuildSession: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
      },
      sessionStore: {
        findRunbookUri: vi.fn(async () => ({ path: "/repo/drylake.xu" })),
        readRunbook: vi.fn(async () => ({ uri: { path: "/repo/drylake.xu" }, runbook })),
        archiveCurrentRunbook: vi.fn(async () => ({ id: "archive-1", uri: { path: "/repo/.drylake/sessions/archive-1/drylake.xu" }, runbook })),
        deleteCurrentPlan: vi.fn(async () => true),
        clearPendingPlanChanges: vi.fn(async () => undefined),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.showWarningMessage.mockResolvedValueOnce("Delete & Start New");

    await newSessionCommand(deps as never);

    expect(deps.sessionStore.archiveCurrentRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.deleteCurrentPlan).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearBuildSession).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearPendingPlanDraft).toHaveBeenCalledOnce();
    expect(deps.sessionStore.clearPendingPlanChanges).toHaveBeenCalledOnce();
  });

  it("switches the Control Room to a selected archived session", async () => {
    const archivedRunbook = createStarterXu({ prompt: "Archived checkout", mode: "build-app" });
    const deps = {
      apiClient: {},
      stateStore: {
        clearBuildSession: vi.fn(async () => undefined),
        clearPendingPlanDraft: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
      },
      sessionStore: {
        listArchivedSessions: vi.fn(async () => [
          {
            id: "archive-1",
            name: "Archived checkout",
            uri: { path: "/repo/.drylake/sessions/archive-1/drylake.xu" },
            archivedAt: "2026-05-29T00:00:00.000Z",
          },
        ]),
        restoreArchivedSession: vi.fn(async () => ({
          uri: { path: "/repo/drylake.xu" },
          runbook: archivedRunbook,
        })),
        clearPendingPlanChanges: vi.fn(async () => undefined),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await openSessionsCommand(deps as never);

    expect(mocks.showQuickPick).toHaveBeenCalledWith(
      [expect.objectContaining({ label: "Archived checkout" })],
      expect.objectContaining({ placeHolder: "Switch the Control Room to an archived DryLake plan." }),
    );
    expect(deps.sessionStore.restoreArchivedSession).toHaveBeenCalledWith("archive-1");
    expect(deps.stateStore.clearBuildSession).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearPendingPlanDraft).toHaveBeenCalledOnce();
    expect(deps.stateStore.clearChatHistory).toHaveBeenCalledOnce();
    expect(deps.stateStore.setPlanningLoading).toHaveBeenCalledWith(false);
    expect(deps.sessionStore.clearPendingPlanChanges).toHaveBeenCalledOnce();
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
    expect(mocks.showTextDocument).not.toHaveBeenCalled();
  });

  function reorderRunbook(): ApplicationBuildRunbook {
    const value = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    value.phases = value.phases.slice(0, 3).map((phase, index) => ({
      ...phase,
      id: `P-0${index + 1}`,
      title: `Phase ${index + 1}`,
      steps: [{ id: `P-0${index + 1}-step-01`, text: `step-${index + 1}`, status: "pending" as const }],
      agent: index === 1 ? "codex" : phase.agent,
      status: index === 2 ? "complete" : phase.status,
    }));
    return value;
  }

  function reorderDeps(runbook = reorderRunbook(), options?: { usageSync?: boolean; buildSessionId?: string }) {
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const writeRunbook = vi.fn(async (...args: [unknown, ApplicationBuildRunbook]) => {
      void args;
    });
    const recordUsageEvent = vi.fn(async () => ({
      event: {
        id: "event-1",
        createdAt: "2026-06-03T00:00:00.000Z",
      },
    }));
    const deps = {
      apiClient: {
        recordUsageEvent,
      },
      stateStore: {
        getBuildSession: vi.fn(() => options?.buildSessionId ? { id: options.buildSessionId } : null),
        getAccessToken: vi.fn(async () => options?.usageSync ? "token-1" : undefined),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook })),
        writeRunbook,
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    return { deps, runbook, recordUsageEvent };
  }

  async function flushQueuedUsageEvents() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function expectNoPhaseStatusUpdateCommand() {
    expect(mocks.executeCommand).not.toHaveBeenCalledWith("drylake.updatePhaseStatus", expect.anything(), expect.anything());
  }

  function chooseRequireApproval() {
    mocks.showInformationMessage.mockResolvedValueOnce("Require Approval");
  }

  function chooseAutopilot() {
    mocks.showInformationMessage.mockResolvedValueOnce("Autopilot");
  }

  it("moves a phase to the front when afterPhaseId is null", async () => {
    const { deps } = reorderDeps();

    await reorderPhaseCommand(deps as never, "P-02", null);

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.map((phase) => phase.id)).toEqual(["P-02", "P-01", "P-03"]);
    expect(written.phases[0].agent).toBe("codex");
    expect(written.phases[0].steps.map((step: { text: string }) => step.text)).toEqual(["step-2"]);
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("moves a phase immediately after a target phase", async () => {
    const { deps } = reorderDeps();

    await reorderPhaseCommand(deps as never, "P-03", "P-01");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.map((phase) => phase.id)).toEqual(["P-01", "P-03", "P-02"]);
    expect(written.phases.find((phase) => phase.id === "P-03")?.status).toBe("complete");
  });

  it("does not write or refresh when dropping a phase onto itself", async () => {
    const { deps } = reorderDeps();

    await reorderPhaseCommand(deps as never, "P-01", "P-01");

    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(deps.controlRoom.refresh).not.toHaveBeenCalled();
    expect(deps.refreshSidebar).not.toHaveBeenCalled();
  });

  it("persists newly native phase-agent selections", async () => {
    const { deps } = reorderDeps();

    await updatePhaseAgentCommand(deps as never, "P-01", "gemini");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.find((phase) => phase.id === "P-01")?.agent).toBe("gemini");
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("clears an incompatible selected skill when changing phase agents", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    runbook.phases[0].handoffProfile = {
      kind: "skill",
      label: "token-reduction",
      logicalPath: ".codex/skills/token-reduction/SKILL.md",
      sourcePlatform: "codex",
    };
    const { deps } = reorderDeps(runbook);

    await updatePhaseAgentCommand(deps as never, "P-01", "gemini");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.find((phase) => phase.id === "P-01")?.agent).toBe("gemini");
    expect(written.phases.find((phase) => phase.id === "P-01")?.handoffProfile).toBeUndefined();
  });

  it("requires an explicit phase agent before launch", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = undefined;
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.showWarningMessage).toHaveBeenCalledWith("Select an agent for Phase 1 before running this phase.");
    expect(mocks.writePhaseHandoffFile).not.toHaveBeenCalled();
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
  });

  it("runs the next in-order phase instead of only exporting a prompt", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);
    chooseRequireApproval();

    await runNextPhaseCommand(deps as never);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
  });

  it("asks for handoff execution mode before launching a phase", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);
    chooseAutopilot();

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      "Run this handoff in Autopilot mode? Autopilot starts the next phase only after you mark this one complete.",
      { modal: true },
      "Autopilot",
      "Require Approval",
    );
    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.handoff.autopilot).toBe(true);
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("cancels handoff launch when execution mode is dismissed", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);
    mocks.showInformationMessage.mockResolvedValueOnce(undefined);

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
  });

  it("toggles autopilot mode in the runbook", async () => {
    const { deps } = reorderDeps();

    await toggleAutopilotCommand(deps as never);

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.handoff.autopilot).toBe(true);
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("does not activate the next phase when completing steps without autopilot", async () => {
    const runbook = reorderRunbook();
    runbook.handoff.autopilot = false;
    runbook.phases[0].status = "active";
    runbook.phases[1].status = "pending";
    const { deps } = reorderDeps(runbook);

    await toggleStepCommand(deps as never, "P-01", "P-01-step-01", "complete");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases[0].status).toBe("complete");
    expect(written.phases[1].status).toBe("pending");
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith("Phase 1 complete. Use Run Next Phase to continue.");
  });

  it("autopilot launches the next selected phase after completion", async () => {
    const runbook = reorderRunbook();
    runbook.handoff.autopilot = true;
    runbook.phases[0].status = "active";
    runbook.phases[0].agent = "codex";
    runbook.phases[1].agent = "gemini";
    let currentRunbook = runbook;
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const deps = {
      apiClient: {},
      stateStore: {
        getBuildSession: vi.fn(() => null),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook: currentRunbook })),
        writeRunbook: vi.fn(async (...args: [unknown, ApplicationBuildRunbook]) => {
          currentRunbook = args[1];
        }),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await toggleStepCommand(deps as never, "P-01", "P-01-step-01", "complete");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "gemini" }));
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledTimes(2);
    expect(currentRunbook.phases[0].status).toBe("complete");
    expect(currentRunbook.phases[1].status).toBe("active");
    expect(currentRunbook.phases[1].steps.every((step) => step.status === "pending")).toBe(true);
  });

  it("autopilot pauses when the next phase has no selected agent", async () => {
    const runbook = reorderRunbook();
    runbook.handoff.autopilot = true;
    runbook.phases[0].status = "active";
    runbook.phases[0].agent = "codex";
    runbook.phases[1].agent = undefined;
    const { deps } = reorderDeps(runbook);

    await toggleStepCommand(deps as never, "P-01", "P-01-step-01", "complete");

    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Phase 1 complete. Autopilot is paused until you select an agent for Phase 2.",
    );
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
  });

  it("writes handoff files and launches selected phase agents", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "gemini";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);

    expect(mocks.writeClipboard).not.toHaveBeenCalled();
    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      agent: "gemini",
      content: expect.stringContaining("You are running as Gemini CLI."),
    }));
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({
      agent: "gemini",
      prompt: expect.stringContaining("You are running as Gemini CLI."),
    }));
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledOnce();
    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.find((phase) => phase.id === "P-01")?.status).toBe("active");
    expect(written.phases.find((phase) => phase.id === "P-01")?.steps.every((step) => step.status === "pending")).toBe(true);
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("applies the selected phase agent to other unassigned phases", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = undefined;
    runbook.phases[1].agent = undefined;
    runbook.phases[2].agent = "codex";
    const { deps } = reorderDeps(runbook);

    await updatePhaseAgentCommand(deps as never, "P-01", "gemini");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.map((phase) => phase.agent)).toEqual(["gemini", "gemini", "codex"]);
  });

  it("records signed-in phase agent selections", async () => {
    const { deps, recordUsageEvent } = reorderDeps(reorderRunbook(), {
      usageSync: true,
      buildSessionId: "session-1",
    });

    await updatePhaseAgentCommand(deps as never, "P-01", "gemini");
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_agent_selected",
      sessionId: "session-1",
      phaseId: "P-01",
      phaseTitle: "Phase 1",
      agentId: "gemini",
      workspaceHash: expect.any(String),
    }));
  });

  it("records signed-in skill selections", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps, recordUsageEvent } = reorderDeps(runbook, {
      usageSync: true,
      buildSessionId: "session-1",
    });
    mocks.scanWorkspaceFiles.mockResolvedValue([
      {
        logicalPath: ".codex/skills/token-reduction/SKILL.md",
        category: "skill",
        content: "Use token reduction before editing files.",
      },
    ]);

    await updatePhaseHandoffProfileCommand(deps as never, "P-01", ".codex/skills/token-reduction/SKILL.md");
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_skill_selected",
      sessionId: "session-1",
      phaseId: "P-01",
      phaseTitle: "Phase 1",
      agentId: "codex",
      skillLogicalPath: ".codex/skills/token-reduction/SKILL.md",
    }));
  });

  it("records signed-in handoff launches and explicit phase completion", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps, recordUsageEvent } = reorderDeps(runbook, {
      usageSync: true,
      buildSessionId: "session-1",
    });

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_handoff_launched",
      sessionId: "session-1",
      phaseId: "P-01",
      phaseTitle: "Phase 1",
      agentId: "codex",
      actionType: "run",
      launchStatus: "launched",
      promptEstimatedTokens: expect.any(Number),
    }));
    expect(recordUsageEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_marked_complete",
    }));

    recordUsageEvent.mockClear();
    await updatePhaseStatusCommand(deps as never, "P-01", "complete");
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_marked_complete",
      phaseId: "P-01",
      agentId: "codex",
      metadata: expect.objectContaining({
        completionMode: "user_confirmed",
      }),
    }));
  });

  it("records signed-in launch failures without completing the phase", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps, recordUsageEvent } = reorderDeps(runbook, {
      usageSync: true,
      buildSessionId: "session-1",
    });
    mocks.launchPhaseAgent.mockResolvedValueOnce({
      status: "not-installed",
      message: "OpenAI Codex is not installed.",
      reasonCode: "not-found",
    });

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_handoff_launch_failed",
      phaseId: "P-01",
      agentId: "codex",
      actionType: "run",
      launchStatus: "not-installed",
      reasonCode: "not-found",
    }));
    expect(recordUsageEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_marked_complete",
    }));
  });

  it("persists selected Codex skills on the phase and injects the selected skill into the handoff prompt", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);
    mocks.scanWorkspaceFiles.mockResolvedValue([
      {
        logicalPath: ".codex/skills/token-reduction/SKILL.md",
        category: "skill",
        content: "Use token reduction before editing files.",
      },
    ]);

    await updatePhaseHandoffProfileCommand(deps as never, "P-01", ".codex/skills/token-reduction/SKILL.md");

    const writtenAfterSelection = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(writtenAfterSelection.phases.find((phase) => phase.id === "P-01")?.handoffProfile).toMatchObject({
      label: "token-reduction",
      logicalPath: ".codex/skills/token-reduction/SKILL.md",
      sourcePlatform: "codex",
      kind: "skill",
    });
    runbook.phases[0].handoffProfile = writtenAfterSelection.phases[0].handoffProfile;
    deps.sessionStore.writeRunbook.mockClear();

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);

    expect(mocks.showQuickPick).not.toHaveBeenCalled();
    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("## Requested Skill / Agent Profile"),
    }));
    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Use token reduction before editing files."),
    }));
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(".codex/skills/token-reduction/SKILL.md"),
    }));
  });

  it("persists selected Blackbox skills on the phase and injects the selected skill into the handoff prompt", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "blackbox";
    const { deps } = reorderDeps(runbook);
    mocks.scanWorkspaceFiles.mockResolvedValue([
      {
        logicalPath: ".blackbox/skills/frontend/SKILL.md",
        category: "skill",
        content: "Use Blackbox frontend conventions before editing files.",
      },
    ]);

    await updatePhaseHandoffProfileCommand(deps as never, "P-01", ".blackbox/skills/frontend/SKILL.md");

    const writtenAfterSelection = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(writtenAfterSelection.phases.find((phase) => phase.id === "P-01")?.handoffProfile).toMatchObject({
      label: "frontend",
      logicalPath: ".blackbox/skills/frontend/SKILL.md",
      sourcePlatform: "blackbox",
      kind: "skill",
    });
    runbook.phases[0].handoffProfile = writtenAfterSelection.phases[0].handoffProfile;
    deps.sessionStore.writeRunbook.mockClear();

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);

    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Use this Blackbox skill for this handoff."),
    }));
    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Use Blackbox frontend conventions before editing files."),
    }));
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({
      agent: "blackbox",
      prompt: expect.stringContaining(".blackbox/skills/frontend/SKILL.md"),
    }));
  });

  it("keeps the phase active after a successful handoff launch", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledOnce();
    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    const phase = written.phases.find((item) => item.id === "P-01");
    expect(phase?.status).toBe("active");
    expect(phase?.steps.every((step) => step.status === "pending")).toBe(true);
    expect(written.phases.find((item) => item.id === "P-02")?.status).toBe("pending");
  });

  it("autopilot starts the next selected phase after explicit completion", async () => {
    const runbook = reorderRunbook();
    runbook.handoff.autopilot = true;
    runbook.phases[0].agent = "codex";
    runbook.phases[1].agent = "gemini";
    let currentRunbook = runbook;
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const deps = {
      apiClient: {},
      stateStore: {
        getBuildSession: vi.fn(() => null),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook: currentRunbook })),
        writeRunbook: vi.fn(async (...args: [unknown, ApplicationBuildRunbook]) => {
          currentRunbook = args[1];
        }),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await handoffPhaseCommand(deps as never, "P-01", undefined, true);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalledWith(expect.objectContaining({ agent: "gemini" }));
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledTimes(1);
    expect(currentRunbook.phases[0].status).toBe("active");
    expect(currentRunbook.phases[1].status).toBe("pending");

    await updatePhaseStatusCommand(deps as never, "P-01", "complete");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "gemini" }));
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledTimes(3);
    expect(currentRunbook.phases[0].status).toBe("complete");
    expect(currentRunbook.phases[0].steps.every((step) => step.status === "complete")).toBe(true);
    expect(currentRunbook.phases[1].status).toBe("active");
    expect(currentRunbook.phases[1].steps.every((step) => step.status === "pending")).toBe(true);
  });

  // Export-only actions must never change phase status.
  describe("export-only handoff actions", () => {
    it.each([
      ["Copy action", "copy", undefined],
      ["Markdown action", "markdown", undefined],
      ["Export .sh", "script-sh", "sh"],
      ["Export .bat", "script-bat", "bat"],
    ] as const)("%s does not change phase status through command dispatch", async (_label, action, shell) => {
      const runbook = reorderRunbook();
      runbook.phases[0].agent = "codex";
      const originalPhaseStatuses = runbook.phases.map((phase) => ({ id: phase.id, status: phase.status }));
      const { deps } = reorderDeps(runbook);

      await handoffPhaseCommand(deps as never, "P-01", action);

      expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
      expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
      expect(runbook.phases.map((phase) => ({ id: phase.id, status: phase.status }))).toEqual(originalPhaseStatuses);
      expectNoPhaseStatusUpdateCommand();

      if (action === "copy") {
        expect(mocks.writeClipboard).toHaveBeenCalledWith(expect.stringContaining("You are running as OpenAI Codex."));
        expect(mocks.openTextDocument).not.toHaveBeenCalled();
      } else if (action === "markdown") {
        expect(mocks.openTextDocument).toHaveBeenCalledWith({
          fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md",
          path: "/repo/.drylake/handoffs/P-01-codex.md",
        });
      } else {
        expect(mocks.writePhaseHandoffScript).toHaveBeenCalledWith(expect.objectContaining({
          agent: "codex",
          shell,
        }));
      }
    });
  });

  it("copies selected phase prompts as an explicit handoff action", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "gemini";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", "copy");

    expect(mocks.writeClipboard).toHaveBeenCalledWith(expect.stringContaining("You are running as Gemini CLI."));
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("records signed-in prompt export actions separately from launches", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "gemini";
    const { deps, recordUsageEvent } = reorderDeps(runbook, {
      usageSync: true,
      buildSessionId: "session-1",
    });

    await handoffPhaseCommand(deps as never, "P-01", "copy");
    await flushQueuedUsageEvents();

    expect(recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_handoff_exported",
      sessionId: "session-1",
      phaseId: "P-01",
      agentId: "gemini",
      actionType: "copy",
      launchStatus: "exported",
    }));
    expect(recordUsageEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "phase_handoff_launched",
    }));
  });

  it("exports selected phase prompts as markdown", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", "markdown");

    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(mocks.openTextDocument).toHaveBeenCalledWith({
      fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md",
      path: "/repo/.drylake/handoffs/P-01-codex.md",
    });
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("exports CLI handoff scripts", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", "script-bat");

    expect(mocks.writePhaseHandoffScript).toHaveBeenCalledWith(expect.objectContaining({
      agent: "codex",
      shell: "bat",
    }));
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("runs the selected phase agent without switching to a second agent", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01", "unsupported-action", false);

    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      agent: "codex",
      content: expect.stringContaining("You are running as OpenAI Codex."),
    }));
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("prevents launching a later phase before the active phase is complete", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].status = "active";
    runbook.phases[1].status = "pending";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-02");

    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Complete Phase 1 before running Phase 2. DryLake runs phases in order.",
    );
    expect(mocks.writePhaseHandoffFile).not.toHaveBeenCalled();
    expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
  });

  it("opens the saved handoff file when the selected agent is not launchable", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "cursor";
    const { deps } = reorderDeps(runbook);
    mocks.launchPhaseAgent.mockResolvedValueOnce({ status: "fallback", message: "DryLake copied the phase prompt." });

    await handoffPhaseCommand(deps as never, "P-01", undefined, true);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "cursor" }));
    expect(mocks.showAgentLaunchFallbackActions).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ status: "fallback" }),
      promptContent: expect.stringContaining("You are running as Cursor CLI."),
      promptFile: {
        fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md",
        path: "/repo/.drylake/handoffs/P-01-codex.md",
      },
    }));
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("does not mark a phase active when the selected agent executable is missing", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const originalPhaseStatuses = runbook.phases.map((phase) => ({ id: phase.id, status: phase.status }));
    const { deps } = reorderDeps(runbook);
    mocks.launchPhaseAgent.mockResolvedValueOnce({
      status: "not-installed",
      message: "OpenAI Codex is not installed.",
    });

    await handoffPhaseCommand(deps as never, "P-01", undefined, false);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(mocks.showAgentLaunchFallbackActions).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ status: "not-installed" }),
      promptContent: expect.stringContaining("You are running as OpenAI Codex."),
    }));
    expect(runbook.phases.map((phase) => ({ id: phase.id, status: phase.status }))).toEqual(originalPhaseStatuses);
    expectNoPhaseStatusUpdateCommand();
  });
});
