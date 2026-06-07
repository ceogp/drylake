import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

import { getSecretsManagerClient } from "@/lib/aws/clients";
import { env } from "@/lib/env";

const secretCache = new Map<string, string>();

function cacheKey(name: string) {
  return `${env.SECRETS_PROVIDER}:${name}`;
}

function isMissingSecretError(error: unknown) {
  const awsError = error as { name?: string };
  return awsError.name === "ResourceNotFoundException";
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
    const fallbackValue = params.fallback?.trim() ?? "";

    if (!fallbackValue && params.required) {
      throw new Error("AWS Secrets Manager is not configured");
    }

    secretCache.set(key, fallbackValue);
    return fallbackValue;
  }

  const secretId = `${env.AWS_SECRETS_PREFIX}/${params.name}`;
  let value = "";

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
      }),
    );

    value = response.SecretString?.trim() ?? "";
  } catch (error) {
    if (!isMissingSecretError(error)) {
      throw error;
    }

    value = params.fallback?.trim() ?? "";
  }

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

export async function getOpenAiApiKey(params: { required?: boolean } = {}) {
  return getRuntimeSecret({
    name: "openai-api-key",
    fallback: env.OPENAI_API_KEY,
    required: params.required,
  });
}

export async function getBedrockOpenAiApiKey(params: { required?: boolean } = {}) {
  return getRuntimeSecret({
    name: "bedrock-openai-api-key",
    fallback: env.BEDROCK_OPENAI_API_KEY,
    required: params.required,
  });
}

export async function getKimiApiKey(params: { required?: boolean } = {}) {
  return getRuntimeSecret({
    name: "kimi-api-key",
    fallback: env.KIMI_API_KEY,
    required: params.required,
  });
}

export async function getAnthropicApiKey(params: { required?: boolean } = {}) {
  const anthropicKey = await getRuntimeSecret({
    name: "anthropic-api-key",
    fallback: env.ANTHROPIC_API_KEY,
  });

  if (anthropicKey) {
    return anthropicKey;
  }

  return getRuntimeSecret({
    name: "claude-api-key",
    fallback: env.CLAUDE_API_KEY ?? env.claudetoken,
    required: params.required,
  });
}
