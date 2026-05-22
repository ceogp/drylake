import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStarterXu } from "../xu/createStarterXu";
import { ControlRoomProvider } from "../webview/controlRoomProvider";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ApplicationBuildRunbook } from "../xu/types";

type TestMessage = {
  command?: string;
  args?: unknown[];
  copy?: string;
  view?: unknown;
  phaseId?: unknown;
  afterPhaseId?: unknown;
  agent?: unknown;
  handoffAction?: unknown;
  status?: unknown;
};

let messageHandler: ((message: TestMessage) => Promise<void>) | undefined;
let panel: { webview: { html: string; onDidReceiveMessage: ReturnType<typeof vi.fn> } } | undefined;
let storedView: unknown;
const executed: Array<{ command: string; args: unknown[] }> = [];

vi.mock("vscode", () => ({
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: vi.fn(() => {
      panel = {
        reveal: vi.fn(),
        onDidDispose: vi.fn(),
        webview: {
          html: "",
          onDidReceiveMessage: vi.fn((handler) => {
            messageHandler = handler;
          }),
        },
      } as never;

      return panel;
    }),
    showInformationMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(async (command: string, ...args: unknown[]) => {
      executed.push({ command, args });
    }),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
}));

function context() {
  return {
    subscriptions: [],
    workspaceState: {
      get: vi.fn(() => storedView),
      update: vi.fn(async (_key: string, value: unknown) => {
        storedView = value;
      }),
    },
  };
}

function runbook(): ApplicationBuildRunbook {
  const value = createStarterXu({ prompt: "Build kanban", mode: "build-app" });
  value.handoff.defaultAgent = "copilot";
  value.phases = [
    { ...value.phases[0], id: "todo", title: "Todo phase", status: "pending", agent: "codex" },
    { ...value.phases[1], id: "active", title: "Active phase", status: "active" },
    { ...value.phases[2], id: "approved", title: "Approved phase", status: "approved" },
    { ...value.phases[3], id: "done", title: "Done phase", status: "complete" },
  ];
  return value;
}

function autopilotRunbook(): ApplicationBuildRunbook {
  const value = runbook();
  value.handoff.autopilot = true;
  return value;
}

beforeEach(() => {
  executed.length = 0;
  messageHandler = undefined;
  panel = undefined;
  storedView = undefined;
});

describe("Control Room webview", () => {
  it("routes purpose approval messages to the command handler", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.approvePurpose" });

    expect(executed).toContainEqual({ command: "drylake.approvePurpose", args: [] });
  });

  it("routes architecture approval messages to the command handler", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.approveArchitecture" });

    expect(executed).toContainEqual({ command: "drylake.approveArchitecture", args: [] });
  });

  it("renders kanban columns with phases distributed by status", async () => {
    storedView = "kanban";
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain('class="kanban"');
    expect(html).toContain('data-drop-status="pending"');
    expect(html).toContain('data-drop-status="active"');
    expect(html).toContain('data-drop-status="complete"');
    expect(html).toContain('data-phase-id="todo" data-phase-status="pending" draggable="true"');
    expect(html).toContain('data-phase-id="active" data-phase-status="active" draggable="true"');
    expect(html).toContain('data-phase-id="approved" data-phase-status="complete" draggable="true"');
    expect(html).toContain('data-phase-id="done" data-phase-status="complete" draggable="true"');
    expect(html).toContain("Approved phase");
    expect(html).toContain("Drop phase here");
  });

  it("renders draggable pipeline cards with reorder handlers", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain('class="pipeline"');
    expect(html).toContain('data-phase-id="todo" data-phase-status="pending" draggable="true"');
    expect(html).toContain('command: "drylake.reorderPhase"');
    expect(html).toContain("drop-before");
    expect(html).toContain("drop-after");
    expect(html).toContain("Run with Codex");
    expect(html).toContain("Codex .sh");
    expect(html).toContain("Codex .bat");
    expect(html).toContain("Export as Markdown");
    expect(html).toContain("VS Code");
    expect(html).toContain("Select phase agent");
    expect(html).toContain("Select agent");
    expect(html).toContain("Require Approval Between Phases");
  });

  it("renders agent handoff capability status from the launcher registry", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("Agent Handoff");
    expect(html).toContain("Direct CLI + scripts");
    expect(html).toContain("Direct VS Code");
    expect(html).not.toContain("Prompt-ready");
    expect(html).not.toContain("Prompt fallback");
    expect(html).toContain("Choose direct run, .sh/.bat, Copy, Markdown, or VS Code per phase.");
  });

  it("renders autopilot toggle state for pipeline and kanban", async () => {
    storedView = "pipeline";
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: autopilotRunbook() }) } as never);
    await provider.createOrShow(context() as never);

    expect(panel?.webview.html).toContain("Autopilot mode");
    expect(panel?.webview.html).toContain('aria-pressed="true"');

    storedView = "kanban";
    await provider.refresh();

    expect(panel?.webview.html).toContain('class="kanban"');
    expect(panel?.webview.html).toContain("Autopilot mode");
  });

  it("routes execution mode toggle messages to the command handler", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.toggleAutopilot" });

    expect(executed).toContainEqual({ command: "drylake.toggleAutopilot", args: [] });
  });

  it("routes kanban drop messages to phase status updates", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.updatePhaseStatus", phaseId: "todo", status: "active" });

    expect(executed).toContainEqual({ command: "drylake.updatePhaseStatus", args: ["todo", "active"] });
  });

  it("routes phase reorder messages to phase reorder command", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.reorderPhase", phaseId: "active", afterPhaseId: "todo" });

    expect(executed).toContainEqual({ command: "drylake.reorderPhase", args: ["active", "todo"] });
  });

  it("routes kanban agent dropdown messages to phase agent updates", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.updatePhaseAgent", phaseId: "active", agent: "aider" });

    expect(executed).toContainEqual({ command: "drylake.updatePhaseAgent", args: ["active", "aider"] });
  });

  it("routes handoff action messages to phase handoff commands", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.handoffPhase", phaseId: "active", handoffAction: "script-sh" });

    expect(executed).toContainEqual({ command: "drylake.handoffPhase", args: ["active", "script-sh"] });
  });

  it("renders every native phase agent in the dropdown", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    for (const agent of XU_PHASE_AGENTS) {
      expect(html).toContain(`option value="${agent}"`);
    }

    expect(html).toContain("Gemini CLI");
    expect(html).toContain("Continue.dev");
    expect(html).toContain("Aider");
    expect(html).toContain("Augment Code");
    expect(html).not.toContain("Cline");
    expect(html).not.toContain("Windsurf");
    expect(html).not.toContain("Roo Code");
    expect(html).not.toContain("External AI Prompt");
    expect(html).toContain("Agent for Todo phase");
  });

  it("persists kanban view selection across refreshes", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.setControlRoomView", view: "kanban" });

    expect(storedView).toBe("kanban");
    expect(panel?.webview.html).toContain('class="kanban"');
  });
});

