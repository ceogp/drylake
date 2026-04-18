import * as vscode from "vscode";

import { checkCompatibilityCommand } from "./commands/checkCompatibility";
import { connectCommand } from "./commands/connect";
import { deployCommand } from "./commands/deploy";
import { exportPreviewCommand } from "./commands/exportPreview";
import { importWorkspaceCommand } from "./commands/importWorkspace";
import { openWebAppCommand } from "./commands/openWebApp";
import { pullPackageCommand } from "./commands/pullPackage";
import { refreshProjectsCommand } from "./commands/refreshProjects";
import { ApiClient } from "./services/apiClient";
import { StateStore } from "./services/stateStore";
import { scanWorkspaceFiles } from "./services/workspaceScanner";
import { ProjectTreeItem, ProjectTreeProvider } from "./views/projectTreeProvider";
import { JobTreeProvider } from "./views/jobTreeProvider";
import { createStatusBar } from "./views/statusBar";
import { getLogger } from "./utils/logging";

export async function activate(context: vscode.ExtensionContext) {
  const configuration = vscode.workspace.getConfiguration("xupra");
  const apiClient = new ApiClient(configuration);
  const stateStore = new StateStore(context);
  const projectsView = new ProjectTreeProvider();
  const jobsView = new JobTreeProvider();
  const logger = getLogger();

  context.subscriptions.push(createStatusBar());
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.projects", projectsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.jobs", jobsView));

  const register = (command: string, callback: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  register("xupra.connect", async () => {
    await connectCommand(apiClient, configuration, stateStore);
    await refreshProjectsCommand(apiClient, projectsView);
  });

  register("xupra.openWebApp", async () => {
    await openWebAppCommand(apiClient);
  });

  register("xupra.refreshProjects", async () => {
    await refreshProjectsCommand(apiClient, projectsView);
  });

  register("xupra.scanWorkspace", async () => {
    const files = await scanWorkspaceFiles();
    void vscode.window.showInformationMessage(
      files.length > 0
        ? `Found ${files.length} supported workspace files for import.`
        : "No supported workspace files were found."
    );
  });

  register("xupra.importWorkspace", async () => {
    await importWorkspaceCommand(apiClient, stateStore, jobsView);
  });

  register("xupra.checkCompatibility", async () => {
    await checkCompatibilityCommand(apiClient, configuration, stateStore, jobsView);
  });

  register("xupra.exportPreview", async () => {
    await exportPreviewCommand(apiClient, configuration, stateStore, jobsView);
  });

  register("xupra.deploy", async () => {
    await deployCommand(apiClient, stateStore, jobsView);
  });

  register("xupra.pullPackage", async () => {
    await pullPackageCommand(apiClient, configuration, stateStore);
  });

  register("xupra.showRecentJobs", async () => {
    await vscode.commands.executeCommand("xupra.jobs.focus");
  });

  register("xupra.selectProject", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (!item || item.kind !== "project") {
      return;
    }

    await stateStore.setSelection({
      projectId: item.project.id,
      packageId: undefined,
      versionId: undefined
    });

    void vscode.window.showInformationMessage(`Selected project ${item.project.name}.`);
  });

  register("xupra.selectPackage", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (!item || item.kind !== "package") {
      return;
    }

    await stateStore.setSelection({
      projectId: item.projectId,
      packageId: item.packageId,
      versionId: undefined
    });

    void vscode.window.showInformationMessage(`Selected package ${item.name}.`);
  });

  register("xupra.selectVersion", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (!item || item.kind !== "version") {
      return;
    }

    await stateStore.setSelection({
      projectId: item.projectId,
      packageId: item.packageId,
      versionId: item.versionId
    });

    void vscode.window.showInformationMessage(`Selected ${item.label}.`);
  });

  try {
    await refreshProjectsCommand(apiClient, projectsView);
  } catch (error) {
    logger.error(`Failed to load initial projects: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (configuration.get<boolean>("autoScanOnOpen")) {
    void vscode.commands.executeCommand("xupra.importWorkspace");
  }
}

export function deactivate() {}
