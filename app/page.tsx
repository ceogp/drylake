import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import {
  getConfiguredAppOrigin,
  isConfiguredMarketingHost,
  normalizeHost,
} from "@/lib/site-hosts";

const platforms = ["Codex", "Claude Code", "Cursor", "Claude Agents"];

function DryLakeHome() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(120,53,15,0.12),_transparent_28%),linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_50%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 md:px-10 lg:py-20">
        <section className="overflow-hidden rounded-[2.5rem] border border-orange-200/80 bg-white/88 px-6 py-8 shadow-[0_24px_60px_rgba(120,53,15,0.10)] backdrop-blur md:px-10 md:py-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Image
                  alt="Xupra logo"
                  className="h-16 w-16 rounded-[1.4rem] shadow-[0_18px_48px_rgba(15,23,42,0.10)]"
                  height={64}
                  priority
                  src="/xupra-logo.svg"
                  width={64}
                />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-orange-700">
                    Xupra
                  </p>
                  <p className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-stone-950">
                    DryLake
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-orange-300/70 bg-orange-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-orange-900">
                Agent Transfer
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.07em] text-stone-950 sm:text-6xl lg:text-7xl">
                Import your skills and agents. Then install them in the next tool.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700 sm:text-xl">
                Start by importing an existing repo folder or selected files. Xupra stores the raw
                source files, canonicalizes them with Kimi, and hands install back to your editor.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                href="/upload"
              >
                Import Skills And Agents
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/install"
              >
                Install
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {platforms.map((platform) => (
                <div
                  key={platform}
                  className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-stone-700"
                >
                  {platform}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">1. Import</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Choose a repo folder or selected files from the import page.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">2. Canonicalize</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Convert raw source into portable agents, skills, rules, and instructions with Kimi.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">3. Install</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Pick Cursor, Codex, Claude, or a custom path and let the extension write files.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function MarketingHome() {
  const dryLakeOrigin = getConfiguredAppOrigin();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,_rgba(234,88,12,0.18),_transparent_30%),radial-gradient(circle_at_85%_0%,_rgba(28,15,6,0.18),_transparent_28%),linear-gradient(180deg,_#fffdf9_0%,_#fff7ed_42%,_#f8fafc_100%)]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-14 md:px-10 lg:py-20">
        <section className="overflow-hidden rounded-[2.75rem] border border-stone-200 bg-white/92 shadow-[0_30px_90px_rgba(28,15,6,0.12)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col gap-8 px-6 py-8 md:px-10 md:py-12">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Image
                    alt="Xupra logo"
                    className="h-16 w-16 rounded-[1.4rem] shadow-[0_18px_48px_rgba(15,23,42,0.10)]"
                    height={64}
                    priority
                    src="/xupra-logo.svg"
                    width={64}
                  />
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-orange-700">
                      Xupra
                    </p>
                    <p className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-stone-950">
                      AI Product Studio
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-stone-300/70 bg-stone-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-stone-800">
                  Shipping DryLake
                </div>
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.07em] text-stone-950 sm:text-6xl lg:text-7xl">
                  Xupra builds practical AI software for teams shipping with agents.
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-stone-700 sm:text-xl">
                  Our live product is DryLake: a portability layer for repository skills, rules, and
                  agent files. Import what already works, canonicalize it, and install it into the next
                  editor or agent platform without rebuilding everything by hand.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <a
                  className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                  href={dryLakeOrigin}
                >
                  Open DryLake
                </a>
                <a
                  className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                  href={`${dryLakeOrigin}/upload`}
                >
                  Import Skills And Agents
                </a>
                <Link
                  className="rounded-full border border-orange-200 bg-orange-50 px-6 py-4 font-medium text-orange-950 transition hover:bg-orange-100"
                  href="/about"
                >
                  About Xupra
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {["Codex", "Claude Code", "Cursor"].map((platform) => (
                  <div
                    key={platform}
                    className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-stone-700"
                  >
                    {platform}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-200 bg-[#1c0f06] p-6 text-white md:p-10 lg:border-l lg:border-t-0">
              <div className="flex h-full flex-col justify-between gap-10">
                <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-200">
                    Live product URL
                  </p>
                  <p className="mt-3 break-all font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-white">
                    {dryLakeOrigin}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-orange-50/78">
                    Use this domain for extension connect, Clerk auth, billing, and the full user onboarding flow.
                  </p>
                </div>

                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-200">
                    Company
                  </p>
                  <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-[-0.06em] text-white">
                    Built in Japan and the US.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-orange-50/78">
                    Xupra KK focuses on transparent AI workflows, agent portability, and practical
                    tools that fit into existing engineering systems.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1c0f06] transition hover:bg-orange-100"
                      href="/about"
                    >
                      Read about Xupra
                    </Link>
                    <a
                      className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      href="mailto:support@xupracorp.com"
                    >
                      Support
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Import</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Bring in existing agent files, rules, prompts, and skill folders from a repo or local editor setup.
            </p>
          </div>
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Canonicalize</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Convert platform-specific instructions into a portable representation that can be reviewed.
            </p>
          </div>
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Install</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Write generated files into Codex, Claude Code, Cursor, and other supported runtimes.
            </p>
          </div>
        </section>
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
    return <MarketingHome />;
  }

  return <DryLakeHome />;
}
