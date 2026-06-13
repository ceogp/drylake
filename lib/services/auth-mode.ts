import { env } from "@/lib/env";

export type AuthMode = "dev" | "clerk" | "cognito";

export function missingClerkKeys() {
  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  if (!env.CLERK_SECRET_KEY) {
    missing.push("CLERK_SECRET_KEY");
  }

  return missing;
}

function hasCognitoRuntimeConfig() {
  return Boolean(
    env.AWS_COGNITO_REGION &&
      env.AWS_COGNITO_USER_POOL_ID &&
      env.AWS_COGNITO_CLIENT_ID &&
      env.AWS_COGNITO_DOMAIN,
  );
}

export function getEffectiveAuthMode(): AuthMode {
  if (env.AUTH_MODE === "cognito") {
    return "cognito";
  }

  if (env.AUTH_MODE === "clerk") {
    return "clerk";
  }

  if (env.NODE_ENV === "production" && hasCognitoRuntimeConfig()) {
    return "cognito";
  }

  return missingClerkKeys().length === 0 ? "clerk" : "dev";
}

export function shouldUseClerkRuntime() {
  return getEffectiveAuthMode() === "clerk";
}

export function shouldUseCognitoRuntime() {
  return getEffectiveAuthMode() === "cognito";
}
