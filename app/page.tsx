import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import {
  getConfiguredAppUrlForPath,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";

const proofPoints = [
  ["Visual phase planning", "Turn a ticket, bug, feature request, or pasted AI prompt into cards your team can scan."],
  ["Agent and skill routing", "Assign each phase to Claude Code, Codex, Cline, Continue, Kilo, Gemini, Cursor, or another local agent."],
  ["Token control", "Use smaller focused handoffs instead of one oversized prompt that burns context and hides risk."],
];

const trustLinks = [
  { label: "Open source GitHub", href: "https://github.com/gmkdigitalmedia/drylake" },
  { label: "99VC", href: "https://ninetynine.vc/" },
  { label: "AWS Startups", href: "https://aws.amazon.com/startups/" },
  { label: "AWS Cloud", href: "https://aws.amazon.com/" },
  { label: "GitLab", href: "https://gitlab.com/" },
];

const securityPoints = [
  ["Workspace isolation", "Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem."],
  ["Encrypted credentials", "Credentials and extension tokens are encrypted with AES-256-GCM before storage."],
  ["Encrypted in transit", "All information Encrypted from your IDE to inference and back."],
  ["AWS security controls", "Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption."],
  ["GitLab CI/CD", "Production deploys run through GitLab validation, HTTPS checks, audit logs, and environment isolation guards."],
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

const accountPaths = [
  ["Free users", "Use visual planning cards, local agent handoffs, prompt export, and extension connection without a paid plan."],
  ["Pro users", "Manage hosted Xupra AI planning, billing status, entitlements, and the Stripe customer portal from one account surface."],
  ["Teams later", "Organization switching, roles, and admin controls stay separate from the customer account page."],
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
            VS Code workflow
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Rearrange cards, assign agents, attach skills, launch handoffs.
          </p>
        </div>
        <span className="rounded border border-orange-400/40 bg-orange-400/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
          6 phases
        </span>
      </div>
      <Image
        src="/marketplace/extension/media/drylake-workflow-6phase-handoffs.gif"
        alt="DryLake workflow showing planning cards, agent selection, skill selection, and terminal handoffs"
        width={1120}
        height={630}
        priority
        unoptimized
        sizes="(min-width: 1024px) 54vw, 100vw"
        className="aspect-video w-full object-cover object-top"
      />
      <div className="grid gap-2 border-t border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-300 sm:grid-cols-3">
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">5.4 Nano free planning</span>
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">Bring local coding agents</span>
        <span className="rounded border border-zinc-800 bg-[#101514] px-3 py-2">Upgrade for Frontier planning</span>
      </div>
    </section>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const appHref = (pathname: string, search = "") =>
    marketing ? getConfiguredAppUrlForPath(pathname, search) : pathname;
  const primaryHref = marketing ? getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace") : "/workspace";
  const pricingHref = appHref("/pricing");
  const accountHref = appHref("/account");
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
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusPill>VS Code control room</StatusPill>
              <StatusPill>Multi-agent handoffs</StatusPill>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              DryLake plans AI coding work before agents burn tokens.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Turn tickets, bugs, product specs, and messy prompts into visual phase cards. Assign each
              card to your coding agent, attach the right skill, and run focused handoffs from VS Code.
            </p>
            <BackingLogos />
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Register free" : "Open workspace"}</ActionLink>
              <ActionLink href={installHref} variant="secondary">
                Install extension
              </ActionLink>
              <ActionLink href={accountHref} variant="secondary">
                Manage account
              </ActionLink>
              <ActionLink href={pricingHref} variant="secondary">
                View pricing
              </ActionLink>
            </div>
          </section>

          <WorkflowGifPreview />
        </div>
      </section>

      <section id="workflow" className="border-b border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Workflow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Built for engineers who want planning control before execution.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {proofPoints.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-zinc-800 bg-[#111414] p-5">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="account" className="border-b border-zinc-800 bg-[#090a0a] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid content-start gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">Account management</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              One page for plan status, billing, extension connection, and settings.
            </h2>
            <p className="text-base leading-7 text-zinc-400">
              Free users should never feel blocked from using the visual planner. Paid users should
              see exactly what Pro unlocks and where to manage billing.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionLink href={accountHref}>Open account</ActionLink>
              <ActionLink href={pricingHref} variant="secondary">Compare plans</ActionLink>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {accountPaths.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-zinc-800 bg-[#111414] p-5">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="agents" className="bg-[#090a0a] px-5 py-16 sm:px-8 lg:px-10">
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">Validation first</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Route phases to the agents your users already have.
            </h2>
            <p className="text-base leading-7 text-zinc-400">
              DryLake creates focused handoff files and terminal launches. It does not pretend to own
              every agent runtime; it gives Claude Code, Codex, Cline, Continue, Kilo, and other tools
              the exact phase context they need.
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

      <section id="security" className="border-t border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Security and infrastructure</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Built on AWS Cloud. Shipped through GitLab.
            </h2>
            <p className="mt-5 text-base leading-7 text-zinc-400">
              DryLake is backed by 99VC and AWS Startups. Infrastructure runs on AWS Cloud with GitLab CI/CD for validation and deployment.
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
