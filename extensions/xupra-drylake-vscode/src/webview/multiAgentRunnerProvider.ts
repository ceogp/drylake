import * as vscode from "vscode";

import {
  launchAgentTask,
  phaseAgentHint,
  phaseAgentLabel,
} from "../agents/phaseAgentLauncher";
import type { ApiClient } from "../services/apiClient";
import type { MultiAgentAssignmentPlan } from "../types/multiAgentRun";
import { MultiAgentRunStore } from "../xu/multiAgentRunStore";
import { XU_PHASE_AGENTS } from "../xu/types";
import type { XuPhaseAgent } from "../xu/types";

type RunnerStatus = "idle" | "assignment-review" | "running" | "results";
type RunnerAgentStatus = "pending" | "running" | "complete" | "failed";
type RunnerAssignmentSource = "ai" | "manual";
type RunnerModelTier = "nano" | "foundation";

type RunnerAssignment = {
  agentId: XuPhaseAgent;
  agentLabel: string;
  subtaskSummary: string;
  scopeBoundary: string;
};

type RunnerAgentResult = {
  id: XuPhaseAgent;
  label: string;
  assignmentSummary: string;
  assignmentBoundary: string;
  status: RunnerAgentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  command: string | null;
  installError: string | null;
  message: string;
  promptFile?: string;
  terminalName?: string;
};

type RunnerRun = {
  id: string;
  taskPrompt: string;
  assignmentSource: RunnerAssignmentSource;
  assignmentApprovedAt: string | null;
  createdAt: string;
  startedAt: string | null;
  status: RunnerStatus;
  assignments: RunnerAssignment[];
  agents: RunnerAgentResult[];
  modelTier: RunnerModelTier | null;
  conflictWarning: string | null;
};

type RunnerMessage = {
  command?: string;
  prompt?: unknown;
  agents?: unknown;
  agent?: unknown;
  assignments?: unknown;
};

type RunnerApiClient = Pick<ApiClient, "planRunnerAssignments">;

const RUNNER_AGENTS: Array<{
  id: XuPhaseAgent | "blackbox" | "droid";
  label: string;
  provider: string;
  disabled?: boolean;
}> = [
  { id: "claude-code", label: "Claude Code", provider: "Anthropic" },
  { id: "codex", label: "OpenAI Codex", provider: "OpenAI" },
  { id: "gemini", label: "Gemini CLI", provider: "Google" },
  { id: "cursor", label: "Cursor CLI", provider: "Cursor" },
  { id: "copilot", label: "GitHub Copilot Chat", provider: "GitHub" },
  { id: "blackbox", label: "Blackbox", provider: "Blackbox", disabled: true },
  { id: "droid", label: "Droid", provider: "Droid", disabled: true },
];

function workspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake runner task.");
  }

  return root;
}

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "task";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseAgents(value: unknown): XuPhaseAgent[] {
  const values = Array.isArray(value) ? value : [];
  const valid = new Set<string>(XU_PHASE_AGENTS);
  return values.filter((item): item is XuPhaseAgent => typeof item === "string" && valid.has(item));
}

function agentLabel(agent: XuPhaseAgent) {
  return RUNNER_AGENTS.find((item) => item.id === agent)?.label ?? phaseAgentLabel(agent);
}

function normalizeBoundary(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .replace(/\/(?:\*\*|\*)\/?$/, "")
    .replace(/\/+$/, "");
}

function boundariesOverlap(current: string, other: string) {
  if (current === other) {
    return true;
  }

  if (!current.includes("/") || !other.includes("/")) {
    return false;
  }

  return current.startsWith(`${other}/`) || other.startsWith(`${current}/`);
}

function detectBoundaryConflict(assignments: RunnerAssignment[]) {
  const normalized = assignments.map((assignment) => ({
    label: assignment.agentLabel,
    boundary: normalizeBoundary(assignment.scopeBoundary),
  }));

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (!current.boundary) {
      return "Each assignment needs a declared scope boundary before launch.";
    }

    for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
      const other = normalized[otherIndex];
      if (boundariesOverlap(current.boundary, other.boundary)) {
        return `Scope boundaries overlap between ${current.label} and ${other.label}. Replan before launch.`;
      }
    }
  }

  return null;
}

