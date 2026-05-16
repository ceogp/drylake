import * as vscode from "vscode";

import { connectionHasEntitlement } from "./connectionState";
import { ApiClient } from "./apiClient";
import { StateStore } from "./stateStore";

const UPGRADE_ACTION = "Upgrade to Pro";

export function hasXupraProAiEntitlement(stateStore: StateStore) {
  return connectionHasEntitlement(stateStore.getConnection(), "xupra_pro_ai");
}

export async function promptForUpgrade(apiClient: ApiClient, message: string, stateStore: StateStore) {
  const selected = await vscode.window.showWarningMessage(message, UPGRADE_ACTION);

  if (selected === UPGRADE_ACTION) {
    await vscode.env.openExternal(apiClient.openWebUrl("/billing?source=extension"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 120_000).toISOString());
  }
}

export async function requireXupraProAiEntitlement(
  apiClient: ApiClient,
  stateStore: StateStore,
  featureLabel: string,
) {
  if (hasXupraProAiEntitlement(stateStore)) {
    return true;
  }

  await promptForUpgrade(apiClient, `${featureLabel} requires a Pro plan. Upgrade to unlock.`, stateStore);
  return false;
}
