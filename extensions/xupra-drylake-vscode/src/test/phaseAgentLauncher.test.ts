import { describe, expect, it, vi } from "vitest";

import {
  PHASE_AGENT_LAUNCHERS,
  PHASE_HANDOFF_ACTIONS,
  phaseAgentHandoffOptions,
} from "../agents/phaseAgentLauncher";

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
    createTerminal: vi.fn(),
  },
  extensions: {
    getExtension: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

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
    expect((PHASE_AGENT_LAUNCHERS as Record<string, unknown>).continue).toBeUndefined();
    expect((PHASE_AGENT_LAUNCHERS as Record<string, unknown>).aider).toBeUndefined();
    expect((PHASE_AGENT_LAUNCHERS as Record<string, unknown>)["augment-code"]).toBeUndefined();
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
    expect(PHASE_AGENT_LAUNCHERS.gemini.terminalCommand("/tmp/prompt.md")).toContain("gemini -p");
    expect(PHASE_AGENT_LAUNCHERS.gemini.shellScriptCommand('"$PROMPT_FILE"')).toBe('gemini -p "$(cat "$PROMPT_FILE")"');
    expect(PHASE_AGENT_LAUNCHERS.copilot.commandId).toBe("workbench.action.chat.open");
  });
});
