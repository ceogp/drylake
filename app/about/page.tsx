import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArrowTape, TapePanel, TapeWord, tapeColors } from "@/components/tape-brand";
import { getConfiguredAppOrigin } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "About DryLake",
  description: "DryLake is a visual kanban and pipeline planner for assigning coding phases to AI coding agents.",
};

const agentTargets = [
  "Claude Code",
  "Codex",
  "Gemini CLI",
  "Cursor CLI",
  "Cline CLI",
  "Continue CLI",
  "Aider",
  "GitHub Copilot",
  "Augment",
];

const contactCards = [
  {
    label: "Contact",
    email: "ceo@xupracorp.com",
    body: "Company and partnership notes.",
  },
  {
    label: "Support",
    email: "support@xupracorp.com",
    body: "DryLake account, extension, billing, and product help.",
  },
];

export default function AboutPage() {
  const dryLakeOrigin = getConfiguredAppOrigin();

  return (
    <main className="tape-page min-h-screen px-4 py-12 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <TapePanel className="grid gap-8 bg-white p-5 md:p-8 lg:grid-cols-[1fr_0.78fr] lg:p-10">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <Image
                alt="DryLake logo"
                className="h-16 w-16 rounded-[4px] border-[4px] border-black bg-white"
                height={64}
                priority
                src="/drylake-logo.svg"
                width={64}
              />
              <div className="rounded-[4px] border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-black">
                DryLake
              </div>
            </div>

            <div className="space-y-5">
              <p className="tape-eyebrow">About</p>
              <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-black leading-tight text-stone-950 sm:text-5xl lg:text-6xl">
                Visual Kanban and Pipeline Planner for coding agents.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700">
                DryLake helps teams break coding work into phases, assign each phase to the right
                agent, and hand off the next step without losing the plan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a className="tape-button bg-[#ffd60a] px-5 py-3 text-sm text-black" href={dryLakeOrigin}>
                Open DryLake
              </a>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/extensions/install">
                Install Extension
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 border-[4px] border-black bg-[#f7f4ea] p-5">
            <div className="space-y-4">
              <TapeWord text="KANBAN" color={tapeColors.green} cell={3.6} gap={1} label="Kanban" variantSet={1} />
              <div className="flex flex-wrap items-center gap-3">
                <ArrowTape color={tapeColors.green} className="h-8 w-20" />
                <TapeWord text="PIPELINE" color={tapeColors.ink} cell={3.1} gap={1} label="Pipeline" variantSet={2} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["Plan", "#ffd60a"],
                ["Assign", "#36b979"],
                ["Handoff", "#ffffff"],
              ].map(([label, color]) => (
                <div key={label} className="border-[4px] border-black px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] text-black" style={{ backgroundColor: color }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </TapePanel>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <TapePanel className="bg-[#005caf] p-6 text-white">
            <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-[#ffd60a]">Built for</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-black leading-tight sm:text-4xl">
              Coding work that moves across agents.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/85">
              DryLake is not trying to be a giant abstract AI platform. It is a practical planning
              surface for people already shipping with coding agents in their editor and terminal.
            </p>
          </TapePanel>

          <TapePanel className="bg-white p-6">
            <p className="tape-eyebrow">Agent targets</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {agentTargets.map((target, index) => (
                <span
                  className="border-[3px] border-black px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.08em] text-black"
                  key={target}
                  style={{ backgroundColor: index % 3 === 0 ? "#ffd60a" : index % 3 === 1 ? "#ffffff" : "#36b979" }}
                >
                  {target}
                </span>
              ))}
            </div>
          </TapePanel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <TapePanel className="bg-white p-6">
            <p className="tape-eyebrow">Founder</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-black text-stone-950">
              Gopal Shangari
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-700">
              DryLake is built by Gopal Shangari through Xupra KK, based between Japan and the US.
            </p>
            <p className="mt-3 text-base leading-8 text-stone-700">
              Cornell AB, Computational Neuroscience.
            </p>
            <a
              className="tape-button mt-6 bg-[#ffd60a] px-5 py-3 text-sm text-black"
              href="https://www.linkedin.com/in/gpshangari/"
              rel="noreferrer"
              target="_blank"
            >
              LinkedIn Profile
            </a>
          </TapePanel>

          <div className="grid gap-6 sm:grid-cols-2">
            {contactCards.map((card) => (
              <article className="tape-card min-w-0 bg-white p-5" key={card.email}>
                <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-500">{card.label}</p>
                <a
                  className="mt-4 block break-words font-[family-name:var(--font-heading)] text-xl font-black leading-snug text-stone-950 transition hover:text-[#005caf]"
                  href={`mailto:${card.email}`}
                >
                  {card.email}
                </a>
                <p className="mt-4 text-sm leading-7 text-stone-700">{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
