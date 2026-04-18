import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { StateStore } from "../services/stateStore";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function checkCompatibilityCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = stateStore.getSelection();

  if (!selection.versionId) {
    void vscode.window.showWarningMessage("Select a package version first.");
    return;
  }

  const targetPlatform = String(configuration.get("defaultTargetPlatform", "claude_code"));
  const result = await apiClient.checkCompatibility(selection.versionId, targetPlatform);

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Compatibility ${targetPlatform}`,
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  void vscode.window.showInformationMessage(`Compatibility check queued for ${targetPlatform}.`);
}
