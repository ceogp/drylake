import type { Metadata } from "next";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DryLake pricing: Free local Agent Control and Guard, or Paid for hosted workflow, Fix with AI, and Deep Cloud Analysis.",
};

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "per month",
    eyebrow: "Start locally",
    summary: "Agent Control and Guard basics for individual developers.",
    body: "Run local Guard scans, review workspace risk, connect the extension, and use the core agent-control workflow without starting a paid subscription.",
    ctaLabel: "Register free",
    ctaHref: getConfiguredAppUrlForPath("/sign-up", "redirect_url=%2Fbilling%3Fwelcome%3D1"),
    secondaryLabel: "Install extension",
    secondaryHref: getConfiguredAppUrlForPath("/extensions/install"),
    tone: "default",
    bullets: [
      "Agent Control workspace",
      "Local Guard scan and report",
      "MCP, extension, prompt, secret, and blast-radius review",
      "Copy and open local reports",
      "No cloud upload required",
    ],
  },
  {
    name: "Paid",
    price: "$40",
    cadence: "per month",
    eyebrow: "Full personal workflow",
    summary: "Agent Control plus advanced Guard remediation in one plan.",
    body: "Upgrade when you want approved upload, Fix with AI, Deep Cloud Analysis, saved reports, and local Watchdog while you work.",
    ctaLabel: "Upgrade to Paid",
    ctaHref: getConfiguredAppUrlForPath("/billing", "required=security_pro"),
    secondaryLabel: "Learn Guard",
    secondaryHref: getConfiguredAppUrlForPath("/guard"),
    tone: "featured",
    bullets: [
      "Everything in Free",
      "Hosted planning and saved workflow state",
      "Fix with AI remediation plans",
      "Deep Cloud Analysis with approved upload",
      "Saved security reports and Local Watchdog",
    ],
  },
] as const;

const matrixRows = [
  ["Agent Control", "Included", "Included"],
  ["Local Guard scan", "Included", "Included"],
  ["Local security report", "Included", "Included"],
  ["Hosted planning", "Local/basic", "Included"],
  ["Approved upload", "Not included", "Included"],
  ["Fix with AI", "Not included", "Included"],
  ["Deep Cloud Analysis", "Not included", "Included"],
  ["Saved security reports", "Local only", "Included"],
  ["Local Watchdog", "Not included", "Included"],
  ["Guard for Teams", "Not included", "Available separately"],
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
      ? "inline-flex justify-center rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
      : "inline-flex justify-center rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200";

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
        <section className="rounded-xl border border-zinc-800 bg-[#111414] p-6 shadow-2xl shadow-black/30 md:p-10">
          <div className="max-w-4xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Pricing</p>
            <h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-tight text-zinc-50 sm:text-6xl">
              One DryLake product. Two pillars. Two plans.
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              Every plan includes Agent Control and Guard. Free is useful locally. Paid unlocks the hosted workflow,
              approved upload, Fix with AI, Deep Cloud Analysis, saved reports, and Local Watchdog.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink href={installHref} label="Install extension" />
              <ActionLink href={guardHref} label="See Guard" variant="secondary" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-xl border p-6 md:p-8 ${
                plan.tone === "featured"
                  ? "border-emerald-400/60 bg-zinc-950 shadow-xl shadow-emerald-900/20"
                  : "border-zinc-800 bg-[#111414]"
              }`}
            >
              <p className={`font-mono text-xs font-semibold uppercase tracking-[0.18em] ${plan.tone === "featured" ? "text-emerald-300" : "text-orange-300"}`}>
                {plan.eyebrow}
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <h2 className="font-[family-name:var(--font-heading)] text-4xl font-semibold text-zinc-50">{plan.name}</h2>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold text-zinc-50">{plan.price}</span>
                  <span className="pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{plan.cadence}</span>
                </div>
              </div>
              <p className="mt-4 text-base font-semibold text-zinc-200">{plan.summary}</p>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{plan.body}</p>
              <div className="mt-6 grid gap-3">
                {plan.bullets.map((bullet) => (
                  <div key={bullet} className="rounded border border-zinc-800 bg-[#090a0a] px-4 py-3 text-sm text-zinc-300">
                    {bullet}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ActionLink href={plan.ctaHref} label={plan.ctaLabel} />
                <ActionLink href={plan.secondaryHref} label={plan.secondaryLabel} variant="secondary" />
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-[#111414] p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Simple comparison</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
              Free gets the local workflow. Paid gets the full workflow.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              Guard for Teams is a team layer of Guard, not a separate public product. Keep the public decision simple:
              start free or upgrade to Paid when you need remediation and cloud analysis.
            </p>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-zinc-300">
              <thead>
                <tr>
                  <th className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Feature</th>
                  <th className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Free</th>
                  <th className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Paid</th>
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
