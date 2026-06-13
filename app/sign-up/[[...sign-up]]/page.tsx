import Link from "next/link";
import { redirect } from "next/navigation";

import { DryLakeLogo } from "@/components/drylake-logo";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";

function safeRedirectUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue?.startsWith("/") || rawValue.startsWith("//")) {
    return "/workspace";
  }

  return rawValue;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const authSetup = getAuthSetup();
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const redirectUrl = safeRedirectUrl(resolvedSearchParams.redirect_url);

  if (authSetup.mode !== "cognito" || !authSetup.configured) {
    redirect("/");
  }

  const context = await getCurrentAppContext();
  if (context) {
    redirect(redirectUrl);
  }

  const cognitoHref = `/api/auth/cognito/start?mode=sign-up&returnTo=${encodeURIComponent(redirectUrl)}`;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;

  return (
    <main className="min-h-screen bg-[#090a0a] px-5 py-12 text-zinc-100 md:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-7">
          <DryLakeLogo className="h-20 w-auto" priority />
          <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Create your DryLake account
          </div>
          <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.02] text-zinc-50 sm:text-6xl">
            Start with Agent Control and Guard in one product.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-300">
            Free gives you the local Guard scan and the core agent-control workspace. Paid unlocks approved upload, Fix with AI, and Deep Cloud Analysis.
          </p>
          <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Local Guard scan</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Agent planning and handoffs</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Extension connection</span>
            <span className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">Paid remediation when ready</span>
          </div>
        </div>

        <aside className="rounded-xl border border-zinc-800 bg-[#111414] p-6 shadow-2xl shadow-black/40 md:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Register</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold text-zinc-50">
            Continue to secure signup
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            You will create your account on DryLake&apos;s AWS Cognito login at auth.drylake.xupracorp.com.
          </p>
          <a
            className="mt-6 inline-flex w-full justify-center rounded border border-emerald-400 bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            href={cognitoHref}
          >
            Create account securely
          </a>
          <Link
            className="mt-3 inline-flex w-full justify-center rounded border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-orange-400 hover:text-orange-200"
            href={signInHref}
          >
            I already have an account
          </Link>
          <p className="mt-5 text-xs leading-6 text-zinc-500">
            Email verification is handled by Cognito. DryLake stores the app session after callback.
          </p>
        </aside>
      </section>
    </main>
  );
}
