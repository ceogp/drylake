import * as vscode from "vscode";
import os from "node:os";
import path from "node:path";

import { readWorkspaceFile } from "../utils/files";
import type { DetectedWorkspaceFile } from "../types/package";

const PATTERNS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/**/SKILL.md",
  ".codex/agents/**/*.toml",
  ".codex/skills/**/SKILL.md",
  ".claude/skills/**/SKILL.md",
  ".claude/agents/**/*.md",
  ".cursor/skills/**/SKILL.md",
  ".cursor/rules/**/*.mdc",
  "**/*.md",
  "**/*.py"
];

const EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage}/**";
const MAX_FILES_PER_GLOBAL_ROOT = 200;
const MAX_FILES_PER_SELECTED_FOLDER = 1000;
const EXCLUDED_FOLDER_NAMES = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage"]);

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

export async function scanDefaultLocationFiles() {
  return scanGlobalAgentFiles();
}

export async function scanSelectedFolderFiles(rootUri: vscode.Uri) {
  const files = await findSelectedFolderFiles(rootUri, MAX_FILES_PER_SELECTED_FOLDER);

  return Promise.all(
    files.map(async (file) => {
      const logicalPath = getLogicalPathForSelectedFolder(rootUri, file);

      return {
        logicalPath,
        content: await readWorkspaceFile(file),
        category: classifyWorkspaceFile(logicalPath),
      };
    }),
  );
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

async function findSelectedFolderFiles(rootUri: vscode.Uri, limit: number) {
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

      if (fileType === vscode.FileType.Directory && EXCLUDED_FOLDER_NAMES.has(name)) {
        continue;
      }

      const childUri = vscode.Uri.joinPath(currentUri, name);

      if (fileType === vscode.FileType.Directory) {
        await walk(childUri);
        continue;
      }

      if (fileType === vscode.FileType.File && isSupportedFolderImportFile(rootUri, childUri)) {
        files.push(childUri);
      }
    }
  }

  await walk(rootUri);
  return files;
}

function isSupportedFolderImportFile(rootUri: vscode.Uri, fileUri: vscode.Uri) {
  const logicalPath = getLogicalPathForSelectedFolder(rootUri, fileUri).toLowerCase();
  const baseName = path.posix.basename(logicalPath);

  if (logicalPath === "agents.md" || logicalPath === "claude.md") {
    return true;
  }

  if (baseName === "skill.md" && /(^|\/)(\.agents|\.codex|\.claude|\.cursor)?\/?skills\//i.test(logicalPath)) {
    return true;
  }

  if (/\.codex\/agents\/.+\.toml$/i.test(logicalPath)) {
    return true;
  }

  if (/\.claude\/agents\/.+\.md$/i.test(logicalPath)) {
    return true;
  }

  if (/\.cursor\/rules\/.+\.mdc$/i.test(logicalPath)) {
    return true;
  }

  return false;
}

function getLogicalPathForSelectedFolder(rootUri: vscode.Uri, fileUri: vscode.Uri) {
  const relativePath = path.relative(rootUri.fsPath, fileUri.fsPath).replace(/\\/g, "/");
  const rootParts = rootUri.fsPath.replace(/\\/g, "/").split("/").filter(Boolean);
  let hiddenRootIndex = -1;

  for (let index = rootParts.length - 1; index >= 0; index -= 1) {
    const part = rootParts[index];

    if (part === ".agents" || part === ".codex" || part === ".claude" || part === ".cursor") {
      hiddenRootIndex = index;
      break;
    }
  }

  if (hiddenRootIndex >= 0) {
    const prefix = rootParts.slice(hiddenRootIndex).join("/");
    return `${prefix}/${relativePath}`;
  }

  return relativePath;
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
