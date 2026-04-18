import { auth, clerkClient } from "@clerk/nextjs/server";

import { env } from "@/lib/env";
import { getCurrentAppContext } from "@/lib/services/current-user";

type AuthMode = "dev" | "clerk";

function missingClerkKeys() {
  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  if (!env.CLERK_SECRET_KEY) {
    missing.push("CLERK_SECRET_KEY");
  }

  return missing;
}

function getEffectiveAuthMode(): AuthMode {
  if (env.AUTH_MODE === "clerk") {
    return "clerk";
  }

  return missingClerkKeys().length === 0 ? "clerk" : "dev";
}

export function getAuthSetup() {
  const mode = getEffectiveAuthMode();
  const provider = mode === "clerk" ? "clerk" : "development";
  const missing = mode === "clerk" ? missingClerkKeys() : [];

  return {
    mode,
    provider,
    configured: mode === "dev" ? true : missing.length === 0,
    pendingKeys: missing,
    signInUrl: env.CLERK_SIGN_IN_URL ?? "/sign-in",
    signUpUrl: env.CLERK_SIGN_UP_URL ?? "/sign-up",
  };
}

export async function getAuthSessionSummary() {
  const setup = getAuthSetup();

  if (setup.mode === "clerk") {
    if (!setup.configured) {
      return {
        ...setup,
        session: {
          status: "missing_configuration" as const,
          user: null,
          organizationId: null,
        },
      };
    }

    const clerkAuth = await auth();

    if (!clerkAuth.userId) {
      return {
        ...setup,
        session: {
          status: "signed_out" as const,
          user: null,
          organizationId: null,
        },
      };
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkAuth.userId);
    const context = await getCurrentAppContext();
    const localUser = context?.user;

    return {
      ...setup,
      session: {
        status: "active" as const,
        user: {
          id: localUser?.id ?? clerkAuth.userId,
          email:
            clerkUser.primaryEmailAddress?.emailAddress ??
            clerkUser.emailAddresses[0]?.emailAddress ??
            localUser?.email ??
            "",
          displayName:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
            clerkUser.username ||
            localUser?.profile?.displayName ||
            env.DEFAULT_DEV_USER_NAME,
        },
        organizationId: context?.organization.id ?? null,
      },
    };
  }

  {
    const context = await getCurrentAppContext({ allowDevFallback: true });
    const user = context?.user;

    return {
      ...setup,
      session: {
        status: user ? ("active" as const) : ("signed_out" as const),
        user: {
          id: user?.id ?? "",
          email: user?.email ?? "",
          displayName: user?.profile?.displayName ?? env.DEFAULT_DEV_USER_NAME,
        },
        organizationId: context?.organization.id ?? null,
      },
    };
  }
}
