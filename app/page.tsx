import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { XupraCorporateHomePage } from "@/app/_components/xupra-public-pages";
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
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    title: "Paid remediation and cloud analysis",
    eyebrow: "Go deeper",
    description: "Unlock Fix with AI, approved upload, Deep Cloud Analysis, saved reports, and Watchdog.",
    src: "/marketplace/extension/media/guard-paid-features.gif",
    alt: "DryLake paid security workflow showing Fix with AI, Deep Cloud Analysis, saved reports, team policy, baseline drift, Continuous Watch, and local Watchdog",
    tone: "border-orange-200 bg-orange-50 text-orange-800",
  },
  {
    title: "Guard for Teams baselines and watch history",
    eyebrow: "Teams",
    description: "Share baselines, policy, and recurring watch history across the team when you are ready.",
    src: "/marketplace/extension/media/agent-control.gif",
    alt: "DryLake agent control workflow showing phase cards, agent selection, skills, terminal handoffs, and completed outcomes",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
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

function HeroChip({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-zinc-300 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950">
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
      ? "xupra-button-primary rounded-md px-5 py-3 text-sm transition hover:-translate-y-0.5"
      : "xupra-button-secondary rounded-md px-5 py-3 text-sm transition hover:-translate-y-0.5";

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
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            VS Code + Cursor workflow
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950">Agent Control + Guard</h2>
        </div>
      </div>

      <div className="grid gap-4">
        {showcaseItems.map((item) => (
          <article
            key={item.title}
            className="group overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-zinc-500"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${item.tone}`}>
                  {item.eyebrow}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-zinc-950">{item.title}</h3>
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
            <p className="px-4 py-4 text-sm leading-7 text-zinc-600">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductLayers() {
  return (
    <section className="border-t border-zinc-300 bg-white px-5 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">One product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            One workflow from planning to security review.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {productLayers.map((item) => (
            <article
              key={item.title}
              className={`rounded-2xl border bg-gradient-to-br ${item.accent} p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-zinc-500`}
            >
              <h3 className="text-xl font-semibold text-zinc-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">{item.body}</p>
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
    <main className="min-h-screen bg-[#f6f7f3] text-zinc-950">
      <section className="relative overflow-hidden border-b border-zinc-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(0,201,139,0.15),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(232,117,40,0.13),transparent_26%),linear-gradient(180deg,#f6f7f3_0%,#ffffff_52%,#f6f7f3_100%)]" />
        <div className="absolute inset-0 opacity-[0.72] [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-10 lg:py-20">
          <section className="max-w-3xl pt-4">
            <DryLakeLogo className="mb-8 h-20 w-auto sm:h-24" priority tone="dark" />
            <div className="mb-6 flex flex-wrap gap-2">
              <HeroChip>Free local Guard scan</HeroChip>
              <HeroChip>Agent control</HeroChip>
              <HeroChip>Guard for Teams</HeroChip>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-zinc-950 sm:text-6xl lg:text-7xl">
              DryLake has Agent Control and Security in one product.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-700 sm:text-lg">
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

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const requestHost = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  if (isConfiguredMarketingHost(requestHost)) {
    return {
      title: {
        absolute: "Xupra",
      },
      description:
        "DryLake and KYA Registry: security for the agentic era. Agent Control, free security scans, and hosted Know Your Agent verification.",
    };
  }

  return {};
}

export default async function Home() {
  const requestHeaders = await headers();
  const requestHost = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  if (isConfiguredMarketingHost(requestHost)) {
    return <XupraCorporateHomePage />;
  }

  return <HomeExperience marketing={false} />;
}
