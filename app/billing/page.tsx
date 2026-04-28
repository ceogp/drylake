import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";

import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getSetupStatus } from "@/lib/services/setup";

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getSafeReturnPath(value: string | string[] | undefined) {
  const rawPath = normalizeSearchValue(value).trim();

  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(rawPath, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const returnPath = getSafeReturnPath(resolvedSearchParams.returnPath);
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  if (!organizationId) {
    return null;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  const { entitlements } = await getEntitlementsForOrganization(organizationId);
  const setup = await getSetupStatus();

  if (env.BILLING_PROVIDER === "clerk") {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Billing</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
              Choose your plan with Clerk Billing.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              This flow is powered by Clerk Billing. Use free for upload-only usage, or choose a paid
              plan to unlock all product features.
            </p>
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Plans</p>
            <div className="mt-5">
              <PricingTable
                for="user"
                newSubscriptionRedirectUrl={returnPath ?? "/billing"}
              />
            </div>

            {returnPath ? (
              <div className="mt-6">
                <Link
                  className="inline-block rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                  href={returnPath}
                >
                  Continue With Free
                </Link>
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Current local mirror</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                {subscription?.tier ?? "free"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-stone-700">Status: {subscription?.status ?? "trial"}</p>
              <p className="text-sm leading-7 text-stone-700">
                Provider: {subscription?.provider ?? "local"}
              </p>
            </article>

            <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Entitlements</p>
              <div className="mt-5 grid gap-3">
                {Object.entries(entitlements).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{key}</span>
                      <span className={value ? "text-emerald-700" : "text-stone-500"}>{value ? "enabled" : "disabled"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Billing</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Billing behind the extension workflow.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            Users should discover Xupra in the editor first. This page exists to manage plans, checkout, and feature access once the product is already in use.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Current plan</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              {subscription?.tier ?? "free"}
            </h2>
            <p className="mt-2 text-sm leading-7 text-stone-700">Status: {subscription?.status ?? "trial"}</p>
            <p className="text-sm leading-7 text-stone-700">
              Provider: {subscription?.provider ?? "local"}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <form action={createCheckoutAction}>
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="plan" type="hidden" value="pro" />
                <button className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" type="submit">
                  Upgrade To Pro ($10/mo)
                </button>
              </form>
              <form action={createCheckoutAction}>
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="plan" type="hidden" value="enterprise" />
                <button className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                  Enterprise Checkout
                </button>
              </form>
              <form action={openBillingPortalAction}>
                <input name="organizationId" type="hidden" value={organizationId} />
                <button className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                  Billing Portal
                </button>
              </form>
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Entitlements</p>
            <div className="mt-5 grid gap-3">
              {Object.entries(entitlements).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{key}</span>
                    <span className={value ? "text-emerald-700" : "text-stone-500"}>{value ? "enabled" : "disabled"}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Stripe Readiness</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              {setup.billing.configured ? "Billing is wired." : "Billing still needs live Stripe keys."}
            </h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-stone-700">
              <p>Webhook path: {setup.billing.webhookPath}</p>
              <p>Portal ready: {setup.billing.portalReady ? "yes" : "no"}</p>
              {setup.billing.missing.length > 0 ? <p>Missing: {setup.billing.missing.join(", ")}</p> : null}
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Tier Model</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                Free: upload skills and workspace info only
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                Pro ($10/month): unlock all product features
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                Enterprise: optional custom enterprise contract path
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
