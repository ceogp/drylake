import * as vscode from "vscode";
import * as path from "node:path";

export async function writeGeneratedFilesToWorkspace(
  files: Array<{ logicalPath: string; preview: string }>
) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!root) {
    throw new Error("No workspace folder is open.");
  }

  for (const file of files) {
    const target = vscode.Uri.joinPath(root, ...file.logicalPath.split("/"));
    const directorySegments = path.posix
      .dirname(file.logicalPath)
      .split("/")
      .filter((segment) => Boolean(segment) && segment !== ".");
    const directory =
      directorySegments.length > 0 ? vscode.Uri.joinPath(root, ...directorySegments) : root;
    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(target, Buffer.from(file.preview, "utf8"));
  }
}
