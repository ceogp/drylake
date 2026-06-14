import { createHash } from "node:crypto";

import * as vscode from "vscode";

import {
  phaseAgentHandoffOptions,
  phaseAgentHint,
  phaseAgentLabel,
} from "../agents/phaseAgentLauncher";
import { collectHandoffProfiles } from "../agents/handoffProfiles";
import type { HandoffProfileSelection } from "../agents/handoffProfiles";
import { describePhaseChange, isPendingPhaseUnresolved } from "../xu/pendingPlanChanges";
import { XuSessionStore } from "../xu/sessionStore";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ChatState, PlanningModelTier, PlanningProviderInfo } from "../services/stateStore";
import type { DryLakeProviderId } from "../ai/DryLakeAiProvider";
import type { ConnectionState } from "../types/package";
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuStepStatus } from "../xu/types";
import type { PendingPlanChangeSet } from "../xu/pendingPlanChanges";
import { collectGuardUploadArtifacts, renderSafeDeveloperSummary, runSecurityScan, writeSecurityScanReports } from "../services/securityScanner";
import type { GuardReportPaths, GuardScanResult, GuardSeverity } from "../services/securityScanner";
import type { ApiClient, CloudAnalysisPayload, GuardFixPlan, GuardFixPlanPayload, GuardScanUploadArtifact, GuardScanUploadPayload } from "../services/apiClient";
const CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
const CONTROL_ROOM_CHAT_COLLAPSED_KEY = "drylake.controlRoomChatCollapsed";
const FREE_PLANNING_MODEL_LABEL = "Claude Haiku";
const TEAM_BASELINE_ROLE_MESSAGE = "Only team owners and admins can create a Guard baseline for this workspace.";
type ControlRoomView = "pipeline" | "kanban" | "security";
type HandoffProfilesByAgent = Partial<Record<(typeof XU_PHASE_AGENTS)[number], HandoffProfileSelection[]>>;
type GuardUploadStatus = "idle" | "recording" | "uploading" | "uploaded" | "local" | "failed";
type GuardFixStatus = "idle" | "generating" | "ready" | "failed";
type RegistrationEnsurer = () => Promise<boolean>;

const MODE_CARDS: Array<[string, XuMode, string]> = [
  ["Build", "build-app", "Turn an app idea into purpose, architecture, steps, and a ship plan."],
  ["Break Into Steps", "phases", "Clarify intent, then split the task into safe coding steps."],
  ["Plan", "plan", "Generate a file-aware plan for a complex repo change."],
  ["Review", "review", "Review existing code and produce a correction plan."],
];

type PlanningProviderChoiceId =
  | "xupra-nano"
  | "xupra-foundation"
  | "databricks-api"
  | "claude-api"
  | "openai-api"
  | "hermes-agent";

const PLANNING_PROVIDERS: Array<{
  choiceId: PlanningProviderChoiceId;
  providerId: DryLakeProviderId;
  label: string;
  description: string;
  proOnly?: boolean;
}> = [
  {
    choiceId: "xupra-nano",
    providerId: "xupra-pro-ai",
    label: `Free User - ${FREE_PLANNING_MODEL_LABEL}`,
    description: "Hosted starter planning",
  },
  {
    choiceId: "xupra-foundation",
    providerId: "xupra-pro-ai",
    label: "Xupra AI - Frontier Models",
    description: "Advanced Pro planning",
    proOnly: true,
  },
  { choiceId: "databricks-api", providerId: "databricks-api", label: "Databricks API", description: "BYO endpoint" },
  { choiceId: "claude-api", providerId: "claude-api", label: "Claude API", description: "BYO Anthropic key" },
  { choiceId: "openai-api", providerId: "openai-api", label: "OpenAI API", description: "BYO OpenAI key" },
  { choiceId: "hermes-agent", providerId: "hermes-agent", label: "Hermes Agent CLI", description: "Local/BYO model" },
];

const STAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type PlanningProviderChoice = (typeof PLANNING_PROVIDERS)[number];

const CONFIGURABLE_PLANNING_PROVIDER_IDS = new Set<DryLakeProviderId>([
  "databricks-api",
  "claude-api",
  "openai-api",
  "hermes-agent",
]);

const STATUS_LABELS: Record<XuStepStatus, string> = {
  pending: "pending",
  active: "active",
  approved: "approved",
  "needs-revision": "needs revision",
  complete: "complete",
};

type SecurityScanTarget = {
  area: string;
  pathHint: string;
  detail: string;
};

const SECURITY_SCAN_TARGETS: readonly SecurityScanTarget[] = [
  {
    area: "MCP config files",
    pathHint: ".vscode/mcp.json, .cursor/mcp.json, claude_desktop_config.json",
    detail: "Tooling endpoints, auth variables, and capability declarations.",
  },
  {
    area: "Agent instructions and skills",
    pathHint: "AGENTS.md, CLAUDE.md, .claude/, .agents/, SKILL.md",
    detail: "Agent files and skill rules used by your autonomous workflows.",
  },
  {
    area: "Extensions and manifests",
    pathHint: ".vscode/extensions + package.json manifests",
    detail: "Commands, activation events, settings, and manifest access signals.",
  },
  {
    area: "Secrets and environment references",
    pathHint: ".env, .env.*, .vscode/tasks.json, scripts/**",
    detail: "Names and references that increase blast-radius risk.",
  },
  {
    area: "Deploy / CI / workspace surface",
    pathHint: ".github/workflows, docker/docker-compose, terraform, k8s, package scripts",
    detail: "Cloud, deployment, and infrastructure command paths.",
  },
];

const SECURITY_UPLOAD_TARGETS: readonly SecurityScanTarget[] = [
  {
    area: "MCP configuration",
    pathHint: "MCP server definitions and env variable names",
    detail: "Used to detect unpinned packages, broad tool gateways, and MCP drift.",
  },
  {
    area: "Agent skills and instructions",
    pathHint: "Skill, rule, and instruction files found by the local scan",
    detail: "Used to compare future scans against the reviewed baseline.",
  },
  {
    area: "Redacted Guard report",
    pathHint: "Findings, scores, paths, and secret variable names",
    detail: "Secret values are not stored or uploaded by the scan.",
  },
];

function renderSecurityScanInProgress() {
  return `<section class="security-progress" aria-label="DryLake Guard scan progress">
    <h3>What is being scanned locally</h3>
    <p>Guard checks all relevant workspace metadata first, then builds risk findings from local evidence.</p>
    <div class="security-progress-list">
      ${SECURITY_SCAN_TARGETS.map((target) => `<article class="security-progress-item">
        <strong>${escapeHtml(target.area)}</strong>
        <small>${escapeHtml(target.pathHint)}</small>
        <span>${escapeHtml(target.detail)}</span>
      </article>`).join("")}
    </div>
    <div class="security-note">No workspace files are exfiltrated during local scan. Values are never stored.</div>
  </section>`;
}

