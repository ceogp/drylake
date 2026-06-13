import Link from "next/link";

import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { syncSubscriptionFromStripe } from "@/lib/services/billing-sync";
import { getEntitlementsForOrganization, type EntitlementKey } from "@/lib/services/entitlements";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

const BILLING_SUBTITLE =
  "Billing is intentionally simple: Free or Paid. Paid includes Agent Control and advanced Guard features in one subscription.";

const PLAN_TIERS = ["free", "pro", "security_pro", "team_security", "enterprise"] as const;
const ALLOWED_EDITOR_RETURN_PROTOCOLS = new Set(["vscode:", "vscode-insiders:", "cursor:"]);

type BillingPlan = "pro" | "security_pro" | "team_security" | "enterprise";
type EditorTarget = "vscode" | "cursor";
type BillingResult = "success" | "canceled" | "unavailable" | null;

function normalizeRequiredPlan(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value).toLowerCase();

  if (normalized === "pro" || normalized === "security_pro" || normalized === "team_security" || normalized === "enterprise") {
    return normalized;
  }

  return null;
}

function normalizeEditorTarget(value: string | string[] | undefined): EditorTarget | null {
  const normalized = normalizeSearchValue(value).toLowerCase();
  return normalized === "cursor" ? "cursor" : normalized === "vscode" ? "vscode" : null;
}

