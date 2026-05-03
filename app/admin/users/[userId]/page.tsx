import Link from "next/link";
import { notFound } from "next/navigation";

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
import { OperatorActionsPanel } from "@/app/admin/users/[userId]/_components/operator-actions-panel";
import { getAdminAiContentData } from "@/lib/services/admin-ai-content";
import { getAdminUserDetailData } from "@/lib/services/admin-data";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdminPageAccess();

  const { userId } = await params;
  const data = await getAdminUserDetailData(userId);

  if (!data) {
    notFound();
  }

  const { user, counts, transformJobs, deploymentJobs, auditEvents } = data;
  const aiContent = await getAdminAiContentData({ userId, page: 1, pageSize: 10 });

  return (
    <AdminShell
      title={user.profile?.displayName ?? user.email}
      subtitle="User profile, memberships, extension connection activity, created content, jobs, and audit events."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-sm font-medium text-stone-700 hover:text-stone-950" href="/admin">
          Back to overview
        </Link>
        <a
          className="rounded-md border border-stone-300 bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          href={`/api/v1/admin/skills/export?userId=${encodeURIComponent(user.id)}`}
        >
          Export This User&apos;s AI Data CSV
        </a>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard detail="Projects created by this user" label="Projects" value={String(counts.projectCount)} />
        <MetricCard detail="Packages created by this user" label="Packages" value={String(counts.packageCount)} />
        <MetricCard detail="Versions created by this user" label="Versions" value={String(counts.versionCount)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel eyebrow="Identity" title="Account">
          <dl className="grid gap-3 text-sm text-stone-700">
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Email</dt>
              <dd className="mt-1 text-stone-950">{user.email}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Auth</dt>
              <dd className="mt-1">
                {user.authProvider}
                {user.authSubject ? <span className="text-stone-500"> · {user.authSubject}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge value={user.status} />
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Created</dt>
              <dd className="mt-1">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel eyebrow="Organizations" title="Memberships">
          {user.memberships.length === 0 ? (
            <EmptyState>This user does not belong to any organizations.</EmptyState>
          ) : (
            <div className="space-y-3">
              {user.memberships.map((membership) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={membership.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{membership.organization.name}</div>
                    <StatusBadge value={membership.organization.status} />
                  </div>
                  <p className="text-stone-600">
                    Role: {membership.role} · Tier: {membership.organization.tier}
                  </p>
                  <p className="text-stone-600">
                    Projects: {membership.organization.projects.length} · Subscriptions:{" "}
                    {membership.organization.subscriptions.length}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel eyebrow="Extension" title="Recent Connection Requests">
        {user.extensionAuthRequests.length === 0 ? (
          <EmptyState>No extension browser connection requests for this user.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Editor</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Expires</th>
                  <th className="px-3 py-3">Exchanged</th>
                </tr>
              </thead>
              <tbody>
                {user.extensionAuthRequests.map((request) => (
                  <tr className="border-b border-stone-100" key={request.id}>
                    <td className="px-3 py-4">{request.organization.name}</td>
                    <td className="px-3 py-4">{request.editor}</td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDate(request.createdAt)}</td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDate(request.expiresAt)}</td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDate(request.exchangedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Full Text" title="AI Content Records">
        {aiContent.rows.length === 0 ? (
          <EmptyState>No skill, agent, rule, upload, transform, or export records for this user.</EmptyState>
        ) : (
          <div className="space-y-4">
            {aiContent.rows.map((row) => (
              <article className="rounded-lg border border-stone-200 bg-stone-50 p-4" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-stone-950">{row.itemName}</div>
                    <div className="mt-1 text-xs leading-5 text-stone-600">
                      {row.organizationName} · {row.packageName || "No package"}
                    </div>
                    <div className="mt-1 font-mono text-xs text-stone-500">
                      {row.logicalPath || row.dbId}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={row.recordStage} />
                    <span className="inline-flex rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-stone-600">
                      {row.recordType}
                    </span>
                  </div>
                </div>
                <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-stone-950 p-4 text-xs leading-5 text-stone-100">
                  {row.content || "n/a"}
                </pre>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Jobs" title="Transforms">
          {transformJobs.length === 0 ? (
            <EmptyState>No transform jobs created by this user.</EmptyState>
          ) : (
            <div className="space-y-3">
              {transformJobs.map((job) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{job.jobType}</div>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="text-stone-600">Org: {job.organization.name}</p>
                  <p className="text-stone-600">Project: {job.project?.name ?? "n/a"}</p>
                  <p className="text-xs text-stone-500">{formatDate(job.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Jobs" title="Deployments">
          {deploymentJobs.length === 0 ? (
            <EmptyState>No deployment jobs created by this user.</EmptyState>
          ) : (
            <div className="space-y-3">
              {deploymentJobs.map((job) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{job.deploymentTarget.name}</div>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="text-stone-600">Org: {job.organization.name}</p>
                  <p className="text-stone-600">Project: {job.project.name}</p>
                  <p className="text-xs text-stone-500">{formatDate(job.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel eyebrow="Audit" title="Actor Events">
        {auditEvents.length === 0 ? (
          <EmptyState>No audit events recorded for this user.</EmptyState>
        ) : (
          <div className="space-y-3">
            {auditEvents.map((event) => (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={event.id}>
                <div className="font-medium text-stone-950">{event.action}</div>
                <p className="text-stone-600">
                  {event.entityType} · {event.organization.name} · {formatDate(event.createdAt)}
                </p>
                <JsonBlock value={event.metadataJson} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <OperatorActionsPanel
        orgId={user.memberships[0]?.organizationId}
        orgTier={user.memberships[0]?.organization.tier}
        stripeSubscriptionId={user.memberships[0]?.organization.subscriptions[0]?.stripeSubscriptionId}
        userEmail={user.email}
        userId={user.id}
        userStatus={user.status}
      />
    </AdminShell>
  );
}
