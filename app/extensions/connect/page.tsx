import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { createCheckoutAction } from "@/app/actions";
import { ExtensionBrowserReturn } from "@/components/extension-browser-return";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { env } from "@/lib/env";
import { getAuthSessionSummary } from "@/lib/services/auth";
import { getOrganizationSubscription } from "@/lib/services/entitlements";
import { createExtensionAuthRequest } from "@/lib/services/extension-auth-requests";
import { getCurrentAppContext } from "@/lib/services/current-user";

const allowedCallbackProtocols = new Set(["vscode:", "vscode-insiders:", "cursor:"]);

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

function hasCompletedBillingSetup(input: {
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

function getBillingConfigured() {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_PRICE_ID &&
      env.STRIPE_ENTERPRISE_PRICE_ID,
  );
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
  const billingStatus = getBillingStatus(resolvedSearchParams.billing);
  const billingConfigured = getBillingConfigured();
  const reconnectPath = buildReconnectPath(callback, editor);
  const continueWithoutBillingPath = buildConnectPath(callback, editor, { skipBilling: true });
  const signInRedirectProps = {
    forceRedirectUrl: reconnectPath,
    fallbackRedirectUrl: reconnectPath,
    signUpForceRedirectUrl: reconnectPath,
    signUpFallbackRedirectUrl: reconnectPath,
  };
  const signUpRedirectProps = {
    forceRedirectUrl: reconnectPath,
    fallbackRedirectUrl: reconnectPath,
    signInForceRedirectUrl: reconnectPath,
    signInFallbackRedirectUrl: reconnectPath,
  };
  const manualFallbackPath = buildManualFallbackPath(callback, editor);
  const auth = await getAuthSessionSummary();
  const context = auth.session.status === "active" ? await getCurrentAppContext() : null;
  const subscription = context
    ? await getOrganizationSubscription(context.organization.id)
    : null;
  const billingComplete = subscription
    ? hasCompletedBillingSetup({
        tier: subscription.tier,
        status: subscription.status,
        provider: subscription.provider,
        stripeCustomerId: subscription.stripeCustomerId,
      })
    : false;
  const needsBillingStep = Boolean(callback && context && !manualMode && !billingComplete);
  const showCheckoutStep = needsBillingStep && billingConfigured;
  const showBillingUnavailableStep = needsBillingStep && !billingConfigured && !skipBilling;
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
              <p className="mt-3 text-sm leading-7 text-stone-700">
                This step turns the signup into a real customer flow: choose a paid plan, complete checkout,
                then Xupra returns to VS Code or Cursor automatically.
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

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <form action={createCheckoutAction} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Pro</p>
                  <p className="mt-2 text-sm leading-7 text-stone-700">
                    Deployment jobs, credential vault, and deeper workflow automation.
                  </p>
                  <input name="organizationId" type="hidden" value={context?.organization.id ?? ""} />
                  <input name="plan" type="hidden" value="pro" />
                  <input name="returnPath" type="hidden" value={reconnectPath} />
                  <button className="mt-4 rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" type="submit">
                    Start Pro Checkout
                  </button>
                </form>

                <form action={createCheckoutAction} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Enterprise</p>
                  <p className="mt-2 text-sm leading-7 text-stone-700">
                    Team controls, advanced reporting, and enterprise rollout support.
                  </p>
                  <input name="organizationId" type="hidden" value={context?.organization.id ?? ""} />
                  <input name="plan" type="hidden" value="enterprise" />
                  <input name="returnPath" type="hidden" value={reconnectPath} />
                  <button className="mt-4 rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                    Start Enterprise Checkout
                  </button>
                </form>
              </div>
            </section>
          ) : showBillingUnavailableStep ? (
            <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Billing Setup Needed
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Stripe is not configured for paid onboarding yet
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Xupra can continue to VS Code now, but official paid onboarding requires Stripe keys and webhook configuration.
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
              <div className="mt-6 flex flex-wrap gap-3">
                <SignUpButton mode="modal" {...signUpRedirectProps}>
                  <button className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700">
                    Sign Up
                  </button>
                </SignUpButton>
                <SignInButton mode="modal" {...signInRedirectProps}>
                  <button className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100">
                    Sign In
                  </button>
                </SignInButton>
              </div>
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
