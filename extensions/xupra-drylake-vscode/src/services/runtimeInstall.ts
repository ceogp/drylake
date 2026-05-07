import os from "node:os";
import path from "node:path";

import * as vscode from "vscode";

import { writeGeneratedFilesToWorkspace } from "./fileSync";

type GeneratedInstallFile = {
  logicalPath: string;
  preview: string;
};

type ParsedCodexAgent = {
  agentName: string;
  profileName: string;
  model?: string;
  modelReasoningEffort?: string;
  sandboxMode?: string;
  developerInstructions: string;
};

export type RuntimeInstallSummary = {
  writtenCount: number;
  installRoot: string;
  codexAgents: string[];
  codexProfiles: string[];
  claudeAgents: string[];
};

const CODEX_AGENT_PATH_PATTERN = /^\.codex\/agents\/.+\.toml$/i;
const CLAUDE_AGENT_PATH_PATTERN = /^\.claude\/agents\/.+\.md$/i;

function mapRuntimeLogicalPath(logicalPath: string) {
  const normalized = logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized === "AGENTS.md") {
    return ".codex/AGENTS.md";
  }

  if (normalized === "CLAUDE.md") {
    return ".claude/CLAUDE.md";
  }

  if (normalized.startsWith(".agents/skills/")) {
    return `.codex/skills/${normalized.slice(".agents/skills/".length)}`;
  }

  return normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTomlString(content: string, key: string) {
  const match = content.match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*"([^"]*)"`, "m"));
  return match?.[1]?.trim();
}

function parseTomlMultilineString(content: string, key: string) {
  const match = content.match(
    new RegExp(`${escapeRegExp(key)}\\s*=\\s*"""([\\s\\S]*?)"""`, "m"),
  );
  return match?.[1]?.trim();
}

function sanitizeCodexProfileName(agentName: string) {
  const slug = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `xupra_${slug || "agent"}`;
}

function parseCodexAgent(file: GeneratedInstallFile): ParsedCodexAgent | null {
  const agentName =
    parseTomlString(file.preview, "name") ?? path.posix.basename(file.logicalPath, ".toml");
  const developerInstructions = parseTomlMultilineString(file.preview, "developer_instructions");

  if (!developerInstructions) {
    return null;
  }

  return {
    agentName,
    profileName: sanitizeCodexProfileName(agentName),
    model: parseTomlString(file.preview, "model"),
    modelReasoningEffort: parseTomlString(file.preview, "model_reasoning_effort"),
    sandboxMode: parseTomlString(file.preview, "sandbox_mode"),
    developerInstructions,
  };
}

function buildManagedCodexProfileBlock(agent: ParsedCodexAgent) {
  const escapedInstructions = agent.developerInstructions.replace(/"""/g, '\\"\\"\\"');
  const lines = [
    `# BEGIN XUPRA CODEX PROFILE ${agent.profileName}`,
    `[profiles.${agent.profileName}]`,
    `developer_instructions = """${escapedInstructions}"""`,
    agent.model ? `model = "${agent.model.replace(/"/g, '\\"')}"` : "",
    agent.modelReasoningEffort
      ? `model_reasoning_effort = "${agent.modelReasoningEffort.replace(/"/g, '\\"')}"`
      : "",
    agent.sandboxMode ? `sandbox_mode = "${agent.sandboxMode.replace(/"/g, '\\"')}"` : "",
    `# END XUPRA CODEX PROFILE ${agent.profileName}`,
  ];

  return lines.filter(Boolean).join("\n");
}

function upsertManagedCodexProfile(configContent: string, agent: ParsedCodexAgent) {
  const block = buildManagedCodexProfileBlock(agent);
  const startMarker = `# BEGIN XUPRA CODEX PROFILE ${agent.profileName}`;
  const endMarker = `# END XUPRA CODEX PROFILE ${agent.profileName}`;
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, "m");

  if (pattern.test(configContent)) {
    return configContent.replace(pattern, `${block}\n`);
  }

  const trimmed = configContent.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

async function readTextFileIfExists(uri: vscode.Uri) {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return "";
  }
}

async function upsertCodexProfiles(files: GeneratedInstallFile[]) {
  const codexAgents = files.filter((file) => CODEX_AGENT_PATH_PATTERN.test(file.logicalPath));
  if (codexAgents.length === 0) {
    return [] as string[];
  }

  const parsedAgents = codexAgents
    .map((file) => parseCodexAgent(file))
    .filter((agent): agent is ParsedCodexAgent => Boolean(agent));

  if (parsedAgents.length === 0) {
    return [] as string[];
  }

  const codexConfigUri = vscode.Uri.file(path.join(os.homedir(), ".codex", "config.toml"));
  const codexConfigDir = vscode.Uri.file(path.dirname(codexConfigUri.fsPath));
  await vscode.workspace.fs.createDirectory(codexConfigDir);

  let configContent = await readTextFileIfExists(codexConfigUri);
  for (const agent of parsedAgents) {
    configContent = upsertManagedCodexProfile(configContent, agent);
  }

  await vscode.workspace.fs.writeFile(codexConfigUri, Buffer.from(configContent, "utf8"));
  return parsedAgents.map((agent) => agent.profileName);
}

export async function installGeneratedFilesToRuntimeHome(files: GeneratedInstallFile[]) {
  const homeUri = vscode.Uri.file(os.homedir());
  const mappedFiles = files.map((file) => ({
    logicalPath: mapRuntimeLogicalPath(file.logicalPath),
    preview: file.preview,
  }));
  const writtenCount = await writeGeneratedFilesToWorkspace(mappedFiles, {
    confirmBeforeWrite: true,
    rootUri: homeUri,
    confirmationLabel: `${os.homedir()} and supported runtime config files`,
  });

  if (writtenCount === 0) {
    return null;
  }

  const codexProfiles = await upsertCodexProfiles(files);
  const codexAgents = files
    .filter((file) => CODEX_AGENT_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.basename(file.logicalPath, ".toml"));
  const claudeAgents = files
    .filter((file) => CLAUDE_AGENT_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.basename(file.logicalPath, ".md"));

  return {
    writtenCount,
    installRoot: os.homedir(),
    codexAgents,
    codexProfiles,
    claudeAgents,
  } satisfies RuntimeInstallSummary;
}