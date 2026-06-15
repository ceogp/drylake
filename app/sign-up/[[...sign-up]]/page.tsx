import Link from "next/link";
import { redirect } from "next/navigation";

import { DryLakeLogo } from "@/components/drylake-logo";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";

function safeRedirectUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue?.startsWith("/") || rawValue.startsWith("//")) {
    return "/skills";
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
    <main className="min-h-screen bg-[#f6f7f3] px-5 py-16 text-zinc-950 md:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md items-center">
        <div className="w-full rounded-2xl border border-zinc-300 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <DryLakeLogo className="h-14 w-auto" priority tone="dark" />
          <p className="mt-8 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Register
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold leading-tight text-zinc-950">
            Register to use DryLake
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            Create your account to use Agent Control, Guard, and your Skills library.
          </p>
          <a
            className="xupra-button-primary mt-8 inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm transition"
            href={cognitoHref}
          >
            Register
          </a>
          <p className="mt-4 text-sm text-zinc-500">
            Already have an account?{" "}
            <Link className="font-medium text-emerald-700 transition hover:text-emerald-900" href={signInHref}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
