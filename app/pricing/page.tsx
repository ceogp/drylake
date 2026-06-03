import type { Metadata } from "next";
import Link from "next/link";

import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare DryLake free and Pro plans for visual coding-agent planning.",
};

const freeFeatures = [
  "Use free AI planning cards for coding-agent work.",
  "Review phases, steps, token estimates, and validation notes.",
  "Copy or export prompts and Markdown handoffs.",
  "Run local handoffs with your installed coding agents.",
];

const proFeatures = [
  "Xupra AI Frontier planning for larger or more complex tickets.",
  "AI-generated and AI-refined build plans from tickets, specs, bugs, and feature requests.",
  "Cloud-backed planning sessions tied to your account.",
  "Priority path for team, admin, and enterprise workflow features.",
];

const supportedAgents = [
  "Claude Code",
  "OpenAI Codex",
  "Gemini CLI",
  "Hermes Agent",
  "Cursor CLI",
  "GitHub Copilot Chat",
  "Blackbox CLI",
  "Goose CLI",
  "OpenCode",
  "Qwen Code",
  "Continue CLI",
  "Cline CLI",
  "Aider",
  "Kilo Code",
  "Auggie CLI",
];

function SignUpLink({
  children,
  redirectPath = "/workspace",
  variant = "primary",
}: {
  children: React.ReactNode;
  redirectPath?: string;
  variant?: "primary" | "secondary";
}) {
  const href = getConfiguredAppUrlForPath("/sign-up", `redirect_url=${redirectPath}`);
  const className = variant === "secondary"
    ? "inline-flex rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200"
    : "inline-flex rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300";

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-lg border border-zinc-800 bg-[#111414] p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Pricing</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
              Start free. Upgrade when you want Frontier planning.
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              Free gives users the visual control room for phase cards, skills, and local handoffs.
              Pro adds Xupra-hosted planning for bigger tickets and more demanding workflows.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Free</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-semibold text-zinc-50">$0</span>
              <span className="pb-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">per month</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              For individuals who want a planner and clean handoff surface for agents already installed locally.
            </p>
            <ul className="mt-6 grid gap-3">
              {freeFeatures.map((feature) => (
                <li key={feature} className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium leading-6 text-zinc-300">
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <SignUpLink variant="secondary">Register free</SignUpLink>
            </div>
          </article>

          <article className="rounded-lg border border-emerald-400/40 bg-zinc-950 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Pro</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-semibold text-zinc-50">$10</span>
              <span className="pb-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">per month</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              For users who want DryLake to generate and update the phase plan with hosted AI.
            </p>
            <ul className="mt-6 grid gap-3">
              {proFeatures.map((feature) => (
                <li key={feature} className="rounded border border-zinc-800 bg-[#111414] px-4 py-3 text-sm font-medium leading-6 text-zinc-300">
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <SignUpLink redirectPath="/billing">Upgrade to Pro</SignUpLink>
              <Link className="inline-flex rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href="/billing">
                Manage Billing
              </Link>
              <Link className="inline-flex rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href="/account">
                Account
              </Link>
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-orange-400/30 bg-orange-400/10 p-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Current supported handoffs
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7 text-orange-100">
            DryLake launches focused handoff prompts for the agents users already keep in their IDE
            or terminal. Install the matching CLI locally for direct terminal handoff, or use the
            Markdown prompt fallback when a direct launch is not available.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {supportedAgents.map((agent) => (
              <span
                key={agent}
                className="rounded border border-orange-300/30 bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-orange-100"
              >
                {agent}
              </span>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
