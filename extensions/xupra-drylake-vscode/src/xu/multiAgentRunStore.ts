import * as vscode from "vscode";

import type {
  AgentRunEntry,
  MultiAgentAssignment,
  MultiAgentAssignmentPlan,
  MultiAgentAssignmentSource,
  MultiAgentRun,
} from "../types/multiAgentRun";
import type { XuPhaseAgent } from "./types";

function workspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake multi-agent run.");
  }

  return root;
}

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
}

async function readUtf8(uri: vscode.Uri) {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder("utf-8").decode(bytes);
}

async function writeUtf8(uri: vscode.Uri, content: string) {
  const directoryPath = uri.path.includes("/") ? uri.path.slice(0, uri.path.lastIndexOf("/")) : uri.path;
  const directory = uri.with({ path: directoryPath || "/" });
  await vscode.workspace.fs.createDirectory(directory);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

function parseJsonObject<T>(content: string, label: string): T {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as T;
}

export class MultiAgentRunStore {
  createRunId(taskPrompt: string, date = new Date()) {
    return `${timestampId(date)}-${slugify(taskPrompt)}`;
  }

  getRunFolder(runId: string) {
    return vscode.Uri.joinPath(workspaceRoot(), ".drylake", "runs", runId);
  }

  getTaskSlug(taskPrompt: string) {
    return slugify(taskPrompt);
  }

  async readRun(runId: string) {
    const uri = vscode.Uri.joinPath(this.getRunFolder(runId), "run.json");
    return parseJsonObject<MultiAgentRun>(await readUtf8(uri), "run.json");
  }

  async writeRun(run: MultiAgentRun) {
    const uri = vscode.Uri.joinPath(this.getRunFolder(run.id), "run.json");
    await writeUtf8(uri, `${JSON.stringify(run, null, 2)}\n`);
  }

  async readAssignmentPlan(runId: string) {
    const uri = vscode.Uri.joinPath(this.getRunFolder(runId), "assignment-plan.json");
    return parseJsonObject<MultiAgentAssignmentPlan>(await readUtf8(uri), "assignment-plan.json");
  }

  async writeAssignmentPlan(plan: MultiAgentAssignmentPlan) {
    const uri = vscode.Uri.joinPath(this.getRunFolder(plan.runId), "assignment-plan.json");
    await writeUtf8(uri, `${JSON.stringify(plan, null, 2)}\n`);
  }

  async writeAgentPrompt(runId: string, agentId: XuPhaseAgent, content: string) {
    const uri = vscode.Uri.joinPath(this.getRunFolder(runId), agentId, "prompt.md");
    await writeUtf8(uri, content);
    return uri;
  }

  buildRun(params: {
    id: string;
    taskPrompt: string;
    assignmentSource: MultiAgentAssignmentSource;
    assignmentApprovedAt: string | null;
    assignments: MultiAgentAssignment[];
    createdAt?: string;
  }): MultiAgentRun {
    return {
      id: params.id,
      status: "pending",
      taskPrompt: params.taskPrompt,
      assignmentSource: params.assignmentSource,
      assignmentApprovedAt: params.assignmentApprovedAt,
      createdAt: params.createdAt ?? new Date().toISOString(),
      agents: params.assignments.map<AgentRunEntry>((assignment) => ({
        id: assignment.agentId,
        label: assignment.label,
        assignmentSummary: assignment.assignmentSummary,
        assignmentBoundary: assignment.assignmentBoundary,
        status: "pending",
        startedAt: null,
        finishedAt: null,
        reviewedAt: null,
        command: null,
        installError: null,
        terminalName: null,
        promptFile: null,
        handoffProfile: assignment.handoffProfile ?? null,
      })),
    };
  }
}
