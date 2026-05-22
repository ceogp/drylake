import Image from "next/image";
import Link from "next/link";

import { createProjectAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getActiveWorkspace, getImportWorkspacePath } from "@/lib/services/workspace";

export async function AppHome() {
  await requireCurrentAppContextForPage();
  const workspace = await getActiveWorkspace();
  const importWorkspacePath = (await getImportWorkspacePath()) ?? "/workspace";

  if (!workspace) {
    return (
      <main className="tape-page flex min-h-screen items-center justify-center px-6 py-16">
        <div className="tape-panel max-w-2xl bg-white p-8">
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            Xupra DryLake needs a starting account.
          </h1>
          <p className="mt-4 text-lg leading-8 text-stone-700">
            Seed the database or create the first organization so agent packages, projects, and transfer jobs have a home.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="tape-page flex min-h-screen flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-16 md:px-10 lg:py-24">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="tape-card flex items-center gap-4 bg-white px-4 py-3">
              <Image
                alt="Xupra logo"
                className="h-12 w-12 rounded-[4px] border-[3px] border-black bg-white"
                height={48}
                src="/xupra-logo.svg"
                width={48}
              />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-stone-500">
                  Xupra DryLake
                </p>
                <p className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
                  Dashboard
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="tape-button bg-[#ffd60a] px-5 py-3 text-sm text-black"
                href={importWorkspacePath}
              >
                Import Skills & Agents
              </Link>
              <Link
                className="tape-button bg-white px-5 py-3 text-sm text-black"
                href="/billing"
              >
                Billing
              </Link>
              <Link
                className="tape-button bg-white px-5 py-3 text-sm text-black"
                href="/settings"
              >
                Settings
              </Link>
              <Link
                className="tape-button bg-white px-5 py-3 text-sm text-black"
                href="/"
              >
                View Homepage
              </Link>
            </div>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-stone-950 sm:text-6xl">
                Your workspace for the extension-led workflow.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-stone-700">
                Start by importing skills and agents from your repo into the workspace. After the
                import is visible, use compatibility checks, export preview, deployment, or the
                editor extension as needed.
              </p>
            </div>
            <div className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-stone-500">Active workspace</p>
              <div className="mt-4 space-y-3 text-sm text-stone-700">
                <p className="text-xl font-semibold text-stone-950">{workspace.organization.name}</p>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] ${
                      workspace.organization.tier === "pro"
                        ? "border border-green-300 bg-green-50 text-green-700"
                        : workspace.organization.tier === "enterprise"
                          ? "border border-purple-300 bg-purple-50 text-purple-700"
                        : "border border-stone-300 bg-stone-100 text-stone-600"
                    }`}
                  >
                    {workspace.organization.tier === "pro"
                      ? "Pro"
                      : workspace.organization.tier === "enterprise"
                        ? "Enterprise"
                        : "Free"}
                  </span>
                </div>
                <p>{workspace.organization.projects.length} active projects</p>
                <p>
                  {workspace.organization.projects.reduce(
                    (total, project) => total + project.packages.length,
                    0,
                  )}{" "}
                  package surfaces ready to move.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">First run</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Import first. Install later.
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
              Your workspace is ready. Import skills, agents, rules, and instruction files directly
              here so the canonical package has real source files before any extension workflow.
              </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="tape-button bg-[#ffd60a] px-4 py-2 text-sm text-black" href={importWorkspacePath}>
                Import Skills & Agents
              </Link>
              <Link className="tape-button bg-white px-4 py-2 text-sm text-black" href="/install">
                Install
              </Link>
            </div>
          </article>

          <article className="tape-panel bg-[#111111] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-300">Plan state</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white">
              {workspace.organization.tier === "free" ? "Free workspace active" : `${workspace.organization.tier} workspace active`}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-200">
              Keep onboarding simple: sign up, land in the workspace, then upgrade only when the
              heavier transfer and deployment workflow needs it.
            </p>
            {workspace.organization.tier === "free" ? (
              <div className="mt-5">
                <Link
                  className="tape-button bg-[#ffd60a] px-5 py-2 text-sm text-black"
                  href="/billing"
                >
                  Upgrade to Pro
                </Link>
              </div>
            ) : (
              <p className="mt-5 text-sm text-stone-400">
                You&apos;re on the {workspace.organization.tier === "enterprise" ? "Enterprise" : "Pro"} plan.
              </p>
            )}
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
            <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Extension workflow</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Start in VS Code or Cursor
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Connect the extension, scan the repo, import source files, and install generated outputs where the code already lives.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="tape-button bg-white px-4 py-2 text-sm text-black" href="/extensions/connect">
                Connect extension
              </Link>
              <Link className="tape-button bg-white px-4 py-2 text-sm text-black" href="/extensions/install">
                Install Extension
              </Link>
            </div>
          </article>

          <article className="tape-panel bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Canonical model</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Keep one package definition
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Xupra stores the imported files, normalizes them into one package version, and regenerates target-native outputs when needed.
            </p>
          </article>

            <article className="tape-panel bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Web control plane</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Manage the account layer here
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
              Use the website for project structure, billing, and account settings after users can
              already see imported files.
              </p>
            </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="grid gap-5">
            {workspace.organization.projects.map((project) => (
              <article key={project.id} className="tape-panel bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {project.packages.length} package{project.packages.length === 1 ? "" : "s"}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                      {project.name}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      {project.description || "No project description yet."}
                    </p>
                  </div>
                  <Link className="tape-button bg-white px-4 py-2 text-sm text-black" href={`/projects/${project.id}`}>
                    Open project
                  </Link>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {project.packages.map((agentPackage) => (
                    <Link
                      key={agentPackage.id}
                      className="border-[3px] border-black bg-[#ffd60a] px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-black"
                      href={`/packages/${agentPackage.id}`}
                    >
                      {agentPackage.name}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <section className="tape-panel bg-white p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Create Project
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Start a new agent library for a product line, team, or client environment.
            </p>
            <form action={createProjectAction} className="mt-6 grid gap-4">
              <input name="organizationId" type="hidden" value={workspace.organization.id} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Project name
                <input className="border-[3px] border-black px-4 py-3 text-sm" name="name" placeholder="Customer Support Agents" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Description
                <textarea className="min-h-28 border-[3px] border-black px-4 py-3 text-sm" name="description" placeholder="What this project is for" />
              </label>
              <button className="tape-button mt-2 bg-[#ffd60a] px-5 py-3 text-black" type="submit">
                Create Project
              </button>
            </form>
          </section>
        </section>
      </section>
    </main>
  );
}
