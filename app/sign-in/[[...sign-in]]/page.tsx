import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getAuthSetup } from "@/lib/services/auth";

function safeRedirectUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue?.startsWith("/") || rawValue.startsWith("//")) {
    return "/upload";
  }

  return rawValue;
}

function authPathWithRedirect(pathname: string, redirectUrl: string) {
  const params = new URLSearchParams();
  params.set("redirect_url", redirectUrl);
  return `${pathname}?${params.toString()}`;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const authSetup = getAuthSetup();
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const redirectUrl = safeRedirectUrl(resolvedSearchParams.redirect_url);

  if (authSetup.mode !== "clerk" || !authSetup.configured) {
    redirect("/");
  }

  const clerkAuth = await auth();
  if (clerkAuth.userId) {
    redirect(redirectUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#fff7ed_0%,_#fffaf5_48%,_#ffffff_100%)] px-6 py-16">
      <SignIn
        fallbackRedirectUrl={redirectUrl}
        path={authSetup.signInUrl}
        routing="path"
        signUpFallbackRedirectUrl={redirectUrl}
        signUpUrl={authPathWithRedirect(authSetup.signUpUrl, redirectUrl)}
      />
    </main>
  );
}
