import Link from "next/link";

import {
  AdminShell,
  EmptyState,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getConfiguredAppOrigin } from "@/lib/site-hosts";
import { getAdminOverviewData } from "@/lib/services/admin-data";

export default async function AdminPage() {
  await requireAdminPageAccess();

  const appOrigin = getConfiguredAppOrigin();
  const {
    metrics,
    recentUsers,
    recentOrganizations,
    recentTransformJobs,
    recentDeploymentJobs,
    recentAuditEvents,
    recentAuthEvents,
    setup,
  } = await getAdminOverviewData();

  return (
    <AdminShell
      title="Internal control surface"
      subtitle="Read-only platform visibility for users, organizations, jobs, billing state, and runtime readiness."
    >
      <div className="flex flex-wrap gap-3">
        <a
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href={`${appOrigin}/app`}
        >
          Customer App
        </a>
        <a
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href={`${appOrigin}/settings`}
        >
          User Settings
        </a>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${metrics.activeUserCount} active accounts`}
          label="Users"
          value={String(metrics.userCount)}
        />
        <MetricCard
          detail={`${metrics.activeAppSessionCount} active browser sessions`}
          label="Auth Sessions"
          value={String(metrics.appSessionCount)}
        />
        <MetricCard
          detail={`${metrics.subscriptionCount} subscriptions tracked`}
          label="Organizations"
          value={String(metrics.organizationCount)}
        />
        <MetricCard
          detail={`${metrics.versionCount} versions stored`}
          label="Projects / Packages"
          value={`${metrics.projectCount} / ${metrics.packageCount}`}
        />
        <MetricCard
          detail={`${metrics.runningTransformCount + metrics.runningDeploymentCount} running, ${metrics.failedTransformCount + metrics.failedDeploymentCount} failed`}
          label="Jobs"
          value={`${metrics.queuedTransformCount + metrics.queuedDeploymentCount} queued`}
        />
        <MetricCard
          detail={`${metrics.failedAuthEventCount} failed auth events recorded`}
          label="Auth Events"
          value={String(metrics.authEventCount)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel eyebrow="Users" title="Recent Accounts">
          {recentUsers.length === 0 ? (
            <EmptyState>No users have been created yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-stone-700">
                <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                  <tr>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Auth</th>
                    <th className="px-3 py-3">Memberships</th>
                    <th className="px-3 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr className="border-b border-stone-100 align-top" key={user.id}>
                      <td className="px-3 py-4">
                        <Link className="font-medium text-stone-950 hover:underline" href={`/admin/users/${user.id}`}>
                          {user.profile?.displayName ?? user.email}
                        </Link>
                        <div className="text-xs text-stone-500">{user.email}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div>{user.authProvider}</div>
                        <StatusBadge value={user.status} />
                      </td>
                      <td className="px-3 py-4">
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-stone-500">No orgs</span>
                        ) : (
                          user.memberships.map((membership) => (
                            <div className="text-xs leading-6" key={membership.id}>
                              {membership.organization.name} · {membership.role}
                            </div>
                          ))
                        )}
                      </td>
                      <td className="px-3 py-4 text-xs text-stone-500">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel eyebrow="Runtime" title="Readiness">
          <div className="grid gap-3 text-sm leading-7 text-stone-700">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Authentication</p>
              <p className="mt-2">Mode: {setup.auth.mode}</p>
              <p>Provider: {setup.auth.provider}</p>
              <p>Configured: {setup.auth.configured ? "yes" : "no"}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Storage / AI</p>
              <p className="mt-2">Artifact driver: {setup.storage.driver}</p>
              <p>OpenAI model: {setup.openai.model}</p>
              <p>OpenAI ready: {setup.openai.configured ? "yes" : "no"}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Commercial</p>
              <p className="mt-2">Stripe configured: {setup.billing.configured ? "yes" : "no"}</p>
              <p>Credentials stored: {metrics.credentialCount}</p>
              <p>Extension path: {setup.extension.packagePath}</p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel eyebrow="Auth" title="Recent Signups And Logins">
          {recentAuthEvents.length === 0 ? (
            <EmptyState>No auth events recorded yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {recentAuthEvents.map((event) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={event.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-stone-950">{event.eventName}</div>
                      <p className="text-stone-600">
                        {event.email ?? event.actorUser?.email ?? "unknown user"}
                      </p>
                    </div>
                    <StatusBadge value={event.success ? "success" : "failed"} />
                  </div>
                  <p className="text-stone-600">
                    {event.authProvider ?? "unknown"} - {event.organization?.name ?? "no org"}
                  </p>
                  {event.failureReason ? (
                    <p className="text-red-700">{event.failureReason}</p>
                  ) : null}
                  <p className="text-xs text-stone-500">{formatDate(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Organizations" title="Latest Orgs">
          <div className="space-y-3">
            {recentOrganizations.map((organization) => (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={organization.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-stone-950">{organization.name}</div>
                  <StatusBadge value={organization.status} />
                </div>
                <p className="text-stone-600">Tier: {organization.tier}</p>
                <p className="text-stone-600">
                  Members: {organization.memberships.length} · Projects: {organization.projects.length}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Jobs" title="Recent Activity">
          <div className="space-y-3">
            {[...recentTransformJobs, ...recentDeploymentJobs]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 10)
              .map((job) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">
                      {"jobType" in job ? `Transform · ${job.jobType}` : `Deploy · ${job.deploymentTarget.name}`}
                    </div>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="text-stone-600">Org: {job.organization.name}</p>
                  <p className="text-stone-600">User: {job.createdByUser.email}</p>
                </div>
              ))}
          </div>
        </Panel>

        <Panel eyebrow="Audit" title="Recent Events">
          {recentAuditEvents.length === 0 ? (
            <EmptyState>No audit events recorded yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {recentAuditEvents.map((event) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={event.id}>
                  <div className="font-medium text-stone-950">{event.action}</div>
                  <p className="text-stone-600">
                    {event.entityType} · {event.organization.name}
                  </p>
                  <p className="text-xs text-stone-500">{formatDate(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}
