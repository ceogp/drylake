import * as vscode from "vscode";

import { readWorkspaceFile } from "../utils/files";

const PATTERNS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/agents/**/*.md",
  ".cursor/rules/**/*.mdc",
  "**/*.md",
  "**/*.py"
];

const EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage}/**";

export async function scanWorkspaceFiles() {
  const seen = new Set<string>();
  const results: Array<{ logicalPath: string; content: string }> = [];

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
        content: await readWorkspaceFile(file)
      });
    }
  }

  return results;
}
