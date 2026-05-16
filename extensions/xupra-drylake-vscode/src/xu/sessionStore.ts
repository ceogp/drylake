import * as vscode from "vscode";

import { buildApprovalRecord, type ApprovalType } from "./approvalState";
import { createStarterXu } from "./createStarterXu";
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
}
