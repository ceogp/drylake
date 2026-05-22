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

    expect(labels).toEqual(["Open in VS Code Chat", "Copy prompt", "Export Markdown"]);
  });

  it("uses generic handoff action labels after the phase agent is selected", () => {
    const labels = phaseAgentHandoffOptions("codex").map((option) => option.label);

    expect(labels).toEqual([
      "Run selected agent",
      "Export .sh script",
      "Export .bat script",
      "Copy prompt",
      "Export Markdown",
    ]);
    expect(labels.join(" ")).not.toContain("Codex");
  });

  it("does not include Continue.dev as a phase agent launcher", () => {
    expect((PHASE_AGENT_LAUNCHERS as Record<string, unknown>).continue).toBeUndefined();
  });
});