import * as vscode from "vscode";
import * as path from "node:path";

function safeLogicalPath(rawPath: string) {
  const normalized = rawPath.replace(/\\/g, "/").split("/").filter(Boolean);

  if (path.posix.isAbsolute(rawPath) || normalized.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing to write generated file outside the workspace: ${rawPath}`);
  }

  return normalized;
}

export async function writeGeneratedFilesToWorkspace(
  files: Array<{ logicalPath: string; preview: string }>,
  options?: {
    confirmBeforeWrite?: boolean;
  }
) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!root) {
    throw new Error("No workspace folder is open.");
  }

  if (options?.confirmBeforeWrite) {
    const decision = await vscode.window.showWarningMessage(
      `Write ${files.length} generated file${files.length === 1 ? "" : "s"} into the current workspace?`,
      { modal: true },
      "Write Files"
    );

    if (decision !== "Write Files") {
      return 0;
    }
  }

  for (const file of files) {
    const pathSegments = safeLogicalPath(file.logicalPath);
    const target = vscode.Uri.joinPath(root, ...pathSegments);
    const directorySegments = path.posix
      .dirname(file.logicalPath)
      .split("/")
      .filter((segment) => Boolean(segment) && segment !== "." && segment !== "..");
    const directory =
      directorySegments.length > 0 ? vscode.Uri.joinPath(root, ...directorySegments) : root;
    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(target, Buffer.from(file.preview, "utf8"));
  }

  return files.length;
}
