import * as vscode from "vscode";

import { resolveDryLakeAiProvider } from "../ai/providerResolver";
import { parseAiRunbookResponse } from "../ai/parseAiRunbookResponse";
import { renderGeneratedFiles } from "../generators/renderGeneratedFiles";
import { planGeneratedFiles, summarizeGeneratedFilePlan } from "../generators/planGeneratedFiles";
import { readWorkspaceExisting, writeGeneratedFiles } from "../generators/writeGeneratedFiles";
import { renderPhasePrompt } from "../generators/renderPhasePrompt";
import {
  launchPhaseAgent,
  phaseHandoffActionFromArg,
  phaseAgentLabel,
  showAgentLaunchFallbackActions,
  writePhaseHandoffFile,
  writePhaseHandoffScript,
} from "../agents/phaseAgentLauncher";
import {
  collectHandoffProfiles,
  handoffProfileMatchesAgent,
  handoffProfileRef,
  resolveHandoffProfile,
} from "../agents/handoffProfiles";
import { applyApproval } from "../xu/approvalState";
import { createLocalDraftXu } from "../xu/createLocalDraftXu";
import {
  applyApprovedPhaseChange,
  createPendingPlanChangeSet,
  resolvePendingPhase,
} from "../xu/pendingPlanChanges";
import { parseXu } from "../xu/parseXu";
import { renderXu } from "../xu/renderXu";
import { validateXu } from "../xu/validateXu";
import { XuSessionStore } from "../xu/sessionStore";
import type { DryLakeAiProvider } from "../ai/DryLakeAiProvider";
import type { DryLakeProviderId } from "../ai/DryLakeAiProvider";
import type { ApiClient } from "../services/apiClient";
import type { StateStore } from "../services/stateStore";
import type { ControlRoomProvider } from "../webview/controlRoomProvider";
import { scanWorkspaceFiles, getWorkspaceDisplayName } from "../services/workspaceScanner";
import { XU_PHASE_AGENTS } from "../xu/types";
import type {
  ApplicationBuildRunbook,
  BuildSessionState,
  XuHandoffProfileRef,
  XuMode,
  XuPhaseAgent,
  XuStepStatus,
} from "../xu/types";

type RunbookCommandDeps = {
  apiClient: ApiClient;
  stateStore: StateStore;
  sessionStore: XuSessionStore;
  controlRoom: ControlRoomProvider;
  refreshSidebar: () => Promise<void>;
};

const MODE_CHOICES: Array<vscode.QuickPickItem & { mode: XuMode }> = [
  {
    label: "Build App",
    description: "Purpose, architecture, phases, and agent-ready execution files",
    mode: "build-app",
  },
  {
    label: "Break Into Phases",
    description: "Clarify intent and split the work into manageable phases",
    mode: "phases",
  },
  {
    label: "Create Plan",
    description: "Generate a detailed file-level execution plan",
    mode: "plan",
  },
  {
    label: "Review / Repair",
    description: "Review existing code and produce a correction plan",
    mode: "review",
  },
];

const PLANNING_PROVIDER_CHOICES: Array<vscode.QuickPickItem & { providerId: DryLakeProviderId }> = [
  {
    label: "DryLake AI Planning",
    description: "Xupra hosted",
    detail: "Default hosted planner for chat-first DryLake planning.",
    providerId: "xupra-pro-ai",
  },
  {
    label: "Databricks API",
    description: "BYO endpoint",
    detail: "Uses your Databricks Model Serving endpoint and DATABRICKS_TOKEN.",
    providerId: "databricks-api",
  },
  {
    label: "Claude API",
    description: "BYO Anthropic key",
    detail: "Uses Anthropic Messages API with ANTHROPIC_API_KEY.",
    providerId: "claude-api",
  },
  {
    label: "OpenAI API",
    description: "BYO OpenAI key",
    detail: "Uses OpenAI Responses API with OPENAI_API_KEY.",
    providerId: "openai-api",
  },
  {
    label: "Hermes Agent CLI",
    description: "Local/BYO model",
    detail: "Uses the local Hermes Agent CLI and its configured provider stack.",
    providerId: "hermes-agent",
  },
];

type DirectPlanningProviderId = Extract<DryLakeProviderId, "databricks-api" | "claude-api" | "openai-api">;
type ManagePlanningProviderAction = "set-secret" | "clear-secret" | "open-settings";

const DIRECT_PROVIDER_SETUP: Record<DirectPlanningProviderId, {
  label: string;
  secretLabel: string;
  envSettingKey: string;
  defaultEnvVar: string;
}> = {
  "databricks-api": {
    label: "Databricks API",
    secretLabel: "Databricks token",
    envSettingKey: "databricks.tokenEnvVar",
    defaultEnvVar: "DATABRICKS_TOKEN",
  },
  "claude-api": {
    label: "Claude API",
    secretLabel: "Anthropic API key",
    envSettingKey: "claude.apiKeyEnvVar",
    defaultEnvVar: "ANTHROPIC_API_KEY",
  },
  "openai-api": {
    label: "OpenAI API",
    secretLabel: "OpenAI API key",
    envSettingKey: "openai.apiKeyEnvVar",
    defaultEnvVar: "OPENAI_API_KEY",
  },
};

const NO_LOCAL_PLAN_MESSAGE = "No local DryLake plan found. Open the Control Room to create one.";

function workspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake plan.");
  }

  return root;
}

function relativePath(uri: vscode.Uri) {
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
}

function phaseAgentFromArg(arg: unknown): XuPhaseAgent | undefined {
  return typeof arg === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(arg)
    ? (arg as XuPhaseAgent)
    : undefined;
}

function explicitPhaseAgent(agent: unknown): XuPhaseAgent | undefined {
  return phaseAgentFromArg(agent);
}

function handoffActionFromArg(arg: unknown) {
  return phaseHandoffActionFromArg(arg) ?? "run";
}

function requestedStageCountFromArg(arg: unknown): number | undefined {
  const value = typeof arg === "number" ? arg : typeof arg === "string" && arg.trim() ? Number(arg) : NaN;
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 12 ? rounded : undefined;
}

function phaseStatusFromArg(arg: unknown): Extract<XuStepStatus, "pending" | "active" | "complete"> | undefined {
  return arg === "pending" || arg === "active" || arg === "complete" ? arg : undefined;
}

function nextLaunchablePhase(runbook: ApplicationBuildRunbook) {
  return runbook.phases.find((phase) => phase.status === "active") ??
    runbook.phases.find((phase) => phase.status !== "complete");
}

function executionHasStarted(runbook: ApplicationBuildRunbook) {
  return runbook.phases.some((phase) => phase.status === "active");
}

function modeFromArg(arg: unknown): XuMode | undefined {
  if (typeof arg !== "string") {
    return undefined;
  }

  const normalized = arg.trim();
  return MODE_CHOICES.some((item) => item.mode === normalized) ? (normalized as XuMode) : undefined;
}

function planningProviderFromArg(arg: unknown): DryLakeProviderId | undefined {
  if (typeof arg !== "string") {
    return undefined;
  }

  const normalized = arg.trim();
  return PLANNING_PROVIDER_CHOICES.some((item) => item.providerId === normalized)
    ? (normalized as DryLakeProviderId)
    : undefined;
}

function isDirectPlanningProvider(providerId: DryLakeProviderId | undefined): providerId is DirectPlanningProviderId {
  return providerId === "databricks-api" || providerId === "claude-api" || providerId === "openai-api";
}

function settingsQueryForPlanningProvider(providerId: DirectPlanningProviderId) {
  if (providerId === "openai-api") {
    return "@ext:xupracorp.drylake drylake.openai";
  }

  if (providerId === "claude-api") {
    return "@ext:xupracorp.drylake drylake.claude";
  }

  return "@ext:xupracorp.drylake drylake.databricks";
}

