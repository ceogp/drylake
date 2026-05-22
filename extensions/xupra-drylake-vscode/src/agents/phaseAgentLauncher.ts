import * as childProcess from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";

import type { XuPhase, XuPhaseAgent } from "../xu/types";

const execFile = promisify(childProcess.execFile);

type TerminalAgent = {
  kind: "terminal";
  executable: string;
  terminalCommand: (promptFilePath: string) => string;
  shellScriptCommand: (promptFileRef: string) => string;
  batchScriptCommand: () => string;
};

type VsCodeAgent = {
  kind: "vscode-command";
  extensionIds: string[];
  commandId: string;
  commandArgs: (prompt: string) => unknown[];
};

export type PhaseAgentLauncher = {
  id: XuPhaseAgent;
  label: string;
  help: string;
} & (TerminalAgent | VsCodeAgent);

export type PhaseAgentLaunchResult = {
  status: "launched" | "fallback" | "not-installed" | "failed";
  message: string;
  promptFile?: vscode.Uri;
  command?: string;
};

export const PHASE_HANDOFF_ACTIONS = ["run", "script-sh", "script-bat", "copy", "markdown"] as const;

export type PhaseHandoffAction = (typeof PHASE_HANDOFF_ACTIONS)[number];

export type PhaseHandoffOption = {
  action: PhaseHandoffAction;
  label: string;
  title: string;
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

function shellPipeCommand(command: string) {
  return (promptFileRef: string) => `cat ${promptFileRef} | ${command}`;
}

function shellPromptArgCommand(command: string) {
  return (promptFileRef: string) => `${command} "$(cat ${promptFileRef})"`;
}

function batchPipeCommand(command: string) {
  return () => `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Raw $env:PROMPT_FILE | ${command}"`;
}

function batchPromptArgCommand(command: string) {
  return () => `powershell -NoProfile -ExecutionPolicy Bypass -Command "$prompt = Get-Content -Raw $env:PROMPT_FILE; ${command} $prompt"`;
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
    shellScriptCommand: shellPipeCommand("claude -p"),
    batchScriptCommand: batchPipeCommand("claude -p"),
  },
  codex: {
    id: "codex",
    label: "Codex",
    kind: "terminal",
    executable: "codex",
    help: "Install Codex CLI and make the `codex` command available on PATH.",
    terminalCommand: (promptFilePath) => fromPromptFile("codex exec", promptFilePath),
    shellScriptCommand: shellPromptArgCommand("codex exec"),
    batchScriptCommand: batchPromptArgCommand("codex exec"),
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    kind: "terminal",
    executable: "gemini",
    help: "Install Gemini CLI and make the `gemini` command available on PATH.",
    terminalCommand: (promptFilePath) => fromPromptFile("gemini -p", promptFilePath),
    shellScriptCommand: shellPromptArgCommand("gemini -p"),
    batchScriptCommand: batchPromptArgCommand("gemini -p"),
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    kind: "terminal",
    executable: "agent",
    help: "Install Cursor CLI and make the `agent` command available on PATH.",
    terminalCommand: (promptFilePath) => fromPromptFile("agent -p", promptFilePath),
    shellScriptCommand: shellPromptArgCommand("agent -p"),
    batchScriptCommand: batchPromptArgCommand("agent -p"),
  },
  aider: {
    id: "aider",
    label: "Aider",
    kind: "terminal",
    executable: "aider",
    help: "Install Aider and make the `aider` command available on PATH.",
    terminalCommand: (promptFilePath) => `aider --message-file ${quotePath(promptFilePath)}`,
    shellScriptCommand: (promptFileRef) => `aider --message-file ${promptFileRef}`,
    batchScriptCommand: () => `aider --message-file "%PROMPT_FILE%"`,
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
  "augment-code": {
    id: "augment-code",
    label: "Augment Code",
    kind: "terminal",
    executable: "auggie",
    help: "Install Auggie CLI and make the `auggie` command available on PATH.",
    terminalCommand: (promptFilePath) => `auggie --print --instruction-file ${quotePath(promptFilePath)}`,
    shellScriptCommand: (promptFileRef) => `auggie --print --instruction-file ${promptFileRef}`,
    batchScriptCommand: () => `auggie --print --instruction-file "%PROMPT_FILE%"`,
  },
};

export function phaseAgentLabel(agent: XuPhaseAgent) {
  return PHASE_AGENT_LAUNCHERS[agent]?.label ?? agent;
}

export function phaseHandoffActionFromArg(arg: unknown): PhaseHandoffAction | undefined {
  return typeof arg === "string" && (PHASE_HANDOFF_ACTIONS as readonly string[]).includes(arg)
    ? (arg as PhaseHandoffAction)
    : undefined;
}

export function phaseAgentHandoffOptions(agent: XuPhaseAgent): PhaseHandoffOption[] {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  const options: PhaseHandoffOption[] = [
    {
      action: "run",
      label: launcher.kind === "vscode-command" ? "Open in VS Code Chat" : "Run selected agent",
      title: phaseAgentHint(agent),
    },
  ];

  if (launcher.kind === "terminal") {
    options.push(
      {
        action: "script-sh",
        label: "Export .sh script",
        title: `Export a bash script that runs ${launcher.label} with this phase prompt.`,
      },
      {
        action: "script-bat",
        label: "Export .bat script",
        title: `Export a Windows batch script that runs ${launcher.label} with this phase prompt.`,
      },
    );
  }

  options.push(
    {
      action: "copy",
      label: "Copy prompt",
      title: "Copy the phase prompt to the clipboard.",
    },
    {
      action: "markdown",
      label: "Export Markdown",
      title: "Save and open the phase prompt as a Markdown handoff file.",
    },
  );

  return options;
}

export function phaseAgentHint(agent: XuPhaseAgent) {
  return PHASE_AGENT_LAUNCHERS[agent]?.help ?? "DryLake will export a focused prompt for this phase.";
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

function promptFileName(promptFile: vscode.Uri) {
  return promptFile.path.split("/").pop() || "phase-handoff.md";
}

function promptScriptName(promptFile: vscode.Uri, shell: "sh" | "bat") {
  return promptFileName(promptFile).replace(/\.md$/i, `.${shell}`);
}

function renderShellScript(launcher: Extract<PhaseAgentLauncher, TerminalAgent>, promptFile: vscode.Uri) {
  const fileName = promptFileName(promptFile);
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "HANDOFF_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"",
    `PROMPT_FILE="$HANDOFF_DIR/${fileName}"`,
    launcher.shellScriptCommand('"$PROMPT_FILE"'),
    "",
  ].join("\n");
}

function renderBatchScript(launcher: Extract<PhaseAgentLauncher, TerminalAgent>, promptFile: vscode.Uri) {
  const fileName = promptFileName(promptFile);
  return [
    "@echo off",
    "setlocal",
    `set "PROMPT_FILE=%~dp0${fileName}"`,
    launcher.batchScriptCommand(),
    "",
  ].join("\r\n");
}

export async function writePhaseHandoffScript(params: {
  workspaceUri: vscode.Uri;
  agent: XuPhaseAgent;
  promptFile: vscode.Uri;
  shell: "sh" | "bat";
}) {
  const launcher = PHASE_AGENT_LAUNCHERS[params.agent];
  if (launcher.kind !== "terminal") {
    throw new Error(`${launcher.label} does not support shell script export.`);
  }

  const folder = vscode.Uri.joinPath(params.workspaceUri, ".drylake", "handoffs");
  await vscode.workspace.fs.createDirectory(folder);
  const fileName = promptScriptName(params.promptFile, params.shell);
  const uri = vscode.Uri.joinPath(folder, fileName);
  const content = params.shell === "sh"
    ? renderShellScript(launcher, params.promptFile)
    : renderBatchScript(launcher, params.promptFile);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
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

export async function launchPhaseAgent(params: {
  agent: XuPhaseAgent;
  prompt: string;
  promptFile: vscode.Uri;
  workspaceUri: vscode.Uri;
}): Promise<PhaseAgentLaunchResult> {
  const launcher = PHASE_AGENT_LAUNCHERS[params.agent];
  if (!launcher) {
    return {
      status: "fallback",
      message: "DryLake copied the phase prompt and saved a handoff file because this agent is not supported by this build.",
      promptFile: params.promptFile,
    };
  }

  if (launcher.kind === "terminal") {
    return launchTerminalAgent({ launcher, promptFile: params.promptFile, workspaceUri: params.workspaceUri });
  }

  return launchVsCodeAgent({ launcher, prompt: params.prompt, promptFile: params.promptFile });
}
