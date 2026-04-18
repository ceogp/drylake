import * as vscode from "vscode";

import { ApiClient } from "./apiClient";

export async function connectSession(apiClient: ApiClient, configuration: vscode.WorkspaceConfiguration) {
  const authSession = await apiClient.getAuthSession();

  if (authSession.auth.session.status === "active") {
    return apiClient.connect();
  }

  const email = String(configuration.get("devEmail", "owner@xupra.local"));
  const displayName = String(configuration.get("devDisplayName", "Xupra Owner"));

  return apiClient.connect(email, displayName);
}
