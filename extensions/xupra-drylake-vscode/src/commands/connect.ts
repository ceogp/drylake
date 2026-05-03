import * as vscode from "vscode";

import { ApiClient } from "../services/apiClient";
import { BrowserConnectCoordinator } from "../services/browserConnect";
import { connectionStateFromExtensionConnection } from "../services/connectionState";
import { connectSession } from "../services/session";
import { StateStore } from "../services/stateStore";

export async function connectCommand(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore,
  browserConnect: BrowserConnectCoordinator,
) {
  try {
    const result = await connectSession(apiClient, configuration, stateStore, browserConnect);
    const connection = connectionStateFromExtensionConnection(result);
    await stateStore.setConnection(connection);
    await stateStore.clearLastImport();

    if (!result.auth.configured) {
      void vscode.window.showWarningMessage(
        `Xupra DryLake auth is set to ${result.auth.mode}, but it still needs ${result.auth.pendingKeys.join(", ")}.`
      );
      return;
    }

    return true;
  } catch (error) {
    void vscode.window.showErrorMessage(
      error instanceof Error ? error.message : "Failed to connect to Xupra DryLake."
    );
    return false;
  }
}
