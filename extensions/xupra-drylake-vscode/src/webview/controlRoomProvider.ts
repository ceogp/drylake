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
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuStepStatus } from "../xu/types";
import type { PendingPlanChangeSet } from "../xu/pendingPlanChanges";
const CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
const CONTROL_ROOM_CHAT_COLLAPSED_KEY = "drylake.controlRoomChatCollapsed";
type ControlRoomView = "pipeline" | "kanban";
type HandoffProfilesByAgent = Partial<Record<(typeof XU_PHASE_AGENTS)[number], HandoffProfileSelection[]>>;

const MODE_CARDS: Array<[string, XuMode, string]> = [
  ["Build", "build-app", "Turn an app idea into purpose, architecture, steps, and a ship plan."],
  ["Break Into Steps", "phases", "Clarify intent, then split the task into safe coding steps."],
  ["Plan", "plan", "Generate a file-aware plan for a complex repo change."],
  ["Review", "review", "Review existing code and produce a correction plan."],
];

const PLANNING_PROVIDERS: Array<[DryLakeProviderId, string, string]> = [
  ["xupra-pro-ai", "Xupra AI", "Hosted planning"],
  ["databricks-api", "Databricks API", "BYO endpoint"],
  ["claude-api", "Claude API", "BYO Anthropic key"],
  ["openai-api", "OpenAI API", "BYO OpenAI key"],
  ["hermes-agent", "Hermes Agent CLI", "Local/BYO model"],
];

