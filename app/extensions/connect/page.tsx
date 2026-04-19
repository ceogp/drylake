import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { createCheckoutAction } from "@/app/actions";
import { ExtensionConnectAuthButtons } from "@/components/extension-connect-auth-buttons";
import { ExtensionBrowserReturn } from "@/components/extension-browser-return";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getAuthSessionSummary } from "@/lib/services/auth";
import { getOrganizationSubscription } from "@/lib/services/entitlements";
import { createExtensionAuthRequest } from "@/lib/services/extension-auth-requests";
import { getCurrentAppContext } from "@/lib/services/current-user";

const allowedCallbackProtocols = new Set(["vscode:", "vscode-insiders:", "cursor:"]);
const activeClerkSubscriptionStatuses = new Set(["active", "past_due", "upcoming"]);
const proEntitlements = {
  manual_export: true,
  deployment_jobs: true,
  credential_vault: true,
  slack_controls: true,
  advanced_reporting: true,
};
const freeEntitlements = {
  manual_export: false,
  deployment_jobs: false,
  credential_vault: false,
  slack_controls: false,
  advanced_reporting: false,
};

const steps = [
  "Click Connect in VS Code or Cursor.",
  "The extension opens this page in your browser.",
  "Sign up or sign in if needed.",
  "Choose your account level and complete checkout.",
  "The browser returns straight to the editor and the extension is connected.",
];

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getValidCallback(rawValue: string) {
  if (!rawValue.trim()) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    if (!allowedCallbackProtocols.has(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildReconnectPath(callback: string | null, editor: "vscode" | "cursor") {
  return buildConnectPath(callback, editor, { manual: false });
}

function buildConnectPath(
  callback: string | null,
  editor: "vscode" | "cursor",
  options?: {
    manual?: boolean;
    skipBilling?: boolean;
  },
) {
  if (!callback) {
    const params = new URLSearchParams();
    params.set("editor", editor);

    if (options?.manual) {
      params.set("manual", "1");
    }

    if (options?.skipBilling) {
      params.set("skipBilling", "1");
    }

    return `/extensions/connect?${params.toString()}`;
  }

  const params = new URLSearchParams();
  params.set("callback", callback);
  params.set("editor", editor);

  if (options?.manual) {
    params.set("manual", "1");
  }

  if (options?.skipBilling) {
    params.set("skipBilling", "1");
  }

  return `/extensions/connect?${params.toString()}`;
}

function isManualMode(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  return normalized === "1" || normalized.toLowerCase() === "true";
}

function getEditor(value: string | string[] | undefined): "vscode" | "cursor" {
  return normalizeSearchValue(value) === "cursor" ? "cursor" : "vscode";
}

function buildManualFallbackPath(callback: string | null, editor: "vscode" | "cursor") {
  return buildConnectPath(callback, editor, { manual: true });
}

function hasCompletedStripeBillingSetup(input: {
  tier: string;
  status: string;
  provider: string;
  stripeCustomerId: string | null;
}) {
  if (input.tier === "pro" || input.tier === "enterprise") {
    return true;
  }

  if (input.provider !== "stripe" || !input.stripeCustomerId) {
    return false;
  }

  return !["canceled", "unpaid", "incomplete_expired"].includes(input.status);
}

function getStripeBillingConfigured() {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_PRICE_ID,
  );
}

function hasPaidClerkSubscription(input: {
  status: string;
  subscriptionItems: Array<{
    status: string;
    amount?: {
      amount: number;
    } | null;
    planSlug?: string | null;
  }>;
}) {
  if (!activeClerkSubscriptionStatuses.has(input.status)) {
    return false;
  }

  return input.subscriptionItems.some((item) => {
    const amount = item.amount?.amount ?? 0;
    return activeClerkSubscriptionStatuses.has(item.status) && amount > 0;
  });
}

function getTierForClerkSubscription(input: {
  status: string;
  subscriptionItems: Array<{
    status: string;
    amount?: {
      amount: number;
    } | null;
    planSlug?: string | null;
  }>;
}) {
  if (!hasPaidClerkSubscription(input)) {
    return "free" as const;
  }

  const hasEnterprise = input.subscriptionItems.some((item) => {
    if (!activeClerkSubscriptionStatuses.has(item.status)) {
      return false;
    }

    const amount = item.amount?.amount ?? 0;
    const planSlug = item.planSlug?.toLowerCase() ?? "";
    return amount > 0 && planSlug.includes("enterprise");
  });

  return hasEnterprise ? ("enterprise" as const) : ("pro" as const);
}

async function getClerkBillingSnapshot() {
  if (!env.CLERK_SECRET_KEY || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return {
      configured: false,
      paid: false,
      tier: "free" as const,
    };
  }

  try {
    const authState = await auth();
    const client = await clerkClient();

    try {
      await client.billing.getPlanList({
        payerType: "user",
        limit: 1,
      });
    } catch {
      return {
        configured: false,
        paid: false,
        tier: "free" as const,
      };
    }

    if (!authState.userId) {
      return {
        configured: true,
        paid: false,
        tier: "free" as const,
      };
    }

    let subscription: Awaited<ReturnType<typeof client.billing.getUserBillingSubscription>> | null = null;

    try {
      subscription = await client.billing.getUserBillingSubscription(authState.userId);
    } catch {
      return {
        configured: true,
        paid: false,
        tier: "free" as const,
      };
    }

    if (!subscription) {
      return {
        configured: true,
        paid: false,
        tier: "free" as const,
      };
    }

    const normalized = {
      status: subscription.status,
      subscriptionItems: subscription.subscriptionItems.map((item) => ({
        status: item.status,
        amount: item.amount,
        planSlug: item.plan?.slug ?? null,
      })),
    };
    const tier = getTierForClerkSubscription(normalized);

    return {
      configured: true,
      paid: tier !== "free",
      tier,
    };
  } catch {
    return {
      configured: false,
      paid: false,
      tier: "free" as const,
    };
  }
}

function getBillingStatus(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);

  if (["success", "canceled", "unavailable"].includes(normalized)) {
    return normalized as "success" | "canceled" | "unavailable";
  }

  return null;
}

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const callback = getValidCallback(normalizeSearchValue(resolvedSearchParams.callback));
  const editor = getEditor(resolvedSearchParams.editor);
  const manualMode = isManualMode(resolvedSearchParams.manual);
  const skipBilling = isManualMode(resolvedSearchParams.skipBilling);
  const billingProvider = env.BILLING_PROVIDER;
  const billingStatus = getBillingStatus(resolvedSearchParams.billing);
  const stripeBillingConfigured = getStripeBillingConfigured();
  const clerkBilling = billingProvider === "clerk" ? await getClerkBillingSnapshot() : null;
  const billingConfigured = billingProvider === "clerk" ? Boolean(clerkBilling?.configured) : stripeBillingConfigured;
  const enterprisePlanConfigured = Boolean(env.STRIPE_ENTERPRISE_PRICE_ID);
  const reconnectPath = buildReconnectPath(callback, editor);
  const continueWithoutBillingPath = buildConnectPath(callback, editor, { skipBilling: true });
  const manualFallbackPath = buildManualFallbackPath(callback, editor);
  const authSummary = await getAuthSessionSummary();
  const context = authSummary.session.status === "active" ? await getCurrentAppContext() : null;
  const subscription = context
    ? await getOrganizationSubscription(context.organization.id)
    : null;
  const billingComplete =
    billingProvider === "clerk"
      ? Boolean(clerkBilling?.paid)
      : subscription
        ? hasCompletedStripeBillingSetup({
            tier: subscription.tier,
            status: subscription.status,
            provider: subscription.provider,
            stripeCustomerId: subscription.stripeCustomerId,
          })
        : false;

  if (billingProvider === "clerk" && context && clerkBilling?.paid) {
    await prisma.subscription.upsert({
      where: { organizationId: context.organization.id },
      update: {
        provider: "clerk",
        tier: clerkBilling.tier,
        status: "active",
        entitlementsJson: proEntitlements,
      },
      create: {
        organizationId: context.organization.id,
        provider: "clerk",
        tier: clerkBilling.tier,
        status: "active",
        entitlementsJson: proEntitlements,
        limitsJson: {},
      },
    });
  }

  if (billingProvider === "clerk" && context && skipBilling && !clerkBilling?.paid) {
    await prisma.subscription.upsert({
      where: { organizationId: context.organization.id },
      update: {
        provider: "clerk",
        tier: "free",
        status: "trial",
        entitlementsJson: freeEntitlements,
      },
      create: {
        organizationId: context.organization.id,
        provider: "clerk",
        tier: "free",
        status: "trial",
        entitlementsJson: freeEntitlements,
        limitsJson: {},
      },
    });
  }

  const needsBillingStep = Boolean(callback && context && !manualMode && !skipBilling && !billingComplete);
  const showCheckoutStep = needsBillingStep && billingConfigured;
  const showBillingUnavailableStep = needsBillingStep && !billingConfigured;
  const browserRequest =
    callback && context && !manualMode && !showCheckoutStep && !showBillingUnavailableStep
      ? await createExtensionAuthRequest({
          userId: context.user.id,
          organizationId: context.organization.id,
          editor,
        })
      : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_46%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">
              Extension Connection
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
              {context ? `Link VS Code or Cursor to ${context.organization.name}` : "Connect Xupra back to the editor"}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              This is the real extension-first handoff: the editor opens the browser, the browser
              handles identity, and the user returns straight to VS Code or Cursor.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/extensions/install"
            >
              Install Guide
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/app"
            >
              Open App
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {callback && browserRequest ? (
            <ExtensionBrowserReturn
              callback={callback}
              code={browserRequest.code}
              manualFallbackHref={manualFallbackPath}
            />
          ) : showCheckoutStep ? (
            <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Choose A Plan
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Pick your account level before editor access
              </h2>
              {billingProvider === "clerk" ? (
                <>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    Choose free if you only want to upload skills and workspace files. Choose a paid plan
                    to unlock all features, then Clerk returns you to VS Code or Cursor automatically.
                  </p>

                  <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Paid plans</p>
                    <div className="mt-4">
                      <PricingTable for="user" newSubscriptionRedirectUrl={reconnectPath} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      className="inline-block rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                      href={continueWithoutBillingPath}
                    >
                      Continue With Free
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    Choose free if you only want to upload skills and workspace files. Choose Pro for all features
                    with paid checkout, then return to VS Code or Cursor automatically.
                  </p>

                  {billingStatus === "success" ? (
                    <div className="mt-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Checkout completed. If this screen does not advance in a few seconds, refresh once to sync your subscription.
                    </div>
                  ) : null}

                  {billingStatus === "canceled" ? (
                    <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Checkout was canceled. Choose a plan below to continue.
                    </div>
                  ) : null}

                  {billingStatus === "unavailable" ? (
                    <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      Billing checkout is currently unavailable. Verify Stripe keys and webhook configuration.
                    </div>
                  ) : null}

                  <div className={`mt-6 grid gap-4 ${enterprisePlanConfigured ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                    <Link className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4" href={continueWithoutBillingPath}>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Free</p>
                      <p className="mt-2 text-sm leading-7 text-stone-700">
                        Upload skills and workspace content, but keep advanced automation locked.
                      </p>
                      <span className="mt-4 inline-block rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100">
                        Continue With Free
                      </span>
                    </Link>

                    <form action={createCheckoutAction} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Pro</p>
                      <p className="mt-2 text-sm leading-7 text-stone-700">
                        Unlock all features for your organization, including deployment and reporting.
                      </p>
                      <input name="organizationId" type="hidden" value={context?.organization.id ?? ""} />
                      <input name="plan" type="hidden" value="pro" />
                      <input name="returnPath" type="hidden" value={reconnectPath} />
                      <button className="mt-4 rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" type="submit">
                        Start Pro Checkout ($10/mo)
                      </button>
                    </form>

                    {enterprisePlanConfigured ? (
                      <form action={createCheckoutAction} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Enterprise</p>
                        <p className="mt-2 text-sm leading-7 text-stone-700">
                          Optional enterprise pricing path for custom contracts.
                        </p>
                        <input name="organizationId" type="hidden" value={context?.organization.id ?? ""} />
                        <input name="plan" type="hidden" value="enterprise" />
                        <input name="returnPath" type="hidden" value={reconnectPath} />
                        <button className="mt-4 rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                          Start Enterprise Checkout
                        </button>
                      </form>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          ) : showBillingUnavailableStep ? (
            <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Billing Setup Needed
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                {billingProvider === "clerk"
                  ? "Clerk Billing is not configured for paid onboarding yet"
                  : "Stripe is not configured for paid onboarding yet"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {billingProvider === "clerk"
                  ? "Xupra can continue to VS Code now, but official paid onboarding requires Clerk Billing to be enabled in your Clerk dashboard."
                  : "Xupra can continue to VS Code now, but official paid onboarding requires Stripe keys and webhook configuration."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700"
                  href={continueWithoutBillingPath}
                >
                  Continue To VS Code
                </Link>
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                  href="/billing"
                >
                  Open Billing Setup
                </Link>
              </div>
            </section>
          ) : callback && !manualMode ? (
            <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Sign In To Continue
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Finish account setup, then go right back to the editor
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use any email. Xupra will create your personal workspace automatically, then return
                you to VS Code or Cursor to keep going.
              </p>
              <ExtensionConnectAuthButtons reconnectPath={reconnectPath} />
              <p className="mt-4 text-xs leading-6 text-stone-500">
                If the browser return does not work later, manual token fallback is still available.
              </p>
            </section>
          ) : (
            <ExtensionConnectCard />
          )}

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              What to do
            </p>
            <div className="mt-5 grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-stone-700"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    Step {index + 1}
                  </span>
                  <p className="mt-2">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-700">
              If your repo does not keep skills, rules, or agent files in the default directories,
              add patterns in extension settings under <span className="font-mono text-xs">xupra.additionalScanPatterns</span>.
            </div>

            {!callback || manualMode ? (
              <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                This screen is the fallback path. The normal customer flow starts inside the extension and
                returns to the editor automatically.
              </div>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  );
}
