import * as vscode from "vscode";

import { buildApprovalRecord, type ApprovalType } from "./approvalState";
import { createStarterXu } from "./createStarterXu";
import type { PendingPlanChangeSet } from "./pendingPlanChanges";
import { parseXu } from "./parseXu";
import { renderXu } from "./renderXu";
import type { ApplicationBuildRunbook, BuildSessionState, XuMode } from "./types";

const RUNBOOK_CANDIDATES = ["drylake.xu", ".xupra/app.xu", ".drylake/app.xu"] as const;

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function workspaceRoot() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("Open a workspace folder before starting a DryLake build session.");
  }

  return root;
}

async function exists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
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

export class XuSessionStore {
  async findRunbookUri(): Promise<vscode.Uri | null> {
    const root = workspaceRoot();

    for (const candidate of RUNBOOK_CANDIDATES) {
      const uri = vscode.Uri.joinPath(root, ...candidate.split("/"));
      if (await exists(uri)) {
        return uri;
      }
    }

    return null;
  }

  getDefaultRunbookUri() {
    return vscode.Uri.joinPath(workspaceRoot(), "drylake.xu");
  }

  async readRunbook(): Promise<{ uri: vscode.Uri; runbook: ApplicationBuildRunbook } | null> {
    const uri = await this.findRunbookUri();
    if (!uri) {
      return null;
    }

    const parsed = parseXu(await readUtf8(uri));
    if (!parsed.runbook) {
      throw new Error(parsed.validation.diagnostics.map((item) => item.message).join("\n"));
    }

    return { uri, runbook: parsed.runbook };
  }

  async writeRunbook(uri: vscode.Uri, runbook: ApplicationBuildRunbook) {
    await writeUtf8(uri, renderXu(runbook));
  }

  async ensureRunbook(params: { prompt: string; mode: XuMode; name?: string }) {
    const existing = await this.readRunbook();
    if (existing) {
      return existing;
    }

    const uri = this.getDefaultRunbookUri();
    const runbook = createStarterXu(params);
    await this.writeRunbook(uri, runbook);
    return { uri, runbook };
  }

