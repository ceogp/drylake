import Link from "next/link";
import { redirect } from "next/navigation";

import { createCheckoutAction } from "@/app/actions";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

function normalizeSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeReturnPath(value: string | string[] | undefined) {
  const rawValue = normalizeSearchValue(value).trim();

  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/skills";
  }

  try {
    const parsed = new URL(rawValue, "http://xupra.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/skills";
  }
}

export default async function OnboardingPlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const context = await requireCurrentAppContextForPage();
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const returnTo = safeReturnPath(resolvedSearchParams.returnTo);

  if (!context.user.profile?.onboardingCompletedAt) {
    redirect(`/onboarding/profile?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const { entitlements } = await getEntitlementsForOrganization(context.organization.id, { userId: context.user.id });
  const paidActive =
    Boolean(entitlements.canUseFixWithAI) ||
    Boolean(entitlements.canUseApprovedUpload) ||
    Boolean(entitlements.canUseDeepCloudAnalysis) ||
    Boolean(entitlements.canUseLocalWatchdog);
  const isExtensionReturn = returnTo.startsWith("/extensions/connect");
  const freeHref = returnTo;

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-2xl border border-zinc-800 bg-[#111414] p-8 shadow-2xl shadow-black/40">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Final step
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-tight text-zinc-50">
            Choose how to start DryLake.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            Free gives you local Agent Control and local Guard. Paid adds cloud-backed Guard workflows,
            Fix with AI, Deep Cloud Analysis, saved reports, and Local Watchdog.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-[#111414] p-8 shadow-2xl shadow-black/30">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Free</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold text-zinc-50">
              Start with local workflow
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              Use Agent Control, run local Guard scans, open reports, and keep everything local first.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-zinc-300">
              <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Agent Control</div>
              <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Local Guard scan</div>
              <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">No card required</div>
            </div>
            <Link className="mt-8 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200" href={freeHref}>
              {isExtensionReturn ? "Continue to connection" : "Continue free"}
            </Link>
          </article>

          <article className="rounded-2xl border border-emerald-400/50 bg-zinc-950 p-8 shadow-2xl shadow-emerald-900/20">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Paid</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold text-zinc-50">
              Unlock the full Guard workflow
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Paid adds approved upload, Fix with AI, Deep Cloud Analysis, saved reports, and Local Watchdog.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-zinc-300">
              <div className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Fix with AI</div>
              <div className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Deep Cloud Analysis</div>
              <div className="rounded border border-zinc-800 bg-[#111414] px-4 py-3">Saved reports and Watchdog</div>
            </div>
            <div className="mt-8">
              {paidActive ? (
                <Link className="inline-flex rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href={freeHref}>
                  Paid is already active
                </Link>
              ) : (
                <form action={createCheckoutAction}>
                  <input name="organizationId" type="hidden" value={context.organization.id} />
                  <input name="plan" type="hidden" value="security_pro" />
                  <input name="returnPath" type="hidden" value={returnTo} />
                  <button className="inline-flex rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" type="submit">
                    Continue to checkout
                  </button>
                </form>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
