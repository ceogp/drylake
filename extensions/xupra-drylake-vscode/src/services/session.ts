import * as vscode from "vscode";

import { ApiClient } from "./apiClient";
import { BrowserConnectCoordinator } from "./browserConnect";
import { StateStore } from "./stateStore";
import { getLogger } from "../utils/logging";

const logger = getLogger();

async function promptForAccessToken(apiClient: ApiClient) {
  const openConnectPage = "Open Connect Page";
  const pasteToken = "Paste Token";
  const selection = await vscode.window.showInformationMessage(
    "If the browser handoff does not work, open the connect page and use the manual token fallback.",
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
  browserConnect: BrowserConnectCoordinator,
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

  const browserResult = await browserConnect.start();

  if (browserResult?.kind === "success") {
    logger.info("Browser connect exchange_started");
    const exchanged = await apiClient.exchangeBrowserConnectCode(browserResult.code).catch((error) => {
      logger.error(
        `Browser connect exchange_failed ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    });
    apiClient.setAccessToken(exchanged.token.token);
    await stateStore.setAccessToken(exchanged.token.token);
    logger.info(
      `Browser connect exchange_succeeded ${JSON.stringify({
        organizationId: exchanged.organization.id,
        editor: exchanged.editor,
      })}`,
    );
    const result = await apiClient.connect(undefined, undefined, exchanged.token.token);
    return result;
  }

  if (browserResult?.kind === "error") {
    void vscode.window.showWarningMessage(browserResult.message);
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
    throw new Error("The browser sign-in did not complete. Use the manual token fallback if needed.");
  }

  const email = String(configuration.get("devEmail", "owner@xupra.local"));
  const displayName = String(configuration.get("devDisplayName", "Xupra Owner"));

  return apiClient.connect(email, displayName);
}
