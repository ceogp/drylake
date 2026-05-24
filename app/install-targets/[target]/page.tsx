import Link from "next/link";
import { notFound } from "next/navigation";

import { getInstallTarget, installTargets } from "@/lib/install-targets";

export function generateStaticParams() {
  return installTargets.map((target) => ({ target: target.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const installTarget = getInstallTarget(target);

  return {
    title: installTarget ? `${installTarget.name} Install Target` : "Install Target",
    description: installTarget?.summary ?? "DryLake install target details.",
  };
}

export default async function InstallTargetPage({ params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const installTarget = getInstallTarget(target);

  if (!installTarget) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-12 md:px-8 lg:py-16">
        <section className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
          <div className="grid gap-5">
            <Link className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 hover:text-orange-200" href="/">
              Back to DryLake
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded border border-emerald-400 bg-emerald-400 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-950">
                {installTarget.name}
              </span>
              <span className="rounded border border-orange-400/40 bg-orange-400/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-orange-200">
                Install target
              </span>
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl">
              {installTarget.summary}
            </h1>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">Output</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-50">What DryLake creates</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">{installTarget.output}</p>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-300">How it works</p>
            <div className="mt-4 grid gap-3">
              {installTarget.steps.map((step, index) => (
                <div key={step} className="grid grid-cols-[3.5rem_1fr] gap-3">
                  <span className="grid place-items-center rounded border border-zinc-700 bg-zinc-950 font-mono text-sm font-semibold text-emerald-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-medium leading-6 text-zinc-300">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
