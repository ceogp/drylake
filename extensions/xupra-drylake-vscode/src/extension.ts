import * as vscode from "vscode";

import { checkCompatibilityCommand } from "./commands/checkCompatibility";
import { connectCommand } from "./commands/connect";
import { deployCommand } from "./commands/deploy";
import { exportPreviewCommand } from "./commands/exportPreview";
import { importDefaultLocationsCommand, importFolderCommand, importWorkspaceCommand } from "./commands/importWorkspace";
import { openWebAppCommand } from "./commands/openWebApp";
import { pullPackageCommand } from "./commands/pullPackage";
import { refreshProjectsCommand } from "./commands/refreshProjects";
import { ApiClient } from "./services/apiClient";
import { BrowserConnectCoordinator } from "./services/browserConnect";
import { selectPackageWithPrompt, selectProjectWithPrompt, selectVersionWithPrompt } from "./services/selection";
import { StateStore } from "./services/stateStore";
import { getWorkspaceDisplayName, scanWorkspaceFiles } from "./services/workspaceScanner";
import type { PackageVersionDetail } from "./types/api";
import type { ImportedWorkspaceSnapshot } from "./types/package";
import { HelpTreeProvider } from "./views/helpTreeProvider";
import { ProjectTreeItem, ProjectTreeProvider } from "./views/projectTreeProvider";
import { JobTreeProvider } from "./views/jobTreeProvider";
import { createStatusBar } from "./views/statusBar";
import { getLogger } from "./utils/logging";

const DEFAULT_BASE_URL = "https://drylake.xupracorp.com";
const LEGACY_BASE_URL_HOSTS = new Set(["52.196.86.96"]);
const SOURCE_PLATFORM_ALIASES: Record<string, string> = {
  claude: "claude_code",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function inferSourcePlatformFromPath(logicalPath?: string) {
  if (!logicalPath) {
    return "generic";
  }

  const normalized = logicalPath.replace(/\\/g, "/").toLowerCase();

  if (normalized === "claude.md" || normalized.startsWith(".claude/")) {
    return "claude_code";
  }

  if (normalized === "agents.md" || normalized.startsWith(".codex/") || normalized.startsWith(".agents/")) {
    return "codex";
  }

  if (normalized.startsWith(".cursor/")) {
    return "cursor";
  }

  return "generic";
}

function normalizeSourcePlatform(platform: unknown, sourcePath?: string) {
  if (typeof platform === "string" && platform.trim()) {
    const normalized = platform.trim().toLowerCase();
    return SOURCE_PLATFORM_ALIASES[normalized] ?? normalized;
  }

  return inferSourcePlatformFromPath(sourcePath);
}

function mapImportedWorkspace(version: PackageVersionDetail): ImportedWorkspaceSnapshot {
  return {
    versionId: version.id,
    files: (version.files ?? []).map((file) => ({
      id: file.id,
      logicalPath: file.logicalPath,
      kind: file.kind,
      sourceFormat: file.sourceFormat,
      sourcePlatform: inferSourcePlatformFromPath(file.logicalPath),
    })),
    subagents: (version.subagents ?? []).map((subagent) => {
      const metadata = asRecord(subagent.metadataJson);
      const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : undefined;
      return {
        id: subagent.id,
        name: subagent.name,
        slug: subagent.slug,
        sourcePlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath),
        sourcePath,
      };
    }),
    skillRules: (version.skillRules ?? []).map((rule) => {
      const metadata = asRecord(rule.metadataJson);
      const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : undefined;
      return {
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        sourcePlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath),
        sourcePath,
      };
    }),
  };
}

function isLegacyBaseUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return LEGACY_BASE_URL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

async function migrateLegacyBaseUrl(configuration: vscode.WorkspaceConfiguration) {
  const inspected = configuration.inspect<string>("baseUrl");

  if (!inspected) {
    return false;
  }

  let migrated = false;

  if (typeof inspected.globalValue === "string" && isLegacyBaseUrl(inspected.globalValue)) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL, vscode.ConfigurationTarget.Global);
    migrated = true;
  }

  if (typeof inspected.workspaceValue === "string" && isLegacyBaseUrl(inspected.workspaceValue)) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL, vscode.ConfigurationTarget.Workspace);
    migrated = true;
  }

  if (
    typeof inspected.workspaceFolderValue === "string" &&
    isLegacyBaseUrl(inspected.workspaceFolderValue) &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    await configuration.update("baseUrl", DEFAULT_BASE_URL, vscode.ConfigurationTarget.WorkspaceFolder);
    migrated = true;
  }

  if (migrated) {
    void vscode.window.showInformationMessage(
      `Xupra updated xupra.baseUrl to ${DEFAULT_BASE_URL} from a legacy IP value.`,
    );
  }

  return migrated;
}

