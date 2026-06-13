import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { TeamEntitlementGrid, TeamPageShell } from "@/app/team/_components/team-page";

export default async function TeamPage() {
  const context = await requireCurrentAppContextForPage();
  const [{ resolved }, memberCount, reportCount] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.organizationMembership.count({ where: { organizationId: context.organization.id } }),
    prisma.guardScan.count({ where: { organizationId: context.organization.id } }),
  ]);

  return (
    <TeamPageShell title={context.organization.name} subtitle="Team Security separates individual protection from shared team baselines, policy, and drift history.">
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Plan</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{resolved.plan}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Members</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{memberCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Reports</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{reportCount}</p>
        </div>
      </section>
      <section className="tape-panel p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Team capabilities</p>
        <div className="mt-5">
          <TeamEntitlementGrid entitlements={resolved} />
        </div>
      </section>
    </TeamPageShell>
  );
}
