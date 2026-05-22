import Link from "next/link";

export default function ExtensionInstallPage() {
  return (
    <main className="tape-page min-h-screen">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="space-y-4">
          <p className="tape-eyebrow">
            Extension Install
          </p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black leading-tight text-stone-950 sm:text-5xl">
            Install DryLake Visual Planner in VS Code
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            Use DryLake to plan agent work as phases, then hand each phase to the tool that fits.
          </p>
        </div>

        <article className="tape-panel bg-white p-7">
          <p className="tape-eyebrow">
            VS Code Marketplace
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-black text-stone-950">
            Install from the public listing
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
            Use the marketplace listing if you want the normal install flow. After installation,
            open VS Code and run <span className="font-mono text-xs">Xupra DryLake: Connect</span>
            .
          </p>
          <a
            className="tape-button mt-5 bg-[#ffd60a] px-5 py-3 text-sm text-black"
            href="https://marketplace.visualstudio.com/items?itemName=xupracorp.drylake"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open VS Code Marketplace &#8599;
          </a>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Install via command line
              </p>
              <div className="mt-3 border-[4px] border-black bg-[#f7f4ea] px-5 py-4 font-mono text-xs text-stone-700">
                code --install-extension xupracorp.drylake
              </div>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                This works when the <span className="font-mono text-xs">code</span> CLI is on your
                PATH.
              </p>
            </div>

            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
                Manual fallback
              </p>
              <div className="mt-3 border-[4px] border-black bg-[#f7f4ea] px-5 py-4 text-sm leading-7 text-stone-700">
                Use <span className="font-mono text-xs">Extensions: Install from VSIX...</span> if
                you are testing a local build or do not have the CLI configured.
              </div>
            </div>
          </div>

          <div className="mt-8 border-[4px] border-black bg-[#f7f4ea] p-4 text-sm leading-7 text-stone-700">
            Need the browser handoff page after install?
            <Link
              className="mt-3 block font-medium text-orange-700 underline underline-offset-2 hover:text-orange-900"
              href="/extensions/connect"
            >
              Open the extension connect page &rarr;
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
