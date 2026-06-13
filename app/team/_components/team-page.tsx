import Link from "next/link";

import type { ResolvedEntitlements } from "@/lib/services/entitlements";

const TEAM_LINKS = [
  { href: "/team", label: "Overview" },
  { href: "/team/billing", label: "Billing" },
  { href: "/team/members", label: "Members" },
  { href: "/team/security", label: "Security" },
  { href: "/team/security/baseline", label: "Baseline" },
  { href: "/team/security/policy", label: "Policy" },
];

export function canManageTeam(role: string) {
  return role === "owner" || role === "admin";
}

export function TeamPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tape-eyebrow">Team Security</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-zinc-50">{title}</h1>
            {subtitle ? <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">{subtitle}</p> : null}
          </div>
          <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
            Billing
          </Link>
        </div>
        <nav className="flex flex-wrap gap-2">
          {TEAM_LINKS.map((item) => (
            <Link key={item.href} className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-emerald-400/50" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}

export function CapabilityRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
      <span className="text-zinc-300">{label}</span>
      <span className={enabled ? "font-semibold text-emerald-300" : "font-semibold text-zinc-500"}>
        {enabled ? "enabled" : "locked"}
      </span>
    </div>
  );
}

export function TeamEntitlementGrid({ entitlements }: { entitlements: ResolvedEntitlements }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CapabilityRow enabled={entitlements.canUseTeamBaseline} label="Team Baseline" />
      <CapabilityRow enabled={entitlements.canUseContinuousWatch} label="Continuous Watch" />
      <CapabilityRow enabled={entitlements.canManageTeamPolicy} label="Team policy" />
      <CapabilityRow enabled={entitlements.canCreateTeam} label="Team administration" />
    </div>
  );
}
