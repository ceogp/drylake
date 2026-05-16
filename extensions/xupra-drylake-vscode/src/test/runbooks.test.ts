import { beforeEach, describe, expect, it, vi } from "vitest";

import { startBuildSessionCommand } from "../commands/runbooks";
import { createStarterXu } from "../xu/createStarterXu";

const mocks = vi.hoisted(() => ({
  billingUri: { value: "https://drylake.xupracorp.com/billing?source=extension" },
  openExternal: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}));

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  Uri: {
    parse: vi.fn(() => mocks.billingUri),
  },
  env: {
    openExternal: mocks.openExternal,
    clipboard: {
      writeText: vi.fn(),
    },
  },
  window: {
    showInformationMessage: mocks.showInformationMessage,
    showWarningMessage: mocks.showWarningMessage,
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
}));

vi.mock("../services/workspaceScanner", () => ({
  getWorkspaceDisplayName: vi.fn(() => "Test Workspace"),
  scanWorkspaceFiles: vi.fn(async () => []),
}));

beforeEach(() => {
  mocks.openExternal.mockReset();
  mocks.showInformationMessage.mockReset();
  mocks.showWarningMessage.mockReset();
  mocks.showWarningMessage.mockResolvedValue("Upgrade to Pro");
});

describe("runbook commands", () => {
  it("prompts connected free users to upgrade when Xupra Pro AI is selected for Build Sessions", async () => {
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    const runbookUri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
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
      },
      sessionStore: {
        ensureRunbook: vi.fn(async () => ({ uri: runbookUri, runbook })),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async () => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout");

    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Xupra Pro AI requires a Pro plan. Upgrade to unlock.",
      "Upgrade to Pro",
    );
    expect(deps.apiClient.openWebUrl).toHaveBeenCalledWith("/billing?source=extension");
    expect(mocks.openExternal).toHaveBeenCalledWith(mocks.billingUri);
    expect(deps.stateStore.setAwaitingPlanRefreshUntil).toHaveBeenCalledWith(expect.any(String));
    expect(mocks.showInformationMessage).not.toHaveBeenCalledWith(
      expect.stringContaining("is not available, so DryLake created a local draft runbook."),
    );
  });
});