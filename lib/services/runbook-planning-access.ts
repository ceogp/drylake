import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { resolvePlanningModels } from "@/lib/services/planning-models";

export type RunbookPlanningAccess = {
  tier: "foundation" | "nano";
  model: string;
};

export async function resolveRunbookPlanningAccess(organizationId: string): Promise<RunbookPlanningAccess> {
  const models = resolvePlanningModels();
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

  const access: RunbookPlanningAccess = entitlementAccess || tierFallbackAccess
    ? { tier: "foundation", model: models.foundation.model }
    : { tier: "nano", model: models.nano.model };

  const selectedModelMeta = access.tier === "foundation" ? models.foundation : models.nano;

  console.info("[runbook-planning-access] resolved", {
    organizationId,
    entitlementAccess,
    subscriptionTier: subscription?.tier ?? null,
    organizationTier: organization?.tier ?? null,
    modelTier: access.tier,
    model: selectedModelMeta.model,
    configuredModel: selectedModelMeta.configuredModel,
    modelAliasApplied: selectedModelMeta.aliasApplied,
  });

  return access;
}
