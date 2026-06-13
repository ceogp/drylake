import { internalError, ok, unauthorized } from "@/lib/api/http";
import { syncSubscriptionFromStripe } from "@/lib/services/billing-sync";
import { requireCurrentAppContext } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireCurrentAppContext();
    await syncSubscriptionFromStripe(context.organization.id);
    const { subscription, resolved } = await getEntitlementsForOrganization(context.organization.id);

    return ok({
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            tier: subscription.tier,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripePriceId: subscription.stripePriceId,
            currentPeriodEnd: subscription.currentPeriodEndsAt?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      entitlements: resolved,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return unauthorized();
    }

    console.error(error);
    return internalError("Failed to sync subscription");
  }
}
