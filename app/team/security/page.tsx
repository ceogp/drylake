import Link from "next/link";

import { runContinuousWatchAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { TeamEntitlementGrid, TeamPageShell } from "@/app/team/_components/team-page";

export default async function TeamSecurityPage() {
  const context = await requireCurrentAppContextForPage();
  const [{ resolved }, reports, watchEvents] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.guardScan.findMany({
      where: { organizationId: context.organization.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, rank: true, score: true, consentMode: true, createdAt: true },
    }),
    prisma.guardWatchEvent.findMany({
      where: { organizationId: context.organization.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, eventType: true, severity: true, logicalPath: true, createdAt: true },
    }),
  ]);

  return (
    <TeamPageShell title="Team security" subtitle="Shared security state is available when the organization has Team Security.">
      <section className="tape-panel p-6">
        <TeamEntitlementGrid entitlements={resolved} />
      </section>
      <section className="tape-panel p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Recent reports</p>
        <div className="mt-5 grid gap-3">
          {reports.length ? reports.map((report) => (
            <Link key={report.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300 transition hover:border-emerald-400/50" href={`/security/reports/${report.id}`}>
              {report.rank} - {report.score}/100 / {report.consentMode}
            </Link>
          )) : <p className="text-sm text-zinc-400">No team reports saved yet.</p>}
        </div>
      </section>
      <section className="tape-panel p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Continuous Watch history</p>
        {resolved.canUseContinuousWatch ? (
          <form action={runContinuousWatchAction} className="mt-5">
            <input name="organizationId" type="hidden" value={context.organization.id} />
            <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
              Run Continuous Watch evaluation
            </button>
          </form>
        ) : null}
        <div className="mt-5 grid gap-3">
          {resolved.canUseContinuousWatch ? (
            watchEvents.length ? watchEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{event.eventType} / {event.severity}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{event.createdAt.toISOString()}</span>
                </div>
                <p className="mt-2 text-zinc-500">{event.logicalPath}</p>
              </div>
            )) : <p className="text-sm text-zinc-400">No Continuous Watch events recorded yet.</p>
          ) : (
            <p className="text-sm text-zinc-400">Continuous Watch requires Team Security.</p>
          )}
        </div>
      </section>
    </TeamPageShell>
  );
}
