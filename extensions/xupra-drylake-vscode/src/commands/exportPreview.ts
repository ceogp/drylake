import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import { StateStore } from "../services/stateStore";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function exportPreviewCommand(
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
  const result = await apiClient.exportPreview(selection.versionId, targetPlatform);

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Export ${targetPlatform}`,
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  if (configuration.get<boolean>("pullGeneratedFilesAfterExport") && result.generatedFiles?.length) {
    await writeGeneratedFilesToWorkspace(result.generatedFiles);
    void vscode.window.showInformationMessage(`Exported and wrote ${result.generatedFiles.length} files.`);
    return;
  }

  void vscode.window.showInformationMessage(`Export preview completed for ${targetPlatform}.`);
}
