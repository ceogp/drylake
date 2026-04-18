import Link from "next/link";
import { notFound } from "next/navigation";

import { addSkillRuleAction, addSubagentAction, updateVersionAction } from "@/app/actions";
import { VersionTools } from "@/components/version-tools";
import { requireVersionAccess } from "@/lib/services/access";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    versionId: string;
  }>;
};

export default async function VersionPage({ params }: PageProps) {
  const { versionId } = await params;
  const access = await requireVersionAccess(versionId).catch(() => null);

  if (!access) {
    notFound();
  }

  const version = await prisma.packageVersion.findUnique({
    where: { id: access.version.id },
    include: {
      files: {
        orderBy: { createdAt: "desc" },
      },
      subagents: {
        orderBy: { sortOrder: "asc" },
      },
      skillRules: {
        orderBy: { createdAt: "asc" },
      },
      transformJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      agentPackage: {
        include: {
          project: {
            include: {
              deploymentTargets: {
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
              },
            },
          },
        },
      },
      deploymentJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          deploymentTarget: true,
        },
      },
    },
  });

  if (!version) {
    notFound();
  }

  const manifest = (version.manifestJson as Record<string, unknown>) ?? {};
  const agentDefinition = (version.agentDefinitionJson as Record<string, unknown>) ?? {};
  const compatibility = (version.compatibilityJson as Record<string, Record<string, unknown>> | null) ?? {};
  const targetPlatforms = Array.isArray(manifest.targetPlatforms)
    ? (manifest.targetPlatforms as string[])
    : [];
  const tools = Array.isArray(agentDefinition.tools) ? (agentDefinition.tools as string[]) : [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.22em] text-orange-700">
            <Link href="/app">App</Link>
            <span>/</span>
            <Link href={`/projects/${version.agentPackage.projectId}`}>{version.agentPackage.project.name}</Link>
            <span>/</span>
            <Link href={`/packages/${version.agentPackageId}`}>{version.agentPackage.name}</Link>
            <span>/</span>
            <span>Version {version.versionNumber}</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
                Transfer Center
              </h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-stone-700">
                This version is the canonical package behind the extension workflow. Import source files, keep them, refine the package, then generate target outputs for Codex, Claude Code, Cursor, and Claude Agents.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-5 py-4 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Status</p>
              <p className="mt-2 text-sm text-stone-700">
                {version.status} · created {version.createdAt.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">1. Import</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Raw files come in from the extension or the web app and stay preserved in this version.
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">2. Canonicalize</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Instructions, subagents, rules, and package metadata become the source of truth here.
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">3. Export Or Deploy</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Use compatibility checks, export previews, and deployment targets to move the package into the next environment.
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <form action={updateVersionAction} className="grid gap-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <input name="versionId" type="hidden" value={version.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Manifest name
                <input
                  className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                  defaultValue={typeof manifest.name === "string" ? manifest.name : version.agentPackage.name}
                  name="manifestName"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Target platforms
                <input
                  className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                  defaultValue={targetPlatforms.join(", ")}
                  name="targetPlatforms"
                  placeholder="codex, claude_code, cursor"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              Package description
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={typeof agentDefinition.description === "string" ? agentDefinition.description : ""}
                name="description"
                placeholder="What this package should do"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              Tool list
              <input
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm"
                defaultValue={tools.join(", ")}
                name="tools"
                placeholder="Read, Grep, Glob"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              Instructions
              <textarea
                className="min-h-72 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7"
                defaultValue={typeof agentDefinition.instructions === "string" ? agentDefinition.instructions : ""}
                name="instructions"
                placeholder="Primary system instructions for the canonical package"
              />
            </label>
            <button className="w-fit rounded-full bg-orange-600 px-5 py-3 font-medium text-white transition hover:bg-orange-700" type="submit">
              Save Version
            </button>
          </form>

          <VersionTools
            versionId={version.id}
            deploymentTargets={version.agentPackage.project.deploymentTargets.map((target) => ({
              id: target.id,
              name: target.name,
              platform: target.platform,
              deliveryMode: target.deliveryMode,
            }))}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  Subagents
                </h2>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  Define specialized subagents that can be exported to Claude Code, Claude Agents, and flattened when needed for other targets.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-orange-900">
                {version.subagents.length} total
              </span>
            </div>
            <div className="grid gap-4">
              {version.subagents.map((subagent) => (
                <article key={subagent.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-stone-950">
                        {subagent.name}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-stone-700">{subagent.description}</p>
                    </div>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{subagent.slug}</span>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                    {subagent.instructionsMd}
                  </pre>
                </article>
              ))}
            </div>
            <form action={addSubagentAction} className="grid gap-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5">
              <input name="versionId" type="hidden" value={version.id} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Subagent name
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="name" placeholder="Migration Reviewer" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Description
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="description" placeholder="When this subagent should be used" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Tools
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="tools" placeholder="Read, Grep, Glob" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Instructions
                <textarea className="min-h-40 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7" name="instructions" placeholder="Focused system prompt for the subagent" required />
              </label>
              <button className="w-fit rounded-full bg-stone-950 px-5 py-3 font-medium text-white transition hover:bg-stone-800" type="submit">
                Add Subagent
              </button>
            </form>
          </div>

          <div className="space-y-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  Skills, Rules, and Imported Fragments
                </h2>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  Store reusable skills, imported Cursor `.mdc` content, rules, and prompt fragments that support target-specific exports.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-orange-900">
                {version.skillRules.length} total
              </span>
            </div>
            <div className="grid gap-4">
              {version.skillRules.map((rule) => (
                <article key={rule.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-stone-950">
                      {rule.name}
                    </h3>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{rule.kind}</span>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                    {rule.bodyMd}
                  </pre>
                </article>
              ))}
            </div>
            <form action={addSkillRuleAction} className="grid gap-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5">
              <input name="versionId" type="hidden" value={version.id} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Rule name
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="name" placeholder="SQL safety rules" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Kind
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="rule" name="kind">
                  <option value="rule">Rule</option>
                  <option value="skill">Skill</option>
                  <option value="prompt_fragment">Prompt Fragment</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Body
                <textarea className="min-h-40 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7" name="body" placeholder="Reusable guidance text" required />
              </label>
              <button className="w-fit rounded-full bg-stone-950 px-5 py-3 font-medium text-white transition hover:bg-stone-800" type="submit">
                Add Rule
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Imported and Generated Files
            </h2>
            <div className="mt-5 grid gap-3">
              {version.files.map((file) => (
                <div key={file.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{file.kind}</span>
                    <span className="font-mono text-xs text-stone-500">{file.sourceFormat}</span>
                  </div>
                  <div className="mt-2 break-all font-medium text-stone-950">{file.logicalPath}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Recent Jobs and Compatibility State
            </h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
                  Compatibility snapshot
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(compatibility).length > 0 ? (
                    Object.entries(compatibility).map(([target, result]) => (
                      <div key={target} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                        <div className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{target}</div>
                        <div className="mt-2 text-base font-semibold text-stone-950">
                          {typeof result?.status === "string" ? result.status : "unknown"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-700">No compatibility jobs have been run yet.</p>
                  )}
                </div>
              </div>

              {version.transformJobs.map((job) => (
                <article key={job.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        {job.jobType} {job.targetPlatform ? `· ${job.targetPlatform}` : ""}
                      </p>
                      <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
                        {job.status}
                      </h3>
                    </div>
                    <p className="font-mono text-xs text-stone-500">{job.createdAt.toLocaleString()}</p>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                    {JSON.stringify(job.resultJson ?? job.errorJson ?? {}, null, 2)}
                  </pre>
                </article>
              ))}

              {version.deploymentJobs.map((job) => (
                <article key={job.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        deployment · {job.deploymentTarget.name}
                      </p>
                      <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-semibold text-stone-950">
                        {job.status}
                      </h3>
                    </div>
                    <p className="font-mono text-xs text-stone-500">{job.createdAt.toLocaleString()}</p>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 px-4 py-4 font-mono text-xs leading-6 text-stone-100">
                    {JSON.stringify(job.outputJson ?? job.errorJson ?? {}, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
