import { prisma } from "@/lib/prisma";
import { freePlanningModel } from "@/lib/services/ai-model-selection";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export type GuardFixAccess = {
  paid: boolean;
  modelTier: "nano";
  model: string;
};

export async function resolveGuardFixAccess(organizationId: string): Promise<GuardFixAccess> {
  const [{ entitlements, subscription }, organization] = await Promise.all([
    getEntitlementsForOrganization(organizationId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { tier: true },
    }),
  ]);

  const subscriptionTier = String(subscription?.tier ?? "").toLowerCase();
  const organizationTier = String(organization?.tier ?? "").toLowerCase();
  const paid = Boolean(entitlements.xupra_pro_ai) ||
    subscriptionTier === "pro" ||
    subscriptionTier === "enterprise" ||
    organizationTier === "pro" ||
    organizationTier === "enterprise";

  return {
    paid,
    modelTier: "nano",
    model: freePlanningModel(),
  };
}
