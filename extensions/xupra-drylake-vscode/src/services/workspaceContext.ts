import * as vscode from "vscode";

const WORKSPACE_CONTEXT_ERROR =
  "Open a workspace folder or a file from your repo before starting a DryLake build session.";

function parentDirectory(uri: vscode.Uri) {
  const normalizedPath = uri.path.replace(/\/+$/, "");
  const lastSlash = normalizedPath.lastIndexOf("/");
  return uri.with({ path: lastSlash > 0 ? normalizedPath.slice(0, lastSlash) : "/" });
}

export function resolveWorkspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (root) {
    return root;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file") {
    return parentDirectory(activeUri);
  }

  throw new Error(WORKSPACE_CONTEXT_ERROR);
}

export function isWorkspaceContextError(error: unknown): error is Error {
  return error instanceof Error && error.message === WORKSPACE_CONTEXT_ERROR;
}
