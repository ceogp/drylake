import { createCredentialAction, verifyCredentialAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { prisma } from "@/lib/prisma";

export default async function CredentialsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;

  const credentials = organizationId
    ? await prisma.credential.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Credential Vault</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Store deployment and integration credentials centrally.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            The extension gets users in the door. This page is for the credentials they only need once they are ready to export, deploy, or connect external systems.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            {credentials.map((credential) => (
              <article key={credential.id} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {credential.provider} · {credential.kind}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                      {credential.name}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      Key version: {credential.keyVersion}
                    </p>
                    <p className="text-sm leading-7 text-stone-700">
                      Last verified: {credential.lastVerifiedAt ? credential.lastVerifiedAt.toLocaleString() : "not yet"}
                    </p>
                  </div>
                  <form action={verifyCredentialAction}>
                    <input name="credentialId" type="hidden" value={credential.id} />
                    <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100" type="submit">
                      Verify
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,53,15,0.08)]">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Add Credential
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              Use this for Git providers, OpenAI, Slack, Twilio, or other deployment and messaging integrations.
            </p>
            <form action={createCredentialAction} className="mt-6 grid gap-4">
              <input name="organizationId" type="hidden" value={organizationId} />
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Name
                <input className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" name="name" placeholder="GitHub Deploy Token" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Provider
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="github" name="provider">
                  <option value="github">GitHub</option>
                  <option value="openai">OpenAI</option>
                  <option value="slack">Slack</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="twilio">Twilio</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Kind
                <select className="rounded-2xl border border-stone-300 px-4 py-3 text-sm" defaultValue="api_key" name="kind">
                  <option value="api_key">API key</option>
                  <option value="oauth_token">OAuth token</option>
                  <option value="webhook_secret">Webhook secret</option>
                  <option value="env_bundle">Env bundle</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Secret
                <textarea className="min-h-28 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7" name="secret" placeholder="Paste the secret value" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-900">
                Metadata JSON
                <textarea className="min-h-28 rounded-[1.5rem] border border-stone-300 px-4 py-4 text-sm leading-7" defaultValue="{}" name="metadataJson" />
              </label>
              <button className="mt-2 rounded-full bg-orange-600 px-5 py-3 font-medium text-white transition hover:bg-orange-700" type="submit">
                Store Credential
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
