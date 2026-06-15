import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { getConfiguredAppOrigin, getConfiguredAppUrlForPath } from "@/lib/site-hosts";

const xupraPortfolio = [
  {
    eyebrow: "Xupra product",
    title: "DryLake",
    summary: "Agent Control, free local scans, and Guard security review.",
    body:
      "DryLake gives teams a real operating surface for coding agents: plan the work, scan the local agent/MCP surface, and decide what can safely move into deeper review.",
    href: "/products/drylake",
    primaryLabel: "View product",
    secondaryLabel: "Open app",
    secondaryHref: getConfiguredAppOrigin(),
    signal: "Agent Control + Guard",
    accent: "emerald",
  },
  {
    eyebrow: "Xupra product",
    title: "KYA Registry",
    summary: "Hosted Know Your Agent certificates and public verification.",
    body:
      "KYA Registry issues hosted credentials, publishes approved company and agent listings, and gives counterpart agents a live verification endpoint before transactions.",
    href: "/kya-registry",
    primaryLabel: "View product",
    secondaryLabel: "Sample certificate",
    secondaryHref: "/kya-registry/sample-certificate",
    signal: "Certificate + Registry",
    accent: "orange",
  },
] as const;

const boundaryCards = [
  {
    title: "Xupra",
    body: "The company and product portfolio. Xupra owns the public product hierarchy and the hosted certificate issuer.",
  },
  {
    title: "DryLake",
    body: "The product for agent operations, Guard reviews, and team-level security workflows. Agent Control and Guard stay inside DryLake.",
  },
  {
    title: "KYA Registry",
    body: "The product for public agent trust, hosted certificates, and registry listings for approved companies and assets.",
  },
] as const;

const dryLakeCapabilities = [
  {
    title: "Agent Control",
    body: "Structured planning, phased execution, and visible agent handoffs for engineering work.",
  },
  {
    title: "Guard",
    body: "Local-first agent and MCP security review with approved upload only when deeper analysis is needed.",
  },
  {
    title: "Guard for Teams",
    body: "Shared baselines, policy, drift history, and recurring review for organizations that need team security workflows.",
  },
] as const;

const dryLakeBoundaryNotes = [
  {
    title: "Product home",
    body: "DryLake is presented under Xupra Products so the company hierarchy is explicit.",
  },
  {
    title: "Application host",
    body: "The operating app remains on the dedicated DryLake host so product marketing and product operation stay separate.",
  },
  {
    title: "Feature boundary",
    body: "Agent Control and Guard are DryLake capabilities. They are not separate Xupra products.",
  },
] as const;

const kyaWorkflow = [
  {
    step: "01",
    title: "Discover and contact",
    body: "Xupra identifies a company's MCP server or agent surface, then emails them with the registry and certificate model.",
  },
  {
    step: "02",
    title: "Agreement and invoice",
    body: "If the company wants to proceed, Xupra sends the Stripe invoice before any certification work begins.",
  },
  {
    step: "03",
    title: "Review and remediation",
    body: "After payment, Xupra runs the review, reports issues privately, and may collect additional survey or evidence material.",
  },
  {
    step: "04",
    title: "Issue and publish",
    body: "Approved companies receive a hosted certificate and a public registry listing for the reviewed company, agent, or MCP asset.",
  },
] as const;

const kyaHandshake = [
  {
    title: "Publish certificate reference",
    body: "The company embeds a hosted certificate URL or certificate ID in the agent file, card, or transaction policy.",
  },
  {
    title: "Fetch issuer and certificate",
    body: "The counterpart agent retrieves the Xupra issuer metadata and the AWS-backed hosted certificate JSON before a transaction starts.",
  },
  {
    title: "Verify policy and status",
    body: "The agent checks signature, subject identity, asset binding, active status, expiry, and policy requirements.",
  },
  {
    title: "Challenge the live agent",
    body: "A nonce challenge proves the live agent controls the operational key bound to the certified asset before the exchange proceeds.",
  },
] as const;

const trustPartners = [
  {
    name: "99VC",
    detail: "venture backing",
  },
  {
    name: "AWS",
    detail: "Startups",
  },
] as const;

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
      ? "xupra-button-primary inline-flex w-full items-center justify-center rounded px-5 py-3 text-sm transition hover:-translate-y-0.5 sm:w-auto"
      : "xupra-button-secondary inline-flex w-full items-center justify-center rounded px-5 py-3 text-sm transition hover:-translate-y-0.5 sm:w-auto";

  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href} rel={href.startsWith("http") ? "noreferrer" : undefined}>
      {children}
    </a>
  );
}

