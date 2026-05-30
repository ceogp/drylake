import Link from "next/link";

import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { prisma } from "@/lib/prisma";
import { getSetupStatus } from "@/lib/services/setup";

export default async function IntegrationsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;
  const { entitlements, subscription } = await getEntitlementsForOrganization(organizationId);

  const [integrations] = organizationId
    ? await Promise.all([
        prisma.integration.findMany({
          where: { organizationId },
          include: {
            credential: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[]];
  const setup = await getSetupStatus();

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="tape-eyebrow">Integrations</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold text-stone-950">
            Integrations stay behind the import workflow.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            This is not part of onboarding. Users should connect, import, and verify their files
            first. Provider wiring only matters later when there is a real notification or deploy
            workflow to support.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="tape-panel p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Slack readiness</p>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  {setup.channels.slack.credentials} Slack credential{setup.channels.slack.credentials === 1 ? "" : "s"} available
                </p>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {setup.channels.slack.integrations} integration record{setup.channels.slack.integrations === 1 ? "" : "s"} stored
                </p>
              </article>
              <article className="tape-panel p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">WhatsApp readiness</p>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  {setup.channels.whatsapp.credentials} Twilio credential{setup.channels.whatsapp.credentials === 1 ? "" : "s"} available
                </p>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {setup.channels.whatsapp.integrations} integration record{setup.channels.whatsapp.integrations === 1 ? "" : "s"} stored
                </p>
              </article>
            </div>

            {integrations.length > 0 ? (
              integrations.map((integration) => (
                <article key={integration.id} className="tape-panel p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        {integration.provider}
                      </p>
                      <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                        {integration.status}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-stone-700">
                        Credential: {integration.credential?.name ?? "none"}
                      </p>
                      <p className="text-sm leading-7 text-stone-700">
                        Last verified: {integration.lastVerifiedAt ? integration.lastVerifiedAt.toLocaleString() : "not yet"}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="tape-panel p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Hidden during onboarding</p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  No integrations are configured.
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  That is expected. Slack and WhatsApp are advanced control-plane features and should
                  not interrupt the import-first product path.
                </p>
              </article>
            )}
          </div>

          <section className="tape-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Availability</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Advanced-only surface
            </h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-stone-700">
              <p>Current tier: {subscription?.tier ?? "free"}</p>
              <p>Hosted Xupra AI included: {entitlements.xupra_pro_ai ? "yes" : "no"}</p>
              <p>
                Manual integration setup has been removed from the main UI. The first-run product
                path should end with visible imported files, not webhook configuration.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="tape-button px-5 py-3 text-sm" href="/app">
                Back To Workspace
              </Link>
              <Link className="tape-button bg-white px-5 py-3 text-sm text-black" href="/billing">
                View Plans
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
