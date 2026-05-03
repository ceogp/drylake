import {
  AdminShell,
  EmptyState,
  MetricCard,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getAdminSkillsData } from "@/lib/services/admin-data";

export default async function AdminSkillsPage() {
  await requireAdminPageAccess();

  const { latestVersions, latestSkillRules, latestSubagents, metrics } = await getAdminSkillsData();

  return (
    <AdminShell
      title="Skills and agent content"
      subtitle="Read-only analytics for imported package versions, skill rules, subagents, and raw files."
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

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Skill Rules" title="Latest Rules">
          {latestSkillRules.length === 0 ? (
            <EmptyState>No skill rules have been imported yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {latestSkillRules.slice(0, 20).map((rule) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={rule.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-950">{rule.name}</div>
                    <span className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">{rule.kind}</span>
                  </div>
                  <p className="text-stone-600">
                    {rule.packageVersion.agentPackage.name} · {rule.packageVersion.agentPackage.project.organization.name}
                  </p>
                  <p className="text-xs text-stone-500">{formatDate(rule.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Subagents" title="Latest Agents">
          {latestSubagents.length === 0 ? (
            <EmptyState>No subagents have been imported yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {latestSubagents.slice(0, 20).map((subagent) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={subagent.id}>
                  <div className="font-medium text-stone-950">{subagent.name}</div>
                  <p className="text-stone-600">
                    {subagent.packageVersion.agentPackage.name} ·{" "}
                    {subagent.packageVersion.agentPackage.project.organization.name}
                  </p>
                  <p className="line-clamp-2 text-stone-600">{subagent.description}</p>
                  <p className="text-xs text-stone-500">{formatDate(subagent.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </AdminShell>
  );
}
