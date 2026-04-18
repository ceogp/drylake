import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { connectSession } from "../services/session";
import { StateStore } from "../services/stateStore";

export async function connectCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore
) {
  const result = await connectSession(apiClient, configuration);
  await stateStore.setConnection({
    organizationId: result.organization?.id ?? result.auth.session.organizationId ?? undefined,
    organizationSlug: result.organization?.slug,
    userEmail: result.user?.email ?? undefined,
    authMode: result.auth.mode
  });

  if (!result.auth.configured) {
    void vscode.window.showWarningMessage(
      `Xupra DryLake auth is set to ${result.auth.mode}, but it still needs ${result.auth.pendingKeys.join(", ")}.`
    );
    return;
  }

  void vscode.window.showInformationMessage(
    `Connected to Xupra DryLake as ${result.user?.email ?? "pending auth"} in ${result.organization?.slug ?? "current workspace"}.`
  );
}
