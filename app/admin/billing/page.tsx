import {
  AdminShell,
  EmptyState,
  JsonBlock,
  MetricCard,
  Panel,
} from "@/app/admin/_components/admin-ui";
import { BillingActionsPanel } from "@/app/admin/billing/_components/billing-actions-panel";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getAdminBillingData } from "@/lib/services/admin-data";

export default async function AdminBillingPage() {
  await requireAdminPageAccess();

  const { subscriptions, metrics } = await getAdminBillingData();

  return (
    <AdminShell
      title="Billing visibility"
      subtitle="Read-only subscription, Stripe customer, and entitlement state across organizations."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="All subscription records" label="Subscriptions" value={String(metrics.totalSubscriptions)} />
        <MetricCard detail="Active or trialing records" label="Active" value={String(metrics.activeSubscriptions)} />
        <MetricCard
          detail="Organizations on paid tiers"
          label="Pro / Enterprise"
          value={String(metrics.proOrEnterpriseSubscriptions)}
        />
        <MetricCard detail="Stripe-backed subscriptions" label="Stripe" value={String(metrics.stripeSubscriptions)} />
      </section>

      <Panel eyebrow="Subscriptions" title="Latest Billing Records">
        {subscriptions.length === 0 ? (
          <EmptyState>No subscriptions recorded yet.</EmptyState>
        ) : (
          <BillingActionsPanel
            subscriptions={subscriptions.map((subscription) => ({
              id: subscription.id,
              organization: {
                name: subscription.organization.name,
                slug: subscription.organization.slug,
              },
              stripeCustomerId: subscription.stripeCustomerId,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              orgId: subscription.organizationId,
              provider: subscription.provider,
              tier: subscription.tier,
              status: subscription.status,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              currentPeriodEndsAt: subscription.currentPeriodEndsAt?.toISOString() ?? null,
              stripePriceId: subscription.stripePriceId,
            }))}
          />
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        {subscriptions.slice(0, 8).map((subscription) => (
          <Panel eyebrow={subscription.organization.name} key={subscription.id} title="Entitlements">
            <div className="grid gap-4">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Limits</p>
                <JsonBlock value={subscription.limitsJson} />
              </div>
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Entitlements</p>
                <JsonBlock value={subscription.entitlementsJson} />
              </div>
            </div>
          </Panel>
        ))}
      </section>
    </AdminShell>
  );
}
