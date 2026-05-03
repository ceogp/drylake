import {
  AdminShell,
  EmptyState,
  JsonBlock,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Provider</th>
                  <th className="px-3 py-3">Tier</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Period End</th>
                  <th className="px-3 py-3">Stripe IDs</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr className="border-b border-stone-100 align-top" key={subscription.id}>
                    <td className="px-3 py-4">
                      <div className="font-medium text-stone-950">{subscription.organization.name}</div>
                      <div className="text-xs text-stone-500">{subscription.organization.slug}</div>
                    </td>
                    <td className="px-3 py-4">{subscription.provider}</td>
                    <td className="px-3 py-4">{subscription.tier}</td>
                    <td className="px-3 py-4">
                      <StatusBadge value={subscription.status} />
                      {subscription.cancelAtPeriodEnd ? (
                        <div className="mt-2 text-xs text-red-700">cancel at period end</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-xs text-stone-500">
                      {formatDate(subscription.currentPeriodEndsAt)}
                    </td>
                    <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                      <div>Customer: {subscription.stripeCustomerId ?? "n/a"}</div>
                      <div>Subscription: {subscription.stripeSubscriptionId ?? "n/a"}</div>
                      <div>Price: {subscription.stripePriceId ?? "n/a"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
