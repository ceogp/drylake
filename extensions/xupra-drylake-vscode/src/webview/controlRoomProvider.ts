import * as vscode from "vscode";

import {
  phaseAgentHandoffOptions,
  phaseAgentHint,
  phaseAgentLabel,
} from "../agents/phaseAgentLauncher";
import { renderPhasePrompt } from "../generators/renderPhasePrompt";
import { describePhaseChange, isPendingPhaseUnresolved } from "../xu/pendingPlanChanges";
import { XuSessionStore } from "../xu/sessionStore";
import { XU_PHASE_AGENTS } from "../xu/types";
import { estimateTokens, formatEstimatedTokens } from "../utils/tokenEstimate";
import type { ChatState, PlanningModelTier, PlanningProviderInfo } from "../services/stateStore";
import type { DryLakeProviderId } from "../ai/DryLakeAiProvider";
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuStepStatus } from "../xu/types";
import type { PendingPlanChangeSet } from "../xu/pendingPlanChanges";
const CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
const CONTROL_ROOM_CHAT_COLLAPSED_KEY = "drylake.controlRoomChatCollapsed";
type ControlRoomView = "pipeline" | "kanban";

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

function renderTokenMeter(label: string, content: string) {
  return `<div class="token-meter" title="Approximate prompt token estimate."><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatEstimatedTokens(estimateTokens(content)))}</strong></div>`;
}

