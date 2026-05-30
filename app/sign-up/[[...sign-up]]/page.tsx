import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { clerkTapeAppearance, DryLakeAuthShell } from "@/components/drylake-auth-shell";
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

  if (authSetup.mode !== "clerk" || !authSetup.configured) {
    redirect("/");
  }

  const clerkAuth = await auth();
  if (clerkAuth.userId) {
    redirect(redirectUrl);
  }

  return (
    <DryLakeAuthShell
      eyebrow="Create workspace"
      title="Register to try DryLake."
      body="Create a workspace, generate phased plans, and run clean handoffs with your local coding agents."
    >
      <SignUp
        appearance={clerkTapeAppearance}
        fallbackRedirectUrl={redirectUrl}
        path={authSetup.signUpUrl}
        routing="path"
        signInFallbackRedirectUrl={redirectUrl}
        signInUrl={authPathWithRedirect(authSetup.signInUrl, redirectUrl)}
      />
    </DryLakeAuthShell>
  );
}
