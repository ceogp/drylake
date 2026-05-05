import * as vscode from "vscode";

import { checkCompatibilityCommand } from "./commands/checkCompatibility";
import { connectCommand } from "./commands/connect";
import { deployCommand } from "./commands/deploy";
import { exportPreviewCommand } from "./commands/exportPreview";
import { importDefaultLocationsCommand, importFolderCommand, importWorkspaceCommand } from "./commands/importWorkspace";
import { openWebAppCommand } from "./commands/openWebApp";
import { pullPackageCommand } from "./commands/pullPackage";
import { refreshProjectsCommand } from "./commands/refreshProjects";
import { signOutCommand } from "./commands/signOut";
import { ApiClient } from "./services/apiClient";
import { BrowserConnectCoordinator } from "./services/browserConnect";
import { connectionStateFromExtensionConnection } from "./services/connectionState";
import { requireManualExportEntitlement } from "./services/featureGates";
import { ImportedSkillEditorManager } from "./services/importedSkillEditor";
import { MarketplaceClient } from "./services/marketplaceClient";
import { StateStore } from "./services/stateStore";
import { scanWorkspaceFiles } from "./services/workspaceScanner";
import type { PackageVersionDetail } from "./types/api";
import type { ImportedWorkspaceSnapshot } from "./types/package";
import { HelpTreeProvider } from "./views/helpTreeProvider";
import { HowItWorksPanel } from "./views/howItWorksPanel";
import { JobTreeProvider } from "./views/jobTreeProvider";
import { SkillCreationPanel } from "./views/skillCreationPanel";
import { SkillsMarketplacePanel } from "./views/skillsMarketplacePanel";
import { createStatusBar } from "./views/statusBar";
import { WorkspaceSidebarProvider } from "./views/workspaceSidebarProvider";
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

function formatTierLabel(tier: string | undefined): string {
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase() : "Free";
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

function stringifyFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .filter((item) => item !== undefined && item !== null)
      .map((item) => stringifyFrontmatterValue(item))
      .join(", ")}]`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '\\"')}"`;
}

type VersionSkillRule = NonNullable<PackageVersionDetail["skillRules"]>[number];

function stringifyFrontmatterMarkdown(frontmatter: Record<string, unknown>, body: string) {
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== undefined && value !== null);
  const trimmedBody = body.trim();

  if (entries.length === 0) {
    return trimmedBody;
  }

  return [
    "---",
    ...entries.map(([key, value]) => `${key}: ${stringifyFrontmatterValue(value)}`),
    "---",
    "",
    trimmedBody,
  ].join("\n");
}

