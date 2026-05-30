import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiAgentRunnerProvider } from "../webview/multiAgentRunnerProvider";

type RunnerMessage = {
  command?: string;
  prompt?: unknown;
  agents?: unknown;
  agent?: unknown;
  status?: unknown;
  assignments?: unknown;
};

const mocks = vi.hoisted(() => ({
  launchAgentTask: vi.fn(),
  createWebviewPanel: vi.fn(),
  createDirectory: vi.fn(),
  writeFile: vi.fn(),
  openTextDocument: vi.fn(),
  showTextDocument: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  withProgress: vi.fn(),
  planRunnerAssignments: vi.fn(),
  showAgentLaunchFallbackActions: vi.fn(),
  collectHandoffProfiles: vi.fn(),
  resolveHandoffProfile: vi.fn(),
}));

let panel: { webview: { html: string; onDidReceiveMessage: ReturnType<typeof vi.fn> } } | undefined;
let messageHandler: ((message: RunnerMessage) => Promise<void>) | undefined;

vi.mock("../agents/phaseAgentLauncher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agents/phaseAgentLauncher")>()),
  launchAgentTask: mocks.launchAgentTask,
  showAgentLaunchFallbackActions: mocks.showAgentLaunchFallbackActions,
}));

vi.mock("../agents/handoffProfiles", () => ({
  collectHandoffProfiles: mocks.collectHandoffProfiles,
  handoffProfileMatchesAgent: (agent: string, profile: { sourcePlatform?: string } | undefined) => {
    if (!profile) return false;
    if (agent === "codex") return profile.sourcePlatform === "codex";
    if (agent === "claude-code") return profile.sourcePlatform === "claude";
    if (agent === "copilot") return profile.sourcePlatform === "copilot";
    return false;
  },
  handoffProfileRef: (profile: { kind: string; label: string; logicalPath: string; sourcePlatform: string }) => ({
    kind: profile.kind,
    label: profile.label,
    logicalPath: profile.logicalPath,
    sourcePlatform: profile.sourcePlatform,
  }),
  renderHandoffProfilePrompt: (profile: { content: string } | undefined) =>
    profile ? `## Requested Skill / Agent Profile\n${profile.content}\n` : "",
  resolveHandoffProfile: mocks.resolveHandoffProfile,
}));