export async function activate(context: vscode.ExtensionContext) {
  const WALKTHROUGH_STATE_KEY = "xupra.walkthroughOpened";
  let configuration = vscode.workspace.getConfiguration("xupra");
  const migratedBaseUrl = await migrateLegacyBaseUrl(configuration);
  if (migratedBaseUrl) {
    configuration = vscode.workspace.getConfiguration("xupra");
  }
  const apiClient = new ApiClient(configuration);
  const stateStore = new StateStore(context);
  const browserConnect = new BrowserConnectCoordinator(context, apiClient, stateStore);
  const projectsView = new ProjectTreeProvider();
  const jobsView = new JobTreeProvider();
  const helpView = new HelpTreeProvider();
  const logger = getLogger();
  const statusBar = createStatusBar();
  const storedAccessToken = await stateStore.getAccessToken();
  apiClient.setAccessToken(storedAccessToken);

  if (storedAccessToken) {
    try {
      const result = await apiClient.connect(undefined, undefined, storedAccessToken);
      await stateStore.setConnection({
        organizationId: result.organization?.id ?? result.auth.session.organizationId ?? undefined,
        organizationSlug: result.organization?.slug,
        userEmail: result.user?.email ?? undefined,
        authMode: result.auth.mode
      });
    } catch (error) {
      apiClient.setAccessToken(undefined);
      await stateStore.clearAccessToken();
      await stateStore.clearConnection();
      logger.error(`Stored Xupra extension token is no longer valid: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    await stateStore.clearConnection();
  }

  const syncContexts = async (input: {
    connected: boolean;
    hasDetectedFiles: boolean;
    hasProjects: boolean;
    hasVersionSelection: boolean;
  }) => {
    await vscode.commands.executeCommand("setContext", "xupra.connected", input.connected);
    await vscode.commands.executeCommand("setContext", "xupra.hasDetectedFiles", input.hasDetectedFiles);
    await vscode.commands.executeCommand("setContext", "xupra.hasProjects", input.hasProjects);
    await vscode.commands.executeCommand("setContext", "xupra.hasVersionSelection", input.hasVersionSelection);
  };

  const syncWorkspaceView = async (projects?: Awaited<ReturnType<typeof refreshProjectsCommand>>) => {
    const detectedFiles = stateStore.getDetectedFiles();
    const selection = stateStore.getSelection();
    const connection = stateStore.getConnection();
    const lastImport = stateStore.getLastImport();
    const projectList = projects ?? (await apiClient.listProjects()).projects;
    const selectedProject = projectList.find((project) => project.id === selection.projectId);
    const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === selection.packageId);
    const selectedVersion = selectedPackage?.versions.find((version) => version.id === selection.versionId);
    let importedWorkspace: ImportedWorkspaceSnapshot | null = null;
    let importedWorkspaceError: string | null = null;

    if (connection.userEmail && selection.versionId) {
      try {
        const versionResponse = await apiClient.getVersion(selection.versionId);
        importedWorkspace = mapImportedWorkspace(versionResponse.version);
      } catch (error) {
        importedWorkspaceError = error instanceof Error ? error.message : String(error);
        logger.error(
          `Failed to load imported workspace snapshot for ${selection.versionId}: ${importedWorkspaceError}`,
        );
      }
    }

    projectsView.setState({
      projects: projectList,
      detectedFiles,
      selection,
      connection,
      lastImport,
      importedWorkspace,
      importedWorkspaceError,
      workspaceName: getWorkspaceDisplayName(),
      defaultTargetPlatform: String(configuration.get("defaultTargetPlatform", "claude_code"))
    });

    statusBar.update({
      connected: Boolean(connection.userEmail),
      organizationSlug: connection.organizationSlug,
      versionLabel: selectedVersion ? `v${selectedVersion.versionNumber} ${selectedPackage?.name ?? ""}`.trim() : undefined
    });

    await syncContexts({
      connected: Boolean(connection.userEmail),
      hasDetectedFiles: detectedFiles.length > 0,
      hasProjects: projectList.length > 0,
      hasVersionSelection: Boolean(selection.versionId),
    });
  };

  context.subscriptions.push(statusBar);
  context.subscriptions.push(browserConnect.register());
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.projects", projectsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.jobs", jobsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.help", helpView));

  await syncContexts({
    connected: false,
    hasDetectedFiles: false,
    hasProjects: false,
    hasVersionSelection: false,
  });

  const register = (command: string, callback: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  register("xupra.openWalkthrough", async () => {
    await vscode.commands.executeCommand("workbench.action.openWalkthrough", `${context.extension.id}#xupra.getStarted`, false);
  });

  register("xupra.connect", async () => {
    await vscode.commands.executeCommand("xupra.projects.focus");
    const connected = await connectCommand(apiClient, configuration, stateStore, browserConnect);

    if (!connected) {
      return;
    }

    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    const projects = await refreshProjectsCommand(apiClient, projectsView);
    await syncWorkspaceView(projects);

    void vscode.window.showInformationMessage(
      files.length > 0
        ? `Connected. Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.`
        : "Connected. Xupra did not find supported files yet. Import can still check global folders, or you can add custom file patterns.",
    );

    if (configuration.get<boolean>("openDashboardAfterConnect", true)) {
      await openWebAppCommand(apiClient);
    }
  });

  register("xupra.pasteToken", async () => {
    await vscode.commands.executeCommand("xupra.projects.focus");

    const accessToken = await vscode.window.showInputBox({
      title: "Paste Xupra Extension Token",
      prompt: "Paste the token from the extension connect page.",
      ignoreFocusOut: true,
      password: true,
      validateInput(value) {
        return value.trim().length > 20 ? null : "Paste the full token from the website.";
      },
    });

    if (!accessToken) {
      return;
    }

    const trimmedToken = accessToken.trim();

    try {
      apiClient.setAccessToken(trimmedToken);
      const result = await apiClient.connect(undefined, undefined, trimmedToken);
      await stateStore.setAccessToken(trimmedToken);
      await stateStore.setConnection({
        organizationId: result.organization?.id ?? result.auth.session.organizationId ?? undefined,
        organizationSlug: result.organization?.slug,
        userEmail: result.user?.email ?? undefined,
        authMode: result.auth.mode
      });
      await stateStore.clearLastImport();

      if (!result.auth.configured) {
        void vscode.window.showWarningMessage(
          `Xupra DryLake auth is set to ${result.auth.mode}, but it still needs ${result.auth.pendingKeys.join(", ")}.`
        );
        await syncWorkspaceView();
        return;
      }

      const files = await scanWorkspaceFiles(configuration);
      await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
      const projects = await refreshProjectsCommand(apiClient, projectsView);
      await syncWorkspaceView(projects);

      void vscode.window.showInformationMessage(
        files.length > 0
          ? `Connected. Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.`
          : "Connected. Xupra did not find supported files yet. Import can still check global folders, or you can add custom file patterns.",
      );

      if (configuration.get<boolean>("openDashboardAfterConnect", true)) {
        await openWebAppCommand(apiClient);
      }
    } catch (error) {
      apiClient.setAccessToken(undefined);
      await stateStore.clearAccessToken();
      await stateStore.clearConnection();
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : "Failed to connect with extension token."
      );
      await syncWorkspaceView();
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

  register("xupra.importDefaultLocations", async () => {
    await importDefaultLocationsCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.importFolder", async () => {
    await importFolderCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.resetWorkspaceState", async () => {
    await stateStore.resetWorkspaceState();
    await syncWorkspaceView();
    void vscode.window.showInformationMessage(
      "Xupra workspace state reset. Your account connection is still active.",
    );
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
    await vscode.env.openExternal(apiClient.openWebUrl("/upload"));
  });

  register("xupra.openConnectPage", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  });

  register("xupra.openGetStarted", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/upload"));
  });

  try {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
    const projects = await refreshProjectsCommand(apiClient, projectsView);
    await syncWorkspaceView(projects);
  } catch (error) {
    logger.error(`Failed to load initial projects: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!context.globalState.get<boolean>(WALKTHROUGH_STATE_KEY)) {
    await context.globalState.update(WALKTHROUGH_STATE_KEY, true);
    await vscode.commands.executeCommand("xupra.projects.focus");
    await vscode.commands.executeCommand("workbench.action.openWalkthrough", `${context.extension.id}#xupra.getStarted`, false);
  }

  if (configuration.get<boolean>("autoScanOnOpen")) {
    void vscode.commands.executeCommand("xupra.importWorkspace");
  }
}

export function deactivate() {}
