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
  text?: unknown;
  mode?: unknown;
  planningProvider?: unknown;
  stageCount?: unknown;
};

let messageHandler: ((message: TestMessage) => Promise<void>) | undefined;
let panel:
  | {
      dispose: ReturnType<typeof vi.fn>;
      reveal: ReturnType<typeof vi.fn>;
      onDidDispose: ReturnType<typeof vi.fn>;
      webview: { html: string; onDidReceiveMessage: ReturnType<typeof vi.fn> };
    }
  | undefined;
let storedView: unknown;
let storedChatCollapsed: unknown;
const executed: Array<{ command: string; args: unknown[] }> = [];

vi.mock("vscode", () => ({
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: vi.fn(() => {
      panel = {
        dispose: vi.fn(),
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
      get: vi.fn((key: string) => {
        if (key === "drylake.controlRoomChatCollapsed") {
          return storedChatCollapsed;
        }
        return storedView;
      }),
      update: vi.fn(async (key: string, value: unknown) => {
        if (key === "drylake.controlRoomChatCollapsed") {
          storedChatCollapsed = value;
          return;
        }
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
  storedChatCollapsed = undefined;
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

  it("disposes the open panel for complete sign-out", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow(context() as never);
    const dispose = panel?.dispose;

    provider.dispose();

    expect(dispose).toHaveBeenCalledOnce();
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
    expect(html).toContain('data-phase-id="todo" data-phase-status="pending"');
    expect(html).toContain('data-phase-id="active" data-phase-status="active"');
    expect(html).toContain('data-phase-id="approved" data-phase-status="complete"');
    expect(html).toContain('data-phase-id="done" data-phase-status="complete"');
    expect(html).toContain('data-drag-phase="todo"');
    expect(html).toContain("Approved phase");
    expect(html).toContain("Drop phase here");
  });

  it("renders draggable pipeline cards with reorder handlers", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain('class="pipeline"');
    expect(html).toContain('data-phase-id="todo" data-phase-status="pending"');
    expect(html).toContain('class="drag-handle" draggable="true" data-drag-phase="todo"');
    expect(html).toContain('command: "drylake.reorderPhase"');
    expect(html).toContain("drop-before");
    expect(html).toContain("drop-after");
    expect(html).toContain("Run Handoff");
    expect(html).toContain("<summary>Export</summary>");
    expect(html).toContain('data-handoff-action="script-sh"');
    expect(html).toContain('data-handoff-action="script-bat"');
    expect(html).toContain('data-handoff-action="markdown"');
    expect(html).toContain("Copy prompt");
    expect(html).toContain("Open Markdown");
    expect(html).toContain("Multi-Agent");
    expect(html).toContain('data-multi-agent-phase="todo"');
    expect(html).not.toContain("handoff-secondary");
    expect(html).not.toContain("handoff-action-btn");
    expect(html).not.toContain("Run with Codex");
    expect(html).toContain("Select phase agent");
    expect(html).toContain('data-handoff-action="run"');
    expect(html).not.toContain("handoff-action-select");
    expect(html).toContain("Require Approval Between Phases");
    expect(html).toContain("Build Plan Chat");
    expect(html).toContain('aria-label="Planning model"');
    expect(html).toContain("Ask DryLake to update these cards...");
  });

  it("renders generated task-specific card previews", async () => {
    const currentRunbook = runbook();
    currentRunbook.phases[0] = {
      ...currentRunbook.phases[0],
      objective: "Wire Clerk sign-in to a marketplace onboarding flow.",
      steps: [
        {
          id: "todo-step-1",
          text: "Add Clerk session checks before marketplace card generation.",
          status: "pending",
        },
      ],
      acceptance: ["Marketplace cards show onboarding status from the authenticated account."],
    };
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: currentRunbook }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("Generated for this task");
    expect(html).toContain("Add Clerk session checks before marketplace card generation.");
    expect(html).toContain("Marketplace cards show onboarding status from the authenticated account.");
  });

  it("does not render a second agent-selection summary panel", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).not.toContain("Agent Handoff");
    expect(html).not.toContain("Direct CLI + scripts");
    expect(html).not.toContain("Direct VS Code");
    expect(html).not.toContain("Choose direct run, .sh/.bat, Copy, Markdown, or VS Code per phase.");
  });

  it("renders one agent selector per phase and keeps exports in a secondary menu", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";
    const agentSelectorCount = html.match(/class="agent-select"/g)?.length ?? 0;
    const phaseCardCount = html.match(/class="phase-card /g)?.length ?? 0;

    expect(agentSelectorCount).toBe(phaseCardCount);
    expect(html).toContain('class="handoff-menu"');
    expect(html).toContain('data-handoff-action="run"');
    expect(html).not.toContain("handoff-action-select");
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

    await messageHandler?.({ command: "drylake.updatePhaseAgent", phaseId: "active", agent: "gemini" });

    expect(executed).toContainEqual({ command: "drylake.updatePhaseAgent", args: ["active", "gemini"] });
  });

  it("routes handoff action messages to phase handoff commands", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.handoffPhase", phaseId: "active", handoffAction: "script-sh" });

    expect(executed).toContainEqual({ command: "drylake.handoffPhase", args: ["active", "script-sh"] });
  });

  it("routes selected phases to the multi-agent handoff command", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.openMultiAgentForPhase", phaseId: "active" });

    expect(executed).toContainEqual({ command: "drylake.openMultiAgentForPhase", args: ["active"] });
  });

  it("renders pending plan-change overlays and routes approval actions", async () => {
    const currentRunbook = runbook();
    const proposedRunbook: ApplicationBuildRunbook = {
      ...currentRunbook,
      phases: currentRunbook.phases.map((phase) =>
        phase.id === "active" ? { ...phase, objective: "Updated objective" } : phase,
      ),
    };
    const provider = new ControlRoomProvider({
      readRunbook: async () => ({ runbook: currentRunbook }),
      readPendingPlanChange: async () => ({
        id: "plan-change-1",
        sourceChatMessageId: "msg-1",
        createdAt: "2026-05-23T00:00:00.000Z",
        baseRunbookPath: "drylake.xu",
        proposedRunbook,
        affectedPhaseIds: ["active"],
        phaseSummaries: { active: "Objective changes" },
        phaseResolutions: {},
        status: "pending",
      }),
    } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";
    expect(html).toContain("Proposed change");
    expect(html).toContain("Objective changes");
    expect(html).toContain("Apply");
    expect(html).toContain("Keep current");

    await messageHandler?.({ command: "drylake.approvePlanChange", phaseId: "active" });
    await messageHandler?.({ command: "drylake.rejectPlanChange", phaseId: "active" });

    expect(executed).toContainEqual({ command: "drylake.approvePlanChange", args: ["active"] });
    expect(executed).toContainEqual({ command: "drylake.rejectPlanChange", args: ["active"] });
  });

  it("renders every native phase agent in the dropdown", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    for (const agent of XU_PHASE_AGENTS) {
      expect(html).toContain(`option value="${agent}"`);
    }

    expect(html).toContain("Gemini CLI");
    expect(html).toContain("Hermes Agent");
    expect(html).not.toContain("token-meter");
    expect(html).not.toContain("Blackbox");
    expect(html).not.toContain("Droid");
    expect(html).not.toContain("Continue.dev");
    expect(html).not.toContain("Aider");
    expect(html).not.toContain("Augment Code");
    expect(html).not.toContain("Cline");
    expect(html).not.toContain("Windsurf");
    expect(html).not.toContain("Roo Code");
    expect(html).not.toContain("External AI Prompt");
    expect(html).toContain("Agent for Todo phase");
  });

  it("hides phase execution controls when the runbook has no phases", async () => {
    const emptyRunbook = runbook();
    emptyRunbook.phases = [];
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: emptyRunbook }) } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).not.toContain("Run Next Phase");
    expect(html).not.toContain("Require Approval Between Phases");
    expect(html).not.toContain("Autopilot mode");
  });

  it("persists kanban view selection across refreshes", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.setControlRoomView", view: "kanban" });

    expect(storedView).toBe("kanban");
    expect(panel?.webview.html).toContain('class="kanban"');
  });

  it("routes first chat messages to build-session generation with the selected mode", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({
      command: "drylake.startBuildSession",
      mode: "phases",
      text: "Break this task into steps.",
    });

    expect(executed).toContainEqual({
      command: "drylake.startBuildSession",
      args: ["phases", "Break this task into steps.", "xupra-pro-ai"],
    });
  });

  it("renders the planning provider dropdown and routes the selected provider with first chat message", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => null } as never);
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";
    expect(html).toContain('id="planningProviderSelect"');
    expect(html.indexOf('id="planningProviderSelect"')).toBeLessThan(html.indexOf("Build Plan Chat"));
    expect(html.indexOf("Build Plan Chat")).toBeLessThan(html.indexOf('id="chatInput"'));
    expect(html).toContain('<select id="planningProviderSelect"');
    expect(html).toContain('option value="xupra-nano"');
    expect(html).toContain('option value="xupra-foundation"');
    expect(html).toContain("Pro users only");
    expect(html).toContain('option value="databricks-api"');
    expect(html).toContain('option value="claude-api"');
    expect(html).toContain('option value="openai-api"');
    expect(html).toContain('option value="hermes-agent"');
    expect(html).toContain('id="stageCountSelect"');
    expect(html).toContain('<option value="12">12</option>');

    await messageHandler?.({
      command: "drylake.startBuildSession",
      mode: "build-app",
      text: "Build the API.",
      planningProvider: "openai-api",
      stageCount: 3,
    });

    expect(executed).toContainEqual({
      command: "drylake.startBuildSession",
      args: ["build-app", "Build the API.", "openai-api", 3],
    });
  });

  it("renders card generation context meter from planning chat", async () => {
    const provider = new ControlRoomProvider(
      { readRunbook: async () => null } as never,
      () => ({ id: "xupra-pro-ai", label: "Xupra AI" }),
      () => ({
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: [
              "Build a Clerk authenticated marketplace dashboard for buyers, vendors, and admins.",
              "Use database tables for listings, orders, conversations, and payouts.",
              "Add API endpoints for onboarding, search, checkout, webhooks, and admin review.",
              "Success means each role sees the right cards, incomplete onboarding is blocked, and acceptance criteria can be verified in tests.",
            ].join(" "),
            ts: 1,
          },
          {
            id: "msg-2",
            role: "user",
            text: "Also include repository-aware tests, clear constraints for free users, and a done state for generated marketplace cards.",
            ts: 2,
          },
        ],
      }),
    );
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain('role="meter"');
    expect(html).toContain("context for Card Generation");
    expect(html).toContain("Enough to draft cards");
    expect(html).toContain("DryLake has enough context to generate task-specific cards.");
  });

  it("marks card generation context complete after cards exist", async () => {
    const provider = new ControlRoomProvider(
      { readRunbook: async () => ({ runbook: runbook() }) } as never,
      () => ({ id: "xupra-pro-ai", label: "Xupra AI" }),
      () => ({ messages: [] }),
    );
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("100% context for Card Generation");
    expect(html).toContain("Cards generated");
  });

  it("renders nano planning banner for free users without locking chat", async () => {
    const provider = new ControlRoomProvider(
      { readRunbook: async () => null } as never,
      () => ({ id: "xupra-pro-ai", label: "Xupra AI" }),
      () => ({ messages: [] }),
      () => "nano",
    );
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain("GPT-5.4 Nano");
    expect(html).toContain("Xupra AI - Frontier Models");
    expect(html).toContain("Free User - GPT-5.4 Nano");
    expect(html).toContain("Free users use GPT-5.4 Nano. Choose up to 12 stages");
    expect(html).toContain("Pro users only");
    expect(html).not.toMatch(/GPT\s+5\.5/);
    expect(html).not.toMatch(/Claude\s+Opus/);
    expect(html).toContain("xupra.openBilling");
    expect(html).toContain('id="chatInput"');
    expect(html).not.toContain("chat-locked");
    expect(html).not.toContain("Xupra AI Planning Chat is a Pro feature");
  });

  it("hides the nano planning banner for entitled foundation users", async () => {
    const provider = new ControlRoomProvider(
      { readRunbook: async () => null } as never,
      () => ({ id: "xupra-pro-ai", label: "Xupra AI" }),
      () => ({ messages: [] }),
      () => "foundation",
      () => false,
      () => ({
        organizationTier: "pro",
        entitlements: {
          xupra_pro_ai: true,
          session_cloud_sync: false,
          pr_summary_generation: false,
        },
      }),
    );
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).not.toContain('class="nano-banner"');
    expect(html).not.toContain("We are using <strong>GPT-5.4 Nano</strong>");
    expect(html).not.toContain("Free planning model");
    expect(html).toContain("Xupra AI - Frontier Models");
  });

  it("renders an inline planning skeleton while plan generation is in progress", async () => {
    const provider = new ControlRoomProvider(
      { readRunbook: async () => null } as never,
      () => null,
      () => ({ messages: [] }),
      () => null,
      () => true,
    );
    await provider.createOrShow(context() as never);

    const html = panel?.webview.html ?? "";

    expect(html).toContain('class="loading-state"');
    expect(html).toContain("DryLake is generating your plan");
    expect(html).not.toContain("No plan yet");
  });

  it("collapses and expands the chat panel", async () => {
    const provider = new ControlRoomProvider({ readRunbook: async () => ({ runbook: runbook() }) } as never);
    await provider.createOrShow(context() as never);

    await messageHandler?.({ command: "drylake.toggleChatCollapsed" });

    expect(storedChatCollapsed).toBe(true);
    expect(panel?.webview.html).toContain('class="chat-panel collapsed"');
    expect(panel?.webview.html).not.toContain('id="chatInput"');
  });
});

