import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { DryLakeLogo } from "@/components/drylake-logo";
import {
  getConfiguredAppUrlForPath,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";

const pillarCards = [
  [
    "Agent Control",
    "Break work into phases, assign the right coding agent, attach skills, and run focused handoffs without losing validation context.",
  ],
  [
    "Guard",
    "Run a local-first scan for MCP servers, extensions, secrets, prompt-injection risk, and blast radius before agents touch the repo.",
  ],
  [
    "Team Security",
    "Share saved reports, compare against a Team Baseline, manage policy, and review Continuous Watch drift history across the organization.",
  ],
];

const guardJourney = [
  [
    "Free local scan",
    "Install the extension, connect your workspace, and review local Guard results without requiring a paid security plan.",
  ],
  [
    "Security Pro",
    "Approve redacted upload when you want Fix with AI, Deep Cloud Analysis, saved report history, and paid remediation workflows.",
  ],
  [
    "Team Security",
    "Move from individual reports to shared baselines, team policy, recurring watch checks, and organization-wide drift visibility.",
  ],
];

const securityPoints = [
  ["Workspace isolation", "Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem."],
  ["Approved upload", "Deep Cloud Analysis only runs from approved redacted metadata. Raw secrets, private keys, and full source files are not uploaded by default."],
  ["Encrypted credentials", "Credentials and extension tokens are encrypted with AES-256-GCM before storage."],
  ["AWS controls", "Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption."],
  ["GitLab delivery", "Production deploys run through GitLab validation, HTTPS checks, audit logs, and environment isolation guards."],
  ["Operator review", "Guard reports are meant to be reviewed by engineers before they approve remediation or team policy changes."],
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

const trustLinks = [
  { label: "Open source GitHub", href: "https://github.com/gmkdigitalmedia/drylake" },
  { label: "99VC", href: "https://ninetynine.vc/" },
  { label: "AWS Startups", href: "https://aws.amazon.com/startups/" },
  { label: "AWS Cloud", href: "https://aws.amazon.com/" },
  { label: "GitLab", href: "https://gitlab.com/" },
];

const backingPartners = [
  {
    label: "99VC",
    href: "https://ninetynine.vc/",
    mark: "99VC",
    detail: "venture backing",
  },
  {
    label: "AWS Startups",
    href: "https://aws.amazon.com/startups/",
    mark: "aws",
    detail: "startups",
  },
];

function StatusPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
      {children}
    </span>
  );
}

