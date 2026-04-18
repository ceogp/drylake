import Link from "next/link";

const steps = [
  "Install the Xupra DryLake extension in VS Code or Cursor.",
  "Click Connect and complete sign-in in the browser.",
  "Open a repo with agent files like AGENTS.md, CLAUDE.md, skills, rules, or subagents.",
  "Import the workspace into an existing or new Xupra package version.",
  "Run compatibility checks and generate export previews for the target platform.",
  "Pull generated files back into the repo or deploy from the selected version."
];

const webControls = [
  "Account and personal settings",
  "Billing and subscription management",
  "Credential vault",
  "Integrations",
  "Reports",
  "Platform admin"
];

export default function ExtensionInstallPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Install And Connect</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Start in the extension. Use the website for control-plane work.
          </h1>
          <p className="max-w-4xl text-lg leading-8 text-stone-700">
            Xupra is designed so the repo workflow happens in VS Code or Cursor while the website handles account,
            billing, credentials, reporting, and admin.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              First-run checklist
            </p>
            <div className="mt-5 grid gap-4">
              {steps.map((step, index) => (
                <div key={step} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-stone-700">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    Step {index + 1}
                  </span>
                  <p className="mt-2">{step}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Website control plane
            </p>
            <div className="mt-5 grid gap-3">
              {webControls.map((item) => (
                <div key={item} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-stone-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" href="/app">
                Open App
              </Link>
              <Link className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/extensions">
                Back To Extension Page
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
