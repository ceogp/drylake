import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { clerkTapeAppearance, DryLakeAuthShell } from "@/components/drylake-auth-shell";
import { buildCognitoAuthorizeUrl } from "@/lib/services/cognito-auth";
import { getAuthSetup } from "@/lib/services/auth";
import { getCurrentAppContext } from "@/lib/services/current-user";

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

  if (authSetup.mode === "cognito") {
    if (!authSetup.configured) {
      redirect("/");
    }

    const context = await getCurrentAppContext();
    if (context) {
      redirect(redirectUrl);
    }

    redirect(await buildCognitoAuthorizeUrl({ mode: "sign-in", returnTo: redirectUrl }));
  }

  if (authSetup.mode !== "clerk" || !authSetup.configured) {
    redirect("/");
  }

  const clerkAuth = await auth();
  if (clerkAuth.userId) {
    redirect(redirectUrl);
  }

  return (
    <DryLakeAuthShell
      eyebrow="Sign in"
      title="Open your DryLake workspace and Guard reports."
      body="Use the same account for extension approval, billing, saved reports, and team security review."
    >
      <SignIn
        appearance={clerkTapeAppearance}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
        path={authSetup.signInUrl}
        routing="path"
        signUpForceRedirectUrl={redirectUrl}
        signUpFallbackRedirectUrl={redirectUrl}
        signUpUrl={authPathWithRedirect(authSetup.signUpUrl, redirectUrl)}
      />
    </DryLakeAuthShell>
  );
}
