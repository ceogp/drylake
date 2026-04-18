import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import { StateStore } from "../services/stateStore";

export async function pullPackageCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore
) {
  const selection = stateStore.getSelection();

  if (!selection.versionId) {
    void vscode.window.showWarningMessage("Select a package version first.");
    return;
  }

  const defaultTargetPlatform = String(configuration.get("defaultTargetPlatform", "claude_code"));
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Codex", value: "codex" },
      { label: "Claude Code", value: "claude_code" },
      { label: "Claude Agents", value: "claude_agents" },
      { label: "Cursor", value: "cursor" }
    ],
    {
      title: "Select export target to pull into the workspace",
      placeHolder: defaultTargetPlatform
    }
  );

  if (!picked) {
    return;
  }

  const result = await apiClient.listGeneratedExports(selection.versionId, picked.value, true);

  if (result.generatedFiles.length === 0) {
    void vscode.window.showWarningMessage(`No generated files are available for ${picked.label}.`);
    return;
  }

  await writeGeneratedFilesToWorkspace(result.generatedFiles);
  void vscode.window.showInformationMessage(`Pulled ${result.generatedFiles.length} ${picked.label} files into the workspace.`);
}
