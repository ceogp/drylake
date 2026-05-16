import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type EntitlementKey =
  | "xupra_pro_ai"
  | "session_cloud_sync"
  | "pr_summary_generation";

export type EntitlementMap = Record<EntitlementKey, boolean>;

const DEFAULT_ENTITLEMENTS: Record<string, EntitlementMap> = {
  free: {
    xupra_pro_ai: false,
    session_cloud_sync: false,
    pr_summary_generation: false,
  },
  pro: {
    xupra_pro_ai: true,
    session_cloud_sync: true,
    pr_summary_generation: true,
  },
};

function defaultEntitlementsForTier(tier: string) {
  if (tier === "enterprise") {
    return DEFAULT_ENTITLEMENTS.pro;
  }

  return DEFAULT_ENTITLEMENTS[tier] ?? DEFAULT_ENTITLEMENTS.free;
}

export async function getOrganizationSubscription(organizationId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId },
  });
}

export async function getEntitlementsForOrganization(organizationId: string) {
  const subscription = await getOrganizationSubscription(organizationId);

  const base = defaultEntitlementsForTier(subscription?.tier ?? "free");
  const overrides = ((subscription?.entitlementsJson as Partial<EntitlementMap> | null) ?? {});

  return {
    subscription,
    entitlements: {
      ...base,
      ...overrides,
    } satisfies EntitlementMap,
  };
}

export async function hasEntitlement(organizationId: string, key: EntitlementKey) {
  if (env.BILLING_ENFORCEMENT_MODE === "development") {
    return true;
  }

  const { entitlements } = await getEntitlementsForOrganization(organizationId);
  return Boolean(entitlements[key]);
}

export async function assertEntitlement(organizationId: string, key: EntitlementKey) {
  const allowed = await hasEntitlement(organizationId, key);

  if (!allowed) {
    throw new Error(`Organization is not entitled to use ${key}`);
  }
}
