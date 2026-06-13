import Image from "next/image";
import type { Metadata } from "next";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Guard Security",
  description:
    "Understand DryLake Guard: local scan coverage, approved upload, Security Pro remediation, and Team Security baselines.",
};

const localCoverage = [
  "MCP servers, commands, and config paths",
  "IDE extensions and publishers",
  "Skills, rules, prompts, and risky workspace artifacts",
  "Secrets, .env exposure, and private-key signals",
  "Blast radius and suspicious workspace surface changes",
];

const trustRules = [
  "Local Guard scan runs before paid cloud analysis is even relevant.",
  "Approved upload uses redacted findings and structured metadata only.",
  "Raw secrets, .env values, private keys, and full source files are not uploaded by default.",
  "Saved reports separate personal history from team-shared security state.",
  "Team Security adds policy, baselines, and recurring watch checks rather than replacing local review.",
];

const productLayers = [
  {
    title: "Free local Guard",
    detail:
      "Run the extension locally, scan your workspace, inspect Guard findings, and keep the first security pass inside the editor.",
    includes: ["Local scan", "Local report review", "Extension connection", "No paid upload required"],
  },
  {
    title: "Security Pro",
    detail:
      "Approve redacted upload when you want Fix with AI, Deep Cloud Analysis, saved reports, and personal paid remediation workflows.",
    includes: ["Approved upload", "Fix with AI", "Deep Cloud Analysis", "Saved personal reports", "Local Watchdog"],
  },
  {
    title: "Team Security",
    detail:
      "Share the security workflow across the organization with baselines, policy, recurring drift checks, and shared report history.",
    includes: ["Shared reports", "Team Baseline", "Team policy", "Continuous Watch", "Recurring drift history"],
  },
];

const teamSecurityOutcomes = [
  "Detect new MCP tools and extensions against the established baseline.",
  "Record baseline drift, suspicious artifacts, and policy violations in one place.",
  "Re-open saved reports on the website and compare them against team history.",
  "Treat Guard as an operational review surface, not just a one-time scan.",
];

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

export default function GuardPage() {
  const signUpHref = getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace");
  const installHref = getConfiguredAppUrlForPath("/extensions/install");
  const pricingHref = getConfiguredAppUrlForPath("/pricing");

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="grid gap-8 rounded-lg border border-zinc-800 bg-[#111414] p-6 md:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
          <div className="space-y-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Guard Security</p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              Guard gives DryLake a local-first security layer before agents execute.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-300">
              Start with a local scan for MCP servers, extensions, prompt-injection risk, secrets,
              and blast radius. Approve redacted upload only when you want deeper remediation, saved
              reports, or shared team security workflows.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={installHref} label="Install extension" />
              <ActionLink href={pricingHref} label="View pricing" variant="secondary" />
              <ActionLink href={signUpHref} label="Register free" variant="secondary" />
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-2">
            <Image
              src="/marketplace/extension/media/guard-security.gif"
              alt="DryLake Guard workflow overview"
              width={1120}
              height={630}
              unoptimized
              className="aspect-video w-full bg-[#080b0a] object-cover object-top"
            />
            <Image
              src="/marketplace/extension/media/guard-paid-features.gif"
              alt="DryLake Guard paid features overview"
              width={1280}
              height={720}
              unoptimized
              className="aspect-video w-full bg-[#080b0a] object-cover object-top"
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">What Guard scans locally</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl">
              The first decision stays in the editor.
            </h2>
            <p className="mt-4 text-base leading-8 text-zinc-300">
              Guard is designed so the user can inspect agent risk before they choose any paid upload or team-level workflow.
            </p>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {localCoverage.map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {productLayers.map((layer) => (
            <article key={layer.title} className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{layer.title}</p>
              <p className="mt-4 text-sm leading-7 text-zinc-300">{layer.detail}</p>
              <div className="mt-5 grid gap-3">
                {layer.includes.map((item) => (
                  <div key={item} className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]" id="team-security">
          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Approval and trust boundary</p>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-50">Paid upload is explicit and reviewable.</h2>
            <div className="mt-5 grid gap-3">
              {trustRules.map((rule) => (
                <div key={rule} className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-300">
                  {rule}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">What Team Security adds</p>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-50">Shared drift and policy review for the team.</h2>
            <div className="mt-5 grid gap-3">
              {teamSecurityOutcomes.map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-[#111414] px-4 py-3 text-sm leading-6 text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink href={pricingHref} label="Compare security tiers" />
              <a
                className="inline-flex rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200"
                href="mailto:support@xupracorp.com?subject=DryLake%20Team%20Security"
              >
                Talk about Team Security
              </a>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
