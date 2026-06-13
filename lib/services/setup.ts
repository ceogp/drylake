import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getAnthropicApiKey, getOpenAiApiKey } from "@/lib/security/runtime-secrets";
import { getAuthSetup } from "@/lib/services/auth";
import { getCognitoConfig } from "@/lib/services/cognito-auth";
import { getCurrentAppContext } from "@/lib/services/current-user";
import { foundationPlanningModel } from "@/lib/services/ai-model-selection";

async function getOrganizationContext() {
  try {
    const context = await getCurrentAppContext();
    return {
      user: context?.user ?? null,
      organizationId: context?.organization.id ?? null,
    };
  } catch {
    return {
      user: null,
      organizationId: null,
    };
  }
}

export async function getSetupStatus() {
  const auth = getAuthSetup();
  const { organizationId } = await getOrganizationContext();
  const aiConfigured = env.AI_PROVIDER === "anthropic"
    ? await getAnthropicApiKey().then(Boolean).catch(() => false)
    : await getOpenAiApiKey().then(Boolean).catch(() => false);

  const [subscription, credentials, integrations] = organizationId
    ? await Promise.all([
        prisma.subscription.findUnique({
          where: { organizationId },
        }),
        prisma.credential.findMany({
          where: { organizationId },
          select: {
            id: true,
            provider: true,
            lastVerifiedAt: true,
          },
        }),
        prisma.integration.findMany({
          where: { organizationId },
          select: {
            id: true,
            provider: true,
            status: true,
            lastVerifiedAt: true,
          },
        }),
      ])
    : [null, [], []];

  const slackCredentialCount = credentials.filter((item) => item.provider === "slack").length;
  const twilioCredentialCount = credentials.filter((item) => item.provider === "twilio").length;
  const stripeConfigured = Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRO_PRICE_ID,
  );
  const clerkConfigured = Boolean(
    auth.mode === "clerk" &&
      auth.configured &&
      env.CLERK_SECRET_KEY &&
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      env.CLERK_WEBHOOK_SIGNING_SECRET,
  );
  const cognito = getCognitoConfig();
  const billingConfigured = env.BILLING_PROVIDER === "clerk" ? clerkConfigured : stripeConfigured;

  return {
    auth,
    cognito: {
      configured: cognito.configured,
      region: cognito.region || null,
      userPoolId: cognito.userPoolId || null,
      domain: cognito.domain || null,
      missing: cognito.missing,
    },
    billing: {
      provider: env.BILLING_PROVIDER,
      configured: billingConfigured,
      portalReady:
        env.BILLING_PROVIDER === "clerk"
          ? clerkConfigured
          : Boolean(env.STRIPE_SECRET_KEY && subscription?.stripeCustomerId),
      activeTier: subscription?.tier ?? "free",
      webhookPath: env.BILLING_PROVIDER === "clerk" ? "/api/clerk/webhook" : "/api/v1/billing/webhook",
      missing:
        env.BILLING_PROVIDER === "clerk"
          ? [
              !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" : null,
              !env.CLERK_SECRET_KEY ? "CLERK_SECRET_KEY" : null,
              !env.CLERK_WEBHOOK_SIGNING_SECRET ? "CLERK_WEBHOOK_SIGNING_SECRET" : null,
            ].filter(Boolean)
          : [
              !env.STRIPE_SECRET_KEY ? "STRIPE_SECRET_KEY" : null,
              !env.STRIPE_WEBHOOK_SECRET ? "STRIPE_WEBHOOK_SECRET" : null,
              !env.STRIPE_PRO_PRICE_ID ? "STRIPE_PRO_PRICE_ID" : null,
            ].filter(Boolean),
    },
    openai: {
      configured: aiConfigured,
      provider: env.AI_PROVIDER,
      model: foundationPlanningModel(),
    },
    storage: {
      driver: env.ARTIFACT_STORAGE_DRIVER,
      configured:
        env.ARTIFACT_STORAGE_DRIVER === "local"
          ? true
          : Boolean(env.AWS_REGION && env.AWS_S3_BUCKET),
      bucket: env.AWS_S3_BUCKET ?? null,
      region: env.AWS_REGION ?? null,
      prefix: env.AWS_S3_PREFIX,
      missing:
        env.ARTIFACT_STORAGE_DRIVER === "s3"
          ? [
              !env.AWS_REGION ? "AWS_REGION" : null,
              !env.AWS_S3_BUCKET ? "AWS_S3_BUCKET" : null,
            ].filter(Boolean)
          : [],
    },
    channels: {
      slack: {
        credentials: slackCredentialCount,
        integrations: integrations.filter((item) => item.provider === "slack").length,
        webhookPath: "/api/integrations/slack/commands",
      },
      whatsapp: {
        credentials: twilioCredentialCount,
        integrations: integrations.filter((item) => item.provider === "twilio_whatsapp").length,
        webhookPath: "/api/integrations/whatsapp/webhook",
      },
    },
    extension: {
      primary: "VS Code",
      cursorStrategy: "Standard VS Code extension APIs only",
      packagePath: "extensions/xupra-drylake-vscode",
    },
  };
}