const STATUS_LABELS: Record<XuStepStatus, string> = {
  pending: "pending",
  active: "active",
  approved: "approved",
  "needs-revision": "needs revision",
  complete: "complete",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function controlRoomViewFrom(value: unknown): ControlRoomView {
  return value === "kanban" ? "kanban" : "pipeline";
}

function modeFrom(value: unknown): XuMode {
  return typeof value === "string" && MODE_CARDS.some(([, mode]) => mode === value)
    ? (value as XuMode)
    : "build-app";
}

function planningProviderFrom(value: unknown): DryLakeProviderId {
  return typeof value === "string" && PLANNING_PROVIDERS.some(([id]) => id === value)
    ? (value as DryLakeProviderId)
    : "xupra-pro-ai";
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
  const firstStep = phase.steps.find((step) => step.text.trim().length > 0)?.text;
  const firstAcceptance = phase.acceptance.find((item) => item.trim().length > 0);

  if (!firstStep && !firstAcceptance) {
    return "";
  }

  return `<div class="task-fit-preview" aria-label="Generated task-specific card preview">
    <div class="task-fit-label">Generated for this task</div>
    ${firstStep ? `<div class="task-fit-row"><span>Next</span><p title="${escapeHtml(firstStep)}">${escapeHtml(firstStep)}</p></div>` : ""}
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
  const draggable = options.draggable ? ' draggable="true"' : "";
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

  return `<article class="${cardClass}" data-phase-id="${escapeHtml(phase.id)}" data-phase-status="${statusForKanban(phase.status)}"${draggable}>
    <div class="phase-id">${escapeHtml(phase.id)}</div>
    <h3 class="phase-title">${escapeHtml(phase.title)}</h3>
    <span class="badge ${statusClass(phase.status)}">${escapeHtml(STATUS_LABELS[phase.status])}</span>
    <p class="objective" title="${escapeHtml(phase.objective)}">${escapeHtml(phase.objective || "No objective recorded.")}</p>
    ${renderPhaseTaskFit(phase)}
    ${renderAgentSelect(phase)}
    ${renderHandoffProfileSelect(phase, options.profilesByAgent)}
    ${renderPhaseSteps(phase)}
    <div class="phase-actions">
      <button type="button" class="primary handoff-btn" data-handoff-phase="${escapeHtml(phase.id)}" data-handoff-action="run" title="${escapeHtml(primaryTitle)}"${disabled}>${escapeHtml(primaryLabel)}</button>
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
  const label = enabled ? "Autopilot mode" : "Require Approval Between Phases";
  const title = enabled
    ? "DryLake starts the next phase automatically after the current phase is marked complete."
    : "DryLake pauses after each phase so you can approve before starting the next phase.";

  return `<button class="toggle-btn execution-toggle${enabled ? " active" : ""}" data-command="drylake.toggleAutopilot" title="${escapeHtml(title)}" aria-pressed="${enabled ? "true" : "false"}">${escapeHtml(label)}</button>`;
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
    <p>Describe your task in the chat above — the AI will generate phases here.</p>
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

function renderPlanningModelBanner(modelTier: PlanningModelTier | null) {
  if (modelTier === "nano") {
    return `<section class="nano-banner" aria-label="Free planning model">
      <span class="nano-banner-text">⚡ You are using <strong>gpt-5.4-nano</strong>. Upgrade to use Xupra AI foundation models (GPT 5.5 + Claude Opus 4.6).</span>
      <button type="button" class="nano-banner-cta" data-command="xupra.openBilling">Upgrade to Pro →</button>
    </section>`;
  }

  return "";
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
  status?: unknown;
  text?: unknown;
  mode?: unknown;
  planningProvider?: unknown;
};

type PlanningProviderReader = () => PlanningProviderInfo | null;
type ChatStateReader = () => ChatState;
type LastModelTierReader = () => PlanningModelTier | null;
type PlanningLoadingReader = () => boolean;

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

function planningProviderLabel(
  id: DryLakeProviderId,
  label: string,
  description: string,
  modelTier: PlanningModelTier | null,
) {
  if (id !== "xupra-pro-ai") {
    return `${label} - ${description}`;
  }

  if (modelTier === "nano") {
    return "GPT-5.4 Nano - Free card planning";
  }

  return "Xupra AI - Foundation planning";
}

function renderPlannerSetup(
  planningProvider: PlanningProviderInfo | null,
  hasPlan: boolean,
  modelTier: PlanningModelTier | null,
) {
  const activeProviderId = planningProvider?.id ?? "xupra-pro-ai";
  const providerOptions = PLANNING_PROVIDERS.map(([id, label, description]) => {
    const selected = id === activeProviderId ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(planningProviderLabel(id, label, description, modelTier))}</option>`;
  }).join("");
  const providerLocked = hasPlan ? " disabled" : "";
  const providerTitle = hasPlan
    ? "This plan keeps the AI provider selected when the session started."
    : "Choose what powers card generation before sending the first message.";
  const providerStatus = hasPlan
    ? "Locked for this plan"
    : modelTier === "nano"
      ? "Free users use GPT-5.4 Nano, or they can bring their own API key."
      : "Choose the provider that will generate the first cards.";
  const modeChips = hasPlan
    ? ""
    : `<div class="mode-row" aria-label="Plan type">${MODE_CARDS.map(([title, mode], index) => {
        return `<button type="button" class="mode-chip${index === 0 ? " active" : ""}" data-mode="${mode}" aria-pressed="${index === 0 ? "true" : "false"}">${escapeHtml(title)}</button>`;
      }).join("")}</div>`;

  return `<section class="planner-setup" aria-label="Card generation setup">
    <div class="planner-setup-header">
      <div>
        <div class="planner-setup-eyebrow">Card Generation</div>
        <div class="planner-setup-title">Choose the AI provider before chat starts.</div>
      </div>
      <div class="planner-setup-status">${escapeHtml(providerStatus)}</div>
    </div>
    ${modeChips}
    <label class="planning-provider-label" title="${escapeHtml(providerTitle)}">
      <span>AI Provider</span>
      <select id="planningProviderSelect" class="planning-provider-select"${providerLocked} aria-label="AI provider">
        ${providerOptions}
      </select>
    </label>
  </section>`;
}

function renderChatPanel(
  state: ChatState,
  planningProvider: PlanningProviderInfo | null,
  hasPlan: boolean,
  collapsed: boolean,
  modelTier: PlanningModelTier | null,
) {
  const cardContext = estimateCardGenerationContext(state, hasPlan);
  const activeProviderLabel = modelTier === "nano" && planningProvider?.id === "xupra-pro-ai"
    ? "GPT-5.4 Nano"
    : planningProvider?.label ?? "Planning AI";
  const plannerSetup = renderPlannerSetup(planningProvider, hasPlan, modelTier);
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
  <section class="chat-panel${collapsed ? " collapsed" : ""}" aria-label="Build plan chat" data-has-plan="${hasPlan ? "true" : "false"}">
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
        <textarea id="chatInput" rows="2" placeholder="${hasPlan ? "Ask DryLake to update these cards..." : "Describe what you want to build..."}"></textarea>
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

  constructor(
    private readonly sessionStore: XuSessionStore,
    private readonly readPlanningProvider: PlanningProviderReader = () => null,
    private readonly readChatState: ChatStateReader = () => ({ messages: [] }),
    private readonly readLastModelTier: LastModelTierReader = () => null,
    private readonly readPlanningLoading: PlanningLoadingReader = () => false,
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
      "DryLake Control Room",
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
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.handoffAction ?? message.args?.[1]);
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

      if (message.command === "drylake.startBuildSession") {
        await vscode.commands.executeCommand(
          message.command,
          modeFrom(message.mode ?? message.args?.[0]),
          message.text ?? message.args?.[1],
          planningProviderFrom(message.planningProvider ?? message.args?.[2]),
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
    const banner = renderPlanningModelBanner(modelTier);
    const chatPanel = renderChatPanel(chatState, planningProvider, Boolean(runbook), this.chatCollapsed(), modelTier);
    const body = this.readPlanningLoading()
      ? renderKanbanLoadingState()
      : runbook
        ? (view === "kanban"
          ? renderKanban(runbook, pendingPlanChange, profilesByAgent)
          : renderPipeline(runbook, pendingPlanChange, profilesByAgent))
        : renderKanbanEmptyState();
    const executionToggle = renderExecutionModeToggle(runbook);
    const runNextButton = runbook?.phases.length ? '<button class="secondary" data-command="drylake.runNextPhase">Run Next Phase</button>' : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    :root { --drylake-bg: #090a0a; --drylake-panel: #111414; --drylake-panel-2: #0d0f0f; --drylake-line: #27272a; --drylake-muted: #a1a1aa; --drylake-text: #f4f4f5; --drylake-green: #34d399; --drylake-green-soft: #17251d; --drylake-orange: #fb923c; --drylake-orange-soft: #2a1710; --drylake-red: #f87171; --drylake-paper: #090a0a; --drylake-ink: #f4f4f5; --drylake-yellow: #34d399; --drylake-blue: #fb923c; --drylake-pink: #fb923c; --drylake-white: #111414; }
    body { margin: 0; color: var(--drylake-text); background: var(--drylake-bg); font-family: var(--vscode-font-family); }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 14px; padding: 12px 16px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    h1 { margin: 0; color: var(--drylake-text); font-size: 24px; font-weight: 700; }
    h2 { margin: 8px 0; color: var(--drylake-text); font-size: 20px; }
    h3, p { margin: 0; }
    button, select, textarea { font: inherit; }
    button { color: #090a0a; background: var(--drylake-green); border: 1px solid var(--drylake-green); border-radius: 4px; padding: 7px 11px; cursor: pointer; font-weight: 800; box-shadow: none; }
    button:hover { background: #6ee7b7; border-color: #6ee7b7; }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    button.secondary, .toggle-btn { color: var(--drylake-text); background: var(--drylake-bg); border-color: #3f3f46; }
    button.secondary:hover, .toggle-btn:hover { border-color: var(--drylake-orange); color: #fed7aa; background: var(--drylake-bg); }
    .eyebrow, .planning-banner-eyebrow, .chat-eyebrow, .phase-id { color: var(--drylake-green); text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; }
    .muted, .objective, .agent-label, .step-count, .drop-zone, .planning-banner-reason, .chat-empty, .chat-meta { color: var(--drylake-muted); line-height: 1.45; }
    .actions, .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggle-btn.active { color: #090a0a; background: var(--drylake-green); border-color: var(--drylake-green); }
    .pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 10px; }
    .arrow { display: flex; align-items: center; padding: 0 8px; color: var(--drylake-orange); font-size: 22px; font-weight: 900; flex: 0 0 auto; }
    .phase-card { min-width: 210px; max-width: 220px; flex: 0 0 210px; min-height: 360px; display: flex; flex-direction: column; border: 1px solid var(--drylake-line); border-radius: 8px; padding: 12px; background: var(--drylake-panel); box-shadow: none; overflow: hidden; }
    .phase-card.active, .phase-card.active-phase { border-color: var(--drylake-orange); background: var(--drylake-orange-soft); }
    .phase-card.approved, .phase-card.complete { border-color: rgba(52, 211, 153, 0.65); }
    .phase-card.complete { opacity: 0.82; }
    .phase-card[draggable="true"] { cursor: grab; }
    .phase-card.dragging { opacity: 0.5; border-style: dashed; }
    .pipeline .phase-card.drop-before { border-left: 4px solid var(--drylake-orange); }
    .pipeline .phase-card.drop-after { border-right: 4px solid var(--drylake-orange); }
    .kanban .phase-card.drop-before { border-top: 4px solid var(--drylake-orange); }
    .kanban .phase-card.drop-after { border-bottom: 4px solid var(--drylake-orange); }
    .phase-title { margin: 5px 0 8px; color: var(--drylake-text); font-size: 13px; line-height: 1.25; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border: 1px solid var(--drylake-line); border-radius: 4px; color: var(--drylake-muted); background: var(--drylake-bg); font-size: 10px; font-weight: 800; }
    .badge.active { border-color: rgba(251, 146, 60, 0.6); background: var(--drylake-orange-soft); color: #fed7aa; }
    .badge.approved, .badge.complete { border-color: rgba(52, 211, 153, 0.55); background: var(--drylake-green-soft); color: #a7f3d0; }
    .objective { height: 34px; min-height: 34px; margin-bottom: 8px; font-size: 11px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .task-fit-preview { display: grid; gap: 5px; margin: 0 0 8px; padding: 7px; border: 1px solid rgba(52, 211, 153, 0.28); border-radius: 5px; background: rgba(52, 211, 153, 0.06); }
    .task-fit-label { color: #a7f3d0; font-size: 9px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
    .task-fit-row { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 6px; align-items: start; }
    .task-fit-row span { color: var(--drylake-green); font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
    .task-fit-row p { color: var(--drylake-text); font-size: 11px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .agent-label, .profile-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .profile-label { margin-top: 6px; }
    .agent-select, .profile-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 11px; }
    .profile-select:disabled { opacity: 0.68; cursor: not-allowed; }
    .step-count { margin-top: 8px; font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--drylake-line); color: var(--drylake-text); background: var(--drylake-panel-2); text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border: 1px solid var(--drylake-line); border-radius: 4px; color: var(--drylake-green); background: var(--drylake-bg); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; min-height: 360px; margin-bottom: 8px; }
    .drop-zone { padding: 10px; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center; font-size: 11px; }
    .kanban-column.drag-over .drop-zone { border-color: var(--drylake-orange); color: #fed7aa; }
    .empty-state, .loading-state { border: 1px solid var(--drylake-line); border-radius: 8px; padding: 18px; background: var(--drylake-panel); box-shadow: none; }
    .loading-state { border-style: dashed; }
    .loading-title { margin-bottom: 12px; color: var(--drylake-green); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; }
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
    .planner-setup-eyebrow { color: var(--drylake-green); font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
    .planner-setup-title { margin-top: 2px; color: var(--drylake-text); font-size: 12px; font-weight: 800; }
    .planner-setup-status { max-width: 380px; color: var(--drylake-muted); font-size: 11px; line-height: 1.35; text-align: right; }
    .mode-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .mode-chip { padding: 4px 8px; border: 1px solid #3f3f46; border-radius: 999px; color: var(--drylake-text); background: var(--drylake-bg); font-size: 10px; box-shadow: none; }
    .mode-chip.active { border-color: var(--drylake-green); background: var(--drylake-green-soft); color: #a7f3d0; }
    .planning-provider-label { display: grid; grid-template-columns: minmax(0, 120px) minmax(0, 1fr); align-items: center; gap: 8px; color: var(--drylake-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .planning-provider-select { width: 100%; min-width: 0; padding: 6px 8px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 12px; text-transform: none; letter-spacing: 0; }
    .planning-provider-select:disabled { opacity: 0.72; cursor: not-allowed; }
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
    .handoff-menu { position: relative; }
    .handoff-menu summary { list-style: none; width: 100%; padding: 5px 8px; border: 1px solid #3f3f46; border-radius: 4px; color: var(--drylake-text); background: var(--drylake-bg); font-size: 11px; font-weight: 800; text-align: center; cursor: pointer; box-shadow: none; }
    .handoff-menu summary::-webkit-details-marker { display: none; }
    .handoff-menu summary::after { content: " ▾"; }
    .handoff-menu[open] summary::after { content: " ▴"; }
    .handoff-menu-items { display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 6px; padding: 6px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .handoff-menu-item { padding: 5px 7px; font-size: 10px; box-shadow: none; background: var(--drylake-bg); color: var(--drylake-text); border-color: #3f3f46; }
    .plan-change-overlay { margin-top: 10px; padding: 9px; border: 1px solid rgba(251, 146, 60, 0.55); border-radius: 5px; background: var(--drylake-orange-soft); flex: 0 0 auto; }
    .plan-change-eyebrow { text-transform: uppercase; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; }
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
    .context-meter-label { color: var(--drylake-text); font-size: 12px; font-weight: 900; }
    .context-meter-status { color: var(--drylake-green); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; }
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
    @media (max-width: 860px) { header, .nano-banner, .planner-setup-header { align-items: flex-start; flex-direction: column; } .planner-setup-status { max-width: none; text-align: left; } .kanban { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">DryLake Control Room</div>
        <h1>DryLake Control Room</h1>
      </div>
      <div class="actions">
        <div class="toggle-group" role="group" aria-label="Control Room view">
          <button class="toggle-btn${view === "pipeline" ? " active" : ""}" data-view="pipeline">Pipeline</button>
          <button class="toggle-btn${view === "kanban" ? " active" : ""}" data-view="kanban">Kanban</button>
        </div>
        <button class="secondary" data-command="drylake.openSessions">Sessions</button>
        <button class="secondary" data-command="drylake.newSession">New Plan</button>
        ${executionToggle}
        ${runNextButton}
      </div>
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
    let selectedProvider = planningProviderSelect?.value || "xupra-pro-ai";
    function sendChat() {
      if (!chatInput) {
        return;
      }
      const text = chatInput.value.trim();
      if (!text) {
        return;
      }
      const hasPlan = document.querySelector(".chat-panel")?.dataset.hasPlan === "true";
      vscode.postMessage({
        command: hasPlan ? "drylake.chatSendMessage" : "drylake.startBuildSession",
        text: text,
        mode: selectedMode,
        planningProvider: selectedProvider
      });
      chatInput.value = "";
    }
    chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChat();
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

      const commandEl = event.target.closest("[data-command]");
      if (commandEl) {
        vscode.postMessage({ command: commandEl.dataset.command, args: [] });
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

      const handoffBtn = event.target.closest("[data-handoff-phase]");
      if (handoffBtn) {
        vscode.postMessage({
          command: "drylake.handoffPhase",
          phaseId: handoffBtn.dataset.handoffPhase,
          handoffAction: handoffBtn.dataset.handoffAction || "run"
        });
      }
    });

    document.addEventListener("change", (event) => {
      const providerSelect = event.target.closest("#planningProviderSelect");
      if (providerSelect) {
        selectedProvider = providerSelect.value || "xupra-pro-ai";
        document.getElementById("chatInput")?.focus();
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
      const card = event.target.closest(".phase-card[draggable='true']");
      if (!card) {
        return;
      }

      card.classList.add("dragging");
      event.dataTransfer.setData("text/plain", card.dataset.phaseId || "");
      event.dataTransfer.setData("application/x-drylake-phase-status", card.dataset.phaseStatus || "");
      event.dataTransfer.effectAllowed = "move";
    });

    document.addEventListener("dragend", (event) => {
      event.target.closest(".phase-card")?.classList.remove("dragging");
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