function PortfolioCard({
  accent,
  eyebrow,
  title,
  summary,
  body,
  href,
  primaryLabel,
  signal,
  secondaryLabel,
  secondaryHref,
}: (typeof xupraPortfolio)[number]) {
  const accentClassName =
    accent === "emerald"
      ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]"
      : "border-orange-200 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.98))]";

  return (
    <article className={`group relative isolate flex h-full min-h-72 flex-col overflow-hidden rounded-lg border p-6 transition duration-300 hover:-translate-y-1 hover:border-zinc-400 ${accentClassName}`}>
      <span className="absolute inset-0 -z-10 xupra-panel-glow" />
      <span className="absolute -right-8 top-8 -z-10 h-32 w-32 rotate-45 border border-zinc-200" />
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {eyebrow}
        </p>
        <span className="border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          {signal}
        </span>
      </div>
      <h2 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950">{title}</h2>
      <p className="mt-4 text-lg leading-7 text-zinc-900">{summary}</p>
      <p className="mt-4 text-sm leading-7 text-zinc-600">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ActionLink href={href}>{primaryLabel}</ActionLink>
        {secondaryLabel && secondaryHref ? (
          <ActionLink href={secondaryHref} variant="secondary">
            {secondaryLabel}
          </ActionLink>
        ) : null}
      </div>
    </article>
  );
}

function TrustMark({ detail, name }: (typeof trustPartners)[number]) {
  return (
    <div className="grid min-w-36 gap-1 rounded border border-zinc-300 bg-white/90 px-4 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <span className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-zinc-950">
        {name}
      </span>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {detail}
      </span>
    </div>
  );
}

function AgentTrustMap() {
  const nodes = [
    {
      label: "Company MCP",
      detail: "reviewed endpoint",
      className: "left-8 top-10 border-emerald-200 bg-emerald-50",
    },
    {
      label: "Hosted KYA Cert",
      detail: "signed public record",
      className: "right-8 top-10 border-orange-200 bg-orange-50",
    },
    {
      label: "Verifier Agent",
      detail: "counterparty lookup",
      className: "bottom-12 left-8 border-sky-200 bg-sky-50",
    },
    {
      label: "Live MCP Challenge",
      detail: "nonce proof",
      className: "bottom-12 right-8 border-violet-200 bg-violet-50",
    },
  ] as const;

  return (
    <section
      aria-label="Agent security and verification map"
      className="xupra-technical-graphic relative min-h-[34rem] min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.1)]"
      style={{ width: "min(100%, calc(100vw - 2.5rem))" }}
    >
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 720 560"
      >
        <defs>
          <linearGradient id="xupra-flow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
            <stop offset="52%" stopColor="#2563eb" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#e87528" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path className="xupra-flow-path" d="M130 126 C242 118 286 210 360 232 C448 258 504 156 596 126" fill="none" stroke="url(#xupra-flow)" strokeWidth="3" />
        <path className="xupra-flow-path" d="M124 424 C224 334 294 374 360 286 C436 184 508 336 596 424" fill="none" stroke="url(#xupra-flow)" strokeWidth="3" />
        <path d="M122 126 H220 V282 H360" fill="none" stroke="rgba(15,23,42,0.16)" strokeWidth="1.4" />
        <path d="M596 126 H500 V282 H360" fill="none" stroke="rgba(15,23,42,0.16)" strokeWidth="1.4" />
        <path d="M124 424 H226 V282 H360" fill="none" stroke="rgba(15,23,42,0.16)" strokeWidth="1.4" />
        <path d="M596 424 H498 V282 H360" fill="none" stroke="rgba(15,23,42,0.16)" strokeWidth="1.4" />
        <circle cx="130" cy="126" fill="#10b981" r="6" />
        <circle cx="596" cy="126" fill="#e87528" r="6" />
        <circle cx="124" cy="424" fill="#2563eb" r="6" />
        <circle cx="596" cy="424" fill="#7c3aed" r="6" />
      </svg>

      {nodes.map((node) => (
        <div
          className={`absolute w-44 rounded border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${node.className}`}
          key={node.label}
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {node.detail}
          </p>
          <p className="mt-2 text-base font-semibold text-zinc-950">{node.label}</p>
        </div>
      ))}

      <div className="absolute left-1/2 top-1/2 grid h-48 w-48 -translate-x-1/2 -translate-y-1/2 place-items-center border border-zinc-300 bg-white/92 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="absolute inset-4 border border-emerald-300/60" />
        <div className="absolute inset-8 border border-orange-300/70" />
        <div className="relative text-center">
          <div className="font-[family-name:var(--font-heading)] text-4xl font-semibold text-zinc-950">X</div>
          <div className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Sign + verify
          </div>
        </div>
      </div>

      <div className="absolute inset-x-8 bottom-5 border-t border-zinc-300 pt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        certificate lookup / policy check / live challenge / transaction approval
      </div>
    </section>
  );
}

