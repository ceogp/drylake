import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { uploadWorkspaceFiles } from "../services/fileUploader";
import { StateStore } from "../services/stateStore";
import { scanWorkspaceFiles } from "../services/workspaceScanner";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function importWorkspaceCommand(
  apiClient: ApiClient,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = stateStore.getSelection();

  if (!selection.versionId) {
    void vscode.window.showWarningMessage("Select a package version first.");
    return;
  }

  const files = await scanWorkspaceFiles();

  if (files.length === 0) {
    void vscode.window.showWarningMessage("No supported workspace files were found.");
    return;
  }

  await uploadWorkspaceFiles(apiClient, selection.versionId, files);
  const result = await apiClient.importVersion(selection.versionId);

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: "Workspace import",
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  const warningSuffix = result.warnings.length > 0 ? ` ${result.warnings[0]}` : "";
  void vscode.window.showInformationMessage(
    `Imported ${files.length} files into the selected version.${warningSuffix}`
  );
}
