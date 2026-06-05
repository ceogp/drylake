import { createHash } from "node:crypto";

import * as vscode from "vscode";

import type { ApiClient, ExtensionUsageEventPayload } from "./apiClient";
import { getLogger } from "../utils/logging";

type UsageEventClient = Pick<ApiClient, "recordUsageEvent">;

function currentWorkspaceHash() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    ?? vscode.workspace.workspaceFolders?.[0]?.uri.path
    ?? "";

  if (!root) {
    return undefined;
  }

  return createHash("sha256")
    .update(root.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

function compactPayload(payload: ExtensionUsageEventPayload): ExtensionUsageEventPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as ExtensionUsageEventPayload;
}

export async function recordExtensionUsageEvent(
  apiClient: UsageEventClient,
  payload: ExtensionUsageEventPayload,
) {
  const event = compactPayload({
    workspaceHash: currentWorkspaceHash(),
    ...payload,
  });

  try {
    await apiClient.recordUsageEvent(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    getLogger().error(`Failed to record DryLake usage event ${payload.eventName}: ${message}`);
  }
}
