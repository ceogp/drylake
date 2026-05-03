import Link from "next/link";

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
import { getAdminAiContentData } from "@/lib/services/admin-ai-content";
import { getAdminSkillsData } from "@/lib/services/admin-data";

function getContentPageHref(page: number) {
  return `/admin/skills?page=${page}`;
}

export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPageAccess();

  const { page: rawPage } = await searchParams;
  const parsedPage = Math.max(1, parseInt(rawPage ?? "1", 10));
  const page = Number.isNaN(parsedPage) ? 1 : parsedPage;
  const { latestVersions, metrics } = await getAdminSkillsData();
  const aiContent = await getAdminAiContentData({ page, pageSize: 25 });

  return (
    <AdminShell
      title="Skills and agent content"
      subtitle="Full stored user AI data across uploaded files, normalized rules, subagents, transform jobs, and generated exports."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard detail="Stored source and generated files" label="Package Files" value={String(metrics.packageFileCount)} />
        <MetricCard detail="Normalized skill/rule records" label="Skill Rules" value={String(metrics.skillRuleCount)} />
        <MetricCard detail="Normalized agent records" label="Subagents" value={String(metrics.subagentCount)} />
      </section>

      <Panel eyebrow="Package Versions" title="Latest Imports">
        {latestVersions.length === 0 ? (
          <EmptyState>No package versions have been created yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-3 py-3">Package</th>
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Content</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {latestVersions.map((version) => (
                  <tr className="border-b border-stone-100 align-top" key={version.id}>
                    <td className="px-3 py-4">
                      <div className="font-medium text-stone-950">
                        {version.agentPackage.name} · v{version.versionNumber}
                      </div>
                      <div className="text-xs text-stone-500">{version.agentPackage.project.name}</div>
                    </td>
                    <td className="px-3 py-4">{version.agentPackage.project.organization.name}</td>
                    <td className="px-3 py-4">
                      <StatusBadge value={version.status} />
                    </td>
                    <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                      <div>Files: {version._count.files}</div>
                      <div>Agents: {version._count.subagents}</div>
                      <div>Rules: {version._count.skillRules}</div>
                    </td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDate(version.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Full Text" title="User AI Data">
        <div className="mb-5 flex flex-wrap gap-3">
          <Link
            className="rounded-md border border-stone-300 bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
            href="/api/v1/admin/skills/export"
          >
            Export All AI Content CSV
          </Link>
          <Link
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
            href="/api/v1/admin/users/export"
          >
            Export Users CSV
          </Link>
        </div>

        {aiContent.rows.length === 0 ? (
          <EmptyState>No user AI content has been stored yet.</EmptyState>
        ) : (
          <div className="space-y-4">
            {aiContent.rows.map((row) => (
              <article className="rounded-lg border border-stone-200 bg-stone-50 p-4" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-stone-950">{row.itemName}</div>
                    <div className="mt-1 text-xs leading-5 text-stone-600">
                      {row.userEmail} · {row.organizationName} · {row.packageName || "No package"}
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
                    {row.targetPlatform ? <StatusBadge value={row.targetPlatform} /> : null}
                  </div>
                </div>
                <div className="mt-3 text-xs text-stone-500">{formatDate(row.createdAt)}</div>
                <pre className="mt-4 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-stone-950 p-4 text-xs leading-5 text-stone-100">
                  {row.content || "n/a"}
                </pre>
                <details className="mt-3 text-sm text-stone-700">
                  <summary className="cursor-pointer font-medium text-stone-800">Metadata</summary>
                  <div className="mt-3">
                    <JsonBlock value={row.metadata} />
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          {aiContent.hasPrevPage ? (
            <Link
              className="rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              href={getContentPageHref(aiContent.page - 1)}
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 bg-stone-50 px-4 py-2 font-medium text-stone-400">
              Previous
            </span>
          )}
          <div className="text-stone-600">
            Page {aiContent.page} · {aiContent.totalCount} content records
          </div>
          {aiContent.hasNextPage ? (
            <Link
              className="rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
              href={getContentPageHref(aiContent.page + 1)}
            >
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 bg-stone-50 px-4 py-2 font-medium text-stone-400">
              Next
            </span>
          )}
        </div>
      </Panel>
    </AdminShell>
  );
}
