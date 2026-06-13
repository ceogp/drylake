import Link from "next/link";

import { markTeamBaselineAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { TeamPageShell } from "@/app/team/_components/team-page";

export default async function TeamBaselinePage() {
  const context = await requireCurrentAppContextForPage();
  const [{ resolved }, baseline, reports] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.guardBaseline.findFirst({
      where: { organizationId: context.organization.id },
      orderBy: { createdAt: "desc" },
      include: {
        guardScan: {
          select: { id: true, rank: true, score: true, createdAt: true },
        },
      },
    }),
    prisma.guardScan.findMany({
      where: { organizationId: context.organization.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, rank: true, score: true, consentMode: true, createdAt: true },
    }),
  ]);

  return (
    <TeamPageShell title="Team Baseline" subtitle="A baseline is created from an approved team scan. Future scans compare against it for drift.">
      <section className="tape-panel p-6">
        {resolved.canUseTeamBaseline ? (
          baseline ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-zinc-300">
              <p className="font-semibold">Current baseline: {baseline.guardScan.rank} - {baseline.guardScan.score}/100</p>
              <Link className="mt-4 inline-block text-sm text-emerald-300" href={`/security/reports/${baseline.guardScan.id}`}>
                Open report
              </Link>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No approved baseline upload has been saved yet.</p>
          )
        ) : (
          <p className="text-sm text-zinc-400">Team Baseline requires Team Security.</p>
        )}
      </section>
      {resolved.canUseTeamBaseline ? (
        <section className="tape-panel p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Set baseline from a saved report</p>
          <div className="mt-5 grid gap-3">
            {reports.length ? reports.map((report) => (
              <form key={report.id} action={markTeamBaselineAction} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300">
                <input name="organizationId" type="hidden" value={context.organization.id} />
                <input name="guardScanId" type="hidden" value={report.id} />
                <span>{report.rank} - {report.score}/100 / {report.consentMode}</span>
                <button className="tape-button bg-emerald-400 px-4 py-2 text-xs text-zinc-950 hover:bg-emerald-300" type="submit">
                  Mark baseline
                </button>
              </form>
            )) : <p className="text-sm text-zinc-400">No Guard reports are available yet.</p>}
          </div>
        </section>
      ) : null}
    </TeamPageShell>
  );
}
