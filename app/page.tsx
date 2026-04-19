import Image from "next/image";
import Link from "next/link";

const platforms = ["Codex", "Claude Code", "Cursor", "Claude Agents"];

export default function Home() {
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
                Move agents from one platform to the next without rebuilding them by hand.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700 sm:text-xl">
                Sign up on the website, connect the extension, import the repo you already have, and let Xupra keep the source files while it generates the next platform format.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                href="/get-started"
              >
                Get Started
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/extensions"
              >
                VS Code Extension
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/extensions/install"
              >
                Install Flow
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
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">1. Sign up</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Start with any email and get a personal workspace automatically.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">2. Connect the extension</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Use VS Code or Cursor for the repo workflow and add custom scan paths only if the defaults miss something.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">3. Import, convert, export</p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                Keep the originals, build the canonical package once, then generate the target you need.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