function configurationString(configuration: vscode.WorkspaceConfiguration, key: string, fallback = "") {
  const value = configuration.get<string>(key, fallback);
  return typeof value === "string" ? value.trim() : fallback;
}

async function ensureDirectProviderRequiredSettings(
  configuration: vscode.WorkspaceConfiguration,
  providerId: DirectPlanningProviderId,
): Promise<boolean> {
  if (providerId !== "databricks-api") {
    return true;
  }

  const workspaceConfigured = await promptForSetting({
    configuration,
    key: "databricks.workspaceUrl",
    title: "Connect Databricks API",
    prompt: "Enter your Databricks workspace URL.",
    placeHolder: "https://example.cloud.databricks.com",
    validate: (value) => {
      if (!/^https:\/\/[^/]+/i.test(value)) {
        return "Enter a full https:// Databricks workspace URL.";
      }
      return undefined;
    },
  });
  if (!workspaceConfigured) {
    return false;
  }

  const endpointConfigured = await promptForSetting({
    configuration,
    key: "databricks.endpointName",
    title: "Connect Databricks API",
    prompt: "Enter the Databricks Model Serving endpoint name DryLake should use.",
    placeHolder: "drylake-planner",
    validate: (value) => value ? undefined : "Endpoint name is required.",
  });

  return endpointConfigured;
}

async function promptForSetting(params: {
  configuration: vscode.WorkspaceConfiguration;
  key: string;
  title: string;
  prompt: string;
  placeHolder?: string;
  validate?: (value: string) => string | undefined;
}): Promise<boolean> {
  if (configurationString(params.configuration, params.key)) {
    return true;
  }

  const value = await vscode.window.showInputBox({
    title: params.title,
    prompt: params.prompt,
    placeHolder: params.placeHolder,
    ignoreFocusOut: true,
    validateInput: (input) => params.validate?.(input.trim()),
  });

  if (!value?.trim()) {
    return false;
  }

  await params.configuration.update(params.key, value.trim(), vscode.ConfigurationTarget.Global);
  return true;
}

async function ensureDirectPlanningProviderConfigured(
  deps: RunbookCommandDeps,
  providerId: DirectPlanningProviderId,
  options: { forceSecretPrompt?: boolean } = {},
): Promise<{ enteredSecret: boolean } | undefined> {
  const configuration = vscode.workspace.getConfiguration("drylake");
  const setup = DIRECT_PROVIDER_SETUP[providerId];

  if (!await ensureDirectProviderRequiredSettings(configuration, providerId)) {
    return undefined;
  }

  const envVar = configurationString(configuration, setup.envSettingKey, setup.defaultEnvVar);
  const hasEnvKey = Boolean(process.env[envVar]?.trim());
  const hasStoredKey = Boolean(await deps.stateStore.getPlanningProviderSecret(providerId));
  if (!options.forceSecretPrompt && (hasEnvKey || hasStoredKey)) {
    return { enteredSecret: false };
  }

  const secret = await vscode.window.showInputBox({
    title: `Connect ${setup.label}`,
    prompt: `Paste your ${setup.secretLabel}. DryLake will test it now and only save it if the test succeeds.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? undefined : `${setup.secretLabel} is required.`,
  });

  if (!secret?.trim()) {
    return undefined;
  }

  await deps.stateStore.setPlanningProviderSecret(providerId, secret.trim());
  return { enteredSecret: true };
}

async function validateDirectPlanningProvider(
  deps: RunbookCommandDeps,
  providerId: DirectPlanningProviderId,
  enteredSecret: boolean,
  resolvedProvider?: DryLakeAiProvider,
): Promise<DryLakeAiProvider | undefined> {
  const provider = resolvedProvider ?? await resolveProvider(deps.stateStore, providerId);
  if (typeof provider.validateConnection !== "function") {
    return provider;
  }

  const validation = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Testing ${provider.label} connection...`,
      cancellable: false,
    },
    async () => provider.validateConnection!(),
  );

  if (!validation.available) {
    if (enteredSecret) {
      await deps.stateStore.clearPlanningProviderSecret(providerId);
    }

    void vscode.window.showWarningMessage(
      validation.reason
        ? `${provider.label} connection failed: ${validation.reason}`
        : `${provider.label} connection failed.`,
    );
    return undefined;
  }

  return provider;
}

function configurationWithPlanningProvider(
  configuration: vscode.WorkspaceConfiguration,
  providerId?: DryLakeProviderId,
): vscode.WorkspaceConfiguration {
  if (!providerId) {
    return configuration;
  }

  return {
    ...configuration,
    get<T>(key: string, defaultValue?: T) {
      if (key === "aiProvider") {
        return providerId as T;
      }

      return configuration.get(key, defaultValue);
    },
  };
}

async function pickPlanningProvider(arg?: unknown): Promise<DryLakeProviderId | undefined> {
  const fromArg = planningProviderFromArg(arg);
  if (fromArg) {
    return fromArg;
  }

  const configured = String(vscode.workspace.getConfiguration("drylake").get("aiProvider", "xupra-pro-ai"));
  const picked = await vscode.window.showQuickPick(
    PLANNING_PROVIDER_CHOICES.map((item) => ({
      ...item,
      picked: item.providerId === configured,
    })),
    {
      title: "Select Planning Provider",
      placeHolder: "Choose how DryLake should generate this plan.",
      ignoreFocusOut: true,
    },
  );

  return picked?.providerId;
}

async function pickMode(arg?: unknown): Promise<XuMode | undefined> {
  const fromArg = modeFromArg(arg);
  if (fromArg) {
    return fromArg;
  }

  const picked = await vscode.window.showQuickPick(MODE_CHOICES, {
    placeHolder: "What do you want to build?",
    ignoreFocusOut: true,
  });

  return picked?.mode;
}

async function resolveProvider(
  stateStore: StateStore,
  providerOverride?: DryLakeProviderId,
): Promise<DryLakeAiProvider> {
  const configuration = vscode.workspace.getConfiguration("drylake");
  const resolution = await resolveDryLakeAiProvider({
    configuration: configurationWithPlanningProvider(configuration, providerOverride),
    backendConfiguration: vscode.workspace.getConfiguration("xupra"),
    readConnection: () => stateStore.getConnection(),
    readAccessToken: () => stateStore.getAccessToken(),
    readPlanningSecret: (providerId) => stateStore.getPlanningProviderSecret(providerId),
  });

  await stateStore.setPlanningProvider({
    id: resolution.provider.id,
    label: resolution.provider.label,
    reason: resolution.reason,
  });

  return resolution.provider;
}

async function preparePlanningProvider(
  deps: RunbookCommandDeps,
  providerId: DryLakeProviderId,
): Promise<DryLakeAiProvider | undefined> {
  const setup = isDirectPlanningProvider(providerId)
    ? await ensureDirectPlanningProviderConfigured(deps, providerId)
    : { enteredSecret: false };

  if (!setup) {
    return undefined;
  }

  const provider = await resolveProvider(deps.stateStore, providerId);
  if (!isDirectPlanningProvider(providerId) || typeof provider.validateConnection !== "function") {
    return provider;
  }

  return validateDirectPlanningProvider(deps, providerId, setup.enteredSecret, provider);
}