function renderPhaseCard(
  phase: XuPhase,
  options: { draggable: boolean; runbook: ApplicationBuildRunbook; pendingPlanChange: PendingPlanChangeSet | null },
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
  const tokenMeter = renderTokenMeter("Prompt", renderPhasePrompt(options.runbook, phase));
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
    ${tokenMeter}
    ${renderAgentSelect(phase)}
    ${renderPhaseSteps(phase)}
    <div class="phase-actions">
      <button type="button" class="primary handoff-btn" data-handoff-phase="${escapeHtml(phase.id)}" data-handoff-action="run" title="${escapeHtml(primaryTitle)}"${disabled}>${escapeHtml(primaryLabel)}</button>
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

function renderPipeline(runbook: ApplicationBuildRunbook, pendingPlanChange: PendingPlanChangeSet | null) {
  return `<section class="pipeline" aria-label="Build Session pipeline">
    ${runbook.phases.map((phase, index) => {
      const card = renderPhaseCard(phase, { draggable: true, runbook, pendingPlanChange });
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
) {
  return `<section class="kanban-column" data-drop-status="${status}">
    <div class="column-header"><span>${escapeHtml(title)}</span><span class="count">${phases.length}</span></div>
    <div class="column-body">
      ${phases.map((phase) => renderPhaseCard(phase, { draggable: true, runbook, pendingPlanChange })).join("")}
      <div class="drop-zone">Drop phase here</div>
    </div>
  </section>`;
}

function renderKanban(runbook: ApplicationBuildRunbook, pendingPlanChange: PendingPlanChangeSet | null) {
  const pending = runbook.phases.filter((phase) => statusForKanban(phase.status) === "pending");
  const active = runbook.phases.filter((phase) => statusForKanban(phase.status) === "active");
  const complete = runbook.phases.filter((phase) => statusForKanban(phase.status) === "complete");

  return `<section class="kanban" aria-label="Build Session kanban">
    ${renderKanbanColumn("To Do", "pending", pending, runbook, pendingPlanChange)}
    ${renderKanbanColumn("In Progress", "active", active, runbook, pendingPlanChange)}
    ${renderKanbanColumn("Done", "complete", complete, runbook, pendingPlanChange)}
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

function renderChatPanel(
  state: ChatState,
  planningProvider: PlanningProviderInfo | null,
  hasPlan: boolean,
  collapsed: boolean,
) {
  const activeProviderId = planningProvider?.id ?? "xupra-pro-ai";
  const activeProviderLabel = planningProvider?.label ?? "Planning AI";
  const modeChips = MODE_CARDS.map(([title, mode], index) => {
    return `<button type="button" class="mode-chip${index === 0 ? " active" : ""}" data-mode="${mode}" aria-pressed="${index === 0 ? "true" : "false"}">${escapeHtml(title)}</button>`;
  }).join("");
  const providerOptions = PLANNING_PROVIDERS.map(([id, label, description]) => {
    const selected = id === activeProviderId ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)} - ${escapeHtml(description)}</option>`;
  }).join("");
  const providerLocked = hasPlan ? " disabled" : "";
  const providerTitle = hasPlan
    ? "This plan keeps the planning provider selected when the session started."
    : "Choose the planning provider before sending the first message.";
  const providerSelector = `<label class="planning-provider-label" title="${escapeHtml(providerTitle)}">
    <span>Planning Agent</span>
    <select id="planningProviderSelect" class="planning-provider-select"${providerLocked} aria-label="Planning provider">
      ${providerOptions}
    </select>
  </label>`;
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

  return `<section class="chat-panel${collapsed ? " collapsed" : ""}" aria-label="Planning chat" data-has-plan="${hasPlan ? "true" : "false"}">
    <div class="chat-header">
      <span class="chat-eyebrow">Planning Chat</span>
      <div class="chat-controls">
        <button type="button" class="chat-clear secondary" data-command="drylake.clearChat">Clear</button>
        <button type="button" class="collapse-btn secondary" data-command="drylake.toggleChatCollapsed">${collapsed ? "Expand" : "Collapse"}</button>
      </div>
    </div>
    ${collapsed ? "" : `<div class="chat-messages" id="chatMessages">${messages}</div>
      <div class="mode-row">${modeChips}</div>
      ${providerSelector}
      <form class="chat-form" id="chatForm">
        <textarea id="chatInput" rows="2" placeholder="${hasPlan ? "Tell the planning AI what to refine." : "e.g. Build a Stripe checkout flow with webhook handling"}"></textarea>
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
    try {
      runbook = (await this.sessionStore.readRunbook())?.runbook ?? null;
      pendingPlanChange = await this.sessionStore.readPendingPlanChange?.() ?? null;
    } catch {
      runbook = null;
      pendingPlanChange = null;
    }

    this.panel.webview.html = this.renderHtml(runbook, pendingPlanChange);
  }

  private currentView(): ControlRoomView {
    return controlRoomViewFrom(this.context?.workspaceState?.get(CONTROL_ROOM_VIEW_KEY));
  }

  private chatCollapsed(): boolean {
    return Boolean(this.context?.workspaceState?.get(CONTROL_ROOM_CHAT_COLLAPSED_KEY));
  }

  private renderHtml(runbook: ApplicationBuildRunbook | null, pendingPlanChange: PendingPlanChangeSet | null) {
    const view = this.currentView();
    const planningProvider = this.readPlanningProvider();
    const chatState = this.readChatState();
    const banner = renderPlanningModelBanner(this.readLastModelTier());
    const chatPanel = renderChatPanel(chatState, planningProvider, Boolean(runbook), this.chatCollapsed());
    const body = this.readPlanningLoading()
      ? renderKanbanLoadingState()
      : runbook ? (view === "kanban" ? renderKanban(runbook, pendingPlanChange) : renderPipeline(runbook, pendingPlanChange)) : renderKanbanEmptyState();
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
    .phase-card { min-width: 190px; max-width: 220px; flex: 0 0 210px; border: 1px solid var(--drylake-line); border-radius: 8px; padding: 12px; background: var(--drylake-panel); box-shadow: none; }
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
    .objective { min-height: 32px; margin-bottom: 8px; font-size: 11px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .token-meter { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; padding: 4px 6px; border: 1px solid var(--drylake-line); border-radius: 4px; background: var(--drylake-bg); color: var(--drylake-muted); font-size: 10px; font-weight: 800; }
    .token-meter strong { color: #a7f3d0; font-weight: 900; white-space: nowrap; }
    .agent-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .agent-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--drylake-text); background: var(--drylake-bg); border: 1px solid #3f3f46; border-radius: 4px; font-size: 11px; }
    .step-count { margin-top: 8px; font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--drylake-line); color: var(--drylake-text); background: var(--drylake-panel-2); text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border: 1px solid var(--drylake-line); border-radius: 4px; color: var(--drylake-green); background: var(--drylake-bg); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; margin-bottom: 8px; }
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
    .step-list-wrap { margin-top: 8px; }
    .step-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
    .step-item label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 12px; line-height: 1.4; color: var(--drylake-text); }
    .step-item input[type="checkbox"] { margin-top: 2px; accent-color: var(--drylake-green); }
    .step-item.done span { text-decoration: line-through; color: #71717a; }
    .phase-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .handoff-btn { width: 100%; font-size: 12px; padding: 6px 10px; }
    .handoff-menu { position: relative; }
    .handoff-menu summary { list-style: none; width: 100%; padding: 5px 8px; border: 1px solid #3f3f46; border-radius: 4px; color: var(--drylake-text); background: var(--drylake-bg); font-size: 11px; font-weight: 800; text-align: center; cursor: pointer; box-shadow: none; }
    .handoff-menu summary::-webkit-details-marker { display: none; }
    .handoff-menu summary::after { content: " ▾"; }
    .handoff-menu[open] summary::after { content: " ▴"; }
    .handoff-menu-items { display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 6px; padding: 6px; border: 1px solid var(--drylake-line); border-radius: 6px; background: var(--drylake-panel-2); }
    .handoff-menu-item { padding: 5px 7px; font-size: 10px; box-shadow: none; background: var(--drylake-bg); color: var(--drylake-text); border-color: #3f3f46; }
    .plan-change-overlay { margin-top: 10px; padding: 9px; border: 1px solid rgba(251, 146, 60, 0.55); border-radius: 5px; background: var(--drylake-orange-soft); }
    .plan-change-eyebrow { text-transform: uppercase; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; }
    .plan-change-overlay p { margin: 5px 0 8px; color: var(--drylake-text); font-size: 11px; line-height: 1.35; }
    .plan-change-actions { display: grid; grid-template-columns: 1fr; gap: 5px; }
    .plan-change-actions button { padding: 5px 7px; font-size: 10px; box-shadow: none; }
    .chat-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; margin: 0 0 18px; border: 1px solid var(--drylake-line); border-radius: 8px; background: var(--drylake-panel); }
    .chat-panel.collapsed { padding: 8px 14px; }
    .chat-header { display: flex; align-items: center; justify-content: space-between; }
    .chat-controls { display: flex; gap: 6px; }
    .chat-clear, .collapse-btn { padding: 4px 8px; font-size: 11px; box-shadow: none; }
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
    @media (max-width: 860px) { header, .nano-banner { align-items: flex-start; flex-direction: column; } .kanban { grid-template-columns: 1fr; } }
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
        <button class="secondary" data-command="drylake.newSession">New Session</button>
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
