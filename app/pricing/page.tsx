import type { Metadata } from "next";
import Link from "next/link";

import { ArrowTape, TapePanel } from "@/components/tape-brand";
import { getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare DryLake free and Pro plans for visual coding-agent planning.",
};

const freeFeatures = [
  "Create a workspace and use the visual planning board.",
  "Review phases, steps, and validation notes.",
  "Copy or export prompts and Markdown handoffs.",
  "Use local handoffs with your installed coding agents.",
];

const proFeatures = [
  "Xupra AI planning chat for changing scope live.",
  "AI-generated runbooks from tickets, specs, bugs, and feature requests.",
  "Cloud-backed planning sessions tied to your account.",
  "Priority path for team and enterprise workflow features.",
];

function SignUpLink({
  children,
  redirectPath = "/workspace",
  variant = "yellow",
}: {
  children: React.ReactNode;
  redirectPath?: string;
  variant?: "yellow" | "white";
}) {
  const href = getConfiguredAppUrlForPath("/sign-up", `redirect_url=${redirectPath}`);
  const className = variant === "white"
    ? "tape-button inline-block bg-white px-5 py-3 text-sm text-black"
    : "tape-button inline-block bg-[#ffd60a] px-5 py-3 text-sm text-black";

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export default function PricingPage() {
  return (
    <main className="tape-page min-h-screen px-4 py-12 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <TapePanel className="bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="tape-eyebrow">Pricing</p>
              <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-black uppercase leading-tight text-stone-950 sm:text-5xl">
                Start free. Upgrade when you want hosted AI planning.
              </h1>
              <p className="mt-5 text-lg leading-8 text-stone-700">
                Free is for using DryLake as the visual control room. Pro adds Xupra-hosted AI that
                turns messy tickets into phases and updates the plan from chat.
              </p>
            </div>
            <ArrowTape color="#111111" className="h-10 w-28" />
          </div>
        </TapePanel>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="tape-panel bg-white p-6">
            <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-stone-500">Free</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-[family-name:var(--font-heading)] text-5xl font-black text-stone-950">$0</span>
              <span className="pb-2 font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-500">per month</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-stone-700">
              For individuals who want a planner and clean handoff surface for agents already installed locally.
            </p>
            <ul className="mt-6 grid gap-3">
              {freeFeatures.map((feature) => (
                <li key={feature} className="border-[3px] border-black bg-[#f7f4ea] px-4 py-3 text-sm font-semibold leading-6 text-stone-800">
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <SignUpLink variant="white">Sign Up Free</SignUpLink>
            </div>
          </article>

          <article className="tape-panel bg-[#111111] p-6 text-white">
            <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-[#ffd60a]">Pro</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-[family-name:var(--font-heading)] text-5xl font-black text-white">$10</span>
              <span className="pb-2 font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-300">per month</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-stone-200">
              For users who want DryLake to generate and update the phase plan with hosted AI.
            </p>
            <ul className="mt-6 grid gap-3">
              {proFeatures.map((feature) => (
                <li key={feature} className="border-[3px] border-white bg-[#005caf] px-4 py-3 text-sm font-semibold leading-6 text-white">
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <SignUpLink redirectPath="/billing">Start Pro</SignUpLink>
              <Link className="tape-button inline-block bg-white px-5 py-3 text-sm text-black" href="/billing">
                Manage Billing
              </Link>
            </div>
          </article>
        </section>

        <TapePanel className="bg-[#ffd60a] p-6">
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-black/70">Current supported handoffs</p>
          <p className="mt-3 text-base font-black leading-7 text-black">
            Claude Code, OpenAI Codex, Gemini CLI, Cursor CLI, and GitHub Copilot Chat. Only verified
            handoff paths are shown in the public interface.
          </p>
        </TapePanel>
      </section>
    </main>
  );
}
