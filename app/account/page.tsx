import Link from "next/link";

import { openBillingPortalAction, updateProfileAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization, type EntitlementKey } from "@/lib/services/entitlements";

const ENTITLEMENT_ITEMS: Array<{ key: EntitlementKey; label: string; description: string }> = [
  {
    key: "canUseHostedPlanning",
    label: "Hosted planning",
    description: "Hosted planning chat and AI-generated phase plans.",
  },
  {
    key: "canUseFixWithAI",
    label: "Fix with AI",
    description: "Paid Guard remediation plans generated from redacted local scan findings.",
  },
  {
    key: "canUseApprovedUpload",
    label: "Approved upload",
    description: "Approved redacted upload path for saved reports and cloud-backed analysis.",
  },
  {
    key: "canUseDeepCloudAnalysis",
    label: "Deep Cloud Analysis",
    description: "Cloud-backed review from approved metadata and saved Guard reports.",
  },
  {
    key: "canUseLocalWatchdog",
    label: "Local Watchdog",
    description: "Local follow-up monitoring tied to the Guard workflow.",
  },
  {
    key: "canUseTeamBaseline",
    label: "Team Baseline",
    description: "Shared baseline and drift comparison for Team Security workspaces.",
  },
  {
    key: "canUseContinuousWatch",
    label: "Continuous Watch",
    description: "Recurring team-level watch history and drift events.",
  },
  {
    key: "canManageTeamPolicy",
    label: "Team policy",
    description: "Allowlist and denylist management for shared team Guard workflows.",
  },
];

const ACCOUNT_LINKS = [
  { label: "Workspace", href: "/workspace", detail: "Open Agent Control." },
  { label: "Skills", href: "/skills", detail: "Open the skills library." },
  { label: "Security reports", href: "/security/reports", detail: "Open saved Guard reports." },
  { label: "Billing", href: "/billing", detail: "Manage plan and payment details." },
];

function publicTierLabel(value: string | null | undefined) {
  const normalized = (value ?? "free").toLowerCase();
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

function canManageBilling(role: string) {
  return role === "owner" || role === "admin";
}

function billingStatusLabel(value: string | null | undefined) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Free";
}

function isPaidTierLabel(value: string) {
  return value === "Pro" || value === "Security Pro" || value === "Team Security" || value === "Enterprise";
}

