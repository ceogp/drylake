import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getConfiguredAppOrigin } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "About DryLake",
  description: "DryLake is a visual kanban and pipeline planner for assigning coding phases to AI coding agents.",
};

const agentTargets = [
  "Claude Code",
  "OpenAI Codex",
  "Gemini CLI",
  "Cursor CLI",
  "GitHub Copilot Chat",
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
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="grid gap-8 rounded-lg border border-zinc-800 bg-[#111414] p-6 md:p-8 lg:grid-cols-[1fr_0.78fr] lg:p-10">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <Image
                alt="DryLake logo"
                className="h-14 w-14 rounded border border-zinc-700 bg-zinc-950 object-contain p-1"
                height={64}
                priority
                src="/blackwhite.webp"
                width={64}
              />
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-100">
                  DryLake
                </p>
                <p className="mt-1 text-sm text-zinc-500">Save tokens and time using AI Agents.</p>
              </div>
            </div>

            <div className="space-y-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">About</p>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl lg:text-6xl">
                A control room for coding-agent work.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-zinc-300">
                DryLake helps teams break coding work into phases, assign each phase to the right
                agent, and hand off the next step without losing the plan or the validation trail.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href={dryLakeOrigin}>
                Open DryLake
              </a>
              <Link className="rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href="/extensions/install">
                Install Extension
              </Link>
            </div>
          </div>

          <div className="grid content-between gap-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <div className="grid gap-3">
              {["Plan", "Assign", "Run", "Validate"].map((label, index) => (
                <div key={label} className="flex items-center justify-between rounded border border-zinc-800 bg-[#0d0f0f] px-4 py-3">
                  <span className="font-mono text-xs text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold text-zinc-200">{label}</span>
                </div>
              ))}
            </div>
            <div className="rounded border border-orange-400/30 bg-orange-400/10 p-4">
              <p className="text-sm leading-6 text-orange-100">
                V1 keeps completion explicit: run an agent, inspect the workspace, then mark the attempt complete or failed.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Built for</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl">
              Coding work that moves across agents.
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              DryLake is a practical planning surface for people already shipping with coding agents
              in their editor and terminal.
            </p>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Agent targets</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {agentTargets.map((target) => (
                <span
                  className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-zinc-200"
                  key={target}
                >
                  {target}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Founder</p>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-50">
              Gopal Shangari
            </h2>
            <p className="mt-4 text-base leading-8 text-zinc-300">
              DryLake is built by Gopal Shangari through Xupra KK, based between Japan and the US.
            </p>
            <p className="mt-3 text-base leading-8 text-zinc-300">
              Cornell AB, Computational Neuroscience.
            </p>
            <a
              className="mt-6 inline-flex rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
              href="https://www.linkedin.com/in/gpshangari/"
              rel="noreferrer"
              target="_blank"
            >
              LinkedIn Profile
            </a>
          </article>

          <div className="grid gap-6 sm:grid-cols-2">
            {contactCards.map((card) => (
              <article className="min-w-0 rounded-lg border border-zinc-800 bg-[#111414] p-5" key={card.email}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{card.label}</p>
                <a
                  className="mt-4 block break-words text-xl font-semibold leading-snug text-zinc-50 transition hover:text-orange-200"
                  href={`mailto:${card.email}`}
                >
                  {card.email}
                </a>
                <p className="mt-4 text-sm leading-7 text-zinc-400">{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
