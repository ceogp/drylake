import Link from "next/link";

const trustLinks = [
  { label: "99VC", href: "https://ninetynine.vc/" },
  { label: "AWS Startups", href: "https://aws.amazon.com/startups/" },
  { label: "AWS Cloud", href: "https://aws.amazon.com/" },
  { label: "GitLab", href: "https://gitlab.com/" },
];

export default function ExtensionInstallPage() {
  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 md:px-8 lg:py-16">
        <div className="space-y-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Extension Install
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
            Install DryLake Visual Planner in VS Code.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-zinc-300">
            Use DryLake to plan agent work as phases, assign agents, launch handoffs, and validate the resulting workspace.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
            <span>Backed by</span>
            {trustLinks.slice(0, 2).map((item) => (
              <a
                key={item.label}
                className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-200"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <article className="rounded-lg border border-zinc-800 bg-[#111414] p-7">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            VS Code Marketplace
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
            Install from the public listing
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            Use the marketplace listing for the normal install flow. After installation,
            open VS Code and run <span className="font-mono text-xs text-zinc-200">DryLake: Connect</span>.
          </p>
          <a
            className="mt-5 inline-flex rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            href="https://marketplace.visualstudio.com/items?itemName=xupracorp.drylake"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open VS Code Marketplace
          </a>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-300">
                Install via command line
              </p>
              <div className="mt-3 rounded border border-zinc-800 bg-black px-5 py-4 font-mono text-xs leading-6 text-zinc-300">
                &quot;C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd&quot; --install-extension xupracorp.drylake
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                Use the full Microsoft VS Code path if Cursor owns the <span className="font-mono text-xs">code</span>{" "}
                command on your PATH. Check with <span className="font-mono text-xs">where code</span>.
              </p>
            </div>

            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-300">
                Cursor and manual fallback
              </p>
              <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm leading-7 text-zinc-400">
                Cursor&apos;s CLI may search a different extension gallery. Use the Marketplace button for VS Code,
                or use <span className="font-mono text-xs text-zinc-200">Extensions: Install from VSIX...</span>{" "}
                when installing a local build in VS Code or Cursor.
              </div>
            </div>
          </div>

          <div className="mt-8 rounded border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-400">
            Need the browser handoff page after install?
            <Link
              className="mt-3 block font-medium text-orange-300 underline underline-offset-4 hover:text-orange-200"
              href="/extensions/connect"
            >
              Open the extension connect page
            </Link>
          </div>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-[#111414] p-7">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Security and infrastructure
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
            AWS Cloud infrastructure with GitLab delivery.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            DryLake is backed by 99VC and AWS Startups. Credentials and extension tokens are encrypted
            before storage, runtime secrets can use AWS Secrets Manager, and production deploys run
            through GitLab CI/CD validation and environment isolation checks.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {trustLinks.map((item) => (
              <a
                key={item.label}
                className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
