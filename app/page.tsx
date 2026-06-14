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

const showcaseItems = [
  {
    title: "Free local Guard scan",
    eyebrow: "Start local",
    description: "Scan MCP servers, extensions, secrets, and blast radius before agents run.",
    src: "/marketplace/extension/media/guard-security.gif",
    alt: "DryLake Guard security workflow showing local scan progress, report sections, approved upload, Team Baseline, and Continuous Watch",
    tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  {
    title: "Paid remediation and cloud analysis",
    eyebrow: "Go deeper",
    description: "Unlock Fix with AI, approved upload, Deep Cloud Analysis, saved reports, and Watchdog.",
    src: "/marketplace/extension/media/guard-paid-features.gif",
    alt: "DryLake paid security workflow showing Fix with AI, Deep Cloud Analysis, saved reports, team policy, baseline drift, Continuous Watch, and local Watchdog",
    tone: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  },
  {
    title: "Guard for Teams baselines and watch history",
    eyebrow: "Teams",
    description: "Share baselines, policy, and recurring watch history across the team when you are ready.",
    src: "/marketplace/extension/media/agent-control.gif",
    alt: "DryLake agent control workflow showing phase cards, agent selection, skills, terminal handoffs, and completed outcomes",
    tone: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  },
] as const;

const productLayers = [
  {
    title: "Agent Control",
    body: "Plan phases, assign the right coding agent, and keep execution handoffs visible.",
    accent: "from-orange-500/30 to-orange-500/5 border-orange-400/20",
  },
  {
    title: "Guard",
    body: "Review local risk first, then approve cloud analysis only when you need it.",
    accent: "from-emerald-500/30 to-emerald-500/5 border-emerald-400/20",
  },
  {
    title: "Guard for Teams",
    body: "Add baseline drift, policy, and watch history when security becomes a shared workflow.",
    accent: "from-sky-500/30 to-sky-500/5 border-sky-400/20",
  },
] as const;

const xupraNotes = [
  {
    title: "Company",
    body: "Xupra is the company. DryLake is the current product.",
  },
  {
    title: "Current product",
    body: "DryLake combines Agent Control and Security in one workflow for AI-native engineering teams.",
  },
] as const;

function HeroChip({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100">
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
      ? "rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
      : "rounded-md border border-zinc-700 bg-zinc-950/80 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white";

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

function WorkflowShowcase() {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            VS Code + Cursor workflow
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Agent Control + Guard</h2>
        </div>
      </div>

      <div className="grid gap-4">
        {showcaseItems.map((item) => (
          <article
            key={item.title}
            className="group overflow-hidden rounded-2xl border border-zinc-800 bg-[#101414]/95 shadow-[0_18px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-zinc-600"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${item.tone}`}>
                  {item.eyebrow}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-zinc-50">{item.title}</h3>
              </div>
            </div>
            <Image
              src={item.src}
              alt={item.alt}
              width={1280}
              height={720}
              priority
              unoptimized
              sizes="100vw"
              className="aspect-video w-full object-cover object-top transition duration-500 group-hover:scale-[1.01]"
            />
            <p className="px-4 py-4 text-sm leading-7 text-zinc-400">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductLayers() {
  return (
    <section className="border-t border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">One product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            One workflow from planning to security review.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {productLayers.map((item) => (
            <article
              key={item.title}
              className={`rounded-2xl border bg-gradient-to-br ${item.accent} p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-zinc-500`}
            >
              <h3 className="text-xl font-semibold text-zinc-50">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-300">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const appHref = (pathname: string, search = "") =>
    marketing ? getConfiguredAppUrlForPath(pathname, search) : pathname;
  const primaryHref = appHref("/sign-up", "redirect_url=%2Fskills");
  const pricingHref = appHref("/pricing");
  const guardHref = appHref("/guard");
  const installHref = appHref("/extensions/install");

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(249,115,22,0.16),transparent_26%),linear-gradient(180deg,#090a0a_0%,#0c1110_52%,#090a0a_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-10 lg:py-20">
          <section className="max-w-3xl pt-4">
            <DryLakeLogo className="mb-8 h-20 w-auto sm:h-24" priority />
            <div className="mb-6 flex flex-wrap gap-2">
              <HeroChip>Free local Guard scan</HeroChip>
              <HeroChip>Agent control</HeroChip>
              <HeroChip>Guard for Teams</HeroChip>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              DryLake has Agent Control and Security in one product.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
              The planning surface, the security review, and the extension workflow stay in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>Get started</ActionLink>
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

          <WorkflowShowcase />
        </div>
      </section>

      <ProductLayers />
    </main>
  );
}

function XupraCorporateHome() {
  const dryLakeHref = getConfiguredAppUrlForPath("/");

  return (
    <main className="min-h-screen bg-[#080909] text-zinc-100">
      <section className="relative overflow-hidden border-b border-zinc-800 px-5 py-20 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.2),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(249,115,22,0.18),transparent_30%),linear-gradient(135deg,#080909_0%,#101515_48%,#080909_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:30px_30px]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Xupra</p>
            <h1 className="mt-5 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              Developer products for AI-native engineering teams.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Xupra is the company. DryLake is the current product: Agent Control and Security in one workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={dryLakeHref}>Open DryLake</ActionLink>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#101414]/95 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <div className="border-b border-zinc-800 px-5 py-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Current product</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-50">DryLake</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">Agent Control and Security in one product.</p>
            </div>
            <Image
              src="/marketplace/extension/media/guard-paid-features.gif"
              alt="DryLake Guard paid security workflow inside VS Code"
              width={1280}
              height={720}
              priority
              unoptimized
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="aspect-video w-full object-cover object-top"
            />
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {xupraNotes.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-zinc-800 bg-[#111414] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-zinc-600"
            >
              <h2 className="text-xl font-semibold text-zinc-50">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{item.body}</p>
            </article>
          ))}
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

  if (isConfiguredMarketingHost(requestHost)) {
    return <XupraCorporateHome />;
  }

  return <HomeExperience marketing={false} />;
}