export async function configurePlanningProviderCommand(
  deps: RunbookCommandDeps,
  providerArg?: unknown,
  actionArg?: unknown,
  secretArg?: unknown,
) {
  const providerId = planningProviderFromArg(providerArg) ?? await pickPlanningProvider();
  if (!providerId) {
    return;
  }

  if (providerId === "hermes-agent") {
    const choice = await vscode.window.showInformationMessage(
      "Hermes Agent CLI uses Hermes' own local provider configuration. DryLake does not store a Hermes API key.",
      "Open Hermes Settings",
    );
    if (choice === "Open Hermes Settings") {
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:xupracorp.drylake drylake.agents.hermes");
    }
    return;
  }

  if (!isDirectPlanningProvider(providerId)) {
    return;
  }

  const configuration = vscode.workspace.getConfiguration("drylake");
  const setup = DIRECT_PROVIDER_SETUP[providerId];
  const envVar = configurationString(configuration, setup.envSettingKey, setup.defaultEnvVar);
  const hasEnvKey = Boolean(process.env[envVar]?.trim());
  const hasStoredKey = Boolean(await deps.stateStore.getPlanningProviderSecret(providerId));
  const action = typeof actionArg === "string" ? actionArg : "";
  const manage = actionArg === true || actionArg === "true" || action === "manage";

  if (action === "save-secret") {
    const secret = typeof secretArg === "string" ? secretArg.trim() : "";
    if (!secret) {
      void vscode.window.showWarningMessage(`${setup.secretLabel} is required.`);
      return;
    }

    if (!await ensureDirectProviderRequiredSettings(configuration, providerId)) {
      return;
    }

    await deps.stateStore.setPlanningProviderSecret(providerId, secret);
    const provider = await validateDirectPlanningProvider(deps, providerId, true);
    if (provider) {
      void vscode.window.showInformationMessage(`${provider.label} is connected for DryLake planning.`);
    }
    return;
  }

  if (action === "clear-secret") {
    await deps.stateStore.clearPlanningProviderSecret(providerId);
    void vscode.window.showInformationMessage(
      hasEnvKey
        ? `${setup.label} key removed from VS Code SecretStorage. DryLake may still use ${envVar} from the environment.`
        : `${setup.label} key removed from VS Code SecretStorage.`,
    );
    return;
  }

  if (action === "open-settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", settingsQueryForPlanningProvider(providerId));
    return;
  }

  if (manage) {
    const action = await vscode.window.showQuickPick(
      [
        {
          label: "Set or replace API key",
          description: `Store a ${setup.secretLabel} in VS Code SecretStorage`,
          action: "set-secret" as ManagePlanningProviderAction,
        },
        {
          label: "Clear stored API key",
          description: hasStoredKey
            ? "Remove DryLake's stored key from VS Code SecretStorage"
            : "No DryLake SecretStorage key is currently saved",
          action: "clear-secret" as ManagePlanningProviderAction,
        },
        {
          label: "Open provider settings",
          description: `Configure model, base URL, and the ${envVar} env-var name`,
          action: "open-settings" as ManagePlanningProviderAction,
        },
      ],
      {
        title: `Manage ${setup.label}`,
        placeHolder: hasEnvKey
          ? `${setup.label} also sees ${envVar} in VS Code's environment.`
          : `Add or manage the ${setup.secretLabel} used for planning.`,
        ignoreFocusOut: true,
      },
    );

    if (!action) {
      return;
    }

    if (action.action === "clear-secret") {
      await deps.stateStore.clearPlanningProviderSecret(providerId);
      void vscode.window.showInformationMessage(
        hasEnvKey
          ? `${setup.label} key removed from VS Code SecretStorage. DryLake may still use ${envVar} from the environment.`
          : `${setup.label} key removed from VS Code SecretStorage.`,
      );
      return;
    }

    if (action.action === "open-settings") {
      await vscode.commands.executeCommand("workbench.action.openSettings", settingsQueryForPlanningProvider(providerId));
      return;
    }
  } else if (hasStoredKey || hasEnvKey) {
    void vscode.window.showInformationMessage(
      hasEnvKey
        ? `${setup.label} is configured from ${envVar}. Use Add or Manage API Key to replace it in VS Code SecretStorage.`
        : `${setup.label} already has a key in VS Code SecretStorage.`,
    );
    return;
  }

  const configured = await ensureDirectPlanningProviderConfigured(deps, providerId, { forceSecretPrompt: true });
  if (!configured) {
    return;
  }

  const provider = await validateDirectPlanningProvider(deps, providerId, configured.enteredSecret);
  if (provider) {
    void vscode.window.showInformationMessage(`${provider.label} is connected for DryLake planning.`);
  }
}

async function persistModelTier(stateStore: StateStore, modelTier: unknown): Promise<void> {
  if (modelTier === "nano" || modelTier === "foundation") {
    await stateStore.setLastModelTier(modelTier);
  }
}

function isHostedPlanningAuthFailure(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("authentication required") ||
    normalized.includes("invalid or expired") ||
    normalized.includes("connect a xupra account") ||
    normalized.includes("sign in to drylake")
  );
}

async function clearStaleHostedPlanningConnection(
  deps: RunbookCommandDeps,
  provider: DryLakeAiProvider,
  message: string | undefined,
) {
  if (provider.id !== "xupra-pro-ai" || !isHostedPlanningAuthFailure(message)) {
    return;
  }

  deps.apiClient.setAccessToken(undefined);
  await deps.stateStore.clearAccessToken();
  await deps.stateStore.clearConnection();

  const choice = await vscode.window.showWarningMessage(
    "Your DryLake extension connection expired. Reconnect to use hosted card generation. A local starter plan was kept visible.",
    "Reconnect DryLake",
  );

  if (choice === "Reconnect DryLake") {
    await vscode.commands.executeCommand("xupra.connect");
  }
}

async function buildWorkspaceSummary() {
  const rootName = getWorkspaceDisplayName();
  let detected: string[] = [];

  try {
    const files = await scanWorkspaceFiles(vscode.workspace.getConfiguration("xupra"));
    detected = files.map((file) => `${file.logicalPath} (${file.category})`);
  } catch {
    detected = [];
  }

  return [
    `Workspace: ${rootName}`,
    detected.length > 0 ? "Detected agent files:" : "Detected agent files: none",
    ...detected.slice(0, 80).map((item) => `- ${item}`),
  ].join("\n");
}

async function openGeneratedPromptDocument(title: string, content: string) {
  await vscode.env.clipboard.writeText(content);
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: `# ${title}\n\nThe prompt has been copied to your clipboard.\n\n${content}`,
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

async function maybeImportExternalResult(sessionStore: XuSessionStore, currentUri: vscode.Uri) {
  const choice = await vscode.window.showInformationMessage(
    "External AI Prompt is ready. Paste the AI's YAML result back into DryLake when it returns.",
    "Paste Result",
    "Open drylake.xu",
  );

  if (choice === "Paste Result") {
    const pasted = await vscode.window.showInputBox({
      title: "Paste External AI Result",
      prompt: "Paste the YAML plan returned by your external AI tool.",
      ignoreFocusOut: true,
    });

    if (pasted?.trim()) {
      const parsed = parseAiRunbookResponse(pasted);
      if (!parsed.runbook) {
        throw new Error(parsed.validation.diagnostics.map((item) => item.message).join("\n"));
      }

      await sessionStore.writeRunbook(currentUri, parsed.runbook);
      void vscode.window.showInformationMessage("Imported external AI result into drylake.xu.");
    }

    return;
  }

  if (choice === "Open drylake.xu") {
    const document = await vscode.workspace.openTextDocument(currentUri);
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

async function seedChatWithClarifyingQuestions(params: {
  deps: RunbookCommandDeps;
  provider: DryLakeAiProvider;
  prompt: string;
  mode: XuMode;
}): Promise<void> {
  if (typeof params.provider.clarifyIntent !== "function") {
    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text:
        "I've drafted a plan based on your prompt. Tell me anything else I should know and I'll refine it.",
    });
    return;
  }

  try {
    const workspaceSummary = await buildWorkspaceSummary();
    const result = await params.provider.clarifyIntent({
      prompt: params.prompt,
      mode: params.mode,
      workspaceSummary,
    });
    await persistModelTier(params.deps.stateStore, result.modelTier);

    const questions = Array.isArray(result.questions)
      ? result.questions.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [];

    if (questions.length === 0) {
      await params.deps.stateStore.appendChatMessage({
        role: result.message ? "system" : "ai",
        text: result.message
          ? `${params.provider.label} generated the plan, but could not generate follow-up questions: ${result.message}`
          : "I've drafted the plan. Tell me anything else I should know and I'll refine it.",
      });
      return;
    }

    const numbered = questions
      .slice(0, 4)
      .map((question, index) => `${index + 1}. ${question}`)
      .join("\n");

    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text: `Before I lock the plan, a few quick questions:\n${numbered}\n\nAnswer in one message - anything you skip I'll just guess.`,
    });
  } catch (error) {
    console.warn("DryLake clarifying questions failed:", error);
    await params.deps.stateStore.appendChatMessage({
      role: "ai",
      text: "I've drafted the plan. Tell me anything else I should know and I'll refine it.",
    });
  }
}

