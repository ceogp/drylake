import Image from "next/image";
import Link from "next/link";

const supportedSources = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/**/SKILL.md",
  ".codex/agents/*.toml",
  ".claude/skills/**/SKILL.md",
  ".claude/agents/*.md",
  ".cursor/skills/**/SKILL.md",
  ".cursor/rules/*.mdc",
  "Loose .md and .py"
];

export default function ExtensionsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.18),_transparent_28%),linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <section className="overflow-hidden rounded-[2.5rem] border border-orange-200/80 bg-white/90 p-8 shadow-[0_24px_60px_rgba(120,53,15,0.10)] md:p-10">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <Image
                alt="Xupra logo"
                className="h-14 w-14 rounded-[1.1rem]"
                height={56}
                src="/xupra-logo.svg"
                width={56}
              />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-orange-700">
                  VS Code Extension
                </p>
                <h1 className="font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-[-0.05em] text-stone-950 md:text-5xl">
                  Xupra DryLake lives where developers already work.
                </h1>
              </div>
            </div>

            <p className="max-w-4xl text-lg leading-8 text-stone-700">
              The extension is the main workflow for importing repos, checking portability,
              generating target files, and moving agents between Codex, Claude Code, Cursor,
              and Claude Agents. The website stays in the loop for auth, billing, credentials,
              reports, and admin.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                href="/get-started"
              >
                Get Started
              </Link>
              <Link
                className="rounded-full border border-stone-300 bg-white px-6 py-4 font-medium text-stone-900 transition hover:bg-stone-100"
                href="/extensions/install"
              >
                Install Flow
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              In-editor workflow
            </p>
            <div className="mt-4 grid gap-4 text-sm leading-7 text-stone-700">
              <p>1. Connect your Xupra account from VS Code or Cursor.</p>
              <p>2. Scan the current repo and detect supported agent files.</p>
              <p>3. Import those files into a canonical Xupra package version.</p>
              <p>4. Run compatibility checks and generate export previews.</p>
              <p>5. Pull generated files back into the repo or deploy when ready.</p>
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-stone-950 p-7 text-white shadow-[0_18px_45px_rgba(28,25,23,0.20)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-300">
              Supported sources
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {supportedSources.map((source) => (
                <span
                  key={source}
                  className="rounded-full border border-stone-700 bg-stone-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-200"
                >
                  {source}
                </span>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
