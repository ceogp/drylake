import Link from "next/link";

import { getConfiguredAdminInternalOrigin } from "@/lib/site-hosts";
import { getIsPlatformAdmin } from "@/lib/services/access";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-3 text-sm leading-7 text-stone-800">{value}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const appContext = await requireCurrentAppContextForPage();
  const isPlatformAdmin = await getIsPlatformAdmin();
  const adminInternalOrigin = getConfiguredAdminInternalOrigin();
  const profile = appContext.user.profile;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">User Settings</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
              Account, organization, and personal defaults.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              This page is for the signed-in user. Admin-wide data and platform controls live under the admin surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/app">
              Back To App
            </Link>
            <Link className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/billing">
              Billing
            </Link>
            {isPlatformAdmin && adminInternalOrigin ? (
              <a
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
                href={`${adminInternalOrigin}/admin`}
              >
                Open Internal Admin
              </a>
            ) : null}
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Profile</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              {profile?.displayName ?? appContext.user.email}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailCard label="Email" value={appContext.user.email} />
              <DetailCard label="Locale" value={profile?.locale ?? "en-US"} />
              <DetailCard label="Timezone" value={profile?.timezone ?? "UTC"} />
              <DetailCard label="Job Title" value={profile?.jobTitle ?? "Not set"} />
              <DetailCard
                label="Platform Access"
                value={isPlatformAdmin ? "Platform admin access enabled." : "Standard customer access."}
              />
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Active Organization</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              {appContext.organization.name}
            </h2>
            <div className="mt-5 space-y-2 text-sm leading-7 text-stone-700">
              <p>Role: {appContext.activeMembership.role}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] ${
                    appContext.organization.tier === "pro"
                      ? "border border-green-300 bg-green-50 text-green-700"
                      : appContext.organization.tier === "enterprise"
                        ? "border border-purple-300 bg-purple-50 text-purple-700"
                      : "border border-stone-300 bg-stone-100 text-stone-600"
                  }`}
                >
                  {appContext.organization.tier === "pro"
                    ? "Pro"
                    : appContext.organization.tier === "enterprise"
                      ? "Enterprise"
                      : "Free"}
                </span>
                {appContext.organization.tier === "free" ? (
                  <Link
                    className="rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
                    href="/billing"
                  >
                    Upgrade to Pro
                  </Link>
                ) : null}
              </div>
              <p>Status: {appContext.organization.status}</p>
              <p>Memberships: {appContext.memberships.length}</p>
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Available Organizations</p>
              <div className="mt-3 space-y-3 text-sm leading-7 text-stone-700">
                {appContext.memberships.map((membership) => (
                  <div key={membership.organizationId} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                    <span>{membership.organization.name}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Workspace Links</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Recommended next steps
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Keep the first run focused on import. Billing and account settings are fine here, but
              credential and integration setup stay out of the normal onboarding path.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <Link className="rounded-2xl border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50" href="/app">
                Open Dashboard
              </Link>
              <Link className="rounded-2xl border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50" href="/extensions/connect">
                Install or reconnect extension
              </Link>
              <Link className="rounded-2xl border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50" href="/billing">
                Billing and plan
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
