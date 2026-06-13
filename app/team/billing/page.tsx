import Link from "next/link";

import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { canManageTeam, TeamPageShell } from "@/app/team/_components/team-page";

export default async function TeamBillingPage() {
  const context = await requireCurrentAppContextForPage();
  const [{ resolved }, subscription] = await Promise.all([
    getEntitlementsForOrganization(context.organization.id),
    prisma.subscription.findUnique({ where: { organizationId: context.organization.id } }),
  ]);
  const canManage = canManageTeam(context.activeMembership.role);

  return (
    <TeamPageShell title="Team billing" subtitle="Team Security billing controls are available to organization owners and admins.">
      <section className="tape-panel p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Plan</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{resolved.plan}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Status</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{subscription?.status ?? "none"}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Billing owner</p>
            <p className="mt-2 text-sm font-semibold text-zinc-100">{context.activeMembership.role}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {canManage ? (
            <>
              <form action={createCheckoutAction}>
                <input name="organizationId" type="hidden" value={context.organization.id} />
                <input name="plan" type="hidden" value="team_security" />
                <input name="returnPath" type="hidden" value="/team/billing" />
                <button className="tape-button bg-emerald-400 px-5 py-3 text-sm text-zinc-950 hover:bg-emerald-300" type="submit">
                  Upgrade Team Security
                </button>
              </form>
              {subscription?.stripeCustomerId ? (
                <form action={openBillingPortalAction}>
                  <input name="organizationId" type="hidden" value={context.organization.id} />
                  <input name="returnPath" type="hidden" value="/team/billing" />
                  <button className="tape-button bg-white px-5 py-3 text-sm text-black" type="submit">
                    Manage team billing
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              Ask an owner or admin to manage team billing.
            </p>
          )}
          <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
            Personal billing
          </Link>
        </div>
      </section>
    </TeamPageShell>
  );
}
