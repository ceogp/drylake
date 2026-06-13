import * as vscode from "vscode";

import type { ApiClient } from "./apiClient";
import type { StateStore } from "./stateStore";
import type { ConnectionState, EntitlementKey, EntitlementMap } from "../types/package";
import type { ExtensionConnection } from "../types/api";

export const REGISTRATION_REQUIRED_MESSAGE = "You must register as a free user to use DryLake.";

const ENTITLEMENT_KEYS: EntitlementKey[] = [
  "xupra_pro_ai",
  "session_cloud_sync",
  "pr_summary_generation",
];

function connectionStateFromExtensionConnection(result: ExtensionConnection): ConnectionState {
  const entitlements = ENTITLEMENT_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(result.entitlements?.[key]);
    return acc;
  }, {} as EntitlementMap);

  return {
    organizationId: result.organization?.id ?? result.auth.session.organizationId ?? undefined,
    organizationName: result.organization?.name,
    organizationSlug: result.organization?.slug,
    organizationTier: result.organization?.tier,
    organizationRole: result.organizationRole,
    entitlements,
    subscriptionStatus: result.subscription?.status,
    userEmail: result.user?.email ?? result.auth.session.user?.email,
    userAvatarUrl: result.user?.imageUrl ?? result.auth.session.user?.imageUrl ?? null,
    authMode: result.auth.mode,
  };
}

async function clearStaleRegistration(stateStore: StateStore, apiClient?: ApiClient) {
  apiClient?.setAccessToken(undefined);
  await stateStore.clearAccessToken();
  await stateStore.clearConnection();
}

export async function hasRegisteredUser(stateStore: StateStore, apiClient?: ApiClient): Promise<boolean> {
  let token: string | undefined;

  try {
    token = await stateStore.getAccessToken();
  } catch {
    token = undefined;
  }

  if (!token) {
    return false;
  }

  if (!apiClient) {
    return false;
  }

  try {
    apiClient.setAccessToken(token);
    const result = await apiClient.connect(undefined, undefined, token);
    const connection = connectionStateFromExtensionConnection(result);
    if (!connection.userEmail) {
      await clearStaleRegistration(stateStore, apiClient);
      return false;
    }

    await stateStore.setConnection(connection);
    return true;
  } catch {
    await clearStaleRegistration(stateStore, apiClient);
    return false;
  }
}

export async function requireRegisteredUser(stateStore: StateStore, apiClient?: ApiClient): Promise<boolean> {
  if (await hasRegisteredUser(stateStore, apiClient)) {
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

  return hasRegisteredUser(stateStore, apiClient);
}
