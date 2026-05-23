import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PHASE_AGENT_LAUNCHERS,
  PHASE_HANDOFF_ACTIONS,
  launchPhaseAgent,
  phaseHandoffActionFromArg,
  phaseAgentHandoffOptions,
} from "../agents/phaseAgentLauncher";
import { XU_PHASE_AGENTS } from "../xu/types";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  createTerminal: vi.fn(),
  terminal: {
    show: vi.fn(),
    sendText: vi.fn(),
  },
  executeCommand: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

vi.mock("vscode", () => ({
  Uri: {
    joinPath: (base: { path?: string; fsPath?: string }, ...segments: string[]) => ({
      path: [base.path ?? base.fsPath ?? "", ...segments].join("/"),
      fsPath: [base.fsPath ?? base.path ?? "", ...segments].join("/"),
    }),
  },
  workspace: {
    fs: {
      createDirectory: vi.fn(),
      writeFile: vi.fn(),
    },
  },
  window: {
    createTerminal: mocks.createTerminal,
  },
  extensions: {
    getExtension: vi.fn(),
  },
  commands: {
    executeCommand: mocks.executeCommand,
  },
}));

beforeEach(() => {
  mocks.execFile.mockReset();
  mocks.createTerminal.mockReset();
  mocks.terminal.show.mockReset();
  mocks.terminal.sendText.mockReset();
  mocks.executeCommand.mockReset();
  mocks.createTerminal.mockReturnValue(mocks.terminal);
});

function expectNoPhaseStatusUpdateCommand() {
  expect(mocks.executeCommand).not.toHaveBeenCalledWith("drylake.updatePhaseStatus", expect.anything(), expect.anything());
}

const FUTURE_PHASE_AGENTS = ["blackbox", "droid", "aider", "augment-code", "continue", "cline"] as const;