function renderGuardUploadDisclosure() {
  return `<div class="security-upload-detail" aria-label="Active Guard upload details">
    <span class="security-upload-title">What may be uploaded after approval</span>
    ${SECURITY_UPLOAD_TARGETS.map((target) => `<div class="security-upload-row">
      <strong>${escapeHtml(target.area)}</strong>
      <small>${escapeHtml(target.pathHint)}</small>
      <span>${escapeHtml(target.detail)}</span>
    </div>`).join("")}
  </div>`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function billingCommandArgs(args: { required?: string; source?: string; returnPath?: string } | null) {
  if (!args) {
    return "";
  }

  return ` data-command-args="${escapeHtml(JSON.stringify(args))}"`;
}

function parseBillingCommandArgs(element: Element | null): unknown[] {
  if (!element) {
    return [];
  }

  const raw = element.getAttribute("data-command-args");
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function controlRoomViewFrom(value: unknown): ControlRoomView {
  return value === "kanban" || value === "security" ? value : "pipeline";
}

function modeFrom(value: unknown): XuMode {
  return typeof value === "string" && MODE_CARDS.some(([, mode]) => mode === value)
    ? (value as XuMode)
    : "build-app";
}

function planningProviderFrom(value: unknown): DryLakeProviderId {
  return typeof value === "string" && PLANNING_PROVIDERS.some((provider) => provider.providerId === value)
    ? (value as DryLakeProviderId)
    : "xupra-pro-ai";
}

function stageCountFrom(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const rounded = Math.round(numeric);
  return rounded >= 1 && rounded <= 12 ? rounded : undefined;
}

function hasFoundationPlanningAccess(connection: ConnectionState) {
  const tier = String(connection.organizationTier ?? "").toLowerCase();
  return Boolean(connection.entitlements?.xupra_pro_ai || tier === "pro" || tier === "enterprise");
}

function hasRegisteredConnection(connection: ConnectionState) {
  return Boolean(connection.userEmail || connection.organizationId);
}

function workspaceHash() {
  const roots = (vscode.workspace.workspaceFolders ?? [])
    .map((folder) => folder.uri.fsPath)
    .sort()
    .join("|");

  if (!roots) {
    return undefined;
  }

  return createHash("sha256").update(roots).digest("hex");
}

function guardScanUploadPayload(
  scan: GuardScanResult,
  consentMode: GuardScanUploadPayload["consentMode"],
  artifacts: GuardScanUploadArtifact[] = [],
): GuardScanUploadPayload {
  return {
    workspaceHash: workspaceHash(),
    sourceClient: "vscode",
    consentMode,
    scan: {
      scannedAt: scan.scannedAt,
      score: scan.score,
      rank: scan.rank,
      summary: { ...scan.summary },
      categoryScores: { ...scan.categoryScores },
      findings: scan.findings.map((finding) => ({ ...finding })),
      connectionMap: scan.connectionMap as unknown as Record<string, unknown>,
      extensions: scan.extensions.map((extension) => ({
        id: extension.id,
        displayName: extension.displayName,
        publisher: extension.publisher,
        version: extension.version,
        isActive: extension.isActive,
        isBuiltin: extension.isBuiltin,
        accessLevel: extension.accessLevel,
        activationEvents: limited(extension.activationEvents, 40),
        contributionPoints: limited(extension.contributionPoints, 40),
        capabilityTags: limited(extension.capabilityTags, 40),
        riskFlags: limited(extension.riskFlags, 40),
      })),
      mcpServers: scan.mcpServers.map((server) => ({
        configPath: server.configPath,
        name: server.name,
        command: server.command,
        args: limited(server.args, 40),
        envKeys: limited(server.envKeys, 40),
        capabilities: limited(server.capabilities, 40),
        riskFlags: limited(server.riskFlags, 40),
        severity: server.severity,
        blastRadius: server.blastRadius,
      })),
      workspaceSurface: {
        deploymentFiles: limited(scan.workspaceSurface.deploymentFiles, 100),
        iacFiles: limited(scan.workspaceSurface.iacFiles, 100),
        ciWorkflowFiles: limited(scan.workspaceSurface.ciWorkflowFiles, 100),
        credentialLikeFiles: limited(scan.workspaceSurface.credentialLikeFiles, 100),
        riskyPackageScripts: limited(scan.workspaceSurface.riskyPackageScripts, 100),
        generatedFolders: limited(scan.workspaceSurface.generatedFolders, 100),
      },
      packageManagers: scan.packageManagers,
      packageScripts: scan.packageScripts,
    },
    artifacts,
  };
}

function limited<T>(items: readonly T[], count: number) {
  return items.slice(0, count);
}

function guardFixPlanPayload(scan: GuardScanResult): GuardFixPlanPayload {
  const sortedFindings = [...scan.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));

  return {
    workspaceHash: workspaceHash(),
    sourceClient: "vscode",
    scan: {
      scannedAt: scan.scannedAt,
      score: scan.score,
      rank: scan.rank,
      summary: { ...scan.summary },
      categoryScores: { ...scan.categoryScores },
      findings: limited(sortedFindings, 60).map((finding) => ({
        id: finding.id,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        evidence: finding.evidence,
        recommendation: finding.recommendation,
        source: finding.source,
        path: finding.path,
        line: finding.line,
      })),
      extensions: limited(scan.extensions, 40).map((extension) => ({
        id: extension.id,
        displayName: extension.displayName,
        publisher: extension.publisher,
        isActive: extension.isActive,
        accessLevel: extension.accessLevel,
        capabilityTags: limited(extension.capabilityTags, 16),
        riskFlags: limited(extension.riskFlags, 16),
        accessSignals: limited(extension.accessSignals, 12),
      })),
      secrets: limited(scan.secrets, 80).map((secret) => ({
        path: secret.path,
        line: secret.line,
        type: secret.type,
        variableName: secret.variableName,
        severity: secret.severity,
      })),
      mcpServers: limited(scan.mcpServers, 30).map((server) => ({
        configPath: server.configPath,
        name: server.name,
        command: server.command,
        envKeys: limited(server.envKeys, 20),
        capabilities: limited(server.capabilities, 20),
        riskFlags: limited(server.riskFlags, 20),
        severity: server.severity,
        blastRadius: server.blastRadius,
      })),
      workspaceSurface: {
        deploymentFiles: limited(scan.workspaceSurface.deploymentFiles, 40),
        iacFiles: limited(scan.workspaceSurface.iacFiles, 40),
        ciWorkflowFiles: limited(scan.workspaceSurface.ciWorkflowFiles, 40),
        credentialLikeFiles: limited(scan.workspaceSurface.credentialLikeFiles, 40),
        riskyPackageScripts: limited(scan.workspaceSurface.riskyPackageScripts, 60).map((script) => ({
          path: script.path,
          name: script.name,
          risk: script.risk,
        })),
        generatedFolders: limited(scan.workspaceSurface.generatedFolders, 25),
      },
      connectionMap: {
        highRiskPaths: limited(scan.connectionMap.highRiskPaths, 40),
        edges: limited(scan.connectionMap.edges, 60).map((edge) => ({
          from: edge.from,
          to: edge.to,
          label: edge.label,
          severity: edge.severity,
        })),
      },
    },
  };
}

function cloudAnalysisPayload(scan: GuardScanResult): CloudAnalysisPayload {
  return {
    approvedPayload: {
      scanManifest: {
        scannedAt: scan.scannedAt,
        score: scan.score,
        rank: scan.rank,
        summary: scan.summary,
        categoryScores: scan.categoryScores,
      },
      redactedFindings: scan.findings.map((finding) => ({
        id: finding.id,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        evidence: finding.safeToShare ? finding.evidence : "[REDACTED]",
        recommendation: finding.recommendation,
        source: finding.source,
        path: finding.safeToShare ? finding.path : undefined,
        line: finding.safeToShare ? finding.line : undefined,
      })),
      dependencyMetadata: {
        packageManagers: scan.packageManagers,
        packageScripts: scan.packageScripts,
        riskyPackageScripts: scan.workspaceSurface.riskyPackageScripts,
      },
      mcpMetadata: {
        servers: scan.mcpServers.map((server) => ({
          configPath: server.configPath,
          name: server.name,
          command: server.command,
          envKeys: server.envKeys,
          capabilities: server.capabilities,
          riskFlags: server.riskFlags,
          severity: server.severity,
          blastRadius: server.blastRadius,
        })),
      },
      extensionMetadata: {
        extensions: scan.extensions.map((extension) => ({
          id: extension.id,
          displayName: extension.displayName,
          publisher: extension.publisher,
          isActive: extension.isActive,
          isBuiltin: extension.isBuiltin,
          accessLevel: extension.accessLevel,
          capabilityTags: extension.capabilityTags,
          riskFlags: extension.riskFlags,
        })),
      },
      filePathInventory: [
        ...scan.agentFiles.map((file) => file.logicalPath),
        ...scan.workspaceSurface.ciWorkflowFiles.map((file) => file.path),
        ...scan.workspaceSurface.iacFiles.map((file) => file.path),
        ...scan.workspaceSurface.deploymentFiles.map((file) => file.path),
        ...scan.workspaceSurface.credentialLikeFiles.map((file) => file.path),
      ],
      selectedPromptFiles: [],
    },
  };
}

async function approveDeepCloudAnalysisUpload(scan: GuardScanResult) {
  const selected = await vscode.window.showWarningMessage(
    "Approve Deep Cloud Analysis upload?",
    {
      modal: true,
      detail: [
        "DryLake will upload only approved, redacted Guard metadata.",
        `Redacted findings: ${scan.findings.length}`,
        `MCP metadata entries: ${scan.mcpServers.length}`,
        `Extension metadata entries: ${scan.extensions.length}`,
        `Package managers: ${scan.packageManagers.length}`,
        `Package scripts: ${scan.packageScripts.length}`,
        `Risky package scripts: ${scan.workspaceSurface.riskyPackageScripts.length}`,
        `File path inventory entries: ${
          scan.agentFiles.length +
          scan.workspaceSurface.ciWorkflowFiles.length +
          scan.workspaceSurface.iacFiles.length +
          scan.workspaceSurface.deploymentFiles.length +
          scan.workspaceSurface.credentialLikeFiles.length
        }`,
        "Raw secrets, .env values, private keys, full source files, and unapproved source files are not uploaded.",
      ].join("\n"),
    },
    "Approve Upload",
    "Cancel",
  );

  return selected === "Approve Upload";
}

function hasPaidGuardAccess(connection: ConnectionState) {
  return Boolean(connection.entitlements?.canUseFixWithAI);
}

function hasDeepCloudAnalysisAccess(connection: ConnectionState) {
  return Boolean(connection.entitlements?.canUseApprovedUpload && connection.entitlements?.canUseDeepCloudAnalysis);
}

function canManageTeamBaseline(connection: ConnectionState) {
  return (
    !connection.organizationRole ||
    connection.organizationRole === "owner" ||
    connection.organizationRole === "admin"
  );
}

async function resolveServerCapabilities(
  apiClient: Partial<Pick<ApiClient, "getEntitlements">> | undefined,
): Promise<Record<string, boolean> | null> {
  if (!apiClient?.getEntitlements) {
    return null;
  }

  const entitlements = await apiClient.getEntitlements();
  return entitlements.capabilities;
}

function autopilotEnabled(runbook: ApplicationBuildRunbook | null) {
  return Boolean(runbook?.handoff.autopilot);
}

function statusClass(status: XuStepStatus) {
  return status === "needs-revision" ? "pending" : status;
}

function statusForKanban(status: XuStepStatus) {
  if (status === "active") {
    return "active";
  }

  if (status === "complete" || status === "approved") {
    return "complete";
  }

  return "pending";
}

function renderAgentSelect(phase: XuPhase) {
  const selected = phase.agent;
  const placeholderSelected = selected ? "" : " selected";

  return `<label class="agent-label">Agent<select class="agent-select" data-phase-agent="${escapeHtml(phase.id)}" aria-label="Agent for ${escapeHtml(phase.title)}" title="${escapeHtml(selected ? phaseAgentHint(selected) : "Select the agent that should run this phase.")}">
    <option value="" disabled${placeholderSelected}>Select phase agent</option>
    ${XU_PHASE_AGENTS.map((agent) => {
      const isSelected = agent === selected ? " selected" : "";
      return `<option value="${agent}"${isSelected}>${escapeHtml(phaseAgentLabel(agent))}</option>`;
    }).join("")}
  </select></label>`;
}

function renderHandoffProfileSelect(phase: XuPhase, profilesByAgent: HandoffProfilesByAgent) {
  const selectedAgent = phase.agent;
  const profiles = selectedAgent ? profilesByAgent[selectedAgent] ?? [] : [];
  const currentPath = phase.handoffProfile?.logicalPath ?? "";
  const disabled = selectedAgent ? "" : " disabled";
  const title = selectedAgent
    ? "Optional: add the selected agent's skill or instruction profile to this handoff."
    : "Select an agent before selecting a skill.";

  return `<label class="profile-label">Skill<select class="profile-select" data-phase-profile="${escapeHtml(phase.id)}" aria-label="Skill or profile for ${escapeHtml(phase.title)}" title="${escapeHtml(title)}"${disabled}>
    <option value=""${currentPath ? "" : " selected"}>No skill/profile</option>
    ${profiles.map((profile) => {
      const isSelected = profile.logicalPath === currentPath ? " selected" : "";
      return `<option value="${escapeHtml(profile.logicalPath)}"${isSelected}>${escapeHtml(profile.label)} (${escapeHtml(profile.kind)})</option>`;
    }).join("")}
  </select></label>`;
}

function renderPhaseSteps(phase: XuPhase) {
  if (phase.steps.length === 0) {
    return `<div class="step-count">No steps yet.</div>`;
  }

  const items = phase.steps
    .map((step) => {
      const done = step.status === "complete" || step.status === "approved";
      const checked = done ? " checked" : "";
      const stateClass = done ? " done" : "";
      return `<li class="step-item${stateClass}">
        <label>
          <input type="checkbox" class="step-toggle" data-phase-id="${escapeHtml(phase.id)}" data-step-id="${escapeHtml(step.id)}"${checked} />
          <span>${escapeHtml(step.text)}</span>
        </label>
      </li>`;
    })
    .join("");

  const completed = phase.steps.filter((step) => step.status === "complete" || step.status === "approved").length;

  return `<div class="step-list-wrap">
    <div class="step-count">${completed} / ${phase.steps.length} complete</div>
    <ul class="step-list">${items}</ul>
  </div>`;
}

function renderPhaseTaskFit(phase: XuPhase) {
  const purpose = phase.objective.trim();
  const firstAcceptance = phase.acceptance.find((item) => item.trim().length > 0);

  if (!purpose && !firstAcceptance) {
    return "";
  }

  return `<div class="task-fit-preview" aria-label="Generated task-specific card preview">
    <div class="task-fit-label">This card will do</div>
    ${purpose ? `<div class="task-fit-row"><span>Does</span><p title="${escapeHtml(purpose)}">${escapeHtml(purpose)}</p></div>` : ""}
    ${firstAcceptance ? `<div class="task-fit-row"><span>Done</span><p title="${escapeHtml(firstAcceptance)}">${escapeHtml(firstAcceptance)}</p></div>` : ""}
  </div>`;
}

function renderPlanChangeOverlay(
  phase: XuPhase,
  runbook: ApplicationBuildRunbook,
  pendingPlanChange: PendingPlanChangeSet | null,
) {
  if (!pendingPlanChange || !isPendingPhaseUnresolved(pendingPlanChange, phase.id)) {
    return "";
  }

  const summary = pendingPlanChange.phaseSummaries[phase.id] ??
    describePhaseChange(runbook, pendingPlanChange.proposedRunbook, phase.id);

  return `<div class="plan-change-overlay" aria-label="Pending plan change">
    <div class="plan-change-eyebrow">Proposed change</div>
    <p>${escapeHtml(summary)}</p>
    <div class="plan-change-actions">
      <button type="button" class="plan-change-apply" data-plan-change-action="approve" data-phase-id="${escapeHtml(phase.id)}">Apply</button>
      <button type="button" class="plan-change-reject secondary" data-plan-change-action="reject" data-phase-id="${escapeHtml(phase.id)}">Keep current</button>
    </div>
  </div>`;
}

function renderPhaseCard(
  phase: XuPhase,
  options: {
    draggable: boolean;
    runbook: ApplicationBuildRunbook;
    pendingPlanChange: PendingPlanChangeSet | null;
    profilesByAgent: HandoffProfilesByAgent;
  },
) {
  const dragHandle = options.draggable
    ? `<button type="button" class="drag-handle" draggable="true" data-drag-phase="${escapeHtml(phase.id)}" aria-label="Drag ${escapeHtml(phase.title)} to reorder" title="Drag to reorder"><span></span><span></span><span></span></button>`
    : "";
  const cardClass = `phase-card ${statusClass(phase.status)}${phase.status === "active" ? " active-phase" : ""}`;
  const selectedAgent = phase.agent;
  const actionHint = selectedAgent ? phaseAgentHint(selectedAgent) : "Select a phase agent before running this phase.";
  const handoffOptions = selectedAgent ? phaseAgentHandoffOptions(selectedAgent) : [];
  const primary = handoffOptions.find((option) => option.action === "run");
  const secondary = handoffOptions.filter((option) => option.action !== "run");
  const primaryLabel = primary?.label ?? "Handoff";
  const primaryTitle = primary?.title ?? actionHint;
  const disabled = selectedAgent ? "" : " disabled";
  const secondaryButtons = secondary
    .map((option) => {
      const shortLabel = option.action === "script-sh"
        ? "Export .sh"
        : option.action === "script-bat"
          ? "Export .bat"
          : option.action === "copy"
            ? "Copy prompt"
            : option.action === "markdown"
              ? "Open Markdown"
              : option.label;
      return `<button type="button" class="handoff-menu-item" data-handoff-phase="${escapeHtml(phase.id)}" data-handoff-action="${escapeHtml(option.action)}" title="${escapeHtml(option.title)}"${disabled}>${escapeHtml(shortLabel)}</button>`;
    })
    .join("");
  const markCompleteButton = phase.status === "active"
    ? `<button type="button" class="secondary mark-complete-btn" data-phase-status-update="${escapeHtml(phase.id)}" data-status="complete" title="Mark this phase complete after the agent terminal has finished.">Mark Complete</button>`
    : "";

  return `<article class="${cardClass}" data-phase-id="${escapeHtml(phase.id)}" data-phase-status="${statusForKanban(phase.status)}">
    <div class="phase-card-top">
      ${dragHandle}
      <div class="phase-id">${escapeHtml(phase.id)}</div>
    </div>
    <h3 class="phase-title">${escapeHtml(phase.title)}</h3>
    <span class="badge ${statusClass(phase.status)}">${escapeHtml(STATUS_LABELS[phase.status])}</span>
    <p class="objective" title="${escapeHtml(phase.objective)}">${escapeHtml(phase.objective || "No objective recorded.")}</p>
    ${renderPhaseTaskFit(phase)}
    ${renderAgentSelect(phase)}
    ${renderHandoffProfileSelect(phase, options.profilesByAgent)}
    ${renderPhaseSteps(phase)}
    <div class="phase-actions">
      <button type="button" class="primary handoff-btn" data-handoff-phase="${escapeHtml(phase.id)}" data-handoff-action="run" title="${escapeHtml(primaryTitle)}"${disabled}>${escapeHtml(primaryLabel)}</button>
      ${markCompleteButton}
      <button type="button" class="secondary multi-agent-btn" data-multi-agent-phase="${escapeHtml(phase.id)}" title="Split this phase across multiple selected agents.">Multi-Agent</button>
      <details class="handoff-menu">
        <summary>Export</summary>
        <div class="handoff-menu-items">${secondaryButtons}</div>
      </details>
    </div>
    ${renderPlanChangeOverlay(phase, options.runbook, options.pendingPlanChange)}
  </article>`;
}

function renderExecutionModeToggle(runbook: ApplicationBuildRunbook | null) {
  if (!runbook || runbook.phases.length === 0) {
    return "";
  }

  const enabled = autopilotEnabled(runbook);
  const label = enabled ? "Autopilot" : "Approval Required";
  const detail = enabled ? "Starts next phase after you mark complete" : "Stops after each phase";
  const title = enabled
    ? "DryLake starts the next phase automatically after the current phase is marked complete."
    : "DryLake pauses after each phase so you can approve before starting the next phase.";

  return `<button class="execution-mode-toggle${enabled ? " active" : ""}" data-command="drylake.toggleAutopilot" data-execution-mode data-autopilot="${enabled ? "true" : "false"}" title="${escapeHtml(title)}" aria-pressed="${enabled ? "true" : "false"}">
    <span class="execution-mode-label">Execution Mode</span>
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(detail)}</span>
  </button>`;
}

function renderPipeline(
  runbook: ApplicationBuildRunbook,
  pendingPlanChange: PendingPlanChangeSet | null,
  profilesByAgent: HandoffProfilesByAgent,
) {
  return `<section class="pipeline" aria-label="DryLake plan pipeline">
    ${runbook.phases.map((phase, index) => {
      const card = renderPhaseCard(phase, { draggable: true, runbook, pendingPlanChange, profilesByAgent });
      return index < runbook.phases.length - 1 ? `${card}<div class="arrow" aria-hidden="true">&rarr;</div>` : card;
    }).join("")}
  </section>`;
}

function renderKanbanColumn(
  title: string,
  status: "pending" | "active" | "complete",
  phases: XuPhase[],
  runbook: ApplicationBuildRunbook,
  pendingPlanChange: PendingPlanChangeSet | null,
  profilesByAgent: HandoffProfilesByAgent,
) {
  return `<section class="kanban-column" data-drop-status="${status}">
    <div class="column-header"><span>${escapeHtml(title)}</span><span class="count">${phases.length}</span></div>
    <div class="column-body">
      ${phases.map((phase) => renderPhaseCard(phase, { draggable: true, runbook, pendingPlanChange, profilesByAgent })).join("")}
      <div class="drop-zone">Drop phase here</div>
    </div>
  </section>`;
}

function renderKanban(
  runbook: ApplicationBuildRunbook,
  pendingPlanChange: PendingPlanChangeSet | null,
  profilesByAgent: HandoffProfilesByAgent,
) {
  const pending = runbook.phases.filter((phase) => statusForKanban(phase.status) === "pending");
  const active = runbook.phases.filter((phase) => statusForKanban(phase.status) === "active");
  const complete = runbook.phases.filter((phase) => statusForKanban(phase.status) === "complete");

  return `<section class="kanban" aria-label="DryLake plan kanban">
    ${renderKanbanColumn("To Do", "pending", pending, runbook, pendingPlanChange, profilesByAgent)}
    ${renderKanbanColumn("In Progress", "active", active, runbook, pendingPlanChange, profilesByAgent)}
    ${renderKanbanColumn("Done", "complete", complete, runbook, pendingPlanChange, profilesByAgent)}
  </section>`;
}

function renderKanbanEmptyState() {
  return `<section class="empty-state kanban-empty">
    <h2>No plan yet</h2>
    <p>Describe your task in the chat above - the AI will generate phases here.</p>
  </section>`;
}

function renderKanbanLoadingState() {
  const cards = [1, 2, 3].map(() => `<div class="loading-card" aria-hidden="true">
    <span class="loading-line short"></span>
    <span class="loading-line"></span>
    <span class="loading-line"></span>
    <span class="loading-line medium"></span>
  </div>`).join("");

  return `<section class="loading-state" aria-live="polite" aria-busy="true">
    <div class="loading-title">DryLake is generating your plan...</div>
    <div class="loading-grid">${cards}</div>
  </section>`;
}

function severityWeight(severity: GuardSeverity) {
  if (severity === "critical") return 5;
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  return 1;
}

function renderGuardPaidUpsell(visible: boolean) {
  if (!visible) {
    return "";
  }

  const paidFeatures = [
    "Fix with AI",
    "Active Guard / Watchdog",
    "Deep Cloud Analysis",
    "Team Baseline",
    "Continuous Watch",
    "Suspicious Artifact / malware scan",
  ];

  return `<section class="security-upsell" aria-label="DryLake Guard paid features">
    <div>
      <div class="security-eyebrow">Paid</div>
      <h3>AWS-backed Active Guard</h3>
      <p>Upgrade to use DryLake Guard as an active security layer for agentic IDE setups.</p>
    </div>
    <ul>${paidFeatures.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
    <button type="button" data-command="xupra.openBilling"${billingCommandArgs({
      required: "security_pro",
      source: "extension",
      returnPath: "/app",
    })}>Upgrade for Guard</button>
  </section>`;
}

function renderGuardUploadConsent(
  status: GuardUploadStatus,
  error: string | undefined,
  canCreateTeamBaseline: boolean,
) {
  if (status === "uploaded") {
    return `<section class="security-note good">Guard baseline uploaded. DryLake can compare future scans against this MCP, skill, and agent-rule baseline.</section>`;
  }

  if (status === "local") {
    return `<section class="security-note">Scan kept local. You can still upload a Guard baseline later to enable drift detection.</section>`;
  }

  if (status === "failed") {
    return `<section class="security-note warn">Guard baseline upload failed${error ? `: ${escapeHtml(error)}` : "."}</section>`;
  }

  return `<section class="security-consent" aria-label="DryLake Guard upload consent">
    <div>
      <strong>After reviewing this report, create an Active Guard baseline?</strong>
      <p>Optional. Keep this scan local, or approve a redacted baseline upload so DryLake can detect MCP and skill drift over time, provide Watchdog protection, and scan consented Guard artifacts. It is not required.</p>
      ${renderGuardUploadDisclosure()}
      ${canCreateTeamBaseline ? "" : `<p class="security-note warn">${escapeHtml(TEAM_BASELINE_ROLE_MESSAGE)}</p>`}
    </div>
    <div class="security-actions">
      <button type="button" data-command="drylake.uploadGuardBaseline"${status === "uploading" || !canCreateTeamBaseline ? " disabled" : ""}>${status === "uploading" ? "Uploading..." : "Upload Guard Baseline"}</button>
      <button type="button" class="secondary" data-command="drylake.keepGuardLocal">Keep Scan Local</button>
    </div>
  </section>`;
}

function renderGuardFixPlanMarkdown(plan: GuardFixPlan) {
  const actions = plan.actions.map((action, index) => [
    `${index + 1}. ${action.title} (${action.priority})`,
    `   Category: ${action.category}`,
    `   Why: ${action.why}`,
    `   Recommendation: ${action.recommendation}`,
    action.files.length ? `   Files: ${action.files.join(", ")}` : "   Files: Workspace policy or configuration review",
    `   Approval required: ${action.approvalRequired ? "yes" : "no"}`,
  ].join("\n")).join("\n\n");
  const cautions = plan.cautions.map((item) => `- ${item}`).join("\n");
  const nextSteps = plan.nextSteps.map((item) => `- ${item}`).join("\n");

  return [
    "# DryLake Guard Fix with AI",
    "",
    plan.summary,
    "",
    "## Recommended Actions",
    actions || "- No actions generated.",
    "",
    "## Cautions",
    cautions || "- Review all proposed changes before applying them.",
    "",
    "## Next Steps",
    nextSteps || "- Re-run DryLake Guard after remediation.",
  ].join("\n");
}

function renderGuardFixPlan(status: GuardFixStatus, plan: GuardFixPlan | null, error?: string) {
  if (status === "idle" && !plan && !error) {
    return "";
  }

  if (status === "generating") {
    return `<section class="security-fix-plan" aria-live="polite" aria-busy="true">
      <div>
        <div class="security-eyebrow">Fix with AI</div>
        <h3>Claude Haiku is preparing a remediation plan</h3>
        <p>DryLake is using the redacted scan report, file paths, risk categories, MCP metadata, extension access signals, and workspace surface. It is not sending secret values and it will not write files automatically.</p>
      </div>
    </section>`;
  }

  if (status === "failed") {
    return `<section class="security-fix-plan failed" aria-live="polite">
      <div>
        <div class="security-eyebrow">Fix with AI</div>
        <h3>Fix plan failed</h3>
        <p>${escapeHtml(error ?? "DryLake could not generate a Guard fix plan.")}</p>
      </div>
      <button type="button" data-command="drylake.guardFixWithAi">Retry</button>
    </section>`;
  }

  if (!plan) {
    return "";
  }

  const actionRows = plan.actions.map((action) => `<article class="security-fix-action ${escapeHtml(action.priority)}">
    <span class="security-severity">${escapeHtml(action.priority)}</span>
    <div>
      <strong>${escapeHtml(action.title)}</strong>
      <small>${escapeHtml(action.category)}${action.files.length ? ` - ${escapeHtml(action.files.slice(0, 6).join(", "))}` : ""}</small>
      <p>${escapeHtml(action.why)}</p>
      <p>${escapeHtml(action.recommendation)}</p>
      <small>${action.approvalRequired ? "Approval required before applying." : "Can be handled as a low-risk cleanup after review."}</small>
    </div>
  </article>`).join("");
  const cautionRows = plan.cautions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const nextStepRows = plan.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const markdown = escapeHtml(renderGuardFixPlanMarkdown(plan));

  return `<section class="security-fix-plan ready" aria-live="polite">
    <div class="security-fix-header">
      <div>
        <div class="security-eyebrow">Fix with AI</div>
        <h3>Guard remediation plan</h3>
        <p>${escapeHtml(plan.summary)}</p>
      </div>
      <div class="security-actions">
        <button type="button" class="secondary" data-command="drylake.copyGuardFixPlan">Copy Plan</button>
        <button type="button" data-command="drylake.guardFixWithAi">Regenerate</button>
      </div>
    </div>
    <div class="security-fix-actions">${actionRows || '<div class="security-empty-line">No remediation actions were generated.</div>'}</div>
    <div class="security-fix-meta">
      <div>
        <strong>Cautions</strong>
        <ul>${cautionRows || "<li>Review each recommendation before applying it.</li>"}</ul>
      </div>
      <div>
        <strong>Next Steps</strong>
        <ul>${nextStepRows || "<li>Re-run DryLake Guard after remediation.</li>"}</ul>
      </div>
    </div>
    <textarea class="copy-buffer" readonly hidden>${markdown}</textarea>
  </section>`;
}

function renderSecurityEmptyState(loading: boolean, paidUpsellVisible: boolean) {
  return `<section class="security-panel" aria-label="DryLake Guard security scan">
    <div class="security-hero">
      <div>
        <div class="security-eyebrow">DryLake Guard</div>
        <h2>Agentic Security Posture</h2>
        <p>Map this IDE's agentic setup: installed extensions, agent files, skills, MCP servers, env references, deploy surfaces, and connected-tool blast radius.</p>
      </div>
      <div class="security-actions">
        <button type="button" data-command="drylake.runSecurityScan"${loading ? " disabled" : ""}>${loading ? "Scanning..." : "Run Guard Scan"}</button>
      </div>
    </div>
    ${renderGuardPaidUpsell(paidUpsellVisible)}
    ${loading ? renderSecurityScanInProgress() : ""}
    <div class="security-flow">
      <div><strong>1</strong><span>Register, then scan local IDE and workspace metadata</span></div>
      <div><strong>2</strong><span>Review inferred extension and MCP access</span></div>
      <div><strong>3</strong><span>Open the local report or copy a redacted summary</span></div>
    </div>
    <div class="security-note">Extension access is inferred from installed extension manifests, activation events, commands, contribution points, and local MCP/config files. VS Code does not expose a complete runtime permission list for third-party extensions.</div>
  </section>`;
}

function renderSummaryMetric(label: string, value: number | string, tone = "") {
  return `<div class="security-metric${tone ? ` ${tone}` : ""}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function renderFindingRows(scan: GuardScanResult) {
  const findings = scan.findings.slice(0, 18);
  if (findings.length === 0) {
    return `<div class="security-empty-line">No critical findings in the local scan.</div>`;
  }

  return findings.map((finding) => `<div class="security-finding ${escapeHtml(finding.severity)}">
    <span class="security-severity">${escapeHtml(finding.severity)}</span>
    <div>
      <strong>${escapeHtml(finding.title)}</strong>
      <p>${escapeHtml(finding.evidence)}</p>
      <p>${escapeHtml(finding.recommendation)}</p>
      ${finding.path ? `<small>${escapeHtml(finding.path)}${finding.line ? `:${finding.line}` : ""}</small>` : ""}
    </div>
  </div>`).join("");
}

function renderSecurityScoreMetric(label: string, score: number) {
  const tone = score < 60 ? "warn" : score < 80 ? "caution" : "good";
  return `<div class="security-metric ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(score)}/100</strong>
  </div>`;
}

function renderExtensionRows(scan: GuardScanResult) {
  const extensions = scan.extensions
    .filter((extension) => !extension.isBuiltin)
    .slice(0, 12);

  if (extensions.length === 0) {
    return `<div class="security-empty-line">No third-party extensions were detected.</div>`;
  }

  return extensions.map((extension) => {
    const flags = extension.riskFlags.length
      ? extension.riskFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")
      : "<span>No manifest risk flags.</span>";
    const access = extension.accessSignals.slice(0, 5).map((signal) => `<li>${escapeHtml(signal)}</li>`).join("");
    const capabilities = extension.capabilityTags.length
      ? extension.capabilityTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")
      : "<span>extension host code</span>";
    const evidence = extension.manifestEvidence.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

    return `<details class="security-extension ${escapeHtml(extension.accessLevel)}">
      <summary>
        <span>${escapeHtml(extension.displayName)}</span>
        <small>${escapeHtml(extension.accessLevel)} access · ${escapeHtml(extension.id)} · ${extension.isActive ? "active" : "inactive"}</small>
      </summary>
      <div class="security-tags capability-tags">${capabilities}</div>
      <div class="security-tags">${flags}</div>
      <ul>${access}${evidence}</ul>
    </details>`;
  }).join("");
}

function renderMcpRows(scan: GuardScanResult) {
  if (scan.mcpServers.length === 0) {
    return `<div class="security-empty-line">No MCP server configs were detected in the scanned locations.</div>`;
  }

  return scan.mcpServers.slice(0, 12).map((server) => `<div class="security-mcp ${escapeHtml(server.severity)}">
    <div>
      <strong>${escapeHtml(server.name)}</strong>
      <p>${escapeHtml([server.command, ...server.args].filter(Boolean).join(" ") || server.url || "MCP server")}</p>
      <p>${escapeHtml(server.blastRadius)}</p>
      <small>${escapeHtml(server.configPath)}</small>
    </div>
    <div>
      <div class="security-tags">${server.capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      <div class="security-tags">${server.riskFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("") || "<span>No MCP risk flags.</span>"}</div>
      <small>Env names: ${escapeHtml(server.envKeys.join(", ") || "none declared")}</small>
    </div>
  </div>`).join("");
}

function renderSecretRows(scan: GuardScanResult) {
  if (scan.secrets.length === 0) {
    return `<div class="security-empty-line">No secret-like workspace references were detected. Values are never stored.</div>`;
  }

  return scan.secrets.slice(0, 14).map((secret) => `<div class="security-connection-row ${escapeHtml(secret.severity)}">
    <strong>${escapeHtml(secret.type)}</strong>
    <span>${escapeHtml(secret.variableName ?? "pattern match")}</span>
    <small>${escapeHtml(secret.path)}${secret.line ? `:${escapeHtml(secret.line)}` : ""}</small>
  </div>`).join("");
}

function renderWorkspaceSurfaceRows(scan: GuardScanResult) {
  const surface = [
    ...scan.workspaceSurface.deploymentFiles.map((item) => ({ ...item, group: "deploy/migration" })),
    ...scan.workspaceSurface.iacFiles.map((item) => ({ ...item, group: "IaC/cloud" })),
    ...scan.workspaceSurface.ciWorkflowFiles.map((item) => ({ ...item, group: "CI/CD" })),
    ...scan.workspaceSurface.riskyPackageScripts.map((item) => ({
      path: item.path,
      type: `${item.name}: ${item.risk}`,
      group: "package script",
    })),
  ].slice(0, 16);

  if (surface.length === 0) {
    return `<div class="security-empty-line">No deploy, CI, infrastructure, or risky package-script surface was detected.</div>`;
  }

  return surface.map((item) => `<div class="security-connection-row high">
    <strong>${escapeHtml(item.group)}</strong>
    <span>${escapeHtml(item.type)}</span>
    <small>${escapeHtml(item.path)}</small>
  </div>`).join("");
}

function renderConnectionMapRows(scan: GuardScanResult) {
  const highRisk = scan.connectionMap.highRiskPaths.slice(0, 8);
  const edges = scan.connectionMap.edges
    .filter((edge) => edge.severity === "critical" || edge.severity === "high" || edge.severity === "medium")
    .slice(0, 12);

  if (highRisk.length === 0 && edges.length === 0) {
    return `<div class="security-empty-line">No high-impact agentic connection paths were detected.</div>`;
  }

  const riskRows = highRisk.map((item) => `<div class="security-connection-row high">
    <strong>High-impact path</strong>
    <span>${escapeHtml(item)}</span>
  </div>`).join("");
  const edgeRows = edges.map((edge) => `<div class="security-connection-row ${escapeHtml(edge.severity)}">
    <strong>${escapeHtml(edge.label)}</strong>
    <span>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</span>
  </div>`).join("");

  return `${riskRows}${edgeRows}`;
}

function renderSecurityPanel(
  scan: GuardScanResult | null,
  loading: boolean,
  options: {
    uploadStatus: GuardUploadStatus;
    uploadError?: string;
    canCreateTeamBaseline: boolean;
    paidUpsellVisible: boolean;
    fixStatus: GuardFixStatus;
    fixPlan: GuardFixPlan | null;
    fixError?: string;
  },
) {
  if (!scan) {
    return renderSecurityEmptyState(loading, options.paidUpsellVisible);
  }

  const sortedFindings = [...scan.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
  const topFinding = sortedFindings[0];
  const fixButtonLabel = options.fixStatus === "generating"
    ? "Generating..."
    : options.fixPlan
      ? "Regenerate Fix Plan"
      : "Fix with AI";
  const fixButtonDisabled = options.fixStatus === "generating" ? " disabled" : "";

  return `<section class="security-panel" aria-label="DryLake Guard security scan">
    <div class="security-hero">
      <div>
        <div class="security-eyebrow">DryLake Guard</div>
        <h2>Safe Developer Rank: ${escapeHtml(scan.rank)} - ${escapeHtml(scan.score)}/100</h2>
        <p>${topFinding ? escapeHtml(topFinding.title) : "No critical findings in the local scan."}</p>
      </div>
      <div class="security-actions">
        <button type="button" data-command="drylake.runSecurityScan"${loading ? " disabled" : ""}>${loading ? "Scanning..." : "Run Guard Scan"}</button>
        <button type="button" class="secondary" data-command="drylake.openSecurityReport">Open Report</button>
        <button type="button" class="secondary" data-command="drylake.copySecuritySummary">Copy Summary</button>
        <button type="button" class="secondary paid" data-command="drylake.guardFixWithAi"${fixButtonDisabled}>${escapeHtml(fixButtonLabel)}</button>
        <button type="button" class="secondary paid" data-command="drylake.deepCloudAnalysis">Deep Cloud Analysis</button>
      </div>
    </div>
    ${renderGuardPaidUpsell(options.paidUpsellVisible)}
    <div class="security-note">Scanned ${escapeHtml(new Date(scan.scannedAt).toLocaleString())}. Extension access is inferred from manifests/configs; runtime behavior still requires review.</div>
    <div class="security-score-row">
      <div class="security-score ${escapeHtml(scan.rank.toLowerCase().replace(/[^a-z]+/g, "-"))}">
        <span>Score</span>
        <strong>${escapeHtml(scan.score)}</strong>
        <small>${escapeHtml(scan.rank)}</small>
      </div>
      <div class="security-metrics">
        ${renderSummaryMetric("Agent files", scan.summary.agentFiles)}
        ${renderSummaryMetric("Extensions", scan.summary.extensions)}
        ${renderSummaryMetric("Active extensions", scan.summary.activeExtensions)}
        ${renderSummaryMetric("MCP servers", scan.summary.mcpServers)}
        ${renderSummaryMetric("High-impact paths", scan.summary.highImpactConnections, scan.summary.highImpactConnections ? "warn" : "")}
        ${renderSummaryMetric("Risky files", scan.summary.riskyFiles)}
        ${renderSummaryMetric("Workspace surface", scan.summary.workspaceSurface)}
        ${renderSummaryMetric("Findings", scan.summary.findings, scan.summary.critical || scan.summary.high ? "warn" : "")}
      </div>
    </div>
    <div class="security-category-row">
      ${renderSecurityScoreMetric("MCP Risk", scan.categoryScores.mcpRisk)}
      ${renderSecurityScoreMetric("Agent Reliability", scan.categoryScores.agentReliability)}
      ${renderSecurityScoreMetric("Secret Hygiene", scan.categoryScores.secretHygiene)}
      ${renderSecurityScoreMetric("IDE Bloat", scan.categoryScores.ideBloat)}
      ${renderSecurityScoreMetric("Token Waste", scan.categoryScores.tokenWaste)}
      ${renderSecurityScoreMetric("Blast Radius", scan.categoryScores.blastRadius)}
    </div>
    <div class="security-grid">
      <section class="security-section">
        <h3>Top Findings</h3>
        ${renderFindingRows({ ...scan, findings: sortedFindings })}
      </section>
      <section class="security-section">
        <h3>Agentic Connection Map</h3>
        ${renderConnectionMapRows(scan)}
      </section>
      <section class="security-section">
        <h3>Extension Access Review</h3>
        ${renderExtensionRows(scan)}
      </section>
      <section class="security-section">
        <h3>MCP And Tool Access</h3>
        ${renderMcpRows(scan)}
      </section>
      <section class="security-section">
        <h3>Secrets And Env References</h3>
        ${renderSecretRows(scan)}
      </section>
      <section class="security-section">
        <h3>Deploy / CI / Workspace Surface</h3>
        ${renderWorkspaceSurfaceRows(scan)}
      </section>
    </div>
    ${renderGuardFixPlan(options.fixStatus, options.fixPlan, options.fixError)}
    ${renderGuardUploadConsent(options.uploadStatus, options.uploadError, options.canCreateTeamBaseline)}
  </section>`;
}

function renderPlanningModelBanner(
  modelTier: PlanningModelTier | null,
  hasPlan: boolean,
  connection: ConnectionState,
) {
  const shouldShowFreePlanningModel = modelTier === "nano" || (!hasPlan && !hasFoundationPlanningAccess(connection));
  if (!shouldShowFreePlanningModel) {
    return "";
  }

  if (hasPlan) {
    return `<section class="model-tier-bar nano" aria-label="Planning model">
      <span class="model-tier-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(FREE_PLANNING_MODEL_LABEL)}</strong>
    </section>`;
  }

  return `<section class="nano-banner" aria-label="Free planning model" data-nano-banner>
    <span class="nano-banner-text">We are using <strong>${escapeHtml(FREE_PLANNING_MODEL_LABEL)}</strong>. Xupra AI Frontier Models are available on Pro.</span>
    <button type="button" class="nano-banner-cta" data-command="xupra.openBilling"${billingCommandArgs({
      required: "pro",
      source: "extension",
      returnPath: "/app",
    })}>Upgrade to Pro</button>
  </section>`;
}

type WebviewMessage = {
  command?: string;
  args?: unknown[];
  copy?: string;
  view?: unknown;
  phaseId?: unknown;
  stepId?: unknown;
  afterPhaseId?: unknown;
  agent?: unknown;
  profileLogicalPath?: unknown;
  handoffAction?: unknown;
  autopilot?: unknown;
  status?: unknown;
  text?: unknown;
  mode?: unknown;
  planningProvider?: unknown;
  manage?: unknown;
  providerConfigAction?: unknown;
  providerSecret?: unknown;
  stageCount?: unknown;
};

type PlanningProviderReader = () => PlanningProviderInfo | null;
type ChatStateReader = () => ChatState;
type LastModelTierReader = () => PlanningModelTier | null;
type PlanningLoadingReader = () => boolean;
type ConnectionReader = () => ConnectionState;

function formatChatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function estimateCardGenerationContext(state: ChatState, hasPlan: boolean) {
  if (hasPlan) {
    return {
      score: 100,
      label: "Cards generated",
      detail: "Review the task-specific cards below or ask for refinements.",
    };
  }

  const userMessages = state.messages.filter((message) => message.role === "user");
  const userText = userMessages.map((message) => message.text).join("\n").trim();

  if (!userText) {
    return {
      score: 0,
      label: "Need task details",
      detail: "Describe what you want to build so DryLake can generate cards.",
    };
  }

  let score = 18;
  score += Math.min(34, Math.floor(userText.length / 14));
  score += Math.min(18, Math.max(0, userMessages.length - 1) * 9);

  const signals = [
    /\b(user|customer|admin|member|role|account)\b/i,
    /\b(auth|login|payment|database|api|webhook|deployment|ui|clerk|stripe)\b/i,
    /\b(goal|success|acceptance|constraint|requirement|done)\b/i,
    /\b(file|repo|component|endpoint|schema|model|table)\b/i,
  ];
  score += signals.reduce((total, pattern) => total + (pattern.test(userText) ? 8 : 0), 0);

  const latestMessage = state.messages[state.messages.length - 1];
  const aiNeedsMoreInfo = latestMessage?.role === "ai" && latestMessage.text.includes("?");
  if (aiNeedsMoreInfo) {
    score = Math.min(score, 68);
  }

  const clampedScore = Math.max(5, Math.min(95, score));
  if (clampedScore < 45) {
    return {
      score: clampedScore,
      label: "Need more detail",
      detail: "Answer the planning questions to improve generated cards.",
    };
  }

  if (clampedScore < 75) {
    return {
      score: clampedScore,
      label: "Getting close",
      detail: "Add missing users, data, constraints, or success criteria for better cards.",
    };
  }

  return {
    score: clampedScore,
    label: "Enough to draft cards",
    detail: "DryLake has enough context to generate task-specific cards.",
  };
}

function activeProviderChoice(
  planningProvider: PlanningProviderInfo | null,
  modelTier: PlanningModelTier | null,
  connection: ConnectionState,
): PlanningProviderChoice {
  const activeProviderId = planningProvider?.id ?? "xupra-pro-ai";
  if (activeProviderId !== "xupra-pro-ai") {
    return PLANNING_PROVIDERS.find((provider) => provider.choiceId === activeProviderId) ?? PLANNING_PROVIDERS[0];
  }

  if (modelTier === "foundation" && hasFoundationPlanningAccess(connection)) {
    return PLANNING_PROVIDERS.find((provider) => provider.choiceId === "xupra-foundation") ?? PLANNING_PROVIDERS[0];
  }

  if (modelTier === "nano" || !hasFoundationPlanningAccess(connection)) {
    return PLANNING_PROVIDERS[0];
  }

  return PLANNING_PROVIDERS.find((provider) => provider.choiceId === "xupra-foundation") ?? PLANNING_PROVIDERS[0];
}

function providerDisplayLabel(provider: PlanningProviderChoice) {
  if (provider.choiceId === "xupra-nano") {
    return FREE_PLANNING_MODEL_LABEL;
  }

  if (provider.choiceId === "xupra-foundation") {
    return "Xupra AI - Frontier Models";
  }

  return provider.label;
}

function planningProviderOptionLabel(provider: PlanningProviderChoice, locked: boolean) {
  if (provider.choiceId === "xupra-foundation") {
    return locked
      ? `${provider.label} - Pro users only`
      : provider.label;
  }

  return `${provider.label} - ${provider.description}`;
}

function providerNeedsLocalConfiguration(providerId: DryLakeProviderId) {
  return CONFIGURABLE_PLANNING_PROVIDER_IDS.has(providerId);
}

function providerSecretLabel(providerId: DryLakeProviderId) {
  if (providerId === "claude-api") {
    return "Anthropic API key";
  }

  if (providerId === "openai-api") {
    return "OpenAI API key";
  }

  if (providerId === "databricks-api") {
    return "Databricks token";
  }

  return "Hermes CLI configuration";
}

function providerSecretPlaceholder(providerId: DryLakeProviderId) {
  if (providerId === "claude-api") {
    return "sk-ant-...";
  }

  if (providerId === "openai-api") {
    return "sk-...";
  }

  if (providerId === "databricks-api") {
    return "dapi...";
  }

  return "";
}

function renderProviderConfigurationPanel(activeProvider: PlanningProviderChoice, visible: boolean) {
  const providerId = activeProvider.providerId;
  const isHermes = providerId === "hermes-agent";
  return `<div class="provider-config-panel" data-provider-config-panel${visible ? "" : " hidden"}>
    <div class="provider-config-title" data-provider-config-title>${escapeHtml(providerSecretLabel(providerId))}</div>
    <div class="provider-config-help" data-provider-config-help>${isHermes
      ? "Hermes keys stay in Hermes' own local CLI configuration. DryLake only calls the hermes command."
      : "Paste the key here. DryLake stores it in VS Code SecretStorage on this machine."}</div>
    <div class="provider-secret-fields" data-provider-secret-fields${isHermes ? " hidden" : ""}>
      <input id="providerSecretInput" data-provider-secret-input type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(providerSecretPlaceholder(providerId))}" aria-label="${escapeHtml(providerSecretLabel(providerId))}">
      <button type="button" data-provider-config-action="save-secret">Save Key</button>
    </div>
    <div class="provider-config-actions">
      <button type="button" class="provider-config-secondary" data-provider-config-action="clear-secret"${isHermes ? " hidden" : ""}>Clear Key</button>
      <button type="button" class="provider-config-secondary" data-provider-config-action="open-settings">${isHermes ? "Open Hermes Settings" : "Provider Settings"}</button>
    </div>
    <div class="provider-secret-status" data-provider-secret-status></div>
  </div>`;
}

function renderPlanningProviderSelect(
  activeProvider: PlanningProviderChoice,
  hasPlan: boolean,
  connection: ConnectionState,
) {
  const disabled = hasPlan ? " disabled" : "";
  const activeLocked = Boolean(activeProvider.proOnly && !hasFoundationPlanningAccess(connection));
  const activeConfigurable = providerNeedsLocalConfiguration(activeProvider.providerId);
  const note = activeLocked
    ? "Pro users only. Upgrade to use Xupra AI Frontier Models."
    : activeProvider.choiceId === "xupra-nano"
      ? `We are using ${FREE_PLANNING_MODEL_LABEL} for free planning.`
      : activeProvider.description;

  return `<div class="planning-provider-field">
    <label class="planning-provider-label" for="planningProviderSelect">Planning model</label>
    <select id="planningProviderSelect" class="planning-provider-select"${disabled} aria-label="Planning model">
      ${PLANNING_PROVIDERS.map((provider) => {
      const isActive = provider.choiceId === activeProvider.choiceId;
      const locked = Boolean(provider.proOnly && !hasFoundationPlanningAccess(connection));
      return `<option value="${escapeHtml(provider.choiceId)}" data-planning-provider="${escapeHtml(provider.providerId)}" data-pro-locked="${locked ? "true" : "false"}"${isActive ? " selected" : ""}>${escapeHtml(planningProviderOptionLabel(provider, locked))}</option>`;
    }).join("")}
    </select>
    <div class="planning-provider-note" data-provider-note>${escapeHtml(note)}</div>
    <button type="button" class="frontier-upgrade-cta" data-frontier-upgrade data-command="xupra.openBilling"${billingCommandArgs({
      required: "pro",
      source: "extension",
      returnPath: "/app",
    })}${activeLocked ? "" : " hidden"}>Upgrade to Frontier Models</button>
    ${renderProviderConfigurationPanel(activeProvider, activeConfigurable && !activeLocked)}
  </div>`;
}

function renderStageCountSelect(hasPlan: boolean) {
  const disabled = hasPlan ? " disabled" : "";
  const helpText = hasPlan
    ? "This plan keeps the planning step count chosen when the session started."
    : "Planning Steps are the number of phase cards DryLake creates. Fewer steps are faster; more steps create smaller, safer handoffs. Choose Auto or 1-12.";

  return `<div class="stage-count-field">
    <label class="stage-count-label" for="stageCountSelect">
      <span>Planning Steps</span>
      <button type="button" class="planning-info-icon" data-info-toggle="stage-count" aria-label="Explain planning steps" aria-expanded="false">i</button>
    </label>
    <select id="stageCountSelect" class="stage-count-select"${disabled} aria-label="Planning steps">
      <option value="">Auto</option>
      ${STAGE_COUNT_OPTIONS.map((count) => `<option value="${count}">${count}</option>`).join("")}
    </select>
    <p class="planning-info-text" data-info-panel="stage-count" hidden>${escapeHtml(helpText)}</p>
  </div>`;
}

function renderPlannerSetup(
  planningProvider: PlanningProviderInfo | null,
  hasPlan: boolean,
  modelTier: PlanningModelTier | null,
  connection: ConnectionState,
) {
  const activeProvider = activeProviderChoice(planningProvider, modelTier, connection);
  const activeProviderLocked = Boolean(activeProvider.proOnly && !hasFoundationPlanningAccess(connection));
  const providerStatus = hasPlan
    ? "Locked for this plan"
    : activeProvider.choiceId === "xupra-nano"
      ? `Free users use ${FREE_PLANNING_MODEL_LABEL}. Choose up to 12 planning steps, or ask naturally in chat.`
      : activeProviderLocked
        ? "Xupra AI Frontier Models are available on Pro."
        : "Choose the provider and planning step count that will generate the first cards.";
  const modeChips = hasPlan
    ? ""
    : `<div class="mode-row" aria-label="Plan type">${MODE_CARDS.map(([title, mode], index) => {
        return `<button type="button" class="mode-chip${index === 0 ? " active" : ""}" data-mode="${mode}" aria-pressed="${index === 0 ? "true" : "false"}">${escapeHtml(title)}</button>`;
      }).join("")}</div>`;

  return `<section class="planner-setup" aria-label="Card generation setup">
    <div class="planner-setup-header">
      <div>
      <div class="planner-setup-eyebrow">Card Generation</div>
        <div class="planner-setup-title">Choose the planning model before chat starts.</div>
      </div>
      <div class="planner-setup-status">${escapeHtml(providerStatus)}</div>
    </div>
    ${modeChips}
    <div class="planning-controls">
      ${renderPlanningProviderSelect(activeProvider, hasPlan, connection)}
      ${renderStageCountSelect(hasPlan)}
    </div>
  </section>`;
}

function renderChatPanel(
  state: ChatState,
  planningProvider: PlanningProviderInfo | null,
  hasPlan: boolean,
  collapsed: boolean,
  modelTier: PlanningModelTier | null,
  connection: ConnectionState,
) {
  const cardContext = estimateCardGenerationContext(state, hasPlan);
  const activeProvider = activeProviderChoice(planningProvider, modelTier, connection);
  const registered = hasRegisteredConnection(connection);
  const activeProviderLabel = planningProvider?.id && planningProvider.id !== "xupra-pro-ai"
    ? planningProvider.label
    : providerDisplayLabel(activeProvider);
  const plannerSetup = renderPlannerSetup(planningProvider, hasPlan, modelTier, connection);
  const messages = state.messages.length
    ? state.messages
        .map((message) => {
          const roleClass =
            message.role === "user" ? "user" : message.role === "system" ? "system" : "ai";
          const senderLabel =
            message.role === "user" ? "You" : message.role === "system" ? "DryLake" : activeProviderLabel;
          return `<div class="chat-message ${roleClass}">
            <div class="chat-meta"><span class="chat-sender">${escapeHtml(senderLabel)}</span><span class="chat-time">${escapeHtml(formatChatTime(message.ts))}</span></div>
            <div class="chat-body">${escapeHtml(message.text).replace(/\n/g, "<br />")}</div>
          </div>`;
        })
        .join("")
    : `<div class="chat-empty">Describe what you want to build. The AI will generate a phased plan and populate the kanban below.</div>`;

  return `${collapsed ? "" : plannerSetup}
  <section class="chat-panel${collapsed ? " collapsed" : ""}" aria-label="Build plan chat" data-has-plan="${hasPlan ? "true" : "false"}" data-registered="${registered ? "true" : "false"}">
    <div class="chat-header">
      <span class="chat-eyebrow">Build Plan Chat</span>
      <div class="chat-controls">
        <button type="button" class="chat-clear secondary" data-command="drylake.clearChat">Clear</button>
        <button type="button" class="collapse-btn secondary" data-command="drylake.toggleChatCollapsed">${collapsed ? "Expand" : "Collapse"}</button>
      </div>
    </div>
    ${collapsed ? "" : `<div class="context-meter" role="meter" aria-label="Context for card generation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cardContext.score}">
        <div class="context-meter-row">
          <span class="context-meter-label">${cardContext.score}% context for Card Generation</span>
          <span class="context-meter-status">${escapeHtml(cardContext.label)}</span>
        </div>
        <div class="context-meter-track"><span class="context-meter-fill" style="width: ${cardContext.score}%"></span></div>
        <div class="context-meter-detail">${escapeHtml(cardContext.detail)}</div>
      </div>
      <div class="chat-messages" id="chatMessages">${messages}</div>
      <form class="chat-form" id="chatForm">
        <textarea id="chatInput" rows="2" placeholder="${hasPlan ? "Ask DryLake to update these cards..." : "Describe what you want to build..."}" aria-label="${registered ? "DryLake planning prompt" : "Register to use DryLake planning"}"></textarea>
        <div class="chat-form-row">
          <span class="chat-hint muted">Enter to send</span>
          <button type="submit">Send</button>
        </div>
      </form>`}
  </section>`;
}

export class ControlRoomProvider {
  private panel?: vscode.WebviewPanel;
  private context?: vscode.ExtensionContext;
  private securityScan: GuardScanResult | null = null;
  private securityScanLoading = false;
  private securityReportPaths: GuardReportPaths | null = null;
  private guardUploadStatus: GuardUploadStatus = "idle";
  private guardUploadError: string | undefined;
  private guardPaidUpsellVisible = false;
  private guardFixStatus: GuardFixStatus = "idle";
  private guardFixPlan: GuardFixPlan | null = null;
  private guardFixError: string | undefined;
  private lastGuardScanId: string | undefined;

  constructor(
    private readonly sessionStore: XuSessionStore,
    private readonly readPlanningProvider: PlanningProviderReader = () => null,
    private readonly readChatState: ChatStateReader = () => ({ messages: [] }),
    private readonly readLastModelTier: LastModelTierReader = () => null,
    private readonly readPlanningLoading: PlanningLoadingReader = () => false,
    private readonly readConnection: ConnectionReader = () => ({}),
    private readonly apiClient?: Partial<Pick<ApiClient, "getEntitlements" | "openWebUrl" | "recordGuardScan" | "markGuardScanBaseline" | "generateGuardFixPlan" | "startCloudAnalysis" | "recordContinuousWatchEvent">>,
    private readonly ensureRegistered: RegistrationEnsurer = async () => true,
  ) {}

  async createOrShow(context: vscode.ExtensionContext) {
    this.context = context;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "drylake.controlRoom",
      "DryLake Control Plane",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, context.subscriptions);

    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.copy) {
        await vscode.env.clipboard.writeText(message.copy);
        void vscode.window.showInformationMessage("Copied.");
        return;
      }

      if (message.command === "drylake.setControlRoomView") {
        const view = controlRoomViewFrom(message.view ?? message.args?.[0]);
        await context.workspaceState?.update(CONTROL_ROOM_VIEW_KEY, view);
        await this.refresh();
        return;
      }

      if (message.command === "drylake.runSecurityScan") {
        if (!await this.ensureRegistered()) {
          await this.refresh();
          return;
        }

        this.securityScanLoading = true;
        this.securityScan = null;
        this.guardUploadStatus = "recording";
        this.guardUploadError = undefined;
        this.guardPaidUpsellVisible = false;
        this.guardFixStatus = "idle";
        this.guardFixPlan = null;
        this.guardFixError = undefined;
        this.securityReportPaths = null;
        await this.refresh();
        try {
          this.securityScan = await runSecurityScan(vscode.workspace.getConfiguration("xupra"));
          this.securityReportPaths = await writeSecurityScanReports(this.securityScan);
          await this.recordGuardScanMetadata();
          this.guardUploadStatus = "idle";
        } catch (error) {
          this.guardUploadStatus = "failed";
          this.guardUploadError = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`DryLake Guard scan failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          this.securityScanLoading = false;
        }
        await this.refresh();
        return;
      }

      if (message.command === "drylake.uploadGuardBaseline") {
        if (!this.securityScan) {
          void vscode.window.showWarningMessage("Run DryLake Guard Scan before uploading a Guard baseline.");
          return;
        }

        if (!await this.ensureRegistered()) {
          await this.refresh();
          return;
        }

        if (!this.apiClient?.recordGuardScan || !this.apiClient?.markGuardScanBaseline) {
          void vscode.window.showErrorMessage("DryLake Guard upload is unavailable because the backend client is not configured.");
          return;
        }

        if (!canManageTeamBaseline(this.readConnection())) {
          void vscode.window.showWarningMessage(TEAM_BASELINE_ROLE_MESSAGE);
          return;
        }

        const capabilities = await resolveServerCapabilities(this.apiClient);

        if (!capabilities?.canUseTeamBaseline) {
          this.guardPaidUpsellVisible = true;
          await this.refresh();
          await vscode.commands.executeCommand("xupra.openBilling", {
            required: "team_security",
            source: "extension",
            returnPath: "/app",
          });
          return;
        }

        this.guardUploadStatus = "uploading";
        this.guardUploadError = undefined;
        await this.refresh();

        try {
          let artifacts: GuardScanUploadArtifact[] = [];

          try {
            artifacts = await collectGuardUploadArtifacts(this.securityScan, vscode.workspace.getConfiguration("xupra"));
          } catch (error) {
            void vscode.window.showWarningMessage(
              `DryLake could not collect optional baseline artifacts, so it will save the redacted scan report only: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          const result = await this.apiClient.recordGuardScan(guardScanUploadPayload(this.securityScan, "baseline_upload", artifacts));
          const baseline = await this.apiClient.markGuardScanBaseline(result.guardScan.id);
          this.lastGuardScanId = result.guardScan.id;
          this.guardUploadStatus = "uploaded";
          void vscode.window.showInformationMessage(`Uploaded ${artifacts.length} DryLake Guard baseline artifacts and marked baseline ${baseline.baseline.id}.`);
        } catch (error) {
          this.guardUploadStatus = "failed";
          this.guardUploadError = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`DryLake Guard baseline upload failed: ${this.guardUploadError}`);
        }

        await this.refresh();
        return;
      }

      if (message.command === "drylake.keepGuardLocal") {
        this.guardUploadStatus = "local";
        this.guardUploadError = undefined;
        await this.refresh();
        return;
      }

      if (message.command === "drylake.guardFixWithAi") {
        if (!this.securityScan) {
          void vscode.window.showWarningMessage("Run DryLake Guard Scan before using Fix with AI.");
          return;
        }

        if (!await this.ensureRegistered()) {
          await this.refresh();
          return;
        }

      const capabilities = await resolveServerCapabilities(this.apiClient);

      if (!capabilities?.canUseFixWithAI) {
        this.guardPaidUpsellVisible = true;
        await this.refresh();
        await vscode.commands.executeCommand("xupra.openBilling", {
          required: "security_pro",
          source: "extension",
          returnPath: "/app",
        });
        return;
      }

        if (!this.apiClient?.generateGuardFixPlan) {
          void vscode.window.showErrorMessage("DryLake Guard Fix with AI is unavailable because the backend client is not configured.");
          return;
        }

        this.guardFixStatus = "generating";
        this.guardFixPlan = null;
        this.guardFixError = undefined;
        this.guardPaidUpsellVisible = false;
        await this.refresh();

        try {
          const result = await this.apiClient.generateGuardFixPlan(guardFixPlanPayload(this.securityScan));
          this.guardFixPlan = result.plan;
          this.guardFixStatus = "ready";
          void vscode.window.showInformationMessage(`DryLake Guard Fix with AI generated a remediation plan with ${result.model}.`);
        } catch (error) {
          this.guardFixStatus = "failed";
          this.guardFixError = error instanceof Error ? error.message : String(error);
        if (/paid|upgrade|billing|subscription/i.test(this.guardFixError)) {
          this.guardPaidUpsellVisible = true;
          await vscode.commands.executeCommand("xupra.openBilling", {
            required: "security_pro",
            source: "extension",
            returnPath: "/app",
          });
        }
          void vscode.window.showErrorMessage(`DryLake Guard Fix with AI failed: ${this.guardFixError}`);
        }
        await this.refresh();
        return;
      }

      if (message.command === "drylake.deepCloudAnalysis") {
        if (!this.securityScan) {
          void vscode.window.showWarningMessage("Run DryLake Guard Scan before starting Deep Cloud Analysis.");
          return;
        }

        if (!await this.ensureRegistered()) {
          await this.refresh();
          return;
        }

        const capabilities = await resolveServerCapabilities(this.apiClient);

        if (!capabilities?.canUseApprovedUpload || !capabilities?.canUseDeepCloudAnalysis) {
          this.guardPaidUpsellVisible = true;
          await this.refresh();
          await vscode.commands.executeCommand("xupra.openBilling", {
            required: "security_pro",
            source: "extension",
            returnPath: "/app",
          });
          return;
        }

        if (!this.apiClient?.startCloudAnalysis) {
          void vscode.window.showErrorMessage("Deep Cloud Analysis is unavailable because the backend client is not configured.");
          return;
        }

        if (!await approveDeepCloudAnalysisUpload(this.securityScan)) {
          void vscode.window.showInformationMessage("Deep Cloud Analysis upload canceled.");
          return;
        }

        try {
          const result = await this.apiClient.startCloudAnalysis({
            ...cloudAnalysisPayload(this.securityScan),
            ...(this.lastGuardScanId ? { guardScanId: this.lastGuardScanId } : {}),
          });
          const action = await vscode.window.showInformationMessage(
            `Deep Cloud Analysis completed: ${result.job.status}.`,
            result.job.guardScanId ? "Open Report" : "OK",
          );

          if (action === "Open Report" && result.job.guardScanId) {
            await vscode.env.openExternal(this.apiClient.openWebUrl(`/security/reports/${result.job.guardScanId}`));
          }
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
      if (/paid|upgrade|billing|subscription|security pro/i.test(messageText)) {
            this.guardPaidUpsellVisible = true;
            await vscode.commands.executeCommand("xupra.openBilling", {
              required: "security_pro",
              source: "extension",
              returnPath: "/app",
            });
          }
          void vscode.window.showErrorMessage(`Deep Cloud Analysis failed: ${messageText}`);
        }

        await this.refresh();
        return;
      }

      if (message.command === "drylake.copyGuardFixPlan") {
        if (!this.guardFixPlan) {
          void vscode.window.showWarningMessage("Generate a Guard fix plan before copying it.");
          return;
        }

        await vscode.env.clipboard.writeText(renderGuardFixPlanMarkdown(this.guardFixPlan));
        void vscode.window.showInformationMessage("Copied DryLake Guard fix plan.");
        return;
      }

      if (message.command === "drylake.openSecurityReport") {
        if (!this.securityReportPaths?.report) {
          void vscode.window.showWarningMessage("Run DryLake Guard Scan before opening the report.");
          return;
        }

        const document = await vscode.workspace.openTextDocument(this.securityReportPaths.report);
        await vscode.window.showTextDocument(document, { preview: false });
        return;
      }

      if (message.command === "drylake.copySecuritySummary") {
        if (!this.securityScan) {
          void vscode.window.showWarningMessage("Run DryLake Guard Scan before copying the summary.");
          return;
        }

        await vscode.env.clipboard.writeText(renderSafeDeveloperSummary(this.securityScan));
        void vscode.window.showInformationMessage("Copied DryLake security summary.");
        return;
      }

      if (message.command === "drylake.updatePhaseAgent") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.agent ?? message.args?.[1]);
        return;
      }

      if (message.command === "drylake.updatePhaseHandoffProfile") {
        await vscode.commands.executeCommand(
          message.command,
          message.phaseId ?? message.args?.[0],
          message.profileLogicalPath ?? message.args?.[1],
        );
        return;
      }

      if (message.command === "drylake.updatePhaseStatus") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.status ?? message.args?.[1]);
        return;
      }

      if (message.command === "drylake.toggleAutopilot") {
        await vscode.commands.executeCommand(message.command);
        return;
      }

      if (message.command === "drylake.toggleChatCollapsed") {
        const current = Boolean(context.workspaceState?.get(CONTROL_ROOM_CHAT_COLLAPSED_KEY));
        await context.workspaceState?.update(CONTROL_ROOM_CHAT_COLLAPSED_KEY, !current);
        await this.refresh();
        return;
      }

      if (message.command === "drylake.handoffPhase") {
        const args = [
          message.phaseId ?? message.args?.[0],
          message.handoffAction ?? message.args?.[1],
        ];
        const autopilot = message.autopilot ?? message.args?.[2];
        if (typeof autopilot === "boolean") {
          args.push(autopilot);
        }
        await vscode.commands.executeCommand(message.command, ...args);
        return;
      }

      if (message.command === "drylake.openMultiAgentForPhase") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0]);
        return;
      }

      if (message.command === "drylake.approvePlanChange" || message.command === "drylake.rejectPlanChange") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0]);
        return;
      }

      if (message.command === "drylake.chatSendMessage") {
        await vscode.commands.executeCommand(message.command, message.text ?? message.args?.[0]);
        return;
      }

      if (message.command === "drylake.configurePlanningProvider") {
        await vscode.commands.executeCommand(
          message.command,
          planningProviderFrom(message.planningProvider ?? message.args?.[0]),
          message.providerConfigAction ?? message.manage ?? message.args?.[1],
          message.providerSecret ?? message.args?.[2],
        );
        return;
      }

      if (message.command === "drylake.startBuildSession") {
        const requestedStageCount = stageCountFrom(message.stageCount ?? message.args?.[3]);
        await vscode.commands.executeCommand(
          message.command,
          modeFrom(message.mode ?? message.args?.[0]),
          message.text ?? message.args?.[1],
          planningProviderFrom(message.planningProvider ?? message.args?.[2]),
          ...(requestedStageCount ? [requestedStageCount] : []),
        );
        return;
      }

      if (message.command === "drylake.clearChat") {
        await vscode.commands.executeCommand(message.command);
        return;
      }

      if (message.command === "drylake.toggleStep") {
        await vscode.commands.executeCommand(
          message.command,
          message.phaseId ?? message.args?.[0],
          message.stepId ?? message.args?.[1],
          message.status ?? message.args?.[2],
        );
        return;
      }

      if (message.command === "drylake.reorderPhase") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.afterPhaseId ?? message.args?.[1] ?? null);
        return;
      }

      if (message.command) {
        await vscode.commands.executeCommand(message.command, ...(message.args ?? []));
      }
    });

    await this.refresh();
  }

  async refresh() {
    if (!this.panel) {
      return;
    }

    let runbook: ApplicationBuildRunbook | null = null;
    let pendingPlanChange: PendingPlanChangeSet | null = null;
    let profilesByAgent: HandoffProfilesByAgent = {};
    try {
      runbook = (await this.sessionStore.readRunbook())?.runbook ?? null;
      pendingPlanChange = await this.sessionStore.readPendingPlanChange?.() ?? null;
      profilesByAgent = runbook ? await this.loadHandoffProfiles(runbook) : {};
    } catch {
      runbook = null;
      pendingPlanChange = null;
      profilesByAgent = {};
    }

    this.panel.webview.html = this.renderHtml(runbook, pendingPlanChange, profilesByAgent);
  }

  async openSecurityDashboard(context: vscode.ExtensionContext) {
    await context.workspaceState?.update(CONTROL_ROOM_VIEW_KEY, "security");
    await this.createOrShow(context);
  }

  dispose() {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private async loadHandoffProfiles(runbook: ApplicationBuildRunbook): Promise<HandoffProfilesByAgent> {
    const agents = [...new Set(runbook.phases.map((phase) => phase.agent).filter((agent): agent is (typeof XU_PHASE_AGENTS)[number] =>
      Boolean(agent)
    ))];
    const entries = await Promise.all(
      agents.map(async (agent) => {
        try {
          return [agent, await collectHandoffProfiles(agent)] as const;
        } catch {
          return [agent, []] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
  }

  private currentView(): ControlRoomView {
    return controlRoomViewFrom(this.context?.workspaceState?.get(CONTROL_ROOM_VIEW_KEY));
  }

  private async recordGuardScanMetadata() {
    if (!this.securityScan || !this.apiClient?.recordGuardScan) {
      return;
    }

    try {
      const result = await this.apiClient.recordGuardScan(guardScanUploadPayload(this.securityScan, "local"));
      this.lastGuardScanId = result.guardScan.id;
      const connection = this.readConnection();

      if (connection.entitlements?.canUseContinuousWatch && this.apiClient.recordContinuousWatchEvent) {
        await this.apiClient.recordContinuousWatchEvent({
          guardScanId: result.guardScan.id,
          eventType: "extension_check_in",
          severity: "info",
          logicalPath: "workspace",
          metadata: {
            score: this.securityScan.score,
            rank: this.securityScan.rank,
            findingCount: this.securityScan.findings.length,
            scannedAt: this.securityScan.scannedAt,
          },
        });
      }
    } catch (error) {
      void vscode.window.showWarningMessage(
        `DryLake Guard completed locally, but backend scan history was not recorded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private chatCollapsed(): boolean {
    return Boolean(this.context?.workspaceState?.get(CONTROL_ROOM_CHAT_COLLAPSED_KEY));
  }

  private renderHtml(
    runbook: ApplicationBuildRunbook | null,
    pendingPlanChange: PendingPlanChangeSet | null,
    profilesByAgent: HandoffProfilesByAgent,
  ) {
    const view = this.currentView();
    const planningProvider = this.readPlanningProvider();
    const chatState = this.readChatState();
    const modelTier = this.readLastModelTier();
    const connection = this.readConnection();
    const hasPlan = Boolean(runbook);
    const isSecurityView = view === "security";
    const banner = isSecurityView ? "" : renderPlanningModelBanner(modelTier, hasPlan, connection);
    const chatPanel = isSecurityView ? "" : renderChatPanel(chatState, planningProvider, hasPlan, this.chatCollapsed(), modelTier, connection);
    const body = isSecurityView
      ? renderSecurityPanel(this.securityScan, this.securityScanLoading, {
        uploadStatus: this.guardUploadStatus,
        uploadError: this.guardUploadError,
        canCreateTeamBaseline: canManageTeamBaseline(connection),
        paidUpsellVisible: this.guardPaidUpsellVisible,
        fixStatus: this.guardFixStatus,
        fixPlan: this.guardFixPlan,
        fixError: this.guardFixError,
      })
      : runbook
      ? (view === "kanban"
        ? renderKanban(runbook, pendingPlanChange, profilesByAgent)
        : renderPipeline(runbook, pendingPlanChange, profilesByAgent))
      : this.readPlanningLoading()
        ? renderKanbanLoadingState()
        : renderKanbanEmptyState();
    const executionToggle = renderExecutionModeToggle(runbook);
    const runNextButton = runbook?.phases.length ? '<button class="secondary" data-command="drylake.runNextPhase">Run Next Phase</button>' : "";
    const headerTitle = isSecurityView ? "Security" : "Agent Control";
    const headerSubtitle = "DryLake Control Plane";
    const controlRoomTabs = isSecurityView
      ? `<div class="toggle-group compact" role="tablist" aria-label="Security section">
          <button class="toggle-btn active" type="button" aria-current="page">DryLake Security Scan</button>
        </div>`
      : `<div class="toggle-group compact" role="tablist" aria-label="Agent Control section">
          <button class="toggle-btn${view === "pipeline" ? " active" : ""}" data-view="pipeline">Pipeline</button>
          <button class="toggle-btn${view === "kanban" ? " active" : ""}" data-view="kanban">Kanban</button>
        </div>`;
    const controlRoomActions = isSecurityView
      ? ""
      : `
        <button class="secondary" data-command="drylake.openSessions">Sessions</button>
        <button class="secondary" data-command="drylake.newSession">New Plan</button>`;
    const securityActions = isSecurityView && this.securityScan
      ? `<button class="secondary" data-command="drylake.openSecurityReport">Open Report</button>
        <button class="secondary" data-command="drylake.copySecuritySummary">Copy Summary</button>`
      : "";
    const executionToolbar = !isSecurityView && (executionToggle || runNextButton)
      ? `<div class="secondary-tabs">
          ${executionToggle}
          ${runNextButton}
        </div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    :root { --drylake-bg: #090a0a; --drylake-panel: #111414; --drylake-panel-2: #0d0f0f; --drylake-line: #27272a; --drylake-muted: #a1a1aa; --drylake-text: #f4f4f5; --drylake-green: #34d399; --drylake-green-soft: #17251d; --drylake-orange: #fb923c; --drylake-orange-soft: #2a1710; --drylake-red: #f87171; --drylake-paper: #090a0a; --drylake-ink: #f4f4f5; --drylake-yellow: #34d399; --drylake-blue: #fb923c; --drylake-pink: #fb923c; --drylake-white: #111414; --drylake-font: "Helvetica Neue", Helvetica, system-ui, sans-serif; --drylake-brand-font: "Bricolage Grotesque", "Helvetica Neue", Helvetica, system-ui, sans-serif; }
    body { margin: 0; color: var(--drylake-text); background: var(--drylake-bg); font-family: var(--drylake-font); font-weight: 400; letter-spacing: 0; color-scheme: dark; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: grid; gap: 12px; margin-bottom: 14px; padding: 14px 16px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .header-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 24px; font-weight: 650; letter-spacing: 0; }
    h2 { margin: 8px 0; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 20px; font-weight: 600; letter-spacing: 0; }
    h3, p { margin: 0; }
    button, select, textarea { font: inherit; }
    button { color: #090a0a; background: var(--drylake-green); border: 1px solid var(--drylake-green); border-radius: 4px; padding: 7px 11px; cursor: pointer; font-weight: 650; box-shadow: none; }
    button:hover { background: #6ee7b7; border-color: #6ee7b7; }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    button.secondary, .toggle-btn, .execution-mode-toggle { color: var(--drylake-text); background: var(--drylake-bg); border-color: #3f3f46; }
    button.secondary:hover, .toggle-btn:hover, .execution-mode-toggle:hover { border-color: var(--drylake-orange); color: #fed7aa; background: var(--drylake-bg); }
    .eyebrow, .planning-banner-eyebrow, .chat-eyebrow, .phase-id { color: var(--drylake-green); text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
    .muted, .objective, .agent-label, .step-count, .drop-zone, .planning-banner-reason, .chat-empty, .chat-meta { color: var(--drylake-muted); line-height: 1.45; }
    .actions, .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .product-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
    .product-tab { display: grid; gap: 2px; min-height: 58px; padding: 11px 14px; color: var(--drylake-text); background: var(--drylake-bg); border-color: #3f3f46; text-align: left; }
    .product-tab strong { color: var(--drylake-text); font-size: 15px; line-height: 1.2; }
    .product-tab span { color: var(--drylake-muted); font-size: 11px; line-height: 1.25; }
    .product-tab.active { border-color: var(--drylake-green); background: var(--drylake-green-soft); }
    .product-tab.active strong { color: #a7f3d0; }
    .secondary-tabs { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 2px; }
    .toggle-group.compact { align-items: center; }
    .guard-header-pill { align-self: center; padding: 7px 10px; border: 1px solid rgba(251, 146, 60, 0.4); border-radius: 999px; color: #fed7aa; background: rgba(251, 146, 60, 0.08); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.08em; }
    .toggle-btn.active { color: #090a0a; background: var(--drylake-green); border-color: var(--drylake-green); }
    .execution-mode-toggle { display: grid; gap: 2px; min-width: 190px; padding: 7px 10px; text-align: left; border-radius: 6px; }
    .execution-mode-toggle strong { color: var(--drylake-text); font-size: 12px; line-height: 1.15; }
    .execution-mode-toggle span { color: var(--drylake-muted); font-size: 10px; line-height: 1.2; }
    .execution-mode-toggle .execution-mode-label { color: var(--drylake-orange); text-transform: uppercase; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; }
    .execution-mode-toggle.active { border-color: var(--drylake-green); background: var(--drylake-green-soft); }
    .execution-mode-toggle.active strong { color: #a7f3d0; }
    .pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 10px; }
    .arrow { display: flex; align-items: center; padding: 0 8px; color: var(--drylake-orange); font-size: 22px; font-weight: 700; flex: 0 0 auto; }
    .phase-card { min-width: 210px; max-width: 220px; flex: 0 0 210px; min-height: 360px; display: flex; flex-direction: column; border: 1px solid var(--drylake-line); border-radius: 8px; padding: 12px; background: var(--drylake-panel); box-shadow: none; overflow: hidden; }
    .phase-card.active, .phase-card.active-phase { border-color: var(--drylake-orange); background: var(--drylake-orange-soft); }
    .phase-card.approved, .phase-card.complete { border-color: rgba(52, 211, 153, 0.65); }
    .phase-card.complete { opacity: 0.82; }
    .phase-card-top { display: flex; align-items: center; gap: 8px; min-height: 22px; }
    .drag-handle { display: inline-grid; grid-template-columns: repeat(3, 3px); gap: 3px; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; padding: 0; color: var(--drylake-muted); background: transparent; border: 1px solid #3f3f46; border-radius: 4px; cursor: move; }
    .drag-handle span { display: block; width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
    .drag-handle:hover, .drag-handle:focus { color: #fed7aa; background: rgba(251, 146, 60, 0.12); border-color: rgba(251, 146, 60, 0.65); outline: none; }
    .phase-card.dragging { opacity: 0.5; border-style: dashed; }
    .pipeline .phase-card.drop-before { border-left: 4px solid var(--drylake-orange); }
    .pipeline .phase-card.drop-after { border-right: 4px solid var(--drylake-orange); }
    .kanban .phase-card.drop-before { border-top: 4px solid var(--drylake-orange); }
    .kanban .phase-card.drop-after { border-bottom: 4px solid var(--drylake-orange); }
    .phase-title { margin: 5px 0 8px; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 13px; font-weight: 600; line-height: 1.25; letter-spacing: 0; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border: 1px solid var(--drylake-line); border-radius: 4px; color: var(--drylake-muted); background: var(--drylake-bg); font-size: 10px; font-weight: 650; }
    .badge.active { border-color: rgba(251, 146, 60, 0.6); background: var(--drylake-orange-soft); color: #fed7aa; }
    .badge.approved, .badge.complete { border-color: rgba(52, 211, 153, 0.55); background: var(--drylake-green-soft); color: #a7f3d0; }
    .objective { height: 34px; min-height: 34px; margin-bottom: 8px; font-size: 11px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .task-fit-preview { display: grid; gap: 5px; margin: 0 0 8px; padding: 7px; border: 1px solid rgba(52, 211, 153, 0.28); border-radius: 5px; background: rgba(52, 211, 153, 0.06); }
    .task-fit-label { color: #a7f3d0; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .task-fit-row { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 6px; align-items: start; }
    .task-fit-row span { color: var(--drylake-green); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .task-fit-row p { color: var(--drylake-text); font-size: 11px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .agent-label, .profile-label { display: block; font-size: 10px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.08em; }
    .profile-label { margin-top: 6px; }
    .agent-select, .profile-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 11px; }
    .profile-select:disabled { opacity: 0.68; cursor: not-allowed; }
    .step-count { margin-top: 8px; font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--drylake-line); color: var(--drylake-text); background: var(--drylake-panel-2); text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border: 1px solid var(--drylake-line); border-radius: 4px; color: var(--drylake-green); background: var(--drylake-bg); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; min-height: 360px; margin-bottom: 8px; }
    .drop-zone { padding: 10px; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center; font-size: 11px; }
    .kanban-column.drag-over .drop-zone { border-color: var(--drylake-orange); color: #fed7aa; }
    .empty-state, .loading-state { border: 1px solid var(--drylake-line); border-radius: 8px; padding: 18px; background: var(--drylake-panel); box-shadow: none; }
    .loading-state { border-style: dashed; }
    .loading-title { margin-bottom: 12px; color: var(--drylake-green); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
    .loading-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .loading-card { display: flex; flex-direction: column; gap: 9px; min-height: 170px; border: 1px solid var(--drylake-line); border-radius: 6px; padding: 12px; background: var(--drylake-panel-2); }
    .loading-line { display: block; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #18181b, #27272a, #18181b); background-size: 200% 100%; animation: pulse 1.2s ease-in-out infinite; }
    .loading-line.short { width: 44%; }
    .loading-line.medium { width: 70%; }
    @keyframes pulse { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .prompt-panel { margin-top: 14px; display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 170px; resize: vertical; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; padding: 12px; line-height: 1.45; }
    .planner-setup { display: grid; gap: 10px; padding: 12px 14px; margin: 0 0 10px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .planner-setup-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .planner-setup-eyebrow { color: var(--drylake-green); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .planner-setup-title { margin-top: 2px; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 12px; font-weight: 600; letter-spacing: 0; }
    .planner-setup-status { max-width: 380px; color: var(--drylake-muted); font-size: 11px; line-height: 1.35; text-align: right; }
    .mode-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .mode-chip { padding: 4px 8px; border: 1px solid #3f3f46; border-radius: 999px; color: var(--drylake-text); background: var(--drylake-bg); font-size: 10px; box-shadow: none; }
    .mode-chip.active { border-color: var(--drylake-green); background: var(--drylake-green-soft); color: #a7f3d0; }
    .planning-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, auto); align-items: start; gap: 10px; }
    .planning-provider-field { display: grid; gap: 5px; min-width: 0; }
    .planning-provider-label { color: var(--drylake-muted); font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.08em; }
    .planning-provider-select { width: 100%; min-width: 0; padding: 7px 8px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 12px; letter-spacing: 0; }
    .planning-provider-select:focus { outline: none; border-color: rgba(52, 211, 153, 0.72); }
    .planning-provider-select:disabled { opacity: 0.72; cursor: not-allowed; }
    .planning-provider-select option, .stage-count-select option { color: var(--drylake-text); background: var(--drylake-bg); }
    .planning-provider-note { min-height: 16px; color: var(--drylake-muted); font-size: 11px; line-height: 1.35; }
    .frontier-upgrade-cta { justify-self: start; display: inline-flex; align-items: center; gap: 7px; width: max-content; max-width: 100%; padding: 6px 10px; border: 1px solid rgba(251, 146, 60, 0.78); border-radius: 999px; color: #090a0a; background: var(--drylake-orange); font-size: 11px; font-weight: 750; box-shadow: none; }
    .frontier-upgrade-cta::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #090a0a; opacity: 0.75; }
    .frontier-upgrade-cta:hover { color: #090a0a; background: #fdba74; border-color: #fdba74; }
    .frontier-upgrade-cta[hidden] { display: none; }
    .provider-config-panel { display: grid; gap: 7px; padding: 9px; border: 1px solid rgba(251, 146, 60, 0.42); border-radius: 6px; background: var(--drylake-orange-soft); }
    .provider-config-panel[hidden] { display: none; }
    .provider-config-title { color: #fed7aa; font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.08em; }
    .provider-config-help, .provider-secret-status { color: #fed7aa; font-size: 11px; line-height: 1.35; }
    .provider-secret-fields { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
    .provider-secret-fields[hidden] { display: none; }
    .provider-secret-fields input { min-width: 0; padding: 7px 8px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid rgba(251, 146, 60, 0.48); border-radius: 4px; font-size: 12px; }
    .provider-secret-fields input:focus { outline: none; border-color: var(--drylake-orange); }
    .provider-config-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .provider-config-secondary { padding: 5px 8px; color: #fed7aa; background: var(--drylake-bg); border-color: rgba(251, 146, 60, 0.5); font-size: 11px; }
    .provider-config-secondary[hidden] { display: none; }
    .provider-config-secondary:hover { color: #090a0a; background: var(--drylake-orange); border-color: var(--drylake-orange); }
    .stage-count-field { display: grid; gap: 6px; min-width: 0; }
    .stage-count-label { display: inline-flex; align-items: center; gap: 8px; color: var(--drylake-muted); font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.08em; }
    .planning-info-icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; border: 1px solid rgba(251, 146, 60, 0.72); border-radius: 999px; color: var(--drylake-orange); background: var(--drylake-orange-soft); font-size: 11px; font-weight: 800; text-transform: none; letter-spacing: 0; cursor: pointer; }
    .planning-info-icon:hover, .planning-info-icon:focus { color: #090a0a; background: var(--drylake-orange); border-color: var(--drylake-orange); outline: none; }
    .stage-count-select { min-width: 92px; padding: 6px 8px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 12px; text-transform: none; letter-spacing: 0; }
    .stage-count-select:disabled { opacity: 0.72; cursor: not-allowed; }
    .planning-info-text { margin: 0; color: var(--drylake-muted); font-size: 11px; line-height: 1.4; }
    .model-tier-bar { display: inline-flex; align-items: center; gap: 7px; width: max-content; max-width: 100%; padding: 5px 10px; margin: 0 0 12px; border: 1px solid rgba(251, 146, 60, 0.45); border-radius: 999px; color: #fed7aa; background: var(--drylake-orange-soft); font-size: 11px; font-weight: 650; }
    .model-tier-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--drylake-orange); box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.12); }
    .nano-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; margin: 0 0 14px; border: 1px solid rgba(251, 146, 60, 0.45); border-radius: 6px; background: var(--drylake-orange-soft); font-size: 12px; }
    .nano-banner-text, .plan-change-eyebrow { color: #fed7aa; }
    .nano-banner-cta { padding: 4px 10px; font-size: 11px; white-space: nowrap; }
    .planning-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin: 0 0 16px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); font-size: 12px; }
    .planning-banner.pro { border-color: rgba(52, 211, 153, 0.5); }
    .planning-banner.fallback { border-color: rgba(251, 146, 60, 0.5); }
    .planning-banner-label { color: var(--drylake-text); }
    .step-list-wrap { margin-top: 8px; max-height: 106px; overflow: hidden; }
    .step-list { list-style: none; padding: 0 2px 0 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; max-height: 82px; overflow-y: auto; }
    .step-item label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 12px; line-height: 1.4; color: var(--drylake-text); }
    .step-item input[type="checkbox"] { margin-top: 2px; accent-color: var(--drylake-green); }
    .step-item.done span { text-decoration: line-through; color: #71717a; }
    .phase-actions { display: flex; flex-direction: column; gap: 6px; margin-top: auto; padding-top: 10px; }
    .handoff-btn { width: 100%; font-size: 12px; padding: 6px 10px; }
    .mark-complete-btn { border-color: rgba(52, 211, 153, 0.65); color: #a7f3d0; }
    .handoff-menu { position: relative; }
    .handoff-menu summary { list-style: none; width: 100%; padding: 5px 8px; border: 1px solid #3f3f46; border-radius: 4px; color: var(--drylake-text); background: var(--drylake-bg); font-size: 11px; font-weight: 650; text-align: center; cursor: pointer; box-shadow: none; }
    .handoff-menu summary::-webkit-details-marker { display: none; }
    .handoff-menu summary::after { content: " v"; }
    .handoff-menu[open] summary::after { content: " ^"; }
    .handoff-menu-items { display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 6px; padding: 6px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .handoff-menu-item { padding: 5px 7px; font-size: 10px; box-shadow: none; background: var(--drylake-bg); color: var(--drylake-text); border-color: #3f3f46; }
    .plan-change-overlay { margin-top: 10px; padding: 9px; border: 1px solid rgba(251, 146, 60, 0.55); border-radius: 5px; background: var(--drylake-orange-soft); flex: 0 0 auto; }
    .plan-change-eyebrow { text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; }
    .plan-change-overlay p { margin: 5px 0 8px; color: var(--drylake-text); font-size: 11px; line-height: 1.35; }
    .plan-change-actions { display: grid; grid-template-columns: 1fr; gap: 5px; }
    .plan-change-actions button { padding: 5px 7px; font-size: 10px; box-shadow: none; }
    .chat-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; margin: 0 0 18px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .chat-panel.collapsed { padding: 8px 14px; }
    .chat-header { display: flex; align-items: center; justify-content: space-between; }
    .chat-controls { display: flex; gap: 6px; }
    .chat-clear, .collapse-btn { padding: 4px 8px; font-size: 11px; box-shadow: none; }
    .context-meter { display: grid; gap: 6px; padding: 8px 10px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .context-meter-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .context-meter-label { color: var(--drylake-text); font-size: 12px; font-weight: 650; }
    .context-meter-status { color: var(--drylake-green); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; }
    .context-meter-track { width: 100%; height: 7px; overflow: hidden; border-radius: 999px; background: #18181b; }
    .context-meter-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--drylake-orange), var(--drylake-green)); }
    .context-meter-detail { color: var(--drylake-muted); font-size: 11px; line-height: 1.35; }
    .chat-messages { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
    .chat-message { padding: 8px 10px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .chat-message.user { border-color: rgba(251, 146, 60, 0.6); }
    .chat-message.system { border-style: dashed; opacity: 0.85; }
    .chat-meta { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .chat-body { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .chat-empty { padding: 8px 4px; font-size: 12px; }
    .chat-form textarea { min-height: 56px; }
    .chat-form-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
    .chat-hint { font-size: 11px; }
    .security-panel { display: grid; gap: 14px; }
    .security-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .security-hero p { max-width: 680px; color: var(--drylake-muted); font-size: 13px; line-height: 1.45; }
    .security-flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .security-flow div { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 10px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel); }
    .security-flow strong { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 999px; color: #090a0a; background: var(--drylake-orange); font-size: 12px; }
    .security-flow span { color: var(--drylake-muted); font-size: 12px; line-height: 1.35; }
    .security-progress { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .security-progress h3 { margin: 0; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 14px; font-weight: 650; }
    .security-progress p { margin: 0; color: var(--drylake-muted); font-size: 12px; line-height: 1.4; }
    .security-progress-list { margin-top: 8px; display: grid; gap: 6px; }
    .security-progress-item { display: grid; gap: 2px; padding: 8px; border: 1px dashed #303734; border-radius: 6px; background: rgba(255, 255, 255, 0.02); }
    .security-progress-item strong { color: var(--drylake-text); font-size: 12px; }
    .security-progress-item small { color: #94a09a; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .security-progress-item span { color: var(--drylake-muted); font-size: 11px; line-height: 1.35; }
    .security-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .security-eyebrow { color: var(--drylake-orange); text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; }
    .security-note { padding: 10px 12px; border: 1px solid rgba(251, 146, 60, 0.35); border-radius: 6px; color: #fed7aa; background: var(--drylake-orange-soft); font-size: 12px; line-height: 1.4; }
    .security-note.good { color: #a7f3d0; border-color: rgba(52, 211, 153, 0.45); background: rgba(52, 211, 153, 0.08); }
    .security-note.warn { color: #fecaca; border-color: rgba(248, 113, 113, 0.5); background: rgba(248, 113, 113, 0.08); }
    .security-consent, .security-upsell { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid rgba(251, 146, 60, 0.45); border-radius: 8px; background: rgba(251, 146, 60, 0.08); }
    .security-consent strong, .security-upsell h3 { color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 15px; font-weight: 650; }
    .security-consent p, .security-upsell p { max-width: 720px; color: var(--drylake-muted); font-size: 12px; line-height: 1.45; }
    .security-upload-detail { display: grid; gap: 6px; margin-top: 10px; max-width: 780px; }
    .security-upload-title { color: #fed7aa; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .security-upload-row { display: grid; gap: 2px; padding: 7px 8px; border: 1px solid rgba(251, 146, 60, 0.28); border-radius: 6px; background: rgba(9, 10, 10, 0.38); }
    .security-upload-row strong { font-size: 12px; }
    .security-upload-row small { color: #b0aaa4; font-size: 11px; line-height: 1.3; }
    .security-upload-row span { color: var(--drylake-muted); font-size: 11px; line-height: 1.35; }
    .security-upsell { align-items: flex-start; border-color: rgba(52, 211, 153, 0.45); background: rgba(52, 211, 153, 0.07); }
    .security-upsell ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 14px; margin: 0; padding: 0; list-style: none; color: #a7f3d0; font-size: 12px; }
    .security-upsell li::before { content: "- "; color: var(--drylake-orange); }
    .security-fix-plan { display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(52, 211, 153, 0.42); border-radius: 8px; background: rgba(52, 211, 153, 0.07); }
    .security-fix-plan.failed { border-color: rgba(248, 113, 113, 0.5); background: rgba(248, 113, 113, 0.08); }
    .security-fix-plan h3 { margin: 2px 0 5px; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 16px; font-weight: 650; }
    .security-fix-plan p { color: var(--drylake-muted); font-size: 12px; line-height: 1.45; }
    .security-fix-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .security-fix-actions { display: grid; gap: 8px; }
    .security-fix-action { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; padding: 10px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .security-fix-action.critical, .security-fix-action.high { border-color: rgba(248, 113, 113, 0.5); }
    .security-fix-action.medium { border-color: rgba(251, 146, 60, 0.42); }
    .security-fix-action strong { display: block; margin-bottom: 2px; color: var(--drylake-text); font-size: 13px; }
    .security-fix-action small { display: block; margin-bottom: 6px; color: #71717a; font-size: 11px; overflow-wrap: anywhere; }
    .security-fix-action p + p { margin-top: 5px; color: #d4d4d8; }
    .security-fix-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .security-fix-meta div { padding: 10px; border: 1px solid var(--drylake-line); border-radius: 6px; background: rgba(9, 10, 10, 0.42); }
    .security-fix-meta strong { color: var(--drylake-text); font-size: 12px; }
    .security-fix-meta ul { margin: 7px 0 0; padding-left: 18px; color: var(--drylake-muted); font-size: 12px; line-height: 1.4; }
    .security-score-row { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 12px; }
    .security-score { display: grid; align-content: center; gap: 4px; min-height: 150px; padding: 16px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .security-score span, .security-metric span { color: var(--drylake-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
    .security-score strong { color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 48px; line-height: 1; }
    .security-score small { color: var(--drylake-green); font-size: 13px; font-weight: 750; }
    .security-score.scout, .security-score.builder { border-color: rgba(248, 113, 113, 0.6); }
    .security-score.scout small, .security-score.builder small { color: var(--drylake-red); }
    .security-score.operator { border-color: rgba(251, 146, 60, 0.62); }
    .security-score.operator small { color: var(--drylake-orange); }
    .security-score.guardian, .security-score.sentinel { border-color: rgba(52, 211, 153, 0.6); }
    .security-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .security-category-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
    .security-metric { display: grid; gap: 5px; min-height: 70px; padding: 12px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel); }
    .security-metric strong { color: var(--drylake-text); font-size: 22px; line-height: 1; }
    .security-metric.warn { border-color: rgba(248, 113, 113, 0.55); }
    .security-metric.caution { border-color: rgba(251, 146, 60, 0.45); }
    .security-metric.good { border-color: rgba(52, 211, 153, 0.36); }
    .security-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.82fr); gap: 12px; }
    .security-section { display: grid; align-content: start; gap: 8px; padding: 12px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .security-section h3 { margin: 0 0 2px; color: var(--drylake-text); font-family: var(--drylake-brand-font); font-size: 14px; font-weight: 650; }
    .security-finding, .security-mcp { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; padding: 9px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .security-finding p, .security-mcp p, .security-extension li { color: var(--drylake-muted); font-size: 12px; line-height: 1.4; }
    .security-finding small, .security-mcp small, .security-extension small { color: #71717a; font-size: 11px; }
    .security-severity { align-self: start; padding: 3px 6px; border: 1px solid var(--drylake-line); border-radius: 999px; color: var(--drylake-muted); font-size: 10px; font-weight: 800; text-align: center; text-transform: uppercase; }
    .security-finding.critical .security-severity, .security-finding.high .security-severity { color: #fecaca; border-color: rgba(248, 113, 113, 0.58); background: rgba(248, 113, 113, 0.1); }
    .security-finding.medium .security-severity, .security-mcp.medium { border-color: rgba(251, 146, 60, 0.45); }
    .security-extension { border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .security-extension summary { display: flex; justify-content: space-between; gap: 10px; padding: 9px; cursor: pointer; }
    .security-extension summary span { color: var(--drylake-text); font-weight: 700; }
    .security-extension summary small { color: var(--drylake-muted); }
    .security-extension ul { margin: 0; padding: 0 12px 10px 26px; }
    .security-tags { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 9px 9px; }
    .capability-tags span { color: #a7f3d0; border-color: rgba(52, 211, 153, 0.34); background: rgba(52, 211, 153, 0.08); }
    .security-tags span { padding: 2px 6px; border: 1px solid rgba(251, 146, 60, 0.36); border-radius: 999px; color: #fed7aa; background: rgba(251, 146, 60, 0.08); font-size: 10px; font-weight: 650; }
    .security-mcp { grid-template-columns: minmax(0, 1fr) minmax(160px, 0.45fr); }
    .security-mcp.high { border-color: rgba(248, 113, 113, 0.52); }
    .security-connection-row { display: grid; gap: 3px; padding: 9px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .security-connection-row strong { color: var(--drylake-text); font-size: 12px; }
    .security-connection-row span { color: var(--drylake-muted); font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
    .security-connection-row small { color: #71717a; font-size: 11px; overflow-wrap: anywhere; }
    .security-connection-row.critical, .security-connection-row.high, .security-extension.high { border-color: rgba(248, 113, 113, 0.5); }
    .security-connection-row.medium, .security-extension.medium { border-color: rgba(251, 146, 60, 0.42); }
    .security-empty-line { padding: 10px; border: 1px dashed #3f3f46; border-radius: 6px; color: var(--drylake-muted); font-size: 12px; }
    @media (max-width: 860px) { .header-brand-row, .nano-banner, .planner-setup-header, .security-consent, .security-upsell, .security-fix-header { align-items: flex-start; flex-direction: column; } .product-tabs, .planning-controls { grid-template-columns: 1fr; } .secondary-tabs { justify-content: flex-start; } .stage-count-label { justify-content: flex-start; } .planner-setup-status { max-width: none; text-align: left; } .kanban { grid-template-columns: 1fr; } }
    @media (max-width: 860px) { .security-hero { flex-direction: column; } .security-actions { justify-content: flex-start; } .security-flow, .security-score-row, .security-grid, .security-upsell ul, .security-fix-meta { grid-template-columns: 1fr; } .security-metrics, .security-category-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="header-brand-row">
        <div>
        <div class="eyebrow">${escapeHtml(headerSubtitle)}</div>
        <h1>${escapeHtml(headerTitle)}</h1>
        </div>
        ${isSecurityView ? '<span class="guard-header-pill">AWS-backed Active Guard</span>' : ""}
      </div>
      <div class="product-tabs" role="tablist" aria-label="DryLake product surface">
        <button class="product-tab${isSecurityView ? "" : " active"}" data-product-view="control-room" type="button">
          <strong>Agent Control</strong>
          <span>Plan and run agent handoffs</span>
        </button>
        <button class="product-tab${isSecurityView ? " active" : ""}" data-product-view="guard" type="button">
          <strong>Security</strong>
          <span>Guard agentic posture</span>
        </button>
      </div>
      <div class="secondary-tabs">
        ${controlRoomTabs}
        ${controlRoomActions}
        ${securityActions}
      </div>
      ${executionToolbar}
    </header>
    ${banner}
    ${chatPanel}
    ${body}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    let selectedMode = "build-app";

    const chatMessagesEl = document.getElementById("chatMessages");
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const planningProviderSelect = document.getElementById("planningProviderSelect");
    const stageCountSelect = document.getElementById("stageCountSelect");

    function isRegisteredUser() {
      return document.querySelector(".chat-panel")?.dataset.registered === "true";
    }

    let registrationPromptOpen = false;
    function requireRegistration() {
      if (registrationPromptOpen) {
        return;
      }
      registrationPromptOpen = true;
      vscode.postMessage({ command: "drylake.requireRegistration", args: [] });
      setTimeout(() => {
        registrationPromptOpen = false;
      }, 1200);
    }

    function selectedPlanningOption() {
      return planningProviderSelect?.selectedOptions?.[0] || null;
    }

    let selectedProvider = selectedPlanningOption()?.dataset.planningProvider || "xupra-pro-ai";
    let selectedProviderLocked = selectedPlanningOption()?.dataset.proLocked === "true";

    function providerNeedsLocalConfiguration(providerId) {
      return ["databricks-api", "claude-api", "openai-api", "hermes-agent"].includes(providerId);
    }

    function providerSecretLabel(providerId) {
      if (providerId === "claude-api") {
        return "Anthropic API key";
      }
      if (providerId === "openai-api") {
        return "OpenAI API key";
      }
      if (providerId === "databricks-api") {
        return "Databricks token";
      }
      return "Hermes CLI configuration";
    }

    function providerSecretPlaceholder(providerId) {
      if (providerId === "claude-api") {
        return "sk-ant-...";
      }
      if (providerId === "openai-api") {
        return "sk-...";
      }
      if (providerId === "databricks-api") {
        return "dapi...";
      }
      return "";
    }

    function providerSecretHelp(providerId) {
      if (providerId === "hermes-agent") {
        return "Hermes keys stay in Hermes' own local CLI configuration. DryLake only calls the hermes command.";
      }
      return "Paste the key here. DryLake stores it in VS Code SecretStorage on this machine.";
    }

    function syncProviderSelection() {
      const option = selectedPlanningOption();
      selectedProvider = option?.dataset.planningProvider || "xupra-pro-ai";
      selectedProviderLocked = option?.dataset.proLocked === "true";

      const nanoBanner = document.querySelector("[data-nano-banner]");
      if (nanoBanner) {
        nanoBanner.hidden = planningProviderSelect?.value !== "xupra-nano";
      }

      const note = document.querySelector("[data-provider-note]");
      if (note && option) {
        if (selectedProviderLocked) {
          note.textContent = "Pro users only. Upgrade to use Xupra AI Frontier Models.";
        } else if (planningProviderSelect?.value === "xupra-nano") {
          note.textContent = "We are using Claude Haiku for free planning.";
        } else {
          note.textContent = option.textContent?.split(" - ").slice(1).join(" - ") || "";
        }
      }

      const frontierUpgrade = document.querySelector("[data-frontier-upgrade]");
      if (frontierUpgrade) {
        frontierUpgrade.hidden = !selectedProviderLocked;
      }

      const providerConfig = document.querySelector("[data-provider-config-panel]");
      const providerSecretFields = document.querySelector("[data-provider-secret-fields]");
      const providerSecretInput = document.querySelector("[data-provider-secret-input]");
      const providerConfigTitle = document.querySelector("[data-provider-config-title]");
      const providerConfigHelp = document.querySelector("[data-provider-config-help]");
      const providerClearButton = document.querySelector("[data-provider-config-action='clear-secret']");
      const providerSettingsButton = document.querySelector("[data-provider-config-action='open-settings']");
      const isConfigurable = providerNeedsLocalConfiguration(selectedProvider);
      const isHermes = selectedProvider === "hermes-agent";
      if (providerConfig) {
        providerConfig.hidden = selectedProviderLocked || !isConfigurable;
      }
      if (providerSecretFields) {
        providerSecretFields.hidden = isHermes;
      }
      if (providerSecretInput) {
        providerSecretInput.value = "";
        providerSecretInput.placeholder = providerSecretPlaceholder(selectedProvider);
        providerSecretInput.setAttribute("aria-label", providerSecretLabel(selectedProvider));
      }
      if (providerConfigTitle) {
        providerConfigTitle.textContent = providerSecretLabel(selectedProvider);
      }
      if (providerConfigHelp) {
        providerConfigHelp.textContent = providerSecretHelp(selectedProvider);
      }
      if (providerClearButton) {
        providerClearButton.hidden = isHermes;
      }
      if (providerSettingsButton) {
        providerSettingsButton.textContent = isHermes ? "Open Hermes Settings" : "Provider Settings";
      }
    }

    function toggleInfoPanel(key) {
      const panel = document.querySelector('[data-info-panel="' + key + '"]');
      const button = document.querySelector('[data-info-toggle="' + key + '"]');
      if (!panel || !button) {
        return;
      }

      const nextHidden = !panel.hidden;
      panel.hidden = nextHidden;
      button.setAttribute("aria-expanded", nextHidden ? "false" : "true");
    }

    syncProviderSelection();

    function sendChat() {
      if (!chatInput) {
        return;
      }
      const text = chatInput.value.trim();
      if (!text) {
        return;
      }
      if (!isRegisteredUser()) {
        requireRegistration();
        chatInput.focus();
        return;
      }
      if (selectedProviderLocked) {
        vscode.postMessage({
          command: "xupra.openBilling",
          args: [{
            required: "pro",
            source: "extension",
            returnPath: "/app",
          }],
        });
        return;
      }
      const hasPlan = document.querySelector(".chat-panel")?.dataset.hasPlan === "true";
      const stageValue = stageCountSelect?.value || "";
      const stageCount = stageValue ? Number(stageValue) : undefined;
      vscode.postMessage({
        command: hasPlan ? "drylake.chatSendMessage" : "drylake.startBuildSession",
        text: text,
        mode: selectedMode,
        planningProvider: selectedProvider,
        stageCount: stageCount
      });
      chatInput.value = "";
    }
    chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChat();
    });
    chatInput?.addEventListener("focus", () => {
      if (!isRegisteredUser()) {
        requireRegistration();
        chatInput.blur();
      }
    });
    chatInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChat();
      }
    });

    function clearDropIndicators() {
      document.querySelectorAll(".drag-over, .drop-before, .drop-after").forEach((item) => {
        item.classList.remove("drag-over", "drop-before", "drop-after");
      });
    }

    function insertionSide(card, event, orientation) {
      const rect = card.getBoundingClientRect();
      if (orientation === "horizontal") {
        return event.clientX < rect.left + rect.width / 2 ? "before" : "after";
      }

      return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    }

    function previousPhaseId(card) {
      let previous = card.previousElementSibling;
      while (previous && !previous.matches(".phase-card[data-phase-id]")) {
        previous = previous.previousElementSibling;
      }

      return previous?.dataset.phaseId || null;
    }

    function afterPhaseIdForCardDrop(card, event, orientation) {
      return insertionSide(card, event, orientation) === "before" ? previousPhaseId(card) : card.dataset.phaseId;
    }

    document.addEventListener("click", (event) => {
      const productViewButton = event.target.closest("[data-product-view]");
      if (productViewButton) {
        const productView = productViewButton.dataset.productView || "control-room";
        vscode.postMessage({
          command: "drylake.setControlRoomView",
          view: productView === "guard" ? "security" : "pipeline"
        });
        return;
      }

      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        vscode.postMessage({ command: "drylake.setControlRoomView", view: viewButton.dataset.view });
        return;
      }

      const modeChip = event.target.closest(".mode-chip[data-mode]");
      if (modeChip) {
        selectedMode = modeChip.dataset.mode || "build-app";
        document.querySelectorAll(".mode-chip").forEach((chip) => {
          const active = chip === modeChip;
          chip.classList.toggle("active", active);
          chip.setAttribute("aria-pressed", active ? "true" : "false");
        });
        document.getElementById("chatInput")?.focus();
        return;
      }

      const providerConfigAction = event.target.closest("[data-provider-config-action]");
      if (providerConfigAction) {
        const action = providerConfigAction.dataset.providerConfigAction || "";
        const status = document.querySelector("[data-provider-secret-status]");
        let secret = "";
        if (action === "save-secret") {
          const input = document.querySelector("[data-provider-secret-input]");
          secret = input?.value?.trim() || "";
          if (!secret) {
            if (status) {
              status.textContent = "Paste a key before saving.";
            }
            input?.focus();
            return;
          }
          input.value = "";
          if (status) {
            status.textContent = "Saving key securely...";
          }
        }
        vscode.postMessage({
          command: "drylake.configurePlanningProvider",
          planningProvider: selectedProvider,
          providerConfigAction: action,
          providerSecret: secret
        });
        return;
      }

      const infoToggle = event.target.closest("[data-info-toggle]");
      if (infoToggle) {
        toggleInfoPanel(infoToggle.dataset.infoToggle || "");
        return;
      }

      const commandEl = event.target.closest("[data-command]");
      if (commandEl) {
        vscode.postMessage({
          command: commandEl.dataset.command,
          args: parseBillingCommandArgs(commandEl as Element),
        });
        return;
      }

      const planChangeBtn = event.target.closest("[data-plan-change-action]");
      if (planChangeBtn) {
        vscode.postMessage({
          command: planChangeBtn.dataset.planChangeAction === "approve"
            ? "drylake.approvePlanChange"
            : "drylake.rejectPlanChange",
          phaseId: planChangeBtn.dataset.phaseId
        });
        return;
      }

      const multiAgentBtn = event.target.closest("[data-multi-agent-phase]");
      if (multiAgentBtn) {
        vscode.postMessage({
          command: "drylake.openMultiAgentForPhase",
          phaseId: multiAgentBtn.dataset.multiAgentPhase
        });
        return;
      }

      const phaseStatusBtn = event.target.closest("[data-phase-status-update]");
      if (phaseStatusBtn) {
        vscode.postMessage({
          command: "drylake.updatePhaseStatus",
          phaseId: phaseStatusBtn.dataset.phaseStatusUpdate,
          status: phaseStatusBtn.dataset.status || "complete"
        });
        return;
      }

      const handoffBtn = event.target.closest("[data-handoff-phase]");
      if (handoffBtn) {
        const action = handoffBtn.dataset.handoffAction || "run";
        vscode.postMessage({
          command: "drylake.handoffPhase",
          phaseId: handoffBtn.dataset.handoffPhase,
          handoffAction: action
        });
      }
    });

    document.addEventListener("change", (event) => {
      const providerSelect = event.target.closest("#planningProviderSelect");
      if (providerSelect) {
        syncProviderSelection();
        if (selectedProviderLocked) {
          vscode.postMessage({
            command: "xupra.openBilling",
            args: [{
              required: "pro",
              source: "extension",
              returnPath: "/app",
            }],
          });
        } else if (providerNeedsLocalConfiguration(selectedProvider)) {
          if (selectedProvider === "hermes-agent") {
            document.querySelector("[data-provider-config-action='open-settings']")?.focus();
          } else {
            document.querySelector("[data-provider-secret-input]")?.focus();
          }
        } else {
          document.getElementById("chatInput")?.focus();
        }
        return;
      }

      const select = event.target.closest("[data-phase-agent]");
      if (select) {
        vscode.postMessage({
          command: "drylake.updatePhaseAgent",
          phaseId: select.dataset.phaseAgent,
          agent: select.value
        });
        return;
      }

      const profileSelect = event.target.closest("[data-phase-profile]");
      if (profileSelect) {
        vscode.postMessage({
          command: "drylake.updatePhaseHandoffProfile",
          phaseId: profileSelect.dataset.phaseProfile,
          profileLogicalPath: profileSelect.value || ""
        });
        return;
      }

      const stepToggle = event.target.closest(".step-toggle");
      if (stepToggle) {
        vscode.postMessage({
          command: "drylake.toggleStep",
          phaseId: stepToggle.dataset.phaseId,
          stepId: stepToggle.dataset.stepId,
          status: stepToggle.checked ? "complete" : "pending",
        });
      }
    });

    document.addEventListener("dragstart", (event) => {
      const handle = event.target.closest(".drag-handle[draggable='true']");
      const card = handle?.closest(".phase-card[data-phase-id]");
      if (!card) {
        event.preventDefault();
        return;
      }

      card.classList.add("dragging");
      event.dataTransfer.setData("text/plain", card.dataset.phaseId || "");
      event.dataTransfer.setData("application/x-drylake-phase-status", card.dataset.phaseStatus || "");
      event.dataTransfer.effectAllowed = "move";
    });

    document.addEventListener("dragend", (event) => {
      event.target.closest(".phase-card")?.classList.remove("dragging");
      event.target.closest(".drag-handle")?.closest(".phase-card")?.classList.remove("dragging");
      clearDropIndicators();
    });

    document.addEventListener("dragover", (event) => {
      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.classList.contains("dragging")) {
        event.preventDefault();
        clearDropIndicators();
        const orientation = card.closest(".pipeline") ? "horizontal" : "vertical";
        card.classList.add(insertionSide(card, event, orientation) === "before" ? "drop-before" : "drop-after");
        return;
      }

      const column = event.target.closest("[data-drop-status]");
      if (!column) {
        return;
      }

      event.preventDefault();
      clearDropIndicators();
      column.classList.add("drag-over");
    });

    document.addEventListener("dragleave", (event) => {
      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.contains(event.relatedTarget)) {
        card.classList.remove("drop-before", "drop-after");
      }

      const column = event.target.closest("[data-drop-status]");
      if (column && !column.contains(event.relatedTarget)) {
        column.classList.remove("drag-over");
      }
    });

    document.addEventListener("drop", (event) => {
      const phaseId = event.dataTransfer.getData("text/plain");
      if (!phaseId) {
        return;
      }

      const card = event.target.closest(".phase-card[data-phase-id]");
      if (card && !card.classList.contains("dragging")) {
        event.preventDefault();
        const pipeline = card.closest(".pipeline");
        const column = card.closest("[data-drop-status]");
        const draggedStatus = event.dataTransfer.getData("application/x-drylake-phase-status");

        if (pipeline || (column && draggedStatus === column.dataset.dropStatus)) {
          const orientation = pipeline ? "horizontal" : "vertical";
          vscode.postMessage({ command: "drylake.reorderPhase", phaseId, afterPhaseId: afterPhaseIdForCardDrop(card, event, orientation) });
          clearDropIndicators();
          return;
        }

        if (column) {
          vscode.postMessage({ command: "drylake.updatePhaseStatus", phaseId, status: column.dataset.dropStatus });
          clearDropIndicators();
          return;
        }
      }

      const column = event.target.closest("[data-drop-status]");
      if (!column) {
        return;
      }

      event.preventDefault();
      clearDropIndicators();

      vscode.postMessage({ command: "drylake.updatePhaseStatus", phaseId, status: column.dataset.dropStatus });
    });
  </script>
</body>
</html>`;
  }
}