function parseEditedAssignments(value: unknown, current: RunnerAssignment[]) {
  const byAgent = new Map(current.map((assignment) => [assignment.agentId, assignment]));
  const rows = Array.isArray(value) ? value : [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const record = row as Record<string, unknown>;
    const agentId = typeof record.agentId === "string" ? record.agentId : "";
    const existing = byAgent.get(agentId as XuPhaseAgent);
    if (!existing) {
      continue;
    }

    const subtaskSummary =
      typeof record.subtaskSummary === "string" && record.subtaskSummary.trim()
        ? record.subtaskSummary.trim()
        : existing.subtaskSummary;

    byAgent.set(existing.agentId, {
      ...existing,
      subtaskSummary,
    });
  }

  return current.map((assignment) => byAgent.get(assignment.agentId) ?? assignment);
}

function runDirectory(root: vscode.Uri, runId: string) {
  return vscode.Uri.joinPath(root, ".drylake", "runs", runId);
}

function renderIdle(run: RunnerRun | null) {
  const lastRun = run
    ? `<section class="last-run"><span>Last run</span><strong>${escapeHtml(run.taskPrompt)}</strong><em>${escapeHtml(run.status)}</em></section>`
    : "";

  return `<section class="runner-idle">
    <label class="section-label" for="runnerPrompt">Task prompt</label>
    <textarea id="runnerPrompt" rows="5" placeholder="Describe the implementation task to split across selected agents."></textarea>
    <div class="section-label">Agents</div>
    <div class="agent-list">
      ${RUNNER_AGENTS.map((agent) => {
        const disabled = agent.disabled ? " disabled" : "";
        const checked = agent.id === "codex" ? " checked" : "";
        const title = agent.disabled ? "Coming soon" : phaseAgentHint(agent.id as XuPhaseAgent);
        return `<label class="agent-row${agent.disabled ? " disabled" : ""}" title="${escapeHtml(title)}">
          <span class="agent-info"><span class="agent-icon">${escapeHtml(agent.label.slice(0, 1))}</span><span><strong>${escapeHtml(agent.label)}</strong><em>${escapeHtml(agent.provider)}</em></span></span>
          <span class="agent-control">${agent.disabled ? "Coming soon" : `<input type="checkbox" value="${agent.id}"${checked}${disabled} />`}</span>
        </label>`;
      }).join("")}
    </div>
    <footer><span id="selectedCount">1 agent selected</span><button id="runAgents">Run</button></footer>
    ${lastRun}
  </section>`;
}

function renderAssignmentReview(run: RunnerRun) {
  const complete = run.assignments.length === run.agents.length && run.assignments.every((assignment) =>
    assignment.subtaskSummary.trim() && assignment.scopeBoundary.trim()
  );
  const warning = run.conflictWarning
    ? `<div class="warning">${escapeHtml(run.conflictWarning)}</div>`
    : "";
  const tier = run.modelTier === "nano" ? `<div class="note">Planned with gpt-5.4-nano.</div>` : "";
  const cards = run.assignments.map((assignment) => `<article class="assignment-card" data-assignment-agent="${escapeHtml(assignment.agentId)}">
    <div class="agent-info"><span class="agent-icon">${escapeHtml(assignment.agentLabel.slice(0, 1))}</span><span><strong>${escapeHtml(assignment.agentLabel)}</strong><em>${escapeHtml(assignment.scopeBoundary)}</em></span></div>
    <label class="field-label">Subtask summary
      <textarea class="assignment-summary" rows="4" data-assignment-summary="${escapeHtml(assignment.agentId)}">${escapeHtml(assignment.subtaskSummary)}</textarea>
    </label>
    <div class="boundary"><span>Scope boundary</span><strong>${escapeHtml(assignment.scopeBoundary)}</strong></div>
  </article>`).join("");

  return `<section class="runner-assignments">
    <div class="section-label">${escapeHtml(run.taskPrompt)}</div>
    ${tier}
    ${warning}
    ${cards}
    <footer>
      <span>${run.assignments.length} of ${run.agents.length} assignments ready</span>
      <span class="footer-actions">
        <button id="replanAssignments">Replan</button>
        <button id="approveAssignments"${complete && !run.conflictWarning ? "" : " disabled"}>Approve & Launch</button>
      </span>
    </footer>
  </section>`;
}

