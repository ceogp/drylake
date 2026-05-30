import * as childProcess from "node:child_process";
import { constants as fsConstants } from "node:fs";
import * as fs from "node:fs/promises";
import { promisify } from "node:util";
import * as vscode from "vscode";

import { XU_PHASE_AGENTS, type XuPhase, type XuPhaseAgent } from "../xu/types";

const execFile = promisify(childProcess.execFile);

type TerminalAgent = {
  kind: "terminal";
  executable: string;
  commandSetting: string;
  terminalCommand: (promptFilePath: string, executableCommand?: string, workspacePath?: string) => string;
  shellScriptCommand: (promptFileRef: string, executableCommand?: string) => string;
  batchScriptCommand: (executableCommand?: string) => string;
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
  agentLabel?: string;
  executable?: string;
  resolvedCommand?: string;
  searchedPath?: string;
  reason?: string;
  reasonCode?: AgentLaunchFailureReason;
};

export type AgentLaunchFailureReason =
  | "not-found"
  | "bad-configured-path"
  | "not-executable"
  | "extension-missing"
  | "launch-error"
  | "unsupported-agent";

export type PhaseAgentSetupDiagnostic = {
  agent: XuPhaseAgent;
  label: string;
  kind: PhaseAgentLauncher["kind"];
  status: "found" | "not-found";
  command: string;
  resolvedCommand?: string;
  searchedPath?: string;
  reason?: string;
  help: string;
  fallbackAvailable: true;
};

export const PHASE_HANDOFF_ACTIONS = ["run", "script-sh", "script-bat", "copy", "markdown"] as const;

export type PhaseHandoffAction = (typeof PHASE_HANDOFF_ACTIONS)[number];

export type PhaseHandoffOption = {
  action: PhaseHandoffAction;
  label: string;
  title: string;
};

function isWindows() {
  return process.platform === "win32";
}

function quotePowerShell(value: string) {
  return `"${value.replace(/`/g, "``").replace(/"/g, '`"')}"`;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quotePowerShellSingle(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteCmd(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function quotePath(value: string) {
  return isWindows() ? quotePowerShell(value) : quoteShell(value);
}

function fromPromptFile(command: string, promptFilePath: string) {
  if (isWindows()) {
    return `$prompt = Get-Content -Raw -LiteralPath ${quotePowerShellSingle(promptFilePath)}; ${command} $prompt`;
  }

  const path = quotePath(promptFilePath);
  return `${command} "$(cat ${path})"`;
}

function commandNeedsQuoting(command: string) {
  return /\s/.test(command) || command.includes("/") || command.includes("\\") || /^[A-Za-z]:/.test(command);
}

function shellExecutable(command: string) {
  return commandNeedsQuoting(command) ? quoteShell(command) : command;
}

function powerShellExecutable(command: string) {
  return commandNeedsQuoting(command) ? `& ${quotePowerShellSingle(command)}` : command;
}

function shellCommand(executableCommand: string, args = "") {
  return [shellExecutable(executableCommand), args].filter(Boolean).join(" ");
}

function powerShellCommand(executableCommand: string, args = "") {
  return [powerShellExecutable(executableCommand), args].filter(Boolean).join(" ");
}

function crossShellCommand(executableCommand: string, args = "") {
  return isWindows() ? powerShellCommand(executableCommand, args) : shellCommand(executableCommand, args);
}

function shellPromptArgCommand(executable: string, args = "") {
  return (promptFileRef: string, executableCommand = executable) =>
    `${shellCommand(executableCommand, args)} "$(cat ${promptFileRef})"`;
}

function quoteShellDouble(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/`/g, "\\`")}"`;
}

function codexHandoffPrompt(promptFilePath: string) {
  return [
    "Read and execute the DryLake handoff file at:",
    promptFilePath,
    "Treat the Run Handoff click as approval to execute this phase locally.",
    "Do not ask for another planning approval; stop only before irreversible external changes, billing-impacting cloud operations, credential creation or rotation, destructive filesystem actions, or provisioning commands unless the file says provisioning is approved.",
  ].join(" ");
}

function codexInteractiveArgs(params: {
  promptFilePath: string;
  workspacePath?: string;
  quoteArg: (value: string) => string;
  quoteWorkspace: (value: string) => string;
}) {
  return [
    "--yolo",
    params.workspacePath ? `-C ${params.quoteWorkspace(params.workspacePath)}` : "",
    params.quoteArg(codexHandoffPrompt(params.promptFilePath)),
  ].filter(Boolean).join(" ");
}

function claudeRunArgs(workspacePath?: string) {
  return [
    "--dangerously-skip-permissions",
    workspacePath ? `--add-dir ${isWindows() ? quotePowerShellSingle(workspacePath) : quoteShell(workspacePath)}` : "",
  ].filter(Boolean).join(" ");
}

function batchPromptArgCommand(executable: string, args = "") {
  return (executableCommand = executable) =>
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$prompt = Get-Content -Raw $env:PROMPT_FILE; ${powerShellCommand(executableCommand, args)} $prompt"`;
}

