import { describe, expect, it, vi } from "vitest";

import { HelpTreeProvider } from "../views/helpTreeProvider";
import { WorkspaceSidebarProvider } from "../views/workspaceSidebarProvider";
import { StateStore } from "../services/stateStore";
import { createStarterXu } from "../xu/createStarterXu";
import type { SidebarState } from "../views/workspaceSidebarProvider";

vi.mock("vscode", () => {
  class TreeItem {
    description?: string;
    command?: { command: string; title: string; arguments: unknown[] };
    contextValue?: string;

    constructor(public label: string, public collapsibleState: number) {}
  }

  return {
    TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
    },
    Uri: {
      file: (value: string) => ({ fsPath: value, path: value }),
      joinPath: (base: { path?: string; fsPath?: string }, ...segments: string[]) => ({
        path: [base.path ?? base.fsPath ?? "", ...segments].join("/"),
        fsPath: [base.fsPath ?? base.path ?? "", ...segments].join("/"),
      }),
      from: (value: { scheme: string; authority?: string; path: string }) => value,
    },
    workspace: {
      workspaceFolders: [],
      fs: { stat: vi.fn() },
    },
    commands: {
      executeCommand: vi.fn(),
    },
    window: {
      showWarningMessage: vi.fn(),
      showTextDocument: vi.fn(),
    },
  };
});

function sidebarHtml() {
  const provider = new WorkspaceSidebarProvider({} as never, {} as never);
  return (provider as unknown as { _getHtml: () => string })._getHtml();
}

function buildSessionState(overrides: Partial<SidebarState> = {}): SidebarState {
  return {
    connected: true,
    userEmail: "builder@example.com",
    orgName: "Xupra",
    orgTier: "free",
    detectedFiles: [],
    importedWorkspace: null,
    selection: {},
    runbook: {
      sessionName: "checkout-flow",
      path: "drylake.xu",
      status: "in-progress",
      activePhaseId: "03-implementation",
      activePhaseTitle: "Implement checkout",
      activePhaseAgent: "copilot",
      providerStatus: "User IDE AI",
    },
    isLoading: false,
    ...overrides,
  };
}

describe("sidebar reshape", () => {
  it("renders Build Session before account chrome", () => {
    const html = sidebarHtml();
    const renderConnected = html.slice(html.indexOf("function renderConnected"), html.indexOf("function renderDisconnected"));

    expect(renderConnected.indexOf("renderBuildSession(state)")).toBeGreaterThan(-1);
    expect(renderConnected.indexOf("account-bar")).toBeGreaterThan(-1);
    expect(renderConnected.indexOf("renderBuildSession(state)")).toBeLessThan(renderConnected.indexOf("account-bar"));
  });

  it("keeps detected files and advanced tools collapsed by default", () => {
    const html = sidebarHtml();

    expect(html).toContain('<details class="disclosure"><summary><span>Detected Agent Files</span>');
    expect(html).toContain('<details class="disclosure"><summary><span>Advanced</span>');
    expect(html).not.toContain('<details class="disclosure" open');
  });

  it("shows Build Session controls and demotes legacy actions into Advanced", () => {
    const html = sidebarHtml();

    expect(html).toContain("No active Build Session");
    expect(html).toContain('data-action="startBuildSession"');
    expect(html).toContain('data-action="openControlRoom"');
    expect(html).not.toContain('data-action="exportHandoffPrompt"');
    expect(html).not.toContain("Run Next Phase");
    expect(html).toContain('<details class="disclosure"><summary><span>Advanced</span>');
    expect(html).toContain('data-action="importWorkspace"');
    expect(html).toContain('data-action="installToRuntime"');
    expect(html).toContain('data-action="checkCompatibility"');
    expect(html).toContain('data-action="exportPreview"');
    expect(html).toContain('data-action="pullPackage"');
  });

  it("builds sidebar state with a session fallback", () => {
    const workspaceState = {
      get: vi.fn((key: string, fallback: unknown) => {
        if (key === "drylake.buildSession") {
          return {
            id: "session-123",
            mode: "build-app",
            prompt: "Build checkout",
            createdAt: "2026-05-16T00:00:00.000Z",
            runbookPath: "drylake.xu",
            providerId: "user-ide-ai",
            providerLabel: "User IDE AI",
          };
        }

        return fallback;
      }),
      update: vi.fn(),
    };
    const provider = new WorkspaceSidebarProvider(new StateStore({ workspaceState } as never), {} as never);
    const state = (provider as unknown as { _buildState: () => SidebarState })._buildState();

    expect(state.runbook?.sessionName).toBe("session-123");
    expect(state.runbook?.approvalStatus).toBe("No runbook");
  });

  it("summarizes the first non-complete phase for the sidebar", () => {
    const stateStore = new StateStore({ workspaceState: { get: vi.fn(), update: vi.fn() } } as never);
    const runbook = createStarterXu({ prompt: "Build checkout", mode: "build-app" });
    runbook.phases[0].status = "complete";
    runbook.phases[1].agent = "cursor";

    expect(stateStore.getActivePhaseSummary(runbook)).toEqual({
      phaseId: runbook.phases[1].id,
      phaseTitle: runbook.phases[1].title,
      agent: "cursor",
    });
  });
});

describe("help tree advanced tools", () => {
  it("adds legacy agent config actions after the Advanced Tools separator", async () => {
    const provider = new HelpTreeProvider();
    const items = await provider.getChildren();
    const labels = items.map((item) => item.label);
    const separatorIndex = labels.indexOf("— Advanced Tools —");

    expect(separatorIndex).toBeGreaterThan(-1);
    expect(labels.slice(separatorIndex + 1)).toEqual([
      "Import Agent Configs",
      "Sync Agent Configs",
      "Validate Agent Configs",
      "Preview Agent Config Changes",
      "Pull Generated Agent Files",
    ]);

    const separator = provider.getTreeItem(items[separatorIndex]);
    expect(separator.contextValue).toBe("disabled");
  });
});
