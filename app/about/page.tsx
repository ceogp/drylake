import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getConfiguredAppOrigin } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Xupra KK, Gopal Shangari, and DryLake, Xupra's AI agent portability product.",
};

export default function AboutPage() {
  const dryLakeOrigin = getConfiguredAppOrigin();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,_rgba(234,88,12,0.18),_transparent_28%),radial-gradient(circle_at_88%_16%,_rgba(28,15,6,0.15),_transparent_26%),linear-gradient(180deg,_#fffdf9_0%,_#fff7ed_45%,_#f8fafc_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 md:px-10 lg:py-20">
        <div className="grid overflow-hidden rounded-[2.75rem] border border-stone-200 bg-white shadow-[0_30px_90px_rgba(28,15,6,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="bg-[#1c0f06] p-8 text-white md:p-10">
            <Image
              alt="DryLake logo"
              className="h-20 w-20 rounded-[1.5rem] border border-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.24)]"
              height={80}
              priority
              src="/xupra-logo.svg"
              width={80}
            />
            <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-orange-200">
              Xupra KK
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.07em] text-white sm:text-6xl">
              AI infrastructure from Japan and the US.
            </h1>
            <p className="mt-6 text-base leading-8 text-orange-50/78">
              Xupra builds practical AI systems for engineering teams, with a focus on agent
              portability, transparent workflows, and products that fit into existing development
              environments.
            </p>
          </aside>

          <section className="p-8 md:p-10">
            <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">
                Founder
              </p>
              <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-[-0.06em] text-stone-950">
                Gopal Shangari
              </h2>
              <p className="mt-4 text-base leading-8 text-stone-700">
                Gopal Shangari is an American living in Japan and CEO of Xupra KK, an AI
                company in Japan and the US.
              </p>
              <p className="mt-4 text-base leading-8 text-stone-700">
                Cornell AB, Computational Neuroscience.
              </p>
              <a
                className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                href="https://www.linkedin.com/in/gpshangari/"
                rel="noreferrer"
                target="_blank"
              >
                LinkedIn profile
              </a>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  Contact
                </p>
                <a
                  className="mt-3 block break-all font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.04em] text-stone-950 transition hover:text-orange-700"
                  href="mailto:ceo@xupracorp.com"
                >
                  ceo@xupracorp.com
                </a>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  For company, partnership, and executive contact.
                </p>
              </div>

              <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                  User support
                </p>
                <a
                  className="mt-3 block break-all font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.04em] text-stone-950 transition hover:text-orange-700"
                  href="mailto:support@xupracorp.com"
                >
                  support@xupracorp.com
                </a>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  For DryLake account, extension, billing, and product support.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                Product
              </p>
              <p className="mt-3 text-base leading-8 text-stone-700">
                DryLake helps users import repository skills, rules, prompts, and agent files,
                then export or install them into the platform they want to use next.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className="rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
                  href={dryLakeOrigin}
                >
                  Open DryLake
                </a>
                <Link
                  className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
                  href="/"
                >
                  Back to Xupra
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
