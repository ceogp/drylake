import os from "node:os";
import path from "node:path";

import * as vscode from "vscode";

import { writeGeneratedFilesToWorkspace } from "./fileSync";

type GeneratedInstallFile = {
  logicalPath: string;
  preview: string;
  targetPlatform?: string;
};

export type RuntimeInstallSummary = {
  writtenCount: number;
  installRoot: string;
  codexAgents: string[];
  claudeAgents: string[];
  cursorRules: string[];
  cursorSkills: string[];
};

const CODEX_AGENT_PATH_PATTERN = /^\.codex\/agents\/.+\.toml$/i;
const CLAUDE_AGENT_PATH_PATTERN = /^\.claude\/agents\/.+\.md$/i;
const CURSOR_RULE_PATH_PATTERN = /^\.cursor\/rules\/.+\.mdc$/i;
const CURSOR_SKILL_PATH_PATTERN = /^\.cursor\/skills\/.+\/SKILL\.md$/i;

function inferTargetGroup(file: GeneratedInstallFile) {
  const targetPlatform = file.targetPlatform?.toLowerCase();
  const normalized = file.logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (targetPlatform === "codex" || normalized.startsWith(".codex/") || normalized.startsWith(".agents/")) {
    return "codex";
  }

  if (
    targetPlatform === "claude_code" ||
    targetPlatform === "claude_agents" ||
    normalized.startsWith(".claude/")
  ) {
    return "claude";
  }

  if (targetPlatform === "cursor" || normalized.startsWith(".cursor/")) {
    return "cursor";
  }

  if (normalized === "AGENTS.md") {
    return "codex";
  }

  if (normalized === "CLAUDE.md") {
    return "claude";
  }

  return null;
}

function mapRuntimeLogicalPath(file: GeneratedInstallFile) {
  const normalized = file.logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const targetGroup = inferTargetGroup(file);

  if (!targetGroup) {
    return null;
  }

  if (targetGroup === "codex") {
    if (normalized === "AGENTS.md") {
      return ".codex/AGENTS.md";
    }

    if (normalized.startsWith(".agents/skills/")) {
      return `.codex/skills/${normalized.slice(".agents/skills/".length)}`;
    }

    if (normalized.startsWith(".codex/")) {
      return normalized;
    }

    return null;
  }

  if (targetGroup === "claude") {
    if (normalized === "CLAUDE.md") {
      return ".claude/CLAUDE.md";
    }

    if (normalized.startsWith(".claude/")) {
      return normalized;
    }

    return null;
  }

  if (targetGroup === "cursor") {
    if (normalized.startsWith(".cursor/")) {
      return normalized;
    }

    return null;
  }

  return null;
}

export async function installGeneratedFilesToRuntimeHome(files: GeneratedInstallFile[]) {
  const homeUri = vscode.Uri.file(os.homedir());
  const mappedFiles = files.flatMap((file) => {
    const logicalPath = mapRuntimeLogicalPath(file);

    return logicalPath
      ? [
          {
            logicalPath,
            preview: file.preview,
          },
        ]
      : [];
  });

  if (mappedFiles.length === 0) {
    throw new Error("No generated files map to Codex, Claude, or Cursor runtime locations.");
  }

  const writtenCount = await writeGeneratedFilesToWorkspace(mappedFiles, {
    confirmBeforeWrite: true,
    rootUri: homeUri,
    confirmationLabel: `the default vendor runtime directories under ${os.homedir()} (.codex, .claude, .cursor)`,
  });

  if (writtenCount === 0) {
    return null;
  }

  const codexAgents = mappedFiles
    .filter((file) => CODEX_AGENT_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.basename(file.logicalPath, ".toml"));
  const claudeAgents = mappedFiles
    .filter((file) => CLAUDE_AGENT_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.basename(file.logicalPath, ".md"));
  const cursorRules = mappedFiles
    .filter((file) => CURSOR_RULE_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.basename(file.logicalPath, ".mdc"));
  const cursorSkills = mappedFiles
    .filter((file) => CURSOR_SKILL_PATH_PATTERN.test(file.logicalPath))
    .map((file) => path.posix.dirname(file.logicalPath).split("/").pop() ?? "skill");

  return {
    writtenCount,
    installRoot: os.homedir(),
    codexAgents,
    claudeAgents,
    cursorRules,
    cursorSkills,
  } satisfies RuntimeInstallSummary;
}
