import * as path from "node:path";
import * as vscode from "vscode";

import type { PlannedGeneratedFile } from "./planGeneratedFiles";

function safePathSegments(logicalPath: string) {
  const normalized = logicalPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  if (path.posix.isAbsolute(normalized) || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing to write outside the workspace: ${logicalPath}`);
  }

  return segments;
}

async function writeUtf8(uri: vscode.Uri, content: string) {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

export async function writeGeneratedFiles(params: {
  rootUri: vscode.Uri;
  plan: PlannedGeneratedFile[];
  includeUnchanged?: boolean;
}) {
  let written = 0;
  let backups = 0;

  for (const item of params.plan) {
    if (item.status === "unchanged" && !params.includeUnchanged) {
      continue;
    }

    const segments = safePathSegments(item.logicalPath);
    const target = vscode.Uri.joinPath(params.rootUri, ...segments);
    const directorySegments = segments.slice(0, -1);
    const directory =
      directorySegments.length > 0
        ? vscode.Uri.joinPath(params.rootUri, ...directorySegments)
        : params.rootUri;
    await vscode.workspace.fs.createDirectory(directory);

    if (item.existingContent !== undefined && item.existingContent !== item.content) {
      await writeUtf8(target.with({ path: `${target.path}.drylake.bak` }), item.existingContent);
      backups += 1;
    }

    await writeUtf8(target, item.content);
    written += 1;
  }

  return { written, backups };
}

export async function readWorkspaceExisting(rootUri: vscode.Uri, logicalPath: string) {
  const segments = safePathSegments(logicalPath);
  const uri = vscode.Uri.joinPath(rootUri, ...segments);

  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