function renderRun(run: RunnerRun) {
  const cards = run.agents.map((agent) => `<article class="run-card">
    <div class="agent-info"><span class="agent-icon">${escapeHtml(agent.label.slice(0, 1))}</span><span><strong>${escapeHtml(agent.label)}</strong><em>${escapeHtml(agent.terminalName ?? "No terminal")}</em></span></div>
    <div class="run-actions"><span class="status-badge ${agent.status}">${escapeHtml(agent.status)}</span><button class="link-button" data-open-agent="${escapeHtml(agent.id)}">View terminal</button></div>
    <p><strong>${escapeHtml(agent.assignmentSummary)}</strong></p>
    <p>${escapeHtml(agent.message)}</p>
  </article>`).join("");

  return `<section class="runner-progress">
    <div class="section-label">${escapeHtml(run.taskPrompt)}</div>
    ${cards}
    <footer><span>${run.agents.filter((agent) => agent.status === "running").length} agents running</span><button id="showResults">Review results</button></footer>
  </section>`;
}

function renderResults(run: RunnerRun) {
  const cards = run.agents.map((agent) => `<article class="run-card">
    <div class="agent-info"><span class="agent-icon">${escapeHtml(agent.label.slice(0, 1))}</span><span><strong>${escapeHtml(agent.label)}</strong><em>${escapeHtml(agent.status)}</em></span></div>
    <p><strong>${escapeHtml(agent.assignmentSummary)}</strong></p>
    <p>${escapeHtml(agent.message)}</p>
    <div class="result-actions">
      <button class="link-button" data-open-agent="${escapeHtml(agent.id)}">View terminal</button>
      <button class="link-button" data-rerun-agent="${escapeHtml(agent.id)}">Rerun</button>
    </div>
  </article>`).join("");

  return `<section class="runner-results">
    <div class="section-label">${escapeHtml(run.taskPrompt)}</div>
    ${cards}
  </section>`;
}

export class MultiAgentRunnerProvider {
  private panel?: vscode.WebviewPanel;
  private currentWebview?: vscode.Webview;
  private currentRun: RunnerRun | null = null;

  constructor(private readonly apiClient?: RunnerApiClient) {}

