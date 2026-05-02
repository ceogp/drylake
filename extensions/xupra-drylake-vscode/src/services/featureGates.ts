import * as vscode from "vscode";

import { connectionHasEntitlement } from "./connectionState";
import { ApiClient } from "./apiClient";
import { StateStore } from "./stateStore";

const UPGRADE_ACTION = "Upgrade to Pro";

export function hasManualExportEntitlement(stateStore: StateStore) {
  return connectionHasEntitlement(stateStore.getConnection(), "manual_export");
}

export async function promptForUpgrade(apiClient: ApiClient, message: string, stateStore: StateStore) {
  const selected = await vscode.window.showWarningMessage(message, UPGRADE_ACTION);

  if (selected === UPGRADE_ACTION) {
    await vscode.env.openExternal(apiClient.openWebUrl("/billing"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 120_000).toISOString());
  }
}

export async function requireManualExportEntitlement(
  apiClient: ApiClient,
  stateStore: StateStore,
  featureLabel: string,
) {
  if (hasManualExportEntitlement(stateStore)) {
    return true;
  }

  await promptForUpgrade(apiClient, `${featureLabel} requires a Pro plan. Upgrade to unlock.`, stateStore);
  return false;
}
