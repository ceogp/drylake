import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { waitForDeploymentJob } from "../services/jobPoller";
import { StateStore } from "../services/stateStore";
import { JobTreeProvider } from "../views/jobTreeProvider";

export async function deployCommand(
  apiClient: ApiClient,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = stateStore.getSelection();

  if (!selection.projectId || !selection.versionId) {
    void vscode.window.showWarningMessage("Select a project and package version first.");
    return;
  }

  const targets = await apiClient.listDeploymentTargets(selection.projectId);

  if (targets.deploymentTargets.length === 0) {
    void vscode.window.showWarningMessage("No deployment targets are configured for this project.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    targets.deploymentTargets.map((target) => ({
      label: target.name,
      description: `${target.platform} · ${target.deliveryMode}`,
      target
    })),
    {
      title: "Select deployment target"
    }
  );

  if (!picked) {
    return;
  }

  const result = await apiClient.deploy(selection.versionId, picked.target.id);

  jobsView.prepend({
    id: result.job.id,
    kind: "deployment",
    title: `Deploy ${picked.target.name}`,
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  const completed = await waitForDeploymentJob(apiClient, result.job.id);
  void vscode.window.showInformationMessage(`Deployment ${completed.id} finished with status ${completed.status}.`);
}
