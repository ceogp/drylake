import * as vscode from "vscode";

import type { ApiClient } from "../services/apiClient";
import type { StateStore } from "../services/stateStore";

export async function signOutCommand(apiClient: ApiClient, stateStore: StateStore) {
  const hadSession = Boolean(await stateStore.getAccessToken()) || Boolean(stateStore.getConnection().userEmail);

  if (hadSession) {
    const choice = await vscode.window.showWarningMessage(
      "Sign out of Xupra DryLake in this editor?",
      { modal: true },
      "Sign Out",
    );

    if (choice !== "Sign Out") {
      return false;
    }
  }

  apiClient.setAccessToken(undefined);
  await stateStore.clearAccessToken();
  await stateStore.clearConnection();
  await stateStore.clearPlanningSessionState();

  void vscode.window.showInformationMessage(
    hadSession ? "Signed out of Xupra DryLake." : "Xupra DryLake is already signed out.",
  );

  return true;
}
