import type { Metadata } from "next";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare DryLake Free, Pro, Security Pro, Team Security, and Enterprise plans for agent control and Guard security.",
};

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "per month",
    summary: "Local-first entry point for Guard and agent control.",
    body: "Install the extension, connect your workspace, run a local Guard scan, review results locally, and keep using the planning and handoff surface without a paid security plan.",
    ctaLabel: "Register free",
    ctaHref: getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace"),
    secondaryLabel: "Install extension",
    secondaryHref: getConfiguredAppUrlForPath("/extensions/install"),
    tone: "default",
  },
  {
    name: "Pro",
    price: "$10",
    cadence: "per month",
    summary: "Hosted planning and broader account-level workflow.",
    body: "Use DryLake hosted planning, saved planning sessions, and web-based workflow management when the team wants more than local-only handoffs.",
    ctaLabel: "Upgrade to Pro",
    ctaHref: getConfiguredAppUrlForPath("/billing"),
    secondaryLabel: "Compare Guard tiers",
    secondaryHref: getConfiguredAppUrlForPath("/guard"),
    tone: "default",
  },
  {
    name: "Security Pro",
    price: "$40",
    cadence: "per month",
    summary: "Paid personal Guard workflow.",
    body: "Approve redacted upload, run Fix with AI and Deep Cloud Analysis, keep saved personal reports, and unlock paid remediation without committing the whole organization to Team Security.",
    ctaLabel: "Upgrade to Security Pro",
    ctaHref: getConfiguredAppUrlForPath("/billing"),
    secondaryLabel: "Learn Guard",
    secondaryHref: getConfiguredAppUrlForPath("/guard"),
    tone: "featured",
  },
  {
    name: "Team Security",
    price: "Custom / managed",
    cadence: "team",
    summary: "Shared Guard operations for the organization.",
    body: "Move from personal reports to shared history, Team Baseline, policy, allowlists and denylists, and Continuous Watch drift visibility across the organization.",
    ctaLabel: "Talk to us",
    ctaHref: "mailto:support@xupracorp.com?subject=DryLake%20Team%20Security",
    secondaryLabel: "Open billing",
    secondaryHref: getConfiguredAppUrlForPath("/billing"),
    tone: "default",
  },
  {
    name: "Enterprise",
    price: "Contact us",
    cadence: "enterprise",
    summary: "Procurement, deployment, and higher-touch operating model.",
    body: "For organizations that need enterprise purchasing, rollout support, or deeper operational requirements around deployment, access, and security review.",
    ctaLabel: "Contact sales",
    ctaHref: "mailto:ceo@xupracorp.com?subject=DryLake%20Enterprise",
    secondaryLabel: "Read about Guard",
    secondaryHref: getConfiguredAppUrlForPath("/guard"),
    tone: "default",
  },
] as const;

const matrixRows = [
  ["Local Guard scan", "Included", "Included", "Included", "Included", "Included"],
  ["Local report review", "Included", "Included", "Included", "Included", "Included"],
  ["Agent planning and handoffs", "Included", "Included", "Included", "Included", "Included"],
  ["Hosted planning", "Not included", "Included", "Included", "Included", "Included"],
  ["Approved upload", "Not included", "Not included", "Included", "Included", "Included"],
  ["Fix with AI", "Not included", "Not included", "Included", "Included", "Included"],
  ["Deep Cloud Analysis", "Not included", "Not included", "Included", "Included", "Included"],
  ["Saved website reports", "Local only", "Planning only", "Personal", "Shared team history", "Shared team history"],
  ["Local Watchdog", "Not included", "Not included", "Included", "Included", "Included"],
  ["Team Baseline", "Not included", "Not included", "Not included", "Included", "Included"],
  ["Continuous Watch", "Not included", "Not included", "Not included", "Included", "Included"],
  ["Team policy", "Not included", "Not included", "Not included", "Included", "Included"],
] as const;

function ActionLink({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
      : "inline-flex rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200";

  return (
    <a className={className} href={href}>
      {label}
    </a>
  );
}

export default function PricingPage() {
  const guardHref = getConfiguredAppUrlForPath("/guard");
  const installHref = getConfiguredAppUrlForPath("/extensions/install");

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-lg border border-zinc-800 bg-[#111414] p-6 md:p-8">
          <div className="max-w-4xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Pricing</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
              One product, two pillars: agent control and Guard security.
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              Free starts with local Guard scan and local workflow value. Pro adds hosted planning.
              Security Pro adds personal paid remediation. Team Security extends Guard into shared
              reports, baselines, policy, and Continuous Watch.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink href={installHref} label="Install extension" />
              <ActionLink href={guardHref} label="Learn Guard" variant="secondary" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-5">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-lg border p-6 ${
                plan.tone === "featured"
                  ? "border-emerald-400/50 bg-zinc-950 shadow-lg shadow-emerald-900/20"
                  : "border-zinc-800 bg-[#111414]"
              }`}
            >
              <p className={`font-mono text-xs font-semibold uppercase tracking-[0.18em] ${plan.tone === "featured" ? "text-emerald-300" : "text-zinc-500"}`}>
                {plan.name}
              </p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold text-zinc-50">{plan.price}</span>
                <span className="pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{plan.cadence}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-zinc-200">{plan.summary}</p>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{plan.body}</p>
              <div className="mt-6 flex flex-col gap-3">
                <ActionLink href={plan.ctaHref} label={plan.ctaLabel} />
                <ActionLink href={plan.secondaryHref} label={plan.secondaryLabel} variant="secondary" />
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Feature matrix</p>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-50">The public source of truth for plan boundaries.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              Billing should handle upgrades and entitlements. This page should explain what each plan actually means.
            </p>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-zinc-300">
              <thead>
                <tr>
                  <th className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.name} className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td
                        key={`${row[0]}-${index}`}
                        className={`border-b border-zinc-900 px-4 py-3 align-top ${index === 0 ? "font-medium text-zinc-100" : "text-zinc-400"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
