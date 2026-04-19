import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { uploadWorkspaceFiles } from "../services/fileUploader";
import { waitForTransformJob } from "../services/jobPoller";
import { ensureVersionSelection } from "../services/selection";
import { StateStore } from "../services/stateStore";
import { scanWorkspaceFiles } from "../services/workspaceScanner";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function importWorkspaceCommand(
  apiClient: ApiClient,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = await ensureVersionSelection(apiClient, stateStore);

  if (!selection?.versionId) {
    return;
  }

  const files = await scanWorkspaceFiles(vscode.workspace.getConfiguration("xupra"));
  await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));

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

  const completed = await waitForTransformJob(apiClient, result.job.id);
  const warningSuffix = result.warnings.length > 0 ? ` ${result.warnings[0]}` : "";
  void vscode.window.showInformationMessage(
    `Imported ${files.length} files into the selected version. Status: ${completed.status}.${warningSuffix}`
  );
}
