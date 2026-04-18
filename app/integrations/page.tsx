import { createIntegrationAction, sendTestIntegrationAction, verifyIntegrationAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { prisma } from "@/lib/prisma";
import { getSetupStatus } from "@/lib/services/setup";

export default async function IntegrationsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  const [integrations, credentials] = organizationId
    ? await Promise.all([
        prisma.integration.findMany({
          where: { organizationId },
          include: {
            credential: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.credential.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];
  const setup = await getSetupStatus();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Integrations</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Connect Slack and WhatsApp control surfaces.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            These integrations receive deployment and transfer notifications now. They are also the control points for status, export, and deployment actions.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Slack command path</p>
                <p className="mt-3 break-all text-sm leading-7 text-stone-700">{setup.channels.slack.webhookPath}</p>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {setup.channels.slack.credentials} Slack credential{setup.channels.slack.credentials === 1 ? "" : "s"} available
                </p>
              </article>
              <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">WhatsApp webhook path</p>
                <p className="mt-3 break-all text-sm leading-7 text-stone-700">{setup.channels.whatsapp.webhookPath}</p>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {setup.channels.whatsapp.credentials} Twilio credential{setup.channels.whatsapp.credentials === 1 ? "" : "s"} available
                </p>
              </article>
            </div>
            {integrations.map((integration) => (
              <article key={integration.id} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
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
                  <div className="flex gap-2">
                    <form action={verifyIntegrationAction}>
                      <input name="integrationId" type="hidden" value={integration.id} />
                      <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                        Verify
                      </button>
                    </form>
                    <form action={sendTestIntegrationAction}>
                      <input name="integrationId" type="hidden" value={integration.id} />
                      <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800" type="submit">
                        Send Test
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Add Integration
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Slack uses a bot token credential. WhatsApp uses a Twilio credential bundle with `accountSid` and `authToken`.
            </p>
            <form action={createIntegrationAction} className="mt-6 grid gap-4">
              <input name="organizationId" type="hidden" value={organizationId} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Provider
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="slack" name="provider">
                  <option value="slack">Slack</option>
                  <option value="twilio_whatsapp">WhatsApp via Twilio</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Credential
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="" name="credentialId">
                  <option value="">None</option>
                  {credentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credential.name} ({credential.provider})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Config JSON
                <textarea
                  className="min-h-40 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7"
                  defaultValue={JSON.stringify(
                    {
                      channelId: "C12345678",
                      fromNumber: "whatsapp:+14155238886",
                      toNumber: "whatsapp:+15551234567",
                    },
                    null,
                    2,
                  )}
                  name="configJson"
                />
              </label>
              <button className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" type="submit">
                Save Integration
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
