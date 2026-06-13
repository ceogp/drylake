import { env } from "@/lib/env";
import { getEffectiveAuthMode } from "@/lib/services/auth-mode";
import { getCognitoConfig } from "@/lib/services/cognito-auth";
import { getCurrentAppContext } from "@/lib/services/current-user";

export function getAuthSetup() {
  const mode = getEffectiveAuthMode();
  const cognitoConfig = getCognitoConfig();
  const provider = mode === "cognito" ? "aws-cognito" : "development";
  const missing = mode === "cognito" ? cognitoConfig.missing : [];

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
