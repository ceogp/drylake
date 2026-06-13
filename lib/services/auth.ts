import { auth, clerkClient } from "@clerk/nextjs/server";

import { env } from "@/lib/env";
import { getEffectiveAuthMode, missingClerkKeys, type AuthMode } from "@/lib/services/auth-mode";
import { getCognitoConfig } from "@/lib/services/cognito-auth";
import { getCurrentAppContext } from "@/lib/services/current-user";

export function getAuthSetup() {
  const mode = getEffectiveAuthMode();
  const cognitoConfig = mode === "cognito" ? getCognitoConfig() : null;
  const provider =
    mode === "clerk" ? "clerk" : mode === "cognito" ? "aws-cognito" : "development";
  const missing =
    mode === "clerk" ? missingClerkKeys() : mode === "cognito" ? cognitoConfig?.missing ?? [] : [];

  return {
    mode,
    provider,
    configured: mode === "dev" ? true : missing.length === 0,
    pendingKeys: missing,
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
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
          imageUrl: clerkUser.imageUrl || localUser?.profile?.avatarUrl || null,
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

  if (setup.mode === "cognito") {
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

    const context = await getCurrentAppContext();

    if (!context) {
      return {
        ...setup,
        session: {
          status: "signed_out" as const,
          user: null,
          organizationId: null,
        },
      };
    }

    return {
      ...setup,
      session: {
        status: "active" as const,
        user: {
          id: context.user.id,
          email: context.user.email,
          imageUrl: context.user.profile?.avatarUrl ?? null,
          displayName: context.user.profile?.displayName ?? context.user.email,
        },
        organizationId: context.organization.id,
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
          imageUrl: user?.profile?.avatarUrl ?? null,
          displayName: user?.profile?.displayName ?? env.DEFAULT_DEV_USER_NAME,
        },
        organizationId: context?.organization.id ?? null,
      },
    };
  }
}
