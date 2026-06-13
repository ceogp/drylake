import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function SecurityReportsPage() {
  const context = await requireCurrentAppContextForPage();
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);
  const sharedTeamReports = resolved.canUseTeamBaseline || resolved.canUseContinuousWatch;
  const reports = await prisma.guardScan.findMany({
    where: {
      organizationId: context.organization.id,
      ...(sharedTeamReports ? {} : { actorUserId: context.user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      score: true,
      rank: true,
      consentMode: true,
      uploadedArtifactCount: true,
      scannedAt: true,
      createdAt: true,
      actorUser: {
        select: {
          email: true,
        },
      },
    },
  });

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tape-eyebrow">DryLake Guard</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-zinc-50">
              {sharedTeamReports ? "Team security reports." : "Personal security reports."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-zinc-400">
              {sharedTeamReports
                ? "Team Security shows shared saved reports, baseline drift, policy history, and cloud analysis jobs for this organization."
                : "Individual users see their own saved Guard reports. Team-wide baseline and shared history require Team Security."}
            </p>
          </div>
          <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
            Billing
          </Link>
        </div>

        <section className="tape-panel p-6">
          <div className="grid gap-3">
            {reports.length ? reports.map((report) => (
              <Link
                key={report.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-zinc-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
                href={`/security/reports/${report.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">{report.rank} - {report.score}/100</span>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {report.consentMode} / {report.uploadedArtifactCount} artifacts
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Scanned {formatDate(report.scannedAt)}. Saved {formatDate(report.createdAt)}.
                  {sharedTeamReports ? ` Owner: ${report.actorUser.email}.` : ""}
                </p>
              </Link>
            )) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-400">
                {sharedTeamReports
                  ? "No shared Guard reports have been saved for this team yet."
                  : "No personal Guard reports have been saved for this account yet."}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
