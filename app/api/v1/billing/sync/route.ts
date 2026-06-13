import { internalError, ok, unauthorized } from "@/lib/api/http";
import { syncSubscriptionFromStripe } from "@/lib/services/billing-sync";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export async function POST() {
  try {
    const context = await getCurrentAppContext();

    if (!context) {
      return unauthorized("Sign in to refresh subscription state.");
    }

    const organizationId = context.organization.id;

    let stripeResult: Awaited<ReturnType<typeof syncSubscriptionFromStripe>> | null = null;
    try {
      stripeResult = await syncSubscriptionFromStripe(organizationId);
    } catch (error) {
      console.warn("[billing/sync] stripe sync failed", error);
    }

    const { subscription, entitlements } = await getEntitlementsForOrganization(organizationId);

    return ok({
      ok: true,
      tier: subscription?.tier ?? "free",
      status: subscription?.status ?? "none",
      stripe: stripeResult,
      entitlements,
      subscription: { status: subscription?.status ?? "none" },
    });
  } catch (error) {
    console.error("[billing/sync] failed", error);
    return internalError(error instanceof Error ? error.message : "Failed to refresh subscription");
  }
}
