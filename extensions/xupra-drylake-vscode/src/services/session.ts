import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
import { StateStore } from "./stateStore";

async function promptForAccessToken(apiClient: ApiClient) {
  const openConnectPage = "Open Connect Page";
  const pasteToken = "Paste Token";
  const selection = await vscode.window.showInformationMessage(
    "Sign in on the Xupra website first, then generate an extension token.",
    openConnectPage,
    pasteToken,
  );

  if (selection === openConnectPage) {
    await vscode.env.openExternal(apiClient.openWebUrl("/extensions/connect"));
  }

  if (selection !== pasteToken) {
    return null;
  }

  return vscode.window.showInputBox({
    title: "Xupra DryLake Extension Token",
    prompt: "Paste the extension token from the Xupra website.",
    ignoreFocusOut: true,
    password: true,
    validateInput(value) {
      return value.trim().length > 20 ? null : "Paste the full token from the website.";
    },
  });
}

export async function connectSession(
  apiClient: ApiClient,
  configuration: vscode.WorkspaceConfiguration,
  stateStore: StateStore,
) {
  const storedToken = await stateStore.getAccessToken();

  if (storedToken) {
    apiClient.setAccessToken(storedToken);
    const authSession = await apiClient.getAuthSession().catch(() => null);

    if (authSession?.auth.session.status === "active") {
      return apiClient.connect(undefined, undefined, storedToken);
    }

    apiClient.setAccessToken(undefined);
    await stateStore.clearAccessToken();
  }

  const authSession = await apiClient.getAuthSession();

  if (authSession.auth.session.status === "active") {
    return apiClient.connect();
  }

  const accessToken = await promptForAccessToken(apiClient);

  if (accessToken) {
    const trimmedToken = accessToken.trim();
    apiClient.setAccessToken(trimmedToken);
    const result = await apiClient.connect(undefined, undefined, trimmedToken);
    await stateStore.setAccessToken(trimmedToken);
    return result;
  }

  if (authSession.auth.mode !== "dev") {
    throw new Error("Generate an extension token from the website before connecting this editor.");
  }

  const email = String(configuration.get("devEmail", "owner@xupra.local"));
  const displayName = String(configuration.get("devDisplayName", "Xupra Owner"));

  return apiClient.connect(email, displayName);
}
