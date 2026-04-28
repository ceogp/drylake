import Link from "next/link";
import { notFound } from "next/navigation";

import { createVersionAction } from "@/app/actions";
import { requirePackageAccess } from "@/lib/services/access";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    packageId: string;
  }>;
};

export default async function PackagePage({ params }: PageProps) {
  const { packageId } = await params;
  const access = await requirePackageAccess(packageId).catch(() => null);

  if (!access) {
    notFound();
  }

  const agentPackage = await prisma.agentPackage.findUnique({
    where: { id: access.agentPackage.id },
    include: {
      project: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          subagents: true,
          skillRules: true,
          files: true,
        },
      },
    },
  });

  if (!agentPackage) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <Link className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700" href={`/projects/${agentPackage.projectId}`}>
            {agentPackage.project.name}
          </Link>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            {agentPackage.name}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            {agentPackage.description || "This package defines one transferable agent configuration family."}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="grid gap-5">
            {agentPackage.versions.map((version) => (
              <article key={version.id} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {version.status} · {version.origin}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                      <Link href={`/versions/${version.id}`}>Version {version.versionNumber}</Link>
                    </h2>
                  </div>
                  <Link className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href={`/versions/${version.id}`}>
                    Open editor
                  </Link>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-stone-700 sm:grid-cols-3">
                  <div className="rounded-2xl bg-stone-50 px-4 py-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Subagents</span>
                    <div className="mt-2 text-xl font-semibold text-stone-950">{version.subagents.length}</div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Rules</span>
                    <div className="mt-2 text-xl font-semibold text-stone-950">{version.skillRules.length}</div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Files</span>
                    <div className="mt-2 text-xl font-semibold text-stone-950">{version.files.length}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,53,15,0.08)]">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Create Version
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Draft a new package version before importing files, checking compatibility, or exporting to a target platform.
            </p>
            <form action={createVersionAction} className="mt-6 grid gap-4">
              <input name="packageId" type="hidden" value={agentPackage.id} />
              <button className="rounded-full bg-stone-950 px-5 py-3 font-medium text-white transition hover:bg-stone-800" type="submit">
                Create Version
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