function buildImportedSkillSourceContent(rule: VersionSkillRule) {
  const metadata = asRecord(rule.metadataJson);
  const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : undefined;
  const storedFrontmatter = asRecord(metadata?.frontmatter);
  const body = typeof rule.bodyMd === "string" ? rule.bodyMd : "";

  if (storedFrontmatter) {
    return stringifyFrontmatterMarkdown(storedFrontmatter, body);
  }

  const fallbackFrontmatter: Record<string, unknown> = {
    name: rule.name,
    targetPlatform: normalizeSourcePlatform(metadata?.sourcePlatform, sourcePath),
  };

  if (typeof metadata?.description === "string" && metadata.description.trim()) {
    fallbackFrontmatter.description = metadata.description;
  }

  return stringifyFrontmatterMarkdown(fallbackFrontmatter, body);
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
        sourceContent: buildImportedSkillSourceContent(rule),
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
  const marketplaceClient = new MarketplaceClient();
  const browserConnect = new BrowserConnectCoordinator(context, apiClient, stateStore);
  const workspaceSidebar = new WorkspaceSidebarProvider(stateStore, apiClient);
  const importedSkillEditor = new ImportedSkillEditorManager(context, apiClient, async () => {
    await syncWorkspaceView();
  });
  const jobsView = new JobTreeProvider();
  const helpView = new HelpTreeProvider();
  const logger = getLogger();
  const statusBar = createStatusBar();
  const storedAccessToken = await stateStore.getAccessToken();
  apiClient.setAccessToken(storedAccessToken);

  if (storedAccessToken) {
    try {
      const result = await apiClient.connect(undefined, undefined, storedAccessToken);
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
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
    let projectList = projects;

    if (!projectList) {
      if (connection.userEmail) {
        try {
          projectList = (await apiClient.listProjects()).projects;
        } catch (error) {
          logger.error(`Failed to list projects for sidebar sync: ${error instanceof Error ? error.message : String(error)}`);
          projectList = [];
        }
      } else {
        projectList = [];
      }
    }

    const selectedProject = projectList.find((project) => project.id === selection.projectId);
    const selectedPackage = selectedProject?.packages.find((agentPackage) => agentPackage.id === selection.packageId);
    const selectedVersion = selectedPackage?.versions.find((version) => version.id === selection.versionId);
    let importedWorkspace: ImportedWorkspaceSnapshot | null = null;

    if (connection.userEmail && selection.versionId) {
      try {
        const versionResponse = await apiClient.getVersion(selection.versionId);
        importedWorkspace = mapImportedWorkspace(versionResponse.version);
      } catch (error) {
        logger.error(
          `Failed to load imported workspace snapshot for ${selection.versionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    workspaceSidebar.postState({
      connected: Boolean(connection.userEmail),
      userEmail: connection.userEmail,
      userAvatarUrl: connection.userAvatarUrl,
      orgName: connection.organizationName,
      orgTier: connection.organizationTier,
      entitlements: connection.entitlements,
      detectedFiles,
      importedWorkspace,
      selection,
      isLoading: false,
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

  const refreshProjectsSafely = async (reason: string) => {
    try {
      return await refreshProjectsCommand(apiClient);
    } catch (error) {
      logger.error(`Failed to refresh projects during ${reason}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };

  context.subscriptions.push(statusBar);
  context.subscriptions.push(browserConnect.register());
  context.subscriptions.push(importedSkillEditor);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("xupra.projects", workspaceSidebar, {
    webviewOptions: { retainContextWhenHidden: true }
  }));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.jobs", jobsView));
  context.subscriptions.push(vscode.window.registerTreeDataProvider("xupra.help", helpView));

  let isRefreshingPlan = false;

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(async (windowState) => {
      if (!windowState.focused) {
        return;
      }

      const storedToken = await stateStore.getAccessToken();

      if (!storedToken) {
        return;
      }

      const awaitingUntil = stateStore.getAwaitingPlanRefreshUntil();

      if (awaitingUntil && Date.now() < new Date(awaitingUntil).getTime()) {
        if (isRefreshingPlan) {
          return;
        }

        isRefreshingPlan = true;

        try {
          try {
            const result = await apiClient.connect(undefined, undefined, storedToken);
            const newConnection = connectionStateFromExtensionConnection(result);
            await stateStore.setConnection(newConnection);
            const tier = newConnection.organizationTier?.toLowerCase();

            if (tier === "pro" || tier === "enterprise") {
              await stateStore.setAwaitingPlanRefreshUntil(null);
              await syncWorkspaceView();
              return;
            }
          } catch {
            // Background refresh failures are intentionally silent.
          }

          for (const delay of [5_000, 15_000, 30_000]) {
            await new Promise((resolve) => setTimeout(resolve, delay));

            try {
              const result = await apiClient.connect(undefined, undefined, storedToken);
              const newConnection = connectionStateFromExtensionConnection(result);
              await stateStore.setConnection(newConnection);
              const tier = newConnection.organizationTier?.toLowerCase();

              if (tier === "pro" || tier === "enterprise") {
                await stateStore.setAwaitingPlanRefreshUntil(null);
                await syncWorkspaceView();
                return;
              }
            } catch {
              // Background refresh failures are intentionally silent.
            }
          }

          return;
        } finally {
          isRefreshingPlan = false;
        }
      }

      try {
        const result = await apiClient.connect(undefined, undefined, storedToken);
        const newConnection = connectionStateFromExtensionConnection(result);
        await stateStore.setConnection(newConnection);
        await syncWorkspaceView();
      } catch {
        // Background refresh failures are intentionally silent.
      }
    }),
  );

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
    const projects = await refreshProjectsSafely("connect");
    await syncWorkspaceView(projects);
    const connection = stateStore.getConnection();

    void vscode.window.showInformationMessage(
      `Connected as ${connection.userEmail} (${formatTierLabel(connection.organizationTier)} plan).${
        files.length > 0
          ? ` Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.`
          : " No supported files found yet. Import can still check global folders, or you can add custom file patterns."
      }`,
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
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
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
      const projects = await refreshProjectsSafely("token paste");
      await syncWorkspaceView(projects);
      const connection = stateStore.getConnection();

      void vscode.window.showInformationMessage(
        `Connected as ${connection.userEmail} (${formatTierLabel(connection.organizationTier)} plan).${
          files.length > 0
            ? ` Xupra found ${files.length} supported file${files.length === 1 ? "" : "s"} on this machine.`
            : " No supported files found yet. Import can still check global folders, or you can add custom file patterns."
        }`,
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

  register("xupra.refreshPlan", async () => {
    const storedToken = await stateStore.getAccessToken();

    if (!storedToken) {
      void vscode.window.showInformationMessage("Not connected");
      return;
    }

    const result = await apiClient.connect(undefined, undefined, storedToken);
    const newConnection = connectionStateFromExtensionConnection(result);
    await stateStore.setConnection(newConnection);
    const tier = newConnection.organizationTier?.toLowerCase();

    if (tier === "pro" || tier === "enterprise") {
      await stateStore.setAwaitingPlanRefreshUntil(null);
    }

    await syncWorkspaceView();
  });

  register("xupra.refreshProjects", async () => {
    const projects = await refreshProjectsSafely("manual refresh");
    await syncWorkspaceView(projects);
  });

  register("xupra.signOut", async () => {
    const signedOut = await signOutCommand(apiClient, stateStore);

    if (signedOut) {
      await syncWorkspaceView([]);
    }
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
    const hasEntitlement = await requireManualExportEntitlement(apiClient, stateStore, "Export Preview");
    if (!hasEntitlement) {
      return;
    }

    await exportPreviewCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.deploy", async () => {
    const hasEntitlement = await requireManualExportEntitlement(apiClient, stateStore, "Deploy");
    if (!hasEntitlement) {
      return;
    }

    await deployCommand(apiClient, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.pullPackage", async () => {
    await pullPackageCommand(apiClient, configuration, stateStore);
  });

  register("xupra.showRecentJobs", async () => {
    await vscode.commands.executeCommand("xupra.jobs.focus");
  });

  register("xupra.createSkill", () => {
    SkillCreationPanel.createOrShow(context, apiClient, stateStore, configuration);
  });

  register("xupra.browseSkills", async () => {
    SkillsMarketplacePanel.createOrShow(context, marketplaceClient, apiClient, stateStore);
  });

  register("xupra.openImportedSkill", async (...args: unknown[]) => {
    const skillRuleId = typeof args[0] === "string" ? args[0] : undefined;
    const selection = stateStore.getSelection();

    if (!selection.versionId || typeof skillRuleId !== "string" || !skillRuleId.trim()) {
      return;
    }

    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const skill = importedWorkspace.skillRules.find(
      (item) => item.id === skillRuleId && String(item.kind).toLowerCase() === "skill",
    );

    if (!skill) {
      void vscode.window.showWarningMessage("That imported skill is no longer available for the selected version.");
      return;
    }

    await importedSkillEditor.openImportedSkill(selection.versionId, skill);
  });

  register("xupra.openSettings", async () => {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:xupra.drylake xupra"
    );
  });

  register("xupra.openAccountSettings", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/settings"));
  });

  register("xupra.openBilling", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/billing?source=extension"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 120_000).toISOString());
  });

  register("xupra.contactSupport", async () => {
    await vscode.env.openExternal(vscode.Uri.parse("mailto:support@xupracorp.com"));
  });

  register("xupra.openHowItWorks", () => {
    HowItWorksPanel.createOrShow(context, "workflow");
  });

  register("xupra.openSupportedTargets", () => {
    HowItWorksPanel.createOrShow(context, "targets");
  });

  register("xupra.openInstallGuide", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/install"));
  });

  register("xupra.openConnectPage", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  });

  register("xupra.openGetStarted", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/app"));
  });

  try {
    const files = await scanWorkspaceFiles(configuration);
    await stateStore.setDetectedFiles(files.map(({ logicalPath, category }) => ({ logicalPath, category })));
  } catch (error) {
    logger.error(`Failed to scan initial workspace files: ${error instanceof Error ? error.message : String(error)}`);
  }

  const startupToken = await stateStore.getAccessToken();

  if (startupToken) {
    try {
      apiClient.setAccessToken(startupToken);
      const result = await apiClient.connect(undefined, undefined, startupToken);
      await stateStore.setConnection(connectionStateFromExtensionConnection(result));
    } catch (error) {
      logger.error(`Failed to refresh connection during startup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const initialProjects = stateStore.getConnection().userEmail ? await refreshProjectsSafely("startup") : [];
  await syncWorkspaceView(initialProjects);

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
