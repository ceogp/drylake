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
  getConfiguredAppOrigin,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";

const phases = [
  { id: "01", title: "Prompt", body: "Start with a ticket, feature sketch, repo goal, or bug report.", bg: tapeColors.yellow, fg: tapeColors.ink },
  { id: "02", title: "Plan", body: "DryLake turns the work into a visible phase map before the agent starts.", bg: tapeColors.blue, fg: tapeColors.white },
  { id: "03", title: "Assign", body: "Pick Copilot, Codex, Claude, Gemini, Cline, or Aider per phase.", bg: tapeColors.pink, fg: tapeColors.white },
  { id: "04", title: "Handoff", body: "Run direct, export scripts, copy, markdown, or send to VS Code.", bg: tapeColors.green, fg: tapeColors.ink },
];

const handoffActions = ["RUN", ".SH", ".BAT", "COPY", "MD", "VS CODE"];
const platforms = ["Copilot", "Codex", "Claude", "Gemini", "Cline", "Aider"];

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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffd60a]">Live work map</p>
          <ArrowTape color="#ffd60a" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {phases.map((phase) => (
            <article key={phase.id} className="min-h-36 rounded-[6px] border-[4px] border-white p-4" style={{ background: phase.bg, color: phase.fg }}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-3xl font-black">{phase.id}</span>
                <ArrowTape color={phase.fg} className="h-8 w-20" />
              </div>
              <h2 className="mt-3 text-xl font-black uppercase leading-none">{phase.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-5 opacity-85">{phase.body}</p>
            </article>
          ))}
        </div>
      </div>
    </TapePanel>
  );
}

function HandoffPanel() {
  return (
    <TapePanel className="bg-[#005caf] text-white">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-black uppercase leading-none">Handoff paths</h2>
          <ArrowTape color="#ffd60a" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {handoffActions.map((action) => (
            <div key={action} className="rounded-[4px] border-[3px] border-white bg-[#ffd60a] px-3 py-3 text-center font-mono text-sm font-black text-black">
              {action}
            </div>
          ))}
        </div>
        <p className="max-w-2xl text-sm font-semibold leading-6 text-blue-50">
          The same build map can become a direct run, a shell script, a batch file, a copied prompt, a markdown handoff, or a VS Code handoff.
        </p>
      </div>
    </TapePanel>
  );
}

function PlatformPanel() {
  return (
    <TapePanel className="bg-white">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-black uppercase leading-none">Bring your agent bench.</h2>
          <ArrowTape color="#111111" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform, index) => (
            <div key={platform} className="border-[4px] border-black px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.14em]" style={{ background: index % 3 === 0 ? tapeColors.yellow : index % 3 === 1 ? tapeColors.paper : tapeColors.green }}>
              {platform}
            </div>
          ))}
        </div>
        <p className="max-w-2xl text-sm font-semibold leading-6 text-stone-800">
          DryLake keeps the orchestration visible while your existing coding tools do the work. It is a control surface, not a black box.
        </p>
      </div>
    </TapePanel>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const dryLakeOrigin = getConfiguredAppOrigin();
  const primaryHref = marketing ? dryLakeOrigin : "/upload";
  const secondaryHref = marketing ? `${dryLakeOrigin}/upload` : "/install";

  return (
    <main className="min-h-screen bg-[#f7f4ea] text-[#111111]">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-9">
        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="grid content-start gap-5 border-[5px] border-black bg-white p-5 shadow-[10px_10px_0_#111]">
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#e84a5f] px-4 py-3">
                <TapeWord text="XUPRA" color="#070707" cell={7} gap={2} label="Xupra" variantSet={1} />
              </div>
              <div className="bg-[#ff5a1f] px-4 py-3">
                <TapeWord text="AI" color="#ffffff" cell={7} gap={2} label="AI" />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="bg-[#005caf] px-4 py-3">
                <TapeWord text="DRYLAKE" color="#ffffff" cell={7} gap={1} label="DryLake" variantSet={1} />
              </div>
              <div className="flex flex-wrap items-center gap-4 bg-[#f7f4ea] px-4 py-3">
                <TapeWord text="AGENT" color="#36b979" cell={6} gap={1} label="Agent" variantSet={1} />
                <ArrowTape color="#36b979" />
                <TapeWord text="handoff" color="#111111" cell={6} gap={2} label="Handoff" variantSet={2} />
              </div>
            </div>
            <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] md:text-6xl">
              Agent work maps you can hand to the next tool.
            </h1>
            <p className="max-w-2xl text-base font-medium leading-7 text-stone-800 md:text-lg">
              Import repository skills, rules, prompts, and agent files. DryLake turns them into a visible build map, then hands each phase to the tool that fits.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Open DryLake" : "Start build"}</ActionLink>
              <ActionLink href={secondaryHref} variant="white">{marketing ? "Import skills" : "Open installer"}</ActionLink>
            </div>
          </div>

          <PhaseBoard />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <HandoffPanel />
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