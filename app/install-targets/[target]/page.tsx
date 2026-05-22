import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowTape, TapePanel, TapeWord } from "@/components/tape-brand";
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
    <main className="min-h-screen bg-[#f7f4ea] text-[#111111]">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-9">
        <TapePanel className="bg-white">
          <div className="grid gap-5">
            <Link className="font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-600 hover:text-black" href="/">
              Back to DryLake
            </Link>
            <div className="flex flex-wrap items-center gap-4" style={{ background: installTarget.color, padding: "16px" }}>
              <TapeWord text={installTarget.name.toUpperCase()} color="#111111" cell={5} gap={1} label={installTarget.name} variantSet={1} />
              <ArrowTape color="#111111" />
            </div>
            <h1 className="text-3xl font-black leading-tight text-stone-950 sm:text-4xl">
              {installTarget.summary}
            </h1>
          </div>
        </TapePanel>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <TapePanel className="bg-[#111111] text-white">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffd60a]">Output</p>
            <h2 className="mt-3 text-2xl font-black uppercase leading-none">What DryLake creates</h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-stone-100">{installTarget.output}</p>
          </TapePanel>

          <TapePanel className="bg-white">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-600">How it works</p>
            <div className="mt-4 grid gap-3">
              {installTarget.steps.map((step, index) => (
                <div key={step} className="grid grid-cols-[3.5rem_1fr] gap-3">
                  <span className="grid place-items-center border-[4px] border-black bg-[#ffd60a] font-mono text-xl font-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="border-[4px] border-black bg-[#f7f4ea] p-3 text-sm font-bold leading-6">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </TapePanel>
        </section>
      </section>
    </main>
  );
}