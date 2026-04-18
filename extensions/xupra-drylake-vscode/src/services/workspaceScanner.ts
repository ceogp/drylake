import * as vscode from "vscode";

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

export async function scanWorkspaceFiles() {
  const seen = new Set<string>();
  const results: Array<{ logicalPath: string; content: string; category: DetectedWorkspaceFile["category"] }> = [];

  for (const pattern of PATTERNS) {
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

  return results;
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

  if (/SKILL\.md$/i.test(logicalPath)) {
    return "skill";
  }

  return "source";
}
