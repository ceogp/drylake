import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approvePlanChangeCommand,
  chatSendMessageCommand,
  handoffPhaseCommand,
  newSessionCommand,
  rejectPlanChangeCommand,
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
  writePhaseHandoffScript: vi.fn(),
  resolveDryLakeAiProvider: vi.fn(),
  providerIsAvailable: vi.fn(),
  providerGenerateDraftRunbook: vi.fn(),
  providerPlanningChat: vi.fn(),
  providerRefinePurpose: vi.fn(),
  providerRefineArchitecture: vi.fn(),
  providerGeneratePhasePlan: vi.fn(),
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

vi.mock("../ai/providerResolver", () => ({
  resolveDryLakeAiProvider: mocks.resolveDryLakeAiProvider,
}));

vi.mock("../agents/phaseAgentLauncher", () => ({
  launchPhaseAgent: mocks.launchPhaseAgent,
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
  mocks.writeClipboard.mockReset();
  mocks.executeCommand.mockReset();
  mocks.launchPhaseAgent.mockReset();
  mocks.writePhaseHandoffFile.mockReset();
  mocks.writePhaseHandoffScript.mockReset();
  mocks.resolveDryLakeAiProvider.mockReset();
  mocks.providerIsAvailable.mockReset();
  mocks.providerGenerateDraftRunbook.mockReset();
  mocks.providerPlanningChat.mockReset();
  mocks.providerRefinePurpose.mockReset();
  mocks.providerRefineArchitecture.mockReset();
  mocks.providerGeneratePhasePlan.mockReset();
  mocks.showWarningMessage.mockResolvedValue("Upgrade to Pro");
  mocks.openTextDocument.mockImplementation(async (document) => document);
  mocks.writePhaseHandoffFile.mockResolvedValue({ fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md", path: "/repo/.drylake/handoffs/P-01-codex.md" });
  mocks.writePhaseHandoffScript.mockResolvedValue({ fsPath: "C:/repo/.drylake/handoffs/P-01-codex.sh", path: "/repo/.drylake/handoffs/P-01-codex.sh" });
  mocks.launchPhaseAgent.mockResolvedValue({ status: "launched", message: "Started OpenAI Codex for this phase." });
  mocks.providerIsAvailable.mockResolvedValue({ available: false, reason: "Xupra AI requires a Pro plan." });
  mocks.providerGenerateDraftRunbook.mockResolvedValue({ message: "Failed to generate DryLake runbook draft (500)." });
  mocks.providerPlanningChat.mockResolvedValue({ error: "Failed to run DryLake Planning Chat (500)." });
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

  it("allows connected free users to start AI planning through the nano backend route", async () => {
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
        clearChatHistory: vi.fn(async () => undefined),
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
        writeRunbook: vi.fn(async (_uri: unknown, _runbook: ApplicationBuildRunbook) => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({ runbook: generatedRunbook, modelTier: "nano" });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout");

    expect(mocks.showWarningMessage).not.toHaveBeenCalledWith(
      "Xupra AI requires a Pro plan. Upgrade to unlock.",
      "Upgrade to Pro",
    );
    expect(mocks.openExternal).not.toHaveBeenCalled();
    expect(deps.sessionStore.ensureRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.findRunbookUri).toHaveBeenCalledOnce();
    expect(deps.sessionStore.getDefaultRunbookUri).toHaveBeenCalledOnce();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledOnce();
    expect(deps.sessionStore.writeRunbook).toHaveBeenCalledWith(runbookUri, generatedRunbook);
    expect(deps.stateStore.setLastModelTier).toHaveBeenCalledWith("nano");
    expect(deps.stateStore.setPlanningLoading).toHaveBeenNthCalledWith(1, true);
    expect(deps.stateStore.setPlanningLoading).toHaveBeenLastCalledWith(false);
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Build checkout",
    }));
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.not.objectContaining({
      currentRunbook: expect.anything(),
    }));
  });

  it("leaves first-message no-plan failures in chat without creating a local prompt-derived draft", async () => {
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
        setPlanningProvider: vi.fn(async () => undefined),
        setLastModelTier: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
        clearChatHistory: vi.fn(async () => undefined),
        appendChatMessage: vi.fn(async (message: { role: "user" | "ai" | "system"; text: string }) => {
          const next = { id: `msg-${messages.length + 1}`, ts: messages.length + 1, ...message };
          messages.push(next);
          return next;
        }),
        getChatHistory: vi.fn(() => ({ messages })),
      },
      sessionStore: {
        ensureRunbook: vi.fn(),
        findRunbookUri: vi.fn(async () => null),
        getDefaultRunbookUri: vi.fn(() => runbookUri),
        createSession: vi.fn(async (session) => ({ id: "session-1", createdAt: "2026-05-16T00:00:00.000Z", ...session })),
        writeRunbook: vi.fn(async (_uri: unknown, _runbook: ApplicationBuildRunbook) => undefined),
      },
      controlRoom: {
        createOrShow: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
      },
      refreshSidebar: vi.fn(async () => undefined),
    };
    mocks.providerIsAvailable.mockResolvedValueOnce({ available: true });
    mocks.providerGenerateDraftRunbook.mockResolvedValueOnce({
      message: "Xupra AI is not configured: OPENAI_MODEL is missing. (500).",
    });

    await startBuildSessionCommand(deps as never, { subscriptions: [] } as never, "build-app", "Build checkout");

    expect(deps.sessionStore.ensureRunbook).not.toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expect(mocks.providerGenerateDraftRunbook).toHaveBeenCalledWith(expect.not.objectContaining({
      currentRunbook: expect.anything(),
    }));
    expect(messages.at(-1)).toEqual(expect.objectContaining({
      role: "system",
      text: "Xupra AI could not generate a plan: Xupra AI is not configured: OPENAI_MODEL is missing. (500).",
    }));
    expect(messages.at(-1)?.text).not.toContain("local starter plan");
    expect(messages.at(-1)?.text).not.toContain("local draft");
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
        writeRunbook: vi.fn(async (_uri: unknown, _runbook: ApplicationBuildRunbook) => undefined),
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
    const writeRunbook = vi.fn(async (_uri: unknown, _runbook: ApplicationBuildRunbook) => undefined);
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
        clearChatHistory: vi.fn(async () => undefined),
        setPlanningLoading: vi.fn(async () => undefined),
      },
      sessionStore: {
        readRunbook: vi.fn(async () => ({ uri: { path: "/repo/drylake.xu" }, runbook })),
        archiveCurrentRunbook: vi.fn(async () => ({ id: "archive-1", uri: { path: "/repo/.drylake/sessions/archive-1/drylake.xu" }, runbook })),
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
    expect(deps.stateStore.clearChatHistory).toHaveBeenCalledOnce();
    expect(deps.stateStore.setPlanningLoading).toHaveBeenCalledWith(false);
    expect(deps.sessionStore.clearPendingPlanChanges).toHaveBeenCalledOnce();
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
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
    const writeRunbook = vi.fn(async (...args: [unknown, ApplicationBuildRunbook]) => {
      void args;
    });
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

  function expectNoPhaseStatusUpdateCommand() {
    expect(mocks.executeCommand).not.toHaveBeenCalledWith("drylake.updatePhaseStatus", expect.anything(), expect.anything());
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

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "gemini" }));
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
    runbook.phases[0].agent = "gemini";
    const { deps } = reorderDeps(runbook);

    await handoffPhaseCommand(deps as never, "P-01");

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
    expect(deps.sessionStore.writeRunbook.mock.calls[0][1].phases.find((phase) => phase.id === "P-01")?.status).toBe("active");
    expect(deps.controlRoom.refresh).toHaveBeenCalledOnce();
    expect(deps.refreshSidebar).toHaveBeenCalledOnce();
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
      const { deps } = reorderDeps(runbook);

      await handoffPhaseCommand(deps as never, "P-01", action);

      expect(mocks.launchPhaseAgent).not.toHaveBeenCalled();
      expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
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

    await handoffPhaseCommand(deps as never, "P-01", "unsupported-action");

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

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "cursor" }));
    expect(mocks.openTextDocument).toHaveBeenCalledWith({
      fsPath: "C:/repo/.drylake/handoffs/P-01-codex.md",
      path: "/repo/.drylake/handoffs/P-01-codex.md",
    });
    expect(mocks.showTextDocument).toHaveBeenCalled();
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("does not mark a phase active when the selected agent executable is missing", async () => {
    const runbook = reorderRunbook();
    runbook.phases[0].agent = "codex";
    const { deps } = reorderDeps(runbook);
    mocks.launchPhaseAgent.mockResolvedValueOnce({
      status: "not-installed",
      message: "OpenAI Codex is not installed.",
    });

    await handoffPhaseCommand(deps as never, "P-01");

    expect(mocks.launchPhaseAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
    expect(deps.sessionStore.writeRunbook).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });
});
