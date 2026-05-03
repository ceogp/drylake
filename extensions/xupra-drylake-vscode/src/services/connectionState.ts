import type { ExtensionConnection } from "../types/api";
import type { ConnectionState, EntitlementMap } from "../types/package";

const DEFAULT_ENTITLEMENTS: EntitlementMap = {
  manual_export: false,
  deployment_jobs: false,
  credential_vault: false,
  slack_controls: false,
  advanced_reporting: false,
};

export function normalizeEntitlements(value: unknown): EntitlementMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ENTITLEMENTS };
  }

  const entitlements: EntitlementMap = { ...DEFAULT_ENTITLEMENTS };

  for (const [key, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean") {
      entitlements[key] = enabled;
    }
  }

  return entitlements;
}

export function connectionStateFromExtensionConnection(result: ExtensionConnection): ConnectionState {
  return {
    organizationId: result.organization?.id ?? result.auth.session.organizationId ?? undefined,
    organizationName: result.organization?.name,
    organizationSlug: result.organization?.slug,
    organizationTier: result.organization?.tier ?? "free",
    entitlements: normalizeEntitlements(result.entitlements),
    subscriptionStatus: result.subscription?.status,
    userEmail: result.user?.email ?? undefined,
    userAvatarUrl: result.user?.imageUrl ?? result.auth.session.user?.imageUrl ?? undefined,
    authMode: result.auth.mode,
  };
}

export function connectionHasEntitlement(connection: ConnectionState, key: string) {
  return Boolean(connection.entitlements?.[key]);
}
