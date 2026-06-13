import { env } from "@/lib/env";

export type AuthMode = "dev" | "cognito";

function hasCognitoRuntimeConfig() {
  return Boolean(
    env.AWS_COGNITO_REGION &&
      env.AWS_COGNITO_USER_POOL_ID &&
      env.AWS_COGNITO_CLIENT_ID &&
      env.AWS_COGNITO_DOMAIN,
  );
}

export function getEffectiveAuthMode(): AuthMode {
  if (env.NODE_ENV === "production") {
    return "cognito";
  }

  if (env.AUTH_MODE === "cognito") {
    return "cognito";
  }

  if (hasCognitoRuntimeConfig()) {
    return "cognito";
  }

  return "dev";
}

export function shouldUseCognitoRuntime() {
  return getEffectiveAuthMode() === "cognito";
}
