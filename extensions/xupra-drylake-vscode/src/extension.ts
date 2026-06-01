import * as vscode from "vscode";

import { checkCompatibilityCommand } from "./commands/checkCompatibility";
import { connectCommand } from "./commands/connect";
import { exportPreviewCommand } from "./commands/exportPreview";
import { importDefaultLocationsCommand, importFolderCommand, importWorkspaceCommand } from "./commands/importWorkspace";
import { openWebAppCommand } from "./commands/openWebApp";
import { pullPackageCommand } from "./commands/pullPackage";
import { refreshProjectsCommand } from "./commands/refreshProjects";
import {
  approveArchitectureCommand,
  approvePlanChangeCommand,
  approvePurposeCommand,
  archiveCurrentPlanCommand,
  chatSendMessageCommand,
  clearChatCommand,
  deleteCurrentPlanCommand,
  exportHandoffPromptCommand,
  generateAgentFilesCommand,
  generateDraftRunbookCommand,
  handoffPhaseCommand,
  newSessionCommand,
  openControlRoomCommand,
  openSessionsCommand,
  previewProvisioningPlanCommand,
  rejectPlanChangeCommand,
  reorderPhaseCommand,
  runNextPhaseCommand,
  startBuildSessionCommand,
  toggleAutopilotCommand,
  toggleStepCommand,
  updatePhaseAgentCommand,
  updatePhaseHandoffProfileCommand,
  updatePhaseStatusCommand,
  validateXuRunbookCommand,
} from "./commands/runbooks";
import { signOutCommand } from "./commands/signOut";
import { ApiClient } from "./services/apiClient";
import { BrowserConnectCoordinator } from "./services/browserConnect";
import { connectionStateFromExtensionConnection } from "./services/connectionState";
import { requireXupraProAiEntitlement } from "./services/featureGates";
import { ImportedSkillEditorManager } from "./services/importedSkillEditor";
import {
  collectRepoContext,
  inferTargetPlatformFromUri,
  pickTargetPlatform,
  ImportedContentProvider,
  OptimizationContentProvider,
} from "./services/optimization";
import { installGeneratedFilesToRuntimeHome } from "./services/runtimeInstall";
import { StateStore } from "./services/stateStore";
import { scanWorkspaceFiles } from "./services/workspaceScanner";
import type { PackageVersionDetail } from "./types/api";
import type { ImportedWorkspaceSnapshot } from "./types/package";
import { HelpTreeProvider } from "./views/helpTreeProvider";
import { HowItWorksPanel } from "./views/howItWorksPanel";
import { JobTreeProvider } from "./views/jobTreeProvider";
import { SkillCreationPanel } from "./views/skillCreationPanel";
import { createStatusBar } from "./views/statusBar";
import { WorkspaceSidebarProvider } from "./views/workspaceSidebarProvider";
import { ControlRoomProvider } from "./webview/controlRoomProvider";
import { MultiAgentRunnerProvider } from "./webview/multiAgentRunnerProvider";
import { openPhaseAgentSetupReport } from "./agents/phaseAgentLauncher";
import { renderPhasePrompt } from "./generators/renderPhasePrompt";
import { getLogger } from "./utils/logging";
import { XuSessionStore } from "./xu/sessionStore";

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

  if (normalized.startsWith(".windsurf/")) {
    return "windsurf";
  }

  if (normalized === ".clinerules" || normalized.startsWith(".clinerules/")) {
    return "cline";
  }

  if (normalized === ".roorules" || normalized.startsWith(".roo/")) {
    return "roo";
  }

  if (normalized === ".github/copilot-instructions.md" || normalized.startsWith(".github/instructions/")) {
    return "copilot";
  }

  if (normalized === "gemini.md") {
    return "gemini";
  }

  if (normalized === ".junie/guidelines.md") {
    return "junie";
  }

  if (normalized === "warp.md") {
    return "warp";
  }

  if (normalized === ".rules") {
    return "generic";
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
type VersionSubagent = NonNullable<PackageVersionDetail["subagents"]>[number];

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

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringifyCodexAgentToml(subagent: VersionSubagent) {
  const metadata = asRecord(subagent.metadataJson);
  const tools = readStringArray(subagent.toolsJson);
  const instructions = subagent.instructionsMd.replace(/"""/g, '\\"\\"\\"');
  const model =
    typeof metadata?.model === "string" && metadata.model.trim()
      ? metadata.model
      : subagent.modelHint ?? undefined;
  const reasoning =
    typeof metadata?.modelReasoningEffort === "string" && metadata.modelReasoningEffort.trim()
      ? metadata.modelReasoningEffort
      : undefined;
  const sandbox =
    typeof metadata?.sandboxMode === "string" && metadata.sandboxMode.trim()
      ? metadata.sandboxMode
      : subagent.permissionMode ?? undefined;

  return [
    `name = "${subagent.slug.replace(/"/g, '\\"')}"`,
    `description = "${subagent.description.replace(/"/g, '\\"')}"`,
    `developer_instructions = """${instructions}"""`,
    `tools = [${tools.map((tool) => `"${tool.replace(/"/g, '\\"')}"`).join(", ")}]`,
    model ? `model = "${model.replace(/"/g, '\\"')}"` : "",
    reasoning ? `model_reasoning_effort = "${reasoning.replace(/"/g, '\\"')}"` : "",
    sandbox ? `sandbox_mode = "${sandbox.replace(/"/g, '\\"')}"` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildImportedAgentSourceContent(subagent: VersionSubagent) {
  const metadata = asRecord(subagent.metadataJson);
  const sourcePath = typeof metadata?.sourcePath === "string" ? metadata.sourcePath : undefined;

  if (sourcePath?.toLowerCase().endsWith(".toml")) {
    return stringifyCodexAgentToml(subagent);
  }

  const storedFrontmatter = asRecord(metadata?.frontmatter);

  return stringifyFrontmatterMarkdown(
    {
      ...(storedFrontmatter ?? {}),
      name:
        typeof storedFrontmatter?.name === "string" && storedFrontmatter.name.trim()
          ? storedFrontmatter.name
          : subagent.slug,
      description:
        typeof storedFrontmatter?.description === "string" && storedFrontmatter.description.trim()
          ? storedFrontmatter.description
          : subagent.description,
      tools:
        storedFrontmatter?.tools ??
        (readStringArray(subagent.toolsJson).length > 0 ? readStringArray(subagent.toolsJson) : undefined),
      model:
        typeof storedFrontmatter?.model === "string" && storedFrontmatter.model.trim()
          ? storedFrontmatter.model
          : subagent.modelHint ?? undefined,
      permissionMode:
        typeof storedFrontmatter?.permissionMode === "string" && storedFrontmatter.permissionMode.trim()
          ? storedFrontmatter.permissionMode
          : subagent.permissionMode ?? undefined,
    },
    subagent.instructionsMd,
  );
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
        sourceContent: buildImportedAgentSourceContent(subagent),
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
  let configuration = vscode.workspace.getConfiguration("xupra");
  const migratedBaseUrl = await migrateLegacyBaseUrl(configuration);
  if (migratedBaseUrl) {
    configuration = vscode.workspace.getConfiguration("xupra");
  }
  const apiClient = new ApiClient(configuration);
  const stateStore = new StateStore(context);
  const xuSessionStore = new XuSessionStore();
  const multiAgentRunner = new MultiAgentRunnerProvider(apiClient);
  const controlRoom = new ControlRoomProvider(
    xuSessionStore,
    () => stateStore.getPlanningProvider(),
    () => stateStore.getChatHistory(),
    () => stateStore.getLastModelTier(),
    () => stateStore.getPlanningLoading(),
    () => stateStore.getConnection(),
  );
  const browserConnect = new BrowserConnectCoordinator(context, apiClient, stateStore);
  const workspaceSidebar = new WorkspaceSidebarProvider(stateStore, apiClient);
  const importedSkillEditor = new ImportedSkillEditorManager(context, apiClient, async () => {
    await syncWorkspaceView();
  });
  const optimizationContentProvider = new OptimizationContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      OptimizationContentProvider.scheme,
      optimizationContentProvider,
    ),
  );
  const importedContentProvider = new ImportedContentProvider(async (versionId, logicalPath) => {
    const result = await apiClient.fetchVersionFile(versionId, logicalPath);
    return result.content ?? "";
  });
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      ImportedContentProvider.scheme,
      importedContentProvider,
    ),
  );
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

    let currentRunbookPath: string | undefined;
    let currentPhase: string | undefined;
    let currentRunbookName: string | undefined;
    let currentRunbookStatus: string | undefined;
    let activePhaseId: string | undefined;
    let activePhaseTitle: string | undefined;
    let activePhaseAgent: string | undefined;
    let approvalStatus = "No plan";
    try {
      const currentRunbook = await xuSessionStore.readRunbook();
      if (currentRunbook) {
        currentRunbookPath = vscode.workspace.asRelativePath(currentRunbook.uri, false).replace(/\\/g, "/");
        currentRunbookName = currentRunbook.runbook.metadata.name;
        currentRunbookStatus = currentRunbook.runbook.metadata.status;
        const activeSummary = stateStore.getActivePhaseSummary(currentRunbook.runbook);
        activePhaseId = activeSummary?.phaseId;
        activePhaseTitle = activeSummary?.phaseTitle;
        activePhaseAgent = activeSummary?.agent ?? currentRunbook.runbook.handoff.defaultAgent;
        currentPhase = activePhaseTitle;
        approvalStatus = [
          currentRunbook.runbook.confirmation.userApprovedIntent ? "Purpose approved" : "Purpose pending",
          currentRunbook.runbook.confirmation.userApprovedArchitecture ? "Architecture approved" : "Architecture pending",
        ].join(" / ");
      }
    } catch {
      const currentRunbookUri = await xuSessionStore.findRunbookUri().catch(() => null);
      currentRunbookPath = currentRunbookUri
        ? vscode.workspace.asRelativePath(currentRunbookUri, false).replace(/\\/g, "/")
        : undefined;
      currentRunbookName = currentRunbookPath ? "Plan needs repair" : undefined;
      currentRunbookStatus = currentRunbookPath ? "needs repair" : undefined;
      approvalStatus = "Plan has diagnostics";
    }

    const currentSession = stateStore.getBuildSession();

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
      runbook: {
        sessionName: currentRunbookName ?? currentSession?.id,
        path: currentRunbookPath,
        status: currentRunbookStatus,
        phase: currentPhase,
        activePhaseId,
        activePhaseTitle,
        activePhaseAgent,
        approvalStatus,
        providerStatus: currentSession?.providerLabel ?? "Xupra AI",
        generatedFiles: [
          "Plan summary",
          "phase prompts",
          "AGENTS.md",
          "CLAUDE.md",
          "Copilot instructions",
          "Cursor rules",
          "Agent skills",
        ],
      },
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

  const runbookDeps = {
    apiClient,
    stateStore,
    sessionStore: xuSessionStore,
    controlRoom,
    refreshSidebar: async () => {
      await syncWorkspaceView();
    },
  };

  const openMultiAgentForPhase = async (phaseId?: string) => {
    const current = await xuSessionStore.readRunbook();
    if (!current) {
      if (phaseId) {
        void vscode.window.showWarningMessage("Open or generate a DryLake plan before starting a multi-agent handoff.");
        return;
      }

      await multiAgentRunner.createOrShow(context);
      return;
    }

    const phase = phaseId
      ? current.runbook.phases.find((item) => item.id === phaseId)
      : current.runbook.phases.find((item) => item.status === "active") ??
        current.runbook.phases.find((item) => item.status !== "complete") ??
        current.runbook.phases[0];

    if (!phase) {
      void vscode.window.showWarningMessage("Select a DryLake phase before starting a multi-agent handoff.");
      return;
    }

    const prompt = renderPhasePrompt(current.runbook, phase, { activeProvider: stateStore.getBuildSession() });
    await multiAgentRunner.openForPrompt(context, prompt, phase.agent ? [phase.agent] : undefined);
  };

  register("drylake.startBuildSession", async (...args: unknown[]) => {
    await startBuildSessionCommand(runbookDeps, context, args[0], args[1], args[2], args[3]);
  });

  register("drylake.openControlRoom", async () => {
    await openControlRoomCommand(runbookDeps, context);
  });

  register("drylake.openMultiAgentRunner", async () => {
    await openMultiAgentForPhase();
  });

  register("drylake.openMultiAgentForPhase", async (...args: unknown[]) => {
    const phaseId = typeof args[0] === "string" ? args[0] : "";
    await openMultiAgentForPhase(phaseId);
  });

  register("drylake.multiAgentPlanAssignments", async (...args: unknown[]) => {
    await multiAgentRunner.createOrShow(context);
    await multiAgentRunner.planAssignmentsFromCommand(args[0], args[1]);
  });

  register("drylake.multiAgentApproveAssignments", async (...args: unknown[]) => {
    await multiAgentRunner.approveAssignmentsFromCommand(args[0]);
  });

  register("drylake.multiAgentRun", async () => {
    await multiAgentRunner.runApprovedAssignmentsFromCommand();
  });

  register("drylake.generateDraftRunbook", async () => {
    await generateDraftRunbookCommand(runbookDeps);
  });

  register("drylake.validateXuRunbook", async () => {
    await validateXuRunbookCommand(runbookDeps);
  });

  register("drylake.approvePurpose", async () => {
    await approvePurposeCommand(runbookDeps);
  });

  register("drylake.approveArchitecture", async () => {
    await approveArchitectureCommand(runbookDeps);
  });

  register("drylake.previewProvisioningPlan", async () => {
    await previewProvisioningPlanCommand(runbookDeps);
  });

  register("drylake.generateAgentFiles", async () => {
    await generateAgentFilesCommand(runbookDeps);
  });

  register("drylake.exportHandoffPrompt", async () => {
    await exportHandoffPromptCommand(runbookDeps);
  });

  register("drylake.runNextPhase", async () => {
    await runNextPhaseCommand(runbookDeps);
  });

  register("drylake.updatePhaseAgent", async (...args: unknown[]) => {
    await updatePhaseAgentCommand(runbookDeps, args[0], args[1]);
  });

  register("drylake.updatePhaseHandoffProfile", async (...args: unknown[]) => {
    await updatePhaseHandoffProfileCommand(runbookDeps, args[0], args[1]);
  });

  register("drylake.updatePhaseStatus", async (...args: unknown[]) => {
    await updatePhaseStatusCommand(runbookDeps, args[0], args[1]);
  });

  register("drylake.toggleAutopilot", async () => {
    await toggleAutopilotCommand(runbookDeps);
  });

  register("drylake.reorderPhase", async (...args: unknown[]) => {
    await reorderPhaseCommand(runbookDeps, args[0], args[1]);
  });

  register("drylake.toggleStep", async (...args: unknown[]) => {
    await toggleStepCommand(runbookDeps, args[0], args[1], args[2]);
  });

  register("drylake.handoffPhase", async (...args: unknown[]) => {
    await handoffPhaseCommand(runbookDeps, args[0], args[1]);
  });

  register("drylake.checkAgentSetup", async () => {
    await openPhaseAgentSetupReport();
  });

  register("drylake.approvePlanChange", async (...args: unknown[]) => {
    await approvePlanChangeCommand(runbookDeps, args[0]);
  });

  register("drylake.rejectPlanChange", async (...args: unknown[]) => {
    await rejectPlanChangeCommand(runbookDeps, args[0]);
  });

  register("drylake.chatSendMessage", async (...args: unknown[]) => {
    await chatSendMessageCommand(runbookDeps, args[0]);
  });

  register("drylake.clearChat", async () => {
    await clearChatCommand(runbookDeps);
  });

  register("drylake.newSession", async () => {
    await newSessionCommand(runbookDeps);
  });

  register("drylake.archiveCurrentPlan", async () => {
    await archiveCurrentPlanCommand(runbookDeps);
  });

  register("drylake.deleteCurrentPlan", async () => {
    await deleteCurrentPlanCommand(runbookDeps);
  });

  register("drylake.openSessions", async () => {
    await openSessionsCommand(runbookDeps);
  });

  register("drylake.upgradeToPro", async () => {
    await vscode.env.openExternal(apiClient.openWebUrl("/billing?source=extension"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 120_000).toISOString());
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
      controlRoom.dispose();
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
    const hasEntitlement = await requireXupraProAiEntitlement(apiClient, stateStore, "Preview Generated Files");
    if (!hasEntitlement) {
      return;
    }

    await exportPreviewCommand(apiClient, configuration, stateStore, jobsView);
    await syncWorkspaceView();
  });

  register("xupra.installToRuntime", async () => {
    const hasEntitlement = await requireXupraProAiEntitlement(
      apiClient,
      stateStore,
      "Install to platforms",
    );
    if (!hasEntitlement) {
      return;
    }

    const selection = stateStore.getSelection();
    if (!selection.versionId) {
      void vscode.window.showWarningMessage(
        "Pick a target version in the sidebar first, then run Install to platforms.",
      );
      return;
    }

    type TargetChoice = "codex" | "claude_code" | "claude_agents" | "cursor" | "all";
    const items: Array<vscode.QuickPickItem & { value: TargetChoice }> = [
      { label: "Install to all platforms", description: "Codex, Claude Code, Claude Agents, Cursor", value: "all" },
      { label: "Codex", description: "~/.codex/agents/*.toml, ~/.codex/AGENTS.md, ~/.codex/skills/*", value: "codex" },
      { label: "Claude Code", description: "~/.claude/CLAUDE.md, ~/.claude/skills/*", value: "claude_code" },
      { label: "Claude Agents", description: "~/.claude/agents/*.md", value: "claude_agents" },
      { label: "Cursor", description: "~/.cursor/rules/*.mdc, ~/.cursor/skills/*", value: "cursor" },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Where should Xupra install the canonicalized agent files?",
      ignoreFocusOut: true,
    });

    if (!picked) return;

    const targets: Array<"codex" | "claude_code" | "claude_agents" | "cursor"> =
      picked.value === "all" ? ["codex", "claude_code", "claude_agents", "cursor"] : [picked.value];

    const filesByKey = new Map<
      string,
      { logicalPath: string; preview: string; targetPlatform: string }
    >();

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Building canonicalized files...",
          cancellable: false,
        },
        async () => {
          for (const target of targets) {
            const preview = await apiClient.exportPreview(selection.versionId!, target);
            const generatedFiles = preview.generatedFiles?.length
              ? preview.generatedFiles
              : (await apiClient.listGeneratedExports(selection.versionId!, target, true)).generatedFiles;

            for (const file of generatedFiles) {
              filesByKey.set(`${target}:${file.logicalPath}`, {
                logicalPath: file.logicalPath,
                preview: file.preview,
                targetPlatform: target,
              });
            }
          }
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Failed to build canonicalized files: ${message}`);
      return;
    }

    const generatedFiles = Array.from(filesByKey.values());
    if (generatedFiles.length === 0) {
      void vscode.window.showWarningMessage(
        "No generated files were produced. Canonicalize the version on the web first, then try again.",
      );
      return;
    }

    let summary;
    try {
      summary = await installGeneratedFilesToRuntimeHome(generatedFiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Install failed: ${message}`);
      return;
    }

    if (!summary) {
      // user cancelled the confirmation
      return;
    }

    const lines: string[] = [];
    if (summary.codexAgents.length > 0) {
      lines.push(`Codex agents: ${summary.codexAgents.join(", ")}`);
    }
    if (summary.claudeAgents.length > 0) {
      lines.push(`Claude agents: ${summary.claudeAgents.join(", ")}`);
    }
    if (summary.cursorRules.length > 0) {
      lines.push(`Cursor rules: ${summary.cursorRules.join(", ")}`);
    }
    if (summary.cursorSkills.length > 0) {
      lines.push(`Cursor skills: ${summary.cursorSkills.join(", ")}`);
    }

    void vscode.window.showInformationMessage(
      `Installed ${summary.writtenCount} files into ${summary.installRoot} (.codex / .claude / .cursor). ${lines.join(" | ")}`,
    );
  });

  register("xupra.pullPackage", async () => {
    await pullPackageCommand(apiClient, configuration, stateStore);
  });

  register("xupra.showRecentJobs", async () => {
    await vscode.commands.executeCommand("xupra.jobs.focus");
  });

  register("xupra.createAgent", () => {
    SkillCreationPanel.createOrShow(context, apiClient, stateStore, configuration);
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

  register("xupra.openImportedAgent", async (...args: unknown[]) => {
    const subagentId = typeof args[0] === "string" ? args[0] : undefined;
    const selection = stateStore.getSelection();

    if (!selection.versionId || typeof subagentId !== "string" || !subagentId.trim()) {
      return;
    }

    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const agent = importedWorkspace.subagents.find((item) => item.id === subagentId);

    if (!agent) {
      void vscode.window.showWarningMessage("That imported agent is no longer available for the selected version.");
      return;
    }

    await importedSkillEditor.openImportedAgent(selection.versionId, agent);
  });

  register("xupra.uninstallImportedAgent", async (...args: unknown[]) => {
    const subagentId = typeof args[0] === "string" ? args[0] : undefined;
    const selection = stateStore.getSelection();

    if (!selection.versionId || typeof subagentId !== "string" || !subagentId.trim()) {
      return;
    }

    const versionResponse = await apiClient.getVersion(selection.versionId);
    const importedWorkspace = mapImportedWorkspace(versionResponse.version);
    const agent = importedWorkspace.subagents.find((item) => item.id === subagentId);

    if (!agent) {
      void vscode.window.showWarningMessage("That imported agent is no longer available for the selected version.");
      return;
    }

    await importedSkillEditor.uninstallImportedAgent(agent);
  });

  register("xupra.uninstallImportedSkill", async (...args: unknown[]) => {
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

    await importedSkillEditor.uninstallImportedSkill(skill);
  });

  register("xupra.clearImportCache", async () => {
    const cacheRoot = vscode.Uri.joinPath(context.globalStorageUri, "editable-imports");
    try {
      await vscode.workspace.fs.delete(cacheRoot, { recursive: true, useTrash: false });
      void vscode.window.showInformationMessage(
        `Cleared Xupra import cache: ${cacheRoot.fsPath}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // FileNotFound is the common no-op case; treat as success.
      if (/not\s*found|ENOENT|FileNotFound/i.test(message)) {
        void vscode.window.showInformationMessage("No Xupra import cache to clear.");
        return;
      }
      void vscode.window.showErrorMessage(`Failed to clear import cache: ${message}`);
    }
  });

  register("xupra.optimizeFile", async (...args: unknown[]) => {
    let targetUri: vscode.Uri | undefined;

    const first = args[0];
    if (first instanceof vscode.Uri) {
      targetUri = first;
    } else if (typeof first === "string") {
      try {
        targetUri = vscode.Uri.parse(first);
      } catch {
        targetUri = undefined;
      }
    } else if (first && typeof first === "object" && "fsPath" in (first as Record<string, unknown>)) {
      const maybe = (first as { fsPath?: unknown }).fsPath;
      if (typeof maybe === "string") {
        targetUri = vscode.Uri.file(maybe);
      }
    }

    if (!targetUri) {
      const active = vscode.window.activeTextEditor?.document.uri;
      if (active && active.scheme !== "xupra-optimized") {
        targetUri = active;
      }
    }

    if (!targetUri) {
      void vscode.window.showWarningMessage("Open a file first, then run Optimize with Xupra AI.");
      return;
    }

    const hasEntitlement = await requireXupraProAiEntitlement(
      apiClient,
      stateStore,
      "Xupra AI optimization",
    );

    if (!hasEntitlement) {
      return;
    }

    let targetPlatform = inferTargetPlatformFromUri(targetUri);
    if (!targetPlatform) {
      const picked = await pickTargetPlatform(null);
      if (!picked) {
        return;
      }
      targetPlatform = picked;
    }

    const fileName = targetUri.path.split("/").pop() ?? "file";
    let originalContent: string;
    try {
      if (targetUri.scheme === ImportedContentProvider.scheme) {
        const document = await vscode.workspace.openTextDocument(targetUri);
        originalContent = document.getText();
      } else {
        const bytes = await vscode.workspace.fs.readFile(targetUri);
        originalContent = new TextDecoder("utf-8").decode(bytes);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Could not read file: ${message}`);
      return;
    }

    if (!originalContent.trim()) {
      void vscode.window.showWarningMessage("File is empty - nothing to optimize.");
      return;
    }

    const repoContext = await collectRepoContext();

    let optimizedContent: string;
    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Optimizing ${fileName} with Xupra AI...`,
          cancellable: false,
        },
        () =>
          apiClient.optimizeAgent({
            content: originalContent,
            targetPlatform,
            fileName,
            repoContext,
          }),
      );
      optimizedContent = result.optimized.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Optimization failed: ${message}`);
      return;
    }

    if (optimizedContent.trim() === originalContent.trim()) {
      void vscode.window.showInformationMessage("Xupra AI did not suggest changes for this file.");
      return;
    }

    const optimizedUri = optimizationContentProvider.register(targetUri, optimizedContent);
    await vscode.commands.executeCommand(
      "vscode.diff",
      targetUri,
      optimizedUri,
      `${fileName} ↔ Xupra AI optimization`,
      { preview: true },
    );

    const choice = await vscode.window.showInformationMessage(
      `Apply Xupra AI optimization to ${fileName}? A backup will be saved next to the file.`,
      { modal: true },
      "Apply",
      "Discard",
    );

    if (choice !== "Apply") {
      return;
    }

    if (targetUri.scheme === ImportedContentProvider.scheme) {
      void vscode.window.showInformationMessage(
        "This file was loaded from your imported snapshot, so Xupra cannot write back to disk. Use 'Install to platforms' from the sidebar to materialize agents into ~/.codex, ~/.claude, or ~/.cursor.",
      );
      return;
    }

    try {
      const backupUri = targetUri.with({ path: `${targetUri.path}.bak` });
      await vscode.workspace.fs.writeFile(backupUri, new TextEncoder().encode(originalContent));
      await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(optimizedContent));
      void vscode.window.showInformationMessage(
        `Applied optimization to ${fileName}. Backup at ${backupUri.path.split("/").pop()}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Failed to write optimized file: ${message}`);
    }
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

  if (configuration.get<boolean>("autoScanOnOpen")) {
    void vscode.commands.executeCommand("xupra.importWorkspace");
  }
}

export function deactivate() {}
