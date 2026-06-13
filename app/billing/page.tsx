import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";

import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getIsPlatformAdmin } from "@/lib/services/access";
import { syncSubscriptionFromClerk, syncSubscriptionFromStripe } from "@/lib/services/billing-sync";
import { getEntitlementsForOrganization, type EntitlementKey } from "@/lib/services/entitlements";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getSetupStatus } from "@/lib/services/setup";

const BILLING_SUBTITLE =
  "Use Free for local Guard scans, Pro for hosted planning, and Security Pro for paid remediation.";

const PLAN_TIERS = ["free", "pro", "security_pro", "team_security", "enterprise"] as const;

type BillingPlan = "pro" | "security_pro" | "team_security" | "enterprise";

function normalizeRequiredPlan(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value).toLowerCase();

  if (normalized === "pro" || normalized === "security_pro" || normalized === "team_security" || normalized === "enterprise") {
    return normalized;
  }

  return null;
}

function planRank(value: string | null | undefined) {
  return PLAN_TIERS.indexOf((value ?? "free").toLowerCase() as (typeof PLAN_TIERS)[number]);
}

function shouldShowUpgradeOption(requiredPlan: string | null, plan: BillingPlan) {
  if (!requiredPlan) {
    return true;
  }

  return planRank(plan) >= planRank(requiredPlan);
}

const ENTITLEMENT_ITEMS: Array<{ key: EntitlementKey; label: string }> = [
  { key: "canUseHostedPlanning", label: "Hosted planning" },
  { key: "canUseFixWithAI", label: "Fix with AI" },
  { key: "canUseApprovedUpload", label: "Approved upload" },
  { key: "canUseDeepCloudAnalysis", label: "Deep Cloud Analysis" },
  { key: "canUseLocalWatchdog", label: "Local Watchdog" },
  { key: "canUseTeamBaseline", label: "Team Baseline" },
  { key: "canUseContinuousWatch", label: "Continuous Watch" },
  { key: "canManageTeamPolicy", label: "Team policy" },
];

async function syncSafely(organizationId: string) {
  try {
    await syncSubscriptionFromClerk(organizationId);
  } catch (error) {
    console.warn("[billing] clerk sync failed", { organizationId, error });
  }
  try {
    await syncSubscriptionFromStripe(organizationId);
  } catch (error) {
    console.warn("[billing] stripe sync failed", { organizationId, error });
  }
}

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

