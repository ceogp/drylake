import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getAuditEvents, getDeploymentSummary, getUsageSummary } from "@/lib/services/reports";

export default async function ReportsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  if (!organizationId) {
    return null;
  }

  const [usage, deployments, auditEvents] = await Promise.all([
    getUsageSummary(organizationId),
    getDeploymentSummary(organizationId),
    getAuditEvents(organizationId),
  ]);

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="tape-eyebrow">Reports</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-stone-950">
            Usage, deployment health, and audit history.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            The extension is where the user does the work. Reports exist here so operators and admins can measure what happened after the flow starts getting real usage.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Projects", String(usage.projects)],
            ["Packages", String(usage.packages)],
            ["Deployments", String(usage.deploymentJobs)],
            ["Credentials", String(usage.credentials)],
            ["Integrations", String(usage.integrations)],
            ["Success Rate", `${Math.round(deployments.successRate * 100)}%`],
          ].map(([label, value]) => (
            <article key={label} className="tape-panel p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="tape-panel p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Recent deployments
            </h2>
            <div className="mt-5 grid gap-3">
              {deployments.jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{job.packageVersion.agentPackage.name}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="tape-panel p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Audit trail
            </h2>
            <div className="mt-5 grid gap-3">
              {auditEvents.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{event.action}</span>
                    <span className="font-mono text-xs text-stone-500">{event.createdAt.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
