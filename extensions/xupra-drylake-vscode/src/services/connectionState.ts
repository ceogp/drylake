import type { ExtensionConnection } from "../types/api";
import type { ConnectionState, EntitlementKey, EntitlementMap } from "../types/package";

const DEFAULT_ENTITLEMENTS: EntitlementMap = {
  canUseHostedPlanning: false,
  canUseFixWithAI: false,
  canUseApprovedUpload: false,
  canUseDeepCloudAnalysis: false,
  canUseSuspiciousArtifactScan: true,
  canUseLocalWatchdog: false,
  canCreateTeam: false,
  canUseTeamBaseline: false,
  canUseContinuousWatch: false,
  canManageTeamPolicy: false,
  xupra_pro_ai: false,
  session_cloud_sync: false,
  pr_summary_generation: false,
};

const ENTITLEMENT_KEYS: EntitlementKey[] = [
  "canUseHostedPlanning",
  "canUseFixWithAI",
  "canUseApprovedUpload",
  "canUseDeepCloudAnalysis",
  "canUseSuspiciousArtifactScan",
  "canUseLocalWatchdog",
  "canCreateTeam",
  "canUseTeamBaseline",
  "canUseContinuousWatch",
  "canManageTeamPolicy",
  "xupra_pro_ai",
  "session_cloud_sync",
  "pr_summary_generation",
];

export function normalizeEntitlements(value: unknown): EntitlementMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ENTITLEMENTS };
  }

  const entitlements: EntitlementMap = { ...DEFAULT_ENTITLEMENTS };
  const raw = value as Record<string, unknown>;

  for (const key of ENTITLEMENT_KEYS) {
    const enabled = raw[key];
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
    organizationRole: result.organizationRole,
    plan: result.plan ?? result.organization?.tier ?? "free",
    entitlementVersion: result.entitlementVersion,
    entitlements: normalizeEntitlements(result.entitlements),
    subscriptionStatus: result.subscription?.status,
    userEmail: result.user?.email ?? undefined,
    userAvatarUrl: result.user?.imageUrl ?? result.auth.session.user?.imageUrl ?? undefined,
    authMode: result.auth.mode,
  };
}

export function connectionHasEntitlement(connection: ConnectionState, key: EntitlementKey) {
  return Boolean(connection.entitlements?.[key]);
}
