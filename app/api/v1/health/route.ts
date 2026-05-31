import { ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getOpenAiApiKey } from "@/lib/security/runtime-secrets";
import { getAuthSetup } from "@/lib/services/auth";
import { checkPlanningModelAccess } from "@/lib/services/openai-health";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeDeepChecks = url.searchParams.get("deep") === "1";
  const db = await prisma.$queryRawUnsafe("SELECT 1 as ok").then(() => "ok").catch(() => "error");
  const openAiConfigured = await getOpenAiApiKey().then(Boolean).catch(() => false);
  const auth = getAuthSetup();
  const clerkConfigured = Boolean(
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      env.CLERK_SECRET_KEY &&
      env.CLERK_WEBHOOK_SIGNING_SECRET,
  );
  const stripeConfigured = Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_PRICE_ID,
  );
  const billingProvider = env.BILLING_PROVIDER;
  const billingConfigured = billingProvider === "clerk" ? clerkConfigured : stripeConfigured;

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
      artifactStorage: env.ARTIFACT_STORAGE_DRIVER,
      billingProvider,
      billingConfigured,
      clerkConfigured,
      stripeConfigured,
      openaiConfigured: openAiConfigured,
      openaiModels: includeDeepChecks ? await checkPlanningModelAccess() : {
        foundation: {
          model: env.OPENAI_MODEL,
          configured: Boolean(env.OPENAI_MODEL && openAiConfigured),
        },
        nano: {
          model: env.OPENAI_FREE_MODEL,
          configured: Boolean(env.OPENAI_FREE_MODEL && openAiConfigured),
        },
      },
      storageConfigured:
        env.ARTIFACT_STORAGE_DRIVER === "local"
          ? true
          : Boolean(env.AWS_REGION && env.AWS_S3_BUCKET),
    },
    timestamp: new Date().toISOString(),
  });
}
