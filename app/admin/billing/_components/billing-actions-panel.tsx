"use client";

import { useActionState, useState } from "react";

import { StatusBadge, formatDate } from "@/app/admin/_components/admin-ui";
import { refundAction } from "@/app/admin/actions";

type FetchState = "idle" | "loading" | "error" | "no_charges" | "loaded";
type RefundActionState = { error: string } | undefined;

type ChargePreview = {
  chargeId: string;
  amount: number;
  currency: string;
  invoiceDate: number;
  status: string;
};

type ChargePreviewResponse = Partial<ChargePreview> & {
  ok?: boolean;
  error?: {
    message?: string;
  };
};

type BillingSubscription = {
  id: string;
  organization: { name: string; slug: string };
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  orgId: string;
  provider: string;
  tier: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndsAt: string | null;
  stripePriceId: string | null;
};

export function BillingActionsPanel({ subscriptions }: { subscriptions: BillingSubscription[] }) {
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<{
    subscriptionId: string;
    orgName: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const activeSubscription = activeSubscriptionId
    ? subscriptions.find((subscription) => subscription.id === activeSubscriptionId) ?? null
    : null;
  const [, refundFormAction, isRefundPending] = useActionState(
    async (_previousState: RefundActionState, formData: FormData) => {
      const result = await refundAction(formData);

      if (result?.error) {
        setRefundError(result.error);
        return result;
      }

      if (activeSubscription && chargePreview) {
        setRefundResult({
          subscriptionId: activeSubscription.id,
          orgName: activeSubscription.organization.name,
          amount: chargePreview.amount,
          currency: chargePreview.currency,
        });
      }

      closeRefundPanel();
      return result;
    },
    undefined,
  );

  async function readErrorMessage(response: Response, fallback: string) {
    try {
      const data = (await response.json()) as ChargePreviewResponse;
      return data.error?.message ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function handleOpenRefund(subscription: BillingSubscription) {
    if (!subscription.stripeCustomerId) {
      return;
    }

    setActiveSubscriptionId(subscription.id);
    setFetchState("loading");
    setChargePreview(null);
    setFetchError(null);
    setRefundError(null);

    try {
      const response = await fetch(
        `/api/v1/admin/billing/charge-preview?stripeCustomerId=${encodeURIComponent(subscription.stripeCustomerId)}`,
      );

      if (response.status === 404) {
        setFetchState("no_charges");
        return;
      }

      if (!response.ok) {
        setFetchError(await readErrorMessage(response, "Failed to fetch charge from Stripe."));
        setFetchState("error");
        return;
      }

      const data = (await response.json()) as ChargePreviewResponse;

      setChargePreview({
        chargeId: String(data.chargeId),
        amount: Number(data.amount),
        currency: String(data.currency),
        invoiceDate: Number(data.invoiceDate),
        status: String(data.status),
      });
      setFetchState("loaded");
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to fetch charge from Stripe.");
      setFetchState("error");
    }
  }

  function closeRefundPanel() {
    setActiveSubscriptionId(null);
    setFetchState("idle");
    setChargePreview(null);
    setFetchError(null);
    setRefundError(null);
  }

  function formatAmount(amount: number, currency: string) {
    return `$${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }

  function stripeCustomerUrl(stripeCustomerId: string) {
    return `https://dashboard.stripe.com/customers/${stripeCustomerId}`;
  }

  return (
    <div className="grid gap-4">
      {refundResult ? (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 md:flex-row md:items-center md:justify-between">
          <p>
            Refund of {formatAmount(refundResult.amount, refundResult.currency)} issued for {refundResult.orgName}.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
            onClick={() => setRefundResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

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
              <th className="px-3 py-3">Actions</th>
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
                <td className="px-3 py-4">
                  <div className="flex min-w-36 flex-col items-start gap-2">
                    {subscription.stripeCustomerId ? (
                      <a
                        className="font-mono text-xs text-stone-600 underline-offset-2 transition hover:text-stone-950 hover:underline"
                        href={stripeCustomerUrl(subscription.stripeCustomerId)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Customer
                      </a>
                    ) : null}
                    {subscription.stripeSubscriptionId ? (
                      <a
                        className="font-mono text-xs text-stone-600 underline-offset-2 transition hover:text-stone-950 hover:underline"
                        href={`https://dashboard.stripe.com/subscriptions/${subscription.stripeSubscriptionId}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Subscription
                      </a>
                    ) : null}
                    <button
                      className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!subscription.stripeCustomerId}
                      onClick={() => handleOpenRefund(subscription)}
                      title={subscription.stripeCustomerId ? undefined : "No Stripe customer"}
                      type="button"
                    >
                      Refund
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeSubscription ? (
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          {fetchState === "loading" ? (
            <p className="text-sm text-stone-600">Fetching latest charge…</p>
          ) : null}

          {fetchState === "no_charges" ? (
            <div className="grid gap-4 text-sm text-stone-700">
              <p>No charges found for this customer. Nothing to refund.</p>
              <div>
                <button
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                  onClick={closeRefundPanel}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          {fetchState === "error" ? (
            <div className="grid gap-4 text-sm text-stone-700">
              <p>{fetchError ?? "Failed to fetch charge from Stripe."}</p>
              {activeSubscription.stripeCustomerId ? (
                <a
                  className="font-mono text-xs text-stone-600 underline-offset-2 transition hover:text-stone-950 hover:underline"
                  href={stripeCustomerUrl(activeSubscription.stripeCustomerId)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Stripe customer dashboard
                </a>
              ) : null}
              <div>
                <button
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                  onClick={closeRefundPanel}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          {fetchState === "loaded" && chargePreview ? (
            <form action={refundFormAction}>
              <div className="grid gap-4 text-sm text-stone-700">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Refund Preview</p>
                  <h3 className="mt-1 text-xl font-semibold text-stone-950">
                    {activeSubscription.organization.name}
                  </h3>
                </div>
                <dl className="grid gap-3 md:grid-cols-2">
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Invoice Date</dt>
                    <dd className="mt-1 text-stone-900">
                      {new Date(chargePreview.invoiceDate * 1000).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Charge ID</dt>
                    <dd className="mt-1 font-mono text-xs text-stone-900">{chargePreview.chargeId}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Amount</dt>
                    <dd className="mt-1 text-stone-900">
                      {formatAmount(chargePreview.amount, chargePreview.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Status</dt>
                    <dd className="mt-1 text-stone-900">{chargePreview.status}</dd>
                  </div>
                </dl>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  This will issue a full refund. Partial refunds are not supported from this interface.
                </p>
                {refundError ? <p className="text-sm text-red-700">{refundError}</p> : null}
                <input name="stripeCustomerId" type="hidden" value={activeSubscription.stripeCustomerId ?? ""} />
                <input name="stripeChargeId" type="hidden" value={chargePreview.chargeId} />
                <input name="amountCents" type="hidden" value={chargePreview.amount} />
                <input name="currency" type="hidden" value={chargePreview.currency} />
                <input name="orgId" type="hidden" value={activeSubscription.orgId} />
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRefundPending}
                    onClick={closeRefundPanel}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRefundPending}
                    type="submit"
                  >
                    {isRefundPending ? "Refunding..." : "Confirm Refund"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
