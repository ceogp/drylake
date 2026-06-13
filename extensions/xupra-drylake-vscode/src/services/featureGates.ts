import * as vscode from "vscode";

import { connectionHasEntitlement } from "./connectionState";
import { ApiClient } from "./apiClient";
import { StateStore } from "./stateStore";

const UPGRADE_ACTION = "Upgrade to Pro";
const SECURITY_UPGRADE_ACTION = "Upgrade to Security Pro";

type BillingOpenPlan = "pro" | "security_pro" | "team_security" | "enterprise";

function buildBillingPath(apiClient: ApiClient, plan?: BillingOpenPlan, returnPath = "/app") {
  const params = new URLSearchParams({
    source: "extension",
    ...(plan ? { required: plan } : {}),
    returnPath,
  });

  return apiClient.openWebUrl(`/billing?${params.toString()}`);
}

export function hasXupraProAiEntitlement(stateStore: StateStore) {
  const connection = stateStore.getConnection();
  return connectionHasEntitlement(connection, "canUseHostedPlanning") ||
    connectionHasEntitlement(connection, "xupra_pro_ai");
}

export function hasGuardFixWithAiEntitlement(stateStore: StateStore) {
  return connectionHasEntitlement(stateStore.getConnection(), "canUseFixWithAI");
}

export async function promptForUpgrade(apiClient: ApiClient, message: string, stateStore: StateStore) {
  const selected = await vscode.window.showWarningMessage(message, UPGRADE_ACTION);

  if (selected === UPGRADE_ACTION) {
    await vscode.env.openExternal(buildBillingPath(apiClient, "pro"));
    await stateStore.setAwaitingPlanRefreshUntil(new Date(Date.now() + 120_000).toISOString());
  }
}

export async function promptForSecurityUpgrade(apiClient: ApiClient, message: string, stateStore: StateStore) {
  const selected = await vscode.window.showWarningMessage(message, SECURITY_UPGRADE_ACTION);

  if (selected === SECURITY_UPGRADE_ACTION) {
    await vscode.env.openExternal(buildBillingPath(apiClient, "security_pro"));
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

export async function requireGuardFixWithAiEntitlement(
  apiClient: ApiClient,
  stateStore: StateStore,
) {
  if (hasGuardFixWithAiEntitlement(stateStore)) {
    return true;
  }

  await promptForSecurityUpgrade(
    apiClient,
    "Fix with AI requires Security Pro. Upgrade to unlock remediation planning.",
    stateStore,
  );
  return false;
}
