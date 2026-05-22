import * as childProcess from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";

import type { XuPhase, XuPhaseAgent } from "../xu/types";

const execFile = promisify(childProcess.execFile);

type TerminalAgent = {
  kind: "terminal";
  executable: string;
  terminalCommand: (promptFilePath: string) => string;
};

type VsCodeAgent = {
  kind: "vscode-command";
  extensionIds: string[];
  commandId: string;
  commandArgs: (prompt: string) => unknown[];
};

type ExternalAgent = {
  kind: "external";
};

type InstalledPromptAgent = {
  kind: "installed-prompt";
  extensionIds: string[];
};

export type PhaseAgentLauncher = {
  id: XuPhaseAgent;
  label: string;
  help: string;
} & (TerminalAgent | VsCodeAgent | InstalledPromptAgent | ExternalAgent);

export type PhaseAgentLaunchResult = {
  status: "launched" | "fallback" | "not-installed" | "failed";
  message: string;
  promptFile?: vscode.Uri;
  command?: string;
};

const WINDOWS = process.platform === "win32";

function quotePowerShell(value: string) {
  return `"${value.replace(/`/g, "``").replace(/"/g, '`"')}"`;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quotePath(value: string) {
  return WINDOWS ? quotePowerShell(value) : quoteShell(value);
}

function fromPromptFile(command: string, promptFilePath: string) {
  const path = quotePath(promptFilePath);
  if (WINDOWS) {
    return `$prompt = Get-Content -Raw ${path}; ${command} $prompt`;
  }

  return `${command} "$(cat ${path})"`;
}

export const PHASE_AGENT_LAUNCHERS: Record<XuPhaseAgent, PhaseAgentLauncher> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    kind: "terminal",
    executable: "claude",
    help: "Install Claude Code CLI and make the `claude` command available on PATH.",
    terminalCommand: (promptFilePath) => (WINDOWS
      ? `Get-Content -Raw ${quotePath(promptFilePath)} | claude -p`
      : `cat ${quotePath(promptFilePath)} | claude -p`),
  },
  codex: {
    id: "codex",
    label: "Codex",
    kind: "terminal",
    executable: "codex",
    help: "Install Codex CLI and make the `codex` command available on PATH.",
    terminalCommand: (promptFilePath) => fromPromptFile("codex exec", promptFilePath),
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    kind: "external",
    help: "Cursor runs as a separate editor. Use Copy prompt unless a Cursor CLI/URI launcher is configured in a later build.",
  },
  cline: {
    id: "cline",
    label: "Cline",
    kind: "installed-prompt",
    extensionIds: ["saoudrizwan.claude-dev", "cline.cline"],
    help: "Install Cline in VS Code. DryLake will copy the phase prompt and keep the handoff file ready until Cline exposes a stable command input API.",
  },
  continue: {
    id: "continue",
    label: "Continue.dev",
    kind: "installed-prompt",
    extensionIds: ["continue.continue"],
    help: "Install Continue.dev in VS Code. DryLake will copy the phase prompt and keep the handoff file ready until direct command input is verified.",
  },
  aider: {
    id: "aider",
    label: "Aider",
    kind: "terminal",
    executable: "aider",
    help: "Install Aider and make the `aider` command available on PATH.",
    terminalCommand: (promptFilePath) => `aider --message-file ${quotePath(promptFilePath)}`,
  },
  windsurf: {
    id: "windsurf",
    label: "Windsurf",
    kind: "external",
    help: "Windsurf runs as a separate editor. Use Copy prompt unless a Windsurf CLI/URI launcher is configured in a later build.",
  },
  copilot: {
    id: "copilot",
    label: "GitHub Copilot",
    kind: "vscode-command",
    extensionIds: ["github.copilot-chat", "github.copilot"],
    commandId: "workbench.action.chat.open",
    commandArgs: (prompt) => [{ query: prompt }],
    help: "Install GitHub Copilot Chat in VS Code.",
  },
  "roo-code": {
    id: "roo-code",
    label: "Roo Code",
    kind: "installed-prompt",
    extensionIds: ["rooveterinaryinc.roo-cline", "roo-cline.roo-cline"],
    help: "Install Roo Code in VS Code. DryLake will copy the phase prompt and keep the handoff file ready until direct command input is verified.",
  },
  "augment-code": {
    id: "augment-code",
    label: "Augment Code",
    kind: "installed-prompt",
    extensionIds: ["augment.vscode-augment", "augmentcode.augment"],
    help: "Install Augment Code in VS Code. DryLake will copy the phase prompt and keep the handoff file ready until direct command input is verified.",
  },
  "external-ai-prompt": {
    id: "external-ai-prompt",
    label: "External AI Prompt",
    kind: "external",
    help: "DryLake writes and copies the focused phase prompt for use in any external AI tool.",
  },
};

export function phaseAgentLabel(agent: XuPhaseAgent) {
  return PHASE_AGENT_LAUNCHERS[agent]?.label ?? agent;
}

export function phaseAgentActionLabel(agent: XuPhaseAgent) {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  if (!launcher || launcher.kind === "external") {
    return "Copy prompt";
  }

  if (launcher.kind === "installed-prompt") {
    return `Open ${launcher.label}`;
  }

  return `Run with ${launcher.label}`;
}

export function phaseAgentHint(agent: XuPhaseAgent) {
  return PHASE_AGENT_LAUNCHERS[agent]?.help ?? "DryLake will export a focused prompt for this phase.";
}