export const PHASE_AGENT_LAUNCHERS: Record<XuPhaseAgent, PhaseAgentLauncher> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    kind: "terminal",
    executable: "claude",
    commandSetting: "agents.claude-code.command",
    help: "Install Claude Code CLI and make the `claude` command available on PATH.",
    terminalCommand: (promptFilePath, executableCommand = "claude", workspacePath) =>
      fromPromptFile(crossShellCommand(executableCommand, claudeRunArgs(workspacePath)), promptFilePath),
    shellScriptCommand: shellPromptArgCommand("claude", "--dangerously-skip-permissions"),
    batchScriptCommand: batchPromptArgCommand("claude", "--dangerously-skip-permissions"),
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex",
    kind: "terminal",
    executable: "codex",
    commandSetting: "agents.codex.command",
    help: "Install Codex CLI and make the `codex` command available on PATH.",
    terminalCommand: (promptFilePath, executableCommand = "codex", workspacePath) =>
      isWindows()
        ? powerShellCommand(executableCommand, codexInteractiveArgs({
          promptFilePath,
          workspacePath,
          quoteArg: quotePowerShellSingle,
          quoteWorkspace: quotePowerShellSingle,
        }))
        : shellCommand(executableCommand, codexInteractiveArgs({
          promptFilePath,
          workspacePath,
          quoteArg: quoteShell,
          quoteWorkspace: quoteShell,
        })),
    shellScriptCommand: (_promptFileRef, executableCommand = "codex") =>
      shellCommand(executableCommand, codexInteractiveArgs({
        promptFilePath: "$PROMPT_FILE",
        quoteArg: quoteShellDouble,
        quoteWorkspace: quoteShell,
      })),
    batchScriptCommand: (executableCommand = "codex") =>
      [quoteCmd(executableCommand), codexInteractiveArgs({
        promptFilePath: "%PROMPT_FILE%",
        quoteArg: quoteCmd,
        quoteWorkspace: quoteCmd,
      })].join(" "),
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    kind: "terminal",
    executable: "gemini",
    commandSetting: "agents.gemini.command",
    help: "Install Gemini CLI and make the `gemini` command available on PATH.",
    terminalCommand: (promptFilePath, executableCommand = "gemini") =>
      fromPromptFile(crossShellCommand(executableCommand, "-p"), promptFilePath),
    shellScriptCommand: shellPromptArgCommand("gemini", "-p"),
    batchScriptCommand: batchPromptArgCommand("gemini", "-p"),
  },
  hermes: {
    id: "hermes",
    label: "Hermes Agent",
    kind: "terminal",
    executable: "hermes",
    commandSetting: "agents.hermes.command",
    help: "Install Hermes Agent CLI, configure its model/provider, and make the `hermes` command available on PATH.",
    terminalCommand: (promptFilePath, executableCommand = "hermes") =>
      fromPromptFile(crossShellCommand(executableCommand, "chat -q"), promptFilePath),
    shellScriptCommand: shellPromptArgCommand("hermes", "chat -q"),
    batchScriptCommand: batchPromptArgCommand("hermes", "chat -q"),
  },
  cursor: {
    id: "cursor",
    label: "Cursor CLI",
    kind: "terminal",
    executable: "cursor-agent",
    commandSetting: "agents.cursor.command",
    help: "Install Cursor CLI and make the `cursor-agent` command available on PATH.",
    terminalCommand: (promptFilePath, executableCommand = "cursor-agent") =>
      fromPromptFile(crossShellCommand(executableCommand, "-p"), promptFilePath),
    shellScriptCommand: shellPromptArgCommand("cursor-agent", "-p"),
    batchScriptCommand: batchPromptArgCommand("cursor-agent", "-p"),
  },
  copilot: {
    id: "copilot",
    label: "GitHub Copilot Chat",
    kind: "vscode-command",
    extensionIds: ["github.copilot-chat", "github.copilot"],
    commandId: "workbench.action.chat.open",
    commandArgs: (prompt) => [{ query: prompt }],
    help: "Install GitHub Copilot Chat in VS Code.",
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
      label: launcher.kind === "vscode-command" ? "Open Chat Handoff" : "Run Handoff",
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
      label: "Open Markdown",
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

function configuredTerminalCommand(launcher: Extract<PhaseAgentLauncher, TerminalAgent>) {
  const configured = vscode.workspace.getConfiguration("drylake").get<string>(launcher.commandSetting, launcher.executable);
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed || launcher.executable;
}

function renderShellScript(launcher: Extract<PhaseAgentLauncher, TerminalAgent>, promptFile: vscode.Uri) {
  const fileName = promptFileName(promptFile);
  const executableCommand = configuredTerminalCommand(launcher);
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "HANDOFF_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"",
    `PROMPT_FILE="$HANDOFF_DIR/${fileName}"`,
    launcher.shellScriptCommand('"$PROMPT_FILE"', executableCommand),
    "",
  ].join("\n");
}