  async createSession(params: {
    prompt: string;
    mode: XuMode;
    runbookPath: string;
    providerId: BuildSessionState["providerId"];
    providerLabel: BuildSessionState["providerLabel"];
  }) {
    const id = timestampId();
    const session: BuildSessionState = {
      id,
      mode: params.mode,
      prompt: params.prompt,
      createdAt: new Date().toISOString(),
      runbookPath: params.runbookPath,
      providerId: params.providerId,
      providerLabel: params.providerLabel,
    };
    const uri = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "sessions", id, "session.json");
    await writeUtf8(uri, `${JSON.stringify(session, null, 2)}\n`);
    return session;
  }

  async writeApproval(type: ApprovalType, runbook: ApplicationBuildRunbook) {
    const record = buildApprovalRecord({ type, runbook });
    const uri = vscode.Uri.joinPath(
      workspaceRoot(),
      ".drylake",
      "approvals",
      `${timestampId(new Date(record.approvedAt))}-${type}.json`,
    );
    await writeUtf8(uri, `${JSON.stringify(record, null, 2)}\n`);
    return record;
  }

  async readPendingPlanChange(): Promise<PendingPlanChangeSet | null> {
    const uri = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "pending-plan-changes", "current.json");
    let text = "";

    try {
      text = await readUtf8(uri);
    } catch {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as Partial<PendingPlanChangeSet>;
      if (
        parsed.status !== "pending" ||
        typeof parsed.id !== "string" ||
        typeof parsed.sourceChatMessageId !== "string" ||
        typeof parsed.createdAt !== "string" ||
        typeof parsed.baseRunbookPath !== "string" ||
        !parsed.proposedRunbook ||
        !Array.isArray(parsed.affectedPhaseIds)
      ) {
        return null;
      }

      return {
        id: parsed.id,
        sourceChatMessageId: parsed.sourceChatMessageId,
        createdAt: parsed.createdAt,
        baseRunbookPath: parsed.baseRunbookPath,
        proposedRunbook: parsed.proposedRunbook,
        affectedPhaseIds: parsed.affectedPhaseIds.filter((item): item is string => typeof item === "string"),
        phaseSummaries: parsed.phaseSummaries ?? {},
        phaseResolutions: parsed.phaseResolutions ?? {},
        status: parsed.status,
      };
    } catch {
      return null;
    }
  }

  async writePendingPlanChange(record: PendingPlanChangeSet) {
    const uri = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "pending-plan-changes", "current.json");
    await writeUtf8(uri, `${JSON.stringify(record, null, 2)}\n`);
  }

  async clearPendingPlanChange() {
    const uri = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "pending-plan-changes", "current.json");
    try {
      await vscode.workspace.fs.delete(uri);
    } catch {
      // Nothing to clear.
    }
  }

  async archiveCurrentRunbook() {
    const current = await this.readRunbook();
    if (!current) {
      return null;
    }

    const id = timestampId();
    const folder = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "sessions", id);
    await vscode.workspace.fs.createDirectory(folder);
    const archivedRunbookUri = vscode.Uri.joinPath(folder, "drylake.xu");
    await writeUtf8(archivedRunbookUri, renderXu(current.runbook));
    await writeUtf8(vscode.Uri.joinPath(folder, "archive.json"), `${JSON.stringify({
      id,
      archivedAt: new Date().toISOString(),
      name: current.runbook.metadata.name,
      sourcePath: vscode.workspace.asRelativePath(current.uri, false).replace(/\\/g, "/"),
    }, null, 2)}\n`);
    await vscode.workspace.fs.delete(current.uri);

    return { id, uri: archivedRunbookUri, runbook: current.runbook };
  }

  async deleteCurrentPlan() {
    const uri = await this.findRunbookUri();
    if (!uri) {
      return false;
    }

    await vscode.workspace.fs.delete(uri, { useTrash: false });
    await this.clearPendingPlanChanges();
    return true;
  }

  async clearPendingPlanChanges() {
    const folder = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "pending-plan-changes");
    try {
      await vscode.workspace.fs.delete(folder, { recursive: true, useTrash: false });
    } catch {
      // No pending plan changes is already the desired reset state.
    }
  }

  async listArchivedSessions() {
    const folder = vscode.Uri.joinPath(workspaceRoot(), ".drylake", "sessions");
    let entries: [string, vscode.FileType][] = [];

    try {
      entries = await vscode.workspace.fs.readDirectory(folder);
    } catch {
      return [];
    }

    const sessions: Array<{ id: string; name: string; uri: vscode.Uri; archivedAt?: string }> = [];
    for (const [id, type] of entries) {
      if (type !== vscode.FileType.Directory) {
        continue;
      }

      const sessionFolder = vscode.Uri.joinPath(folder, id);
      const runbookUri = vscode.Uri.joinPath(sessionFolder, "drylake.xu");
      let name = id;
      let archivedAt: string | undefined;

      try {
        const metadata = JSON.parse(await readUtf8(vscode.Uri.joinPath(sessionFolder, "archive.json"))) as {
          name?: unknown;
          archivedAt?: unknown;
        };
        name = typeof metadata.name === "string" && metadata.name.trim() ? metadata.name : id;
        archivedAt = typeof metadata.archivedAt === "string" ? metadata.archivedAt : undefined;
      } catch {
        try {
          const parsed = parseXu(await readUtf8(runbookUri));
          name = parsed.runbook?.metadata.name ?? id;
        } catch {
          name = id;
        }
      }

      sessions.push({ id, name, uri: runbookUri, archivedAt });
    }

    return sessions.sort((left, right) => right.id.localeCompare(left.id));
  }
}