export function XupraCorporateHomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f7f3] text-zinc-950">
      <section className="relative isolate overflow-hidden border-b border-zinc-300 bg-[#f6f7f3]">
        <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.8),transparent_36%),radial-gradient(circle_at_12%_18%,rgba(0,201,139,0.16),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(232,117,40,0.13),transparent_26%)]" />
        <div className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-10 lg:py-20">
          <section
            className="min-w-0 max-w-3xl"
            style={{ width: "min(100%, calc(100vw - 2.5rem))" }}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Xupra
            </p>
            <h1 className="mt-5 max-w-full break-words font-[family-name:var(--font-heading)] text-[2.65rem] font-semibold leading-[1.02] tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl">
              <span className="block">DryLake and</span>
              <span className="block">KYA Registry:</span>
              <span className="block">security for</span>
              <span className="block">the agentic era.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700">
              <span className="block">Agent Control, free security scans,</span>
              <span className="block">and hosted Know Your Agent verification</span>
              <span className="block">for agent-to-agent transactions.</span>
            </p>

            <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              {trustPartners.map((partner) => (
                <TrustMark key={partner.name} {...partner} />
              ))}
            </div>

            <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
              <ActionLink href="/products/drylake">Explore DryLake</ActionLink>
              <ActionLink href="/kya-registry" variant="secondary">
                KYA Registry
              </ActionLink>
              <ActionLink href="/products" variant="secondary">
                Products
              </ActionLink>
            </div>
          </section>

          <AgentTrustMap />
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                Product system
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                Two products. One agent trust stack.
              </h2>
            </div>
            <p className="max-w-3xl text-base leading-8 text-zinc-600 lg:justify-self-end">
              DryLake secures the operating workflow. KYA Registry verifies the public counterpart. The site navigation should make that hierarchy obvious from every page.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {xupraPortfolio.map((product) => (
              <PortfolioCard key={product.title} {...product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#e7ebe8] text-[#101414]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-16 sm:px-8 lg:grid-cols-3 lg:px-10">
          {boundaryCards.map((item) => (
            <article key={item.title} className="border border-[#bcc8c3] bg-[#f5f7f4] p-6">
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#4a5652]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function XupraProductsIndexPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f3] text-zinc-950">
      <section className="border-b border-zinc-300 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Xupra products
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold leading-tight text-zinc-950 sm:text-5xl lg:text-6xl">
              Product portfolio
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-700">
              DryLake and KYA Registry solve different parts of the agent stack. One is for operating and securing teams. The other is for verifying counterpart agents and hosted credentials.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {xupraPortfolio.map((product) => (
              <PortfolioCard key={product.title} {...product} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-[#e7ece8]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-16 sm:px-8 lg:grid-cols-3 lg:px-10">
          {boundaryCards.map((item) => (
            <article key={item.title} className="border border-zinc-300 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function DryLakeProductPage() {
  const openAppHref = getConfiguredAppOrigin();
  const pricingHref = getConfiguredAppUrlForPath("/pricing");
  const guardHref = getConfiguredAppUrlForPath("/guard");
  const installHref = getConfiguredAppUrlForPath("/extensions/install");
  const dryLakeShowcase = [
    {
      title: "Agent Control workflow",
      eyebrow: "Plan and hand off",
      src: "/marketplace/extension/media/agent-control.gif",
      alt: "DryLake Agent Control workflow showing phase cards, agent selection, skills, terminal handoffs, and completed outcomes",
      body: "Plan the work, assign the right agent, and keep every handoff visible before code changes happen.",
    },
    {
      title: "Free local Guard scan",
      eyebrow: "Start local",
      src: "/marketplace/extension/media/guard-security.gif",
      alt: "DryLake Guard security workflow showing local scan progress, report sections, approved upload, Team Baseline, and Continuous Watch",
      body: "Scan MCP servers, extensions, secrets, and blast radius locally before deciding whether anything needs cloud review.",
    },
    {
      title: "Paid remediation and cloud analysis",
      eyebrow: "Go deeper",
      src: "/marketplace/extension/media/guard-paid-features.gif",
      alt: "DryLake paid security workflow showing Fix with AI, Deep Cloud Analysis, saved reports, team policy, baseline drift, Continuous Watch, and local Watchdog",
      body: "Approve deeper analysis only when the team needs Fix with AI, saved reports, baseline drift, or recurring watch history.",
    },
  ] as const;

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-zinc-950">
      <section className="relative overflow-hidden border-b border-zinc-300 bg-[#f6f7f3]">
        <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(0,201,139,0.16),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(232,117,40,0.14),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-10 lg:py-20">
          <section className="max-w-3xl pt-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Xupra product
            </p>
            <h1 className="mt-5 max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-950 sm:text-6xl lg:text-7xl">
              DryLake is Agent Control and security in one workflow.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700">
              The DryLake product page is the Agent Control page: plan the work, run local Guard scans, and approve deeper security review from one operating surface.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={openAppHref}>Open DryLake</ActionLink>
              <ActionLink href={installHref} variant="secondary">
                Install extension
              </ActionLink>
              <ActionLink href={pricingHref} variant="secondary">
                View pricing
              </ActionLink>
            </div>
          </section>

          <section className="grid gap-4">
            {dryLakeShowcase.slice(0, 2).map((item) => (
              <article
                className="overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                key={item.title}
              >
                <div className="border-b border-zinc-200 px-4 py-3">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">{item.title}</h2>
                </div>
                <Image
                  alt={item.alt}
                  className="aspect-video w-full object-cover object-top"
                  height={720}
                  priority
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  src={item.src}
                  unoptimized
                  width={1280}
                />
                <p className="px-4 py-4 text-sm leading-7 text-zinc-600">{item.body}</p>
              </article>
            ))}
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              Product capabilities
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-950 sm:text-4xl">
              Agent Control and Guard stay inside DryLake.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {dryLakeCapabilities.map((item) => (
              <article key={item.title} className="border border-zinc-300 bg-[#f8faf8] p-6">
                <h3 className="text-xl font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-[#e7ece8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <article className="overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="border-b border-zinc-200 px-4 py-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                Paid review path
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                Deeper review only when the team approves it.
              </h2>
            </div>
            <Image
              alt={dryLakeShowcase[2].alt}
              className="aspect-video w-full object-cover object-top"
              height={720}
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={dryLakeShowcase[2].src}
              unoptimized
              width={1280}
            />
            <p className="px-4 py-4 text-sm leading-7 text-zinc-600">{dryLakeShowcase[2].body}</p>
          </article>

          <div className="grid content-start gap-4">
            {dryLakeBoundaryNotes.map((item) => (
              <article key={item.title} className="border border-zinc-300 bg-white p-6">
                <h3 className="text-xl font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{item.body}</p>
              </article>
            ))}
            <ActionLink href={guardHref} variant="secondary">
              Learn Guard
            </ActionLink>
          </div>
        </div>
      </section>
    </main>
  );
}

export function KyaRegistryProductPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f3] text-zinc-950">
      <section className="border-b border-zinc-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-20">
          <section className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Xupra product
            </p>
            <h1 className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.02] text-zinc-950 sm:text-6xl lg:text-7xl">
              KYA Registry
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700">
              KYA Registry is the Xupra product for AWS-backed Know Your Agent certificates, public registry listings, and online verification before agent-to-agent transactions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href="/kya-registry">Open product site</ActionLink>
              <ActionLink href="/kya-registry/registry" variant="secondary">
                View public registry
              </ActionLink>
              <ActionLink href="mailto:registry@xupracorp.com" variant="secondary">
                Contact registry
              </ActionLink>
            </div>
          </section>

          <section className="border border-zinc-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="border-b border-zinc-200 px-6 py-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                Verification handshake
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                Hosted certificate first. Live challenge second.
              </h2>
            </div>
            <div className="grid gap-px bg-zinc-200">
              {kyaHandshake.map((item, index) => (
                <article className="grid gap-3 bg-white px-6 py-5 sm:grid-cols-[2rem_1fr]" key={item.title}>
                  <div className="font-mono text-sm font-semibold text-emerald-700">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-600">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-[#e7ece8]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              Commercial flow
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-950 sm:text-4xl">
              Outreach and review happen before public publication.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {kyaWorkflow.map((item) => (
              <article key={item.title} className="border border-zinc-300 bg-white p-5">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {item.step}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-zinc-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