export async function chatSendMessageCommand(deps: RunbookCommandDeps, textArg?: unknown) {
  const text = typeof textArg === "string" ? textArg.trim() : "";
  if (!text) {
    return;
  }

  const userMessage = await deps.stateStore.appendChatMessage({ role: "user", text });
  await deps.stateStore.setPlanningLoading(true);
  await deps.controlRoom.refresh();

  try {
    const current = await deps.sessionStore.readRunbook();
    const providerId = current ? deps.stateStore.getBuildSession()?.providerId : await pickPlanningProvider();
    if (!current && !providerId) {
      return;
    }

    const provider = current
      ? await resolveProvider(deps.stateStore, providerId)
      : await preparePlanningProvider(deps, providerId!);
    if (!provider) {
      return;
    }

    if (!current) {
      const mode = deps.stateStore.getBuildSession()?.mode ?? "build-app";

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "DryLake is generating your plan...",
          cancellable: false,
        },
        async () => {
          const draftResult = await generateFirstMessageDraft({
            deps,
            prompt: text,
            mode,
            provider,
            requestedStageCount: deps.stateStore.getBuildSession()?.requestedStageCount,
          });
          const session = await deps.sessionStore.createSession({
            prompt: text,
            mode,
            runbookPath: relativePath(draftResult.runbookUri),
            requestedStageCount: deps.stateStore.getBuildSession()?.requestedStageCount,
            providerId: provider.id,
            providerLabel: provider.label,
          });
          await deps.stateStore.setBuildSession(session);
          if (draftResult.providerGenerated) {
            await seedChatWithClarifyingQuestions({ deps, provider, prompt: text, mode });
          } else {
            await clearStaleHostedPlanningConnection(deps, provider, draftResult.providerMessage);
            await deps.stateStore.appendChatMessage({
              role: "system",
              text: draftResult.providerMessage
                ? `${provider.label} could not refine the starter plan: ${draftResult.providerMessage}`
                : `${provider.label} could not refine the starter plan.`,
            });
          }
        },
      );
      return;
    }

    let session = deps.stateStore.getBuildSession();
    if (!session) {
      session = {
        id: `recovered-${Date.now()}`,
        mode: current.runbook.metadata.mode ?? "build-app",
        prompt: current.runbook.intent.rawPrompt,
        createdAt: new Date().toISOString(),
        runbookPath: relativePath(current.uri),
        providerId: provider.id,
        providerLabel: provider.label,
      } satisfies BuildSessionState;
      await deps.stateStore.setBuildSession(session);
    }

    const availability = await provider.isAvailable();
    if (!availability.available && provider.id !== "external-ai-prompt") {
      await clearStaleHostedPlanningConnection(deps, provider, availability.reason);
      await deps.stateStore.appendChatMessage({
        role: "system",
        text: availability.reason
          ? `${provider.label} is unavailable: ${availability.reason}`
          : `${provider.label} is unavailable right now.`,
      });
      return;
    }

    const chatHistory = deps.stateStore.getChatHistory().messages;
    const chatTranscript = chatHistory
      .map((message) => {
        const speaker = message.role === "user" ? "User" : message.role === "system" ? "DryLake" : "Planning AI";
        return `${speaker}: ${message.text}`;
      })
      .join("\n");

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DryLake is refining your plan...",
        cancellable: false,
      },
      async () => {
        const workspaceSummary = await buildWorkspaceSummary();
        const result = await provider.planningChat({
          prompt: session.prompt.trim(),
          mode: session.mode,
          workspaceSummary,
          requestedStageCount: session.requestedStageCount,
          currentRunbook: current.runbook,
          chatTranscript,
        });
        await persistModelTier(deps.stateStore, result.modelTier);

        if (result.runbook) {
          if (executionHasStarted(current.runbook)) {
            const pending = createPendingPlanChangeSet({
              sourceChatMessageId: userMessage.id,
              baseRunbookPath: relativePath(current.uri),
              currentRunbook: current.runbook,
              proposedRunbook: result.runbook,
            });

            if (pending.affectedPhaseIds.length > 0) {
              await deps.sessionStore.writePendingPlanChange(pending);
            } else {
              await deps.sessionStore.clearPendingPlanChange();
            }
          } else {
            await deps.sessionStore.writeRunbook(current.uri, result.runbook);
            await deps.sessionStore.clearPendingPlanChange();
          }
        }

        if (result.reply) {
          await deps.stateStore.appendChatMessage({ role: "ai", text: result.reply });
          return;
        }

        await clearStaleHostedPlanningConnection(deps, provider, result.error);
        await deps.stateStore.appendChatMessage({
          role: "system",
          text: `${provider.label} Planning Chat is not working: ${result.error ?? "No response returned."}`,
        });
      },
    );
  } finally {
    await deps.stateStore.setPlanningLoading(false);
    await deps.controlRoom.refresh();
    await deps.refreshSidebar();
  }
}

export async function clearChatCommand(deps: RunbookCommandDeps) {
  await deps.stateStore.clearChatHistory();
  await deps.controlRoom.refresh();
}

async function clearCurrentPlanningState(deps: RunbookCommandDeps) {
  await deps.stateStore.clearBuildSession();
  await deps.stateStore.clearChatHistory();
  await deps.stateStore.setPlanningLoading(false);
  await deps.sessionStore.clearPendingPlanChanges();
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function newSessionCommand(deps: RunbookCommandDeps) {
  const existingUri = await deps.sessionStore.findRunbookUri();
  if (existingUri) {
    let current: Awaited<ReturnType<XuSessionStore["readRunbook"]>> = null;
    let readError = "";
    try {
      current = await deps.sessionStore.readRunbook();
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error);
    }

    const planPath = relativePath(existingUri);
    const active = current?.runbook.phases.find((phase) => phase.status === "active");
    const activeDetail = active ? ` Phase ${active.title} is still active.` : "";
    const invalidDetail = !current && readError ? " The current plan has diagnostics, so it can be deleted but not archived automatically." : "";
    const choices = current ? ["Archive & Start New", "Delete & Start New"] : ["Delete & Start New"];
    const choice = await vscode.window.showWarningMessage(
      `Start a new DryLake plan? DryLake found an existing local plan at ${planPath}.${activeDetail}${invalidDetail} Archive keeps a copy under .drylake/sessions. Delete removes the local plan file.`,
      { modal: true },
      ...choices,
    );

    if (choice === "Archive & Start New") {
      await deps.sessionStore.archiveCurrentRunbook();
    } else if (choice === "Delete & Start New") {
      await deps.sessionStore.deleteCurrentPlan();
    } else {
      return;
    }
  }

  await clearCurrentPlanningState(deps);
}

