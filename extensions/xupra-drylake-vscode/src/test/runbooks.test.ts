import { beforeEach, describe, expect, it, vi } from "vitest";

import { reorderPhaseCommand, startBuildSessionCommand } from "../commands/runbooks";
import { createStarterXu } from "../xu/createStarterXu";
import type { ApplicationBuildRunbook } from "../xu/types";

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

  function reorderRunbook(): ApplicationBuildRunbook {
    const value = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    value.phases = value.phases.slice(0, 3).map((phase, index) => ({
      ...phase,
      id: `P-0${index + 1}`,
      title: `Phase ${index + 1}`,
      steps: [`step-${index + 1}`],
      agent: index === 1 ? "codex" : phase.agent,
      status: index === 2 ? "complete" : phase.status,
    }));
    return value;
  }

  function reorderDeps(runbook = reorderRunbook()) {
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const writeRunbook = vi.fn(async (_uri: unknown, _runbook: ApplicationBuildRunbook) => undefined);
    const deps = {
      apiClient: {},
      stateStore: {},
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook })),
        writeRunbook,
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    return { deps, runbook };
  }

  it("moves a phase to the front when afterPhaseId is null", async () => {
    const { deps } = reorderDeps();

    await reorderPhaseCommand(deps as never, "P-02", null);

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.map((phase) => phase.id)).toEqual(["P-02", "P-01", "P-03"]);
    expect(written.phases[0].agent).toBe("codex");
    expect(written.phases[0].steps).toEqual(["step-2"]);
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
});