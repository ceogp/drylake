import Link from "next/link";

export default function ExtensionInstallPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_46%,_#ffffff_100%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Extension Install
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-stone-950">
              Install Xupra DryLake in VS Code or Cursor
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              The Xupra DryLake extension works in both VS Code and Cursor, so you can install it
              from either marketplace and connect the same workspace.
            </p>
          </div>
          <Link
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
            href="/extensions/connect"
          >
            Connect the extension &rarr;
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              VS Code
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Install from the VS Code Marketplace
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Add Xupra DryLake to VS Code from the marketplace, then connect it to your Xupra
              workspace from the editor sidebar.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-medium text-orange-700 underline underline-offset-2 hover:text-orange-900"
              href="https://marketplace.visualstudio.com/items?itemName=xupra.drylake"
              rel="noopener noreferrer"
              target="_blank"
            >
              Open VS Code Marketplace &#8599;
            </a>

            <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Or install via command line
            </p>
            <div className="mt-3 rounded-[1.35rem] border border-stone-200 bg-stone-50 px-5 py-4 font-mono text-xs text-stone-700">
              ext install xupra.drylake
            </div>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Cursor
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Install from the Cursor Marketplace
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Add Xupra DryLake to Cursor from the marketplace, then use the command palette or
              sidebar to connect it to Xupra.
            </p>
            <a
              className="mt-5 inline-flex text-sm font-medium text-orange-700 underline underline-offset-2 hover:text-orange-900"
              href="https://www.cursor.com/en/marketplace/xupra.drylake"
              rel="noopener noreferrer"
              target="_blank"
            >
              Open Cursor Marketplace &#8599;
            </a>

            <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
              Or install via command line
            </p>
            <div className="mt-3 rounded-[1.35rem] border border-stone-200 bg-stone-50 px-5 py-4 font-mono text-xs text-stone-700">
              ext install xupra.drylake
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-700">
              Once installed, click Connect in the sidebar or run{" "}
              <span className="font-mono text-xs">Xupra DryLake: Connect</span> from the command
              palette.
              <Link
                className="mt-3 block font-medium text-orange-700 underline underline-offset-2 hover:text-orange-900"
                href="/extensions/connect"
              >
                Connect the extension &rarr;
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
