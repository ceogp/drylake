import type { Metadata } from "next";

import { DryLakeLogo } from "@/components/drylake-logo";
import { getConfiguredAppOrigin, getConfiguredAppUrlForPath } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "About DryLake",
  description:
    "DryLake combines agent control and Guard security so teams can plan, review, and execute AI coding work with clearer operational boundaries.",
};

const principles = [
  [
    "Why DryLake exists",
    "Teams using coding agents need more than prompts. They need a control surface for phase planning and a security surface for reviewing what those agents can touch.",
  ],
  [
    "Why Guard belongs here",
    "Security is not a separate afterthought. The same team that routes work to agents also needs to see MCP risk, extensions, secrets, and blast radius before execution.",
  ],
  [
    "Why local-first matters",
    "Free local Guard scan is meant to be genuinely useful on its own. Paid cloud analysis starts only when the operator explicitly approves a redacted upload.",
  ],
];

const trustPoints = [
  "Local scan before paid upload",
  "Approved redacted metadata for Deep Cloud Analysis",
  "Saved reports for personal and shared team history",
  "AWS-backed runtime with CodeCommit delivery",
  "Operator review before remediation and policy changes",
];

const contactCards = [
  {
    label: "Contact",
    email: "ceo@xupracorp.com",
    body: "Company, investor, and partnership notes.",
  },
  {
    label: "Support",
    email: "support@xupracorp.com",
    body: "Account, extension, Guard, billing, and product help.",
  },
];

export default function AboutPage() {
  const dryLakeOrigin = getConfiguredAppOrigin();
  const guardHref = getConfiguredAppUrlForPath("/guard");
  const pricingHref = getConfiguredAppUrlForPath("/pricing");

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8 lg:py-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="grid gap-8 rounded-lg border border-zinc-800 bg-[#111414] p-6 md:p-8 lg:grid-cols-[1fr_0.78fr] lg:p-10">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-5">
              <DryLakeLogo className="h-16 w-auto" priority />
              <div>
                <p className="mt-1 text-sm text-zinc-500">Agent control and Guard security in one product surface.</p>
              </div>
            </div>

            <div className="space-y-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">About</p>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl lg:text-6xl">
                DryLake is an operator surface for AI coding work.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-zinc-300">
                DryLake helps teams plan coding work, route it to the right agent, and review Guard security state
                before deeper automation or remediation begins.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href={dryLakeOrigin}>
                Open DryLake
              </a>
              <a className="rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href={guardHref}>
                Learn Guard
              </a>
              <a className="rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href={pricingHref}>
                View pricing
              </a>
            </div>
          </div>

          <div className="grid content-between gap-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <div className="grid gap-3">
              {trustPoints.map((label, index) => (
                <div key={label} className="flex items-center justify-between rounded border border-zinc-800 bg-[#0d0f0f] px-4 py-3">
                  <span className="font-mono text-xs text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold text-zinc-200">{label}</span>
                </div>
              ))}
            </div>
            <div className="rounded border border-orange-400/30 bg-orange-400/10 p-4">
              <p className="text-sm leading-6 text-orange-100">
                DryLake is designed so the operator can keep the first security decision local and explicit.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {principles.map(([title, body]) => (
            <article key={title} className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">{title}</p>
              <p className="mt-4 text-base leading-8 text-zinc-300">{body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Founder</p>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-50">Gopal Shangari</h2>
            <p className="mt-4 text-base leading-8 text-zinc-300">
              DryLake is built by Gopal Shangari through Xupra KK, based between Japan and the US.
            </p>
            <p className="mt-3 text-base leading-8 text-zinc-300">Cornell AB, Computational Neuroscience.</p>
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
