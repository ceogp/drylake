import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { writeGeneratedFilesToWorkspace } from "../services/fileSync";
import { waitForTransformJob } from "../services/jobPoller";
import { chooseTargetPlatform, ensureVersionSelection } from "../services/selection";
import { StateStore } from "../services/stateStore";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function exportPreviewCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = await ensureVersionSelection(apiClient, stateStore);

  if (!selection?.versionId) {
    return;
  }

  const picked = await chooseTargetPlatform(configuration, "Select export target");

  if (!picked) {
    return;
  }

  const targetPlatform = picked.value;
  const result = await apiClient.exportPreview(selection.versionId, targetPlatform);

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Export ${targetPlatform}`,
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  const completed = await waitForTransformJob(apiClient, result.job.id);

  if (configuration.get<boolean>("pullGeneratedFilesAfterExport")) {
    const generated = result.generatedFiles?.length
      ? result.generatedFiles
      : (await apiClient.listGeneratedExports(selection.versionId, targetPlatform)).generatedFiles;

    if (generated.length === 0) {
      void vscode.window.showWarningMessage(`Export preview completed for ${picked.label}, but no generated files were available to write.`);
      return;
    }

    const writtenCount = await writeGeneratedFilesToWorkspace(generated, {
      confirmBeforeWrite: configuration.get<boolean>("confirmBeforeWriteback", true)
    });
    void vscode.window.showInformationMessage(`Exported ${picked.label} with status ${completed.status} and wrote ${writtenCount} files.`);
    return;
  }

  void vscode.window.showInformationMessage(`Export preview completed for ${picked.label} with status ${completed.status}.`);
}