function ActionLink({
  children,
  href,
  variant = "primary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
      : "rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200";

  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

function BackingLogos() {
  return (
    <div className="mt-7">
      <p className="text-sm font-medium text-zinc-300">DryLake is backed by 99VC and AWS Startups.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {backingPartners.map((partner) => (
          <a
            key={partner.label}
            className="group inline-flex h-12 items-center gap-3 rounded border border-zinc-800 bg-zinc-950/90 px-4 text-zinc-200 shadow-lg shadow-black/20 transition hover:border-orange-400 hover:text-orange-100"
            href={partner.href}
            rel="noreferrer"
            target="_blank"
            aria-label={partner.label}
          >
            <span className="font-semibold tracking-[0.02em] text-zinc-50">{partner.mark}</span>
            <span className="h-5 w-px bg-zinc-800 group-hover:bg-orange-400/70" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 group-hover:text-orange-200">
              {partner.detail}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function WorkflowGifPreview() {
  return (
    <section
      aria-label="DryLake workflow preview"
      className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0f0f]/95 shadow-2xl shadow-black/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            VS Code + Cursor workflow
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Local Guard first, paid remediation second, agent execution after review.
          </p>
        </div>
        <span className="rounded border border-orange-400/40 bg-orange-400/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
          Guard + control
        </span>
      </div>
      <div className="grid gap-px bg-zinc-800 lg:grid-cols-2 xl:grid-cols-3">
        <Image
          src="/marketplace/extension/media/guard-security.gif"
          alt="DryLake Guard security workflow showing local scan progress, report sections, approved upload, Team Baseline, and Continuous Watch"
          width={1120}
          height={630}
          priority
          unoptimized
          sizes="(min-width: 1024px) 27vw, 100vw"
          className="aspect-video w-full bg-[#080b0a] object-cover object-top"
        />
        <Image
          src="/marketplace/extension/media/guard-paid-features.gif"
          alt="DryLake paid security workflow showing Fix with AI, Deep Cloud Analysis, saved reports, team policy, baseline drift, Continuous Watch, and local Watchdog"
          width={1280}
          height={720}
          priority
          unoptimized
          sizes="(min-width: 1280px) 27vw, (min-width: 1024px) 40vw, 100vw"
          className="aspect-video w-full bg-[#080b0a] object-cover object-top"
        />
        <Image
          src="/marketplace/extension/media/agent-control.gif"
          alt="DryLake agent control workflow showing phase cards, agent selection, skills, terminal handoffs, and completed outcomes"
          width={1120}
          height={630}
          priority
          unoptimized
          sizes="(min-width: 1024px) 27vw, 100vw"
          className="aspect-video w-full bg-[#080b0a] object-cover object-top"
        />
      </div>
      <div className="grid gap-2 border-t border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-300 sm:grid-cols-3">
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">Free local Guard scan</span>
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">Security Pro remediation and cloud analysis</span>
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">Team Security baselines and watch history</span>
      </div>
    </section>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const appHref = (pathname: string, search = "") =>
    marketing ? getConfiguredAppUrlForPath(pathname, search) : pathname;
  const primaryHref = marketing ? getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace") : "/workspace";
  const pricingHref = appHref("/pricing");
  const guardHref = appHref("/guard");
  const installHref = appHref("/extensions/install");

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="relative min-h-[92vh] overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-[#090a0a]" />
        <div className="absolute inset-x-0 bottom-0 top-20 opacity-70">
          <Image
            src="/marketplace/extension/media/readme-kanban-v2.png"
            alt="DryLake kanban planning interface"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-35 grayscale"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090a0a_0%,rgba(9,10,10,0.92)_34%,rgba(9,10,10,0.56)_67%,rgba(9,10,10,0.88)_100%)]" />

        <div className="relative z-10 mx-auto grid min-h-[92vh] max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <section className="max-w-3xl">
            <DryLakeLogo className="mb-8 h-20 w-auto sm:h-24" priority />
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusPill>Free local Guard scan</StatusPill>
              <StatusPill>Agent control</StatusPill>
              <StatusPill>Team Security</StatusPill>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              DryLake helps teams control AI coding work and secure agent behavior before execution.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Start with a free local Guard scan for MCP servers, extensions, secrets, prompt-injection risk,
              and blast radius. Then plan coding work, assign agents, approve deeper analysis when needed,
              and move into shared team baselines and Continuous Watch as the workflow matures.
            </p>
            <BackingLogos />
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Register free" : "Open workspace"}</ActionLink>
              <ActionLink href={installHref} variant="secondary">
                Install extension
              </ActionLink>
              <ActionLink href={guardHref} variant="secondary">
                Learn Guard
              </ActionLink>
              <ActionLink href={pricingHref} variant="secondary">
                View pricing
              </ActionLink>
            </div>
          </section>

          <WorkflowGifPreview />
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Product pillars</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Agent control and Guard security belong in the same workflow.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
              DryLake is not just another planning board and not just another scanner. It is the surface where
              teams decide what agents should do, what they can touch, and what risk is acceptable before execution starts.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pillarCards.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-zinc-800 bg-[#111414] p-5">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#090a0a] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid content-start gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">Guard pathway</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Move from local visibility to paid remediation only when you need it.
            </h2>
            <p className="text-base leading-7 text-zinc-400">
              Free is intentionally useful on its own. Paid security starts when you want approved upload,
              saved reports, cloud-backed analysis, or shared team enforcement beyond the local scan.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={guardHref}>Explore Guard</ActionLink>
              <ActionLink href={pricingHref} variant="secondary">Compare plans</ActionLink>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {guardJourney.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-zinc-800 bg-[#111414] p-5">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#090a0a] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <Image
              src="/marketplace/extension/media/readme-pipeline-v2.png"
              alt="DryLake pipeline view"
              width={1280}
              height={800}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[16/10] w-full object-cover object-top"
            />
          </div>
          <div className="grid content-center gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">Agent coverage</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Route phases to the agents your team already uses.
            </h2>
            <p className="text-base leading-7 text-zinc-400">
              DryLake creates focused handoff files and terminal launches. It does not pretend to own every runtime.
              It prepares the work, preserves the plan, and keeps the security state visible before the agent runs.
            </p>
            <div className="flex flex-wrap gap-2">
              {supportedAgents.map((agent) => (
                <span
                  key={agent}
                  className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300"
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Trust and infrastructure</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Local-first Guard on top of AWS infrastructure and GitLab delivery.
            </h2>
            <p className="mt-5 text-base leading-7 text-zinc-400">
              DryLake is backed by 99VC and AWS Startups. The website, account flow, and team-security path need to feel operational,
              not vague. The trust boundary is part of the product surface.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {trustLinks.map((item) => (
                <a
                  key={item.label}
                  className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {securityPoints.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-zinc-800 bg-[#111414] p-5">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
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
