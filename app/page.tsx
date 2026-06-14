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
        </div>
        <span className="rounded border border-orange-400/40 bg-orange-400/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
          Agent Control + Guard
        </span>
      </div>
      <div className="grid gap-px bg-zinc-800">
        {[
          {
            label: "Free local Guard scan",
            src: "/marketplace/extension/media/guard-security.gif",
            alt: "DryLake Guard security workflow showing local scan progress, report sections, approved upload, Team Baseline, and Continuous Watch",
          },
          {
            label: "Paid remediation and cloud analysis",
            src: "/marketplace/extension/media/guard-paid-features.gif",
            alt: "DryLake paid security workflow showing Fix with AI, Deep Cloud Analysis, saved reports, team policy, baseline drift, Continuous Watch, and local Watchdog",
          },
          {
            label: "Guard for Teams baselines and watch history",
            src: "/marketplace/extension/media/agent-control.gif",
            alt: "DryLake agent control workflow showing phase cards, agent selection, skills, terminal handoffs, and completed outcomes",
          },
        ].map((item) => (
          <div key={item.label} className="bg-[#080b0a]">
            <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm font-medium text-zinc-200">
              {item.label}
            </div>
            <Image
              src={item.src}
              alt={item.alt}
              width={1280}
              height={720}
              priority
              unoptimized
              sizes="100vw"
              className="aspect-video w-full object-cover object-top"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeExperience({ marketing }: { marketing: boolean }) {
  const appHref = (pathname: string, search = "") =>
    marketing ? getConfiguredAppUrlForPath(pathname, search) : pathname;
  const primaryHref = marketing
    ? getConfiguredAppUrlForPath("/sign-up", "redirect_url=%2Fbilling%3Fwelcome%3D1")
    : "/sign-up?redirect_url=%2Fskills";
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
              <StatusPill>Guard for Teams</StatusPill>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              DryLake has Agent Control and Security in one product.
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref}>{marketing ? "Register" : "Register"}</ActionLink>
              <ActionLink href={installHref} variant="secondary">
                Install extension
              </ActionLink>
              <ActionLink href={guardHref} variant="secondary">
                Learn about Guard
              </ActionLink>
              <ActionLink href={pricingHref} variant="secondary">
                View pricing
              </ActionLink>
            </div>
          </section>

          <WorkflowGifPreview />
        </div>
      </section>
    </main>
  );
}

function XupraCorporateHome() {
  const dryLakeHref = getConfiguredAppUrlForPath("/");
  const dryLakePricingHref = getConfiguredAppUrlForPath("/pricing");
  const dryLakeInstallHref = getConfiguredAppUrlForPath("/extensions/install");

  return (
    <main className="min-h-screen bg-[#080909] text-zinc-100">
      <section className="relative overflow-hidden border-b border-zinc-800 px-5 py-20 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.16),transparent_28%),linear-gradient(135deg,#080909_0%,#111414_52%,#080909_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Xupra
            </p>
            <h1 className="mt-5 font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              Agentic developer products, starting with DryLake.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Xupra builds focused tools for teams adopting AI coding agents. DryLake is the first product:
              Agent Control and Guard security in one workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={dryLakeHref}>Open DryLake</ActionLink>
              <ActionLink href={dryLakePricingHref} variant="secondary">
                DryLake pricing
              </ActionLink>
              <ActionLink href={dryLakeInstallHref} variant="secondary">
                Install extension
              </ActionLink>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-[#111414]/95 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                  Product portfolio
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
                  Current product
                </h2>
              </div>
              <span className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Live
              </span>
            </div>

            <article className="mt-5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              <Image
                src="/marketplace/extension/media/guard-paid-features.gif"
                alt="DryLake Guard paid security workflow inside VS Code"
                width={1280}
                height={720}
                priority
                unoptimized
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="aspect-video w-full bg-[#080b0a] object-cover object-top"
              />
              <div className="p-5">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  DryLake
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-50">
                  Agent Control plus Guard security.
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Plan agent work, run local Guard scans, approve cloud analysis, and manage paid remediation from
                  the website and VS Code extension.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                <ActionLink href={dryLakeHref}>Open DryLake product</ActionLink>
                  <ActionLink href={dryLakePricingHref} variant="secondary">
                    Compare Free and Paid
                  </ActionLink>
                </div>
              </div>
            </article>
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-[#0d0f0f] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            ["Company", "Xupra is the company and product studio."],
            ["DryLake", "DryLake is the current product for AI coding workflows."],
            ["More products", "Future products should live beside DryLake, not underneath it."],
          ].map(([title, body]) => (
            <article className="rounded-lg border border-zinc-800 bg-[#111414] p-5" key={title}>
              <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{body}</p>
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