function PlanBadge({ tier }: { tier: string }) {
  const paid = isPaidTierLabel(tier);

  return (
    <span
      className={`inline-flex rounded border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.16em] ${
        paid
          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
          : "border-zinc-700 bg-zinc-950 text-zinc-300"
      }`}
    >
      {tier}
    </span>
  );
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

function ProfileInput({
  label,
  name,
  value,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | null;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input
        autoComplete={autoComplete}
        className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400"
        defaultValue={value ?? ""}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function EntitlementCard({
  enabled,
  label,
  description,
}: {
  enabled: boolean;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <span className={enabled ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-zinc-500"}>
          {enabled ? "Enabled" : "Locked"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
    </div>
  );
}

export default async function AccountPage() {
  const context = await requireCompletedOnboardingAppContextForPage("/account");
  const [{ entitlements }, subscription] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.subscription.findUnique({
      where: { organizationId: context.organization.id },
    }),
  ]);
  const profile = context.user.profile;
  const displayName = profile?.displayName ?? context.user.email;
  const tier = publicTierLabel(subscription?.tier ?? context.organization.tier);
  const paid = isPaidTierLabel(tier);
  const userCanManageBilling = canManageBilling(context.activeMembership.role);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="tape-eyebrow">Account</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-zinc-50">
              Your account
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-300">
              Profile, organization, and plan details for {context.organization.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/workspace">
              Workspace
            </Link>
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
              Billing
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="tape-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Current plan</p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-zinc-50">
                  {tier}
                </h2>
              </div>
              <PlanBadge tier={tier} />
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-400">
              {paid
                ? "Paid access is active. Use billing to manage checkout, the portal, and the full plan comparison."
                : "Free access is active. Local Guard scan and local report review are available without a paid security plan."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {userCanManageBilling ? (
                <Link className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" href="/billing">
                  Manage Billing
                </Link>
              ) : (
                <p className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                  Ask an organization owner or admin to manage billing.
                </p>
              )}
              {paid && subscription?.stripeCustomerId ? (
                <form action={openBillingPortalAction}>
                  <input name="organizationId" type="hidden" value={context.organization.id} />
                  <input name="returnPath" type="hidden" value="/account" />
                  <button className="tape-button bg-white px-5 py-3 text-sm text-black" type="submit">
                    Open Billing Portal
                  </button>
                </form>
              ) : null}
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/pricing">
                Compare Plans
              </Link>
            </div>
          </article>

          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Profile</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              {displayName}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailCard label="Email" value={context.user.email} />
              <DetailCard label="Phone" value={profile?.phoneNumber ?? "Not set"} />
              <DetailCard label="Country" value={profile?.country ?? "Not set"} />
              <DetailCard label="Timezone" value={profile?.timezone ?? "UTC"} />
              <DetailCard label="Locale" value={profile?.locale ?? "en-US"} />
              <DetailCard label="Role" value={context.activeMembership.role} />
            </div>
          </article>
        </section>

        <section className="tape-panel p-6">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Profile and contact details</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              Add the basics for billing, account recovery, and support.
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              These details are saved to your DryLake profile after sign-in. They are not used to block signup.
            </p>
          </div>
          <form action={updateProfileAction} className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileInput autoComplete="name" label="Full name" name="displayName" placeholder="Jane Developer" value={profile?.displayName ?? ""} />
            <ProfileInput autoComplete="tel" label="Phone number" name="phoneNumber" placeholder="+1 555 0100" value={profile?.phoneNumber} />
            <ProfileInput autoComplete="country-name" label="Country" name="country" placeholder="United States" value={profile?.country} />
            <ProfileInput autoComplete="address-line1" label="Address line 1" name="addressLine1" placeholder="123 Market Street" value={profile?.addressLine1} />
            <ProfileInput autoComplete="address-line2" label="Address line 2" name="addressLine2" placeholder="Suite, floor, building" value={profile?.addressLine2} />
            <ProfileInput autoComplete="address-level2" label="City" name="city" placeholder="San Francisco" value={profile?.city} />
            <ProfileInput autoComplete="address-level1" label="State / region" name="region" placeholder="CA" value={profile?.region} />
            <ProfileInput autoComplete="postal-code" label="Postal code" name="postalCode" placeholder="94105" value={profile?.postalCode} />
            <ProfileInput autoComplete="off" label="Timezone" name="timezone" placeholder="America/Los_Angeles" value={profile?.timezone ?? "UTC"} />
            <ProfileInput autoComplete="language" label="Locale" name="locale" placeholder="en-US" value={profile?.locale ?? "en-US"} />
            <div className="md:col-span-2">
              <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                Save profile
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Organization</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              {context.organization.name}
            </h2>
            <div className="mt-6 grid gap-4">
              <DetailCard label="Billing status" value={billingStatusLabel(subscription?.status)} />
              <DetailCard label="Billing provider" value={subscription?.provider ?? "Local"} />
              <DetailCard label="Memberships" value={String(context.memberships.length)} />
            </div>
          </article>

          <article className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Account paths</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              Quick links.
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {ACCOUNT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-zinc-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
                  href={item.href}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-zinc-500">{item.detail}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="tape-panel p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Plan access</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
            Current entitlements.
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ENTITLEMENT_ITEMS.map(({ key, label, description }) => {
              const enabled = Boolean(entitlements[key]);

              return (
                <EntitlementCard
                  key={key}
                  description={description}
                  enabled={enabled}
                  label={label}
                />
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
