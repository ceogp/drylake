import Link from "next/link";

import { GetStartedAuthActions } from "@/components/get-started-auth-actions";
import { getAuthSetup } from "@/lib/services/auth";

const steps = [
  {
    eyebrow: "Step 1",
    title: "Create your Xupra workspace",
    body: "Sign up with any email. Xupra automatically creates your personal workspace and first import version.",
  },
  {
    eyebrow: "Step 2",
    title: "Upload skills and agents",
    body: "Choose a repo folder or selected files, then import them into the starter package version.",
  },
  {
    eyebrow: "Step 3",
    title: "Review before export",
    body: "Confirm raw files, extracted agents, skills, rules, and instructions are visible before worrying about extension sync or deployment.",
  },
];

const notes = [
  "You do not need to sign into every external service on day one.",
  "Default agent directories are scanned automatically.",
  "If your files live somewhere custom, add extra scan patterns in extension settings.",
  "Xupra stores the source files, builds the canonical package, and generates the target format after that.",
];

export default function GetStartedPage() {
  const auth = getAuthSetup();
  const useClerkUi = auth.mode === "clerk" && auth.configured;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.18),_transparent_28%),linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_45%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <section className="rounded-[2.5rem] border border-orange-200/80 bg-white/90 px-7 py-8 shadow-[0_24px_60px_rgba(120,53,15,0.10)] md:px-10 md:py-10">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">
                Get Started
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.06em] text-stone-950 sm:text-6xl">
                Sign up, then upload your skills and agents.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700">
                Xupra DryLake should feel simple on day one: create an account, land in your import
                workspace, upload the repo files you already have, and see what was imported.
              </p>
              <div className="flex flex-wrap gap-3">
                {useClerkUi ? (
                  <GetStartedAuthActions workspaceHref="/workspace" />
                ) : (
                  <Link
                    className="rounded-full bg-orange-600 px-6 py-4 font-medium text-white transition hover:bg-orange-700"
                    href="/workspace"
                  >
                    Upload Skills And Agents
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-stone-200 bg-stone-950 p-6 text-white shadow-[0_18px_45px_rgba(28,25,23,0.20)]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-300">
                What happens after sign up
              </p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-stone-200">
                <p>
                  Workspace creation:{" "}
                  <span className="text-white">automatic, including a starter import version</span>
                </p>
                <p>
                  After sign in: <span className="text-white">open the import workspace and upload files</span>
                </p>
                <p>
                  First plan: <span className="text-white">free by default</span>
                </p>
                <p>
                  External credentials: <span className="text-white">only when needed later</span>
                </p>
                <p>
                  Source detection: <span className="text-white">defaults first, custom patterns supported</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.title}
              className="rounded-[1.8rem] border border-stone-200 bg-white p-6 shadow-sm"
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">
                {step.eyebrow}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">{step.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Before you connect providers
            </p>
            <div className="mt-5 grid gap-3">
              {notes.map((note) => (
                <div
                  key={note}
                  className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700"
                >
                  {note}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Next pages
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <Link
                className="rounded-[1.35rem] border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50"
                href="/extensions/install"
              >
                Extension install guide
              </Link>
              <Link
                className="rounded-[1.35rem] border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50"
                href="/extensions"
              >
                Extension product page
              </Link>
              <Link
                className="rounded-[1.35rem] border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50"
                href="/extensions/connect"
              >
                Extension connect page
              </Link>
              <Link
                className="rounded-[1.35rem] border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50"
                href="/billing"
              >
                Billing and plans
              </Link>
              <Link
                className="rounded-[1.35rem] border border-stone-200 px-4 py-3 text-stone-800 transition hover:bg-stone-50"
                href="/workspace"
              >
                Upload skills and agents
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
