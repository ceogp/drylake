import Link from "next/link";
import { notFound } from "next/navigation";

import { createDeploymentTargetAction, createPackageAction } from "@/app/actions";
import { requireProjectAccess } from "@/lib/services/access";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId).catch(() => null);

  if (!access) {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id: access.project.id },
    include: {
      organization: {
        include: {
          credentials: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      packages: {
        orderBy: { createdAt: "desc" },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 3,
          },
        },
      },
      deploymentTargets: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <Link className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700" href="/app">
            App
          </Link>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            {project.name}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            {project.description || "This project groups transferable agent packages."}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="grid gap-5">
            {project.packages.map((agentPackage) => (
              <article key={agentPackage.id} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
                      {agentPackage.sourcePlatform}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                      <Link href={`/packages/${agentPackage.id}`}>{agentPackage.name}</Link>
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      {agentPackage.description || "No package description yet."}
                    </p>
                  </div>
                  <Link className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href={`/packages/${agentPackage.id}`}>
                    Open package
                  </Link>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {agentPackage.versions.map((version) => (
                    <Link
                      key={version.id}
                      className="rounded-full bg-orange-100 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-orange-900"
                      href={`/versions/${version.id}`}
                    >
                      v{version.versionNumber}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,53,15,0.08)]">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Create Package
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Add a new transferable package for Codex, Claude Code, Cursor, or Claude Agents.
            </p>
            <form action={createPackageAction} className="mt-6 grid gap-4">
              <input name="projectId" type="hidden" value={project.id} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Name
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="name" placeholder="e.g. Mobile QA Reviewer" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Description
                <textarea className="min-h-28 rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="description" placeholder="What this package is for" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Source Platform
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="generic" name="sourcePlatform">
                  <option value="generic">Generic</option>
                  <option value="codex">Codex</option>
                  <option value="claude_code">Claude Code</option>
                  <option value="claude_agents">Claude Agents</option>
                  <option value="cursor">Cursor</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Default Export Target
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="claude_code" name="defaultTargetPlatform">
                  <option value="claude_code">Claude Code</option>
                  <option value="codex">Codex</option>
                  <option value="claude_agents">Claude Agents</option>
                  <option value="cursor">Cursor</option>
                </select>
              </label>
              <button className="mt-2 rounded-full bg-orange-600 px-5 py-3 font-medium text-white transition hover:bg-orange-700" type="submit">
                Create Package
              </button>
            </form>
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-5">
            {project.deploymentTargets.map((target) => {
              const config = ((target.configJson as Record<string, string | null> | null) ?? {});

              return (
                <article key={target.id} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        {target.platform} · {target.deliveryMode}
                      </p>
                      <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                        {target.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-stone-700">
                        {config.repository || config.repositoryPath || "No repository configured yet."}
                      </p>
                    </div>
                    {target.isDefault ? (
                      <span className="rounded-full bg-orange-100 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-orange-900">
                        default
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,53,15,0.08)]">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Create Deployment Target
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Bind a package family to a delivery target. Local repository paths work now; remote provider automation will layer on top.
            </p>
            <form action={createDeploymentTargetAction} className="mt-6 grid gap-4">
              <input name="projectId" type="hidden" value={project.id} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Name
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="name" placeholder="Main Claude Code Repo" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Platform
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="claude_code" name="platform">
                  <option value="codex">Codex</option>
                  <option value="claude_code">Claude Code</option>
                  <option value="claude_agents">Claude Agents</option>
                  <option value="cursor">Cursor</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Delivery mode
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="git_branch" name="deliveryMode">
                  <option value="git_branch">Git branch</option>
                  <option value="pull_request">Pull request</option>
                  <option value="download">Bundle only</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Repository label
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="repository" placeholder="org/repo" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Local repository path
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="repositoryPath" placeholder="C:\\repos\\my-agent-repo" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Base branch
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="main" name="baseBranch" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Export path inside repo
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="." name="exportPath" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Credential
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="" name="credentialId">
                  <option value="">None</option>
                  {project.organization.credentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credential.name} ({credential.provider})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-stone-900">
                <input name="isDefault" type="checkbox" />
                Mark as default target
              </label>
              <button className="mt-2 rounded-full bg-stone-950 px-5 py-3 font-medium text-white transition hover:bg-stone-800" type="submit">
                Create Deployment Target
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
