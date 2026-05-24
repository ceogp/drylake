import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import {
  getConfiguredAppUrlForPath,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";

const agents = [
  { name: "OpenAI Codex", status: "Ready", tone: "text-emerald-300" },
  { name: "Claude Code", status: "Ready", tone: "text-emerald-300" },
  { name: "Gemini CLI", status: "Queued", tone: "text-orange-300" },
  { name: "Cursor", status: "Manual", tone: "text-zinc-300" },
];

const phases = [
  { label: "01", title: "Plan", detail: "Convert the request into scoped phases", state: "Done" },
  { label: "02", title: "Assign", detail: "Choose the agent for each phase", state: "Active" },
  { label: "03", title: "Run", detail: "Launch focused handoff prompts", state: "Next" },
  { label: "04", title: "Validate", detail: "Review workspace changes", state: "Pending" },
];

const terminalLines = [
  "[SCAN] workspace context loaded",
  "[PLAN] 4 phases generated",
  "[ASSIGN] phase 02 -> OpenAI Codex",
  "[HANDOFF] prompt copied and terminal opened",
  "[VALIDATE] awaiting user review",
];

const proofPoints = [
  ["Agent handoffs", "Send focused prompts to Codex, Claude Code, Gemini CLI, Cursor, or Copilot Chat."],
  ["Workspace context", "Keep plans tied to the actual files, constraints, and validation steps in the repo."],
  ["Manual validation", "Inspect the workspace before marking an attempt complete or failed."],
];

const trustLinks = [
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
    <a className={className} href={href}>
      {children}
    </a>
  );
}

function ControlRoomPreview() {
  return (
    <section
      aria-label="DryLake control room preview"
      className="grid gap-4 rounded-lg border border-zinc-800 bg-[#0d0f0f]/95 p-4 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current build</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-zinc-100">Checkout reliability fix</h2>
        </div>
        <span className="rounded bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          active
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {phases.map((phase) => (
          <article key={phase.label} className="rounded border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-sm text-zinc-500">{phase.label}</span>
              <span className="rounded bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">{phase.state}</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">{phase.title}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-zinc-400">{phase.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Agent matrix</h3>
          <div className="mt-4 grid gap-3">
            {agents.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-zinc-300">{agent.name}</span>
                <span className={agent.tone}>{agent.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-black p-4 font-mono text-xs leading-6 text-zinc-400">
          {terminalLines.map((line) => (
            <div key={line}>
              <span className="text-orange-300">$</span> {line}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const primaryHref = marketing ? getConfiguredAppUrlForPath("/sign-up", "redirect_url=/workspace") : "/upload";
  const secondaryHref = marketing ? getConfiguredAppUrlForPath("/pricing") : "/pricing";

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
              Save tokens and time using AI Agents.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              DryLake turns a coding task into a phase-based build plan, lets you assign the right AI agent,
              then keeps validation in your hands before work is marked done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Start planning" : "Start build"}</ActionLink>
              <ActionLink href={secondaryHref} variant="secondary">
                View pricing
              </ActionLink>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <span>Backed by</span>
              {trustLinks.slice(0, 2).map((item) => (
                <a
                  key={item.label}
                  className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-200"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </section>

          <ControlRoomPreview />
        </div>
      </section>

      <section id="workflow" className="border-b border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Workflow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Built for engineers who need control, not decoration.
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
              Agents can run the work. You still approve the result.
            </h2>
            <p className="text-base leading-7 text-zinc-400">
              The V1 flow stays simple: choose an agent, launch the task, inspect the workspace, then mark the
              attempt complete or failed. The audit trail records assignments, commands, status, and review notes.
            </p>
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
