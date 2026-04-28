import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { waitForTransformJob } from "../services/jobPoller";
import { chooseTargetPlatform, ensureVersionSelection } from "../services/selection";
import { StateStore } from "../services/stateStore";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function checkCompatibilityCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = await ensureVersionSelection(apiClient, stateStore);

  if (!selection?.versionId) {
    return;
  }

  const picked = await chooseTargetPlatform(configuration, "Select target platform for compatibility");

  if (!picked) {
    return;
  }

  const targetPlatform = picked.value;
  const result = await apiClient.checkCompatibility(selection.versionId, targetPlatform);

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: `Compatibility ${targetPlatform}`,
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  const completed = await waitForTransformJob(apiClient, result.job.id);
  void vscode.window.showInformationMessage(`Compatibility check finished for ${picked.label} with status ${completed.status}.`);
}