function renderBatchScript(launcher: Extract<PhaseAgentLauncher, TerminalAgent>, promptFile: vscode.Uri) {
  const fileName = promptFileName(promptFile);
  const executableCommand = configuredTerminalCommand(launcher);
  return [
    "@echo off",
    "setlocal",
    `set "PROMPT_FILE=%~dp0${fileName}"`,
    launcher.batchScriptCommand(executableCommand),
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

function pathLikeCommand(command: string) {
  return command.includes("/") || command.includes("\\") || /^[A-Za-z]:[\\/]/.test(command);
}

function searchedPath() {
  return process.env.PATH ?? process.env.Path ?? "";
}

function execStdout(result: unknown) {
  if (typeof result === "string" || Buffer.isBuffer(result)) {
    return String(result);
  }

  if (result && typeof result === "object" && "stdout" in result) {
    return String((result as { stdout?: unknown }).stdout ?? "");
  }

  return "";
}

function hasWindowsExecutableExtension(command: string) {
  return /\.(?:cmd|exe|bat|ps1)$/i.test(command);
}

async function preferredWindowsExecutablePath(command: string) {
  if (!isWindows() || hasWindowsExecutableExtension(command)) {
    return command;
  }

  for (const candidate of [`${command}.cmd`, `${command}.exe`, `${command}.bat`, `${command}.ps1`, command]) {
    try {
      await fs.access(candidate, fsConstants.F_OK);
      return candidate;
    } catch {
      // Try the next Windows executable form before falling back to the raw path.
    }
  }

  return command;
}

function preferredLookupResult(stdout: string, command: string) {
  const matches = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!isWindows()) {
    return matches[0] || command;
  }

  return matches.find((match) => hasWindowsExecutableExtension(match)) || matches[0] || command;
}

async function diagnoseTerminalLauncher(launcher: Extract<PhaseAgentLauncher, TerminalAgent>): Promise<PhaseAgentSetupDiagnostic> {
  const command = configuredTerminalCommand(launcher);
  const fallbackBase = {
    agent: launcher.id,
    label: launcher.label,
    kind: launcher.kind,
    command,
    help: launcher.help,
    fallbackAvailable: true as const,
  };

  if (pathLikeCommand(command)) {
    const resolvedCommand = await preferredWindowsExecutablePath(command);
    try {
      await fs.access(resolvedCommand, isWindows() ? fsConstants.F_OK : fsConstants.X_OK);
      return {
        ...fallbackBase,
        status: "found",
        resolvedCommand,
        searchedPath: searchedPath(),
      };
    } catch {
      return {
        ...fallbackBase,
        status: "not-found",
        searchedPath: searchedPath(),
        reason: `Configured ${launcher.label} command does not exist or is not executable: ${command}`,
      };
    }
  }

  try {
    const result = await execFile(isWindows() ? "where" : "which", [command]);
    const stdout = execStdout(result);
    return {
      ...fallbackBase,
      status: "found",
      resolvedCommand: preferredLookupResult(stdout, command),
      searchedPath: searchedPath(),
    };
  } catch {
    return {
      ...fallbackBase,
      status: "not-found",
      searchedPath: searchedPath(),
      reason: `The command \`${command}\` was not found in VS Code's PATH.`,
    };
  }
}

function hasExtension(extensionIds: string[]) {
  return extensionIds.some((id) => Boolean(vscode.extensions.getExtension(id)));
}

export async function diagnosePhaseAgentSetup(agent: XuPhaseAgent): Promise<PhaseAgentSetupDiagnostic> {
  const launcher = PHASE_AGENT_LAUNCHERS[agent];
  if (launcher.kind === "terminal") {
    return diagnoseTerminalLauncher(launcher);
  }

  const found = hasExtension(launcher.extensionIds);
  return {
    agent,
    label: launcher.label,
    kind: launcher.kind,
    status: found ? "found" : "not-found",
    command: launcher.commandId,
    reason: found ? undefined : `${launcher.label} extension is not installed or enabled in VS Code.`,
    help: launcher.help,
    fallbackAvailable: true,
  };
}

export async function diagnosePhaseAgentSetups() {
  return Promise.all(XU_PHASE_AGENTS.map((agent) => diagnosePhaseAgentSetup(agent)));
}

export function renderPhaseAgentSetupReport(diagnostics: PhaseAgentSetupDiagnostic[]) {
  return [
    "# DryLake Agent Setup",
    "",
    ...diagnostics.flatMap((diagnostic) => [
      `## ${diagnostic.label}`,
      "",
      `- Status: ${diagnostic.status === "found" ? "Found" : "Not found"}`,
      `- Command: \`${diagnostic.command}\``,
      diagnostic.resolvedCommand ? `- Resolved command: \`${diagnostic.resolvedCommand}\`` : undefined,
      diagnostic.searchedPath ? `- Searched PATH: \`${diagnostic.searchedPath}\`` : undefined,
      diagnostic.reason ? `- Reason: ${diagnostic.reason}` : undefined,
      "- Fallback: Markdown handoff available",
      `- Setup: ${diagnostic.help}`,
      "",
    ].filter((line): line is string => typeof line === "string")),
  ].join("\n");
}

export async function openPhaseAgentSetupReport() {
  const diagnostics = await diagnosePhaseAgentSetups();
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: renderPhaseAgentSetupReport(diagnostics),
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

function missingTerminalLaunchResult(params: {
  launcher: Extract<PhaseAgentLauncher, TerminalAgent>;
  diagnostic: PhaseAgentSetupDiagnostic;
  promptFile: vscode.Uri;
}): PhaseAgentLaunchResult {
  const configuredPathMissing = pathLikeCommand(params.diagnostic.command);
  const reasonCode: AgentLaunchFailureReason = configuredPathMissing ? "bad-configured-path" : "not-found";
  const reason = params.diagnostic.reason ??
    (configuredPathMissing
      ? `Configured ${params.launcher.label} command does not exist: ${params.diagnostic.command}`
      : `The command \`${params.diagnostic.command}\` was not found in VS Code's PATH.`);

  return {
    status: "not-installed",
    message: `Could not launch ${params.launcher.label}. ${reason}`,
    promptFile: params.promptFile,
    agentLabel: params.launcher.label,
    executable: params.diagnostic.command,
    resolvedCommand: params.diagnostic.resolvedCommand,
    searchedPath: params.diagnostic.searchedPath,
    reason,
    reasonCode,
  };
}

async function launchTerminalAgent(params: {
  launcher: Extract<PhaseAgentLauncher, TerminalAgent>;
  promptFile: vscode.Uri;
  workspaceUri: vscode.Uri;
  terminalName?: string;
}) {
  const diagnostic = await diagnoseTerminalLauncher(params.launcher);
  if (diagnostic.status !== "found") {
    return missingTerminalLaunchResult({ launcher: params.launcher, diagnostic, promptFile: params.promptFile });
  }

  const executableCommand = diagnostic.resolvedCommand ?? diagnostic.command;
  const command = params.launcher.terminalCommand(params.promptFile.fsPath, executableCommand, params.workspaceUri.fsPath);
  try {
    const terminal = vscode.window.createTerminal({
      name: params.terminalName ?? `DryLake: ${params.launcher.label}`,
      cwd: params.workspaceUri.fsPath,
      ...(isWindows() ? { shellPath: "powershell.exe" } : {}),
    });
    terminal.show(true);
    terminal.sendText(command, true);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "failed" as const,
      message: `Could not launch ${params.launcher.label}. VS Code could not create the terminal: ${detail}`,
      promptFile: params.promptFile,
      command,
      agentLabel: params.launcher.label,
      executable: diagnostic.command,
      resolvedCommand: diagnostic.resolvedCommand,
      searchedPath: diagnostic.searchedPath,
      reason: `VS Code could not create the terminal: ${detail}`,
      reasonCode: "launch-error" as const,
    };
  }

  return {
    status: "launched" as const,
    message: `Started ${params.launcher.label} for this phase.`,
    promptFile: params.promptFile,
    command,
    agentLabel: params.launcher.label,
    executable: diagnostic.command,
    resolvedCommand: diagnostic.resolvedCommand,
    searchedPath: diagnostic.searchedPath,
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
      message: `Could not launch ${params.launcher.label}. ${params.launcher.label} extension is not installed or enabled in VS Code.`,
      promptFile: params.promptFile,
      agentLabel: params.launcher.label,
      executable: params.launcher.commandId,
      reason: `${params.launcher.label} extension is not installed or enabled in VS Code.`,
      reasonCode: "extension-missing" as const,
    };
  }

  try {
    await vscode.commands.executeCommand(params.launcher.commandId, ...params.launcher.commandArgs(params.prompt));
    return {
      status: "launched" as const,
      message: `Opened ${params.launcher.label} with the phase prompt.`,
      promptFile: params.promptFile,
      agentLabel: params.launcher.label,
      executable: params.launcher.commandId,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "failed" as const,
      message: `Could not launch ${params.launcher.label}. VS Code command failed: ${detail}`,
      promptFile: params.promptFile,
      agentLabel: params.launcher.label,
      executable: params.launcher.commandId,
      reason: `VS Code command failed: ${detail}`,
      reasonCode: "launch-error" as const,
    };
  }
}