export async function archiveCurrentPlanCommand(deps: RunbookCommandDeps) {
  let archived: Awaited<ReturnType<XuSessionStore["archiveCurrentRunbook"]>> = null;
  try {
    archived = await deps.sessionStore.archiveCurrentRunbook();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(
      `DryLake could not archive the current plan because it could not be read: ${detail}`,
    );
    return;
  }

  if (!archived) {
    void vscode.window.showInformationMessage("No local DryLake plan is available to archive.");
    return;
  }

  await clearCurrentPlanningState(deps);
  void vscode.window.showInformationMessage("DryLake archived the current plan. Open the Control Room to create a new one.");
}

export async function deleteCurrentPlanCommand(deps: RunbookCommandDeps) {
  const uri = await deps.sessionStore.findRunbookUri();
  if (!uri) {
    void vscode.window.showInformationMessage("No local DryLake plan is available to delete.");
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Delete the local DryLake plan at ${relativePath(uri)}? This cannot be undone by DryLake.`,
    { modal: true },
    "Delete Plan",
  );

  if (choice !== "Delete Plan") {
    return;
  }

  await deps.sessionStore.deleteCurrentPlan();
  await clearCurrentPlanningState(deps);
  void vscode.window.showInformationMessage("DryLake deleted the local plan. Open the Control Room to create a new one.");
}

function phaseIdFromArg(arg: unknown) {
  return typeof arg === "string" ? arg.trim() : "";
}

export async function approvePlanChangeCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown) {
  const phaseId = phaseIdFromArg(phaseIdArg);
  if (!phaseId) {
    void vscode.window.showWarningMessage("DryLake could not apply the plan change because no phase was specified.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  const pending = await deps.sessionStore.readPendingPlanChange();
  if (!current || !pending || pending.status !== "pending") {
    void vscode.window.showWarningMessage("No pending DryLake plan change is available.");
    return;
  }

  if (!pending.affectedPhaseIds.includes(phaseId) || pending.phaseResolutions[phaseId]) {
    void vscode.window.showWarningMessage(`No unresolved plan change exists for phase ${phaseId}.`);
    return;
  }

  const updatedRunbook = applyApprovedPhaseChange(current.runbook, pending, phaseId);
  const updatedPending = resolvePendingPhase(pending, phaseId, "approved");

  await deps.sessionStore.writeRunbook(current.uri, updatedRunbook);
  await deps.sessionStore.writePendingPlanChange(updatedPending);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode.window.showInformationMessage(`Applied proposed change for phase ${phaseId}.`);
}

export async function rejectPlanChangeCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown) {
  const phaseId = phaseIdFromArg(phaseIdArg);
  if (!phaseId) {
    void vscode.window.showWarningMessage("DryLake could not reject the plan change because no phase was specified.");
    return;
  }

  const pending = await deps.sessionStore.readPendingPlanChange();
  if (!pending || pending.status !== "pending") {
    void vscode.window.showWarningMessage("No pending DryLake plan change is available.");
    return;
  }

  if (!pending.affectedPhaseIds.includes(phaseId) || pending.phaseResolutions[phaseId]) {
    void vscode.window.showWarningMessage(`No unresolved plan change exists for phase ${phaseId}.`);
    return;
  }

  const updatedPending = resolvePendingPhase(pending, phaseId, "rejected");

  await deps.sessionStore.writePendingPlanChange(updatedPending);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode.window.showInformationMessage(`Kept current phase ${phaseId}.`);
}

export async function openSessionsCommand(deps: RunbookCommandDeps) {
  const sessions = await deps.sessionStore.listArchivedSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage("No archived DryLake sessions yet.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    sessions.map((session) => ({
      label: session.name,
      description: session.archivedAt ?? session.id,
      session,
    })),
    {
      placeHolder: "Switch the Control Room to an archived DryLake plan.",
      ignoreFocusOut: true,
    },
  );

  if (!picked) {
    return;
  }

  try {
    await deps.sessionStore.restoreArchivedSession(picked.session.id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(`DryLake could not switch to the archived plan: ${detail}`);
    return;
  }

  await clearCurrentPlanningState(deps);
  void vscode.window.showInformationMessage(`DryLake switched to archived plan: ${picked.session.name}.`);
}

async function applyAiDraft(params: {
  deps: RunbookCommandDeps;
  prompt: string;
  mode: XuMode;
  runbook: ApplicationBuildRunbook;
  runbookUri: vscode.Uri;
  provider: DryLakeAiProvider;
  openExternalPrompt: boolean;
  requestedStageCount?: number;
}): Promise<{ runbook: ApplicationBuildRunbook; providerGenerated: boolean; providerMessage?: string }> {
  const workspaceSummary = await buildWorkspaceSummary();
  const localDraft = createLocalDraftXu({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
    currentRunbook: params.runbook,
  });
  await params.deps.sessionStore.writeRunbook(params.runbookUri, localDraft);

  const availability = await params.provider.isAvailable();
  if (!availability.available && params.provider.id !== "external-ai-prompt") {
    void vscode.window.showInformationMessage(
      `${params.provider.label} is not available, so the manual draft command created a local draft plan.`,
    );
    return { runbook: localDraft, providerGenerated: false, providerMessage: availability.reason };
  }

  if (params.provider.id === "external-ai-prompt" && !params.openExternalPrompt) {
    void vscode.window.showInformationMessage("The manual draft command created a local draft plan.");
    return { runbook: localDraft, providerGenerated: false };
  }

  const result = await params.provider.generateDraftRunbook({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
    requestedStageCount: params.requestedStageCount,
    currentRunbook: localDraft,
  });
  await persistModelTier(params.deps.stateStore, result.modelTier);

  if (result.runbook) {
    await params.deps.sessionStore.writeRunbook(params.runbookUri, result.runbook);
    return { runbook: result.runbook, providerGenerated: true };
  }

  if (result.promptForExternalAi) {
    await openGeneratedPromptDocument("DryLake External AI Prompt", result.promptForExternalAi);
    await maybeImportExternalResult(params.deps.sessionStore, params.runbookUri);
  }

  if (result.message) {
    void vscode.window.showInformationMessage(result.message);
  }

  return { runbook: localDraft, providerGenerated: false, providerMessage: result.message };
}

async function generateFirstMessageDraft(params: {
  deps: RunbookCommandDeps;
  prompt: string;
  mode: XuMode;
  provider: DryLakeAiProvider;
  requestedStageCount?: number;
}): Promise<{ runbookUri: vscode.Uri; providerGenerated: boolean; providerMessage?: string }> {
  const workspaceSummary = await buildWorkspaceSummary();
  const runbookUri = (await params.deps.sessionStore.findRunbookUri()) ??
    params.deps.sessionStore.getDefaultRunbookUri();
  const localDraft = createLocalDraftXu({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
  });

  await params.deps.sessionStore.writeRunbook(runbookUri, localDraft);
  await params.deps.controlRoom.refresh();
  await params.deps.refreshSidebar();

  const availability = await params.provider.isAvailable();
  if (!availability.available && params.provider.id !== "external-ai-prompt") {
    return {
      runbookUri,
      providerGenerated: false,
      providerMessage: availability.reason ?? `${params.provider.label} is unavailable right now.`,
    };
  }

  try {
    const result = await params.provider.generateDraftRunbook({
      prompt: params.prompt,
      mode: params.mode,
      workspaceSummary,
      requestedStageCount: params.requestedStageCount,
    });
    await persistModelTier(params.deps.stateStore, result.modelTier);

    if (result.runbook) {
      await params.deps.sessionStore.writeRunbook(runbookUri, result.runbook);
      return { runbookUri, providerGenerated: true };
    }

    return {
      runbookUri,
      providerGenerated: false,
      providerMessage: result.message ?? `${params.provider.label} did not return a valid plan.`,
    };
  } catch (error) {
    return {
      runbookUri,
      providerGenerated: false,
      providerMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openControlRoomCommand(deps: RunbookCommandDeps, context: vscode.ExtensionContext) {
  await deps.controlRoom.createOrShow(context);
}

export async function startBuildSessionCommand(
  deps: RunbookCommandDeps,
  context: vscode.ExtensionContext,
  modeArg?: unknown,
  promptArg?: unknown,
  providerArg?: unknown,
  stageCountArg?: unknown,
) {
  if (!(typeof promptArg === "string" && promptArg.trim())) {
    await deps.controlRoom.createOrShow(context);
    return;
  }

  const mode = await pickMode(modeArg);
  if (!mode) {
    return;
  }

  const prompt = promptArg;
  const requestedStageCount = requestedStageCountFromArg(stageCountArg);

  if (!prompt?.trim()) {
    return;
  }

  const providerId = await pickPlanningProvider(providerArg);
  if (!providerId) {
    return;
  }

  await deps.controlRoom.createOrShow(context);

  const provider = await preparePlanningProvider(deps, providerId);
  if (!provider) {
    return;
  }
  await deps.stateStore.setPlanningLoading(true);
  await deps.controlRoom.refresh();

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DryLake is generating your plan...",
        cancellable: false,
      },
      async () => {
        const cleanedPrompt = prompt.trim();
        await deps.stateStore.clearChatHistory();
        await deps.stateStore.appendChatMessage({ role: "user", text: cleanedPrompt });
        await deps.controlRoom.refresh();

        const draftResult = await generateFirstMessageDraft({
          deps,
          prompt: cleanedPrompt,
          mode,
          provider,
          requestedStageCount,
        });
        const session = await deps.sessionStore.createSession({
          prompt: cleanedPrompt,
          mode,
          runbookPath: relativePath(draftResult.runbookUri),
          requestedStageCount,
          providerId: provider.id,
          providerLabel: provider.label,
        });
        await deps.stateStore.setBuildSession(session);
        if (draftResult.providerGenerated) {
          await seedChatWithClarifyingQuestions({ deps, provider, prompt: cleanedPrompt, mode });
        } else {
          await clearStaleHostedPlanningConnection(deps, provider, draftResult.providerMessage);
          await deps.stateStore.appendChatMessage({
            role: "system",
            text: draftResult.providerMessage
              ? `${provider.label} could not refine the starter plan: ${draftResult.providerMessage}`
              : `${provider.label} could not refine the starter plan.`,
          });
        }
      },
    );
  } finally {
    await deps.stateStore.setPlanningLoading(false);
  }

  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function generateDraftRunbookCommand(deps: RunbookCommandDeps) {
  const mode = await pickMode(deps.stateStore.getBuildSession()?.mode);
  if (!mode) {
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  const defaultPrompt = current?.runbook.intent.rawPrompt ?? deps.stateStore.getBuildSession()?.prompt ?? "";
  const prompt = await vscode.window.showInputBox({
    title: "Generate Draft DryLake Plan",
    prompt: "Describe the task to convert into drylake.xu.",
    value: defaultPrompt,
    ignoreFocusOut: true,
  });

  if (!prompt?.trim()) {
    return;
  }

  const providerId = await pickPlanningProvider();
  if (!providerId) {
    return;
  }

  const provider = await preparePlanningProvider(deps, providerId);
  if (!provider) {
    return;
  }
  const ensured = await deps.sessionStore.ensureRunbook({ prompt: prompt.trim(), mode });
  await applyAiDraft({
    deps,
    prompt: prompt.trim(),
    mode,
    runbook: ensured.runbook,
    runbookUri: ensured.uri,
    provider,
    openExternalPrompt: true,
  });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function validateXuRunbookCommand(deps: RunbookCommandDeps) {
  const uri = (await deps.sessionStore.findRunbookUri()) ?? deps.sessionStore.getDefaultRunbookUri();
  let text = "";

  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    text = new TextDecoder("utf-8").decode(bytes);
  } catch {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const parsed = parseXu(text);
  const diagnostics = parsed.runbook ? validateXu(parsed.runbook).diagnostics : parsed.validation.diagnostics;

  if (diagnostics.length === 0) {
    void vscode.window.showInformationMessage("drylake.xu is valid.");
    return;
  }

  const content = ["# drylake.xu diagnostics", "", ...diagnostics.map((item) => `- ${item.path}: ${item.message}`)].join("\n");
  const document = await vscode.workspace.openTextDocument({ language: "markdown", content });
  await vscode.window.showTextDocument(document, { preview: false });
}

async function approve(deps: RunbookCommandDeps, type: "purpose" | "architecture") {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  if (type === "purpose" && !current.runbook.intent.purpose.trim()) {
    void vscode.window.showWarningMessage("Add a purpose to drylake.xu before approving it.");
    return;
  }

  if (type === "architecture" && !current.runbook.architecture.summary.trim()) {
    void vscode.window.showWarningMessage("Add an architecture summary to drylake.xu before approving it.");
    return;
  }

  const updated = applyApproval(current.runbook, type);
  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.sessionStore.writeApproval(type, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode.window.showInformationMessage(
    type === "purpose" ? "DryLake purpose approval recorded." : "DryLake architecture approval recorded.",
  );
}

export async function approvePurposeCommand(deps: RunbookCommandDeps) {
  await approve(deps, "purpose");
}

export async function approveArchitectureCommand(deps: RunbookCommandDeps) {
  await approve(deps, "architecture");
}

export async function previewProvisioningPlanCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const provisioning = current.runbook.provisioning;
  const content = [
    "# DryLake Provisioning Preview",
    "",
    "This is a preview. DryLake will not run these commands automatically in this version.",
    "",
    "## Commands",
    ...(provisioning.commands.length ? provisioning.commands.map((command) => `- \`${command}\``) : ["- None"]),
    "",
    "## Files To Create",
    ...(provisioning.filesToCreate.length ? provisioning.filesToCreate.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## Environment Variables",
    ...(provisioning.environmentVariables.length
      ? provisioning.environmentVariables.map((name) => `- ${name}`)
      : ["- None"]),
    "",
    "## External Services",
    ...(provisioning.externalServices.length ? provisioning.externalServices.map((name) => `- ${name}`) : ["- None"]),
  ].join("\n");

  const document = await vscode.workspace.openTextDocument({ language: "markdown", content });
  await vscode.window.showTextDocument(document, { preview: false });
}

