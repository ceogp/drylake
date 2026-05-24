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
}));

let panel: { webview: { html: string; onDidReceiveMessage: ReturnType<typeof vi.fn> } } | undefined;
let messageHandler: ((message: RunnerMessage) => Promise<void>) | undefined;

vi.mock("../agents/phaseAgentLauncher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agents/phaseAgentLauncher")>()),
  launchAgentTask: mocks.launchAgentTask,
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
});

describe("Multi-Agent Runner webview", () => {
  it("renders verified agents as selectable and unverified agents as coming soon", async () => {
    const provider = new MultiAgentRunnerProvider(apiClient() as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("Multi-Agent Runner");
    expect(html).toContain('value="claude-code"');
    expect(html).toContain('value="codex"');
    expect(html).toContain('value="gemini"');
    expect(html).toContain("Blackbox");
    expect(html).toContain("Droid");
    expect(html).toContain("Coming soon");
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
    expect(panel?.webview.html).toContain("Approve & Launch");
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("assignment-plan.json") }),
      expect.any(Uint8Array),
    );

    await messageHandler?.({
      command: "approve",
      assignments: [
        { agentId: "codex", subtaskSummary: "Implement checkout API and tests." },
        { agentId: "gemini", subtaskSummary: "Build checkout UI states." },
      ],
    });

    expect(mocks.launchAgentTask).toHaveBeenCalledTimes(2);
    expect(mocks.launchAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      agent: "codex",
      terminalName: "DryLake: OpenAI Codex — build-checkout",
    }));
    expect(mocks.launchAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      agent: "gemini",
      terminalName: "DryLake: Gemini CLI — build-checkout",
    }));
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/codex/prompt.md") }),
      expect.any(Uint8Array),
    );
    expect(panel?.webview.html).toContain("Run in Progress");
    expect(panel?.webview.html).toContain("Implement checkout API and tests.");
    expect(panel?.webview.html).toContain("Mark complete");
    expect(panel?.webview.html).toContain("Mark failed");
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
  });
});
