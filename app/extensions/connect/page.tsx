import Link from "next/link";

import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";

const steps = [
  "Sign in on the website and generate an extension token below.",
  "Open VS Code or Cursor and run `Xupra DryLake: Connect`.",
  "Choose the token path and paste the value from this page.",
  "Keep working in the editor after the extension is linked to your workspace.",
];

export default async function ExtensionConnectPage() {
  const context = await requireCurrentAppContextForPage();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_46%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">
              Extension Connection
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
              Link VS Code or Cursor to {context.organization.name}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              This is the clean customer handoff: the website handles identity, then the extension
              takes over the repo workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/extensions/install"
            >
              Install Guide
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              href="/app"
            >
              Open App
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ExtensionConnectCard />

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              What to do
            </p>
            <div className="mt-5 grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-stone-700"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    Step {index + 1}
                  </span>
                  <p className="mt-2">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-700">
              If your repo does not keep skills, rules, or agent files in the default directories,
              add patterns in extension settings under <span className="font-mono text-xs">xupra.additionalScanPatterns</span>.
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
