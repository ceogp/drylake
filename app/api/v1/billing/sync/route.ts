import { internalError, ok, unauthorized } from "@/lib/api/http";
import { syncSubscriptionFromClerk } from "@/lib/services/billing-sync";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export async function POST() {
  try {
    const context = await getCurrentAppContext();

    if (!context) {
      return unauthorized("Sign in to refresh subscription state.");
    }

    const result = await syncSubscriptionFromClerk(context.organization.id);
    const { subscription, entitlements } = await getEntitlementsForOrganization(context.organization.id);

    return ok({
      ok: true,
      tier: result.tier,
      status: result.status,
      source: result.source,
      entitlements,
      subscription: { status: subscription?.status ?? "none" },
    });
  } catch (error) {
    console.error("[billing/sync] failed", error);
    return internalError(error instanceof Error ? error.message : "Failed to refresh subscription");
  }
}
