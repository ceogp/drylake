import {
  AdminShell,
  EmptyState,
  JsonBlock,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getAdminJobsData } from "@/lib/services/admin-data";

export default async function AdminJobsPage() {
  await requireAdminPageAccess();

  const { transformJobs, deploymentJobs, metrics } = await getAdminJobsData();

  return (
    <AdminShell
      title="Jobs"
      subtitle="Operational view of transform and deployment job state, including surfaced error payloads."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${metrics.runningTransformCount} running transforms`}
          label="Queued Transforms"
          value={String(metrics.queuedTransformCount)}
        />
        <MetricCard detail="Failed transform jobs" label="Transform Failures" value={String(metrics.failedTransformCount)} />
        <MetricCard
          detail={`${metrics.runningDeploymentCount} running deployments`}
          label="Queued Deployments"
          value={String(metrics.queuedDeploymentCount)}
        />
        <MetricCard
          detail="Failed deployment jobs"
          label="Deployment Failures"
          value={String(metrics.failedDeploymentCount)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Transforms" title="Latest Transform Jobs">
          {transformJobs.length === 0 ? (
            <EmptyState>No transform jobs recorded yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {transformJobs.map((job) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{job.jobType}</div>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="text-stone-600">
                    {job.organization.name} · {job.project?.name ?? "No project"}
                  </p>
                  <p className="text-stone-600">
                    User: {job.createdByUser.email} · Target: {job.targetPlatform ?? "n/a"}
                  </p>
                  <p className="text-xs text-stone-500">{formatDate(job.createdAt)}</p>
                  {job.errorJson ? (
                    <div className="mt-3">
                      <JsonBlock value={job.errorJson} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Deployments" title="Latest Deployment Jobs">
          {deploymentJobs.length === 0 ? (
            <EmptyState>No deployment jobs recorded yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {deploymentJobs.map((job) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{job.deploymentTarget.name}</div>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="text-stone-600">
                    {job.organization.name} · {job.project.name}
                  </p>
                  <p className="text-stone-600">
                    User: {job.createdByUser.email} · Platform: {job.deploymentTarget.platform}
                  </p>
                  <p className="text-xs text-stone-500">{formatDate(job.createdAt)}</p>
                  {job.errorJson ? (
                    <div className="mt-3">
                      <JsonBlock value={job.errorJson} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}