export function formatAgentLaunchFallbackMessage(result: PhaseAgentLaunchResult) {
  const agentLabel = result.agentLabel ?? "the selected agent";
  const reason = result.reason ?? result.message;
  return [
    `Could not launch ${agentLabel}.`,
    "",
    "Reason:",
    reason,
    "",
    "DryLake generated the handoff successfully, but the external CLI could not be started.",
    "",
    "Options:",
    "- Copy the handoff Markdown.",
    "- Open DryLake agent settings.",
    "- Retry detection.",
    "- View setup instructions.",
  ].join("\n");
}

export async function showAgentLaunchFallbackActions(params: {
  result: PhaseAgentLaunchResult;
  promptContent?: string;
  promptFile?: vscode.Uri;
}) {
  let promptContent = params.promptContent;
  if (!promptContent && params.promptFile) {
    try {
      const bytes = await vscode.workspace.fs.readFile(params.promptFile);
      promptContent = new TextDecoder("utf-8").decode(bytes);
    } catch {
      promptContent = undefined;
    }
  }

  if (promptContent) {
    await vscode.env.clipboard.writeText(promptContent);
  }

  if (params.promptFile) {
    const document = await vscode.workspace.openTextDocument(params.promptFile);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  const choice = await vscode.window.showWarningMessage(
    formatAgentLaunchFallbackMessage(params.result),
    { modal: true },
    "Copy Handoff Markdown",
    "Open Agent Settings",
    "Retry Detection",
    "View Setup Guide",
  );

  if (choice === "Copy Handoff Markdown" && promptContent) {
    await vscode.env.clipboard.writeText(promptContent);
    void vscode.window.showInformationMessage("Handoff Markdown copied to clipboard.");
  } else if (choice === "Open Agent Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:xupracorp.drylake drylake.agents");
  } else if (choice === "Retry Detection") {
    await vscode.commands.executeCommand("drylake.checkAgentSetup");
  } else if (choice === "View Setup Guide") {
    await vscode.commands.executeCommand("xupra.openInstallGuide");
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
      reasonCode: "unsupported-agent",
    };
  }

  if (launcher.kind === "terminal") {
    return launchTerminalAgent({ launcher, promptFile: params.promptFile, workspaceUri: params.workspaceUri });
  }

  return launchVsCodeAgent({ launcher, prompt: params.prompt, promptFile: params.promptFile });
}

export async function launchAgentTask(params: {
  agent: XuPhaseAgent;
  prompt: string;
  promptFile: vscode.Uri;
  workspaceUri: vscode.Uri;
  terminalName: string;
}): Promise<PhaseAgentLaunchResult> {
  const launcher = PHASE_AGENT_LAUNCHERS[params.agent];
  if (!launcher) {
    return {
      status: "fallback",
      message: "DryLake saved the task prompt because this agent is not supported by this build.",
      promptFile: params.promptFile,
      reasonCode: "unsupported-agent",
    };
  }

  if (launcher.kind === "terminal") {
    return launchTerminalAgent({
      launcher,
      promptFile: params.promptFile,
      workspaceUri: params.workspaceUri,
      terminalName: params.terminalName,
    });
  }

  return launchVsCodeAgent({ launcher, prompt: params.prompt, promptFile: params.promptFile });
}
