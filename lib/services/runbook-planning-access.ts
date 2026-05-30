import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export type RunbookPlanningAccess = {
  tier: "foundation" | "nano";
  model: string;
};

export async function resolveRunbookPlanningAccess(organizationId: string): Promise<RunbookPlanningAccess> {
  const [{ entitlements, subscription }, organization] = await Promise.all([
    getEntitlementsForOrganization(organizationId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { tier: true },
    }),
  ]);

  const entitlementAccess = Boolean(entitlements.xupra_pro_ai);
  const subscriptionTier = String(subscription?.tier ?? "").toLowerCase();
  const organizationTier = String(organization?.tier ?? "").toLowerCase();
  const tierFallbackAccess =
    subscriptionTier === "pro" ||
    subscriptionTier === "enterprise" ||
    organizationTier === "pro" ||
    organizationTier === "enterprise";

  if (!entitlementAccess && tierFallbackAccess) {
    console.warn("[runbook-planning-access] enabling foundation model via paid-tier fallback", {
      organizationId,
      subscriptionTier: subscription?.tier ?? null,
      organizationTier: organization?.tier ?? null,
    });
  }

  return entitlementAccess || tierFallbackAccess
    ? { tier: "foundation", model: env.OPENAI_MODEL }
    : { tier: "nano", model: env.OPENAI_FREE_MODEL };
}
