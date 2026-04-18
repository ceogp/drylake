import * as vscode from "vscode";

export async function readWorkspaceFile(uri: vscode.Uri) {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}
