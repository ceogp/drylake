import { KMSClient } from "@aws-sdk/client-kms";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { env } from "@/lib/env";

const globalForAwsClients = globalThis as unknown as {
  s3Client?: S3Client | null;
  secretsManagerClient?: SecretsManagerClient | null;
  kmsClient?: KMSClient | null;
};

function clientConfig() {
  if (!env.AWS_REGION) {
    return null;
  }

  return {
    region: env.AWS_REGION,
  };
}

export function getS3Client() {
  if (globalForAwsClients.s3Client !== undefined) {
    return globalForAwsClients.s3Client;
  }

  const config = clientConfig();
  globalForAwsClients.s3Client = config ? new S3Client(config) : null;
  return globalForAwsClients.s3Client;
}

export function getSecretsManagerClient() {
  if (globalForAwsClients.secretsManagerClient !== undefined) {
    return globalForAwsClients.secretsManagerClient;
  }

  const config = clientConfig();
  globalForAwsClients.secretsManagerClient = config ? new SecretsManagerClient(config) : null;
  return globalForAwsClients.secretsManagerClient;
}

export function getKmsClient() {
  if (globalForAwsClients.kmsClient !== undefined) {
    return globalForAwsClients.kmsClient;
  }

  const config = clientConfig();
  globalForAwsClients.kmsClient = config ? new KMSClient(config) : null;
  return globalForAwsClients.kmsClient;
}
