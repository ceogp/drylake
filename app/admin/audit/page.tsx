import {
  AdminShell,
  EmptyState,
  JsonBlock,
  MetricCard,
  Panel,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getAdminAuditData } from "@/lib/services/admin-data";

export default async function AdminAuditPage() {
  await requireAdminPageAccess();

  const { auditEvents, metrics } = await getAdminAuditData();

  return (
    <AdminShell
      title="Audit trail"
      subtitle="Recorded platform events across billing and operator-relevant actions."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard detail="All recorded audit events" label="Total Events" value={String(metrics.totalAuditEvents)} />
        <MetricCard detail="Events recorded in the last 24 hours" label="Last 24 Hours" value={String(metrics.recentAuditEvents)} />
      </section>

      <Panel eyebrow="Events" title="Latest Audit Events">
        {auditEvents.length === 0 ? (
          <EmptyState>No audit events recorded yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {auditEvents.map((event) => (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-7" key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-stone-950">{event.action}</div>
                    <p className="text-stone-600">
                      {event.entityType} · {event.entityId}
                    </p>
                  </div>
                  <div className="text-right text-xs text-stone-500">{formatDate(event.createdAt)}</div>
                </div>
                <p className="mt-2 text-stone-600">
                  Org: {event.organization.name} · Actor: {event.actorUser?.email ?? "system"}
                </p>
                <div className="mt-3">
                  <JsonBlock value={event.metadataJson} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AdminShell>
  );
}
