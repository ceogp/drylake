import { beforeEach, describe, expect, it, vi } from "vitest";

import { startBuildSessionCommand } from "../commands/runbooks";
import { ControlRoomProvider } from "../webview/controlRoomProvider";
import type { ApplicationBuildRunbook } from "../xu/types";

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  showWarningMessage: vi.fn(),
  providerIsAvailable: vi.fn(),
  providerGenerateDraftRunbook: vi.fn(),
  providerPlanningChat: vi.fn(),
  providerRefinePurpose: vi.fn(),
  providerRefineArchitecture: vi.fn(),
  providerGeneratePhasePlan: vi.fn(),
  resolveDryLakeAiProvider: vi.fn(),
  scanWorkspaceFiles: vi.fn(),
  writeClipboard: vi.fn(),
}));

let panel: { webview: { html: string; onDidReceiveMessage: ReturnType<typeof vi.fn> } } | undefined;

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  ViewColumn: { One: 1 },
  Uri: {
    parse: vi.fn((value: string) => ({ value })),
    joinPath: vi.fn((root: { fsPath?: string; path?: string }, ...parts: string[]) => ({
      fsPath: [root.fsPath ?? "C:/repo", ...parts].join("/"),
      path: [root.path ?? "/repo", ...parts].join("/"),
    })),
  },
  env: {
    clipboard: {
      writeText: mocks.writeClipboard,
    },
  },
  window: {
    createWebviewPanel: vi.fn(() => {
      panel = {
        onDidDispose: vi.fn(),
        reveal: vi.fn(),
        webview: {
          html: "",
          onDidReceiveMessage: vi.fn(),
        },
      } as never;

      return panel;
    }),
    showWarningMessage: mocks.showWarningMessage,
    showInformationMessage: vi.fn(),
    withProgress: vi.fn(async (_options, task) => task()),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "C:/repo", path: "/repo" } }],
    asRelativePath: vi.fn((uri: { path?: string; fsPath?: string }) => uri.path ?? uri.fsPath ?? "drylake.xu"),
    getConfiguration: vi.fn((section: string) => ({
      get<T>(key: string, defaultValue?: T) {
        if (section === "drylake" && key === "aiProvider") {
          return "xupra-pro-ai" as T;
        }

        return defaultValue as T;
      },
    })),
  },
  commands: {
    executeCommand: mocks.executeCommand,
  },
}));

vi.mock("../services/workspaceScanner", () => ({
  getWorkspaceDisplayName: vi.fn(() => "Smoke Workspace"),
  scanWorkspaceFiles: mocks.scanWorkspaceFiles,
}));

vi.mock("../ai/providerResolver", () => ({
  resolveDryLakeAiProvider: mocks.resolveDryLakeAiProvider,
}));

vi.mock("../agents/phaseAgentLauncher", () => ({
  launchPhaseAgent: vi.fn(),
  phaseHandoffActionFromArg: vi.fn(),
  phaseAgentLabel: (agent: string) => agent,
  phaseAgentHint: (agent: string) => `Run with ${agent}`,
  phaseAgentHandoffOptions: vi.fn(() => []),
  showAgentLaunchFallbackActions: vi.fn(),
  writePhaseHandoffFile: vi.fn(),
  writePhaseHandoffScript: vi.fn(),
}));

vi.mock("../agents/handoffProfiles", () => ({
  collectHandoffProfiles: vi.fn(async () => []),
  handoffProfileMatchesAgent: vi.fn(() => false),
  handoffProfileRef: vi.fn(),
  resolveHandoffProfile: vi.fn(),
}));

function context() {
  return {
    subscriptions: [],
    workspaceState: {
      get: vi.fn(() => undefined),
      update: vi.fn(async () => undefined),
    },
  };
}

describe("card generation smoke", () => {
  beforeEach(() => {
    panel = undefined;
    mocks.executeCommand.mockReset();
    mocks.showWarningMessage.mockReset();
    mocks.providerIsAvailable.mockReset();
    mocks.providerGenerateDraftRunbook.mockReset();
    mocks.providerPlanningChat.mockReset();
    mocks.providerRefinePurpose.mockReset();
    mocks.providerRefineArchitecture.mockReset();
    mocks.providerGeneratePhasePlan.mockReset();
    mocks.resolveDryLakeAiProvider.mockReset();
    mocks.scanWorkspaceFiles.mockReset();
    mocks.writeClipboard.mockReset();
    mocks.scanWorkspaceFiles.mockResolvedValue([]);
    mocks.showWarningMessage.mockResolvedValue(undefined);
    mocks.resolveDryLakeAiProvider.mockResolvedValue({
      provider: {
        id: "xupra-pro-ai",
        label: "Xupra AI",
        isAvailable: mocks.providerIsAvailable,
        generateDraftRunbook: mocks.providerGenerateDraftRunbook,
        planningChat: mocks.providerPlanningChat,
        refinePurpose: mocks.providerRefinePurpose,
        refineArchitecture: mocks.providerRefineArchitecture,
        generatePhasePlan: mocks.providerGeneratePhasePlan,
      },
    });
  });

  it("writes local starter cards and renders phase cards when hosted AI is unavailable", async () => {
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const writeRunbook = vi.fn(async (_uri, _runbook: ApplicationBuildRunbook) => undefined);
    const messages: Array<{ id: string; ts: number; role: "user" | "ai" | "system"; text: string }> = [];
    const deps = {
      apiClient: {
        setAccessToken: vi.fn(),
      },
      stateStore: {
        getConnection: vi.fn(() => ({})),
        getAccessToken: vi.fn(async () => undefined),
        setBuildSession: vi.fn(async () => undefined),
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearAccessToken: vi.fn(async () => undefined),
        clearConnection: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
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
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-31T00:00:00.000Z", ...session })),
        writeRunbook,
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValueOnce({
      available: false,
      reason: "Connect a Xupra account to use DryLake planning.",
    });

    await startBuildSessionCommand(deps as never, context() as never, "build-app", "Build checkout", "xupra-pro-ai");

    const renderedRunbook = writeRunbook.mock.calls.at(0)?.[1];
    expect(renderedRunbook).toEqual(expect.objectContaining({
      intent: expect.objectContaining({ rawPrompt: "Build checkout" }),
    }));
    if (!renderedRunbook) {
      throw new Error("Expected first prompt to write a local starter runbook.");
    }
    expect(renderedRunbook.phases.length).toBeGreaterThan(0);
    expect(renderedRunbook.phases[0]?.steps.length).toBeGreaterThan(0);
    expect(renderedRunbook.phases[0]?.acceptance.length).toBeGreaterThan(0);

    const controlRoom = new ControlRoomProvider({
      readRunbook: async () => ({ uri: runbookUri, runbook: renderedRunbook }),
    } as never);
    await controlRoom.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";
    expect(html).toContain('class="phase-card');
    expect(html).toContain("Confirm application purpose");
    expect(html).toContain("Build Plan Chat");
    expect(html).not.toContain("No plan yet");
    expect(html).not.toContain('class="loading-state"');
  });
});