export async function generateAgentFilesCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const root = workspaceRoot();
  const buildSession = deps.stateStore.getBuildSession();
  const files = renderGeneratedFiles(current.runbook, { activeProvider: buildSession });
  const plan = await planGeneratedFiles(files, (logicalPath) => readWorkspaceExisting(root, logicalPath));
  const summary = summarizeGeneratedFilePlan(plan);
  const choice = await vscode.window.showInformationMessage(
    `Generate DryLake preview artifacts? ${summary}. Existing changed preview files receive .drylake.bak backups.`,
    { modal: true },
    "Generate",
  );

  if (choice !== "Generate") {
    return;
  }

  const result = await writeGeneratedFiles({ rootUri: root, plan });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode.window.showInformationMessage(
    `Generated ${result.written} DryLake preview file${result.written === 1 ? "" : "s"} under .drylake/generated.`,
  );
}

function nextPhase(runbook: ApplicationBuildRunbook) {
  return runbook.phases.find((phase) => phase.status !== "complete") ?? runbook.phases[0];
}

function completePhaseAfterSuccessfulHandoff(runbook: ApplicationBuildRunbook, phaseId: string) {
  const completedPhaseIndex = runbook.phases.findIndex((phase) => phase.id === phaseId);
  if (completedPhaseIndex === -1) {
    return { runbook };
  }

  const nextActiveIndex = runbook.handoff.autopilot
    ? runbook.phases.findIndex(
      (phase, index) => index > completedPhaseIndex && phase.status !== "complete",
    )
    : -1;
  let completedPhase: ApplicationBuildRunbook["phases"][number] | undefined;
  let nextActive: ApplicationBuildRunbook["phases"][number] | undefined;

  const phases: ApplicationBuildRunbook["phases"] = runbook.phases.map((phase, index) => {
    if (index === completedPhaseIndex) {
      completedPhase = {
        ...phase,
        status: "complete" as const,
        steps: phase.steps.map((step) => ({ ...step, status: "complete" as const })),
      };
      return completedPhase;
    }

    if (index === nextActiveIndex) {
      nextActive = { ...phase, status: "active" as const };
      return nextActive;
    }

    return phase.status === "active" ? { ...phase, status: "pending" as const } : phase;
  });

  return {
    runbook: {
      ...runbook,
      phases,
    },
    completedPhase,
    nextActive,
  };
}