function getPublicTierLabel(tier: string | null | undefined) {
  const normalized = (tier ?? "free").toLowerCase();

  if (normalized === "enterprise") {
    return "Enterprise";
  }

  if (normalized === "security_pro") {
    return "Security Pro";
  }

  if (normalized === "team_security") {
    return "Team Security";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const returnPath = getSafeReturnPath(resolvedSearchParams.returnPath);
  const source = normalizeSearchValue(resolvedSearchParams.source);
  const requiredPlan = normalizeRequiredPlan(resolvedSearchParams.required);
  const fallbackReturnPath = source === "extension" ? "/app" : "/billing?checkout=success";
  const checkoutReturnPath = returnPath ?? fallbackReturnPath;
  const isPlatformAdmin = await getIsPlatformAdmin();
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  if (!organizationId) {
    return null;
  }

  await syncSafely(organizationId);

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  const { entitlements } = await getEntitlementsForOrganization(organizationId);
  const organizationTier = subscription?.tier ?? context.organization.tier ?? "free";
  const setup = await getSetupStatus();
  const hasSubscription = Boolean(subscription?.stripeCustomerId);
  const userCanManageBilling = context.activeMembership.role === "owner" || context.activeMembership.role === "admin";
  const requiredSatisfied = planRank(organizationTier) >= planRank(requiredPlan);

  if (env.BILLING_PROVIDER === "clerk") {
    return (
      <main className="tape-page min-h-screen">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
          <div className="space-y-4">
            <p className="tape-eyebrow">Billing</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-stone-950">
              Choose your plan with Clerk Billing.
            </h1>
            {requiredPlan && source === "extension" ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
                This browser flow is requesting the <strong>{getPublicTierLabel(requiredPlan)}</strong> tier or above.
                {!requiredSatisfied
                  ? " Choose one of the recommended tiers to unlock this feature."
                  : "You already have a qualifying plan for this feature."}
              </p>
            ) : null}
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              {BILLING_SUBTITLE}
            </p>
          </div>

          <section className="tape-panel bg-white p-6">
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
                  className="tape-button inline-block bg-white px-5 py-3 text-sm text-black"
                  href={returnPath}
                >
                  Continue With Free
                </Link>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/account">
                Account
              </Link>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/workspace">
                Continue to Workspace
              </Link>
            </div>
          </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Current local mirror</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                {getPublicTierLabel(subscription?.tier)}
              </h2>
              <p className="mt-2 text-sm leading-7 text-stone-700">Status: {subscription?.status ?? "trial"}</p>
              <p className="text-sm leading-7 text-stone-700">
                Provider: {subscription?.provider ?? "local"}
              </p>
            </article>

            <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Entitlements</p>
              <div className="mt-5 grid gap-3">
                {ENTITLEMENT_ITEMS.map(({ key, label }) => {
                  const value = Boolean(entitlements[key]);

                  return (
                  <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
                      <span className={value ? "text-emerald-700" : "text-stone-500"}>{value ? "enabled" : "disabled"}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </article>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="tape-eyebrow">Billing</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-stone-950">
            Choose your plan.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            {BILLING_SUBTITLE}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Current plan</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                {getPublicTierLabel(organizationTier)}
              </h2>
            <p className="mt-2 text-sm leading-7 text-stone-700">Status: {subscription?.status ?? "trial"}</p>
            <p className="text-sm leading-7 text-stone-700">
              Provider: {subscription?.provider ?? "local"}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {shouldShowUpgradeOption(requiredPlan, "pro") ? (
                <form action={createCheckoutAction}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="plan" type="hidden" value="pro" />
                  <input name="returnPath" type="hidden" value={checkoutReturnPath} />
                  <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                    Upgrade To Pro ($10/mo)
                  </button>
                </form>
              ) : null}
              {shouldShowUpgradeOption(requiredPlan, "security_pro") ? (
                <form action={createCheckoutAction}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="plan" type="hidden" value="security_pro" />
                  <input name="returnPath" type="hidden" value={checkoutReturnPath} />
                  <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                    Upgrade To Security Pro ($40/mo)
                  </button>
                </form>
              ) : null}
              {shouldShowUpgradeOption(requiredPlan, "team_security") && userCanManageBilling ? (
                <form action={createCheckoutAction}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="plan" type="hidden" value="team_security" />
                  <input name="returnPath" type="hidden" value={checkoutReturnPath} />
                  <button className="tape-button bg-white px-5 py-3 text-sm text-black" type="submit">
                    Upgrade Team Security
                  </button>
                </form>
              ) : null}
              {hasSubscription ? (
                <form action={openBillingPortalAction}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="returnPath" type="hidden" value={checkoutReturnPath} />
                  <button className="tape-button bg-white px-5 py-3 text-sm text-black" type="submit">
                    Billing Portal
                  </button>
                </form>
              ) : null}
              {requiredPlan && requiredSatisfied && source === "extension" ? (
                <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href={checkoutReturnPath}>
                  Open DryLake Web App
                </Link>
              ) : null}
            </div>
            {source === "extension" && (
              <p className="mt-4 text-sm leading-7 text-stone-700">
                {requiredPlan
                  ? `After upgrading to ${getPublicTierLabel(requiredPlan)}, return to VS Code or Cursor to continue. The browser button only opens the DryLake web app.`
                  : "After upgrading, return to VS Code or Cursor to continue. The browser button only opens the DryLake web app."}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/account">
                Account
              </Link>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/workspace">
                Continue to Workspace
              </Link>
            </div>
          </article>

          <article className="tape-panel bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Entitlements</p>
            <div className="mt-5 grid gap-3">
              {ENTITLEMENT_ITEMS.map(({ key, label }) => {
                const value = Boolean(entitlements[key]);

                return (
                <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
                    <span className={value ? "text-emerald-700" : "text-stone-500"}>{value ? "enabled" : "disabled"}</span>
                  </div>
                </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {isPlatformAdmin && (
            <article className="tape-panel bg-white p-6">
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
          )}

          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Tier Model</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                Free: scan workspace, import existing runbooks, view + copy + download phase prompts, hand off to your installed coding agents.
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                Pro ($10/month): hosted planning, Control Plane planning, saved plans, and handoff flows.
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                Security Pro ($40/month): Fix with AI, approved upload, Deep Cloud Analysis, local Watchdog, and personal report history.
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                Team Security: shared reports, Team Baseline, team policy, allowlists/denylists, and Continuous Watch.
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
