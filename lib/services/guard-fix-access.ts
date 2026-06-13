import { prisma } from "@/lib/prisma";
import { freePlanningModel } from "@/lib/services/ai-model-selection";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export type GuardFixAccess = {
  paid: boolean;
  modelTier: "nano";
  model: string;
};

export async function resolveGuardFixAccess(organizationId: string): Promise<GuardFixAccess> {
  const [{ resolved }, organization] = await Promise.all([
    getEntitlementsForOrganization(organizationId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { tier: true },
    }),
  ]);

  const organizationTier = String(organization?.tier ?? "").toLowerCase();
  const paid = Boolean(resolved.canUseFixWithAI) ||
    organizationTier === "security_pro" ||
    organizationTier === "team_security" ||
    organizationTier === "enterprise";

  return {
    paid,
    modelTier: "nano",
    model: freePlanningModel(),
  };
}
