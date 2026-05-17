import * as vscode from "vscode";

import { XuSessionStore } from "../xu/sessionStore";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { PlanningProviderInfo } from "../services/stateStore";
import type { ApplicationBuildRunbook, XuMode, XuPhase, XuPhaseAgent, XuStepStatus } from "../xu/types";

const CONTROL_ROOM_VIEW_KEY = "drylake.controlRoomView";
type ControlRoomView = "pipeline" | "kanban";

const MODE_CARDS: Array<[string, XuMode, string]> = [
  ["Build App", "build-app", "Turn an app idea into purpose, architecture, steps, and a ship plan."],
  ["Break Into Steps", "phases", "Clarify intent, then split the task into safe coding steps."],
  ["Create Plan", "plan", "Generate a file-aware plan for a complex repo change."],
  ["Review / Repair", "review", "Review existing code and produce a correction plan."],
];

const AGENT_LABELS: Record<XuPhaseAgent, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  copilot: "GitHub Copilot",
  "external-ai-prompt": "External AI Prompt",
};

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

function phaseAgentFrom(value: unknown): XuPhaseAgent | undefined {
  return typeof value === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(value)
    ? (value as XuPhaseAgent)
    : undefined;
}

function defaultAgent(runbook: ApplicationBuildRunbook | null): XuPhaseAgent {
  return phaseAgentFrom(runbook?.handoff.defaultAgent) ?? "external-ai-prompt";
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

function renderAgentSelect(phase: XuPhase, fallbackAgent: XuPhaseAgent) {
  const selected = phase.agent ?? fallbackAgent;

  return `<label class="agent-label">Agent<select class="agent-select" data-phase-agent="${escapeHtml(phase.id)}">
    ${XU_PHASE_AGENTS.map((agent) => {
      const isSelected = agent === selected ? " selected" : "";
      return `<option value="${agent}"${isSelected}>${escapeHtml(AGENT_LABELS[agent])}</option>`;
    }).join("")}
  </select></label>`;
}

function renderPhaseCard(phase: XuPhase, fallbackAgent: XuPhaseAgent, options: { draggable: boolean }) {
  const stepCount = phase.steps.length;
  const draggable = options.draggable ? ' draggable="true"' : "";
  const cardClass = `phase-card ${statusClass(phase.status)}${phase.status === "active" ? " active-phase" : ""}`;

  return `<article class="${cardClass}" data-phase-id="${escapeHtml(phase.id)}" data-phase-status="${statusForKanban(phase.status)}"${draggable}>
    <div class="phase-id">${escapeHtml(phase.id)}</div>
    <h3 class="phase-title">${escapeHtml(phase.title)}</h3>
    <span class="badge ${statusClass(phase.status)}">${escapeHtml(STATUS_LABELS[phase.status])}</span>
    <p class="objective" title="${escapeHtml(phase.objective)}">${escapeHtml(phase.objective || "No objective recorded.")}</p>
    ${renderAgentSelect(phase, fallbackAgent)}
    <div class="step-count">${stepCount} step${stepCount === 1 ? "" : "s"}</div>
  </article>`;
}

function renderPipeline(runbook: ApplicationBuildRunbook) {
  const fallbackAgent = defaultAgent(runbook);

  return `<section class="pipeline" aria-label="Build Session pipeline">
    ${runbook.phases.map((phase, index) => {
      const card = renderPhaseCard(phase, fallbackAgent, { draggable: true });
      return index < runbook.phases.length - 1 ? `${card}<div class="arrow" aria-hidden="true">&rarr;</div>` : card;
    }).join("")}
  </section>`;
}

function renderKanbanColumn(title: string, status: "pending" | "active" | "complete", phases: XuPhase[], fallbackAgent: XuPhaseAgent) {
  return `<section class="kanban-column" data-drop-status="${status}">
    <div class="column-header"><span>${escapeHtml(title)}</span><span class="count">${phases.length}</span></div>
    <div class="column-body">
      ${phases.map((phase) => renderPhaseCard(phase, fallbackAgent, { draggable: true })).join("")}
      <div class="drop-zone">Drop phase here</div>
    </div>
  </section>`;
}

function renderKanban(runbook: ApplicationBuildRunbook) {
  const fallbackAgent = defaultAgent(runbook);
  const pending = runbook.phases.filter((phase) => statusForKanban(phase.status) === "pending");
  const active = runbook.phases.filter((phase) => statusForKanban(phase.status) === "active");
  const complete = runbook.phases.filter((phase) => statusForKanban(phase.status) === "complete");

  return `<section class="kanban" aria-label="Build Session kanban">
    ${renderKanbanColumn("To Do", "pending", pending, fallbackAgent)}
    ${renderKanbanColumn("In Progress", "active", active, fallbackAgent)}
    ${renderKanbanColumn("Done", "complete", complete, fallbackAgent)}
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
  afterPhaseId?: unknown;
  agent?: unknown;
  status?: unknown;
};

type PlanningProviderReader = () => PlanningProviderInfo | null;

export class ControlRoomProvider {
  private panel?: vscode.WebviewPanel;
  private context?: vscode.ExtensionContext;

  constructor(
    private readonly sessionStore: XuSessionStore,
    private readonly readPlanningProvider: PlanningProviderReader = () => null,
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
    const body = runbook ? (view === "kanban" ? renderKanban(runbook) : renderPipeline(runbook)) : renderEmptyState();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 8px 0; font-size: 20px; }
    h3, p { margin: 0; }
    button, select, textarea { font: inherit; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid var(--vscode-button-background); border-radius: 4px; padding: 7px 11px; cursor: pointer; }
    button.secondary, .toggle-btn { color: var(--vscode-foreground); background: var(--vscode-editor-background); border-color: var(--vscode-panel-border); }
    .eyebrow { color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; }
    .muted { color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .actions, .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggle-btn.active { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: var(--vscode-button-background); }
    .pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 10px; }
    .arrow { display: flex; align-items: center; padding: 0 8px; color: var(--vscode-descriptionForeground); font-size: 18px; flex: 0 0 auto; }
    .phase-card { min-width: 190px; max-width: 220px; flex: 0 0 210px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .phase-card.active, .phase-card.active-phase { border-color: var(--vscode-button-background); }
    .phase-card.approved, .phase-card.complete { border-color: var(--vscode-testing-iconPassed, #4ec9b0); }
    .phase-card.complete { opacity: 0.78; }
    .phase-card[draggable="true"] { cursor: grab; }
    .phase-card.dragging { opacity: 0.5; border-style: dashed; }
    .pipeline .phase-card.drop-before { border-left: 4px solid var(--vscode-button-background); }
    .pipeline .phase-card.drop-after { border-right: 4px solid var(--vscode-button-background); }
    .kanban .phase-card.drop-before { border-top: 4px solid var(--vscode-button-background); }
    .kanban .phase-card.drop-after { border-bottom: 4px solid var(--vscode-button-background); }
    .phase-id { color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
    .phase-title { margin: 5px 0 8px; font-size: 13px; line-height: 1.25; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border: 1px solid var(--vscode-panel-border); border-radius: 999px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .badge.active { border-color: var(--vscode-button-background); color: var(--vscode-button-background); }
    .badge.approved, .badge.complete { border-color: var(--vscode-testing-iconPassed, #4ec9b0); color: var(--vscode-testing-iconPassed, #4ec9b0); }
    .objective { min-height: 32px; margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .agent-label { display: block; color: var(--vscode-descriptionForeground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
    .agent-select { width: 100%; margin-top: 4px; padding: 4px 6px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border)); border-radius: 4px; font-size: 11px; }
    .step-count { margin-top: 8px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kanban-column { min-height: 320px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .column-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; }
    .count { padding: 1px 7px; border-radius: 999px; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
    .column-body { min-height: 280px; padding: 10px; }
    .kanban .phase-card { width: 100%; max-width: none; min-width: 0; margin-bottom: 8px; }
    .drop-zone { padding: 10px; border: 1px dashed var(--vscode-panel-border); border-radius: 6px; color: var(--vscode-descriptionForeground); text-align: center; font-size: 11px; }
    .kanban-column.drag-over .drop-zone { border-color: var(--vscode-button-background); color: var(--vscode-button-background); }
    .empty-state { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 18px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
    .prompt-panel { margin-top: 14px; display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 170px; resize: vertical; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 12px; line-height: 1.45; }
    .mode-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .mode-card { min-height: 92px; color: var(--vscode-foreground); background: var(--vscode-editor-background); border-color: var(--vscode-panel-border); text-align: left; }
    .mode-card.selected { border-color: var(--vscode-button-background); }
    .mode-card strong { display: block; margin-bottom: 6px; }
    .planning-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin: 0 0 16px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); font-size: 12px; }
    .planning-banner.pro { border-color: var(--vscode-button-background); }
    .planning-banner.fallback { border-color: var(--vscode-editorWarning-foreground, var(--vscode-panel-border)); }
    .planning-banner-eyebrow { color: var(--vscode-descriptionForeground); text-transform: uppercase; font-size: 10px; letter-spacing: 0.14em; }
    .planning-banner-label { color: var(--vscode-foreground); }
    .planning-banner-reason { color: var(--vscode-descriptionForeground); flex-basis: 100%; }
    @media (max-width: 860px) { header { flex-direction: column; } .kanban, .mode-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">DryLake Build Session</div>
        <h1>DryLake Control Room</h1>
        <p class="muted">Plan the work, assign the right AI tool, and move each coding step toward validation.</p>
      </div>
      <div class="actions">
        <div class="toggle-group" role="group" aria-label="Control Room view">
          <button class="toggle-btn${view === "pipeline" ? " active" : ""}" data-view="pipeline">Pipeline</button>
          <button class="toggle-btn${view === "kanban" ? " active" : ""}" data-view="kanban">Kanban</button>
        </div>
        <button class="secondary" data-command="drylake.runNextPhase">Run Next Phase</button>
      </div>
    </header>
    ${banner}
    ${body}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    let selectedMode = "build-app";

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
      }
    });

    document.addEventListener("change", (event) => {
      const select = event.target.closest("[data-phase-agent]");
      if (!select) {
        return;
      }

      vscode.postMessage({
        command: "drylake.updatePhaseAgent",
        phaseId: select.dataset.phaseAgent,
        agent: select.value
      });
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
