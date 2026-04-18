import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type EntitlementKey =
  | "manual_export"
  | "deployment_jobs"
  | "credential_vault"
  | "slack_controls"
  | "advanced_reporting";

export type EntitlementMap = Record<EntitlementKey, boolean>;

const DEFAULT_ENTITLEMENTS: Record<string, EntitlementMap> = {
  free: {
    manual_export: true,
    deployment_jobs: false,
    credential_vault: false,
    slack_controls: false,
    advanced_reporting: false,
  },
  pro: {
    manual_export: true,
    deployment_jobs: true,
    credential_vault: true,
    slack_controls: true,
    advanced_reporting: false,
  },
  enterprise: {
    manual_export: true,
    deployment_jobs: true,
    credential_vault: true,
    slack_controls: true,
    advanced_reporting: true,
  },
};

function defaultEntitlementsForTier(tier: string) {
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