describe("phase agent launchers", () => {
  it("keeps GitHub Copilot as an agent choice instead of a second handoff mode", () => {
    expect(PHASE_HANDOFF_ACTIONS).not.toContain("vscode");

    const labels = phaseAgentHandoffOptions("copilot").map((option) => option.label);

    expect(labels).toEqual(["Open Chat Handoff", "Copy prompt", "Open Markdown"]);
  });

  it("uses generic handoff action labels after the phase agent is selected", () => {
    const labels = phaseAgentHandoffOptions("codex").map((option) => option.label);

    expect(labels).toEqual([
      "Run Handoff",
      "Export .sh script",
      "Export .bat script",
      "Copy prompt",
      "Open Markdown",
    ]);
    expect(labels.join(" ")).not.toContain("Codex");
  });

  // Export-only actions must never change phase status.
  describe("export-only handoff actions", () => {
    it.each([
      ["Copy action", "copy"],
      ["Markdown action", "markdown"],
      ["Export .sh", "script-sh"],
      ["Export .bat", "script-bat"],
    ] as const)(
      "%s does not change phase status",
      (_label, action) => {
        expect(phaseHandoffActionFromArg(action)).toBe(action);
        expectNoPhaseStatusUpdateCommand();
      },
    );
  });

  it("does not include unverified phase agent launchers", () => {
    expect(XU_PHASE_AGENTS).toEqual(["claude-code", "codex", "gemini", "cursor", "copilot"]);

    for (const agent of FUTURE_PHASE_AGENTS) {
      expect(XU_PHASE_AGENTS).not.toContain(agent as never);
      expect((PHASE_AGENT_LAUNCHERS as Record<string, unknown>)[agent]).toBeUndefined();
    }
  });

  it("uses verified v1 launcher commands", () => {
    expect(PHASE_AGENT_LAUNCHERS["claude-code"].kind).toBe("terminal");
    expect(PHASE_AGENT_LAUNCHERS["codex"].kind).toBe("terminal");
    expect(PHASE_AGENT_LAUNCHERS.cursor.kind).toBe("terminal");
    expect(PHASE_AGENT_LAUNCHERS.gemini.kind).toBe("terminal");
    expect(PHASE_AGENT_LAUNCHERS.copilot.kind).toBe("vscode-command");

    if (
      PHASE_AGENT_LAUNCHERS["claude-code"].kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.codex.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.cursor.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.gemini.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.copilot.kind !== "vscode-command"
    ) {
      throw new Error("Unexpected launcher kind");
    }

    expect(PHASE_AGENT_LAUNCHERS["claude-code"].terminalCommand("/tmp/prompt.md")).toContain("claude -p");
    expect(PHASE_AGENT_LAUNCHERS.codex.terminalCommand("/tmp/prompt.md")).toContain("codex exec");
    expect(PHASE_AGENT_LAUNCHERS.codex.shellScriptCommand('"$PROMPT_FILE"')).toBe('codex exec "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.codex.batchScriptCommand()).toContain("codex exec $prompt");
    expect(PHASE_AGENT_LAUNCHERS.cursor.executable).toBe("cursor-agent");
    expect(PHASE_AGENT_LAUNCHERS.cursor.terminalCommand("/tmp/prompt.md")).toContain("cursor-agent -p");
    expect(PHASE_AGENT_LAUNCHERS.cursor.shellScriptCommand('"$PROMPT_FILE"')).toBe('cursor-agent -p "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.cursor.batchScriptCommand()).toContain("cursor-agent -p $prompt");
    expect(PHASE_AGENT_LAUNCHERS.gemini.terminalCommand("/tmp/prompt.md")).toContain("gemini -p");
    expect(PHASE_AGENT_LAUNCHERS.gemini.shellScriptCommand('"$PROMPT_FILE"')).toBe('gemini -p "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.gemini.batchScriptCommand()).toContain("gemini -p $prompt");
    expect(PHASE_AGENT_LAUNCHERS.copilot.commandId).toBe("workbench.action.chat.open");
  });

  it("keeps Gemini CLI aligned with other terminal agent handoff commands", () => {
    const launcher = PHASE_AGENT_LAUNCHERS.gemini;

    expect(launcher.kind).toBe("terminal");
    if (launcher.kind !== "terminal") {
      throw new Error("Unexpected Gemini launcher kind");
    }

    expect(launcher.executable).toBe("gemini");
    expect(launcher.terminalCommand("/tmp/prompt.md")).toContain("gemini -p");
    expect(launcher.shellScriptCommand('"$PROMPT_FILE"')).toBe('gemini -p "$(cat "$PROMPT_FILE")"');
    expect(launcher.batchScriptCommand()).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "$prompt = Get-Content -Raw $env:PROMPT_FILE; gemini -p $prompt"',
    );
  });

  it("uses a PowerShell terminal for Windows direct launches", async () => {
    const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(null, "", ""));

    try {
      const result = await launchPhaseAgent({
        agent: "codex",
        prompt: "Implement phase one.",
        promptFile: { fsPath: "C:\\repo\\.drylake\\handoffs\\P-01-codex.md", path: "/repo/.drylake/handoffs/P-01-codex.md" } as never,
        workspaceUri: { fsPath: "C:\\repo", path: "/repo" } as never,
      });

      expect(result.status).toBe("launched");
      expect(mocks.execFile).toHaveBeenCalledWith("where", ["codex"], expect.any(Function));
      expect(mocks.createTerminal).toHaveBeenCalledWith(expect.objectContaining({
        cwd: "C:\\repo",
        shellPath: "powershell.exe",
      }));
      expect(mocks.terminal.sendText).toHaveBeenCalledWith(
        expect.stringContaining("Get-Content -Raw"),
        true,
      );
      expect(mocks.terminal.sendText).toHaveBeenCalledWith(
        expect.stringContaining("codex exec"),
        true,
      );
      expectNoPhaseStatusUpdateCommand();
    } finally {
      platform.mockRestore();
    }
  });

  it("uses a PowerShell terminal for Windows Gemini direct launches", async () => {
    const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(null, "", ""));

    try {
      const result = await launchPhaseAgent({
        agent: "gemini",
        prompt: "Implement phase one.",
        promptFile: { fsPath: "C:\\repo\\.drylake\\handoffs\\P-01-gemini.md", path: "/repo/.drylake/handoffs/P-01-gemini.md" } as never,
        workspaceUri: { fsPath: "C:\\repo", path: "/repo" } as never,
      });

      expect(result.status).toBe("launched");
      expect(mocks.execFile).toHaveBeenCalledWith("where", ["gemini"], expect.any(Function));
      expect(mocks.createTerminal).toHaveBeenCalledWith(expect.objectContaining({
        cwd: "C:\\repo",
        shellPath: "powershell.exe",
      }));
      expect(mocks.terminal.sendText).toHaveBeenCalledWith(
        expect.stringContaining("Get-Content -Raw"),
        true,
      );
      expect(mocks.terminal.sendText).toHaveBeenCalledWith(
        expect.stringContaining("gemini -p"),
        true,
      );
      expectNoPhaseStatusUpdateCommand();
    } finally {
      platform.mockRestore();
    }
  });

  it("returns the manual fallback result when a terminal executable is missing", async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(new Error("missing executable")));
    const promptFile = { fsPath: "/repo/.drylake/handoffs/P-01-codex.md", path: "/repo/.drylake/handoffs/P-01-codex.md" };

    const result = await launchPhaseAgent({
      agent: "codex",
      prompt: "Implement phase one.",
      promptFile: promptFile as never,
      workspaceUri: { fsPath: "/repo", path: "/repo" } as never,
    });

    expect(result.status).toBe("not-installed");
    expect(result.promptFile).toBe(promptFile);
    expect(result.message).toContain("OpenAI Codex is not installed");
    expect(mocks.createTerminal).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });

  it("returns install guidance when Gemini CLI is missing", async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(new Error("missing executable")));
    const promptFile = { fsPath: "/repo/.drylake/handoffs/P-01-gemini.md", path: "/repo/.drylake/handoffs/P-01-gemini.md" };

    const result = await launchPhaseAgent({
      agent: "gemini",
      prompt: "Implement phase one.",
      promptFile: promptFile as never,
      workspaceUri: { fsPath: "/repo", path: "/repo" } as never,
    });

    expect(result.status).toBe("not-installed");
    expect(result.promptFile).toBe(promptFile);
    expect(result.message).toContain("Gemini CLI is not installed");
    expect(result.message).toContain("Install Gemini CLI");
    expect(mocks.createTerminal).not.toHaveBeenCalled();
    expectNoPhaseStatusUpdateCommand();
  });
});
