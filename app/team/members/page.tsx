import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { TeamPageShell } from "@/app/team/_components/team-page";

export default async function TeamMembersPage() {
  const context = await requireCurrentAppContextForPage();
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  return (
    <TeamPageShell title="Team members" subtitle="Roles determine who can manage billing, policy, and baseline state.">
      <section className="tape-panel p-6">
        <div className="grid gap-3">
          {members.map((member) => (
            <div key={member.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{member.user.profile?.displayName ?? member.user.email}</span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{member.role}</span>
              </div>
              <p className="mt-2 text-zinc-500">{member.user.email}</p>
            </div>
          ))}
        </div>
      </section>
    </TeamPageShell>
  );
}
