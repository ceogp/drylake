import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import {
  ArrowTape,
  TapePanel,
  TapeWord,
  tapeColors,
} from "@/components/tape-brand";
import {
  getConfiguredAppUrlForPath,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";
import { installTargets } from "@/lib/install-targets";

const steps = [
  { id: "01", title: "Plan", body: "Drop in a ticket, bug report, feature request, or product spec.", bg: tapeColors.yellow, fg: tapeColors.ink },
  { id: "02", title: "Organize", body: "DryLake splits the work into ordered kanban phases with steps and validation.", bg: tapeColors.blue, fg: tapeColors.white },
  { id: "03", title: "Handoff", body: "Pick Claude Code, Codex, Gemini, Cursor CLI, or Copilot Chat and run the phase handoff.", bg: tapeColors.green, fg: tapeColors.ink },
];

function ActionLink({ href, children, variant = "yellow" }: { href: string; children: ReactNode; variant?: "yellow" | "white" }) {
  const className = variant === "white"
      ? "rounded-[4px] border-[4px] border-black bg-white px-5 py-3 text-sm font-black uppercase text-black shadow-[5px_5px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111]"
      : "rounded-[4px] border-[4px] border-black bg-[#ffd60a] px-5 py-3 text-sm font-black uppercase text-black shadow-[5px_5px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111]";

  if (href.startsWith("/")) {
    return <Link className={className} href={href}>{children}</Link>;
  }

  return <a className={className} href={href}>{children}</a>;
}

function PhaseBoard() {
  return (
    <TapePanel className="bg-[#111111] text-white">
      <div className="grid h-full gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffd60a]">DryLake flow</p>
          <ArrowTape color="#ffd60a" />
        </div>
        <div className="grid gap-3">
          {steps.map((step) => (
            <article key={step.id} className="rounded-[6px] border-[4px] border-white p-4" style={{ background: step.bg, color: step.fg }}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-3xl font-black">{step.id}</span>
                <ArrowTape color={step.fg} className="h-8 w-20" />
              </div>
              <h2 className="mt-3 text-xl font-black uppercase leading-none">{step.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-5 opacity-85">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </TapePanel>
  );
}

function PlatformPanel() {
  const signUpHref = getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace");

  return (
    <TapePanel className="bg-white">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-black uppercase leading-none">Agent handoffs</h2>
          <ArrowTape color="#111111" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {installTargets.map((target) => (
            <Link
              key={target.slug}
              className="border-[4px] border-black px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111]"
              href={signUpHref}
              style={{ background: target.color }}
            >
              {target.name}
            </Link>
          ))}
        </div>
      </div>
    </TapePanel>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const primaryHref = marketing ? getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace") : "/upload";
  const secondaryHref = marketing ? getConfiguredAppUrlForPath("/pricing") : "/pricing";
  const headline = "Visual Kanban and Pipeline Planner for coding agents.";

  return (
    <main className="min-h-screen bg-[#f7f4ea] text-[#111111]">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-9">
        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="grid content-start gap-5 border-[5px] border-black bg-white p-5 shadow-[10px_10px_0_#111]">
            <div className="grid gap-2">
              <div className="bg-[#005caf] px-4 py-3">
                <TapeWord text="DRYLAKE" color="#ffffff" cell={4.5} gap={1} label="DryLake" variantSet={1} />
              </div>
              <div className="flex flex-wrap items-center gap-4 bg-[#f7f4ea] px-4 py-3">
                <TapeWord text="KANBAN" color="#36b979" cell={3.9} gap={1} label="Kanban" variantSet={1} />
                <ArrowTape color="#36b979" />
                <TapeWord text="PIPELINE" color="#111111" cell={3.4} gap={1} label="Pipeline" variantSet={2} />
              </div>
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-stone-950 sm:text-4xl md:text-5xl">
              {headline}
            </h1>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Start Planning" : "Start build"}</ActionLink>
              <ActionLink href={secondaryHref} variant="white">Pricing</ActionLink>
            </div>
          </div>

          <PhaseBoard />
        </section>

        <section className="grid gap-6">
          <PlatformPanel />
        </section>
      </section>
    </main>
  );
}

export default async function Home() {
  const requestHeaders = await headers();
  const requestHost = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  return <HomeExperience marketing={isConfiguredMarketingHost(requestHost)} />;
}
