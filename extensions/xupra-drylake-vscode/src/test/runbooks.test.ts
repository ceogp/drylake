import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handoffPhaseCommand,
  reorderPhaseCommand,
  runNextPhaseCommand,
  startBuildSessionCommand,
  toggleAutopilotCommand,
  toggleStepCommand,
  updatePhaseAgentCommand,
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
  writeClipboard: vi.fn(),
  executeCommand: vi.fn(),
  launchPhaseAgent: vi.fn(),
  writePhaseHandoffFile: vi.fn(),
}));

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
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
    withProgress: vi.fn(async (_options, task) => task()),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "C:/repo", path: "/repo" } }],
    asRelativePath: vi.fn((uri: { path?: string; fsPath?: string }) => uri.path ?? uri.fsPath ?? "drylake.xu"),
    openTextDocument: mocks.openTextDocument,
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
  getWorkspaceDisplayName: vi.fn(() => "Test Workspace"),
  scanWorkspaceFiles: vi.fn(async () => []),
}));

vi.mock("../agents/phaseAgentLauncher", () => ({
  launchPhaseAgent: mocks.launchPhaseAgent,
  writePhaseHandoffFile: mocks.writePhaseHandoffFile,
}));

beforeEach(() => {
  mocks.openExternal.mockReset();
  mocks.openTextDocument.mockReset();
  mocks.showTextDocument.mockReset();
  mocks.showInformationMessage.mockReset();
  mocks.showWarningMessage.mockReset();
  mocks.writeClipboard.mockReset();
  mocks.executeCommand.mockReset();
  mocks.launchPhaseAgent.mockReset();
  mocks.writePhaseHandoffFile.mockReset();
  mocks.showWarningMessage.mockResolvedValue("Upgrade to Pro");
  mocks.openTextDocument.mockImplementation(async (document) => document);
  mocks.writePhaseHandoffFile.mockResolvedValue({ fsPath: "C:/repo/.drylake/handoffs/P-01-cline.md", path: "/repo/.drylake/handoffs/P-01-cline.md" });
  mocks.launchPhaseAgent.mockResolvedValue({ status: "launched", message: "Started Cline for this phase." });
});

describe("runbook commands", () => {
  it("requires users to connect before starting a Build Session", async () => {
    mocks.showWarningMessage.mockResolvedValueOnce("Connect DryLake");
    const deps = {
      apiClient: {},
      stateStore: {
        getConnection: vi.fn(() => ({})),
      },
      sessionStore: {
        ensureRunbook: vi.fn(),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout");

    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "Connect your DryLake account before starting a Build Session.",
      "Connect DryLake",
    );
    expect(mocks.executeCommand).toHaveBeenCalledWith("xupra.connect");
    expect(deps.sessionStore.ensureRunbook).not.toHaveBeenCalled();
    expect(deps.controlRoom.createOrShow).not.toHaveBeenCalled();
  });

  it("prompts connected free users to upgrade when Xupra AI is selected for Build Sessions", async () => {
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
        setPlanningProvider: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: string; text: string }) => ({
          id: "msg-1",
          ts: 0,
          ...message,
        })),
        getChatHistory: vi.fn(() => ({ messages: [] })),
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
      "Xupra AI requires a Pro plan. Upgrade to unlock.",
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
      steps: [{ id: `P-0${index + 1}-step-01`, text: `step-${index + 1}`, status: "pending" as const }],
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
      stateStore: {
        getBuildSession: vi.fn(() => null),
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

    return { deps, runbook };
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

    await updatePhaseAgentCommand(deps as never, "P-01", "cline");

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.phases.find((phase) => phase.id === "P-01")?.agent).toBe("cline");
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
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

    await runNextPhaseCommand(deps as never);

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
  });

  it("toggles autopilot mode in the runbook", async () => {
    const { deps } = reorderDeps();

    await toggleAutopilotCommand(deps as never);

    const written = deps.sessionStore.writeRunbook.mock.calls[0][1];
    expect(written.handoff.autopilot).toBe(true);
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
  });

  it("autopilot launches the next selected phase after completion", async () => {
    const runbook = reorderRunbook();
    runbook.handoff.autopilot = true;
    runbook.phases[0].status = "active";
    runbook.phases[0].agent = "codex";
    runbook.phases[1].agent = "cline";
    let currentRunbook = runbook;
    const uri = { fsPath: "C:/repo/drylake.xu", path: "/repo/drylake.xu" };
    const deps = {
      apiClient: {},
      stateStore: {
        getBuildSession: vi.fn(() => null),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri, runbook: currentRunbook })),
        writeRunbook: vi.fn(async (_uri: unknown, nextRunbook: ApplicationBuildRunbook) => {
          currentRunbook = nextRunbook;
        }),
      },
      controlRoom: {
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };

    await toggleStepCommand(deps as never, "P-01", "P-01-step-01", "complete");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "cline" }));
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledTimes(2);
    expect(currentRunbook.phases[0].status).toBe("complete");
    expect(currentRunbook.phases[1].status).toBe("active");
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
    runbook.phases[0].agent = "cline";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.writeClipboard).toHaveBeenCalledWith(expect.stringContaining("You are running as Cline CLI."));
    expect(mocks.writePhaseHandoffFile).toHaveBeenCalledWith(expect.objectContaining({
      agent: "cline",
      content: expect.stringContaining("You are running as Cline CLI."),
    }));
    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({
      agent: "cline",
      prompt: expect.stringContaining("You are running as Cline CLI."),
    }));
    expect(mocks.openTextDocument).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledOnce();
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
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

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "cursor" }));
    expect(mocks.openTextDocument).toHaveBeenCalledWith({
      fsPath: "C:/repo/.drylake/handoffs/P-01-cline.md",
      path: "/repo/.drylake/handoffs/P-01-cline.md",
    });
    expect(mocks.showTextDocument).toHaveBeenCalled();
  });
});