import * as vscode from "vscode";

import { resolveDryLakeAiProvider } from "../ai/providerResolver";
import { parseAiRunbookResponse } from "../ai/parseAiRunbookResponse";
import { renderGeneratedFiles } from "../generators/renderGeneratedFiles";
import { planGeneratedFiles, summarizeGeneratedFilePlan } from "../generators/planGeneratedFiles";
import { readWorkspaceExisting, writeGeneratedFiles } from "../generators/writeGeneratedFiles";
import { renderPhasePrompt } from "../generators/renderPhasePrompt";
import { applyApproval } from "../xu/approvalState";
import { createLocalDraftXu } from "../xu/createLocalDraftXu";
import { parseXu } from "../xu/parseXu";
import { renderXu } from "../xu/renderXu";
import { validateXu } from "../xu/validateXu";
import { XuSessionStore } from "../xu/sessionStore";
import type { DryLakeAiProvider } from "../ai/DryLakeAiProvider";
import type { ApiClient } from "../services/apiClient";
import type { StateStore } from "../services/stateStore";
import type { ControlRoomProvider } from "../webview/controlRoomProvider";
import { requireXupraProAiEntitlement } from "../services/featureGates";
import { scanWorkspaceFiles, getWorkspaceDisplayName } from "../services/workspaceScanner";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ApplicationBuildRunbook, XuMode, XuPhaseAgent, XuStepStatus } from "../xu/types";

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
    description: "Review existing code and produce a correction runbook",
    mode: "review",
  },
];

function workspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake build session.");
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

function phaseStatusFromArg(arg: unknown): Extract<XuStepStatus, "pending" | "active" | "complete"> | undefined {
  return arg === "pending" || arg === "active" || arg === "complete" ? arg : undefined;
}

function modeFromArg(arg: unknown): XuMode | undefined {
  if (typeof arg !== "string") {
    return undefined;
  }

  const normalized = arg.trim();
  return MODE_CHOICES.some((item) => item.mode === normalized) ? (normalized as XuMode) : undefined;
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

async function resolveProvider(stateStore: StateStore): Promise<DryLakeAiProvider> {
  return resolveDryLakeAiProvider({
    configuration: vscode.workspace.getConfiguration("drylake"),
    readConnection: () => stateStore.getConnection(),
    readAccessToken: () => stateStore.getAccessToken(),
  });
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
      prompt: "Paste the YAML runbook returned by your external AI tool.",
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

async function applyAiDraft(params: {
  deps: RunbookCommandDeps;
  prompt: string;
  mode: XuMode;
  runbook: ApplicationBuildRunbook;
  runbookUri: vscode.Uri;
  provider: DryLakeAiProvider;
  openExternalPrompt: boolean;
}) {
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
    if (params.provider.id === "xupra-pro-ai" && params.deps.stateStore.getConnection().userEmail) {
      await requireXupraProAiEntitlement(params.deps.apiClient, params.deps.stateStore, "Xupra Pro AI");
      return localDraft;
    }

    void vscode.window.showInformationMessage(
      `${params.provider.label} is not available, so DryLake created a local draft runbook.`,
    );
    return localDraft;
  }

  if (params.provider.id === "external-ai-prompt" && !params.openExternalPrompt) {
    void vscode.window.showInformationMessage("DryLake created a local draft runbook.");
    return localDraft;
  }

  const result = await params.provider.generateDraftRunbook({
    prompt: params.prompt,
    mode: params.mode,
    workspaceSummary,
    currentRunbook: localDraft,
  });

  if (result.runbook) {
    await params.deps.sessionStore.writeRunbook(params.runbookUri, result.runbook);
    return result.runbook;
  }

  if (result.promptForExternalAi) {
    await openGeneratedPromptDocument("DryLake External AI Prompt", result.promptForExternalAi);
    await maybeImportExternalResult(params.deps.sessionStore, params.runbookUri);
  }

  if (result.message) {
    void vscode.window.showInformationMessage(result.message);
  }

  return localDraft;
}

export async function openControlRoomCommand(deps: RunbookCommandDeps, context: vscode.ExtensionContext) {
  await deps.controlRoom.createOrShow(context);
}

export async function startBuildSessionCommand(
  deps: RunbookCommandDeps,
  context: vscode.ExtensionContext,
  modeArg?: unknown,
  promptArg?: unknown,
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

  if (!prompt?.trim()) {
    return;
  }

  await deps.controlRoom.createOrShow(context);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Starting DryLake build session...",
      cancellable: false,
    },
    async () => {
      const provider = await resolveProvider(deps.stateStore);
      const ensured = await deps.sessionStore.ensureRunbook({ prompt: prompt.trim(), mode });
      const session = await deps.sessionStore.createSession({
        prompt: prompt.trim(),
        mode,
        runbookPath: relativePath(ensured.uri),
        providerId: provider.id,
        providerLabel: provider.label,
      });
      await deps.stateStore.setBuildSession(session);
      await applyAiDraft({
        deps,
        prompt: prompt.trim(),
        mode,
        runbook: ensured.runbook,
        runbookUri: ensured.uri,
        provider,
        openExternalPrompt: false,
      });
    },
  );

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
    title: "Generate Draft XU Runbook",
    prompt: "Describe the task to convert into drylake.xu.",
    value: defaultPrompt,
    ignoreFocusOut: true,
  });

  if (!prompt?.trim()) {
    return;
  }

  const provider = await resolveProvider(deps.stateStore);
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
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
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
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
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
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
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
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }

  const root = workspaceRoot();
  const files = renderGeneratedFiles(current.runbook);
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

export async function exportHandoffPromptCommand(deps: RunbookCommandDeps) {
  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
    return;
  }

  const phase = nextPhase(current.runbook);
  if (!phase) {
    void vscode.window.showWarningMessage("drylake.xu has no phases.");
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
  await exportHandoffPromptCommand(deps);
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
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
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
      return { ...phase, agent };
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

export async function updatePhaseStatusCommand(deps: RunbookCommandDeps, phaseIdArg?: unknown, statusArg?: unknown) {
  const phaseId = typeof phaseIdArg === "string" ? phaseIdArg.trim() : "";
  const status = phaseStatusFromArg(statusArg);

  if (!phaseId || !status) {
    void vscode.window.showWarningMessage("DryLake could not update the phase status because the request was invalid.");
    return;
  }

  const current = await deps.sessionStore.readRunbook();
  if (!current) {
    void vscode.window.showWarningMessage("No drylake.xu runbook found. Start a build session first.");
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
