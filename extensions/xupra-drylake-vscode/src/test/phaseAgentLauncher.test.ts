import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PHASE_AGENT_LAUNCHERS,
  PHASE_HANDOFF_ACTIONS,
  diagnosePhaseAgentSetup,
  launchPhaseAgent,
  phaseAgentHandoffOptions,
  renderPhaseAgentSetupReport,
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
  configValues: new Map<string, unknown>(),
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
    getConfiguration: vi.fn(() => ({
      get<T>(key: string, defaultValue?: T) {
        return mocks.configValues.has(key) ? mocks.configValues.get(key) as T : defaultValue as T;
      },
    })),
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
  mocks.configValues.clear();
  mocks.createTerminal.mockReturnValue(mocks.terminal);
});

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

  it("does not include unverified phase agent launchers", () => {
    expect(XU_PHASE_AGENTS).toEqual(["claude-code", "codex", "gemini", "hermes", "cursor", "copilot"]);

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
    expect(PHASE_AGENT_LAUNCHERS.hermes.kind).toBe("terminal");
    expect(PHASE_AGENT_LAUNCHERS.copilot.kind).toBe("vscode-command");

    if (
      PHASE_AGENT_LAUNCHERS["claude-code"].kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.codex.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.cursor.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.gemini.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.hermes.kind !== "terminal" ||
      PHASE_AGENT_LAUNCHERS.copilot.kind !== "vscode-command"
    ) {
      throw new Error("Unexpected launcher kind");
    }

    expect(PHASE_AGENT_LAUNCHERS["claude-code"].terminalCommand("/tmp/prompt.md")).toContain("claude -p");
    expect(PHASE_AGENT_LAUNCHERS.codex.terminalCommand("/tmp/prompt.md")).toContain("codex exec");
    expect(PHASE_AGENT_LAUNCHERS.codex.shellScriptCommand('"$PROMPT_FILE"')).toBe('cat "$PROMPT_FILE" | codex exec -');
    expect(PHASE_AGENT_LAUNCHERS.codex.batchScriptCommand()).toContain("Get-Content -Raw $env:PROMPT_FILE | codex exec -");
    expect(PHASE_AGENT_LAUNCHERS.cursor.executable).toBe("cursor-agent");
    expect(PHASE_AGENT_LAUNCHERS.cursor.terminalCommand("/tmp/prompt.md")).toContain("cursor-agent -p");
    expect(PHASE_AGENT_LAUNCHERS.cursor.shellScriptCommand('"$PROMPT_FILE"')).toBe('cursor-agent -p "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.cursor.batchScriptCommand()).toContain("cursor-agent -p $prompt");
    expect(PHASE_AGENT_LAUNCHERS.gemini.terminalCommand("/tmp/prompt.md")).toContain("gemini -p");
    expect(PHASE_AGENT_LAUNCHERS.gemini.shellScriptCommand('"$PROMPT_FILE"')).toBe('gemini -p "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.gemini.batchScriptCommand()).toContain("gemini -p $prompt");
    expect(PHASE_AGENT_LAUNCHERS.hermes.executable).toBe("hermes");
    expect(PHASE_AGENT_LAUNCHERS.hermes.terminalCommand("/tmp/prompt.md")).toContain("hermes chat -q");
    expect(PHASE_AGENT_LAUNCHERS.hermes.shellScriptCommand('"$PROMPT_FILE"')).toBe('hermes chat -q "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.hermes.batchScriptCommand()).toContain("hermes chat -q $prompt");
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
      expect(mocks.terminal.sendText).toHaveBeenCalledWith(
        expect.stringContaining("exec -"),
        true,
      );
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
    expect(result.reasonCode).toBe("not-found");
    expect(result.promptFile).toBe(promptFile);
    expect(result.message).toContain("Could not launch OpenAI Codex");
    expect(result.reason).toContain("codex");
    expect(result.searchedPath).toBeDefined();
    expect(mocks.createTerminal).not.toHaveBeenCalled();
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
    expect(result.message).toContain("Could not launch Gemini CLI");
    expect(result.reason).toContain("gemini");
    expect(mocks.createTerminal).not.toHaveBeenCalled();
  });

  it("returns install guidance when Hermes Agent CLI is missing", async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(new Error("missing executable")));
    const promptFile = { fsPath: "/repo/.drylake/handoffs/P-01-hermes.md", path: "/repo/.drylake/handoffs/P-01-hermes.md" };

    const result = await launchPhaseAgent({
      agent: "hermes",
      prompt: "Implement phase one.",
      promptFile: promptFile as never,
      workspaceUri: { fsPath: "/repo", path: "/repo" } as never,
    });

    expect(result.status).toBe("not-installed");
    expect(result.promptFile).toBe(promptFile);
    expect(result.message).toContain("Could not launch Hermes Agent");
    expect(result.reason).toContain("hermes");
    expect(mocks.createTerminal).not.toHaveBeenCalled();
  });

  it("reports a bad configured command path separately from PATH lookup misses", async () => {
    mocks.configValues.set("agents.codex.command", "/missing/codex");
    const promptFile = { fsPath: "/repo/.drylake/handoffs/P-01-codex.md", path: "/repo/.drylake/handoffs/P-01-codex.md" };

    const result = await launchPhaseAgent({
      agent: "codex",
      prompt: "Implement phase one.",
      promptFile: promptFile as never,
      workspaceUri: { fsPath: "/repo", path: "/repo" } as never,
    });

    expect(result.status).toBe("not-installed");
    expect(result.reasonCode).toBe("bad-configured-path");
    expect(result.executable).toBe("/missing/codex");
    expect(result.reason).toContain("Configured OpenAI Codex command");
    expect(mocks.execFile).not.toHaveBeenCalledWith("which", ["codex"], expect.any(Function));
    expect(mocks.createTerminal).not.toHaveBeenCalled();
  });

  it("renders an agent setup report with command, path, and markdown fallback state", async () => {
    mocks.execFile.mockImplementation((_file, _args, callback) => callback(new Error("missing executable")));

    const diagnostic = await diagnosePhaseAgentSetup("codex");
    const report = renderPhaseAgentSetupReport([diagnostic]);

    expect(diagnostic.status).toBe("not-found");
    expect(report).toContain("DryLake Agent Setup");
    expect(report).toContain("OpenAI Codex");
    expect(report).toContain("Command: `codex`");
    expect(report).toContain("Fallback: Markdown handoff available");
    expect(report).toContain("Searched PATH:");
  });
});
