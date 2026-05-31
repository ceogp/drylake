import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization, type EntitlementKey } from "@/lib/services/entitlements";

const ENTITLEMENT_ITEMS: Array<{ key: EntitlementKey; label: string }> = [
  { key: "xupra_pro_ai", label: "Hosted Xupra AI" },
  { key: "session_cloud_sync", label: "Session Cloud Sync" },
  { key: "pr_summary_generation", label: "PR Summary Generation" },
];

function publicTierLabel(value: string | null | undefined) {
  const normalized = (value ?? "free").toLowerCase();
  if (normalized === "enterprise") {
    return "Pro";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-zinc-200">{value}</p>
    </div>
  );
}

export default async function AccountPage() {
  const context = await requireCurrentAppContextForPage();
  const [{ entitlements }, subscription] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.subscription.findUnique({
      where: { organizationId: context.organization.id },
    }),
  ]);
  const profile = context.user.profile;
  const displayName = profile?.displayName ?? context.user.email;
  const tier = publicTierLabel(subscription?.tier ?? context.organization.tier);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="tape-eyebrow">Account</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-zinc-50">
              Billing and account.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-300">
              Review your signed-in profile, active organization, plan, and DryLake entitlements.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/settings">
              Settings
            </Link>
            <Link className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" href="/billing">
              Billing
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Profile</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              {displayName}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailCard label="Email" value={context.user.email} />
              <DetailCard label="Timezone" value={profile?.timezone ?? "UTC"} />
              <DetailCard label="Locale" value={profile?.locale ?? "en-US"} />
              <DetailCard label="Role" value={context.activeMembership.role} />
            </div>
          </article>

          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Organization</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              {context.organization.name}
            </h2>
            <div className="mt-6 grid gap-4">
              <DetailCard label="Plan" value={tier} />
              <DetailCard label="Billing Status" value={subscription?.status ?? "Trial"} />
              <DetailCard label="Billing Provider" value={subscription?.provider ?? "Local"} />
            </div>
          </article>
        </section>

        <section className="tape-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Entitlements</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
                Current access.
              </h2>
            </div>
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
              Manage Plan
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {ENTITLEMENT_ITEMS.map(({ key, label }) => {
              const enabled = Boolean(entitlements[key]);

              return (
                <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                  <p className={enabled ? "mt-2 text-sm font-semibold text-emerald-300" : "mt-2 text-sm font-semibold text-zinc-500"}>
                    {enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
