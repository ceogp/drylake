import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";

export const dynamic = "force-dynamic";

function excerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

export default async function SkillsPage() {
  const context = await requireCompletedOnboardingAppContextForPage("/skills");
  const packages = await prisma.agentPackage.findMany({
    where: {
      project: {
        organizationId: context.organization.id,
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      project: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          skillRules: {
            where: { kind: "skill" },
            orderBy: { createdAt: "desc" },
          },
          subagents: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  const skillCount = packages.reduce(
    (total, agentPackage) => total + (agentPackage.versions[0]?.skillRules.length ?? 0),
    0,
  );
  const agentCount = packages.reduce(
    (total, agentPackage) => total + (agentPackage.versions[0]?.subagents.length ?? 0),
    0,
  );

  return (
    <main className="tape-page min-h-screen">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="tape-eyebrow">Skills and agents</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-black uppercase text-stone-950">
              Your DryLake skill library.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-stone-700">
              Review the skills and subagents imported into {context.organization.name}. Use the extension or import page to add more files.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" href="/upload">
              Import Skills
            </Link>
            <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/extensions/connect">
              Connect Extension
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="tape-panel bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Packages</p>
            <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-stone-950">{packages.length}</p>
          </article>
          <article className="tape-panel bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Skills</p>
            <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-stone-950">{skillCount}</p>
          </article>
          <article className="tape-panel bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Subagents</p>
            <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold text-stone-950">{agentCount}</p>
          </article>
        </section>

        {packages.length === 0 ? (
          <section className="tape-panel bg-white p-7">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Empty library</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
              Import your first skills and agents.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-700">
              DryLake has your account, but no skills are imported yet. Start from the website import flow or connect the extension and import from your workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" href="/upload">
                Import Skills And Agents
              </Link>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/workspace">
                Open Workspace
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid gap-5">
            {packages.map((agentPackage) => {
              const version = agentPackage.versions[0];
              const skills = version?.skillRules ?? [];
              const subagents = version?.subagents ?? [];

              return (
                <article key={agentPackage.id} className="tape-panel bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        {agentPackage.project.name} / v{version?.versionNumber ?? "none"}
                      </p>
                      <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold text-stone-950">
                        {agentPackage.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-stone-700">
                        {agentPackage.description || "No package description yet."}
                      </p>
                    </div>
                    <Link className="tape-button bg-white px-4 py-2 text-sm text-black" href={`/packages/${agentPackage.id}`}>
                      Open Package
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Skills</p>
                      <div className="mt-4 grid gap-3">
                        {skills.length ? skills.map((skill) => (
                          <div key={skill.id} className="rounded border border-stone-200 bg-white px-4 py-3">
                            <p className="font-semibold text-stone-950">{skill.name}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600">{excerpt(skill.bodyMd)}</p>
                          </div>
                        )) : (
                          <p className="text-sm leading-7 text-stone-600">No skills found in the latest version.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Subagents</p>
                      <div className="mt-4 grid gap-3">
                        {subagents.length ? subagents.map((subagent) => (
                          <div key={subagent.id} className="rounded border border-stone-200 bg-white px-4 py-3">
                            <p className="font-semibold text-stone-950">{subagent.name}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600">{subagent.description}</p>
                          </div>
                        )) : (
                          <p className="text-sm leading-7 text-stone-600">No subagents found in the latest version.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
