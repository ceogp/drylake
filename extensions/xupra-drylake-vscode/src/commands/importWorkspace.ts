import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { uploadWorkspaceFiles } from "../services/fileUploader";
import { waitForTransformJob } from "../services/jobPoller";
import { ensureVersionSelection } from "../services/selection";
import { StateStore } from "../services/stateStore";
import { scanWorkspaceFiles } from "../services/workspaceScanner";
import { JobTreeProvider } from "../views/jobTreeProvider";

function asImportedCounts(rawValue: unknown) {
  const value = (rawValue && typeof rawValue === "object" ? rawValue : {}) as Record<string, unknown>;

  const asNumber = (next: unknown) => (typeof next === "number" && Number.isFinite(next) ? next : 0);
  const asBoolean = (next: unknown) => next === true;

  return {
    rawFiles: asNumber(value.rawFiles),
    subagents: asNumber(value.subagents),
    skills: asNumber(value.skills),
    rules: asNumber(value.rules),
    updatedInstructions: asBoolean(value.updatedInstructions),
  };
}

export async function importWorkspaceCommand(
  apiClient: ApiClient,
  stateStore: StateStore,
  jobsView: JobTreeProvider
) {
  const selection = await ensureVersionSelection(apiClient, stateStore);

  if (!selection?.versionId) {
    void vscode.window.showWarningMessage(
      "Import canceled because no import target was chosen.",
    );
    return;
  }

  const files = await scanWorkspaceFiles(vscode.workspace.getConfiguration("xupra"));
  await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));

  if (files.length === 0) {
    void vscode.window.showWarningMessage("No supported skills, agents, rules, or instruction files were found.");
    return;
  }

  const uploadResult = await uploadWorkspaceFiles(apiClient, selection.versionId, files);
  const result = await apiClient.importVersion(selection.versionId);
  const imported = asImportedCounts(result.imported);
  const warnings = result.warnings ?? [];

  jobsView.prepend({
    id: result.job.id,
    kind: "transform",
    title: "Workspace import",
    status: result.job.status,
    createdAt: new Date().toISOString()
  });

  const completed = await waitForTransformJob(apiClient, result.job.id);
  await stateStore.setLastImport({
    jobId: result.job.id,
    versionId: selection.versionId,
    status: completed.status,
    completedAt: new Date().toISOString(),
    imported,
    warnings,
    uploadedPaths: uploadResult.files.map((file) => file.logicalPath),
  });

  const warningSuffix = warnings.length > 0 ? ` Warning: ${warnings[0]}` : "";
  void vscode.window.showInformationMessage(
    `Imported ${imported.rawFiles || files.length} files, ${imported.skills} skills, ${imported.subagents} agents, ${imported.rules} rules. Status: ${completed.status}.${warningSuffix}`
  );
}