export async function exportHandoffPromptCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const phase = nextPhase(current.runbook);
  if (!phase) {
    void vscode.window.showWarningMessage("The current DryLake plan has no phases.");
    return;
  }

  const buildSession = deps.stateStore.getBuildSession();
  const content = renderPhasePrompt(current.runbook, phase, { activeProvider: buildSession });
  await vscode.env.clipboard.writeText(content);
  const document = await vscode.workspace.openTextDocument({ language: "markdown", content });
  await vscode.window.showTextDocument(document, { preview: false });
  void vscode.window.showInformationMessage("Phase handoff prompt copied to clipboard.");
}

export async function runNextPhaseCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const phase = nextLaunchablePhase(current.runbook);
  if (!phase) {
    void vscode.window.showInformationMessage("All DryLake phases are complete.");
    return;
  }

  await handoffPhaseCommand(deps, phase.id);
}

export async function handoffPhaseCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown, handoffActionArg?: unknown) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const handoffAction = handoffActionFromArg(handoffActionArg);
  if (!phaseId) {
    void vscode.window.showWarningMessage("DryLake could not start the handoff because no phase was specified.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const phase = current.runbook.phases.find((item) => item.id === phaseId);
  if (!phase) {
    void vscode.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }

  const launchablePhase = nextLaunchablePhase(current.runbook);
  if (handoffAction === "run" && launchablePhase && launchablePhase.id !== phase.id) {
    void vscode.window.showWarningMessage(
      `Complete ${launchablePhase.title} before running ${phase.title}. DryLake runs phases in order.`,
    );
    return;
  }

  const agent = explicitPhaseAgent(phase.agent);
  if (!agent) {
    void vscode.window.showWarningMessage(`Select an agent for ${phase.title} before running this phase.`);
    return;
  }

  const buildSession = deps.stateStore.getBuildSession();
  const promptPhase = { ...phase, agent };
  const handoffProfile = handoffAction === "run"
    ? await resolveHandoffProfile(agent, phase.handoffProfile)
    : undefined;
  const content = renderPhasePrompt(current.runbook, promptPhase, { activeProvider: buildSession, handoffProfile });
  const workspaceUri = workspaceRoot();
  const promptFile = await writePhaseHandoffFile({ workspaceUri, phase, agent, content });

  let message = "";
  let warning = false;

  if (handoffAction === "copy") {
    await vscode.env.clipboard.writeText(content);
    message = "Phase prompt copied to clipboard.";
  } else if (handoffAction === "markdown") {
    const document = await vscode.workspace.openTextDocument(promptFile);
    await vscode.window.showTextDocument(document, { preview: false });
    message = `Exported Markdown handoff to ${relativePath(promptFile)}.`;
  } else if (handoffAction === "script-sh" || handoffAction === "script-bat") {
    const shell = handoffAction === "script-sh" ? "sh" : "bat";
    try {
      const scriptFile = await writePhaseHandoffScript({ workspaceUri, agent, promptFile, shell });
      const document = await vscode.workspace.openTextDocument(scriptFile);
      await vscode.window.showTextDocument(document, { preview: false });
      message = `Exported ${shell === "sh" ? "bash" : "Windows batch"} handoff script to ${relativePath(scriptFile)}.`;
    } catch (error) {
      warning = true;
      const detail = error instanceof Error ? error.message : String(error);
      message = `DryLake could not export a script for this phase: ${detail}`;
    }
  } else {
    const launchResult = await launchPhaseAgent({ agent, prompt: content, promptFile, workspaceUri });

    if (launchResult.status === "launched") {
      const completion = completePhaseAfterSuccessfulHandoff(current.runbook, phaseId);
      await deps.sessionStore.writeRunbook(current.uri, completion.runbook);

      const completedTitle = completion.completedPhase?.title ?? phase.title;
      if (completion.runbook.handoff.autopilot && completion.nextActive) {
        if (!explicitPhaseAgent(completion.nextActive.agent)) {
          warning = true;
          message = `${completedTitle} complete. Autopilot is paused until you select an agent for ${completion.nextActive.title}.`;
        } else {
          await deps.controlRoom.refresh();
          await deps.refreshSidebar();
          void vscode.window.showInformationMessage(
            `${completedTitle} complete. Autopilot starting ${completion.nextActive.title}.`,
          );
          await handoffPhaseCommand(deps, completion.nextActive.id);
          return;
        }
      } else {
        const nextPending = completion.runbook.phases.find((item) => item.status !== "complete");
        message = nextPending
          ? `${completedTitle} complete. Use Run Next Phase to continue.`
          : `${completedTitle} complete. All phases done.`;
      }
    } else {
      warning = launchResult.status === "not-installed" || launchResult.status === "failed";
      message = `${launchResult.message} Prompt copied to clipboard.`;
      await showAgentLaunchFallbackActions({
        result: launchResult,
        promptContent: content,
        promptFile,
      });
      message = "";
    }
  }

  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  const notify = warning
    ? vscode.window.showWarningMessage
    : vscode.window.showInformationMessage;
  if (message) {
    void notify(message);
  }
}

export async function updatePhaseAgentCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown, agentArg?: unknown) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const agent = phaseAgentFromArg(agentArg);

  if (!phaseId || !agent) {
    void vscode.window.showWarningMessage("DryLake could not update the phase agent because the request was invalid.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  let changed = false;
  const updated: ApplicationBuildRunbook = {
    ...current.runbook,
    phases: current.runbook.phases.map((phase) => {
      if (phase.id !== phaseId) {
        return phase;
      }

      changed = true;
      return {
        ...phase,
        agent,
        handoffProfile: handoffProfileMatchesAgent(agent, phase.handoffProfile)
          ? phase.handoffProfile
          : undefined,
      };
    }),
  };

  if (!changed) {
    void vscode.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }

  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function updatePhaseHandoffProfileCommand(
  deps: RunbookCommandDeps,
  phaseIdArg?: unknown,
  logicalPathArg?: unknown,
) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const logicalPath = typeof logicalPathArg === "string" ? logicalPathArg.trim().replace(/\\/g, "/") : "";

  if (!phaseId) {
    void vscode.window.showWarningMessage("DryLake could not update the phase skill because the request was invalid.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const phase = current.runbook.phases.find((item) => item.id === phaseId);
  if (!phase) {
    void vscode.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }

  const agent = explicitPhaseAgent(phase.agent);
  if (!agent) {
    void vscode.window.showWarningMessage(`Select an agent for ${phase.title} before selecting a skill.`);
    return;
  }

  let selectedProfile: XuHandoffProfileRef | undefined;
  if (logicalPath) {
    const profiles = await collectHandoffProfiles(agent);
    const match = profiles.find((profile) => profile.logicalPath === logicalPath);
    if (!match) {
      void vscode.window.showWarningMessage(`DryLake could not find that ${phase.title} skill/profile for ${phaseAgentLabel(agent)}.`);
      return;
    }
    selectedProfile = handoffProfileRef(match);
  }

  const updated: ApplicationBuildRunbook = {
    ...current.runbook,
    phases: current.runbook.phases.map((item) => (
      item.id === phaseId ? { ...item, handoffProfile: selectedProfile } : item
    )),
  };

  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function updatePhaseStatusCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown, statusArg?: unknown) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const status = phaseStatusFromArg(statusArg);

  if (!phaseId || !status) {
    void vscode.window.showWarningMessage("DryLake could not update the phase status because the request was invalid.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  let changed = false;
  const updated: ApplicationBuildRunbook = {
    ...current.runbook,
    phases: current.runbook.phases.map((phase) => {
      if (phase.id !== phaseId) {
        return phase;
      }

      changed = true;
      return { ...phase, status };
    }),
  };

  if (!changed) {
    void vscode.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }

  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function toggleAutopilotCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const enabled = !current.runbook.handoff.autopilot;
  const updated: ApplicationBuildRunbook = {
    ...current.runbook,
    handoff: {
      ...current.runbook.handoff,
      autopilot: enabled,
    },
  };

  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
  void vscode.window.showInformationMessage(
    enabled ? "Autopilot mode enabled." : "DryLake will require approval between phases.",
  );
}

function stepStatusFromArg(arg: unknown): XuStepStatus | undefined {
  return arg === "pending" ||
    arg === "active" ||
    arg === "approved" ||
    arg === "needs-revision" ||
    arg === "complete"
    ? arg
    : undefined;
}

export async function toggleStepCommand(
  deps: RunbookCommandDeps,
  phaseIdArg?: unknown,
  stepIdArg?: unknown,
  statusArg?: unknown,
) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const stepId = typeof stepIdArg === "string" ? stepIdArg.trim() : "";
  const nextStatus = stepStatusFromArg(statusArg) ?? "complete";

  if (!phaseId || !stepId) {
    void vscode.window.showWarningMessage("DryLake could not toggle the step because the request was invalid.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  let stepFound = false;
  let phaseWithUpdatedSteps: ApplicationBuildRunbook["phases"][number] | undefined;
  const phasesAfterStepUpdate = current.runbook.phases.map((phase) => {
    if (phase.id !== phaseId) {
      return phase;
    }

    const nextSteps = phase.steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }
      stepFound = true;
      return { ...step, status: nextStatus };
    });
    phaseWithUpdatedSteps = { ...phase, steps: nextSteps };
    return phaseWithUpdatedSteps;
  });

  if (!stepFound || !phaseWithUpdatedSteps) {
    void vscode.window.showWarningMessage(`DryLake could not find step ${stepId} in phase ${phaseId}.`);
    return;
  }

  const allStepsComplete =
    phaseWithUpdatedSteps.steps.length > 0 &&
    phaseWithUpdatedSteps.steps.every(
      (step) => step.status === "complete" || step.status === "approved",
    );

  let didCompletePhase = false;
  let phases = phasesAfterStepUpdate;
  if (allStepsComplete && phaseWithUpdatedSteps.status !== "complete") {
    didCompletePhase = true;
    const completedPhaseIndex = phases.findIndex((phase) => phase.id === phaseId);
    phases = phases.map((phase, index) => {
      if (index === completedPhaseIndex) {
        return { ...phase, status: "complete" };
      }
      return phase;
    });

    if (current.runbook.handoff.autopilot) {
      const nextPendingIndex = phases.findIndex(
        (phase, index) => index > completedPhaseIndex && phase.status !== "complete",
      );
      if (nextPendingIndex !== -1) {
        phases = phases.map((phase, index) =>
          index === nextPendingIndex ? { ...phase, status: "active" } : phase,
        );
      }
    }
  }

  const updated: ApplicationBuildRunbook = {
    ...current.runbook,
    phases,
  };

  await deps.sessionStore.writeRunbook(current.uri, updated);
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();

  if (didCompletePhase) {
    if (updated.handoff.autopilot) {
      const nextActive = updated.phases.find((phase) => phase.status === "active");
      if (nextActive) {
        if (!explicitPhaseAgent(nextActive.agent)) {
          void vscode.window.showWarningMessage(
            `${phaseWithUpdatedSteps.title} complete. Autopilot is paused until you select an agent for ${nextActive.title}.`,
          );
          return;
        }

        void vscode.window.showInformationMessage(
          `${phaseWithUpdatedSteps.title} complete. Autopilot starting ${nextActive.title}.`,
        );
        await handoffPhaseCommand(deps, nextActive.id);
        return;
      }
    }

    const nextPending = updated.phases.find((phase) => phase.status === "pending");
    if (nextPending) {
      void vscode.window.showInformationMessage(`${phaseWithUpdatedSteps.title} complete. Use Run Next Phase to continue.`);
    } else {
      void vscode.window.showInformationMessage(`${phaseWithUpdatedSteps.title} complete. All phases done.`);
    }
  }
}

export async function reorderPhaseCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown, afterPhaseIdArg?: unknown) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const afterPhaseId = typeof afterPhaseIdArg === "string" && afterPhaseIdArg.trim()
    ? afterPhaseIdArg.trim()
    : null;

  if (!phaseId) {
    void vscode.window.showWarningMessage("DryLake could not reorder the phase because the request was invalid.");
    return;
  }

  if (phaseId === afterPhaseId) {
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage(NO_LOCAL_PLAN_MESSAGE);
    return;
  }

  const phaseIndex = current.runbook.phases.findIndex((phase) => phase.id === phaseId);
  if (phaseIndex === -1) {
    void vscode.window.showWarningMessage(`DryLake could not find phase ${phaseId}.`);
    return;
  }

  const movingPhase = current.runbook.phases[phaseIndex];
  const remainingPhases = current.runbook.phases.filter((phase) => phase.id !== phaseId);
  let insertionIndex = 0;

  if (afterPhaseId) {
    const afterIndex = remainingPhases.findIndex((phase) => phase.id === afterPhaseId);
    if (afterIndex === -1) {
      void vscode.window.showWarningMessage(`DryLake could not find phase ${afterPhaseId}.`);
      return;
    }

    insertionIndex = afterIndex + 1;
  }

  const phases = [
    ...remainingPhases.slice(0, insertionIndex),
    movingPhase,
    ...remainingPhases.slice(insertionIndex),
  ];

  if (phases.map((phase) => phase.id).join("\u0000") === current.runbook.phases.map((phase) => phase.id).join("\u0000")) {
    return;
  }

  await deps.sessionStore.writeRunbook(current.uri, {
    ...current.runbook,
    phases,
  });
  await deps.controlRoom.refresh();
  await deps.refreshSidebar();
}

export async function openRunbookCommand(deps: RunbookCommandDeps) {
  const uri = (await deps.sessionStore.findRunbookUri()) ?? deps.sessionStore.getDefaultRunbookUri();
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await deps.sessionStore.writeRunbook(uri, {
      ...parseXu(renderXu((await deps.sessionStore.ensureRunbook({ prompt: "", mode: "plan" })).runbook)).runbook!,
    });
  }
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
}