function normalizeBillingResult(value: string | string[] | undefined): BillingResult {
  const normalized = normalizeSearchValue(value).toLowerCase();

  if (normalized === "success" || normalized === "canceled" || normalized === "unavailable") {
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
  { key: "canUseHostedPlanning", label: "Hosted Agent Control" },
  { key: "canUseFixWithAI", label: "Fix with AI" },
  { key: "canUseApprovedUpload", label: "Approved upload" },
  { key: "canUseDeepCloudAnalysis", label: "Deep Cloud Analysis" },
  { key: "canUseLocalWatchdog", label: "Local Watchdog" },
];

async function syncSafely(organizationId: string) {
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

function getSafeEditorReturnUrl(value: string | string[] | undefined) {
  const rawValue = normalizeSearchValue(value).trim();

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);

    if (!ALLOWED_EDITOR_RETURN_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function getPublicTierLabel(tier: string | null | undefined) {
  const normalized = (tier ?? "free").toLowerCase();

  return normalized === "free" ? "Free" : "Paid";
}

function buildBillingContinuationPath(args: {
  requiredPlan: string | null;
  returnPath: string;
  editor: EditorTarget | null;
  editorReturnUrl: string;
}) {
  const params = new URLSearchParams({
    source: "extension",
    returnPath: args.returnPath,
    editorReturnUrl: args.editorReturnUrl,
  });

  if (args.requiredPlan) {
    params.set("required", args.requiredPlan);
  }

  if (args.editor) {
    params.set("editor", args.editor);
  }

  return `/billing?${params.toString()}`;
}

function editorReturnLabel(editor: EditorTarget | null) {
  return editor === "cursor" ? "Return to Cursor" : "Return to VS Code";
}

function billingResultCopy(result: BillingResult) {
  if (result === "success") {
    return "Checkout completed. Return to the editor to refresh plan access immediately.";
  }

  if (result === "canceled") {
    return "Checkout was canceled. You can still return to the editor or try again.";
  }

  if (result === "unavailable") {
    return "Billing is not available right now. You can return to the editor and try again later.";
  }

  return null;
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
  const editor = normalizeEditorTarget(resolvedSearchParams.editor);
  const editorReturnUrl = getSafeEditorReturnUrl(resolvedSearchParams.editorReturnUrl);
  const billingResult = normalizeBillingResult(resolvedSearchParams.billing);
  const showWelcomeChoice = normalizeSearchValue(resolvedSearchParams.welcome) === "1";
  const fallbackReturnPath = source === "extension" ? "/app" : "/billing?checkout=success";
  const appReturnPath = returnPath ?? fallbackReturnPath;
  const checkoutReturnPath =
    source === "extension" && editorReturnUrl
      ? buildBillingContinuationPath({
          requiredPlan,
          returnPath: appReturnPath,
          editor,
          editorReturnUrl,
        })
      : appReturnPath;
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
  const hasSubscription = Boolean(subscription?.stripeCustomerId);
  const userCanManageBilling = context.activeMembership.role === "owner" || context.activeMembership.role === "admin";
  const requiredSatisfied = planRank(organizationTier) >= planRank(requiredPlan);
  const isPaid = planRank(organizationTier) >= planRank("security_pro");
  const showEditorReturn =
    source === "extension" && Boolean(editorReturnUrl) && (requiredSatisfied || billingResult === "success");
  const statusCopy = billingResultCopy(billingResult);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="tape-eyebrow">Billing</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-stone-950">
            Manage your DryLake plan.
          </h1>
          {requiredPlan && source === "extension" ? (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
              This browser flow is requesting the <strong>{getPublicTierLabel(requiredPlan)}</strong> tier or above.
              {!requiredSatisfied
                ? " Choose one of the qualifying plans to unlock this feature."
                : " You already have a qualifying plan for this feature."}
            </p>
          ) : null}
          <p className="max-w-3xl text-lg leading-8 text-stone-700">{BILLING_SUBTITLE}</p>
        </div>

        {showWelcomeChoice ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Free</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                Start free.
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use Agent Control and run local Guard scans without uploading code or starting a subscription.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-stone-700">
                <span className="rounded border border-stone-200 bg-stone-50 px-4 py-3">Local Guard report</span>
                <span className="rounded border border-stone-200 bg-stone-50 px-4 py-3">Extension connection</span>
                <span className="rounded border border-stone-200 bg-stone-50 px-4 py-3">No card required</span>
              </div>
              <Link className="tape-button mt-6 inline-flex bg-white px-5 py-3 text-sm text-black" href="/workspace">
                Continue Free
              </Link>
            </article>

            <article className="tape-panel bg-zinc-950 p-6 text-zinc-100">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-300">Paid</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-white">
                Unlock the full workflow.
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Paid includes Agent Control plus advanced Guard features: approved upload, Fix with AI,
                Deep Cloud Analysis, saved reports, and Local Watchdog.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-zinc-300">
                <span className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Fix with AI</span>
                <span className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Deep Cloud Analysis</span>
                <span className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Saved reports and Watchdog</span>
              </div>
              <div className="mt-6">
                {isPaid ? (
                  <Link className="tape-button inline-flex bg-emerald-400 px-5 py-3 text-sm text-zinc-950" href="/workspace">
                    Paid Is Active
                  </Link>
                ) : userCanManageBilling ? (
                  <form action={createCheckoutAction}>
                    <input name="organizationId" type="hidden" value={organizationId} />
                    <input name="plan" type="hidden" value="security_pro" />
                    <input name="returnPath" type="hidden" value="/billing?welcome=1" />
                    <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                      Choose Paid ($40/mo)
                    </button>
                  </form>
                ) : (
                  <p className="rounded border border-zinc-800 bg-[#111414] px-4 py-3 text-sm text-zinc-400">
                    Ask an owner or admin to upgrade this account.
                  </p>
                )}
              </div>
            </article>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Current plan</p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                  {getPublicTierLabel(organizationTier)}
                </h2>
              </div>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/pricing">
                Compare Free and Paid
              </Link>
            </div>
            <p className="mt-2 text-sm leading-7 text-stone-700">Status: {subscription?.status ?? "free"}</p>
            <p className="text-sm leading-7 text-stone-700">
              Free includes local Guard and Agent Control. Paid adds hosted workflow, approved upload, Fix with AI, Deep Cloud Analysis, saved reports, and Local Watchdog.
            </p>
            {statusCopy ? (
              <div className="mt-5 rounded border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-7 text-stone-800">
                {statusCopy}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {!userCanManageBilling ? (
                <p className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                  Ask an organization owner or admin to manage billing.
                </p>
              ) : null}
              {userCanManageBilling && !isPaid && shouldShowUpgradeOption(requiredPlan, "security_pro") ? (
                <form action={createCheckoutAction}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="plan" type="hidden" value="security_pro" />
                  <input name="returnPath" type="hidden" value={checkoutReturnPath} />
                  <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                    Upgrade To Paid ($40/mo)
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
              {showEditorReturn ? (
                <a className="tape-button bg-white px-5 py-3 text-sm text-black" href={editorReturnUrl ?? undefined}>
                  {editorReturnLabel(editor)}
                </a>
              ) : null}
              {requiredPlan && requiredSatisfied && source === "extension" ? (
                <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href={appReturnPath}>
                  Open DryLake Web App
                </Link>
              ) : null}
            </div>
            {source === "extension" ? (
              <p className="mt-4 text-sm leading-7 text-stone-700">
                {showEditorReturn
                  ? `After checkout, use ${editorReturnLabel(editor)} to refresh plan access in the editor immediately. You can still open the web app separately if needed.`
                  : requiredPlan
                    ? `After upgrading to Paid, return to VS Code or Cursor to continue. If the direct editor return is unavailable, open the DryLake web app and then reopen the editor.`
                    : "After upgrading, return to VS Code or Cursor to continue. If the direct editor return is unavailable, open the DryLake web app and then reopen the editor."}
              </p>
            ) : null}
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
            <p className="mt-5 text-sm leading-7 text-stone-700">
              Team features are part of Guard for Teams and are intentionally not shown as a public self-serve plan yet.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
