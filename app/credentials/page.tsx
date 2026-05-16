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
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-orange-700">Credential Vault</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-[-0.05em] text-stone-950">
            Credential vault stays out of the onboarding path.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700">
            First import should happen without asking the user to paste secrets. Come here only when
            a paid deploy or integration workflow actually needs external credentials.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            {credentials.length > 0 ? (
              credentials.map((credential) => (
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
              ))
            ) : (
              <article className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-orange-700">Not needed yet</p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
                  No credentials are configured for this workspace.
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  That is expected for first-run. Users should import a repo and see their files in
                  Xupra before they are ever asked for deploy or provider secrets.
                </p>
              </article>
            )}
          </div>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,53,15,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Availability</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-stone-950">
              Advanced-only surface
            </h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-stone-700">
              <p>Current tier: {subscription?.tier ?? "free"}</p>
              <p>Xupra Pro AI included: {entitlements.xupra_pro_ai ? "yes" : "no"}</p>
              <p>
                This page no longer asks for secrets during onboarding. Credential entry should come
                later, after import is proven and a specific deploy or integration target needs it.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="rounded-full bg-orange-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-700" href="/app">
                Back To Workspace
              </Link>
              <Link className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100" href="/billing">
                View Plans
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
