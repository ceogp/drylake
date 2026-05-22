import * as vscode from "vscode";

import {
  phaseAgentConnectionDescription,
  phaseAgentConnectionLabel,
  phaseAgentConnectionTone,
  phaseAgentHandoffOptions,
  phaseAgentHint,
  phaseAgentLabel,
} from "../agents/phaseAgentLauncher";
import { XuSessionStore } from "../xu/sessionStore";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { ChatState, PlanningProviderInfo } from "../services/stateStore";
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuStepStatus } from "../xu/types";

const CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
type ControlRoomView = "pipeline" | "kanban";

const MODE_CARDS: Array<[string, XuMode, string]> = [
  ["Build App", "build-app", "Turn an app idea into purpose, architecture, steps, and a ship plan."],
  ["Break Into Steps", "phases", "Clarify intent, then split the task into safe coding steps."],
  ["Create Plan", "plan", "Generate a file-aware plan for a complex repo change."],
  ["Review / Repair", "review", "Review existing code and produce a correction plan."],
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

function renderPhaseCard(phase: XuPhase, options: { draggable: boolean }) {
  const draggable = options.draggable ? ' draggable="true"' : "";
  const cardClass = `phase-card ${statusClass(phase.status)}${phase.status === "active" ? " active-phase" : ""}`;
  const selectedAgent = phase.agent;
  const actionHint = selectedAgent ? phaseAgentHint(selectedAgent) : "Select a phase agent before running this phase.";
  const actionOptions = selectedAgent
    ? phaseAgentHandoffOptions(selectedAgent).map((option) => (
      `<option value="${escapeHtml(option.action)}" title="${escapeHtml(option.title)}">${escapeHtml(option.label)}</option>`
    )).join("")
    : `<option value="run">Select agent</option>`;
  const actionDisabled = selectedAgent ? "" : " disabled";

  return `<article class="${cardClass}" data-phase-id="${escapeHtml(phase.id)}" data-phase-status="${statusForKanban(phase.status)}"${draggable}>
    <div class="phase-id">${escapeHtml(phase.id)}</div>
    <h3 class="phase-title">${escapeHtml(phase.title)}</h3>
    <span class="badge ${statusClass(phase.status)}">${escapeHtml(STATUS_LABELS[phase.status])}</span>
    <p class="objective" title="${escapeHtml(phase.objective)}">${escapeHtml(phase.objective || "No objective recorded.")}</p>
    ${renderAgentSelect(phase)}
    ${renderPhaseSteps(phase)}
    <div class="phase-actions">
      <select class="handoff-action-select" data-handoff-action-for="${escapeHtml(phase.id)}" aria-label="Handoff action for ${escapeHtml(phase.title)}" title="${escapeHtml(actionHint)}"${actionDisabled}>${actionOptions}</select>
      <button class="primary handoff-btn" data-handoff-phase="${escapeHtml(phase.id)}" title="${escapeHtml(actionHint)}"${actionDisabled}>Handoff</button>
    </div>
  </article>`;
}

function renderExecutionModeToggle(runbook: ApplicationBuildRunbook | null) {
  if (!runbook) {
    return "";
  }

  const enabled = autopilotEnabled(runbook);
  const label = enabled ? "Autopilot mode" : "Require Approval Between Phases";
  const title = enabled
    ? "DryLake starts the next phase automatically after the current phase is marked complete."
    : "DryLake pauses after each phase so you can approve before starting the next phase.";

  return `<button class="toggle-btn execution-toggle${enabled ? " active" : ""}" data-command="drylake.toggleAutopilot" title="${escapeHtml(title)}" aria-pressed="${enabled ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function renderHandoffCapabilityPanel(runbook: ApplicationBuildRunbook | null) {
  if (!runbook) {
    return "";
  }

  const cards = XU_PHASE_AGENTS.map((agent) => {
    const tone = phaseAgentConnectionTone(agent);
    const assignedCount = runbook.phases.filter((phase) => phase.agent === agent).length;
    const assigned = assignedCount > 0 ? `<span class="agent-count">${assignedCount}</span>` : "";

    return `<div class="agent-capability ${tone}" title="${escapeHtml(phaseAgentConnectionDescription(agent))}">
      <div class="agent-capability-top"><strong>${escapeHtml(phaseAgentLabel(agent))}</strong>${assigned}</div>
      <span>${escapeHtml(phaseAgentConnectionLabel(agent))}</span>
    </div>`;
  }).join("");

  return `<section class="handoff-panel" aria-label="Agent handoff capability">
    <div class="handoff-panel-header">
      <span class="handoff-eyebrow">Agent Handoff</span>
      <span class="handoff-note">Choose direct run, .sh/.bat, Copy, Markdown, or VS Code per phase.</span>
    </div>
    <div class="agent-capability-grid">${cards}</div>
  </section>`;
}

function renderPipeline(runbook: ApplicationBuildRunbook) {
  return `<section class="pipeline" aria-label="Build Session pipeline">
    ${runbook.phases.map((phase, index) => {
      const card = renderPhaseCard(phase, { draggable: true });
      return index < runbook.phases.length - 1 ? `${card}<div class="arrow" aria-hidden="true">&rarr;</div>` : card;
    }).join("")}
  </section>`;
}

function renderKanbanColumn(title: string, status: "pending" | "active" | "complete", phases: XuPhase[]) {
  return `<section class="kanban-column" data-drop-status="${status}">
    <div class="column-header"><span>${escapeHtml(title)}</span><span class="count">${phases.length}</span></div>
    <div class="column-body">
      ${phases.map((phase) => renderPhaseCard(phase, { draggable: true })).join("")}
      <div class="drop-zone">Drop phase here</div>
    </div>
  </section>`;
}

function renderKanban(runbook: ApplicationBuildRunbook) {
  const pending = runbook.phases.filter((phase) => statusForKanban(phase.status) === "pending");
  const active = runbook.phases.filter((phase) => statusForKanban(phase.status) === "active");
  const complete = runbook.phases.filter((phase) => statusForKanban(phase.status) === "complete");

  return `<section class="kanban" aria-label="Build Session kanban">
    ${renderKanbanColumn("To Do", "pending", pending)}
    ${renderKanbanColumn("In Progress", "active", active)}
    ${renderKanbanColumn("Done", "complete", complete)}
  </section>`;
}

function renderEmptyState() {
  return `<section class="empty-state">
    <div class="eyebrow">Build Session</div>
    <h2>Start with a ticket, bug, or feature request.</h2>
    <p>DryLake will turn the task into a clear coding plan you can review and run with your AI tool.</p>
    <div class="prompt-panel">
      <div class="mode-grid">
        ${MODE_CARDS.map(([title, mode, description], index) => `<button class="mode-card${index === 0 ? " selected" : ""}" data-mode="${mode}"><strong>${escapeHtml(title)}</strong>${escapeHtml(description)}</button>`).join("")}
      </div>
      <textarea id="promptText" placeholder="Paste the full task here. Include constraints, must-haves, non-goals, and anything the agent should avoid."></textarea>
      <button id="submitPrompt" class="primary">Start Build Session</button>
    </div>
  </section>`;
}

function renderPlanningProviderBanner(info: PlanningProviderInfo | null) {
  if (!info) {
    return "";
  }

  const reason = info.reason ? `<span class="planning-banner-reason">${escapeHtml(info.reason)}</span>` : "";
  const tone = info.id === "external-ai-prompt" ? "fallback" : info.id === "xupra-pro-ai" ? "pro" : "ide";

  return `<section class="planning-banner ${tone}" aria-label="Planning AI">
    <span class="planning-banner-eyebrow">Planning AI</span>
    <strong class="planning-banner-label">${escapeHtml(info.label)}</strong>
    ${reason}
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
  handoffAction?: unknown;
  status?: unknown;
  text?: unknown;
};

type PlanningProviderReader = () => PlanningProviderInfo | null;
type ChatStateReader = () => ChatState;

function formatChatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderChatPanel(state: ChatState, planningProviderLabel: string) {
  const messages = state.messages.length
    ? state.messages
        .map((message) => {
          const roleClass =
            message.role === "user" ? "user" : message.role === "system" ? "system" : "ai";
          const senderLabel =
            message.role === "user" ? "You" : message.role === "system" ? "DryLake" : planningProviderLabel;
          return `<div class="chat-message ${roleClass}">
            <div class="chat-meta"><span class="chat-sender">${escapeHtml(senderLabel)}</span><span class="chat-time">${escapeHtml(formatChatTime(message.ts))}</span></div>
            <div class="chat-body">${escapeHtml(message.text).replace(/\n/g, "<br />")}</div>
          </div>`;
        })
        .join("")
    : `<div class="chat-empty">Chat with the planning AI here. As you discuss the plan, the kanban below will update.</div>`;

  return `<section class="chat-panel" aria-label="Planning chat">
    <div class="chat-header">
      <span class="chat-eyebrow">Planning Chat</span>
      <button type="button" class="chat-clear secondary" data-command="drylake.clearChat">Clear</button>
    </div>
    <div class="chat-messages" id="chatMessages">${messages}</div>
    <form class="chat-form" id="chatForm">
      <textarea id="chatInput" rows="2" placeholder="Tell the planning AI what you want, or answer its questions. Shift+Enter for a new line."></textarea>
      <div class="chat-form-row">
        <span class="chat-hint muted">Enter to send</span>
        <button type="submit">Send</button>
      </div>
    </form>
  </section>`;
}

export class ControlRoomProvider {
  private panel?: vscode.WebviewPanel;
  private context?: vscode.ExtensionContext;

  constructor(
    private readonly sessionStore: XuSessionStore,
    private readonly readPlanningProvider: PlanningProviderReader = () => null,
    private readonly readChatState: ChatStateReader = () => ({ messages: [] }),
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

      if (message.command === "drylake.handoffPhase") {
        await vscode.commands.executeCommand(message.command, message.phaseId ?? message.args?.[0], message.handoffAction ?? message.args?.[1]);
        return;
      }

      if (message.command === "drylake.chatSendMessage") {
        await vscode.commands.executeCommand(message.command, message.text ?? message.args?.[0]);
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
    try {
      runbook = (await this.sessionStore.readRunbook())?.runbook ?? null;
    } catch {
      runbook = null;
    }

    this.panel.webview.html = this.renderHtml(runbook);
  }

  private currentView(): ControlRoomView {
    return controlRoomViewFrom(this.context?.workspaceState?.get(CONTROL_ROOM_VIEW_KEY));
  }

  private renderHtml(runbook: ApplicationBuildRunbook | null) {
    const view = this.currentView();
    const planningProvider = this.readPlanningProvider();
    const banner = renderPlanningProviderBanner(planningProvider);
    const chatState = this.readChatState();
    const planningProviderLabel = planningProvider?.label ?? "Planning AI";
    const chatPanel = renderChatPanel(chatState, planningProviderLabel);
    const body = runbook ? (view === "kanban" ? renderKanban(runbook) : renderPipeline(runbook)) : renderEmptyState();
    const executionToggle = renderExecutionModeToggle(runbook);
    const handoffPanel = renderHandoffCapabilityPanel(runbook);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    :root { --drylake-paper: #f7f4ea; --drylake-ink: #111111; --drylake-yellow: #ffd60a; --drylake-blue: #005caf; --drylake-pink: #e6007e; --drylake-green: #36b979; --drylake-orange: #ff5a1f; --drylake-white: #ffffff; }
    body { margin: 0; color: var(--drylake-ink); background: var(--drylake-paper); font-family: var(--vscode-font-family); }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; padding: 16px; border: 5px solid var(--drylake-ink); border-radius: 8px; background: var(--drylake-white); box-shadow: 10px 10px 0 var(--drylake-ink); }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 8px 0; font-size: 20px; }
    h3, p { margin: 0; }
    button, select, textarea { font: inherit; }
    button { color: var(--drylake-ink); background: var(--drylake-yellow); border: 3px solid var(--drylake-ink); border-radius: 4px; padding: 7px 11px; cursor: pointer; font-weight: 800; box-shadow: 4px 4px 0 var(--drylake-ink); }
    button.secondary, .toggle-btn { color: var(--drylake-ink); background: var(--drylake-white); border-color: var(--drylake-ink); }
    .eyebrow { color: var(--drylake-blue); text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; }
    .muted { color: #3f3a34; line-height: 1.45; }
    .actions, .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggle-btn.active { color: var(--drylake-ink); background: var(--drylake-yellow); border-color: var(--drylake-ink); }
    .pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 10px; }
    .arrow { display: flex; align-items: center; padding: 0 8px; color: var(--drylake-blue); font-size: 22px; font-weight: 900; flex: 0 0 auto; }
    .phase-card { min-width: 190px; max-width: 220px; flex: 0 0 210px; border: 4px solid var(--drylake-ink); border-radius: 6px; padding: 12px; background: var(--drylake-white); box-shadow: 5px 5px 0 var(--drylake-ink); }
    .phase-card.active, .phase-card.active-phase { border-color: var(--drylake-orange); background: #fff7ed; }
    .phase-card.approved, .phase-card.complete { border-color: var(--drylake-green); }
    .phase-card.complete { opacity: 0.78; }
    .phase-card[draggable="true"] { cursor: grab; }
    .phase-card.dragging { opacity: 0.5; border-style: dashed; }
    .pipeline .phase-card.drop-before { border-left: 6px solid var(--drylake-blue); }
    .pipeline .phase-card.drop-after { border-right: 6px solid var(--drylake-blue); }
    .kanban .phase-card.drop-before { border-top: 6px solid var(--drylake-blue); }
    .kanban .phase-card.drop-after { border-bottom: 6px solid var(--drylake-blue); }
    .phase-id { color: var(--drylake-blue); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
    .phase-title { margin: 5px 0 8px; font-size: 13px; line-height: 1.25; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border: 2px solid var(--drylake-ink); border-radius: 4px; color: var(--drylake-ink); background: var(--drylake-yellow); font-size: 10px; font-weight: 800; }
    .badge.active { background: var(--drylake-orange); color: var(--drylake-white); }
    .badge.approved, .badge.complete { background: var(--drylake-green); color: var(--drylake-ink); }
    .objective { min-height: 32px; margin-bottom: 8px; color: #4b463f; font-size: 11px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .agent-label { display: block; color: #4b463f; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .agent-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--drylake-ink); background: var(--drylake-paper); border: 3px solid var(--drylake-ink); border-radius: 4px; font-size: 11px; }
    .step-count { margin-top: 8px; color: #4b463f; font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 4px solid var(--drylake-ink); border-radius: 8px; background: var(--drylake-white); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 4px solid var(--drylake-ink); color: var(--drylake-ink); background: var(--drylake-yellow); text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border: 2px solid var(--drylake-ink); border-radius: 4px; color: var(--drylake-ink); background: var(--drylake-white); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; margin-bottom: 8px; }
    .drop-zone { padding: 10px; border: 3px dashed var(--drylake-ink); border-radius: 6px; color: #4b463f; text-align: center; font-size: 11px; }
    .kanban-column.drag-over .drop-zone { border-color: var(--drylake-blue); color: var(--drylake-blue); }
    .empty-state { border: 5px solid var(--drylake-ink); border-radius: 8px; padding: 18px; background: var(--drylake-white); box-shadow: 10px 10px 0 var(--drylake-ink); }
    .prompt-panel { margin-top: 14px; display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 170px; resize: vertical; color: var(--drylake-ink); background: var(--drylake-white); border: 3px solid var(--drylake-ink); border-radius: 4px; padding: 12px; line-height: 1.45; }
    .mode-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .mode-card { min-height: 92px; color: var(--drylake-ink); background: var(--drylake-white); border-color: var(--drylake-ink); text-align: left; }
    .mode-card.selected { background: var(--drylake-yellow); border-color: var(--drylake-ink); }
    .mode-card strong { display: block; margin-bottom: 6px; }
    .planning-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin: 0 0 16px; border: 4px solid var(--drylake-ink); border-radius: 8px; background: var(--drylake-white); font-size: 12px; }
    .planning-banner.pro { border-color: var(--drylake-blue); }
    .planning-banner.fallback { border-color: var(--drylake-orange); }
    .planning-banner-eyebrow { color: var(--drylake-blue); text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; }
    .planning-banner-label { color: var(--drylake-ink); }
    .planning-banner-reason { color: #4b463f; flex-basis: 100%; }
    .handoff-panel { display: grid; gap: 10px; padding: 12px; margin: 0 0 16px; border: 4px solid var(--drylake-ink); border-radius: 8px; background: var(--drylake-white); }
    .handoff-panel-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    .handoff-eyebrow { color: var(--drylake-blue); text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; }
    .handoff-note { color: #4b463f; font-size: 11px; }
    .agent-capability-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; }
    .agent-capability { min-height: 54px; padding: 8px; border: 3px solid var(--drylake-ink); border-radius: 6px; background: var(--drylake-paper); }
    .agent-capability.direct { background: #e9fff2; border-color: var(--drylake-green); }
    .agent-capability.prompt { background: #fff7d0; border-color: var(--drylake-yellow); }
    .agent-capability.fallback { opacity: 0.84; }
    .agent-capability-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 5px; font-size: 12px; }
    .agent-capability span { color: #4b463f; font-size: 11px; }
    .agent-count { min-width: 18px; padding: 1px 6px; border: 2px solid var(--drylake-ink); border-radius: 4px; color: var(--drylake-ink) !important; background: var(--drylake-yellow); text-align: center; }
    .step-list-wrap { margin-top: 8px; }
    .step-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
    .step-item label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 12px; line-height: 1.4; color: var(--drylake-ink); }
    .step-item input[type="checkbox"] { margin-top: 2px; }
    .step-item.done span { text-decoration: line-through; color: #6c655d; }
    .phase-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; margin-top: 10px; }
    .handoff-action-select { min-width: 0; width: 100%; padding: 5px 6px; color: var(--drylake-ink); background: var(--drylake-paper); border: 3px solid var(--drylake-ink); border-radius: 4px; font-size: 11px; }
    .handoff-btn { font-size: 12px; padding: 6px 10px; }
    .chat-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; margin: 0 0 18px; border: 4px solid var(--drylake-ink); border-radius: 8px; background: var(--drylake-white); }
    .chat-header { display: flex; align-items: center; justify-content: space-between; }
    .chat-eyebrow { color: var(--drylake-blue); text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; }
    .chat-clear { padding: 4px 8px; font-size: 11px; }
    .chat-messages { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
    .chat-message { padding: 8px 10px; border: 3px solid var(--drylake-ink); border-radius: 6px; background: var(--drylake-paper); }
    .chat-message.user { border-color: var(--drylake-blue); }
    .chat-message.system { border-style: dashed; opacity: 0.85; }
    .chat-meta { display: flex; justify-content: space-between; color: #4b463f; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .chat-body { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .chat-empty { padding: 8px 4px; color: #4b463f; font-size: 12px; }
    .chat-form textarea { min-height: 56px; }
    .chat-form-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
    .chat-hint { font-size: 11px; }
    @media (max-width: 860px) { header { flex-direction: column; } .kanban, .mode-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">DryLake Build Session</div>
        <h1>DryLake Control Room</h1>
        <p class="muted">Visual kanban and pipeline planner for coding-agent work.</p>
      </div>
      <div class="actions">
        <div class="toggle-group" role="group" aria-label="Control Room view">
          <button class="toggle-btn${view === "pipeline" ? " active" : ""}" data-view="pipeline">Pipeline</button>
          <button class="toggle-btn${view === "kanban" ? " active" : ""}" data-view="kanban">Kanban</button>
        </div>
        ${executionToggle}
        <button class="secondary" data-command="drylake.runNextPhase">Run Next Phase</button>
      </div>
    </header>
    ${banner}
    ${handoffPanel}
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
    function sendChat() {
      if (!chatInput) {
        return;
      }
      const text = chatInput.value.trim();
      if (!text) {
        return;
      }
      vscode.postMessage({ command: "drylake.chatSendMessage", text: text });
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

      const modeCard = event.target.closest(".mode-card[data-mode]");
      if (modeCard) {
        selectedMode = modeCard.dataset.mode || "build-app";
        document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("selected", card === modeCard));
        document.getElementById("promptText")?.focus();
        return;
      }

      const commandEl = event.target.closest("[data-command]");
      if (commandEl) {
        vscode.postMessage({ command: commandEl.dataset.command, args: [] });
        return;
      }

      const handoffBtn = event.target.closest("[data-handoff-phase]");
      if (handoffBtn) {
        const card = handoffBtn.closest(".phase-card");
        const actionSelect = card?.querySelector("[data-handoff-action-for]");
        vscode.postMessage({
          command: "drylake.handoffPhase",
          phaseId: handoffBtn.dataset.handoffPhase,
          handoffAction: actionSelect?.value || "run"
        });
      }
    });

    document.addEventListener("change", (event) => {
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

    document.getElementById("submitPrompt")?.addEventListener("click", () => {
      const prompt = document.getElementById("promptText")?.value.trim() || "";
      if (!prompt) {
        document.getElementById("promptText")?.focus();
        return;
      }

      vscode.postMessage({ command: "drylake.startBuildSession", args: [selectedMode, prompt] });
    });
  </script>
</body>
</html>`;
  }
}
