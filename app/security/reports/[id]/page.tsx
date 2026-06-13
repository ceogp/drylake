import Link from "next/link";
import { notFound } from "next/navigation";

import { startCloudAnalysisForReportAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { compareScanToBaseline, compareScanToPreviousPersonalScan } from "@/lib/services/team-security";

function asCount(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "0";
  }

  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" ? String(raw) : "0";
}

export default async function SecurityReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, context] = await Promise.all([params, requireCurrentAppContextForPage()]);
  const { resolved } = await getEntitlementsForOrganization(context.organization.id);
  const sharedTeamReports = resolved.canUseTeamBaseline || resolved.canUseContinuousWatch;
  const report = await prisma.guardScan.findFirst({
    where: {
      id,
      organizationId: context.organization.id,
      ...(sharedTeamReports ? {} : { actorUserId: context.user.id }),
    },
    include: {
      artifacts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          logicalPath: true,
          sizeBytes: true,
          redacted: true,
        },
      },
      cloudAnalysisJobs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          resultJson: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!report) {
    notFound();
  }

  const baselineComparison = resolved.canUseTeamBaseline
    ? await compareScanToBaseline({ organizationId: context.organization.id, guardScanId: report.id })
    : null;
  const personalComparison = resolved.canUseFixWithAI
    ? await compareScanToPreviousPersonalScan({
        organizationId: context.organization.id,
        actorUserId: context.user.id,
        guardScanId: report.id,
      })
    : null;

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tape-eyebrow">DryLake Guard</p>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-zinc-50">
              {report.rank} - {report.score}/100.
            </h1>
            <p className="mt-4 text-sm text-zinc-400">
              Consent mode: {report.consentMode}. Uploaded artifacts: {report.uploadedArtifactCount}.
            </p>
          </div>
          <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/security/reports">
            Reports
          </Link>
        </div>

        <section className="grid gap-6 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Findings</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{asCount(report.summaryJson, "findings")}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Critical</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{asCount(report.summaryJson, "critical")}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">MCP servers</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{asCount(report.summaryJson, "mcpServers")}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">High impact paths</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{asCount(report.summaryJson, "highImpactConnections")}</p>
          </div>
        </section>

        <section className="tape-panel p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Approved artifacts</p>
          <div className="mt-5 grid gap-3">
            {report.artifacts.length ? report.artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{artifact.logicalPath}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {artifact.kind} / {artifact.redacted ? "redacted" : "redaction not needed"} / {artifact.sizeBytes} bytes
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-zinc-400">This report did not upload approved artifacts.</p>
            )}
          </div>
        </section>

        {baselineComparison?.diff ? (
          <section className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Baseline drift</p>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New risks</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.resolvedRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Worsened</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.worsenedRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Score delta</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.scoreDelta}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New MCP tools</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newMcpTools.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New extensions</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newExtensions.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New secrets</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newSecrets.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New deploy surface</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newDeploymentSurfaces.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New suspicious artifacts</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{baselineComparison.diff.newSuspiciousArtifacts.length}</p>
              </div>
            </div>
          </section>
        ) : null}

        {personalComparison?.diff ? (
          <section className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Previous personal scan comparison</p>
            <p className="mt-2 text-sm text-zinc-400">
              Compared against {personalComparison.previousScan?.rank} - {personalComparison.previousScan?.score}/100 from {personalComparison.previousScan?.createdAt.toISOString()}.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">New risks</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{personalComparison.diff.newRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{personalComparison.diff.resolvedRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Worsened</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{personalComparison.diff.worsenedRisks.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Score delta</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{personalComparison.diff.scoreDelta}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="tape-panel p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Deep Cloud Analysis</p>
          {resolved.canUseApprovedUpload && resolved.canUseDeepCloudAnalysis ? (
            <form action={startCloudAnalysisForReportAction} className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-4">
              <input name="organizationId" type="hidden" value={context.organization.id} />
              <input name="guardScanId" type="hidden" value={report.id} />
              <p className="text-sm text-zinc-300">
                Approve Deep Cloud Analysis from this saved report. DryLake will use redacted findings, MCP metadata, extension metadata, package metadata, and file path inventory. Raw secrets and source files are not uploaded.
              </p>
              <button className="tape-button mt-4 bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                Approve and run Deep Cloud Analysis
              </button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-zinc-400">Deep Cloud Analysis requires Security Pro.</p>
          )}
          <div className="mt-5 grid gap-3">
            {report.cloudAnalysisJobs.length ? report.cloudAnalysisJobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{job.status}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{job.createdAt.toISOString()}</span>
                </div>
                {job.errorMessage ? <p className="mt-3 text-red-300">{job.errorMessage}</p> : null}
                {job.resultJson ? <pre className="mt-3 max-h-72 overflow-auto rounded border border-zinc-800 bg-black p-3 text-xs text-zinc-300">{JSON.stringify(job.resultJson, null, 2)}</pre> : null}
              </div>
            )) : (
              <p className="text-sm text-zinc-400">No Deep Cloud Analysis job has been created for this report.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
