import { ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";
import { getAuthSetup } from "@/lib/services/auth";
import { getCognitoConfig } from "@/lib/services/cognito-auth";

export async function GET() {
  const db = await prisma.$queryRawUnsafe("SELECT 1 as ok").then(() => "ok").catch(() => "error");
  const openAiConfigured = await getOpenAiApiKey().then(Boolean).catch(() => false);
  const auth = getAuthSetup();
  const cognito = getCognitoConfig();
  const stripeConfigured = Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_PRICE_ID,
  );
  const billingConfigured = stripeConfigured;
  const trustPublicationConfigured =
    env.XUPRA_TRUST_PUBLICATION_DRIVER === "s3"
      ? Boolean(env.AWS_REGION && (env.XUPRA_TRUST_PUBLICATION_BUCKET ?? env.AWS_S3_BUCKET))
      : true;

  return ok({
    service: "xupra-drylake",
    status: "ok",
    environment: env.NODE_ENV,
    release: {
      sha: env.XUPRA_RELEASE_SHA ?? null,
      shortSha: env.XUPRA_RELEASE_SHORT_SHA ?? null,
      ref: env.XUPRA_RELEASE_REF ?? null,
      pipelineId: env.XUPRA_RELEASE_PIPELINE_ID ?? null,
      deployedAt: env.XUPRA_RELEASE_DEPLOYED_AT ?? null,
    },
    connections: {
      database: db,
      authMode: auth.mode,
      authConfigured: auth.configured,
      cognitoConfigured: cognito.configured,
      artifactStorage: env.ARTIFACT_STORAGE_DRIVER,
      trustSigningConfigured: Boolean(env.AWS_REGION && env.XUPRA_TRUST_KMS_KEY_ID),
      trustPublication: env.XUPRA_TRUST_PUBLICATION_DRIVER,
      trustPublicationConfigured,
      billingProvider: "stripe",
      billingConfigured,
      stripeConfigured,
      openaiConfigured: openAiConfigured,
      storageConfigured:
        env.ARTIFACT_STORAGE_DRIVER === "local"
          ? true
          : Boolean(env.AWS_REGION && env.AWS_S3_BUCKET),
    },
    timestamp: new Date().toISOString(),
  });
}
