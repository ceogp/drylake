import Link from "next/link";

const steps = [
  "Open the web import workspace.",
  "Choose a repo folder or selected files.",
  "Upload and import source files into the starter package version.",
  "Confirm the raw files, extracted agents, skills, rules, and instructions are visible.",
  "Run compatibility checks after the import result is correct.",
  "Install the extension later if you want to scan and pull generated files directly from VS Code or Cursor.",
  "Add custom scan patterns only when a repo uses unusual directories.",
  "Upgrade only when export preview or deploy needs paid features."
];

const webControls = [
  "Import workspace and file review",
  "Billing and subscription management",
  "Account and personal settings",
  "Advanced deploy controls when needed"
];

export default function ExtensionInstallPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Install And Connect</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Start by uploading skills and agents.
          </h1>
          <p className="max-w-4xl text-lg leading-8 text-stone-700">
            The extension is useful, but it should not block the first test. The website has a real
            import workspace where you can upload a folder, import files, and review what landed.
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
              <Link className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" href="/get-started">
                Sign Up In Browser
              </Link>
              <Link className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800" href="/workspace">
                Upload Skills And Agents
              </Link>
              <Link className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/extensions/connect">
                Connect Extension
              </Link>
              <Link className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/app">
                Open App
              </Link>
              <Link className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/extensions">
                Back To Extension Page
              </Link>
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Service connections
            </p>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-stone-700">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4">
                Your Xupra account is the only thing you need to connect first.
              </div>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4">
                Add Git, deploy, or provider credentials later when a target actually needs them.
              </div>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4">
                Standard directories are scanned automatically, and custom patterns cover unusual repo layouts.
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" href="/workspace">
                Upload Skills And Agents
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