vi.mock("vscode", () => ({
  ProgressLocation: { Notification: 15 },
  ViewColumn: { One: 1 },
  Uri: {
    joinPath: (base: { path?: string; fsPath?: string }, ...segments: string[]) => ({
      path: [base.path ?? base.fsPath ?? "", ...segments].join("/"),
      fsPath: [base.fsPath ?? base.path ?? "", ...segments].join("/"),
      toString() {
        return this.path;
      },
      with(next: { path: string }) {
        return { ...this, path: next.path, fsPath: next.path };
      },
    }),
    parse: (value: string) => ({ path: value, fsPath: value }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/repo", path: "/repo" } }],
    fs: {
      createDirectory: mocks.createDirectory,
      writeFile: mocks.writeFile,
    },
    openTextDocument: mocks.openTextDocument,
  },
  window: {
    createWebviewPanel: mocks.createWebviewPanel,
    showWarningMessage: mocks.showWarningMessage,
    showInformationMessage: mocks.showInformationMessage,
    showTextDocument: mocks.showTextDocument,
    withProgress: mocks.withProgress,
    terminals: [],
  },
}));

function context() {
  return { subscriptions: [] };
}

function apiClient() {
  return {
    planRunnerAssignments: mocks.planRunnerAssignments,
  };
}

beforeEach(() => {
  messageHandler = undefined;
  panel = undefined;
  mocks.createWebviewPanel.mockReset();
  mocks.createDirectory.mockReset();
  mocks.writeFile.mockReset();
  mocks.launchAgentTask.mockReset();
  mocks.openTextDocument.mockReset();
  mocks.showTextDocument.mockReset();
  mocks.showWarningMessage.mockReset();
  mocks.showInformationMessage.mockReset();
  mocks.withProgress.mockReset();
  mocks.planRunnerAssignments.mockReset();
  mocks.showAgentLaunchFallbackActions.mockReset();
  mocks.collectHandoffProfiles.mockReset();
  mocks.resolveHandoffProfile.mockReset();
  mocks.createWebviewPanel.mockImplementation(() => {
    panel = {
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
      webview: {
        html: "",
        onDidReceiveMessage: vi.fn((handler) => {
          messageHandler = handler;
        }),
      },
    } as never;
    return panel;
  });
  mocks.withProgress.mockImplementation(async (_options, task) => task());
  mocks.launchAgentTask.mockResolvedValue({ status: "launched", message: "Started agent.", command: "codex exec" });
  mocks.collectHandoffProfiles.mockImplementation(async (agent: string) => {
    if (agent === "codex") {
      return [
        {
          kind: "skill",
          label: "token-reduction",
          logicalPath: ".codex/skills/token-reduction/SKILL.md",
          sourcePlatform: "codex",
          content: "Use token reduction before editing files.",
        },
      ];
    }
    return [];
  });
  mocks.resolveHandoffProfile.mockImplementation(async (agent: string, profile?: { logicalPath?: string } | null) => {
    if (!profile?.logicalPath) {
      return undefined;
    }
    const profiles = await mocks.collectHandoffProfiles(agent);
    return profiles.find((candidate: { logicalPath: string }) => candidate.logicalPath === profile.logicalPath);
  });
  mocks.planRunnerAssignments.mockResolvedValue({
    modelTier: "foundation",
    assignments: [
      {
        agentId: "codex",
        subtaskSummary: "Implement checkout API routes.",
        scopeBoundary: "app/api/checkout/**",
      },
      {
        agentId: "gemini",
        subtaskSummary: "Build checkout UI states.",
        scopeBoundary: "components/checkout/**",
      },
    ],
  });
  mocks.showAgentLaunchFallbackActions.mockResolvedValue(undefined);
});

describe("Multi-Agent Runner webview", () => {
  it("renders supported agents as selectable without placeholder agents", async () => {
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("Multi-Agent Handoff");
    expect(html).toContain('value="claude-code"');
    expect(html).toContain('value="codex"');
    expect(html).toContain('value="gemini"');
    expect(html).toContain('value="hermes"');
    expect(html).toContain("Hermes Agent");
    expect(html).toContain("Phase / task prompt");
    expect(html).not.toContain("Blackbox");
    expect(html).not.toContain("Droid");
    expect(html).not.toContain("Coming soon");
  });

  it("opens from a selected phase with the phase prompt prefilled", async () => {
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.openForPrompt(context() as never, "Execute P-01 from DryLake.", ["hermes"]);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("Execute P-01 from DryLake.");
    expect(html).toContain('value="hermes" checked');
    expect(html).toContain("Phase / task prompt");
  });

  it("plans assignments before opening terminals and launches only after approval", async () => {
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex", "gemini"],
    });

    expect(mocks.planRunnerAssignments).toHaveBeenCalledWith({
      taskPrompt: "Build checkout",
      agents: [
        { agentId: "codex", label: "OpenAI Codex" },
        { agentId: "gemini", label: "Gemini CLI" },
      ],
    });
    expect(mocks.launchAgentTask).not.toHaveBeenCalled();
    expect(panel?.webview.html).toContain("Assignment Review");
    expect(panel?.webview.html).toContain("Implement checkout API routes.");
    expect(panel?.webview.html).toContain("token-reduction");
    expect(panel?.webview.html).toContain("No skill/profile");
    expect(panel?.webview.html).not.toContain("token-meter");
    expect(panel?.webview.html).toContain("Approve & Launch");
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("assignment-plan.json") }),
      expect.any(Uint8Array),
    );

    await messageHandler?.({
      command: "approve",
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API and tests.",
          handoffProfileLogicalPath: ".codex/skills/token-reduction/SKILL.md",
        },
        { agentId: "gemini", subtaskSummary: "Build checkout UI states.", handoffProfileLogicalPath: "" },
      ],
    });

    expect(mocks.launchAgentTask).toHaveBeenCalledTimes(2);
    expect(mocks.launchAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      agent: "codex",
      terminalName: "DryLake: OpenAI Codex - build-checkout",
    }));
    expect(mocks.launchAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      agent: "gemini",
      terminalName: "DryLake: Gemini CLI - build-checkout",
    }));
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/codex/prompt.md") }),
      expect.any(Uint8Array),
    );
    const codexPromptCall = mocks.writeFile.mock.calls.find(([uri]) =>
      typeof uri?.path === "string" && uri.path.endsWith("/codex/prompt.md")
    );
    const codexPrompt = new TextDecoder().decode(codexPromptCall?.[1] as Uint8Array);
    expect(codexPrompt).toContain("## Requested Skill / Agent Profile");
    expect(codexPrompt).toContain("Use token reduction before editing files.");

    const assignmentPlanCall = mocks.writeFile.mock.calls
      .filter(([uri]) => typeof uri?.path === "string" && uri.path.endsWith("assignment-plan.json"))
      .at(-1);
    const assignmentPlan = JSON.parse(new TextDecoder().decode(assignmentPlanCall?.[1] as Uint8Array)) as {
      assignments: Array<{ agentId: string; handoffProfile: null | { logicalPath: string } }>;
    };
    expect(assignmentPlan.assignments.find((assignment) => assignment.agentId === "codex")?.handoffProfile).toMatchObject({
      logicalPath: ".codex/skills/token-reduction/SKILL.md",
    });
    expect(panel?.webview.html).toContain("Run in Progress");
    expect(panel?.webview.html).toContain("Implement checkout API and tests.");
    expect(panel?.webview.html).toContain("token-reduction");
    expect(panel?.webview.html).not.toContain("token-meter");
    expect(panel?.webview.html).toContain("Mark complete");
    expect(panel?.webview.html).toContain("Mark failed");
  });

  it("plans and launches Hermes assignments when selected", async () => {
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      modelTier: "foundation",
      assignments: [
        {
          agentId: "hermes",
          subtaskSummary: "Run local model verification.",
          scopeBoundary: "src/hermes/**",
        },
      ],
    });
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Verify local agent support",
      agents: ["hermes"],
    });

    expect(mocks.planRunnerAssignments).toHaveBeenCalledWith({
      taskPrompt: "Verify local agent support",
      agents: [
        { agentId: "hermes", label: "Hermes Agent" },
      ],
    });
    expect(panel?.webview.html).toContain("Hermes Agent");
    expect(panel?.webview.html).not.toContain("token-meter");

    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "hermes", subtaskSummary: "Run local model verification." },
      ],
    });

    expect(mocks.launchAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      agent: "hermes",
      terminalName: "DryLake: Hermes Agent - verify-local-agent-support",
    }));
  });

  it("keeps running agents running until the user marks review status", async () => {
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex", "gemini"],
    });
    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "codex", subtaskSummary: "Implement checkout API routes." },
        { agentId: "gemini", subtaskSummary: "Build checkout UI states." },
      ],
    });

    await messageHandler?.({ command: "showResults" });

    expect(panel?.webview.html).toContain("Results");
    expect(panel?.webview.html).toContain('status-badge running">running');
    expect(panel?.webview.html).not.toContain('status-badge complete">complete');

    await messageHandler?.({ command: "markAgent", agent: "codex", status: "complete" });

    expect(panel?.webview.html).toContain('status-badge complete">complete');
    expect(panel?.webview.html).toContain('status-badge running">running');

    await messageHandler?.({ command: "markAgent", agent: "gemini", status: "failed" });

    expect(panel?.webview.html).toContain('status-badge failed">failed');

    const runJsonCalls = mocks.writeFile.mock.calls.filter(([uri]) =>
      typeof uri?.path === "string" && uri.path.endsWith("run.json")
    );
    const lastRun = JSON.parse(new TextDecoder().decode(runJsonCalls.at(-1)?.[1] as Uint8Array)) as {
      agents: Array<{ id: string; status: string; reviewedAt: string | null; message: string }>;
    };
    expect(lastRun.agents.find((agent) => agent.id === "codex")).toMatchObject({
      status: "complete",
      message: "Marked OpenAI Codex complete after user review.",
    });
    expect(lastRun.agents.find((agent) => agent.id === "codex")?.reviewedAt).toEqual(expect.any(String));
    expect(lastRun.agents.find((agent) => agent.id === "gemini")).toMatchObject({
      status: "failed",
      message: "Marked Gemini CLI failed after user review.",
    });
  });

  it("blocks approval when assignment scope boundaries overlap", async () => {
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      modelTier: "foundation",
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          scopeBoundary: "app/api/checkout/**",
        },
        {
          agentId: "gemini",
          subtaskSummary: "Add webhook route tests.",
          scopeBoundary: "app/api/checkout/webhooks",
        },
      ],
    });
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex", "gemini"],
    });

    expect(panel?.webview.html).toContain("Scope boundaries overlap");
    expect(panel?.webview.html).toContain("Replan before launch");

    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "codex", subtaskSummary: "Implement checkout API routes." },
        { agentId: "gemini", subtaskSummary: "Add webhook route tests." },
      ],
    });

    expect(mocks.launchAgentTask).not.toHaveBeenCalled();
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining("Scope boundaries overlap"));
  });

  it("does not treat distinct text boundaries as overlapping substrings", async () => {
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      modelTier: "foundation",
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement the first build phase.",
          scopeBoundary: "phase 1",
        },
        {
          agentId: "gemini",
          subtaskSummary: "Implement the tenth build phase.",
          scopeBoundary: "phase 10",
        },
      ],
    });
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex", "gemini"],
    });
    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "codex", subtaskSummary: "Implement the first build phase." },
        { agentId: "gemini", subtaskSummary: "Implement the tenth build phase." },
      ],
    });

    expect(mocks.launchAgentTask).toHaveBeenCalledTimes(2);
    expect(mocks.showWarningMessage).not.toHaveBeenCalledWith(expect.stringContaining("Scope boundaries overlap"));
  });

  it("warns and continues when a selected handoff profile cannot be resolved at launch time", async () => {
    mocks.planRunnerAssignments.mockResolvedValueOnce({
      modelTier: "foundation",
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          scopeBoundary: "app/api/checkout/**",
        },
      ],
    });
    mocks.resolveHandoffProfile.mockResolvedValueOnce(undefined);

    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex"],
    });
    await messageHandler?.({
      command: "approve",
      assignments: [
        {
          agentId: "codex",
          subtaskSummary: "Implement checkout API routes.",
          handoffProfileLogicalPath: ".codex/skills/token-reduction/SKILL.md",
        },
      ],
    });

    expect(mocks.launchAgentTask).toHaveBeenCalledTimes(1);
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("DryLake launched without selected skill/profile for"),
    );
    expect(panel?.webview.html).toContain("Selected skill/profile was unavailable");
  });

  it("records missing executables as failed while preserving other agents after approval", async () => {
    mocks.launchAgentTask
      .mockResolvedValueOnce({ status: "launched", message: "Started Codex.", command: "codex exec" })
      .mockResolvedValueOnce({ status: "not-installed", message: "Gemini CLI is not installed." });
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "run",
      prompt: "Build checkout",
      agents: ["codex", "gemini"],
    });
    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "codex", subtaskSummary: "Implement checkout API routes." },
        { agentId: "gemini", subtaskSummary: "Build checkout UI states." },
      ],
    });

    expect(panel?.webview.html).toContain("running");
    expect(panel?.webview.html).toContain("failed");
    expect(panel?.webview.html).toContain("Gemini CLI is not installed.");
    expect(mocks.showAgentLaunchFallbackActions).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({
        agentLabel: "Gemini CLI",
        reason: "Gemini CLI is not installed.",
      }),
    }));
  });
});