  async createOrShow(context: vscode.ExtensionContext) {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "drylake.multiAgentRunner",
      "DryLake Multi-Agent Runner",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.currentWebview = this.panel.webview;

    this.panel.onDidDispose(() => {
      if (this.currentWebview === this.panel?.webview) {
        this.currentWebview = undefined;
      }
      this.panel = undefined;
    }, null, context.subscriptions);

    this.panel.webview.onDidReceiveMessage((message: RunnerMessage) => this.handleMessage(message));

    this.refresh();
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.currentWebview = webviewView.webview;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: RunnerMessage) => this.handleMessage(message));
    this.refresh();
  }

  async planAssignmentsFromCommand(promptArg?: unknown, agentsArg?: unknown) {
    const prompt = typeof promptArg === "string" ? promptArg : this.currentRun?.taskPrompt ?? "";
    const agents = parseAgents(agentsArg);
    await this.planAssignments(prompt, agents.length > 0 ? agents : this.currentRun?.agents.map((agent) => agent.id) ?? []);
  }

  async approveAssignmentsFromCommand(assignmentsArg?: unknown) {
    await this.approveAssignments(assignmentsArg);
  }

  async runApprovedAssignmentsFromCommand() {
    if (!this.currentRun) {
      void vscode.window.showWarningMessage("No DryLake runner assignment plan is ready to launch.");
      return;
    }

    await this.launchApprovedAssignments(this.currentRun);
  }

  private async handleMessage(message: RunnerMessage) {
    if (message.command === "run") {
      await this.planAssignments(String(message.prompt ?? ""), parseAgents(message.agents));
      return;
    }

    if (message.command === "replan") {
      await this.replanAssignments();
      return;
    }

    if (message.command === "approve") {
      await this.approveAssignments(message.assignments);
      return;
    }

    if (message.command === "showResults") {
      if (this.currentRun) {
        this.currentRun = {
          ...this.currentRun,
          status: "results",
          agents: this.currentRun.agents.map((agent) => agent.status === "running"
            ? { ...agent, status: "complete", finishedAt: new Date().toISOString() }
            : agent),
        };
        await this.writeAuditLog(this.currentRun);
        this.refresh();
      }
      return;
    }

    if (message.command === "openPrompt") {
      await this.openPrompt(message.agent);
      return;
    }

    if (message.command === "rerun") {
      await this.rerunAgent(message.agent);
      return;
    }

  }

  private refresh() {
    const webview = this.currentWebview ?? this.panel?.webview;
    if (!webview) {
      return;
    }

    webview.html = this.renderHtml();
  }

  private store() {
    return new MultiAgentRunStore();
  }

  private async writeAuditLog(run: RunnerRun) {
    const uri = vscode.Uri.joinPath(runDirectory(workspaceRoot(), run.id), "run.json");
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceRoot(), ".drylake", "runs", run.id));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(`${JSON.stringify(run, null, 2)}\n`));
  }

  private assignmentPlan(run: RunnerRun): MultiAgentAssignmentPlan {
    return {
      runId: run.id,
      taskPrompt: run.taskPrompt,
      assignmentSource: run.assignmentSource,
      assignmentApprovedAt: run.assignmentApprovedAt,
      modelTier: run.modelTier,
      assignments: run.assignments.map((assignment) => ({
        agentId: assignment.agentId,
        label: assignment.agentLabel,
        assignmentSummary: assignment.subtaskSummary,
        assignmentBoundary: assignment.scopeBoundary,
      })),
      conflictWarning: run.conflictWarning,
    };
  }

  private promptContent(run: RunnerRun, assignment: RunnerAssignment) {
    return [
      `# DryLake Multi-Agent Runner: ${assignment.agentLabel}`,
      "",
      "You are one participant in a DryLake multi-agent run.",
      "Work only inside your assigned scope boundary. Do not modify files or behavior assigned to another agent.",
      "",
      "## Top-level task",
      "",
      run.taskPrompt,
      "",
      "## Your assignment",
      "",
      assignment.subtaskSummary,
      "",
      "## Scope boundary",
      "",
      assignment.scopeBoundary,
      "",
      "Report what you changed, what you verified, and any blockers.",
      "",
    ].join("\n");
  }

  private buildRun(task: string, agents: XuPhaseAgent[], modelTier: RunnerModelTier | null = null): RunnerRun {
    const id = `${timestampId()}-${slugify(task)}`;
    const createdAt = new Date().toISOString();
    return {
      id,
      taskPrompt: task,
      assignmentSource: "ai",
      assignmentApprovedAt: null,
      createdAt,
      startedAt: null,
      status: "assignment-review",
      assignments: [],
      agents: agents.map((agent) => ({
        id: agent,
        label: agentLabel(agent),
        assignmentSummary: "",
        assignmentBoundary: "",
        status: "pending",
        startedAt: null,
        finishedAt: null,
        command: null,
        installError: null,
        message: "Awaiting assignment approval.",
      })),
      modelTier,
      conflictWarning: null,
    };
  }

  private async planAssignments(prompt: string, agents: XuPhaseAgent[]) {
    const task = prompt.trim();
    if (!task || agents.length === 0) {
      void vscode.window.showWarningMessage("Enter a task and select at least one agent.");
      return;
    }

    if (!this.apiClient) {
      void vscode.window.showWarningMessage("DryLake runner assignment planning requires the Xupra backend client.");
      return;
    }
    const apiClient = this.apiClient;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DryLake is planning runner assignments...",
        cancellable: false,
      },
      async () => {
        const selectedAgents = agents.map((agent) => ({ agentId: agent, label: agentLabel(agent) }));
        const result = await apiClient.planRunnerAssignments({
          taskPrompt: task,
          agents: selectedAgents,
        });
        const run = this.buildRun(task, agents, result.modelTier);
        const labels = new Map(selectedAgents.map((agent) => [agent.agentId, agent.label]));
        run.assignments = result.assignments
          .filter((assignment): assignment is typeof assignment & { agentId: XuPhaseAgent } =>
            (XU_PHASE_AGENTS as readonly string[]).includes(assignment.agentId)
          )
          .map((assignment) => ({
            agentId: assignment.agentId,
            agentLabel: labels.get(assignment.agentId) ?? phaseAgentLabel(assignment.agentId),
            subtaskSummary: assignment.subtaskSummary,
            scopeBoundary: assignment.scopeBoundary,
          }));
        run.conflictWarning = detectBoundaryConflict(run.assignments);
        run.agents = run.agents.map((agent) => {
          const assignment = run.assignments.find((item) => item.agentId === agent.id);
          return assignment
            ? {
                ...agent,
                assignmentSummary: assignment.subtaskSummary,
                assignmentBoundary: assignment.scopeBoundary,
              }
            : agent;
        });
        this.currentRun = run;
        await this.store().writeAssignmentPlan(this.assignmentPlan(run));
        await this.writeAuditLog(run);
      },
    );

    this.refresh();
  }

  private async replanAssignments() {
    if (!this.currentRun) {
      return;
    }

    await this.planAssignments(this.currentRun.taskPrompt, this.currentRun.agents.map((agent) => agent.id));
  }

  private async approveAssignments(assignmentsArg: unknown) {
    if (!this.currentRun || this.currentRun.status !== "assignment-review") {
      void vscode.window.showWarningMessage("No DryLake runner assignment plan is waiting for approval.");
      return;
    }

    const approvedAssignments = parseEditedAssignments(assignmentsArg, this.currentRun.assignments);
    const conflictWarning = detectBoundaryConflict(approvedAssignments);
    if (conflictWarning) {
      this.currentRun = { ...this.currentRun, assignments: approvedAssignments, conflictWarning };
      await this.store().writeAssignmentPlan(this.assignmentPlan(this.currentRun));
      await this.writeAuditLog(this.currentRun);
      this.refresh();
      void vscode.window.showWarningMessage(conflictWarning);
      return;
    }

    this.currentRun = {
      ...this.currentRun,
      assignments: approvedAssignments,
      assignmentApprovedAt: new Date().toISOString(),
      conflictWarning: null,
      agents: this.currentRun.agents.map((agent) => {
        const assignment = approvedAssignments.find((item) => item.agentId === agent.id);
        return assignment
          ? {
              ...agent,
              assignmentSummary: assignment.subtaskSummary,
              assignmentBoundary: assignment.scopeBoundary,
              message: "Assignment approved.",
            }
          : agent;
      }),
    };

    await this.store().writeAssignmentPlan(this.assignmentPlan(this.currentRun));
    await this.writeAuditLog(this.currentRun);
    await this.launchApprovedAssignments(this.currentRun);
  }

  private async launchApprovedAssignments(run: RunnerRun) {
    if (run.assignmentSource === "ai" && !run.assignmentApprovedAt) {
      void vscode.window.showWarningMessage("Approve the DryLake runner assignment plan before launch.");
      return;
    }

    const store = this.store();
    const root = workspaceRoot();
    const taskSlug = slugify(run.taskPrompt);
    const startedAt = new Date().toISOString();
    const runningRun: RunnerRun = {
      ...run,
      startedAt,
      status: "running",
      agents: run.agents.map((agent) => ({
        ...agent,
        status: "pending",
        startedAt: null,
        finishedAt: null,
        command: null,
        installError: null,
        message: "Queued.",
      })),
    };

    this.currentRun = runningRun;
    await this.writeAuditLog(runningRun);
    this.refresh();

    const results = await Promise.allSettled(runningRun.assignments.map(async (assignment) => {
      const content = this.promptContent(runningRun, assignment);
      const promptFile = await store.writeAgentPrompt(runningRun.id, assignment.agentId, content);
      const terminalName = `DryLake: ${assignment.agentLabel} — ${taskSlug}`;
      const launch = await launchAgentTask({
        agent: assignment.agentId,
        prompt: content,
        promptFile,
        workspaceUri: root,
        terminalName,
      });

      return {
        id: assignment.agentId,
        label: assignment.agentLabel,
        assignmentSummary: assignment.subtaskSummary,
        assignmentBoundary: assignment.scopeBoundary,
        status: launch.status === "launched" ? "running" as const : "failed" as const,
        startedAt: launch.status === "launched" ? new Date().toISOString() : null,
        finishedAt: null,
        command: launch.command ?? null,
        installError: launch.status === "launched" ? null : launch.message,
        message: launch.message,
        promptFile: promptFile.toString(),
        terminalName,
      };
    }));

    const agentResults = results.map((result, index): RunnerAgentResult => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      const assignment = runningRun.assignments[index];
      return {
        id: assignment.agentId,
        label: assignment.agentLabel,
        assignmentSummary: assignment.subtaskSummary,
        assignmentBoundary: assignment.scopeBoundary,
        status: "failed",
        startedAt: null,
        finishedAt: new Date().toISOString(),
        command: null,
        installError: result.reason instanceof Error ? result.reason.message : String(result.reason),
        message: result.reason instanceof Error ? result.reason.message : "DryLake could not launch this agent.",
      };
    });

    this.currentRun = {
      ...runningRun,
      agents: runningRun.agents.map((agent) => agentResults.find((result) => result.id === agent.id) ?? agent),
    };
    await this.writeAuditLog(this.currentRun);
    this.refresh();

    for (const result of agentResults) {
      if (result.installError) {
        void vscode.window.showWarningMessage(result.installError);
      }
    }
  }

  private async openPrompt(agentArg: unknown) {
    const agent = typeof agentArg === "string" ? agentArg : "";
    const result = this.currentRun?.agents.find((item) => item.id === agent);
    const terminal = result?.terminalName
      ? vscode.window.terminals.find((item) => item.name === result.terminalName)
      : undefined;
    if (terminal) {
      terminal.show(true);
      return;
    }

    if (!result?.promptFile) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(result.promptFile));
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private async rerunAgent(agentArg: unknown) {
    const agent = typeof agentArg === "string" && (XU_PHASE_AGENTS as readonly string[]).includes(agentArg)
      ? (agentArg as XuPhaseAgent)
      : undefined;
    if (!agent || !this.currentRun) {
      return;
    }

    await this.planAssignments(this.currentRun.taskPrompt, [agent]);
  }

  private renderHtml() {
    const run = this.currentRun;
    const body = !run || run.status === "idle"
      ? renderIdle(run)
      : run.status === "assignment-review"
        ? renderAssignmentReview(run)
        : run.status === "results"
          ? renderResults(run)
          : renderRun(run);

    const mode = run?.status === "assignment-review"
      ? "Assignment Review"
      : run?.status === "results"
        ? "Results"
        : run?.status === "running"
          ? "Run in Progress"
          : "Idle";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 12px; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    h1 { margin: 0; color: var(--vscode-foreground); font-size: 16px; }
    .mode-badge { padding: 2px 8px; border-radius: 3px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
    textarea { width: 100%; min-height: 96px; margin-bottom: 12px; padding: 9px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; resize: vertical; }
    button { padding: 6px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 3px; cursor: pointer; font-weight: 700; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .section-label { margin: 10px 0 8px; color: var(--vscode-descriptionForeground); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .agent-list { display: flex; flex-direction: column; gap: 7px; }
    .agent-row, .run-card, .last-run, .assignment-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-editor-background); }
    .assignment-card, .run-card { display: block; margin-bottom: 8px; }
    .agent-row.disabled { opacity: 0.58; }
    .agent-info { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .agent-info strong { display: block; color: var(--vscode-foreground); font-size: 12px; }
    .agent-info em, .last-run em { display: block; color: var(--vscode-descriptionForeground); font-size: 10px; font-style: normal; }
    .agent-icon { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-weight: 800; flex: 0 0 auto; }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); }
    .footer-actions { display: inline-flex; align-items: center; gap: 8px; }
    .run-card > .agent-info, .run-actions, .result-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .run-card p { margin: 8px 0 0; color: var(--vscode-descriptionForeground); line-height: 1.4; }
    .field-label { display: block; margin-top: 10px; color: var(--vscode-descriptionForeground); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .assignment-summary { margin-top: 6px; min-height: 76px; }
    .boundary { display: grid; gap: 4px; margin-top: 4px; color: var(--vscode-descriptionForeground); }
    .boundary strong { color: var(--vscode-foreground); font-weight: 700; }
    .warning { margin: 8px 0; padding: 8px; border: 1px solid var(--vscode-inputValidation-warningBorder); background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); border-radius: 4px; }
    .note { margin: 8px 0; color: var(--vscode-descriptionForeground); }
    .status-badge { padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 800; }
    .status-badge.running { background: #1a3a5c; color: #6fb0ff; }
    .status-badge.complete { background: #1b3f2a; color: #6ee08c; }
    .status-badge.failed { background: #4a1f1f; color: #ff8a8a; }
    .status-badge.pending { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .link-button { color: var(--vscode-textLink-foreground); background: transparent; padding: 2px 4px; text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <div class="panel-header">
      <h1>Multi-Agent Runner</h1>
      <span class="mode-badge">${escapeHtml(mode)}</span>
    </div>
    ${body}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    function selectedAgents() {
      return Array.from(document.querySelectorAll(".agent-row input[type='checkbox']:checked")).map((item) => item.value);
    }
    function editedAssignments() {
      return Array.from(document.querySelectorAll("[data-assignment-summary]")).map((item) => ({
        agentId: item.dataset.assignmentSummary,
        subtaskSummary: item.value || "",
      }));
    }
    function updateSelectedCount() {
      const count = selectedAgents().length;
      const target = document.getElementById("selectedCount");
      if (target) {
        target.textContent = count === 1 ? "1 agent selected" : count + " agents selected";
      }
      const run = document.getElementById("runAgents");
      if (run) {
        run.disabled = count === 0 || !(document.getElementById("runnerPrompt")?.value || "").trim();
      }
    }
    document.addEventListener("input", updateSelectedCount);
    document.addEventListener("change", updateSelectedCount);
    document.getElementById("runAgents")?.addEventListener("click", () => {
      vscode.postMessage({ command: "run", prompt: document.getElementById("runnerPrompt")?.value || "", agents: selectedAgents() });
    });
    document.getElementById("replanAssignments")?.addEventListener("click", () => {
      vscode.postMessage({ command: "replan" });
    });
    document.getElementById("approveAssignments")?.addEventListener("click", () => {
      vscode.postMessage({ command: "approve", assignments: editedAssignments() });
    });
    document.getElementById("showResults")?.addEventListener("click", () => {
      vscode.postMessage({ command: "showResults" });
    });
    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-open-agent]");
      if (open) {
        vscode.postMessage({ command: "openPrompt", agent: open.dataset.openAgent });
        return;
      }
      const rerun = event.target.closest("[data-rerun-agent]");
      if (rerun) {
        vscode.postMessage({ command: "rerun", agent: rerun.dataset.rerunAgent });
      }
    });
    updateSelectedCount();
  </script>
</body>
</html>`;
  }
}
