import { env } from "@/lib/env";
import { hasEntitlement } from "@/lib/services/entitlements";

export type RunbookPlanningAccess = {
  tier: "foundation" | "nano";
  model: string;
};

export async function resolveRunbookPlanningAccess(organizationId: string): Promise<RunbookPlanningAccess> {
  const hasFoundationAccess = await hasEntitlement(organizationId, "xupra_pro_ai");

  return hasFoundationAccess
    ? { tier: "foundation", model: env.OPENAI_MODEL }
    : { tier: "nano", model: env.OPENAI_FREE_MODEL };
}
