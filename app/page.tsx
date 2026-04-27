import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import {
  getConfiguredAppOrigin,
  getConfiguredMarketingOrigin,
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
                Upload your skills and agents. Then move them to the next platform.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700 sm:text-xl">
                Start by uploading an existing repo folder or selected files. Xupra stores the raw
                source files, imports skills and agents into a package version, and shows what landed
                before you generate target outputs.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                href="/workspace"
              >
                Upload Skills And Agents
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/get-started"
              >
                Get Started
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/extensions"
              >
                Extension
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
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">1. Upload</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Choose a repo folder or selected files from the web import workspace.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">2. Review</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Confirm raw files, extracted agents, skills, rules, and instructions on the version page.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">3. Export</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Generate Codex, Claude Code, Cursor, or Claude Agents output after the import is visible.
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
  const marketingOrigin = getConfiguredMarketingOrigin();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_32%),linear-gradient(180deg,_#fffdf9_0%,_#fffaf5_44%,_#f8fafc_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 md:px-10 lg:py-20">
        <section className="overflow-hidden rounded-[2.5rem] border border-stone-200 bg-white/92 px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur md:px-10 md:py-10">
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
                    Product Studio
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-stone-300/70 bg-stone-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-stone-800">
                Shipping DryLake
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.07em] text-stone-950 sm:text-6xl lg:text-7xl">
                Xupra builds DryLake for agent portability across editors and platforms.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700 sm:text-xl">
                DryLake is the live product for importing repository skills, rules, and agent files,
                then exporting them into the next platform without rebuilding everything by hand.
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
                href={`${dryLakeOrigin}/extensions/install`}
              >
                VS Code Install Flow
              </a>
            </div>

            <div className="rounded-[2rem] border border-stone-200 bg-stone-50/90 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Live product URL</p>
              <p className="mt-3 break-all font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-stone-950">
                {dryLakeOrigin}
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use this domain for extension connect, Clerk auth, billing, and the full user onboarding flow.
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-500">
                Marketing root: {marketingOrigin}
              </p>
            </div>
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
