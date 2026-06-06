import * as vscode from "vscode";

import type { StateStore } from "./stateStore";

export const REGISTRATION_REQUIRED_MESSAGE = "You must register as a free user to use DryLake.";

export async function hasRegisteredUser(stateStore: StateStore): Promise<boolean> {
  const connection = stateStore.getConnection();
  if (connection.userEmail) {
    return true;
  }

  try {
    return Boolean(await stateStore.getAccessToken());
  } catch {
    return false;
  }
}

export async function requireRegisteredUser(stateStore: StateStore): Promise<boolean> {
  if (await hasRegisteredUser(stateStore)) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    REGISTRATION_REQUIRED_MESSAGE,
    { modal: true },
    "Register Free",
  );

  if (choice === "Register Free") {
    await vscode.commands.executeCommand("xupra.connect");
  }

  return hasRegisteredUser(stateStore);
}
