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
import { selectPackageWithPrompt, selectProjectWithPrompt, selectVersionWithPrompt } from "./services/selection";
import { StateStore } from "./services/stateStore";
import { getWorkspaceDisplayName, scanWorkspaceFiles } from "./services/workspaceScanner";
import { HelpTreeProvider } from "./views/helpTreeProvider";
import { ProjectTreeItem, ProjectTreeProvider } from "./views/projectTreeProvider";
import { JobTreeProvider } from "./views/jobTreeProvider";
import { createStatusBar } from "./views/statusBar";
import { getLogger } from "./utils/logging";

export async function activate(context: vscode.ExtensionContext) {
  const configuration = vscode.workspace.getConfiguration("xupra");
  const apiClient = new ApiClient(configuration);
  const stateStore = new StateStore(context);
  apiClient.setAccessToken(await stateStore.getAccessToken());
  const projectsView = new ProjectTreeProvider();
  const jobsView = new JobTreeProvider();
  const helpView = new HelpTreeProvider();
  const logger = getLogger();
  const statusBar = createStatusBar();

  const syncWorkspaceView = async (projects?: Awaited<ReturnType<typeof refreshProjectsCommand>>) => {
    const detectedFiles = stateStore.getDetectedFiles();
    const selection = stateStore.getSelection();
    const connection = stateStore.getConnection();
    const projectList = projects ?? (await apiClient.listProjects()).projects;
    const selectedProject = projectList.find((project) => project.id === selection.projectId);
    const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === selection.packageId);
    const selectedVersion = selectedPackage?.versions.find((version) => version.id === selection.versionId);

    projectsView.setState({
      projects: projectList,
      detectedFiles,
      selection,
      connection,
      workspaceName: getWorkspaceDisplayName(),
      defaultTargetPlatform: String(configuration.get("defaultTargetPlatform", "claude_code"))
    });

    statusBar.update({
      connected: Boolean(connection.userEmail),
      organizationSlug: connection.organizationSlug,
      versionLabel: selectedVersion ? `v${selectedVersion.versionNumber} ${selectedPackage?.name ?? ""}`.trim() : undefined
    });
  };

  context.subscriptions.push(statusBar);
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.projects", projectsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.jobs", jobsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.help", helpView));

  const register = (command: string, callback: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  register("xupra.connect", async () => {
    await connectCommand(apiClient, configuration, stateStore);
    const projects = await refreshProjectsCommand(apiClient, projectsView);
    await syncWorkspaceView(projects);

    if (configuration.get<boolean>("openDashboardAfterConnect", true)) {
      await openWebAppCommand(apiClient);
    }
  });

  register("xupra.openWebApp", async () => {
    await openWebAppCommand(apiClient);
  });

  register("xupra.refreshProjects", async () => {
    const projects = await refreshProjectsCommand(apiClient, projectsView);
    await syncWorkspaceView(projects);
  });

  register("xupra.scanWorkspace", async () => {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    await syncWorkspaceView();
    void vscode.window.showInformationMessage(
      files.length > 0
        ? `Found ${files.length} supported workspace files for import.`
        : "No supported workspace files were found."
    );
  });

  register("xupra.importWorkspace", async () => {
    await importWorkspaceCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.checkCompatibility", async () => {
    await checkCompatibilityCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.exportPreview", async () => {
    await exportPreviewCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.deploy", async () => {
    await deployCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.pullPackage", async () => {
    await pullPackageCommand(apiClient, configuration, stateStore);
  });

  register("xupra.showRecentJobs", async () => {
    await vscode.commands.executeCommand("xupra.jobs.focus");
  });

  register("xupra.selectProject", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (item?.kind === "project") {
      await stateStore.setSelection({
        projectId: item.project.id,
        packageId: undefined,
        versionId: undefined
      });

      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected project ${item.project.name}.`);
      return;
    }

    const picked = await selectProjectWithPrompt(apiClient, stateStore);
    if (picked) {
      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected project ${picked.name}.`);
    }
  });

  register("xupra.selectPackage", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (item?.kind === "package") {
      await stateStore.setSelection({
        projectId: item.projectId,
        packageId: item.packageId,
        versionId: undefined
      });

      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected package ${item.name}.`);
      return;
    }

    const picked = await selectPackageWithPrompt(apiClient, stateStore);
    if (picked) {
      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected package ${picked.label}.`);
    }
  });

  register("xupra.selectVersion", async (...args: unknown[]) => {
    const item = args[0] as ProjectTreeItem | undefined;

    if (item?.kind === "version") {
      await stateStore.setSelection({
        projectId: item.projectId,
        packageId: item.packageId,
        versionId: item.versionId
      });

      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected ${item.label}.`);
      return;
    }

    const picked = await selectVersionWithPrompt(apiClient, stateStore);
    if (picked) {
      await syncWorkspaceView();
      void vscode.window.showInformationMessage(`Selected ${picked.label}.`);
    }
  });

  register("xupra.openSettings", async () => {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:xupra.xupra-drylake-vscode xupra"
    );
  });

  register("xupra.openAccountSettings", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/settings"));
  });

  register("xupra.openBilling", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/billing"));
  });

  register("xupra.openInstallGuide", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/install"));
  });

  register("xupra.openConnectPage", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  });

  register("xupra.openGetStarted", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/get-started"));
  });

  try {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    const projects = await refreshProjectsCommand(apiClient, projectsView);
    await syncWorkspaceView(projects);
  } catch (error) {
    logger.error(`Failed to load initial projects: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (configuration.get<boolean>("autoScanOnOpen")) {
    void vscode.commands.executeCommand("xupra.importWorkspace");
  }
}

export function deactivate() {}
