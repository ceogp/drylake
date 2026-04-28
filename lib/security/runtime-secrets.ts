import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

import { getSecretsManagerClient } from "@/lib/aws/clients";
import { env } from "@/lib/env";

const secretCache = new Map<string, string>();

function cacheKey(name: string) {
  return `${env.SECRETS_PROVIDER}:${name}`;
}

export async function getRuntimeSecret(params: {
  name: string;
  fallback?: string;
  required?: boolean;
}) {
  const key = cacheKey(params.name);
  const cached = secretCache.get(key);

  if (cached) {
    return cached;
  }

  if (env.SECRETS_PROVIDER === "env") {
    const value = params.fallback?.trim() ?? "";

    if (!value && params.required) {
      throw new Error(`Missing required runtime secret: ${params.name}`);
    }

    secretCache.set(key, value);
    return value;
  }

  const client = getSecretsManagerClient();

  if (!client) {
    throw new Error("AWS Secrets Manager is not configured");
  }

  const secretId = `${env.AWS_SECRETS_PREFIX}/${params.name}`;
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  );

  const value = response.SecretString?.trim() ?? "";

  if (!value && params.required) {
    throw new Error(`Missing required runtime secret in Secrets Manager: ${secretId}`);
  }

  secretCache.set(key, value);
  return value;
}

export async function getAppEncryptionSecret() {
  const value = await getRuntimeSecret({
    name: "app-encryption-key",
    fallback: env.APP_ENCRYPTION_KEY,
    required: true,
  });

  if (value.length < 32) {
    throw new Error("Application encryption key must be at least 32 characters");
  }

  return value;
}
