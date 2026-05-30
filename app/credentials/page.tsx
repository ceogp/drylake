import Link from "next/link";

import { verifyCredentialAction } from "@/app/actions";
import { requireCurrentAppContextForPage } from "@/lib/services/current-user";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { prisma } from "@/lib/prisma";

export default async function CredentialsPage() {
  const context = await requireCurrentAppContextForPage();
  const organizationId = context.organization.id;
  const { entitlements, subscription } = await getEntitlementsForOrganization(organizationId);

  const credentials = organizationId
    ? await prisma.credential.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="min-h-screen bg-[#090a0a] text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-12 md:px-8 lg:py-16">
        <div className="space-y-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Credential Vault</p>
          <h1 className="max-w-4xl text-5xl font-semibold text-zinc-50">
            Credential vault stays out of the onboarding path.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-zinc-300">
            First import should happen without asking the user to paste secrets. Come here only when
            a paid deploy or integration workflow actually needs external credentials.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            {credentials.length > 0 ? (
              credentials.map((credential) => (
                <article key={credential.id} className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {credential.provider} · {credential.kind}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                        {credential.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-zinc-400">
                        Key version: {credential.keyVersion}
                      </p>
                      <p className="text-sm leading-7 text-zinc-400">
                        Last verified: {credential.lastVerifiedAt ? credential.lastVerifiedAt.toLocaleString() : "not yet"}
                      </p>
                    </div>
                    <form action={verifyCredentialAction}>
                      <input name="credentialId" type="hidden" value={credential.id} />
                      <button className="rounded border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" type="submit">
                        Verify
                      </button>
                    </form>
                  </div>
                </article>
              ))
            ) : (
              <article className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-300">Not needed yet</p>
                <h2 className="mt-3 text-2xl font-semibold text-zinc-50">
                  No credentials are configured for this workspace.
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  That is expected for first-run. Users should import a repo and see their files in
                  Xupra before they are asked for deploy or provider secrets.
                </p>
              </article>
            )}
          </div>

          <section className="rounded-lg border border-zinc-800 bg-[#111414] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Availability</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
              Advanced-only surface
            </h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-zinc-400">
              <p>Current tier: {subscription?.tier ?? "free"}</p>
              <p>Hosted Xupra AI included: {entitlements.xupra_pro_ai ? "yes" : "no"}</p>
              <p>
                This page no longer asks for secrets during onboarding. Credential entry should come
                later, after import is proven and a specific deploy or integration target needs it.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300" href="/app">
                Back To Workspace
              </Link>
              <Link className="rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200" href="/billing">
                View Plans
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
