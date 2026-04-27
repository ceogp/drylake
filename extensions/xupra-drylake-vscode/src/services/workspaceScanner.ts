import * as vscode from "vscode";
import os from "node:os";
import path from "node:path";

import { readWorkspaceFile } from "../utils/files";
import type { DetectedWorkspaceFile } from "../types/package";

const PATTERNS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/**/SKILL.md",
  ".codex/agents/*.toml",
  ".claude/skills/**/SKILL.md",
  ".claude/agents/**/*.md",
  ".cursor/skills/**/SKILL.md",
  ".cursor/rules/**/*.mdc",
  "**/*.md",
  "**/*.py"
];

const EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage}/**";
const MAX_FILES_PER_GLOBAL_ROOT = 200;

const GLOBAL_SCAN_ROOTS = [
  {
    absolutePath: () => path.join(os.homedir(), ".codex", "agents"),
    logicalBase: ".codex/agents",
    matches: (relativePath: string) => /\.toml$/i.test(relativePath),
  },
  {
    absolutePath: () => path.join(os.homedir(), ".codex", "skills"),
    logicalBase: ".codex/skills",
    matches: (relativePath: string) => /(^|\/)SKILL\.md$/i.test(relativePath),
  },
  {
    absolutePath: () => path.join(os.homedir(), ".claude", "agents"),
    logicalBase: ".claude/agents",
    matches: (relativePath: string) => /\.md$/i.test(relativePath),
  },
  {
    absolutePath: () => path.join(os.homedir(), ".claude", "skills"),
    logicalBase: ".claude/skills",
    matches: (relativePath: string) => /(^|\/)SKILL\.md$/i.test(relativePath),
  },
  {
    absolutePath: () => path.join(os.homedir(), ".cursor", "skills"),
    logicalBase: ".cursor/skills",
    matches: (relativePath: string) => /(^|\/)SKILL\.md$/i.test(relativePath),
  },
  {
    absolutePath: () => path.join(os.homedir(), ".cursor", "rules"),
    logicalBase: ".cursor/rules",
    matches: (relativePath: string) => /\.mdc$/i.test(relativePath),
  },
] as const;

function getConfiguredPatterns(configuration?: vscode.WorkspaceConfiguration) {
  const configuredPatterns = configuration?.get<string[]>("additionalScanPatterns", []) ?? [];

  return [...new Set([...PATTERNS, ...configuredPatterns.map((pattern) => pattern.trim()).filter(Boolean)])];
}

export async function scanWorkspaceFiles(configuration?: vscode.WorkspaceConfiguration) {
  const seen = new Set<string>();
  const results: Array<{ logicalPath: string; content: string; category: DetectedWorkspaceFile["category"] }> = [];

  for (const pattern of getConfiguredPatterns(configuration)) {
    const files = await vscode.workspace.findFiles(pattern, EXCLUDE_PATTERN, 200);

    for (const file of files) {
      const logicalPath = vscode.workspace.asRelativePath(file, false).replace(/\\/g, "/");

      if (seen.has(logicalPath)) {
        continue;
      }

      seen.add(logicalPath);
      results.push({
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath)
      });
    }
  }

  if (configuration?.get<boolean>("includeGlobalAgentFiles", true) ?? true) {
    const globalFiles = await scanGlobalAgentFiles();

    for (const file of globalFiles) {
      if (seen.has(file.logicalPath)) {
        continue;
      }

      seen.add(file.logicalPath);
      results.push(file);
    }
  }

  return results;
}

async function scanGlobalAgentFiles() {
  const results: Array<{ logicalPath: string; content: string; category: DetectedWorkspaceFile["category"] }> = [];

  for (const root of GLOBAL_SCAN_ROOTS) {
    const rootUri = vscode.Uri.file(root.absolutePath());
    const files = await findGlobalFiles(rootUri, root.matches, MAX_FILES_PER_GLOBAL_ROOT);

    for (const file of files) {
      const relativePath = path.relative(rootUri.fsPath, file.fsPath).replace(/\\/g, "/");
      const logicalPath = `${root.logicalBase}/${relativePath}`;

      results.push({
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath),
      });
    }
  }

  return results;
}

async function findGlobalFiles(
  rootUri: vscode.Uri,
  matches: (relativePath: string) => boolean,
  limit: number,
) {
  const files: vscode.Uri[] = [];

  async function walk(currentUri: vscode.Uri) {
    if (files.length >= limit) {
      return;
    }

    let entries: [string, vscode.FileType][];

    try {
      entries = await vscode.workspace.fs.readDirectory(currentUri);
    } catch {
      return;
    }

    for (const [name, fileType] of entries) {
      if (files.length >= limit) {
        return;
      }

      const childUri = vscode.Uri.joinPath(currentUri, name);
      const relativePath = path.relative(rootUri.fsPath, childUri.fsPath).replace(/\\/g, "/");

      if (fileType === vscode.FileType.Directory) {
        await walk(childUri);
        continue;
      }

      if (fileType === vscode.FileType.File && matches(relativePath)) {
        files.push(childUri);
      }
    }
  }

  await walk(rootUri);
  return files;
}

export function getWorkspaceDisplayName() {
  return vscode.workspace.workspaceFolders?.[0]?.name ?? "No workspace";
}

export function classifyWorkspaceFile(logicalPath: string): DetectedWorkspaceFile["category"] {
  if (logicalPath === "AGENTS.md" || logicalPath === "CLAUDE.md") {
    return "instruction";
  }

  if (/\.codex\/agents\/.+\.toml$/i.test(logicalPath)) {
    return "agent_config";
  }

  if (/\/?\.claude\/agents\/.+\.md$/i.test(logicalPath)) {
    return "subagent";
  }

  if (/\/?\.cursor\/rules\/.+\.mdc$/i.test(logicalPath)) {
    return "rule";
  }

  if (/\/?(\.agents\/skills|\.codex\/skills|\.claude\/skills|\.cursor\/skills)\/.+\/SKILL\.md$/i.test(logicalPath)) {
    return "skill";
  }

  return "source";
}