export function phaseAgentConnectionLabel(agent: XuPhaseAgent) {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  if (!launcher || launcher.kind === "external") {
    return "Prompt fallback";
  }

  if (launcher.kind === "terminal") {
    return "Direct CLI";
  }

  if (launcher.kind === "vscode-command") {
    return "Direct VS Code";
  }

  return "Prompt-ready";
}

export function phaseAgentConnectionTone(agent: XuPhaseAgent) {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  if (!launcher || launcher.kind === "external") {
    return "fallback";
  }

  return launcher.kind === "installed-prompt" ? "prompt" : "direct";
}

export function phaseAgentConnectionDescription(agent: XuPhaseAgent) {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  if (!launcher || launcher.kind === "external") {
    return "Saves a handoff file and copies the prompt because this agent runs outside VS Code direct command control.";
  }

  if (launcher.kind === "terminal") {
    return `Runs ${launcher.label} from a VS Code terminal using the saved phase handoff file.`;
  }

  if (launcher.kind === "vscode-command") {
    return `Opens ${launcher.label} inside VS Code with the phase prompt.`;
  }

  return `${launcher.label} can be selected for phase ownership, but direct command input is not verified yet.`;
}

function sanitizePathPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "phase";
}

export async function writePhaseHandoffFile(params: {
  workspaceUri: vscode.Uri;
  phase: XuPhase;
  agent: XuPhaseAgent;
  content: string;
}) {
  const folder = vscode.Uri.joinPath(params.workspaceUri, ".drylake", "handoffs");
  await vscode.workspace.fs.createDirectory(folder);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${sanitizePathPart(params.phase.id)}-${params.agent}.md`;
  const uri = vscode.Uri.joinPath(folder, fileName);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(params.content));
  return uri;
}

async function executableExists(executable: string) {
  try {
    await execFile(WINDOWS ? "where" : "which", [executable]);
    return true;
  } catch {
    return false;
  }
}

function hasExtension(extensionIds: string[]) {
  return extensionIds.some((id) => Boolean(vscode.extensions.getExtension(id)));
}

async function launchTerminalAgent(params: {
  launcher: Extract<PhaseAgentLauncher, TerminalAgent>;
  promptFile: vscode.Uri;
  workspaceUri: vscode.Uri;
}) {
  const available = await executableExists(params.launcher.executable);
  if (!available) {
    return {
      status: "not-installed" as const,
      message: `${params.launcher.label} is not installed or is not on PATH. ${params.launcher.help}`,
      promptFile: params.promptFile,
    };
  }

  const command = params.launcher.terminalCommand(params.promptFile.fsPath);
  const terminal = vscode.window.createTerminal({
    name: `DryLake: ${params.launcher.label}`,
    cwd: params.workspaceUri.fsPath,
  });
  terminal.show(true);
  terminal.sendText(command, true);

  return {
    status: "launched" as const,
    message: `Started ${params.launcher.label} for this phase.`,
    promptFile: params.promptFile,
    command,
  };
}

async function launchVsCodeAgent(params: {
  launcher: Extract<PhaseAgentLauncher, VsCodeAgent>;
  prompt: string;
  promptFile: vscode.Uri;
}) {
  if (!hasExtension(params.launcher.extensionIds)) {
    return {
      status: "not-installed" as const,
      message: `${params.launcher.label} is not installed. ${params.launcher.help}`,
      promptFile: params.promptFile,
    };
  }

  try {
    await vscode.commands.executeCommand(params.launcher.commandId, ...params.launcher.commandArgs(params.prompt));
    return {
      status: "launched" as const,
      message: `Opened ${params.launcher.label} with the phase prompt.`,
      promptFile: params.promptFile,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "failed" as const,
      message: `DryLake could not open ${params.launcher.label}: ${detail}`,
      promptFile: params.promptFile,
    };
  }
}

function launchInstalledPromptAgent(params: {
  launcher: Extract<PhaseAgentLauncher, InstalledPromptAgent>;
  promptFile: vscode.Uri;
}) {
  if (!hasExtension(params.launcher.extensionIds)) {
    return {
      status: "not-installed" as const,
      message: `${params.launcher.label} is not installed. ${params.launcher.help}`,
      promptFile: params.promptFile,
    };
  }

  return {
    status: "fallback" as const,
    message: `${params.launcher.label} is installed. DryLake copied the phase prompt and saved a handoff file because direct command input is not verified yet.`,
    promptFile: params.promptFile,
  };
}

export async function launchPhaseAgent(params: {
  agent: XuPhaseAgent;
  prompt: string;
  promptFile: vscode.Uri;
  workspaceUri: vscode.Uri;
}): Promise<PhaseAgentLaunchResult> {
  const launcher = PHASE_AGENT_LAUNCHERS[params.agent];
  if (!launcher || launcher.kind === "external") {
    return {
      status: "fallback",
      message: "DryLake copied the phase prompt and saved a handoff file for external use.",
      promptFile: params.promptFile,
    };
  }

  if (launcher.kind === "terminal") {
    return launchTerminalAgent({ launcher, promptFile: params.promptFile, workspaceUri: params.workspaceUri });
  }

  if (launcher.kind === "vscode-command") {
    return launchVsCodeAgent({ launcher, prompt: params.prompt, promptFile: params.promptFile });
  }

  return launchInstalledPromptAgent({ launcher, promptFile: params.promptFile });
}
