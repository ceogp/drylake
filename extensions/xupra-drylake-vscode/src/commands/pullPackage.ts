import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import { chooseTargetPlatform, ensureVersionSelection } from "../services/selection";
import { StateStore } from "../services/stateStore";

export async function pullPackageCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore
) {
  const selection = await ensureVersionSelection(apiClient, stateStore);

  if (!selection?.versionId) {
    return;
  }

  const picked = await chooseTargetPlatform(configuration, "Select export target to pull into the workspace");

  if (!picked) {
    return;
  }

  const result = await apiClient.listGeneratedExports(selection.versionId, picked.value, true);

  if (result.generatedFiles.length === 0) {
    void vscode.window.showWarningMessage(`No generated files are available for ${picked.label}.`);
    return;
  }

  const writtenCount = await writeGeneratedFilesToWorkspace(result.generatedFiles, {
    confirmBeforeWrite: configuration.get<boolean>("confirmBeforeWriteback", true)
  });
  void vscode.window.showInformationMessage(`Pulled ${writtenCount} ${picked.label} files into the workspace.`);
}
